import { randomBytes } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus, RoleStatus, TicketStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { dateFromKey, isValidTimeZone, localDateKey } from '../attendance/time-zone';
import { RealtimeService, room } from '../realtime/realtime.service';
import { isBuiltIn, QUEUE_EMOJI, QUEUE_LABEL, QUEUE_PERMISSION, QUEUE_TEXT, QUEUES } from './sla';
import type { CreateTeamDto, SaveTeamDto } from './dto';

const OPEN: TicketStatus[] = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING];
/** Company-made teams per company */
const MAX_CUSTOM = 30;
/** How long a company's team list is reused between requests (cleared on every team write here) */
const CATALOG_TTL_MS = 3000;

export interface TeamLeads {
  headId: string | null;
  backupId: string | null;
  /** Who gets "new ticket / needs an owner" alerts right now: the head, or the backup while the head is away. Empty = nobody set. */
  onDuty: string[];
}

export interface QueueInfo {
  queue: string;
  label: string;
  emoji: string;
  /** What the team helps with (shown on "Raise a ticket") */
  text: string;
  custom: boolean;
  archived: boolean;
  /** Company-made teams: the people who work it (built-in teams go by role permission) */
  memberIds: string[];
  headId: string | null;
  backupId: string | null;
}

/** One company's helpdesk teams: the built-in four first, then its own in the order they were made. */
export class QueueCatalog {
  private readonly byKey: Map<string, QueueInfo>;
  constructor(readonly all: QueueInfo[]) {
    this.byKey = new Map(all.map((q) => [q.queue, q]));
  }

  get(queue: string): QueueInfo | undefined {
    return this.byKey.get(queue);
  }

  label(queue: string): string {
    return this.byKey.get(queue)?.label ?? 'Helpdesk';
  }

  /** Teams that take new tickets (not archived). */
  get open(): QueueInfo[] {
    return this.all.filter((q) => !q.archived);
  }

  /** Does this person work the team? Built-in: the role permission. Company-made: picked as a member. */
  works(access: AccessContext, queue: string): boolean {
    if (isBuiltIn(queue)) return holds(access, QUEUE_PERMISSION[queue]);
    const q = this.byKey.get(queue);
    return Boolean(q && (access.isSuperAdmin || q.memberIds.includes(access.userId)));
  }

  worksOf(access: AccessContext): string[] {
    return this.all.filter((q) => this.works(access, q.queue)).map((q) => q.queue);
  }

  /** A team new tickets can go to (exists, not archived). */
  assertOpen(queue: string): QueueInfo {
    const q = this.byKey.get(queue);
    if (!q) throw new BadRequestException('Pick a helpdesk team');
    if (q.archived) throw new BadRequestException(`${q.label} no longer takes new tickets`);
    return q;
  }
}

/**
 * Helpdesk teams. Every company has IT, HR, Finance and DevOps (worked through
 * role permissions); people with ticket.manage_teams add their own teams and
 * pick who works them. Team heads: with a head set, new tickets go to the head,
 * who assigns them; members work only what is assigned to them. The backup may
 * assign too and takes the alerts while the head is on leave. Without a head,
 * anyone in the team takes tickets.
 */
@Injectable()
export class HelpdeskTeamsService {
  private readonly cache = new Map<string, { at: number; catalog: Promise<QueueCatalog> }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Catalog ───────────────────────────────────────────────

  catalog(companyId: string): Promise<QueueCatalog> {
    const hit = this.cache.get(companyId);
    if (hit && Date.now() - hit.at < CATALOG_TTL_MS) return hit.catalog;
    const catalog = this.loadCatalog(companyId);
    this.cache.set(companyId, { at: Date.now(), catalog });
    catalog.catch(() => this.cache.delete(companyId));
    return catalog;
  }

