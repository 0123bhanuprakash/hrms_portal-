import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmploymentStatus, LeaveStatus, Prisma, ProjectRole, ProjectStatus, ProjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessService } from '../access/access.service';
import { holds, type AccessContext } from '../access/access.types';
import { addDays, dateFromKey, keyFromDate } from '../attendance/time-zone';
import { wordsWhere } from '../../common/word-search';
import { allocationOn, peakAllocation, type Span } from './allocation';
import { ProjectsService } from './projects.service';
import type { AvailableQueryDto, MilestoneDto, MilestonePatchDto, PlannerQueryDto, ProjectQueryDto, ProjectUpdateDto, TimelineQueryDto } from './dto';

// ============================================================
// Project planning without hours: health from milestones, dates and
// staffing (+ the PM's weekly update), milestones, open roles, activity,
// billable / investment / bench from allocations, timeline, planner.
// ============================================================

export type Health = 'on_track' | 'at_risk' | 'off_track';
export type Level = Health | 'planned' | 'on_hold' | 'done';
/** A PM update counts for this long; after it, the PM is reminded */
const UPDATE_FRESH_DAYS = 14;
const DAY = 86_400_000;

const FACE = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (k: string) => `${Number(k.slice(8, 10))} ${MONTHS[Number(k.slice(5, 7)) - 1]}`;
const daysBetween = (a: string, b: string) => Math.round((dateFromKey(b).getTime() - dateFromKey(a).getTime()) / DAY);

interface HealthInput {
  status: ProjectStatus;
  startDate: string;
  endDate: string | null;
  milestones: Array<{ title: string; dueDate: string; doneAt: Date | null }>;
  openRoles: Array<{ title: string; fromDate: string; filledAt: Date | null }>;
  hasManager: boolean;
  lastUpdate: { health: string; note: string; createdAt: Date } | null;
}

/** How a project is doing, and why. */
export function projectHealth(p: HealthInput, today: string) {
  const reasons: string[] = [];
  const off: string[] = [];
  if (p.status === ProjectStatus.COMPLETED) return { level: 'done' as Level, computed: null, reasons, override: null, updateOverdue: false };
  if (p.endDate && p.endDate < today) off.push('Past its end date');
  for (const m of p.milestones) {
    if (m.doneAt) continue;
    const late = daysBetween(m.dueDate, today);
    if (late > 7) off.push(`${m.title} is ${late} days late`);
    else if (late > 0) reasons.push(`${m.title} is ${late} day${late === 1 ? '' : 's'} late`);
    else if (late >= -7) reasons.push(`${m.title} due ${late === 0 ? 'today' : `in ${-late} day${late === -1 ? '' : 's'}`}`);
  }
  for (const r of p.openRoles) if (!r.filledAt && daysBetween(today, r.fromDate) <= 14) reasons.push(`Needs a person: ${r.title}`);
  if (!p.hasManager) reasons.push('No project manager');
  const computed: Health = off.length ? 'off_track' : reasons.length ? 'at_risk' : 'on_track';
  const fresh = p.lastUpdate && Date.now() - p.lastUpdate.createdAt.getTime() < UPDATE_FRESH_DAYS * DAY ? p.lastUpdate : null;
  const started = p.startDate <= today;
  const level: Level = p.status === ProjectStatus.ON_HOLD ? 'on_hold' : p.status === ProjectStatus.PLANNED || !started ? 'planned' : ((fresh?.health as Health) ?? computed);
  return {
    level,
    computed,
    reasons: [...off, ...reasons],
    override: fresh && fresh.health !== computed ? { health: fresh.health, note: fresh.note, at: fresh.createdAt } : null,
    updateOverdue: p.status === ProjectStatus.ACTIVE && started && daysBetween(p.startDate, today) >= UPDATE_FRESH_DAYS && !fresh,
  };
}

