import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma, TimesheetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { ApprovalRouterService } from '../projects/approval-router.service';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import type { ComplianceQueryDto, DecideDto, LineDto, RejectDto, ReportQueryDto, SaveWeekDto, TimesheetQueryDto, WeekQueryDto } from './dto';

const APPROVE = 'timesheet.approve';
const VIEW = 'timesheet.view';
/** Weeks older than this can't be filled or submitted any more. */
export const MAX_AGE_WEEKS = 8;
const EDITABLE: TimesheetStatus[] = [TimesheetStatus.DRAFT, TimesheetStatus.REJECTED];
const PERSON = { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } } satisfies Prisma.EmployeeSelect;

const SHEET = {
  id: true,
  employeeId: true,
  weekStart: true,
  status: true,
  totalMinutes: true,
  approverIds: true,
  approverLabel: true,
  submittedAt: true,
  decidedById: true,
  onBehalfOfId: true,
  decidedAt: true,
  decisionNote: true,
  updatedAt: true,
  employee: { select: PERSON },
} satisfies Prisma.TimesheetSelect;
type SheetRow = Prisma.TimesheetGetPayload<{ select: typeof SHEET }>;

/** Monday of the week containing a date key. */
export function mondayOf(key: string): string {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
}

/**
 * Weekly timesheets: hours per project (or internal work) and task.
 * The person submits a week; it is approved by the same people who approve
 * their leave (team lead / PM / line manager — any one of them), or by
 * anyone with company-wide timesheet.approve (HR). Rejected weeks go back
 * for changes; approved weeks are locked.
 */
