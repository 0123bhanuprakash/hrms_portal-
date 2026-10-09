import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, LeaveStatus, Prisma, ProjectRole, ProjectType, TimesheetStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { covering, holds, type AccessContext } from '../access/access.types';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { ApprovalRouterService } from '../projects/approval-router.service';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey, localMinutes } from '../attendance/time-zone';
import type { ApproveBlocksDto, BlockDto, CalendarQueryDto, ComplianceQueryDto, CopyDayDto, PickBlocksDto, RecallDto, SendBackDto, SubmitDto, TimesheetQueryDto, TeamQueryDto } from './dto';
import { searchWords, wordsWhere } from '../../common/word-search';
import { pmoLeadUserIds, reportsToPmo } from '../projects/pmo-pool';

const APPROVE = 'timesheet.approve';
const VIEW = 'timesheet.view';
/** Weeks older than this can't be filled or submitted any more. */
export const MAX_AGE_WEEKS = 8;
/** A working day, for "expected" hours */
export const DAY_MINUTES = 480;
const EDITABLE: TimesheetStatus[] = [TimesheetStatus.DRAFT, TimesheetStatus.REJECTED];
const PERSON = { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } } satisfies Prisma.EmployeeSelect;
const LIVE = { employmentStatus: { not: EmploymentStatus.TERMINATED }, user: { status: UserStatus.ACTIVE } } satisfies Prisma.EmployeeWhereInput;

const BLOCK = {
  id: true,
  employeeId: true,
  timesheetId: true,
  date: true,
  startMin: true,
  endMin: true,
  minutes: true,
  projectId: true,
  description: true,
  task: true,
  workType: true,
  billable: true,
  status: true,
  approverIds: true,
  approverLabel: true,
  submittedAt: true,
  submitNote: true,
  decidedById: true,
  onBehalfOfId: true,
  decidedAt: true,
  decisionNote: true,
  project: { select: { id: true, code: true, name: true, color: true, type: true } },
} satisfies Prisma.TimesheetEntrySelect;
type BlockRow = Prisma.TimesheetEntryGetPayload<{ select: typeof BLOCK }>;
type Route = { approverIds: string[]; label: string };

