import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoleStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProducerService } from '../email/email.producer.service';

export interface NotifyInput {
  companyId: string | null;
  userIds: Array<string | null | undefined>;
  /** e.g. leave.submitted — used for icons and filtering */
  type: string;
  title: string;
  body?: string | null;
  /** App path, e.g. /app/leave/approvals */
  link?: string | null;
  actionLabel?: string;
  /** One notification per user per key (reminders) */
  dedupeKey?: string;
  /** Also email (if the user allows notification emails). Default true. */
  email?: boolean;
}

/**
 * In-app inbox + notification emails. `notify` never throws — a failed
 * notification must not undo the leave approval that caused it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProducerService,
    private readonly config: ConfigService,
  ) {}

  async notify(input: NotifyInput): Promise<number> {
    try {
      const userIds = [...new Set(input.userIds.filter((id): id is string => Boolean(id)))];
      if (!userIds.length) return 0;
      const created: string[] = [];
      if (!input.dedupeKey) {
        // Bulk (e.g. a company-wide announcement)
        const rows = await this.prisma.notification.createManyAndReturn({
          data: userIds.map((userId) => ({
            companyId: input.companyId,
            userId,
            type: input.type,
            title: input.title.slice(0, 200),
            body: input.body?.slice(0, 1000) ?? null,
            link: input.link ?? null,
          })),
          select: { id: true },
        });
        created.push(...rows.map((r) => r.id));
      }
      for (const userId of input.dedupeKey ? userIds : []) {
        try {
          const n = await this.prisma.notification.create({
            data: {
              companyId: input.companyId,
              userId,
              type: input.type,
              title: input.title.slice(0, 200),
              body: input.body?.slice(0, 1000) ?? null,
              link: input.link ?? null,
              dedupeKey: input.dedupeKey ?? null,
            },
            select: { id: true },
          });
          created.push(n.id);
        } catch (err) {
          // Already notified for this dedupe key → skip quietly
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        }
      }
      if (created.length && input.email !== false) void this.emailOut(created, input);
      return created.length;
    } catch (err) {
      this.logger.error(`Could not create "${input.type}" notifications`, err as Error);
      return 0;
    }
  }

  /** Emails the new notifications to users who allow notification emails. */
  private async emailOut(ids: string[], input: NotifyInput): Promise<void> {
    try {
      const rows = await this.prisma.notification.findMany({
        where: { id: { in: ids }, user: { status: UserStatus.ACTIVE, OR: [{ preferences: null }, { preferences: { emailNotifications: true } }] } },
        select: { id: true, user: { select: { email: true, firstName: true } } },
      });
      if (!rows.length) return;
      const company = input.companyId
        ? await this.prisma.company.findUnique({ where: { id: input.companyId }, select: { name: true, branding: { select: { displayName: true, primaryColor: true, logoUrl: true } } } })
        : null;
      const webUrl = (this.config.get<string>('webUrl') ?? 'http://localhost:3000').replace(/\/+$/, '');
      for (const row of rows) {
        await this.email.queueNotification({
          to: row.user.email,
          firstName: row.user.firstName,
          title: input.title,
          body: input.body ?? null,
          actionUrl: input.link ? `${webUrl}${input.link}` : null,
          actionLabel: input.actionLabel,
          preferencesUrl: `${webUrl}/app/settings/preferences`,
          companyName: company?.branding?.displayName || company?.name || undefined,
          primaryColor: company?.branding?.primaryColor ?? undefined,
          logoUrl: company?.branding?.logoUrl ?? undefined,
        });
        await this.prisma.notification.update({ where: { id: row.id }, data: { emailedAt: new Date() } });
      }
    } catch (err) {
      this.logger.error(`Could not email "${input.type}" notifications`, err as Error);
    }
  }

  // ─── Inbox ─────────────────────────────────────────────────

  async list(userId: string, opts: { unreadOnly?: boolean; page?: number; limit?: number }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const where: Prisma.NotificationWhereInput = { userId, ...(opts.unreadOnly && { readAt: null }) };
    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      }),
      this.prisma.notification.count({ where }),
      this.unreadCount(userId),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit), unread } };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    if (!count && !(await this.prisma.notification.count({ where: { id, userId } }))) throw new NotFoundException('Notification not found');
    return { id, unread: await this.unreadCount(userId) };
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { marked: count, unread: 0 };
  }

  // ─── Recipients ────────────────────────────────────────────

  /** Active users whose roles hold `permission` company-wide (HR), plus Company Admins. */
  async companyWideApprovers(companyId: string, permission: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: {
              status: RoleStatus.ACTIVE,
              OR: [{ isOwner: true }, { rolePermissions: { some: { permission: { key: permission }, OR: [{ scope: 'company' }, { scope: null }] } } }],
            },
          },
        },
      },
      select: { id: true },
      take: 25,
    });
    return users.map((u) => u.id);
  }

  /** Whether a user's roles include a permission (any scope). */
  async holds(userId: string, permission: string): Promise<boolean> {
    return (
      (await this.prisma.userRole.count({
        where: {
          userId,
          user: { status: UserStatus.ACTIVE },
          role: { status: RoleStatus.ACTIVE, OR: [{ isOwner: true }, { rolePermissions: { some: { permission: { key: permission } } } }] },
        },
      })) > 0
    );
  }

  /** People covering approvals for these users right now (active delegations). */
  async coveringFor(userIds: string[]): Promise<string[]> {
    if (!userIds.length) return [];
    const now = new Date();
    const rows = await this.prisma.approvalDelegation.findMany({
      where: { delegatorId: { in: userIds }, revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { delegateId: true },
    });
    return rows.map((r) => r.delegateId);
  }
}

/** "Mon, 5 Oct" or "5 Oct – 9 Oct" from date keys. */
export function dateRange(startKey: string, endKey: string): string {
  const fmt = (k: string, withDay: boolean) =>
    new Date(`${k}T00:00:00Z`).toLocaleDateString('en-GB', { ...(withDay && { weekday: 'short' }), day: 'numeric', month: 'short', timeZone: 'UTC' });
  return startKey === endKey ? fmt(startKey, true) : `${fmt(startKey, false)} – ${fmt(endKey, false)}`;
}