@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly router: ApprovalRouterService,
  ) {}

  // ─── One week ──────────────────────────────────────────────

  async week(companyId: string, access: AccessContext, weekStart: string, q: WeekQueryDto) {
    this.assertMonday(weekStart);
    const employeeId = q.employeeId ?? access.employee?.id;
    if (!employeeId) throw new BadRequestException('Your account has no employee profile');
    const own = employeeId === access.employee?.id;
    const sheet = await this.prisma.timesheet.findUnique({ where: { employeeId_weekStart: { employeeId, weekStart: dateFromKey(weekStart) } }, select: SHEET });
    if (!own) await this.assertCanSee(companyId, access, employeeId, sheet);
    const employee = sheet?.employee ?? (await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: PERSON }));
    if (!employee) throw new NotFoundException('Employee not found');

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekEnd = days[6]!;
    const [entries, attendance, allocations, today] = await Promise.all([
      sheet
        ? this.prisma.timesheetEntry.findMany({
            where: { timesheetId: sheet.id },
            select: { date: true, projectId: true, task: true, billable: true, minutes: true, line: true, project: { select: { id: true, code: true, name: true } } },
            orderBy: [{ line: 'asc' }, { date: 'asc' }],
          })
        : [],
      this.prisma.attendanceRecord.findMany({
        where: { companyId, employeeId, date: { gte: dateFromKey(weekStart), lte: dateFromKey(weekEnd) } },
        select: { date: true, workingMinutes: true, status: true },
      }),
      this.allocations(companyId, employeeId, weekStart, weekEnd),
      this.todayKey(companyId),
    ]);

    const lines = new Map<number, { projectId: string | null; project: { id: string; code: string; name: string } | null; task: string; billable: boolean; minutes: number[] }>();
    for (const e of entries) {
      const l = lines.get(e.line) ?? { projectId: e.projectId, project: e.project, task: e.task, billable: e.billable, minutes: [0, 0, 0, 0, 0, 0, 0] };
      l.minutes[days.indexOf(keyFromDate(e.date))] = e.minutes;
      lines.set(e.line, l);
    }
    const att = new Map(attendance.map((a) => [keyFromDate(a.date), a]));
    const status = sheet?.status ?? null;
    const window = this.inWindow(weekStart, today);
    const decide = sheet ? this.decideAs(access, sheet) : null;
    const names = await this.router.names([...(sheet?.approverIds ?? []), sheet?.decidedById, sheet?.onBehalfOfId].filter((x): x is string => Boolean(x)));
    const { userId: _u, ...person } = employee;

    return {
      weekStart,
      weekEnd,
      today,
      id: sheet?.id ?? null,
      status,
      totalMinutes: sheet?.totalMinutes ?? 0,
      employee: person,
      days: days.map((d) => ({ date: d, attendedMinutes: att.get(d)?.workingMinutes ?? null, attendance: att.get(d)?.status ?? null, future: d > today })),
      lines: [...lines.values()],
      projects: own ? allocations : [],
      approval: sheet && sheet.status !== TimesheetStatus.DRAFT
        ? {
            label: sheet.approverLabel,
            approvers: sheet.approverIds.map((id) => names.get(id)).filter(Boolean),
            submittedAt: sheet.submittedAt,
            decidedBy: sheet.decidedById ? names.get(sheet.decidedById) ?? null : null,
            onBehalfOf: sheet.onBehalfOfId ? names.get(sheet.onBehalfOfId) ?? null : null,
            decidedAt: sheet.decidedAt,
            note: sheet.decisionNote,
          }
        : null,
      isOwn: own,
      canEdit: own && window && (!status || EDITABLE.includes(status)),
      canSubmit: own && window && Boolean(status && EDITABLE.includes(status)) && (sheet?.totalMinutes ?? 0) > 0,
      canRecall: own && status === TimesheetStatus.SUBMITTED,
      canDecide: Boolean(decide),
      locked: !window,
    };
  }

  async save(companyId: string, access: AccessContext, weekStart: string, dto: SaveWeekDto) {
    this.assertMonday(weekStart);
    const employeeId = this.ownEmployee(access);
    const today = await this.todayKey(companyId);
    if (!this.inWindow(weekStart, today)) throw new BadRequestException(`Only the last ${MAX_AGE_WEEKS} weeks and the current week can be filled`);
    const existing = await this.prisma.timesheet.findUnique({ where: { employeeId_weekStart: { employeeId, weekStart: dateFromKey(weekStart) } }, select: { id: true, status: true } });
    if (existing && !EDITABLE.includes(existing.status)) {
      throw new BadRequestException(existing.status === TimesheetStatus.APPROVED ? 'This week is approved and locked' : 'Recall the week before changing it');
    }
    const rows = await this.validate(companyId, employeeId, weekStart, today, dto.lines);
    const total = rows.reduce((n, r) => n + r.minutes, 0);

    await this.prisma.$transaction(async (tx) => {
      const sheet = existing
        ? await tx.timesheet.update({ where: { id: existing.id }, data: { totalMinutes: total } })
        : await tx.timesheet.create({ data: { companyId, employeeId, weekStart: dateFromKey(weekStart), totalMinutes: total } });
      await tx.timesheetEntry.deleteMany({ where: { timesheetId: sheet.id } });
      if (rows.length) await tx.timesheetEntry.createMany({ data: rows.map((r) => ({ ...r, companyId, employeeId, timesheetId: sheet.id })) });
    });
    return this.week(companyId, access, weekStart, {});
  }

  async submit(companyId: string, access: AccessContext, weekStart: string) {
    this.assertMonday(weekStart);
    const employeeId = this.ownEmployee(access);
    const today = await this.todayKey(companyId);
    if (!this.inWindow(weekStart, today)) throw new BadRequestException(`Only the last ${MAX_AGE_WEEKS} weeks and the current week can be submitted`);
    const sheet = await this.prisma.timesheet.findUnique({ where: { employeeId_weekStart: { employeeId, weekStart: dateFromKey(weekStart) } }, select: SHEET });
    if (!sheet || !EDITABLE.includes(sheet.status)) throw new BadRequestException(sheet?.status === TimesheetStatus.SUBMITTED ? 'Already submitted' : sheet ? 'This week is approved and locked' : 'Fill in your hours first');
    if (!sheet.totalMinutes) throw new BadRequestException('Log some hours before submitting');

    const route = await this.router.route(companyId, employeeId, weekStart, addDays(weekStart, 6), 1);
    const level = route.levels[0];
    const pool = level?.approverIds ?? [];
    const { count } = await this.prisma.timesheet.updateMany({
      where: { id: sheet.id, status: { in: EDITABLE } },
      data: { status: TimesheetStatus.SUBMITTED, approverIds: pool, approverLabel: pool.length ? level!.label : 'HR', submittedAt: new Date(), decidedById: null, onBehalfOfId: null, decidedAt: null, decisionNote: null },
    });
    if (!count) throw new ConflictException('This week has changed — refresh and try again');

    const to = pool.length ? [...pool, ...(await this.notifications.coveringFor(pool))] : await this.notifications.companyWideApprovers(companyId, APPROVE);
    void this.notifications.notify({
      companyId,
      userIds: to.filter((u) => u !== access.userId),
      type: 'timesheet.submitted',
      title: `${sheet.employee.firstName} ${sheet.employee.lastName} submitted a timesheet: ${hours(sheet.totalMinutes)}`,
      body: `Week ${dateRange(weekStart, addDays(weekStart, 6))}`,
      link: '/app/timesheets/approvals',
      actionLabel: 'Review',
      email: false,
    });
    return this.week(companyId, access, weekStart, {});
  }

  async recall(companyId: string, access: AccessContext, weekStart: string) {
    this.assertMonday(weekStart);
    const employeeId = this.ownEmployee(access);
    const { count } = await this.prisma.timesheet.updateMany({
      where: { employeeId, weekStart: dateFromKey(weekStart), status: TimesheetStatus.SUBMITTED },
      data: { status: TimesheetStatus.DRAFT, approverIds: [], approverLabel: null, submittedAt: null },
    });
    if (!count) throw new BadRequestException('Only a submitted week can be recalled');
    return this.week(companyId, access, weekStart, {});
  }

  // ─── Decisions ─────────────────────────────────────────────

  async approve(companyId: string, access: AccessContext, id: string, dto: DecideDto) {
    const { sheet, onBehalfOf } = await this.decidable(companyId, access, id);
    await this.decide(sheet.id, TimesheetStatus.APPROVED, access.userId, onBehalfOf, dto.note ?? null);
    void this.notifications.notify({
      companyId,
      userIds: [sheet.employee.userId],
      type: 'timesheet.approved',
      title: `Timesheet approved: week ${dateRange(keyFromDate(sheet.weekStart), addDays(keyFromDate(sheet.weekStart), 6))}`,
      body: dto.note ?? null,
      link: `/app/timesheets?week=${keyFromDate(sheet.weekStart)}`,
      email: false,
    });
    return { id: sheet.id, status: TimesheetStatus.APPROVED };
  }

  async reject(companyId: string, access: AccessContext, id: string, dto: RejectDto) {
    const { sheet, onBehalfOf } = await this.decidable(companyId, access, id);
    await this.decide(sheet.id, TimesheetStatus.REJECTED, access.userId, onBehalfOf, dto.reason);
    const week = keyFromDate(sheet.weekStart);
    void this.notifications.notify({
      companyId,
      userIds: [sheet.employee.userId],
      type: 'timesheet.rejected',
      title: `Timesheet sent back: week ${dateRange(week, addDays(week, 6))}`,
      body: `Reason: ${dto.reason}`,
      link: `/app/timesheets?week=${week}`,
      actionLabel: 'Fix and resubmit',
    });
    return { id: sheet.id, status: TimesheetStatus.REJECTED };
  }

  // ─── Lists ─────────────────────────────────────────────────

  async list(companyId: string, access: AccessContext, q: TimesheetQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Prisma.TimesheetWhereInput = {
      companyId,
      ...(q.status && { status: q.status }),
      ...(q.employeeId && { employeeId: q.employeeId }),
      ...((q.from || q.to) && { weekStart: { ...(q.from && { gte: dateFromKey(mondayOf(q.from)) }), ...(q.to && { lte: dateFromKey(q.to) }) } }),
    };
    if (q.view === 'mine') {
      if (!access.employee) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      where.employeeId = access.employee.id;
    } else if (q.view === 'review') {
      Object.assign(where, this.reviewWhere(access));
    } else {
      where.employee = this.access.requireEmployeeScope(access, VIEW);
      if (!q.status) where.status = { not: TimesheetStatus.DRAFT };
    }
    const [rows, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        select: SHEET,
        orderBy: q.view === 'review' ? [{ submittedAt: 'asc' }] : [{ weekStart: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timesheet.count({ where }),
    ]);
    const names = await this.router.names([...new Set(rows.flatMap((r) => [r.decidedById, ...r.approverIds]).filter((x): x is string => Boolean(x)))]);
    return {
      data: rows.map((r) => {
        const { userId: _u, ...employee } = r.employee;
        return {
          id: r.id,
          weekStart: keyFromDate(r.weekStart),
          status: r.status,
          totalMinutes: r.totalMinutes,
          submittedAt: r.submittedAt,
          decidedAt: r.decidedAt,
          decisionNote: r.decisionNote,
          approverLabel: r.approverLabel,
          approvers: r.approverIds.map((id) => names.get(id)).filter(Boolean),
          decidedBy: r.decidedById ? names.get(r.decidedById) ?? null : null,
          employee,
          canDecide: Boolean(this.decideAs(access, r)),
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async pendingCount(companyId: string, access: AccessContext) {
    const where = this.reviewWhere(access);
    if (!where) return 0;
    return this.prisma.timesheet.count({ where: { companyId, ...where } });
  }

  /** Who in my scope has (not) filled a week — one row per person, paginated in the database. */
  async compliance(companyId: string, access: AccessContext, q: ComplianceQueryDto) {
    this.assertMonday(q.weekStart);
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const week = dateFromKey(q.weekStart);
    const weekEnd = dateFromKey(addDays(q.weekStart, 6));
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        this.access.requireEmployeeScope(access, VIEW),
        {
          companyId,
          employmentStatus: { not: EmploymentStatus.TERMINATED },
          joiningDate: { lte: weekEnd },
          ...(q.search && { OR: [{ firstName: { contains: q.search, mode: 'insensitive' } }, { lastName: { contains: q.search, mode: 'insensitive' } }, { employeeId: { contains: q.search, mode: 'insensitive' } }] }),
          ...(q.status === 'missing' ? { timesheets: { none: { weekStart: week } } } : q.status ? { timesheets: { some: { weekStart: week, status: q.status } } } : {}),
        },
      ],
    };
    const [people, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: { ...PERSON, department: { select: { name: true } }, timesheets: { where: { weekStart: week }, select: { id: true, status: true, totalMinutes: true, submittedAt: true } } },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      data: people.map(({ userId: _u, timesheets, ...p }) => ({ employee: p, timesheet: timesheets[0] ?? null })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Hours by project and by person for a date range (people in my timesheet.view scope). */
  async report(companyId: string, access: AccessContext, q: ReportQueryDto) {
    if (q.from > q.to) throw new BadRequestException('“From” must be before “to”');
    if (q.to > addDays(q.from, 366)) throw new BadRequestException('Pick at most a year');
    const where: Prisma.TimesheetEntryWhereInput = {
      companyId,
      date: { gte: dateFromKey(q.from), lte: dateFromKey(q.to) },
      minutes: { gt: 0 },
      ...(q.projectId && { projectId: q.projectId }),
      ...(q.employeeId && { employeeId: q.employeeId }),
      timesheet: {
        status: q.approvedOnly === 'true' ? TimesheetStatus.APPROVED : { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED] },
        employee: this.access.requireEmployeeScope(access, VIEW),
      },
    };
    const [byProject, byEmployee] = await Promise.all([
      this.prisma.timesheetEntry.groupBy({ by: ['projectId', 'billable'], where, _sum: { minutes: true } }),
      this.prisma.timesheetEntry.groupBy({ by: ['employeeId', 'billable'], where, _sum: { minutes: true } }),
    ]);
    const projectIds = [...new Set(byProject.map((r) => r.projectId).filter((x): x is string => Boolean(x)))];
    const employeeIds = [...new Set(byEmployee.map((r) => r.employeeId))];
    const [projects, people] = await Promise.all([
      this.prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, code: true, name: true, clientName: true } }),
      this.prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true } }),
    ]);
    const fold = <K extends string>(rows: Array<{ billable: boolean; _sum: { minutes: number | null } } & Record<K, string | null>>, key: K) => {
      const m = new Map<string | null, { minutes: number; billableMinutes: number }>();
      for (const r of rows) {
        const cur = m.get(r[key]) ?? { minutes: 0, billableMinutes: 0 };
        cur.minutes += r._sum.minutes ?? 0;
        if (r.billable) cur.billableMinutes += r._sum.minutes ?? 0;
        m.set(r[key], cur);
      }
      return m;
    };
    const pm = new Map(projects.map((p) => [p.id, p]));
    const em = new Map(people.map((p) => [p.id, p]));
    const proj = [...fold(byProject, 'projectId')].map(([id, v]) => ({ project: id ? pm.get(id) ?? null : null, ...v })).sort((a, b) => b.minutes - a.minutes);
    const emp = [...fold(byEmployee, 'employeeId')].map(([id, v]) => ({ employee: em.get(id!)!, ...v })).filter((r) => r.employee).sort((a, b) => b.minutes - a.minutes);
    const totalMinutes = proj.reduce((n, r) => n + r.minutes, 0);
    const billableMinutes = proj.reduce((n, r) => n + r.billableMinutes, 0);
    return { from: q.from, to: q.to, totalMinutes, billableMinutes, byProject: proj, byEmployee: emp };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async validate(companyId: string, employeeId: string, weekStart: string, today: string, lines: LineDto[]) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const allocations = await this.allocations(companyId, employeeId, weekStart, days[6]!);
    const byProject = new Map(allocations.map((a) => [a.id, a]));
    const seen = new Set<string>();
    const perDay = [0, 0, 0, 0, 0, 0, 0];
    const rows: Array<{ date: Date; projectId: string | null; task: string; billable: boolean; minutes: number; line: number }> = [];
    lines.forEach((l, line) => {
      const projectId = l.projectId ?? null;
      const p = projectId ? byProject.get(projectId) : null;
      if (projectId && !p) throw new BadRequestException('You can only log time on projects you’re assigned to this week');
      const key = `${projectId ?? '-'}:${l.task.toLowerCase()}`;
      if (seen.has(key)) throw new BadRequestException(`“${l.task}” appears twice${p ? ` for ${p.name}` : ''} — put the hours on one row`);
      seen.add(key);
      let any = false;
      l.minutes.forEach((m, i) => {
        if (!m) return;
        const date = days[i]!;
        if (date > today) throw new BadRequestException(`You can’t log hours for a future day (${date})`);
        if (p && (date < p.from || (p.to && date > p.to))) throw new BadRequestException(`You weren’t assigned to ${p.name} on ${date}`);
        perDay[i]! += m;
        rows.push({ date: dateFromKey(date), projectId, task: l.task, billable: Boolean(p && l.billable), minutes: m, line });
        any = true;
      });
      // Keep empty rows (e.g. copied from last week) as a placeholder
      if (!any) rows.push({ date: dateFromKey(days[0]!), projectId, task: l.task, billable: Boolean(p && l.billable), minutes: 0, line });
    });
    perDay.forEach((m, i) => {
      if (m > 1440) throw new BadRequestException(`More than 24 hours on ${days[i]}`);
    });
    return rows;
  }

  /** Projects the person is assigned to during the week (with the dates the assignment covers). */
  private async allocations(companyId: string, employeeId: string, from: string, to: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { companyId, employeeId, startDate: { lte: dateFromKey(to) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(from) } }] },
      select: { role: true, allocation: true, startDate: true, endDate: true, project: { select: { id: true, code: true, name: true, clientName: true, status: true } } },
      orderBy: { project: { name: 'asc' } },
    });
    const out = new Map<string, { id: string; code: string; name: string; clientName: string | null; role: string; allocation: number; from: string; to: string | null }>();
    for (const m of members) {
      const prev = out.get(m.project.id);
      const from = keyFromDate(m.startDate);
      const to = m.endDate ? keyFromDate(m.endDate) : null;
      out.set(m.project.id, prev
        ? { ...prev, from: from < prev.from ? from : prev.from, to: !to || !prev.to ? null : to > prev.to ? to : prev.to }
        : { id: m.project.id, code: m.project.code, name: m.project.name, clientName: m.project.clientName, role: m.role, allocation: m.allocation, from, to });
    }
    return [...out.values()];
  }

  private reviewWhere(access: AccessContext): Prisma.TimesheetWhereInput {
    const me = [access.userId, ...access.delegations.map((d) => d.fromUserId)];
    return {
      status: TimesheetStatus.SUBMITTED,
      employee: { userId: { not: access.userId } },
      OR: [{ approverIds: { hasSome: me } }, ...(this.companyApprover(access) ? [{ approverIds: { isEmpty: true } }] : [])],
    };
  }

  private companyApprover(access: AccessContext) {
    return access.isSuperAdmin || access.grants.get(APPROVE) === 'company';
  }

  /** Can I decide this sheet, and for whom? */
  private decideAs(access: AccessContext, s: Pick<SheetRow, 'status' | 'approverIds' | 'employee'>): { onBehalfOf: string | null } | null {
    if (s.status !== TimesheetStatus.SUBMITTED || s.employee.userId === access.userId) return null;
    if (s.approverIds.includes(access.userId) || this.companyApprover(access)) return { onBehalfOf: null };
    const cover = access.delegations.find((d) => s.approverIds.includes(d.fromUserId));
    return cover ? { onBehalfOf: cover.fromUserId } : null;
  }

  private async decidable(companyId: string, access: AccessContext, id: string) {
    const sheet = await this.prisma.timesheet.findFirst({ where: { id, companyId }, select: SHEET });
    if (!sheet || sheet.employee.userId === access.userId) throw new NotFoundException('Timesheet not found');
    if (sheet.status !== TimesheetStatus.SUBMITTED) throw new ConflictException('This timesheet isn’t waiting for approval');
    const d = this.decideAs(access, sheet);
    if (!d) throw new ForbiddenException('This timesheet is waiting for someone else');
    return { sheet, ...d };
  }

  private async decide(id: string, status: TimesheetStatus, by: string, onBehalfOf: string | null, note: string | null) {
    const { count } = await this.prisma.timesheet.updateMany({
      where: { id, status: TimesheetStatus.SUBMITTED },
      data: { status, decidedById: by, onBehalfOfId: onBehalfOf, decidedAt: new Date(), decisionNote: note },
    });
    if (!count) throw new ConflictException('Someone else has already decided this timesheet');
  }

  private async assertCanSee(companyId: string, access: AccessContext, employeeId: string, sheet: SheetRow | null) {
    if (sheet && this.decideAs(access, sheet)) return;
    if (sheet && (sheet.approverIds.includes(access.userId) || sheet.decidedById === access.userId)) return;
    const scope = this.access.employeeScope(access, VIEW);
    if (scope && holds(access, VIEW) && (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope] } }))) return;
    throw new NotFoundException('Timesheet not found');
  }

  private ownEmployee(access: AccessContext) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    return access.employee.id;
  }

  private assertMonday(key: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number.isNaN(Date.parse(key)) || new Date(`${key}T00:00:00Z`).getUTCDay() !== 1) {
      throw new BadRequestException('A week starts on a Monday (YYYY-MM-DD)');
    }
  }

  private inWindow(weekStart: string, today: string) {
    const current = mondayOf(today);
    return weekStart <= current && weekStart >= addDays(current, -7 * MAX_AGE_WEEKS);
  }

  async todayKey(companyId: string): Promise<string> {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }
}

export function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
