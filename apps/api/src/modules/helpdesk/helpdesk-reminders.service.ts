import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TicketMessageKind, TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AUTO_CLOSE_DAYS } from './sla';
import { TicketsService } from './tickets.service';
import { HelpdeskTeamsService } from './teams.service';

const EVERY_MS = 15 * 60_000;
/** Urgent / High tickets nobody owns after this long → remind the team head again. */
const UNASSIGNED_ALERT_MS = 30 * 60_000;

/**
 * Every 15 minutes: tells agents about missed response / resolution targets
 * (once per ticket and target), reminds team heads about Urgent / High tickets
 * still without an owner, and closes tickets resolved more than AUTO_CLOSE_DAYS ago.
 */
@Injectable()
export class HelpdeskRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HelpdeskRemindersService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly tickets: TicketsService,
    private readonly teams: HelpdeskTeamsService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.run(), EVERY_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 120_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<{ warned: number; closed: number }> {
    let warned = 0;
    let closed = 0;
    try {
      const late = await this.prisma.ticket.findMany({
        where: {
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
          OR: [{ firstRespondedAt: null, firstResponseDueAt: { lt: now } }, { resolutionDueAt: { lt: now } }],
        },
        select: { id: true, companyId: true, number: true, queue: true, subject: true, assigneeId: true, firstRespondedAt: true, firstResponseDueAt: true, resolutionDueAt: true },
        take: 500,
      });
      const agents = new Map<string, string[]>();
      for (const t of late) {
        const key = `${t.companyId}:${t.queue}`;
        if (!agents.has(key)) {
          // Unowned tickets: the team head (or backup) when the team has one, else everyone in the queue
          const { onDuty } = await this.teams.leads(t.companyId, t.queue);
          agents.set(key, onDuty.length ? onDuty : await this.teams.agentIds(t.companyId, t.queue));
        }
        const to = t.assigneeId ? [t.assigneeId] : agents.get(key)!;
        const response = !t.firstRespondedAt && t.firstResponseDueAt < now;
        const resolution = t.resolutionDueAt < now;
        if (response) {
          warned += await this.notifications.notify({
            companyId: t.companyId,
            userIds: to,
            type: 'ticket.sla',
            title: `No reply yet on #${t.number} (${(await this.teams.catalog(t.companyId)).label(t.queue)}): ${t.subject}`,
            body: 'The first-response target has passed.',
            link: `/app/helpdesk/${t.id}`,
            actionLabel: 'Open ticket',
            email: false,
            dedupeKey: `ticket-response:${t.id}`,
          });
        }
        if (resolution) {
          warned += await this.notifications.notify({
            companyId: t.companyId,
            userIds: to,
            type: 'ticket.sla',
            title: `#${t.number} is past its resolution target: ${t.subject}`,
            link: `/app/helpdesk/${t.id}`,
            actionLabel: 'Open ticket',
            email: false,
            dedupeKey: `ticket-resolution:${t.id}:${t.resolutionDueAt.getTime()}`,
          });
        }
      }

      const unowned = await this.prisma.ticket.findMany({
        where: { status: TicketStatus.OPEN, assigneeId: null, priority: { in: [TicketPriority.URGENT, TicketPriority.HIGH] }, createdAt: { lt: new Date(now.getTime() - UNASSIGNED_ALERT_MS) } },
        select: { id: true, companyId: true, number: true, queue: true, subject: true, priority: true },
        take: 500,
      });
      for (const t of unowned) {
        const { onDuty } = await this.teams.leads(t.companyId, t.queue);
        if (!onDuty.length) continue;
        warned += await this.notifications.notify({
          companyId: t.companyId,
          userIds: onDuty,
          type: 'ticket.unassigned',
          title: `#${t.number} still has no owner (${t.priority === TicketPriority.URGENT ? 'Urgent' : 'High'}): ${t.subject}`,
          body: `Assign it to someone in the ${(await this.teams.catalog(t.companyId)).label(t.queue)} team.`,
          link: `/app/helpdesk/${t.id}`,
          actionLabel: 'Assign',
          email: false,
          dedupeKey: `ticket-unassigned:${t.id}`,
        });
      }

      const stale = await this.prisma.ticket.findMany({
        where: { status: TicketStatus.RESOLVED, resolvedAt: { lt: new Date(now.getTime() - AUTO_CLOSE_DAYS * 86400_000) } },
        select: { id: true, companyId: true, queue: true, employee: { select: { userId: true } } },
        take: 500,
      });
      for (const t of stale) {
        const { count } = await this.prisma.ticket.updateMany({ where: { id: t.id, status: TicketStatus.RESOLVED }, data: { status: TicketStatus.CLOSED, closedAt: now } });
        if (!count) continue;
        await this.prisma.ticketMessage.create({ data: { companyId: t.companyId, ticketId: t.id, kind: TicketMessageKind.EVENT, body: `Closed automatically ${AUTO_CLOSE_DAYS} days after it was resolved` } });
        this.tickets.live(t.companyId, t);
        closed++;
      }
    } catch (err) {
      this.logger.error('Helpdesk reminders failed', err as Error);
    }
    return { warned, closed };
  }
}