/** Monday of the week containing a date key. */
export function mondayOf(key: string): string {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const clock = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/**
 * Timesheets as time blocks (10:00–12:00 on a project, with what was done).
 * Blocks can't overlap. Submit sends every logged day that isn't sent yet
 * (or just today). Each block goes to the person's team lead on that project
 * — no lead: the project's PM; General time: the line manager; nobody: HR.
 * A week row (`timesheets`) still groups the blocks for reports/compliance;
 * its status is worked out from its blocks.
 */
@Injectable()
export class TimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly router: ApprovalRouterService,
  ) {}

  // ─── My week (or someone's I may see) ─────────────────────

  async calendar(companyId: string, access: AccessContext, weekStart: string, q: CalendarQueryDto) {
    this.assertMonday(weekStart);
    const employeeId = q.employeeId ?? access.employee?.id;
    if (!employeeId) throw new BadRequestException('Your account has no employee profile');
    const own = employeeId === access.employee?.id;
    if (!own) await this.assertCanSee(companyId, access, employeeId, weekStart);
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: PERSON });
    if (!employee) throw new NotFoundException('Employee not found');

    const weekEnd = addDays(weekStart, 6);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const { tz, today, workingDays } = await this.companyClock(companyId);
    const now = new Date();
    const [blocks, attendance, leaves, holidays, allocations] = await Promise.all([
      this.prisma.timesheetEntry.findMany({
        where: { companyId, employeeId, date: { gte: dateFromKey(weekStart), lte: dateFromKey(weekEnd) }, minutes: { gt: 0 } },
        select: BLOCK,
        orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
      }),
      this.prisma.attendanceRecord.findMany({
        where: { companyId, employeeId, date: { gte: dateFromKey(weekStart), lte: dateFromKey(weekEnd) } },
        select: { date: true, checkIn: true, checkOut: true, openSince: true, workingMinutes: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: { companyId, employeeId, status: LeaveStatus.APPROVED, startDate: { lte: dateFromKey(weekEnd) }, endDate: { gte: dateFromKey(weekStart) } },
        select: { startDate: true, endDate: true, halfDay: true, leaveType: { select: { name: true } } },
      }),
      this.prisma.publicHoliday.findMany({ where: { companyId, isOptional: false, date: { gte: dateFromKey(weekStart), lte: dateFromKey(weekEnd) } }, select: { date: true, name: true } }),
      this.allocations(companyId, employeeId, weekStart, weekEnd),
    ]);

    const att = new Map(attendance.map((a) => {
      const date = keyFromDate(a.date);
      const at = (t: Date) => localMinutes(t, tz) + daysBetween(date, localDateKey(t, tz)) * 1440;
      return [date, { checkIn: a.checkIn ? at(a.checkIn) : null, checkOut: a.checkOut && !a.openSince ? at(a.checkOut) : null, open: Boolean(a.openSince), workingMinutes: a.workingMinutes }];
    }));
    const hol = new Map(holidays.map((h) => [keyFromDate(h.date), h.name]));
    const leaveOn = (d: string) => {
      const l = leaves.find((x) => keyFromDate(x.startDate) <= d && keyFromDate(x.endDate) >= d);
      return l ? { type: l.leaveType.name, halfDay: l.halfDay } : null;
    };
    const names = await this.router.names(blocks.flatMap((b) => [...b.approverIds, b.decidedById].filter((x): x is string => Boolean(x))));
    const window = this.windowStart(today);
    const shaped = blocks.map((b) => this.shape(b, access, names, own && keyFromDate(b.date) >= window));

    const dayRows = days.map((d, i) => {
      const mine = shaped.filter((b) => b.date === d);
      const leave = leaveOn(d);
      const off = i >= workingDays;
      return {
        date: d,
        weekend: off,
        holiday: hol.get(d) ?? null,
        leave,
        future: d > today,
        locked: d < window,
        attendance: att.get(d) ?? null,
        minutes: mine.reduce((n, b) => n + b.minutes, 0),
        status: this.dayStatus(mine.map((b) => b.status)),
        expectedMinutes: off || hol.has(d) || (leave && !leave.halfDay) ? 0 : leave ? DAY_MINUTES / 2 : DAY_MINUTES,
      };
    });
    const working = dayRows.reduce((n, d) => n + d.expectedMinutes, 0);
    const logged = new Map<string | null, number>();
    for (const b of shaped) logged.set(b.project?.id ?? null, (logged.get(b.project?.id ?? null) ?? 0) + b.minutes);

    const { userId: _u, ...person } = employee;
    return {
      weekStart,
      weekEnd,
      today,
      nowMin: localMinutes(now, tz),
      isOwn: own,
      employee: person,
      days: dayRows,
      blocks: shaped,
      totalMinutes: shaped.reduce((n, b) => n + b.minutes, 0),
      expectedMinutes: working,
      projects: own
        ? allocations.map((a) => ({ ...a, loggedMinutes: logged.get(a.id) ?? 0, expectedMinutes: Math.round((working * a.allocation) / 100) }))
        : [],
      generalMinutes: logged.get(null) ?? 0,
      unsentDays: own ? await this.unsentCount(companyId, employeeId, today) : 0,
    };
  }

  // ─── Blocks ────────────────────────────────────────────────

  async createBlock(companyId: string, access: AccessContext, dto: BlockDto) {
    const employeeId = this.ownEmployee(access);
    const row = await this.checkBlock(companyId, employeeId, dto, null);
    const block = await this.prisma.$transaction(async (tx) => {
      const sheetId = await this.sheetFor(tx, companyId, employeeId, mondayOf(dto.date));
      const b = await tx.timesheetEntry.create({ data: { ...row, companyId, employeeId, timesheetId: sheetId }, select: { id: true } });
      await this.syncSheets(tx, [sheetId]);
      return b;
    });
    return this.one(block.id, access);
  }

  async updateBlock(companyId: string, access: AccessContext, id: string, dto: BlockDto) {
    const employeeId = this.ownEmployee(access);
    const existing = await this.mine(companyId, employeeId, id);
    const row = await this.checkBlock(companyId, employeeId, dto, id);
    await this.prisma.$transaction(async (tx) => {
      const sheetId = await this.sheetFor(tx, companyId, employeeId, mondayOf(dto.date));
      const { count } = await tx.timesheetEntry.updateMany({
        where: { id, status: { in: EDITABLE } },
        data: { ...row, timesheetId: sheetId, status: TimesheetStatus.DRAFT },
      });
      if (!count) throw new ConflictException('This block has changed — refresh and try again');
      await this.syncSheets(tx, [...new Set([sheetId, existing.timesheetId])]);
    });
    return this.one(id, access);
  }

  async deleteBlock(companyId: string, access: AccessContext, id: string) {
    const employeeId = this.ownEmployee(access);
    const existing = await this.mine(companyId, employeeId, id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.timesheetEntry.deleteMany({ where: { id, status: { in: EDITABLE } } });
      if (!count) throw new ConflictException('This block has changed — refresh and try again');
      await this.syncSheets(tx, [existing.timesheetId]);
    });
    return { id, deleted: true };
  }

  /** Copy one day's blocks onto another day (skips any that would overlap or aren't allowed there). */
  async copyDay(companyId: string, access: AccessContext, dto: CopyDayDto) {
    const employeeId = this.ownEmployee(access);
    if (dto.from === dto.to) throw new BadRequestException('Pick a different day to copy to');
    const source = await this.prisma.timesheetEntry.findMany({
      where: { companyId, employeeId, date: dateFromKey(dto.from), startMin: { not: null }, minutes: { gt: 0 } },
      select: { startMin: true, endMin: true, projectId: true, description: true, workType: true },
      orderBy: { startMin: 'asc' },
    });
    if (!source.length) throw new BadRequestException('Nothing logged on that day to copy');
    let copied = 0;
    const skipped: string[] = [];
    for (const s of source) {
      const dto2 = { date: dto.to, startMin: s.startMin!, endMin: s.endMin!, projectId: s.projectId, description: s.description ?? '', workType: s.workType } as BlockDto;
      try {
        const row = await this.checkBlock(companyId, employeeId, dto2, null);
        await this.prisma.$transaction(async (tx) => {
          const sheetId = await this.sheetFor(tx, companyId, employeeId, mondayOf(dto.to));
          await tx.timesheetEntry.create({ data: { ...row, companyId, employeeId, timesheetId: sheetId } });
          await this.syncSheets(tx, [sheetId]);
        });
        copied++;
      } catch (e) {
        if (!(e instanceof BadRequestException)) throw e;
        skipped.push(`${clock(s.startMin!)}: ${e.message}`);
      }
    }
    return { copied, skipped };
  }

  // ─── Submit / recall ───────────────────────────────────────

  /** What a submit would send: the days, checks against attendance, and who each project goes to. */
  async submitPreview(companyId: string, access: AccessContext, scope: 'today' | 'all') {
    const employeeId = this.ownEmployee(access);
    const { today, tz, workingDays } = await this.companyClock(companyId);
    const blocks = await this.unsent(companyId, employeeId, today, scope);
    const dates = [...new Set(blocks.map((b) => keyFromDate(b.date)))].sort();
    const from = dates[0] ?? today;
    const span = scope === 'today' ? [today] : Array.from({ length: daysBetween(from, today) + 1 }, (_, i) => addDays(from, i));
    const [attendance, leaves, holidays, sent] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { companyId, employeeId, date: { gte: dateFromKey(from), lte: dateFromKey(today) } }, select: { date: true, workingMinutes: true, openSince: true, checkIn: true } }),
      this.prisma.leaveRequest.findMany({ where: { companyId, employeeId, status: LeaveStatus.APPROVED, startDate: { lte: dateFromKey(today) }, endDate: { gte: dateFromKey(from) } }, select: { startDate: true, endDate: true, halfDay: true, leaveType: { select: { name: true } } } }),
      this.prisma.publicHoliday.findMany({ where: { companyId, isOptional: false, date: { gte: dateFromKey(from), lte: dateFromKey(today) } }, select: { date: true, name: true } }),
      this.prisma.timesheetEntry.findMany({ where: { companyId, employeeId, date: { gte: dateFromKey(from), lte: dateFromKey(today) }, status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED] } }, select: { date: true, minutes: true } }),
    ]);
    const now = new Date();
    const attended = (d: string) => {
      const a = attendance.find((x) => keyFromDate(x.date) === d);
      if (!a) return null;
      if (a.openSince && a.checkIn) return { minutes: Math.max(0, Math.round((now.getTime() - a.checkIn.getTime()) / 60_000)), open: true };
      return { minutes: a.workingMinutes ?? 0, open: false };
    };
    const dayRows = span.map((d) => {
      const leave = leaves.find((x) => keyFromDate(x.startDate) <= d && keyFromDate(x.endDate) >= d);
      const weekday = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
      const minutes = blocks.filter((b) => keyFromDate(b.date) === d).reduce((n, b) => n + b.minutes, 0);
      const already = sent.filter((b) => keyFromDate(b.date) === d).reduce((n, b) => n + b.minutes, 0);
      const a = attended(d);
      const off = weekday >= workingDays || holidays.some((h) => keyFromDate(h.date) === d);
      let check: 'ok' | 'short' | 'empty' | 'leave' | 'off' | 'sent' = 'ok';
      if (!minutes && already) check = 'sent';
      else if (!minutes && leave && !leave.halfDay) check = 'leave';
      else if (!minutes && off) check = 'off';
      else if (!minutes) check = 'empty';
      else if (a && !a.open && a.minutes - minutes >= 60) check = 'short';
      return { date: d, minutes, attendedMinutes: a?.minutes ?? null, stillIn: a?.open ?? false, leave: leave ? leave.leaveType.name : null, holiday: holidays.find((h) => keyFromDate(h.date) === d)?.name ?? null, check };
    });
    // Who each project's time goes to
    const routes = await this.routeFor(companyId, employeeId, access.userId, blocks.map((b) => ({ projectId: b.projectId, date: keyFromDate(b.date) })));
    const byProject = new Map<string, { project: BlockRow['project']; minutes: number; routes: Map<string, Route> }>();
    for (const b of blocks) {
      const k = b.projectId ?? '-';
      const cur = byProject.get(k) ?? { project: b.project, minutes: 0, routes: new Map() };
      cur.minutes += b.minutes;
      const r = routes.get(`${k}|${keyFromDate(b.date)}`)!;
      cur.routes.set(r.label + r.approverIds.join(), r);
      byProject.set(k, cur);
    }
    const names = await this.router.names([...routes.values()].flatMap((r) => r.approverIds));
    void tz;
    return {
      scope,
      today,
      days: dayRows,
      dates,
      totalMinutes: blocks.reduce((n, b) => n + b.minutes, 0),
      blocks: blocks.length,
      projects: [...byProject.values()].map((p) => ({
        project: p.project,
        minutes: p.minutes,
        goesTo: [...p.routes.values()].map((r) => ({ label: r.label, people: r.approverIds.map((id) => names.get(id)).filter(Boolean) })),
      })),
    };
  }

  async submit(companyId: string, access: AccessContext, dto: SubmitDto) {
    const employeeId = this.ownEmployee(access);
    const { today } = await this.companyClock(companyId);
    const blocks = await this.unsent(companyId, employeeId, today, dto.scope);
    if (!blocks.length) throw new BadRequestException(dto.scope === 'today' ? 'Nothing logged today that isn’t sent yet' : 'Nothing to send — log some time first');
    const routes = await this.routeFor(companyId, employeeId, access.userId, blocks.map((b) => ({ projectId: b.projectId, date: keyFromDate(b.date) })));
    const groups = new Map<string, { route: Route; ids: string[]; minutes: number; dates: Set<string> }>();
    for (const b of blocks) {
      const r = routes.get(`${b.projectId ?? '-'}|${keyFromDate(b.date)}`)!;
      const k = `${r.label}|${r.approverIds.join()}`;
      const g = groups.get(k) ?? { route: r, ids: [], minutes: 0, dates: new Set<string>() };
      g.ids.push(b.id);
      g.minutes += b.minutes;
      g.dates.add(keyFromDate(b.date));
      groups.set(k, g);
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const g of groups.values()) {
        const { count } = await tx.timesheetEntry.updateMany({
          where: { id: { in: g.ids }, status: { in: EDITABLE } },
          data: { status: TimesheetStatus.SUBMITTED, approverIds: g.route.approverIds, approverLabel: g.route.label, submittedAt: now, submitNote: dto.note ?? null, decidedById: null, onBehalfOfId: null, decidedAt: null },
        });
        if (count !== g.ids.length) throw new ConflictException('Your time changed while sending — refresh and try again');
      }
      await this.syncSheets(tx, [...new Set(blocks.map((b) => b.timesheetId))]);
    });

    // Tell each approver once (with their delegates); HR when nobody is set
    const who = await this.nameOf(employeeId);
    for (const g of groups.values()) {
      const dates = [...g.dates].sort();
      const to = g.route.approverIds.length ? [...g.route.approverIds, ...(await this.notifications.coveringFor(g.route.approverIds, APPROVE))] : await this.notifications.companyWideApprovers(companyId, APPROVE);
      void this.notifications.notify({
        companyId,
        userIds: to.filter((u) => u !== access.userId),
        type: 'timesheet.submitted',
        title: `${who} sent time for approval: ${hours(g.minutes)}`,
        body: `${dateRange(dates[0]!, dates[dates.length - 1]!)} · ${g.route.label}${dto.note ? ` — “${dto.note}”` : ''}`,
        link: `/app/timesheets/approvals?week=${mondayOf(dates[0]!)}`,
        actionLabel: 'Review',
        email: false,
      });
    }
    const dates = [...new Set(blocks.map((b) => keyFromDate(b.date)))].sort();
    return { sent: blocks.length, days: dates.length, dates, minutes: blocks.reduce((n, b) => n + b.minutes, 0) };
  }

  /** Take back sent blocks nobody has acted on yet. */
  async recall(companyId: string, access: AccessContext, dto: RecallDto) {
    const employeeId = this.ownEmployee(access);
    const rows = await this.prisma.timesheetEntry.findMany({
      where: { companyId, employeeId, status: TimesheetStatus.SUBMITTED, ...(dto.dates?.length && { date: { in: dto.dates.map(dateFromKey) } }) },
      select: { id: true, timesheetId: true },
    });
    if (!rows.length) throw new BadRequestException('Nothing waiting to take back');
    await this.prisma.$transaction(async (tx) => {
      await tx.timesheetEntry.updateMany({
        where: { id: { in: rows.map((r) => r.id) }, status: TimesheetStatus.SUBMITTED },
        data: { status: TimesheetStatus.DRAFT, approverIds: [], approverLabel: null, submittedAt: null, submitNote: null },
      });
      await this.syncSheets(tx, [...new Set(rows.map((r) => r.timesheetId))]);
    });
    return { recalled: rows.length };
  }

  // ─── Approving ─────────────────────────────────────────────

  /** People whose time I approve (or could), one row per person with day cells for the week. */
  async team(companyId: string, access: AccessContext, q: TeamQueryDto) {
    const { weekStart } = q;
    this.assertMonday(weekStart);
    const weekEnd = addDays(weekStart, 6);
    const { today, workingDays } = await this.companyClock(companyId);
    const ids = await this.myPeople(companyId, access, weekStart, weekEnd);
    const limit = q.limit ?? 25;
    if (!ids.length) return { weekStart, weekEnd, today, people: [], counts: { all: 0, waiting: 0, missing: 0 }, meta: { total: 0, page: 1, limit, totalPages: 1 }, summary: { waitingDays: 0, waitingPeople: 0, notLogged: 0, sentBack: 0, totalMinutes: 0, billableMinutes: 0 } };
    const [people, blocks, leaves, holidays] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: ids }, companyId }, select: { ...PERSON, joiningDate: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
      this.prisma.timesheetEntry.findMany({
        where: { companyId, employeeId: { in: ids }, date: { gte: dateFromKey(weekStart), lte: dateFromKey(weekEnd) }, minutes: { gt: 0 } },
        select: { id: true, employeeId: true, date: true, minutes: true, billable: true, status: true, approverIds: true, decidedById: true, employee: { select: { userId: true } } },
      }),
      this.prisma.leaveRequest.findMany({ where: { companyId, employeeId: { in: ids }, status: LeaveStatus.APPROVED, startDate: { lte: dateFromKey(weekEnd) }, endDate: { gte: dateFromKey(weekStart) } }, select: { employeeId: true, startDate: true, endDate: true, halfDay: true } }),
      this.prisma.publicHoliday.findMany({ where: { companyId, isOptional: false, date: { gte: dateFromKey(weekStart), lte: dateFromKey(weekEnd) } }, select: { date: true } }),
    ]);
    const hol = new Set(holidays.map((h) => keyFromDate(h.date)));
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const mine = (b: { approverIds: string[]; decidedById: string | null; status: TimesheetStatus; employee: { userId: string } }) =>
      b.decidedById === access.userId || Boolean(this.decideAs(access, { ...b, status: TimesheetStatus.SUBMITTED }));
    const summary = { waitingDays: 0, waitingPeople: 0, notLogged: 0, sentBack: 0, totalMinutes: 0, billableMinutes: 0 };
    const blocksOf = new Map<string, typeof blocks>();
    for (const b of blocks) blocksOf.set(b.employeeId, [...(blocksOf.get(b.employeeId) ?? []), b]);
    const rows = people.map(({ userId: _u, joiningDate, ...p }) => {
      const own = blocksOf.get(p.id) ?? [];
      let waiting = 0;
      let missing = 0;
      const cells = days.map((d, i) => {
        const all = own.filter((b) => keyFromDate(b.date) === d);
        const forMe = all.filter(mine);
        const leave = leaves.find((l) => l.employeeId === p.id && keyFromDate(l.startDate) <= d && keyFromDate(l.endDate) >= d);
        const off = i >= workingDays || hol.has(d);
        const minutes = all.reduce((n, b) => n + b.minutes, 0);
        const myMinutes = forMe.reduce((n, b) => n + b.minutes, 0);
        const statuses = forMe.map((b) => b.status);
        const w = forMe.filter((b) => b.status === TimesheetStatus.SUBMITTED && this.decideAs(access, b)).length;
        if (w) waiting++;
        let state: string;
        if (w) state = 'waiting';
        else if (statuses.includes(TimesheetStatus.REJECTED)) state = 'back';
        else if (statuses.length && statuses.every((s) => s === TimesheetStatus.APPROVED)) state = 'approved';
        else if (statuses.length) state = 'draft';
        else if (minutes) state = 'other';
        else if (leave && !leave.halfDay) state = 'leave';
        else if (off) state = 'off';
        else if (d > today || d < keyFromDate(joiningDate)) state = 'future';
        else state = 'none';
        if (state === 'none') missing++;
        if (state === 'back') summary.sentBack++;
        return { date: d, state, minutes, myMinutes, waitingBlocks: w };
      });
      summary.waitingDays += waiting;
      if (waiting) summary.waitingPeople++;
      if (missing) summary.notLogged++;
      const total = own.reduce((n, b) => n + b.minutes, 0);
      summary.totalMinutes += total;
      summary.billableMinutes += own.filter((b) => b.billable).reduce((n, b) => n + b.minutes, 0);
      const expected = days.reduce((n, d, i) => n + (i >= workingDays || hol.has(d) ? 0 : DAY_MINUTES), 0);
      return { employee: p, cells, totalMinutes: total, expectedMinutes: expected, waitingDays: waiting, missingDays: missing };
    });
    rows.sort((a, b) => b.waitingDays - a.waitingDays || b.missingDays - a.missingDays);
    // The summary covers everyone; the grid comes a page at a time
    const words = searchWords(q.search).map((w) => w.toLowerCase());
    const found = words.length ? rows.filter((r) => words.every((w) => `${r.employee.firstName} ${r.employee.lastName} ${r.employee.employeeId}`.toLowerCase().includes(w))) : rows;
    const show = q.show ?? 'all';
    const shown = show === 'waiting' ? found.filter((r) => r.waitingDays) : show === 'missing' ? found.filter((r) => r.missingDays) : found;
    const totalPages = Math.max(1, Math.ceil(shown.length / limit));
    const page = Math.min(q.page ?? 1, totalPages);
    return {
      weekStart,
      weekEnd,
      today,
      people: shown.slice((page - 1) * limit, page * limit),
      counts: { all: found.length, waiting: found.filter((r) => r.waitingDays).length, missing: found.filter((r) => r.missingDays).length },
      meta: { total: shown.length, page, limit, totalPages },
      summary,
    };
  }

  async approve(companyId: string, access: AccessContext, dto: ApproveBlocksDto) {
    return this.decideBlocks(companyId, access, dto, TimesheetStatus.APPROVED, dto.note ?? null);
  }

  async sendBack(companyId: string, access: AccessContext, dto: SendBackDto) {
    return this.decideBlocks(companyId, access, dto, TimesheetStatus.REJECTED, dto.note);
  }

  async pendingCount(companyId: string, access: AccessContext) {
    const rows = await this.prisma.timesheetEntry.groupBy({ by: ['employeeId', 'date'], where: { companyId, ...this.reviewWhere(access) } });
    return rows.length;
  }

  /** Nudge someone who hasn't logged days this week. */
  async nudge(companyId: string, access: AccessContext, employeeId: string) {
    const ids = await this.myPeople(companyId, access, addDays(mondayOf(await this.todayKey(companyId)), -7), await this.todayKey(companyId));
    if (!ids.includes(employeeId)) throw new ForbiddenException('You can only nudge people whose time you approve');
    const e = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { userId: true } });
    if (!e) throw new NotFoundException('Employee not found');
    const today = await this.todayKey(companyId);
    const sent = await this.notifications.notify({
      companyId,
      userIds: [e.userId],
      type: 'timesheet.reminder',
      title: `${access.employee ? await this.nameOf(access.employee.id) : 'Your lead'} asked you to fill your timesheet`,
      body: 'Log what you worked on and send it for approval.',
      link: '/app/timesheets',
      actionLabel: 'Fill timesheet',
      email: false,
      dedupeKey: `timesheet-nudge:${employeeId}:${today}`,
    });
    return { sent: sent > 0 };
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
      totalMinutes: { gt: 0 },
    };
    if (q.view === 'mine') {
      if (!access.employee) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      where.employeeId = access.employee.id;
    } else {
      where.employee = this.access.requireEmployeeScope(access, VIEW);
      if (!q.status) where.status = { not: TimesheetStatus.DRAFT };
    }
    const [rows, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        select: { id: true, weekStart: true, status: true, totalMinutes: true, submittedAt: true, decidedAt: true, decisionNote: true, approverLabel: true, employee: { select: PERSON } },
        orderBy: [{ weekStart: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timesheet.count({ where }),
    ]);
    return {
      data: rows.map(({ employee: { userId: _u, ...employee }, weekStart, ...r }) => ({ ...r, weekStart: keyFromDate(weekStart), employee })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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
          ...wordsWhere(q.search, (w): Prisma.EmployeeWhereInput[] => [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }, { employeeId: { contains: w, mode: 'insensitive' as const } }]),
          ...(q.status === 'missing' ? { timesheets: { none: { weekStart: week, totalMinutes: { gt: 0 } } } } : q.status ? { timesheets: { some: { weekStart: week, status: q.status } } } : {}),
        },
      ],
    };
    const [people, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: { ...PERSON, department: { select: { name: true } }, timesheets: { where: { weekStart: week, totalMinutes: { gt: 0 } }, select: { id: true, status: true, totalMinutes: true, submittedAt: true } } },
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

  // ─── Helpers ───────────────────────────────────────────────

  /** Validates a block and returns the row to store. */
  private async checkBlock(companyId: string, employeeId: string, dto: BlockDto, selfId: string | null) {
    const { today, tz } = await this.companyClock(companyId);
    const { date, startMin, endMin } = dto;
    if (Number.isNaN(Date.parse(date))) throw new BadRequestException('Pick a valid day');
    if (startMin % 5 || endMin % 5) throw new BadRequestException('Times go in 5-minute steps');
    if (endMin <= startMin) throw new BadRequestException('The end time must be after the start time');
    if (endMin - startMin > 16 * 60) throw new BadRequestException('One block can be at most 16 hours — split it up');
    if (date > today) throw new BadRequestException('You can’t log time for a future day');
    if (date < this.windowStart(today)) throw new BadRequestException(`Only the last ${MAX_AGE_WEEKS} weeks can be filled`);
    const nowMin = localMinutes(new Date(), tz) + daysBetween(date, today) * 1440;
    if (endMin > nowMin + 5) throw new BadRequestException('You can’t log time that hasn’t happened yet');

    const projectId = dto.projectId ?? null;
    let billable = false;
    if (projectId) {
      const member = await this.prisma.projectMember.findFirst({
        where: { companyId, employeeId, projectId, startDate: { lte: dateFromKey(date) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(date) } }] },
        select: { billed: true, project: { select: { type: true } } },
        orderBy: { startDate: 'desc' },
      });
      if (!member) throw new BadRequestException('You can only log time on projects you were assigned to that day');
      billable = member.project.type === ProjectType.CLIENT && member.billed;
    }

    // No overlaps — even across projects (neighbouring days too, for night work)
    const near = await this.prisma.timesheetEntry.findMany({
      where: { companyId, employeeId, date: { gte: dateFromKey(addDays(date, -1)), lte: dateFromKey(addDays(date, 1)) }, startMin: { not: null }, minutes: { gt: 0 }, ...(selfId && { id: { not: selfId } }) },
      select: { date: true, startMin: true, endMin: true, description: true, project: { select: { name: true } } },
    });
    for (const n of near) {
      const shift = daysBetween(date, keyFromDate(n.date)) * 1440;
      const s = n.startMin! + shift;
      const e = n.endMin! + shift;
      if (startMin < e && s < endMin) {
        throw new BadRequestException(`Overlaps another block: ${n.project?.name ?? 'General'} · “${n.description ?? ''}” ${clock(n.startMin!)} – ${clock(n.endMin!)}. Change the times so they don’t cross.`);
      }
    }
    const description = dto.description.trim();
    return {
      date: dateFromKey(date),
      startMin,
      endMin,
      minutes: endMin - startMin,
      projectId,
      description,
      task: (dto.workType ?? description).slice(0, 200),
      workType: dto.workType ?? null,
      billable,
      line: 0,
    };
  }

  private async mine(companyId: string, employeeId: string, id: string) {
    const b = await this.prisma.timesheetEntry.findFirst({ where: { id, companyId, employeeId }, select: { id: true, status: true, timesheetId: true } });
    if (!b) throw new NotFoundException('Block not found');
    if (b.status === TimesheetStatus.APPROVED) throw new BadRequestException('This block is approved and locked');
    if (b.status === TimesheetStatus.SUBMITTED) throw new BadRequestException('Take it back first (Recall) — it’s waiting for approval');
    return b;
  }

  private async one(id: string, access: AccessContext) {
    const b = await this.prisma.timesheetEntry.findUniqueOrThrow({ where: { id }, select: BLOCK });
    const names = await this.router.names([...b.approverIds, b.decidedById].filter((x): x is string => Boolean(x)));
    return this.shape(b, access, names, true);
  }

  private shape(b: BlockRow, access: AccessContext, names: Map<string, { id: string; firstName: string; lastName: string }>, editableWindow: boolean) {
    const own = b.employeeId === access.employee?.id;
    return {
      id: b.id,
      date: keyFromDate(b.date),
      startMin: b.startMin,
      endMin: b.endMin,
      minutes: b.minutes,
      project: b.project,
      description: b.description ?? b.task,
      workType: b.workType,
      billable: b.billable,
      status: b.status,
      approverLabel: b.approverLabel,
      approvers: b.approverIds.map((id) => names.get(id)).filter(Boolean),
      submittedAt: b.submittedAt,
      submitNote: b.submitNote,
      decidedBy: b.decidedById ? names.get(b.decidedById) ?? null : null,
      decidedAt: b.decidedAt,
      decisionNote: b.decisionNote,
      canEdit: own && editableWindow && EDITABLE.includes(b.status) && b.startMin !== null,
      canDecide: !own && Boolean(this.decideAs(access, { status: b.status, approverIds: b.approverIds, employee: { userId: own ? access.userId : '' } })),
    };
  }

  private dayStatus(statuses: TimesheetStatus[]): 'empty' | 'draft' | 'submitted' | 'approved' | 'back' | 'partial' {
    if (!statuses.length) return 'empty';
    if (statuses.includes(TimesheetStatus.REJECTED)) return 'back';
    if (statuses.includes(TimesheetStatus.DRAFT)) return 'draft';
    if (statuses.every((s) => s === TimesheetStatus.APPROVED)) return 'approved';
    if (statuses.every((s) => s === TimesheetStatus.SUBMITTED)) return 'submitted';
    return 'partial';
  }

  private async unsent(companyId: string, employeeId: string, today: string, scope: 'today' | 'all') {
    return this.prisma.timesheetEntry.findMany({
      where: {
        companyId,
        employeeId,
        status: { in: EDITABLE },
        minutes: { gt: 0 },
        date: scope === 'today' ? dateFromKey(today) : { gte: dateFromKey(this.windowStart(today)), lte: dateFromKey(today) },
      },
      select: BLOCK,
      orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
    });
  }

  private async unsentCount(companyId: string, employeeId: string, today: string) {
    const rows = await this.prisma.timesheetEntry.groupBy({
      by: ['date'],
      where: { companyId, employeeId, status: { in: EDITABLE }, minutes: { gt: 0 }, date: { gte: dateFromKey(this.windowStart(today)), lte: dateFromKey(today) } },
    });
    return rows.length;
  }

  /**
   * Who approves each (project, day): the person's team lead on that project;
   * no lead (or they're the lead) → the project's PMs; PMs and General time →
   * the line manager; nobody → HR (empty list). Nobody approves themselves.
   */
  async routeFor(companyId: string, employeeId: string, selfUserId: string, keys: Array<{ projectId: string | null; date: string }>): Promise<Map<string, Route>> {
    const out = new Map<string, Route>();
    if (!keys.length) return out;
    const dates = keys.map((k) => k.date).sort();
    const during = { startDate: { lte: dateFromKey(dates[dates.length - 1]!) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(dates[0]!) } }] };
    const projectIds = [...new Set(keys.map((k) => k.projectId).filter((x): x is string => Boolean(x)))];
    const [mine, pms, line] = await Promise.all([
      projectIds.length
        ? this.prisma.projectMember.findMany({
            where: { companyId, employeeId, projectId: { in: projectIds }, ...during },
            select: { projectId: true, role: true, startDate: true, endDate: true, project: { select: { name: true } }, lead: { select: { userId: true, employmentStatus: true, user: { select: { status: true } } } } },
          })
        : [],
      projectIds.length
        ? this.prisma.projectMember.findMany({
            where: { companyId, projectId: { in: projectIds }, role: ProjectRole.MANAGER, employeeId: { not: employeeId }, ...during, employee: LIVE },
            select: { projectId: true, startDate: true, endDate: true, employee: { select: { userId: true } } },
          })
        : [],
      this.prisma.employeeHierarchy.findFirst({ where: { companyId, descendantId: employeeId, depth: 1, ancestor: LIVE }, select: { ancestor: { select: { userId: true } } } }),
    ]);
    const covers = (m: { startDate: Date; endDate: Date | null }, d: string) => keyFromDate(m.startDate) <= d && (!m.endDate || keyFromDate(m.endDate) >= d);
    const lineManager = line && line.ancestor.userId !== selfUserId ? line.ancestor.userId : null;
    // Reports to the PMO instead of a person → the PMO lead(s) stand in for a line manager
    const pmoLeads = !lineManager && (await reportsToPmo(this.prisma, employeeId)) ? (await pmoLeadUserIds(this.prisma, companyId)).filter((u) => u !== selfUserId) : [];
    for (const k of keys) {
      const key = `${k.projectId ?? '-'}|${k.date}`;
      if (out.has(key)) continue;
      let r: Route | null = null;
      if (k.projectId) {
        const m = mine.find((x) => x.projectId === k.projectId && covers(x, k.date)) ?? mine.find((x) => x.projectId === k.projectId);
        if (m) {
          const lead = m.lead;
          if (m.role === ProjectRole.MEMBER && lead && lead.employmentStatus !== EmploymentStatus.TERMINATED && lead.user.status === UserStatus.ACTIVE && lead.userId !== selfUserId) {
            r = { approverIds: [lead.userId], label: `Team lead · ${m.project.name}` };
          } else if (m.role !== ProjectRole.MANAGER) {
            const ids = [...new Set(pms.filter((x) => x.projectId === k.projectId && covers(x, k.date)).map((x) => x.employee.userId))].filter((u) => u !== selfUserId);
            if (ids.length) r = { approverIds: ids, label: `Project manager · ${m.project.name}` };
          }
        }
      }
      r ??= lineManager ? { approverIds: [lineManager], label: 'Line manager' } : pmoLeads.length ? { approverIds: pmoLeads, label: 'PMO lead' } : { approverIds: [], label: 'HR' };
      out.set(key, r);
    }
    return out;
  }

  /** Everyone whose time I approve or look after: people I lead on projects, PM, manage, or who sent time to me. */
  private async myPeople(companyId: string, access: AccessContext, from: string, to: string): Promise<string[]> {
    const me = access.employee?.id;
    const myIds = [access.userId, ...covering(access, APPROVE).map((d) => d.fromUserId)];
    const during = { startDate: { lte: dateFromKey(to) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(from) } }] };
    const [routed, led, managed, reports] = await Promise.all([
      this.prisma.timesheetEntry.findMany({
        where: {
          companyId,
          date: { gte: dateFromKey(from), lte: dateFromKey(to) },
          OR: [{ approverIds: { hasSome: myIds } }, { decidedById: access.userId }, ...(this.companyApprover(access) ? [{ status: TimesheetStatus.SUBMITTED, approverIds: { isEmpty: true } }] : [])],
        },
        select: { employeeId: true },
        distinct: ['employeeId'],
      }),
      me ? this.prisma.projectMember.findMany({ where: { companyId, leadEmployeeId: me, role: ProjectRole.MEMBER, ...during, employee: LIVE }, select: { employeeId: true } }) : [],
      me ? this.prisma.projectMember.findMany({ where: { companyId, employeeId: me, role: ProjectRole.MANAGER, ...during }, select: { projectId: true } }) : [],
      me ? this.prisma.employee.findMany({ where: { companyId, reportingManagerId: me, ...LIVE }, select: { id: true } }) : [],
    ]);
    const pmTeam = managed.length
      ? await this.prisma.projectMember.findMany({
          where: { companyId, projectId: { in: managed.map((m) => m.projectId) }, ...during, employee: LIVE, OR: [{ role: ProjectRole.TEAM_LEAD }, { role: ProjectRole.MEMBER, leadEmployeeId: null }] },
          select: { employeeId: true },
        })
      : [];
    const ids = new Set([...routed, ...led, ...pmTeam].map((r) => r.employeeId).concat(reports.map((r) => r.id)));
    if (me) ids.delete(me);
    return [...ids];
  }

  private async decideBlocks(companyId: string, access: AccessContext, dto: PickBlocksDto, status: TimesheetStatus, note: string | null) {
    const people = dto.employeeIds?.length ? dto.employeeIds : dto.employeeId ? [dto.employeeId] : [];
    if (!dto.ids?.length && !people.length) throw new BadRequestException('Pick the time to decide');
    const rows = await this.prisma.timesheetEntry.findMany({
      where: {
        companyId,
        ...(dto.ids?.length ? { id: { in: dto.ids } } : { employeeId: { in: people }, status: TimesheetStatus.SUBMITTED }),
        ...(dto.dates?.length && { date: { in: dto.dates.map(dateFromKey) } }),
      },
      select: { ...BLOCK, employee: { select: { userId: true, firstName: true } } },
    });
    if (dto.ids?.length && rows.length !== dto.ids.length) throw new NotFoundException('Some of that time no longer exists');
    if (rows.some((r) => r.employee.userId === access.userId)) throw new ForbiddenException('You can’t approve your own time');
    if (dto.ids?.length && rows.some((r) => r.status !== TimesheetStatus.SUBMITTED)) throw new ConflictException('Some of that time isn’t waiting for approval any more');
    const decidable = rows.map((r) => ({ r, d: this.decideAs(access, r) })).filter((x) => x.d);
    if (dto.ids?.length && decidable.length !== rows.length) throw new ForbiddenException('Some of that time is waiting for someone else');
    if (!decidable.length) throw new BadRequestException('Nothing here is waiting for you');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const { r, d } of decidable) {
        const { count } = await tx.timesheetEntry.updateMany({
          where: { id: r.id, status: TimesheetStatus.SUBMITTED },
          data: { status, decidedById: access.userId, onBehalfOfId: d!.onBehalfOf, decidedAt: now, decisionNote: note },
        });
        if (!count) throw new ConflictException('Someone else has already decided some of this time');
      }
      await this.syncSheets(tx, [...new Set(decidable.map((x) => x.r.timesheetId))]);
    });

    // One note per person
    const byPerson = new Map<string, typeof decidable>();
    for (const x of decidable) byPerson.set(x.r.employee.userId, [...(byPerson.get(x.r.employee.userId) ?? []), x]);
    for (const [userId, list] of byPerson) {
      const dates = [...new Set(list.map((x) => keyFromDate(x.r.date)))].sort();
      const projects = [...new Set(list.map((x) => x.r.project?.name ?? 'General'))].join(', ');
      const range = dateRange(dates[0]!, dates[dates.length - 1]!);
      void this.notifications.notify({
        companyId,
        userIds: [userId],
        type: status === TimesheetStatus.APPROVED ? 'timesheet.approved' : 'timesheet.rejected',
        title: status === TimesheetStatus.APPROVED ? `Time approved: ${range} · ${projects}` : `Time sent back: ${range} · ${projects}`,
        body: note ? (status === TimesheetStatus.REJECTED ? `Reason: ${note}` : note) : null,
        link: `/app/timesheets?week=${mondayOf(dates[0]!)}`,
        ...(status === TimesheetStatus.REJECTED && { actionLabel: 'Fix and resend' }),
        email: status === TimesheetStatus.REJECTED,
      });
    }
    return { decided: decidable.length, skipped: rows.length - decidable.length, status };
  }

  /** Week rows follow their blocks: total, and a status worked out from them. */
  private async syncSheets(tx: Prisma.TransactionClient, sheetIds: string[]) {
    for (const id of sheetIds) {
      const blocks = await tx.timesheetEntry.findMany({
        where: { timesheetId: id, minutes: { gt: 0 } },
        select: { status: true, minutes: true, approverIds: true, approverLabel: true, submittedAt: true, decidedById: true, decidedAt: true, decisionNote: true },
      });
      const statuses = blocks.map((b) => b.status);
      const status = !statuses.length
        ? TimesheetStatus.DRAFT
        : statuses.includes(TimesheetStatus.REJECTED)
          ? TimesheetStatus.REJECTED
          : statuses.includes(TimesheetStatus.DRAFT)
            ? TimesheetStatus.DRAFT
            : statuses.includes(TimesheetStatus.SUBMITTED)
              ? TimesheetStatus.SUBMITTED
              : TimesheetStatus.APPROVED;
      const last = <T>(xs: T[], key: (x: T) => Date | null) => xs.filter((x) => key(x)).sort((a, b) => key(b)!.getTime() - key(a)!.getTime())[0];
      const decided = last(blocks, (b) => b.decidedAt);
      const rejected = last(blocks.filter((b) => b.status === TimesheetStatus.REJECTED), (b) => b.decidedAt);
      await tx.timesheet.update({
        where: { id },
        data: {
          status,
          totalMinutes: blocks.reduce((n, b) => n + b.minutes, 0),
          approverIds: [...new Set(blocks.filter((b) => b.status === TimesheetStatus.SUBMITTED).flatMap((b) => b.approverIds))],
          approverLabel: [...new Set(blocks.map((b) => b.approverLabel).filter(Boolean))].join(', ') || null,
          submittedAt: last(blocks, (b) => b.submittedAt)?.submittedAt ?? null,
          decidedById: decided?.decidedById ?? null,
          decidedAt: decided?.decidedAt ?? null,
          decisionNote: rejected?.decisionNote ?? null,
        },
      });
    }
  }

  private async sheetFor(tx: Prisma.TransactionClient, companyId: string, employeeId: string, weekStart: string) {
    const s = await tx.timesheet.upsert({
      where: { employeeId_weekStart: { employeeId, weekStart: dateFromKey(weekStart) } },
      create: { companyId, employeeId, weekStart: dateFromKey(weekStart) },
      update: {},
      select: { id: true },
    });
    return s.id;
  }

  /** Projects the person is assigned to during the week (with the dates the assignment covers). */
  private async allocations(companyId: string, employeeId: string, from: string, to: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { companyId, employeeId, startDate: { lte: dateFromKey(to) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(from) } }] },
      select: {
        role: true,
        allocation: true,
        billed: true,
        startDate: true,
        endDate: true,
        lead: { select: { firstName: true, lastName: true } },
        project: { select: { id: true, code: true, name: true, clientName: true, status: true, color: true, type: true } },
      },
      orderBy: { project: { name: 'asc' } },
    });
    const out = new Map<string, { id: string; code: string; name: string; clientName: string | null; color: string | null; type: ProjectType; billable: boolean; role: string; allocation: number; lead: string | null; from: string; to: string | null }>();
    for (const m of members) {
      const prev = out.get(m.project.id);
      const from = keyFromDate(m.startDate);
      const to = m.endDate ? keyFromDate(m.endDate) : null;
      out.set(
        m.project.id,
        prev
          ? { ...prev, from: from < prev.from ? from : prev.from, to: !to || !prev.to ? null : to > prev.to ? to : prev.to }
          : {
              id: m.project.id,
              code: m.project.code,
              name: m.project.name,
              clientName: m.project.clientName,
              color: m.project.color,
              type: m.project.type,
              billable: m.project.type === ProjectType.CLIENT && m.billed,
              role: m.role,
              allocation: m.allocation,
              lead: m.lead ? `${m.lead.firstName} ${m.lead.lastName}` : null,
              from,
              to,
            },
      );
    }
    return [...out.values()];
  }

  private reviewWhere(access: AccessContext): Prisma.TimesheetEntryWhereInput {
    const me = [access.userId, ...covering(access, APPROVE).map((d) => d.fromUserId)];
    return {
      status: TimesheetStatus.SUBMITTED,
      employee: { userId: { not: access.userId } },
      OR: [{ approverIds: { hasSome: me } }, ...(this.companyApprover(access) ? [{ approverIds: { isEmpty: true } }] : [])],
    };
  }

  private companyApprover(access: AccessContext) {
    return access.isSuperAdmin || access.grants.get(APPROVE) === 'company';
  }

  /** Can I decide this block, and for whom? HR (company scope) can decide anything. */
  private decideAs(access: AccessContext, b: { status: TimesheetStatus; approverIds: string[]; employee: { userId: string } }): { onBehalfOf: string | null } | null {
    if (b.status !== TimesheetStatus.SUBMITTED || b.employee.userId === access.userId) return null;
    if (b.approverIds.includes(access.userId) || this.companyApprover(access)) return { onBehalfOf: null };
    const cover = covering(access, APPROVE).find((d) => b.approverIds.includes(d.fromUserId));
    return cover ? { onBehalfOf: cover.fromUserId } : null;
  }

  private async assertCanSee(companyId: string, access: AccessContext, employeeId: string, weekStart: string) {
    const scope = this.access.employeeScope(access, VIEW);
    if (scope && holds(access, VIEW) && (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope] } }))) return;
    if ((await this.myPeople(companyId, access, weekStart, addDays(weekStart, 6))).includes(employeeId)) return;
    throw new NotFoundException('Timesheet not found');
  }

  private async nameOf(employeeId: string) {
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true } });
    return e ? `${e.firstName} ${e.lastName}` : 'Someone';
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

  private windowStart(today: string) {
    return addDays(mondayOf(today), -7 * MAX_AGE_WEEKS);
  }

  private async companyClock(companyId: string) {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true, workingDaysPerWeek: true } });
    const tz = s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata';
    return { tz, today: localDateKey(new Date(), tz), workingDays: Math.min(7, Math.max(1, s?.workingDaysPerWeek ?? 5)) };
  }

  async todayKey(companyId: string): Promise<string> {
    return (await this.companyClock(companyId)).today;
  }
}

export function hours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