  private async loadCatalog(companyId: string): Promise<QueueCatalog> {
    const rows = await this.prisma.helpdeskTeam.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
    const byQueue = new Map(rows.map((r) => [r.queue, r]));
    const builtIn: QueueInfo[] = QUEUES.map((queue) => {
      const r = byQueue.get(queue);
      return { queue, label: QUEUE_LABEL[queue], emoji: QUEUE_EMOJI[queue], text: QUEUE_TEXT[queue], custom: false, archived: false, memberIds: [], headId: r?.headId ?? null, backupId: r?.headId ? r.backupId : null };
    });
    const custom: QueueInfo[] = rows
      .filter((r) => r.custom)
      .map((r) => ({ queue: r.queue, label: r.label ?? 'Team', emoji: r.emoji ?? '🎫', text: r.description ?? '', custom: true, archived: Boolean(r.archivedAt), memberIds: r.memberIds, headId: r.headId, backupId: r.headId ? r.backupId : null }));
    return new QueueCatalog([...builtIn, ...custom]);
  }

  private forget(companyId: string) {
    this.cache.delete(companyId);
  }

  /** Head + backup per team for one company (teams without a head are left out). */
  async heads(companyId: string): Promise<Map<string, { headId: string | null; backupId: string | null }>> {
    const cat = await this.catalog(companyId);
    return new Map(cat.all.filter((q) => q.headId).map((q) => [q.queue, { headId: q.headId, backupId: q.backupId }]));
  }

  async leads(companyId: string, queue: string): Promise<TeamLeads> {
    const t = (await this.heads(companyId)).get(queue);
    if (!t) return { headId: null, backupId: null, onDuty: [] };
    const ids = [t.headId, t.backupId].filter((x): x is string => Boolean(x));
    const away = await this.awayToday(companyId, ids);
    const usable = await this.activeIds(ids);
    const head = t.headId && usable.has(t.headId) && !away.has(t.headId) ? t.headId : null;
    const backup = t.backupId && usable.has(t.backupId) && !away.has(t.backupId) ? t.backupId : null;
    return { ...t, onDuty: head ? [head] : backup ? [backup] : [] };
  }

  /** May this person assign tickets in the team? */
  isLead(cat: QueueCatalog, access: AccessContext, team: { headId: string | null; backupId: string | null } | undefined, queue: string): boolean {
    if (!cat.works(access, queue)) return false;
    if (!team?.headId) return true;
    return access.isOwner || access.isSuperAdmin || access.userId === team.headId || access.userId === team.backupId;
  }