@Injectable()
export class ProjectPlanningService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ProjectPlanningService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly access?: AccessService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.remindUpdates(), 60 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ─── Permissions ──────────────────────────────────────────

  private pmo(access: AccessContext) {
    return holds(access, 'project.manage');
  }

  /** Projects this person has (or had) an assignment on — they see those in full. */
  private async myProjectIds(access: AccessContext): Promise<Set<string>> {
    if (!access.employee) return new Set();
    const rows = await this.prisma.projectMember.findMany({ where: { employeeId: access.employee.id }, select: { projectId: true }, distinct: ['projectId'] });
    return new Set(rows.map((r) => r.projectId));
  }

  /**
   * Someone's projects / billing split: themselves, the PMO, or anyone whose
   * employee.view reaches them (their managers, HR).
   */
  async assertCanSeePerson(companyId: string, access: AccessContext, employeeId: string) {
    if (this.pmo(access) || access.employee?.id === employeeId) return;
    const scope = this.access?.employeeScope(access, 'employee.view');
    if (scope && (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope] } }))) return;
    throw new ForbiddenException('You can only see your own projects');
  }

  /** PMO, or a project manager on this project today. */
  async canPlan(companyId: string, access: AccessContext, projectId: string, today?: string): Promise<boolean> {
    if (this.pmo(access)) return true;
    if (!access.employee) return false;
    const t = dateFromKey(today ?? (await this.projects.todayKey(companyId)));
    return (await this.prisma.projectMember.count({ where: { projectId, employeeId: access.employee.id, role: ProjectRole.MANAGER, startDate: { lte: t }, OR: [{ endDate: null }, { endDate: { gte: t } }] } })) > 0;
  }

  /** A team lead or PM on this project today, its Delivery Director, or the PMO. */
  async assertInCharge(companyId: string, access: AccessContext, projectId: string, message: string) {
    if (this.pmo(access)) return;
    const me = access.employee?.id;
    if (me) {
      const t = dateFromKey(await this.projects.todayKey(companyId));
      const [role, dd] = await Promise.all([
        this.prisma.projectMember.count({ where: { projectId, employeeId: me, role: { in: [ProjectRole.TEAM_LEAD, ProjectRole.MANAGER] }, startDate: { lte: t }, OR: [{ endDate: null }, { endDate: { gte: t } }] } }),
        this.prisma.project.count({ where: { id: projectId, companyId, deliveryDirectorId: me } }),
      ]);
      if (role || dd) return;
    }
    throw new ForbiddenException(message);
  }

  private async assertPlan(companyId: string, access: AccessContext, projectId: string) {
    const p = await this.prisma.project.findFirst({ where: { id: projectId, companyId }, select: { id: true, name: true, startDate: true, endDate: true } });
    if (!p) throw new NotFoundException('Project not found');
    if (!(await this.canPlan(companyId, access, projectId))) throw new ForbiddenException('Only the PMO and the project’s manager can change this');
    return p;
  }

  async record(db: Prisma.TransactionClient | PrismaService, companyId: string, projectId: string, actor: string | null, kind: string, text: string, value?: string) {
    await db.projectEvent.create({ data: { companyId, projectId, actorUserId: actor, kind, text, value: value ?? null } });
  }

  // ─── Health inputs for many projects at once ──────────────

  private async healthInputs(companyId: string, ids: string[], today: string) {
    const t = dateFromKey(today);
    const [milestones, roles, managers, updates] = await Promise.all([
      this.prisma.projectMilestone.findMany({ where: { projectId: { in: ids } }, orderBy: { dueDate: 'asc' }, select: { projectId: true, id: true, title: true, dueDate: true, doneAt: true } }),
      // Open resource requests (they replaced the old open roles)
      this.prisma.resourceRequest.findMany({ where: { projectId: { in: ids }, kind: 'REQUEST', status: { in: ['OPEN', 'ON_HOLD', 'AWAITING_CONSENT'] } }, select: { projectId: true, title: true, fromDate: true, createdAt: true } }).then((rs) => rs.map((x) => ({ projectId: x.projectId, title: x.title ?? 'Person', fromDate: x.fromDate ?? x.createdAt, filledAt: null as Date | null }))),
      this.prisma.projectMember.findMany({ where: { projectId: { in: ids }, role: ProjectRole.MANAGER, startDate: { lte: t }, OR: [{ endDate: null }, { endDate: { gte: t } }] }, select: { projectId: true, employee: { select: FACE } } }),
      this.prisma.projectUpdate.findMany({ where: { projectId: { in: ids } }, orderBy: { createdAt: 'desc' }, distinct: ['projectId'], select: { projectId: true, health: true, note: true, createdAt: true } }),
    ]);
    const by = <T extends { projectId: string }>(rows: T[]) => {
      const m = new Map<string, T[]>();
      for (const r of rows) m.set(r.projectId, [...(m.get(r.projectId) ?? []), r]);
      return m;
    };
    return { milestones: by(milestones), roles: by(roles), managers: by(managers), updates: new Map(updates.map((u) => [u.projectId, u])) };
  }

  private healthOf(p: { id: string; status: ProjectStatus; startDate: Date; endDate: Date | null }, h: Awaited<ReturnType<ProjectPlanningService['healthInputs']>>, today: string) {
    const ms = h.milestones.get(p.id) ?? [];
    return projectHealth(
      {
        status: p.status,
        startDate: keyFromDate(p.startDate),
        endDate: p.endDate ? keyFromDate(p.endDate) : null,
        milestones: ms.map((m) => ({ title: m.title, dueDate: keyFromDate(m.dueDate), doneAt: m.doneAt })),
        openRoles: (h.roles.get(p.id) ?? []).map((r) => ({ title: r.title, fromDate: keyFromDate(r.fromDate), filledAt: r.filledAt })),
        hasManager: (h.managers.get(p.id) ?? []).length > 0,
        lastUpdate: h.updates.get(p.id) ?? null,
      },
      today,
    );
  }

  // ─── Portfolio ────────────────────────────────────────────

  async list(companyId: string, query: ProjectQueryDto, viewer?: AccessContext) {
    const today = await this.projects.todayKey(companyId);
    // Everyone sees which projects exist; details only for the PMO and the people on them
    const full = !viewer || this.pmo(viewer) ? null : await this.myProjectIds(viewer);
    const t = dateFromKey(today);
    const search = wordsWhere(query.search, (w): Prisma.ProjectWhereInput[] => [
      { name: { contains: w, mode: 'insensitive' } },
      { code: { contains: w, mode: 'insensitive' } },
      { clientName: { contains: w, mode: 'insensitive' } },
    ]);
    const active: Prisma.ProjectMemberWhereInput = { startDate: { lte: t }, OR: [{ endDate: null }, { endDate: { gte: t } }] };
    const rows = await this.prisma.project.findMany({
      where: {
        companyId,
        ...(query.status && { status: query.status }),
        ...(query.type && { type: query.type }),
        ...(query.managerId && { members: { some: { ...active, role: ProjectRole.MANAGER, employeeId: query.managerId } } }),
        ...(search ?? {}),
      },
      select: {
        id: true, code: true, name: true, clientName: true, type: true, color: true, status: true, startDate: true, endDate: true,
        members: { where: active, select: { role: true, billed: true, employee: { select: FACE } }, orderBy: [{ role: 'desc' }, { startDate: 'asc' }] },
      },
    });
    const h = await this.healthInputs(companyId, rows.map((r) => r.id), today);
    const out = rows.map(({ members, ...p }) => {
      const health = this.healthOf(p, h, today);
      const ms = h.milestones.get(p.id) ?? [];
      const next = ms.find((m) => !m.doneAt);
      const start = keyFromDate(p.startDate);
      const end = p.endDate ? keyFromDate(p.endDate) : null;
      const update = h.updates.get(p.id) ?? null;
      return {
        ...p,
        startDate: start,
        endDate: end,
        managers: members.filter((m) => m.role === ProjectRole.MANAGER).map((m) => m.employee),
        memberCount: members.length,
        billedCount: p.type === ProjectType.CLIENT ? members.filter((m) => m.billed).length : 0,
        team: members.slice(0, 5).map((m) => m.employee),
        health,
        milestones: { done: ms.filter((m) => m.doneAt).length, total: ms.length, next: next ? { title: next.title, dueDate: keyFromDate(next.dueDate) } : null },
        openRoles: (h.roles.get(p.id) ?? []).length,
        timePct: end ? Math.max(0, Math.min(100, Math.round((daysBetween(start, today) / Math.max(1, daysBetween(start, end))) * 100))) : null,
        lastUpdate: update ? { health: update.health, at: update.createdAt } : null,
      };
    });
    const filtered = (query.health ? out.filter((p) => p.health.level === query.health) : out).filter(
      // Filters on details can't match projects whose details are hidden
      (p) => !full || full.has(p.id) || !(query.health || query.managerId || query.status),
    );
    const rank: Record<Level, number> = { off_track: 0, at_risk: 1, on_track: 2, planned: 3, on_hold: 4, done: 5 };
    const sort = query.sort ?? 'attention';
    filtered.sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'end' ? (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999')
      : sort === 'start' ? b.startDate.localeCompare(a.startDate)
      : rank[a.health.level] - rank[b.health.level] || (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999'),
    );
    if (full) filtered.sort((a, b) => Number(full.has(b.id)) - Number(full.has(a.id)));
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const rowsOut = filtered.slice((page - 1) * limit, page * limit).map((p) =>
      !full || full.has(p.id) ? { ...p, limited: false as const } : { id: p.id, code: p.code, name: p.name, clientName: p.clientName, type: p.type, color: p.color, limited: true as const },
    );
    return { data: rowsOut, meta: { total: filtered.length, page, limit, totalPages: Math.ceil(filtered.length / limit), today, seesAll: !full } };
  }

  /** Every project with all its details (internal use: summary, timeline, reminders). */
  private async fullList(companyId: string, query: ProjectQueryDto) {
    type Row = Awaited<ReturnType<ProjectPlanningService['list']>>['data'][number];
    return (await this.list(companyId, query)).data.filter((p): p is Extract<Row, { limited: false }> => !p.limited);
  }

  /** The numbers across the top of the portfolio. */
  async summary(companyId: string) {
    const today = await this.projects.todayKey(companyId);
    const list = await this.fullList(companyId, { limit: 1000 });
    const activeOnes = list.filter((p) => p.status === ProjectStatus.ACTIVE);
    const month = today.slice(0, 7);
    const ms = await this.prisma.projectMilestone.findMany({
      where: { companyId, dueDate: { gte: dateFromKey(`${month}-01`), lt: dateFromKey(`${addMonth(month)}-01`) }, project: { status: { not: ProjectStatus.COMPLETED } } },
      select: { dueDate: true, doneAt: true },
    });
    const [now, lastMonth] = await Promise.all([this.billingOn(companyId, today), this.billingOn(companyId, addDays(today, -30))]);
    return {
      today,
      active: activeOnes.length,
      startingThisMonth: list.filter((p) => p.startDate.startsWith(month) && p.status !== ProjectStatus.COMPLETED).length,
      attention: {
        total: activeOnes.filter((p) => p.health.level === 'off_track' || p.health.level === 'at_risk').length,
        offTrack: activeOnes.filter((p) => p.health.level === 'off_track').length,
        atRisk: activeOnes.filter((p) => p.health.level === 'at_risk').length,
        updatesOverdue: activeOnes.filter((p) => p.health.updateOverdue).length,
      },
      milestonesThisMonth: { total: ms.length, done: ms.filter((m) => m.doneAt).length, overdue: ms.filter((m) => !m.doneAt && keyFromDate(m.dueDate) < today).length },
      endingSoon: activeOnes.filter((p) => p.endDate && p.endDate >= today && p.endDate <= addDays(today, 30)).map((p) => ({ id: p.id, name: p.name, endDate: p.endDate })),
      billing: now,
      billingLastMonth: lastMonth,
    };
  }

  // ─── Billable / investment / bench ────────────────────────

  /** Project types as they were on a date (type changes are kept in the activity). */
  private async typesOn(companyId: string, date: string): Promise<Map<string, ProjectType>> {
    const [projects, changes] = await Promise.all([
      this.prisma.project.findMany({ where: { companyId }, select: { id: true, type: true } }),
      this.prisma.projectEvent.findMany({ where: { companyId, kind: 'type' }, orderBy: { createdAt: 'asc' }, select: { projectId: true, value: true, createdAt: true } }),
    ]);
    const end = new Date(dateFromKey(date).getTime() + DAY);
    const out = new Map(projects.map((p) => [p.id, p.type]));
    const byProject = new Map<string, typeof changes>();
    for (const c of changes) byProject.set(c.projectId, [...(byProject.get(c.projectId) ?? []), c]);
    for (const [id, list] of byProject) {
      const before = list.filter((c) => c.createdAt < end);
      if (before.length) out.set(id, before[before.length - 1]!.value as ProjectType);
      else {
        // Changed only later: before the first change it was the other type
        const first = list[0]!.value as ProjectType;
        out.set(id, first === ProjectType.CLIENT ? ProjectType.INTERNAL : ProjectType.CLIENT);
      }
    }
    return out;
  }

  /** Company-wide split on a date: billable %, investment %, bench %. */
  async billingOn(companyId: string, date: string) {
    const d = dateFromKey(date);
    const [people, members, types] = await Promise.all([
      this.prisma.employee.findMany({ where: { companyId, joiningDate: { lte: d }, OR: [{ employmentStatus: { not: EmploymentStatus.TERMINATED } }, { terminationDate: { gt: d } }] }, select: { id: true } }),
      this.prisma.projectMember.findMany({ where: { companyId, startDate: { lte: d }, OR: [{ endDate: null }, { endDate: { gte: d } }], project: { status: { not: ProjectStatus.COMPLETED } } }, select: { employeeId: true, projectId: true, allocation: true, billed: true } }),
      this.typesOn(companyId, date),
    ]);
    const ids = new Set(people.map((p) => p.id));
    let billable = 0;
    let investment = 0;
    const onProjects = new Set<string>();
    for (const m of members) {
      if (!ids.has(m.employeeId)) continue;
      onProjects.add(m.employeeId);
      if (types.get(m.projectId) === ProjectType.CLIENT && m.billed) billable += m.allocation;
      else investment += m.allocation;
    }
    const capacity = people.length * 100;
    const pct = (n: number) => (capacity ? Math.round((n / capacity) * 1000) / 10 : 0);
    return {
      date,
      headcount: people.length,
      onProjects: onProjects.size,
      bench: people.length - onProjects.size,
      billablePct: pct(billable),
      investmentPct: pct(investment),
      benchPct: capacity ? Math.round(((capacity - billable - investment) / capacity) * 1000) / 10 : 0,
    };
  }

  /** One person's split today (profile, My projects). */
  async personBilling(companyId: string, employeeId: string, date?: string) {
    const today = date ?? (await this.projects.todayKey(companyId));
    const d = dateFromKey(today);
    const rows = await this.prisma.projectMember.findMany({
      where: { companyId, employeeId, startDate: { lte: d }, OR: [{ endDate: null }, { endDate: { gte: d } }], project: { status: { not: ProjectStatus.COMPLETED } } },
      select: { allocation: true, billed: true, project: { select: { type: true } } },
    });
    const billable = rows.filter((r) => r.project.type === ProjectType.CLIENT && r.billed).reduce((n, r) => n + r.allocation, 0);
    const total = rows.reduce((n, r) => n + r.allocation, 0);
    return { billable, investment: total - billable, bench: Math.max(0, 100 - total) };
  }

  // ─── Project page ─────────────────────────────────────────

  async detail(companyId: string, id: string, access: AccessContext) {
    if (!this.pmo(access) && !(await this.myProjectIds(access)).has(id)) {
      const p = await this.prisma.project.findFirst({ where: { id, companyId }, select: { id: true, code: true, name: true, clientName: true, type: true, color: true, description: true } });
      if (!p) throw new NotFoundException('Project not found');
      return { ...p, limited: true };
    }
    const base = await this.projects.get(companyId, id);
    const today = base.today;
    const [project, milestones, updates, roles, events, canPlan] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({ where: { id }, select: { id: true, type: true, color: true, status: true, startDate: true, endDate: true } }),
      this.prisma.projectMilestone.findMany({ where: { projectId: id }, orderBy: { dueDate: 'asc' }, select: { id: true, title: true, dueDate: true, doneAt: true, owner: { select: FACE } } }),
      this.prisma.projectUpdate.findMany({ where: { projectId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, health: true, note: true, createdAt: true, authorUserId: true } }),
      // Open resource requests (they replaced the old open roles)
      this.prisma.resourceRequest.findMany({ where: { projectId: id, kind: 'REQUEST', status: { in: ['OPEN', 'ON_HOLD', 'AWAITING_CONSENT'] } }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true, allocation: true, fromDate: true, createdAt: true } }).then((rs) => rs.map((x) => ({ id: x.id, title: x.title ?? 'Person', allocation: x.allocation ?? 0, fromDate: x.fromDate ?? x.createdAt, filledAt: null as Date | null }))),
      this.prisma.projectEvent.findMany({ where: { projectId: id }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, kind: true, text: true, createdAt: true, actorUserId: true } }),
      this.canPlan(companyId, access, id, today),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set([...updates.map((u) => u.authorUserId), ...events.map((e) => e.actorUserId)].filter((x): x is string => Boolean(x)))] } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, employee: { select: { avatarUrl: true } } },
    });
    const who = new Map(users.map((u) => [u.id, { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.employee?.avatarUrl ?? u.avatarUrl }]));
    const activeMembers = base.members.filter((m) => m.active);
    const health = projectHealth(
      {
        status: project.status,
        startDate: base.startDate,
        endDate: base.endDate,
        milestones: milestones.map((m) => ({ title: m.title, dueDate: keyFromDate(m.dueDate), doneAt: m.doneAt })),
        openRoles: roles.map((r) => ({ title: r.title, fromDate: keyFromDate(r.fromDate), filledAt: r.filledAt })),
        hasManager: activeMembers.some((m) => m.role === ProjectRole.MANAGER),
        lastUpdate: updates[0] ?? null,
      },
      today,
    );
    // Who's on leave today among the team
    const away = activeMembers.length
      ? await this.prisma.leaveRequest.findMany({
          where: { companyId, status: LeaveStatus.APPROVED, employeeId: { in: activeMembers.map((m) => m.employee.id) }, startDate: { lte: dateFromKey(today) }, endDate: { gte: dateFromKey(today) } },
          select: { employeeId: true },
        })
      : [];
    return {
      ...base,
      type: project.type,
      color: project.color,
      health,
      milestones: milestones.map((m) => ({ ...m, dueDate: keyFromDate(m.dueDate) })),
      updates: updates.map((u) => ({ id: u.id, health: u.health, note: u.note, createdAt: u.createdAt, author: u.authorUserId ? (who.get(u.authorUserId) ?? null) : null })),
      openRoles: roles.map((r) => ({ ...r, fromDate: keyFromDate(r.fromDate) })),
      activity: events.map((e) => ({ id: e.id, kind: e.kind, text: e.text, at: e.createdAt, actor: e.actorUserId ? (who.get(e.actorUserId) ?? null) : null })),
      awayToday: [...new Set(away.map((a) => a.employeeId))],
      billedCount: project.type === ProjectType.CLIENT ? activeMembers.filter((m) => m.billed).length : 0,
      timePct: base.endDate ? Math.max(0, Math.min(100, Math.round((daysBetween(base.startDate, today) / Math.max(1, daysBetween(base.startDate, base.endDate))) * 100))) : null,
      canManage: this.pmo(access),
      canPlan,
      limited: false,
    };
  }

  // ─── Milestones ───────────────────────────────────────────

  async addMilestone(companyId: string, access: AccessContext, projectId: string, dto: MilestoneDto) {
    const p = await this.assertPlan(companyId, access, projectId);
    await this.assertOwner(companyId, dto.ownerEmployeeId);
    this.assertInside(p, dto.dueDate);
    const m = await this.prisma.$transaction(async (tx) => {
      const row = await tx.projectMilestone.create({ data: { companyId, projectId, title: dto.title, dueDate: dateFromKey(dto.dueDate), ownerEmployeeId: dto.ownerEmployeeId ?? null }, select: { id: true } });
      await this.record(tx, companyId, projectId, access.userId, 'milestone_added', `added milestone “${dto.title}” (${fmt(dto.dueDate)})`);
      return row;
    });
    return { id: m.id };
  }

  async updateMilestone(companyId: string, access: AccessContext, projectId: string, milestoneId: string, dto: MilestonePatchDto) {
    const m = await this.prisma.projectMilestone.findFirst({ where: { id: milestoneId, projectId, companyId }, select: { id: true, title: true, doneAt: true, ownerEmployeeId: true, project: { select: { startDate: true, endDate: true } } } });
    if (!m) throw new NotFoundException('Milestone not found');
    const planner = await this.canPlan(companyId, access, projectId);
    const owner = Boolean(access.employee && m.ownerEmployeeId === access.employee.id);
    const onlyDone = Object.entries(dto).every(([k, v]) => k === 'done' || v === undefined);
    // The owner may tick their own milestone; everything else needs the PMO / PM
    if (!planner && !(owner && onlyDone)) throw new ForbiddenException('Only the PMO, the project’s manager or the milestone’s owner can change this');
    if (dto.ownerEmployeeId !== undefined) await this.assertOwner(companyId, dto.ownerEmployeeId);
    if (dto.dueDate) this.assertInside(m.project, dto.dueDate);
    await this.prisma.$transaction(async (tx) => {
      await tx.projectMilestone.update({
        where: { id: milestoneId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.dueDate !== undefined && { dueDate: dateFromKey(dto.dueDate) }),
          ...(dto.ownerEmployeeId !== undefined && { ownerEmployeeId: dto.ownerEmployeeId }),
          ...(dto.done !== undefined && { doneAt: dto.done ? (m.doneAt ?? new Date()) : null }),
        },
      });
      if (dto.done !== undefined && dto.done !== Boolean(m.doneAt)) {
        await this.record(tx, companyId, projectId, access.userId, dto.done ? 'milestone_done' : 'milestone_reopened', `${dto.done ? 'marked' : 'reopened'} “${dto.title ?? m.title}”${dto.done ? ' done' : ''}`);
      }
    });
    return { id: milestoneId };
  }

  async removeMilestone(companyId: string, access: AccessContext, projectId: string, milestoneId: string) {
    await this.assertPlan(companyId, access, projectId);
    const m = await this.prisma.projectMilestone.findFirst({ where: { id: milestoneId, projectId }, select: { id: true } });
    if (!m) throw new NotFoundException('Milestone not found');
    await this.prisma.projectMilestone.delete({ where: { id: milestoneId } });
    return { id: milestoneId };
  }

  private async assertOwner(companyId: string, ownerId: string | null | undefined) {
    if (ownerId && !(await this.prisma.employee.count({ where: { id: ownerId, companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } } }))) throw new NotFoundException('Owner not found');
  }

  private assertInside(p: { startDate: Date; endDate: Date | null }, day: string) {
    if (day < keyFromDate(p.startDate)) throw new BadRequestException('A milestone can’t be before the project starts');
    if (p.endDate && day > keyFromDate(p.endDate)) throw new BadRequestException('A milestone can’t be after the project ends');
  }

  // ─── Status updates ───────────────────────────────────────

  async postUpdate(companyId: string, access: AccessContext, projectId: string, dto: ProjectUpdateDto) {
    const p = await this.assertPlan(companyId, access, projectId);
    const label = { on_track: '🟢 on track', at_risk: '🟠 at risk', off_track: '🔴 off track' }[dto.health];
    const u = await this.prisma.$transaction(async (tx) => {
      const row = await tx.projectUpdate.create({ data: { companyId, projectId, authorUserId: access.userId, health: dto.health, note: dto.note }, select: { id: true, createdAt: true } });
      await this.record(tx, companyId, projectId, access.userId, 'update', `posted an update — ${label}`);
      return row;
    });
    // Tell the team (in-app only)
    const t = dateFromKey(await this.projects.todayKey(companyId));
    const team = await this.prisma.projectMember.findMany({ where: { projectId, startDate: { lte: t }, OR: [{ endDate: null }, { endDate: { gte: t } }] }, select: { employee: { select: { userId: true } } } });
    void this.notifications.notify({
      companyId,
      userIds: team.map((m) => m.employee.userId).filter((u2) => u2 !== access.userId),
      type: 'project.update',
      title: `${p.name}: ${label}`,
      body: dto.note.length > 200 ? `${dto.note.slice(0, 197)}…` : dto.note,
      link: `/app/projects/${projectId}`,
      email: false,
    });
    return { id: u.id, createdAt: u.createdAt };
  }

  /** Hourly: PMs whose project has had no update for 14 days get one reminder a week. */
  async remindUpdates() {
    try {
      const companies = await this.prisma.project.findMany({ where: { status: ProjectStatus.ACTIVE }, distinct: ['companyId'], select: { companyId: true } });
      let sent = 0;
      for (const { companyId } of companies) {
        const today = await this.projects.todayKey(companyId);
        const data = await this.fullList(companyId, { status: ProjectStatus.ACTIVE, limit: 1000 });
        for (const p of data.filter((x) => x.health.updateOverdue)) {
          const pms = await this.prisma.projectMember.findMany({
            where: { projectId: p.id, role: ProjectRole.MANAGER, startDate: { lte: dateFromKey(today) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(today) } }] },
            select: { employee: { select: { userId: true } } },
          });
          if (!pms.length) continue;
          sent += await this.notifications.notify({
            companyId,
            userIds: pms.map((m) => m.employee.userId),
            type: 'project.update_due',
            title: `How’s ${p.name} going? Post a quick update`,
            body: 'It’s been over 2 weeks since the last one — the team and HR see it.',
            link: `/app/projects/${p.id}`,
            actionLabel: 'Post update',
            email: false,
            dedupeKey: `project-update:${p.id}:${weekOf(today)}`,
          });
        }
      }
      return sent;
    } catch (err) {
      this.logger.error('Project update reminders failed', err as Error);
      return 0;
    }
  }

  // ─── Timeline ─────────────────────────────────────────────

  async timeline(companyId: string, q: TimelineQueryDto) {
    const today = await this.projects.todayKey(companyId);
    const from = q.from ?? addMonth(today.slice(0, 7), -1);
    const months = q.months ?? 6;
    const to = addDays(`${addMonth(from, months)}-01`, -1);
    const start = `${from}-01`;
    const data = await this.fullList(companyId, { limit: 1000 });
    const shown = data.filter((p) => p.startDate <= to && (!p.endDate || p.endDate >= start));
    const ids = shown.map((p) => p.id);
    const [milestones, members] = await Promise.all([
      this.prisma.projectMilestone.findMany({ where: { projectId: { in: ids }, dueDate: { gte: dateFromKey(start), lte: dateFromKey(to) } }, orderBy: { dueDate: 'asc' }, select: { id: true, projectId: true, title: true, dueDate: true, doneAt: true } }),
      this.prisma.projectMember.findMany({
        where: { companyId, startDate: { lte: dateFromKey(to) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(start) } }], project: { status: { not: ProjectStatus.COMPLETED } } },
        select: { employeeId: true, allocation: true, startDate: true, endDate: true, project: { select: { id: true, code: true, name: true } }, employee: { select: FACE } },
      }),
    ]);
    // People on two or more projects at the same time within the window
    const byPerson = new Map<string, typeof members>();
    for (const m of members) byPerson.set(m.employeeId, [...(byPerson.get(m.employeeId) ?? []), m]);
    const overlaps: Array<{ employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null }; projects: Array<{ code: string; name: string; allocation: number }>; total: number; from: string }> = [];
    for (const list of byPerson.values()) {
      if (new Set(list.map((m) => m.project.id)).size < 2) continue;
      const points = [...new Set(list.map((m) => (keyFromDate(m.startDate) > start ? keyFromDate(m.startDate) : start)))].filter((p) => p <= to).sort();
      for (const p of points) {
        const on = list.filter((m) => keyFromDate(m.startDate) <= p && (!m.endDate || keyFromDate(m.endDate) >= p));
        if (new Set(on.map((m) => m.project.id)).size >= 2) {
          overlaps.push({ employee: list[0]!.employee, projects: on.map((m) => ({ code: m.project.code, name: m.project.name, allocation: m.allocation })), total: on.reduce((n, m) => n + m.allocation, 0), from: p });
          break;
        }
      }
    }
    overlaps.sort((a, b) => b.projects.length - a.projects.length || b.total - a.total);
    return {
      from: start,
      to,
      today,
      projects: shown.map((p) => ({ ...p, milestoneList: milestones.filter((m) => m.projectId === p.id).map((m) => ({ id: m.id, title: m.title, dueDate: keyFromDate(m.dueDate), done: Boolean(m.doneAt) })) })),
      milestonesThisMonth: milestones
        .filter((m) => keyFromDate(m.dueDate).startsWith(today.slice(0, 7)))
        .map((m) => ({ id: m.id, title: m.title, dueDate: keyFromDate(m.dueDate), done: Boolean(m.doneAt), project: shown.find((p) => p.id === m.projectId)?.name ?? '' })),
      overlaps: overlaps.slice(0, 12),
    };
  }

  // ─── Resource planner ─────────────────────────────────────

  async planner(companyId: string, q: PlannerQueryDto) {
    const today = await this.projects.todayKey(companyId);
    const weeks = q.weeks ?? 8;
    const first = mondayOf(q.from ?? today);
    const last = addDays(first, weeks * 7 - 1);
    const search = wordsWhere(q.search, (w): Prisma.EmployeeWhereInput[] => [{ firstName: { contains: w, mode: 'insensitive' } }, { lastName: { contains: w, mode: 'insensitive' } }]);
    const people = await this.prisma.employee.findMany({
      where: {
        companyId,
        joiningDate: { lte: dateFromKey(last) },
        OR: [{ employmentStatus: { not: EmploymentStatus.TERMINATED } }, { terminationDate: { gte: dateFromKey(first) } }],
        ...(q.departmentId && { departmentId: q.departmentId }),
        ...(search ?? {}),
      },
      orderBy: [{ firstName: 'asc' }],
      select: { ...FACE, designation: { select: { name: true } }, department: { select: { name: true } } },
    });
    const ids = people.map((p) => p.id);
    const members = await this.prisma.projectMember.findMany({
      where: { employeeId: { in: ids }, project: { status: { not: ProjectStatus.COMPLETED } }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(first) } }] },
      select: { id: true, employeeId: true, allocation: true, billed: true, startDate: true, endDate: true, project: { select: { id: true, code: true, name: true, type: true, color: true } } },
    });
    const byPerson = new Map<string, typeof members>();
    for (const m of members) byPerson.set(m.employeeId, [...(byPerson.get(m.employeeId) ?? []), m]);
    const nextMonth = { from: addDays(today, 1), to: addDays(today, 30) };
    const rows = people.map((p) => {
      const list = byPerson.get(p.id) ?? [];
      const spans = (pred: (m: (typeof list)[number]) => boolean): Span[] => list.filter(pred).map((m) => ({ allocation: m.allocation, start: keyFromDate(m.startDate), end: m.endDate ? keyFromDate(m.endDate) : null }));
      const all = spans(() => true);
      const billableSpans = spans((m) => m.project.type === ProjectType.CLIENT && m.billed);
      const cells = Array.from({ length: weeks }, (_, i) => {
        const ws = addDays(first, i * 7);
        // The busiest day of the week decides the cell
        let best = { day: ws, total: -1 };
        for (let d = 0; d < 7; d++) {
          const day = addDays(ws, d);
          const total = allocationOn(all, day);
          if (total > best.total) best = { day, total };
        }
        const billable = allocationOn(billableSpans, best.day);
        return {
          week: ws,
          total: best.total,
          billable,
          investment: best.total - billable,
          projects: list.filter((m) => keyFromDate(m.startDate) <= best.day && (!m.endDate || keyFromDate(m.endDate) >= best.day)).map((m) => ({ memberId: m.id, id: m.project.id, code: m.project.code, name: m.project.name, color: m.project.color, type: m.project.type, allocation: m.allocation, billed: m.billed })),
        };
      });
      const ending = list.filter((m) => m.endDate && keyFromDate(m.endDate) >= today && keyFromDate(m.endDate) <= addDays(today, 21));
      return {
        employee: p,
        cells,
        freeNextMonth: 100 - peakAllocation(all, nextMonth.from, nextMonth.to),
        nowAllocated: allocationOn(all, today),
        rollingOff: ending.length && allocationOn(all, addDays(keyFromDate(ending[0]!.endDate!), 1)) === 0 ? { project: ending[0]!.project.name, endDate: keyFromDate(ending[0]!.endDate!) } : null,
      };
    });
    const thisWeek = rows.map((r) => r.cells[0]?.total ?? 0);
    // Requests waiting for the PMO (they replaced the old open roles)
    const roles = (await this.prisma.resourceRequest.findMany({ where: { companyId, kind: 'REQUEST', status: 'OPEN', step: 'PMO', project: { status: { not: ProjectStatus.COMPLETED } } }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true, allocation: true, fromDate: true, createdAt: true, project: { select: { id: true, name: true, code: true } } } })).map((x) => ({ id: x.id, title: x.title ?? 'Person', allocation: x.allocation ?? 0, fromDate: x.fromDate ?? x.createdAt, project: x.project }));
    // For each open role: people free enough for 4 weeks from its start
    const suggestions = roles.slice(0, 5).map((r) => {
      const from = keyFromDate(r.fromDate) < today ? today : keyFromDate(r.fromDate);
      const candidates = rows
        .map((row) => {
          const spans = (byPerson.get(row.employee.id) ?? []).map((m) => ({ allocation: m.allocation, start: keyFromDate(m.startDate), end: m.endDate ? keyFromDate(m.endDate) : null }));
          return { employee: row.employee, free: 100 - peakAllocation(spans, from, addDays(from, 27)) };
        })
        .filter((c) => c.free >= r.allocation)
        .sort((a, b) => b.free - a.free)
        .slice(0, 3);
      return { role: { ...r, fromDate: keyFromDate(r.fromDate) }, candidates };
    });
    return {
      from: first,
      to: last,
      today,
      weeks: Array.from({ length: weeks }, (_, i) => addDays(first, i * 7)),
      people: rows,
      counts: {
        full: thisWeek.filter((t) => t >= 100).length,
        partly: thisWeek.filter((t) => t > 0 && t < 100).length,
        free: thisWeek.filter((t) => t === 0).length,
        benchNextMonth: rows.filter((r) => r.freeNextMonth === 100).length,
      },
      rollingOff: rows.filter((r) => r.rollingOff).map((r) => ({ employee: r.employee, ...r.rollingOff! })),
      suggestions,
    };
  }

  /** People with at least `min`% free for the whole window. */
  async available(companyId: string, q: AvailableQueryDto) {
    if (q.to < q.from) throw new BadRequestException('The window ends before it starts');
    const people = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: dateFromKey(q.from) }, ...(q.designationId && { designationId: q.designationId }), ...(q.departmentId && { departmentId: q.departmentId }) },
      select: { ...FACE, designation: { select: { name: true } }, department: { select: { name: true } } },
    });
    const members = await this.prisma.projectMember.findMany({
      where: { employeeId: { in: people.map((p) => p.id) }, project: { status: { not: ProjectStatus.COMPLETED } }, startDate: { lte: dateFromKey(q.to) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(q.from) } }] },
      select: { employeeId: true, allocation: true, startDate: true, endDate: true },
    });
    return people
      .map((p) => {
        const spans = members.filter((m) => m.employeeId === p.id).map((m) => ({ allocation: m.allocation, start: keyFromDate(m.startDate), end: m.endDate ? keyFromDate(m.endDate) : null }));
        return { employee: p, free: 100 - peakAllocation(spans, q.from, q.to) };
      })
      .filter((x) => x.free >= q.min)
      .sort((a, b) => b.free - a.free || a.employee.firstName.localeCompare(b.employee.firstName));
  }

  // ─── My projects ──────────────────────────────────────────

  async myOverview(companyId: string, access: AccessContext) {
    const me = access.employee?.id;
    const today = await this.projects.todayKey(companyId);
    if (!me) return { today, assignments: [], billing: { billable: 0, investment: 0, bench: 100 }, milestones: [], away: [] };
    const t = dateFromKey(today);
    const rows = await this.prisma.projectMember.findMany({
      where: { employeeId: me, project: { status: { not: ProjectStatus.COMPLETED } }, OR: [{ endDate: null }, { endDate: { gte: t } }] },
      orderBy: { startDate: 'asc' },
      select: {
        id: true, role: true, allocation: true, billed: true, startDate: true, endDate: true,
        lead: { select: FACE },
        project: { select: { id: true, code: true, name: true, clientName: true, type: true, color: true, status: true, startDate: true, endDate: true } },
      },
    });
    const ids = [...new Set(rows.map((r) => r.project.id))];
    const h = await this.healthInputs(companyId, ids, today);
    const [team, updates] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId: { in: ids }, startDate: { lte: t }, OR: [{ endDate: null }, { endDate: { gte: t } }] },
        select: { projectId: true, role: true, employee: { select: { ...FACE, userId: true } } },
      }),
      this.prisma.projectUpdate.findMany({ where: { projectId: { in: ids } }, orderBy: { createdAt: 'desc' }, distinct: ['projectId'], select: { projectId: true, health: true, note: true, createdAt: true, authorUserId: true } }),
    ]);
    const authors = await this.prisma.user.findMany({ where: { id: { in: updates.map((u) => u.authorUserId).filter((x): x is string => Boolean(x)) } }, select: { id: true, firstName: true, lastName: true } });
    const weekStart = mondayOf(today);
    const weekEnd = addDays(weekStart, 6);
    const teammates = [...new Set(team.map((m) => m.employee.id).filter((x) => x !== me))];
    const leaves = teammates.length
      ? await this.prisma.leaveRequest.findMany({
          where: { companyId, status: LeaveStatus.APPROVED, employeeId: { in: teammates }, startDate: { lte: dateFromKey(weekEnd) }, endDate: { gte: dateFromKey(weekStart) } },
          select: { employeeId: true, startDate: true, endDate: true, employee: { select: FACE } },
        })
      : [];
    const assignments = rows.map((r) => {
      const pm = team.filter((m) => m.projectId === r.project.id && m.role === ProjectRole.MANAGER).map((m) => m.employee);
      const ms = h.milestones.get(r.project.id) ?? [];
      const next = ms.find((m) => !m.doneAt);
      const upd = updates.find((u) => u.projectId === r.project.id);
      const author = upd?.authorUserId ? authors.find((a) => a.id === upd.authorUserId) : null;
      // Who approves my leave on this project: my team lead, else the project manager
      const approver = r.role === ProjectRole.MANAGER ? null : r.role === ProjectRole.MEMBER && r.lead ? { ...r.lead, as: 'Team lead' } : pm[0] ? { ...pm[0], as: 'Project manager' } : null;
      return {
        memberId: r.id,
        role: r.role,
        allocation: r.allocation,
        billed: r.billed,
        startDate: keyFromDate(r.startDate),
        endDate: r.endDate ? keyFromDate(r.endDate) : null,
        upcoming: keyFromDate(r.startDate) > today,
        project: { ...r.project, startDate: keyFromDate(r.project.startDate), endDate: r.project.endDate ? keyFromDate(r.project.endDate) : null },
        health: this.healthOf(r.project, h, today),
        approver,
        nextMilestone: next ? { title: next.title, dueDate: keyFromDate(next.dueDate) } : null,
        lastUpdate: upd ? { health: upd.health, note: upd.note, at: upd.createdAt, author: author ? name(author) : null } : null,
        team: team.filter((m) => m.projectId === r.project.id).slice(0, 6).map((m) => ({ id: m.employee.id, firstName: m.employee.firstName, lastName: m.employee.lastName, avatarUrl: m.employee.avatarUrl })),
        teamCount: team.filter((m) => m.projectId === r.project.id).length,
      };
    });
    const milestones = ids
      .flatMap((id) => (h.milestones.get(id) ?? []).filter((m) => !m.doneAt && keyFromDate(m.dueDate) >= today).map((m) => ({ id: m.id, title: m.title, dueDate: keyFromDate(m.dueDate), project: rows.find((r) => r.project.id === id)!.project.name })))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);
    return {
      today,
      assignments,
      billing: await this.personBilling(companyId, me, today),
      freeFrom: (() => {
        const ends = rows.filter((r) => r.endDate).map((r) => keyFromDate(r.endDate!)).sort();
        const spans = rows.map((r) => ({ allocation: r.allocation, start: keyFromDate(r.startDate), end: r.endDate ? keyFromDate(r.endDate) : null }));
        for (const e of ends) {
          const after = addDays(e, 1);
          const free = 100 - allocationOn(spans, after);
          if (free > 100 - allocationOn(spans, today)) return { date: after, free };
        }
        return null;
      })(),
      milestones,
      away: leaves.map((l) => ({ employee: l.employee, startDate: keyFromDate(l.startDate), endDate: keyFromDate(l.endDate), projects: rows.filter((r) => team.some((m) => m.projectId === r.project.id && m.employee.id === l.employeeId)).map((r) => r.project.name) })),
    };
  }
}

function addMonth(ym: string, n = 1): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function mondayOf(key: string): string {
  const wd = (dateFromKey(key).getUTCDay() + 6) % 7;
  return addDays(key, -wd);
}
function weekOf(key: string): string {
  return mondayOf(key);
}
