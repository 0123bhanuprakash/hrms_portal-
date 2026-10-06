import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { LeaveStatus, RoleStatus, TicketQueue, TicketStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { dateFromKey, isValidTimeZone, localDateKey } from '../attendance/time-zone';
import { RealtimeService, room } from '../realtime/realtime.service';
import { QUEUE_LABEL, QUEUE_PERMISSION, QUEUES } from './sla';
import type { SaveTeamDto } from './dto';

const OPEN: TicketStatus[] = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING];

export interface TeamLeads {
  headId: string | null;
  backupId: string | null;
  /** Who gets "new ticket / needs an owner" alerts right now: the head, or the backup while the head is away. Empty = nobody set. */
  onDuty: string[];
}

/**
 * Team heads (one per queue). With a head set, new tickets go to the head,
 * who assigns them; members work only what is assigned to them. The backup
 * may assign too and takes the alerts while the head is on leave.
 * Without a head, the queue works as before: anyone in it takes tickets.
 */
@Injectable()
export class HelpdeskTeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Head + backup per queue for one company (queues without a head are left out). */
  async heads(companyId: string): Promise<Map<TicketQueue, { headId: string | null; backupId: string | null }>> {
    const rows = await this.prisma.helpdeskTeam.findMany({ where: { companyId }, select: { queue: true, headId: true, backupId: true } });
    return new Map(rows.filter((r) => r.headId).map((r) => [r.queue, { headId: r.headId, backupId: r.backupId }]));
  }

  async leads(companyId: string, queue: TicketQueue): Promise<TeamLeads> {
    const t = (await this.heads(companyId)).get(queue);
    if (!t) return { headId: null, backupId: null, onDuty: [] };
    const ids = [t.headId, t.backupId].filter((x): x is string => Boolean(x));
    const away = await this.awayToday(companyId, ids);
    const usable = await this.activeIds(ids);
    const head = t.headId && usable.has(t.headId) && !away.has(t.headId) ? t.headId : null;
    const backup = t.backupId && usable.has(t.backupId) && !away.has(t.backupId) ? t.backupId : null;
    return { ...t, onDuty: head ? [head] : backup ? [backup] : [] };
  }

  /** May this person assign tickets in the queue? */
  isLead(access: AccessContext, team: { headId: string | null; backupId: string | null } | undefined, queue: TicketQueue): boolean {
    if (!holds(access, QUEUE_PERMISSION[queue])) return false;
    if (!team?.headId) return true;
    return access.isOwner || access.isSuperAdmin || access.userId === team.headId || access.userId === team.backupId;
  }

  /**
   * For employees: each team's usual first-reply time (median, last 30 days)
   * and who leads it — the "usually replies in ~2 h" cards and "who will help".
   */
  async directory(companyId: string) {
    const since = new Date(Date.now() - 30 * 86400_000);
    const [heads, rows] = await Promise.all([
      this.heads(companyId),
      this.prisma.ticket.findMany({ where: { companyId, createdAt: { gte: since }, firstRespondedAt: { not: null } }, select: { queue: true, createdAt: true, firstRespondedAt: true }, take: 2000 }),
    ]);
    const headIds = [...heads.values()].map((h) => h.headId).filter((x): x is string => Boolean(x));
    const people = headIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: headIds }, status: UserStatus.ACTIVE }, select: { id: true, firstName: true, lastName: true, employee: { select: { avatarUrl: true } } } })
      : [];
    const who = new Map(people.map((p) => [p.id, { id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.employee?.avatarUrl ?? null }]));
    return QUEUES.map((queue) => {
      const mins = rows.filter((r) => r.queue === queue).map((r) => (r.firstRespondedAt!.getTime() - r.createdAt.getTime()) / 60_000).sort((a, b) => a - b);
      const median = mins.length >= 3 ? Math.round(mins[Math.floor(mins.length / 2)]!) : null;
      const headId = heads.get(queue)?.headId;
      return { queue, label: QUEUE_LABEL[queue], typicalReplyMinutes: median, head: headId ? (who.get(headId) ?? null) : null };
    });
  }

  // ─── Teams & heads page ────────────────────────────────────

  async list(companyId: string, access: AccessContext) {
    const canManage = holds(access, 'ticket.manage_teams');
    const queues = QUEUES.filter((q) => canManage || holds(access, QUEUE_PERMISSION[q]));
    if (!queues.length) throw new ForbiddenException('You don’t work any helpdesk queue');
    const heads = await this.heads(companyId);
    const out = [];
    for (const queue of queues) {
      const t = heads.get(queue);
      const memberIds = await this.memberIds(companyId, queue);
      const ids = [...new Set([...memberIds, ...(t?.headId ? [t.headId] : []), ...(t?.backupId ? [t.backupId] : [])])];
      const [users, open, away] = await Promise.all([
        this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, status: true, employee: { select: { avatarUrl: true, designation: { select: { name: true } } } } }, orderBy: { firstName: 'asc' } }),
        this.prisma.ticket.groupBy({ by: ['assigneeId'], where: { companyId, queue, status: { in: OPEN }, assigneeId: { in: ids } }, _count: { _all: true } }),
        this.awayToday(companyId, ids),
      ]);
      const openBy = new Map(open.map((o) => [o.assigneeId, o._count._all]));
      const unassigned = await this.prisma.ticket.count({ where: { companyId, queue, status: { in: OPEN }, assigneeId: null } });
      out.push({
        queue,
        label: QUEUE_LABEL[queue],
        headId: t?.headId ?? null,
        backupId: t?.backupId ?? null,
        unassigned,
        members: users.map((u) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          avatarUrl: u.employee?.avatarUrl ?? null,
          designation: u.employee?.designation?.name ?? null,
          active: u.status === UserStatus.ACTIVE,
          inQueue: memberIds.includes(u.id),
          open: openBy.get(u.id) ?? 0,
          awayToday: away.has(u.id),
        })),
        isLead: this.isLead(access, t, queue),
      });
    }
    return { canManage, teams: out };
  }

  async save(companyId: string, access: AccessContext, queue: TicketQueue, dto: SaveTeamDto) {
    if (!holds(access, 'ticket.manage_teams')) throw new ForbiddenException('Only a Company Admin chooses team heads');
    const headId = dto.headId ?? null;
    const backupId = headId ? (dto.backupId ?? null) : null;
    if (headId && backupId && headId === backupId) throw new BadRequestException('Pick a different person as backup');
    const members = new Set(await this.memberIds(companyId, queue));
    for (const id of [headId, backupId]) {
      if (id && !members.has(id)) throw new BadRequestException(`That person doesn’t work the ${QUEUE_LABEL[queue]} queue — give them the queue first`);
    }
    await this.prisma.helpdeskTeam.upsert({
      where: { companyId_queue: { companyId, queue } },
      update: { headId, backupId },
      create: { companyId, queue, headId, backupId },
    });
    // Who may assign / reply changed — open queue pages reload
    this.realtime.changed([room.queue(companyId, queue)], 'helpdesk');
    return this.list(companyId, access);
  }

  /** Active users who hold the queue permission through a role (Company Admins only if they hold it explicitly). */
  async memberIds(companyId: string, queue: TicketQueue): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { status: RoleStatus.ACTIVE, rolePermissions: { some: { permission: { key: QUEUE_PERMISSION[queue] } } } } } },
      },
      select: { id: true },
      take: 200,
    });
    return users.map((u) => u.id);
  }

  private async activeIds(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.prisma.user.findMany({ where: { id: { in: ids }, status: UserStatus.ACTIVE }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  }

  /** User ids (of those given) on approved leave today, company time. */
  async awayToday(companyId: string, userIds: string[]): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    const today = dateFromKey(localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata'));
    const rows = await this.prisma.leaveRequest.findMany({
      where: { companyId, status: LeaveStatus.APPROVED, startDate: { lte: today }, endDate: { gte: today }, employee: { userId: { in: userIds } } },
      select: { employee: { select: { userId: true } } },
    });
    return new Set(rows.map((r) => r.employee.userId).filter((x): x is string => Boolean(x)));
  }
}