  /**
   * Active people who work the team. Built-in: holders of the team permission
   * (Company Admins only if they hold it explicitly). Company-made: its members.
   */
  async memberIds(companyId: string, queue: string): Promise<string[]> {
    if (isBuiltIn(queue)) {
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
    const q = (await this.catalog(companyId)).get(queue);
    return q ? [...(await this.activeIds(q.memberIds, companyId))] : [];
  }

  /** Who hears about a team's tickets: built-in → company-wide holders of the permission (incl. Company Admins); company-made → its members. */
  async agentIds(companyId: string, queue: string): Promise<string[]> {
    if (isBuiltIn(queue)) return this.notifications.companyWideApprovers(companyId, QUEUE_PERMISSION[queue]);
    return this.memberIds(companyId, queue);
  }

  /** Can this user take tickets in the team (assign picker, "send straight to")? */
  async userWorks(companyId: string, userId: string, queue: string): Promise<boolean> {
    if (isBuiltIn(queue)) return this.notifications.holds(userId, QUEUE_PERMISSION[queue]);
    return (await this.memberIds(companyId, queue)).includes(userId);
  }

  /**
   * For employees: each open team's usual first-reply time (median, last 30 days)
   * and who leads it — the "usually replies in ~2 h" cards and "who will help".
   */
  async directory(companyId: string) {
    const since = new Date(Date.now() - 30 * 86400_000);
    // Median per team worked out in the database (no ticket rows are loaded)
    const [cat, rows] = await Promise.all([
      this.catalog(companyId),
      this.prisma.$queryRaw<Array<{ queue: string; n: number; median: number | null }>>`
        SELECT queue,
               COUNT(*)::int AS n,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_responded_at - created_at)) / 60)::float8 AS median
        FROM tickets
        WHERE company_id = ${companyId}::uuid AND created_at >= ${since} AND first_responded_at IS NOT NULL
        GROUP BY queue`,
    ]);
    const byQueue = new Map(rows.map((r) => [r.queue, r]));
    const headIds = cat.open.map((q) => q.headId).filter((x): x is string => Boolean(x));
    const people = headIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: headIds }, status: UserStatus.ACTIVE }, select: { id: true, firstName: true, lastName: true, employee: { select: { avatarUrl: true } } } })
      : [];
    const who = new Map(people.map((p) => [p.id, { id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.employee?.avatarUrl ?? null }]));
    return cat.open.map((q) => {
      const r = byQueue.get(q.queue);
      const median = r && r.n >= 3 && r.median !== null ? Math.round(r.median) : null;
      return { queue: q.queue, label: q.label, typicalReplyMinutes: median, head: q.headId ? (who.get(q.headId) ?? null) : null };
    });
  }

  /** Every team of the company (archived ones too, so old tickets show their name), and which ones this person works. */
  async queues(companyId: string, access: AccessContext) {
    const cat = await this.catalog(companyId);
    return cat.all.map(({ memberIds: _m, headId: _h, backupId: _b, ...q }) => ({ ...q, works: cat.works(access, q.queue) }));
  }

  // ─── Teams & heads page ────────────────────────────────────

  async list(companyId: string, access: AccessContext) {
    const canManage = holds(access, 'ticket.manage_teams');
    const cat = await this.catalog(companyId);
    const queues = cat.all.filter((q) => canManage || (!q.archived && cat.works(access, q.queue)));
    if (!queues.length) throw new ForbiddenException('You don’t work any helpdesk team');
    const out = [];
    for (const q of queues) {
      const queue = q.queue;
      const memberIds = await this.memberIds(companyId, queue);
      // Company-made teams list every picked member (even inactive ones, so they can be taken off)
      const listed = q.custom ? q.memberIds : memberIds;
      const ids = [...new Set([...listed, ...(q.headId ? [q.headId] : []), ...(q.backupId ? [q.backupId] : [])])];
      const [users, open, away, unassigned] = await Promise.all([
        this.prisma.user.findMany({ where: { id: { in: ids }, companyId }, select: { id: true, firstName: true, lastName: true, status: true, employee: { select: { avatarUrl: true, designation: { select: { name: true } } } } }, orderBy: { firstName: 'asc' } }),
        this.prisma.ticket.groupBy({ by: ['assigneeId'], where: { companyId, queue, status: { in: OPEN }, assigneeId: { in: ids } }, _count: { _all: true } }),
        this.awayToday(companyId, ids),
        this.prisma.ticket.count({ where: { companyId, queue, status: { in: OPEN }, assigneeId: null } }),
      ]);
      const openBy = new Map(open.map((o) => [o.assigneeId, o._count._all]));
      out.push({
        queue,
        label: q.label,
        emoji: q.emoji,
        description: q.text,
        custom: q.custom,
        archived: q.archived,
        headId: q.headId,
        backupId: q.backupId,
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
        isLead: this.isLead(cat, access, q.headId ? q : undefined, queue),
      });
    }
    return { canManage, teams: out };
  }

  /** A new company-made team. */
  async create(companyId: string, access: AccessContext, dto: CreateTeamDto) {
    this.assertManager(access);
    const count = await this.prisma.helpdeskTeam.count({ where: { companyId, custom: true } });
    if (count >= MAX_CUSTOM) throw new BadRequestException(`A company can have up to ${MAX_CUSTOM} teams of its own`);
    await this.assertNameFree(companyId, dto.label);
    const memberIds = await this.checkMembers(companyId, dto.memberIds ?? []);
    const queue = `T${randomBytes(4).toString('hex').toUpperCase()}`;
    await this.prisma.helpdeskTeam.create({
      data: { companyId, queue, custom: true, label: dto.label, emoji: dto.emoji ?? null, description: dto.description ?? null, memberIds },
    });
    this.changed(companyId, queue, memberIds);
    return { queue, ...(await this.list(companyId, access)) };
  }

  /**
   * Head and backup of any team; for company-made teams also name, emoji,
   * description, members and archived. The built-in four keep their names.
   */
  async save(companyId: string, access: AccessContext, queue: string, dto: SaveTeamDto) {
    this.assertManager(access);
    const cat = await this.catalog(companyId);
    const q = cat.get(queue);
    if (!q) throw new NotFoundException('Team not found');
    const editsTeam = dto.label !== undefined || dto.emoji !== undefined || dto.description !== undefined || dto.memberIds !== undefined || dto.archived !== undefined;
    if (!q.custom && editsTeam) throw new BadRequestException(`${q.label} is one of the built-in teams — it can’t be renamed, archived or given members (who works it comes from roles)`);

    const label = dto.label ?? q.label;
    if (q.custom && dto.label !== undefined && dto.label.toLowerCase() !== q.label.toLowerCase()) await this.assertNameFree(companyId, dto.label, queue);
    const memberIds = q.custom && dto.memberIds !== undefined ? await this.checkMembers(companyId, dto.memberIds) : q.memberIds;
    const team = dto.headId !== undefined ? { headId: dto.headId ?? null, backupId: dto.headId ? (dto.backupId ?? null) : null } : { headId: q.headId, backupId: q.backupId };
    if (team.headId && team.backupId && team.headId === team.backupId) throw new BadRequestException('Pick a different person as backup');
    // A head or backup must work the team; taking a member off also takes them off as head / backup
    const works = q.custom ? new Set(memberIds) : new Set(await this.memberIds(companyId, queue));
    if (dto.headId !== undefined) {
      for (const id of [team.headId, team.backupId]) {
        if (id && !works.has(id)) throw new BadRequestException(`That person doesn’t work the ${label} team — ${q.custom ? 'add them as a member' : 'give them the team in Roles'} first`);
      }
    } else if (q.custom) {
      if (team.backupId && !works.has(team.backupId)) team.backupId = null;
      if (team.headId && !works.has(team.headId)) team.headId = team.backupId = null;
    }
    const archivedAt = dto.archived === undefined ? undefined : dto.archived ? new Date() : null;
    if (dto.archived && !q.archived) {
      const open = await this.prisma.ticket.count({ where: { companyId, queue, status: { in: OPEN } } });
      if (open && !dto.force) throw new ConflictException(`${q.label} still has ${open} open ticket${open === 1 ? '' : 's'} — move or finish ${open === 1 ? 'it' : 'them'} first, or archive anyway (they can still be finished)`);
    }
    const data = {
      ...team,
      ...(q.custom && {
        label,
        ...(dto.emoji !== undefined && { emoji: dto.emoji }),
        ...(dto.description !== undefined && { description: dto.description }),
        memberIds,
        ...(archivedAt !== undefined && { archivedAt }),
      }),
    };
    await this.prisma.helpdeskTeam.upsert({
      where: { companyId_queue: { companyId, queue } },
      update: data,
      create: { companyId, queue, ...data },
    });
    // People who joined or left: their menus, rooms and open queue pages refresh
    this.changed(companyId, queue, [...new Set([...q.memberIds, ...memberIds])]);
    return this.list(companyId, access);
  }

  private assertManager(access: AccessContext) {
    if (!holds(access, 'ticket.manage_teams')) throw new ForbiddenException('You can’t manage helpdesk teams');
  }

  private async assertNameFree(companyId: string, label: string, except?: string) {
    const cat = await this.catalog(companyId);
    if (cat.all.some((q) => q.queue !== except && q.label.toLowerCase() === label.toLowerCase())) throw new ConflictException(`There’s already a team called “${label}”`);
  }

  /** Members must be active people of this company. */
  private async checkMembers(companyId: string, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    const found = await this.prisma.user.count({ where: { id: { in: unique }, companyId, status: UserStatus.ACTIVE } });
    if (found !== unique.length) throw new BadRequestException('Pick active people from your company');
    return unique;
  }

  private changed(companyId: string, queue: string, userIds: string[]) {
    this.forget(companyId);
    this.realtime.changed([room.queue(companyId, queue)], 'helpdesk');
    // Everyone's team list (raise a ticket, labels) — and joiners / leavers get new rooms and menus
    this.realtime.changed([room.company(companyId)], 'helpdesk', { teams: true });
    if (userIds.length) this.realtime.accessChanged({ userIds });
  }

  private async activeIds(ids: string[], companyId?: string): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.prisma.user.findMany({ where: { id: { in: ids }, status: UserStatus.ACTIVE, ...(companyId && { companyId }) }, select: { id: true } });
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
