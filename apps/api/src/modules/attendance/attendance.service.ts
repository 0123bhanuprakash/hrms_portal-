import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { AttendancePolicyService, type CompanyPolicy } from './policy.service';
import { HolidaysService } from './holidays.service';
import { deriveDay, lateMinutesFor, statusForMinutes, withShift, workedMinutes, type DayStatus, type ShiftHours } from './attendance-rules';
import { addDays, dateFromKey, keyFromDate, localDateKey, monthKeys, weekdayOfKey, zonedInstant } from './time-zone';
import { ShiftsService } from './shifts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalRouterService } from '../projects/approval-router.service';

const addDaysDate = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
import type { CalendarQueryDto, ExportQueryDto, NudgeDto, TeamMonthQueryDto, TeamQueryDto, UpsertRecordDto } from './dto';

/** A check-in or check-out this soon after the opposite tap is treated as a mistaken double tap. */
const ACCIDENTAL_TAP_MS = 60_000;

const RECORD_SELECT = {
  id: true,
  date: true,
  checkIn: true,
  checkOut: true,
  workingMinutes: true,
  lateMinutes: true,
  status: true,
  isManualEntry: true,
  checkInSource: true,
  checkOutSource: true,
  notes: true,
  sessions: true,
  breakMinutes: true,
  openSince: true,
  earlyCheckout: true,
  autoClosed: true,
} satisfies Prisma.AttendanceRecordSelect;

const PUNCH_SELECT = { id: true, kind: true, at: true, source: true, note: true, early: true } satisfies Prisma.AttendancePunchSelect;
type RecordRow = Prisma.AttendanceRecordGetPayload<{ select: typeof RECORD_SELECT }>;

const PERSON = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  joiningDate: true,
  locationId: true,
  designation: { select: { name: true } },
  department: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeSelect;

/** Counts shown above calendars and team lists. */
function summarise(statuses: Array<{ status: DayStatus; lateMinutes?: number | null; workingMinutes?: number | null }>) {
  const count = (s: DayStatus) => statuses.filter((d) => d.status === s).length;
  const worked = statuses.filter((d) => d.workingMinutes && (d.status === 'PRESENT' || d.status === 'HALF_DAY'));
  return {
    present: count('PRESENT'),
    halfDay: count('HALF_DAY'),
    absent: count('ABSENT'),
    missingCheckout: count('MISSING_CHECKOUT'),
    onLeave: count('ON_LEAVE'),
    workFromHome: count('WORK_FROM_HOME'),
    holidays: count('HOLIDAY'),
    late: statuses.filter((d) => (d.lateMinutes ?? 0) > 0).length,
    averageMinutes: worked.length ? Math.round(worked.reduce((sum, d) => sum + (d.workingMinutes ?? 0), 0) / worked.length) : 0,
  };
}

/** A leave request touching a day, as attendance shows it. */
export interface DayLeaveInfo {
  name: string;
  code: string;
  color: string;
  status: 'APPROVED' | 'PENDING';
  countsAsPresent: boolean;
  halfDay: boolean;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly policies: AttendancePolicyService,
    private readonly holidays: HolidaysService,
    private readonly shifts: ShiftsService,
    private readonly notifications: NotificationsService,
    private readonly router: ApprovalRouterService,
  ) {}

  /**
   * Approved + pending leave per "employeeId|date" between two dates.
   * Only days the leave actually covers (weekly offs / holidays are skipped
   * unless the leave type counts them).
   */
  async leavesBetween(companyId: string, employeeIds: string[], fromKey: string, toKey: string, policy: CompanyPolicy): Promise<Map<string, DayLeaveInfo>> {
    const map = new Map<string, DayLeaveInfo>();
    if (!employeeIds.length) return map;
    const [rows, people] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: { lte: dateFromKey(toKey) },
          endDate: { gte: dateFromKey(fromKey) },
        },
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          halfDay: true,
          status: true,
          leaveType: { select: { name: true, code: true, color: true, countsAsPresent: true, includeNonWorkingDays: true } },
        },
      }),
      this.prisma.employee.findMany({ where: { companyId, id: { in: employeeIds } }, select: { id: true, locationId: true } }),
    ]);
    const holidaysOf = await this.holidays.forPeople(companyId, people, fromKey, toKey);
    for (const l of rows) {
      const holidays = holidaysOf.get(l.employeeId) ?? new Map();
      const start = keyFromDate(l.startDate) < fromKey ? fromKey : keyFromDate(l.startDate);
      const end = keyFromDate(l.endDate) > toKey ? toKey : keyFromDate(l.endDate);
      for (let key = start; key <= end; key = addDays(key, 1)) {
        const holiday = holidays.get(key);
        const off = !policy.workDays.includes(weekdayOfKey(key)) || Boolean(holiday);
        if (off && !l.leaveType.includeNonWorkingDays) continue;
        const mapKey = l.employeeId + '|' + key;
        if (map.get(mapKey)?.status === 'APPROVED') continue; // approved wins over pending
        map.set(mapKey, {
          name: l.leaveType.name,
          code: l.leaveType.code,
          color: l.leaveType.color,
          status: l.status as 'APPROVED' | 'PENDING',
          countsAsPresent: l.leaveType.countsAsPresent,
          halfDay: Boolean(l.halfDay),
        });
      }
    }
    return map;
  }

  /** Only approved leave changes a day's status. */
  private approved(info: DayLeaveInfo | null | undefined) {
    return info?.status === 'APPROVED' ? { countsAsPresent: info.countsAsPresent, halfDay: info.halfDay } : null;
  }

  // ─── Self-service: today, check in, check out ─────────────

  async today(companyId: string, access: AccessContext) {
    const policy = await this.policies.get(companyId);
    const now = new Date();
    const todayKey = localDateKey(now, policy.timeZone);
    const employee = access.employee
      ? await this.prisma.employee.findFirst({ where: { id: access.employee.id, companyId }, select: { id: true, joiningDate: true, locationId: true } })
      : null;
    if (!employee) return { hasProfile: false, date: todayKey, serverTime: now, policy, record: null, status: null, holiday: null, leave: null };

    const [record, holidays, leaves, punches, nightShift, shift] = await Promise.all([
      this.prisma.attendanceRecord.findUnique({ where: { companyId_employeeId_date: { companyId, employeeId: employee.id, date: dateFromKey(todayKey) } }, select: RECORD_SELECT }),
      this.holidays.forPeople(companyId, [employee], todayKey, todayKey).then((m) => m.get(employee.id)!),
      this.leavesBetween(companyId, [employee.id], todayKey, todayKey, policy),
      this.prisma.attendancePunch.findMany({ where: { companyId, employeeId: employee.id, date: dateFromKey(todayKey) }, select: PUNCH_SELECT, orderBy: { at: 'asc' } }),
      this.nightShiftAllowed(companyId, employee.id, todayKey),
      this.shifts.hoursOf(companyId, employee.id),
    ]);
    // A night shift still running from yesterday
    const carried = nightShift ? await this.openNightShift(companyId, employee.id, todayKey, now) : null;
    const holiday = holidays.get(todayKey) ?? null;
    const leave = leaves.get(employee.id + '|' + todayKey) ?? null;
    const status = deriveDay({ dateKey: todayKey, todayKey, joiningKey: keyFromDate(employee.joiningDate), record, holiday: Boolean(holiday), policy, leave: this.approved(leave) });
    return { hasProfile: true, date: todayKey, serverTime: now, policy: withShift(policy, shift), shift: this.shiftOut(policy, shift), record, status, holiday, leave, punches, nightShift, carriedOver: carried ? { date: keyFromDate(carried.date), openSince: carried.openSince } : null };
  }

  /**
   * Check in. The first check-in of the day sets the day's start (and lateness);
   * after a check-out you can check in again — each check-in starts a new session.
   */
  async checkIn(companyId: string, access: AccessContext, ip: string | undefined) {
    const { policy: companyPolicy, employeeId, todayKey, existing, carried } = await this.selfContext(companyId, access);
    if (carried) throw new ConflictException('You are still checked in from your night shift — check out first');
    const policy = withShift(companyPolicy, await this.shifts.hoursOf(companyId, employeeId));
    if (existing?.openSince) throw new ConflictException('You are already checked in');
    const now = new Date();
    const date = dateFromKey(todayKey);
    return this.prisma.$transaction(async (tx) => {
      // Checked out by mistake a moment ago: carry on with that session instead of starting a new one
      if (existing?.checkIn && existing.checkOut && now.getTime() - existing.checkOut.getTime() < ACCIDENTAL_TAP_MS) {
        const [lastOut, lastIn] = await tx.attendancePunch.findMany({ where: { recordId: existing.id }, orderBy: { at: 'desc' }, take: 2, select: { id: true, kind: true, at: true } });
        if (lastOut?.kind === 'OUT' && lastIn?.kind === 'IN') {
          await tx.attendancePunch.delete({ where: { id: lastOut.id } });
          return tx.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              openSince: lastIn.at,
              checkOut: null,
              workingMinutes: Math.max(0, (existing.workingMinutes ?? 0) - workedMinutes(lastIn.at, lastOut.at)),
              earlyCheckout: false,
              status: AttendanceStatus.PRESENT,
            },
            select: RECORD_SELECT,
          });
        }
      }
      const record =
        existing?.checkIn && existing.checkOut
          ? // Back again: a new session; the time away counts as a break
            await tx.attendanceRecord.update({
              where: { id: existing.id },
              data: {
                openSince: now,
                checkOut: null,
                sessions: { increment: 1 },
                breakMinutes: (existing.breakMinutes ?? 0) + workedMinutes(existing.checkOut, now),
                earlyCheckout: false,
                status: AttendanceStatus.PRESENT,
              },
              select: RECORD_SELECT,
            })
          : await tx.attendanceRecord.upsert({
              where: { companyId_employeeId_date: { companyId, employeeId, date } },
              update: this.firstSession(now, policy, ip),
              create: { ...this.firstSession(now, policy, ip), companyId, employeeId, date },
              select: RECORD_SELECT,
            });
      await tx.attendancePunch.create({ data: { companyId, employeeId, recordId: record.id, date, kind: 'IN', at: now, source: 'WEB', ip: ip ?? null } });
      return record;
    }).then((record) => {
      if (record.lateMinutes && record.sessions === 1 && policy.lateAlertAt) void this.lateAlert(companyId, employeeId, todayKey, policy.lateAlertAt);
      return record;
    });
  }

  /** On the Nth late arrival of a month, tell the line manager (in-app, once a month). */
  private async lateAlert(companyId: string, employeeId: string, todayKey: string, threshold: number) {
    const month = todayKey.slice(0, 7);
    const late = await this.prisma.attendanceRecord.count({
      where: { companyId, employeeId, lateMinutes: { gt: 0 }, date: { gte: dateFromKey(month + '-01'), lte: dateFromKey(todayKey) } },
    });
    if (late !== threshold) return;
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true, reportingManager: { select: { userId: true } } } });
    if (!e?.reportingManager) return;
    await this.notifications.notify({
      companyId,
      userIds: [e.reportingManager.userId],
      type: 'attendance.late_often',
      title: `${e.firstName} ${e.lastName} was late ${late} times this month`,
      body: 'See their month in Team attendance.',
      link: `/app/attendance?employee=${employeeId}`,
      actionLabel: 'See their month',
      email: false,
      dedupeKey: `late-often:${employeeId}:${month}`,
    });
  }

  /** The person's shift as the screens show it (general shift when none). */
  shiftOut(policy: CompanyPolicy, shift: ShiftHours | null) {
    return shift ?? { id: null, name: 'General', start: policy.shiftStart, end: policy.shiftEnd, overnight: false };
  }

  private firstSession(now: Date, policy: CompanyPolicy, ip: string | undefined) {
    return {
      checkIn: now,
      checkOut: null,
      openSince: now,
      sessions: 1,
      breakMinutes: null,
      earlyCheckout: false,
      workingMinutes: null,
      lateMinutes: lateMinutesFor(now, policy, policy.timeZone) || null,
      status: AttendanceStatus.PRESENT,
      checkInSource: 'WEB',
      checkInIp: ip ?? null,
      isManualEntry: false,
    };
  }

  /**
   * Check out. Time worked = all sessions added up. Before a full day the
   * check-out is marked early, with an optional reason for the manager.
   */
  async checkOut(companyId: string, access: AccessContext, ip: string | undefined, note?: string) {
    const { policy, employeeId, existing, carried } = await this.selfContext(companyId, access);
    const target = existing?.openSince ? existing : carried;
    if (!target?.openSince) {
      if (existing?.checkIn) throw new ConflictException('You have already checked out');
      throw new BadRequestException('You have not checked in today');
    }
    const now = new Date();
    const worked = (target.workingMinutes ?? 0) + workedMinutes(target.openSince, now);
    const early = worked < policy.fullDayMinutes;
    const reason = note?.trim() ? note.trim().slice(0, 500) : null;
    return this.prisma.$transaction(async (tx) => {
      // Checked in again by mistake a moment ago: undo that check-in rather than log an empty session
      if (target === existing && target.sessions > 1 && now.getTime() - target.openSince!.getTime() < ACCIDENTAL_TAP_MS) {
        const [lastIn, prevOut] = await tx.attendancePunch.findMany({ where: { recordId: target.id }, orderBy: { at: 'desc' }, take: 2, select: { id: true, kind: true, at: true, early: true } });
        if (lastIn?.kind === 'IN' && prevOut?.kind === 'OUT') {
          await tx.attendancePunch.delete({ where: { id: lastIn.id } });
          const closed = target.workingMinutes ?? 0;
          const record = await tx.attendanceRecord.update({
            where: { id: target.id },
            data: {
              checkOut: prevOut.at,
              openSince: null,
              sessions: { decrement: 1 },
              breakMinutes: Math.max(0, (target.breakMinutes ?? 0) - workedMinutes(prevOut.at, lastIn.at)) || null,
              workingMinutes: closed,
              status: statusForMinutes(closed, policy),
              earlyCheckout: prevOut.early,
            },
            select: RECORD_SELECT,
          });
          return { ...record, early: prevOut.early };
        }
      }
      const record = await tx.attendanceRecord.update({
        where: { id: target.id },
        data: { checkOut: now, openSince: null, workingMinutes: worked, status: statusForMinutes(worked, policy), earlyCheckout: early, checkOutSource: 'WEB', checkOutIp: ip ?? null },
        select: RECORD_SELECT,
      });
      await tx.attendancePunch.create({ data: { companyId, employeeId, recordId: target.id, date: target.date, kind: 'OUT', at: now, source: 'WEB', ip: ip ?? null, early, note: reason } });
      return { ...record, early };
    });
  }

  /** People on a project that needs night work may stay checked in past midnight. */
  async nightShiftAllowed(companyId: string, employeeId: string, dateKey: string): Promise<boolean> {
    if ((await this.shifts.hoursOf(companyId, employeeId))?.overnight) return true;
    const date = dateFromKey(dateKey);
    const n = await this.prisma.projectMember.count({
      where: { companyId, employeeId, nightShift: true, startDate: { lte: date }, OR: [{ endDate: null }, { endDate: { gte: addDaysDate(date, -1) } }] },
    });
    return n > 0;
  }

  /** Yesterday's session still running (night shift), if it started less than 24 hours ago. */
  private async openNightShift(companyId: string, employeeId: string, todayKey: string, now: Date) {
    const y = await this.prisma.attendanceRecord.findUnique({ where: { companyId_employeeId_date: { companyId, employeeId, date: dateFromKey(addDays(todayKey, -1)) } } });
    return y?.openSince && now.getTime() - y.openSince.getTime() < 24 * 3600_000 ? y : null;
  }

  private async selfContext(companyId: string, access: AccessContext) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile, so attendance cannot be recorded');
    const policy = await this.policies.get(companyId);
    if (!policy.webCheckInEnabled) throw new ForbiddenException('Web check-in is turned off for your company');
    const employee = await this.prisma.employee.findFirst({ where: { id: access.employee.id, companyId }, select: { id: true, employmentStatus: true } });
    if (!employee || employee.employmentStatus === EmploymentStatus.TERMINATED) throw new ForbiddenException('Attendance cannot be recorded for this profile');
    const todayKey = localDateKey(new Date(), policy.timeZone);
    const now = new Date();
    const [existing, nightShift] = await Promise.all([
      this.prisma.attendanceRecord.findUnique({ where: { companyId_employeeId_date: { companyId, employeeId: employee.id, date: dateFromKey(todayKey) } } }),
      this.nightShiftAllowed(companyId, employee.id, todayKey),
    ]);
    // The day resets at 12 AM — except a night shift, which can carry on into the next day
    const carried = nightShift && !existing?.openSince ? await this.openNightShift(companyId, employee.id, todayKey, now) : null;
    return { policy, employeeId: employee.id, todayKey, existing, carried };
  }

  // ─── Calendar (one person, one month) ─────────────────────

  async calendar(companyId: string, access: AccessContext, query: CalendarQueryDto) {
    const targetId = query.employeeId ?? access.employee?.id;
    if (!targetId) throw new BadRequestException('Your account has no employee profile');
    await this.access.assertEmployeeInScope(access, 'attendance.view', companyId, targetId);

    const policy = await this.policies.get(companyId);
    const keys = monthKeys(query.month);
    const [from, to] = [keys[0]!, keys[keys.length - 1]!];
    const todayKey = localDateKey(new Date(), policy.timeZone);

    const [employee, records, holidaysOf, corrections, leaves, shift] = await Promise.all([
      this.prisma.employee.findUniqueOrThrow({ where: { id: targetId }, select: PERSON }),
      this.prisma.attendanceRecord.findMany({ where: { companyId, employeeId: targetId, date: { gte: dateFromKey(from), lte: dateFromKey(to) } }, select: RECORD_SELECT }),
      this.prisma.employee.findUniqueOrThrow({ where: { id: targetId }, select: { id: true, locationId: true } }).then((p) => this.holidays.forPeople(companyId, [p], from, to)),
      this.prisma.attendanceRegularisation.findMany({
        where: { companyId, employeeId: targetId, date: { gte: dateFromKey(from), lte: dateFromKey(to) }, status: { in: ['PENDING', 'REJECTED', 'APPROVED'] } },
        select: { id: true, date: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.leavesBetween(companyId, [targetId], from, to, policy),
      this.shifts.hoursOf(companyId, targetId),
    ]);
    const holidays = holidaysOf.get(targetId)!;
    const byDate = new Map(records.map((r) => [keyFromDate(r.date), r]));
    // Latest request per day wins
    const correctionByDate = new Map(corrections.map((c) => [keyFromDate(c.date), { id: c.id, status: c.status }]));
    const joiningKey = keyFromDate(employee.joiningDate);
    // A night shift that started yesterday and is still running isn't a missed check-out
    const yesterdayKey = addDays(todayKey, -1);
    const nightOpen = byDate.get(yesterdayKey)?.openSince && (await this.nightShiftAllowed(companyId, targetId, todayKey)) && Date.now() - byDate.get(yesterdayKey)!.openSince!.getTime() < 24 * 3600_000;

    const days = keys.map((dateKey) => {
      const record = byDate.get(dateKey) ?? null;
      const holiday = holidays.get(dateKey) ?? null;
      const leave = leaves.get(targetId + '|' + dateKey) ?? null;
      const derived = deriveDay({ dateKey, todayKey, joiningKey, record, holiday: Boolean(holiday), policy, leave: this.approved(leave) });
      return {
        date: dateKey,
        status: nightOpen && dateKey === yesterdayKey && derived === 'MISSING_CHECKOUT' ? ('WORKING' as const) : derived,
        leave,
        checkIn: record?.checkIn ?? null,
        checkOut: record?.checkOut ?? null,
        workingMinutes: record?.workingMinutes ?? null,
        lateMinutes: record?.lateMinutes ?? null,
        sessions: record?.sessions ?? 0,
        breakMinutes: record?.breakMinutes ?? null,
        earlyCheckout: record?.earlyCheckout ?? false,
        autoClosed: record?.autoClosed ?? false,
        isManualEntry: record?.isManualEntry ?? false,
        notes: record?.notes ?? null,
        holiday: holiday ? { name: holiday.name, isOptional: holiday.isOptional } : null,
        correction: correctionByDate.get(dateKey) ?? null,
      };
    });
    return { employee, month: query.month, today: todayKey, policy: withShift(policy, shift), shift: this.shiftOut(policy, shift), days, summary: summarise(days) };
  }

  // ─── Team view (everyone in scope, one day) ───────────────

  async team(companyId: string, access: AccessContext, query: TeamQueryDto) {
    const scope = this.access.requireEmployeeScope(access, 'attendance.view');
    const policy = await this.policies.get(companyId);
    const todayKey = localDateKey(new Date(), policy.timeZone);
    const dateKey = query.date ?? todayKey;
    const date = dateFromKey(dateKey);

    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [
          { companyId, joiningDate: { lte: date }, OR: [{ employmentStatus: { not: EmploymentStatus.TERMINATED } }, { terminationDate: { gt: date } }] },
          scope,
          ...(query.departmentId ? [{ departmentId: query.departmentId }] : []),
          ...(query.search
            ? [{ OR: ['firstName', 'lastName', 'email', 'employeeId'].map((f) => ({ [f]: { contains: query.search, mode: 'insensitive' } })) as Prisma.EmployeeWhereInput[] }]
            : []),
        ],
      },
      select: PERSON,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    const [records, holidays, holidaysOf, leaves, shiftOf] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { companyId, date, employeeId: { in: employees.map((e) => e.id) } }, select: { ...RECORD_SELECT, employeeId: true } }),
      this.holidays.between(companyId, dateKey, dateKey),
      this.holidays.forPeople(companyId, employees, dateKey, dateKey),
      this.leavesBetween(companyId, employees.map((e) => e.id), dateKey, dateKey, policy),
      this.shifts.hoursFor(companyId, employees.map((e) => e.id)),
    ]);
    const byEmployee = new Map(records.map((r) => [r.employeeId, r]));
    const anyHoliday = holidays.get(dateKey) ?? null;
    const holiday = anyHoliday && !anyHoliday.isOptional && !anyHoliday.locationIds.length ? anyHoliday : null;

    const rows = employees.map((e) => {
      const record = byEmployee.get(e.id) ?? null;
      const leave = leaves.get(e.id + '|' + dateKey) ?? null;
      return {
        employee: e,
        status: deriveDay({ dateKey, todayKey, joiningKey: keyFromDate(e.joiningDate), record, holiday: holidaysOf.get(e.id)!.has(dateKey), policy, leave: this.approved(leave) }),
        leave,
        checkIn: record?.checkIn ?? null,
        checkOut: record?.checkOut ?? null,
        openSince: record?.openSince ?? null,
        workingMinutes: record?.workingMinutes ?? null,
        breakMinutes: record?.breakMinutes ?? null,
        lateMinutes: record?.lateMinutes ?? null,
        isManualEntry: record?.isManualEntry ?? false,
        autoClosed: record?.autoClosed ?? false,
        shift: this.shiftOut(policy, shiftOf.get(e.id) ?? null),
      };
    });
    const counts = { total: rows.length, ...summarise(rows), working: rows.filter((r) => r.status === 'WORKING').length, notCheckedIn: rows.filter((r) => r.status === 'NOT_CHECKED_IN').length };
    const filtered = query.status
      ? rows.filter((r) => (query.status === 'LATE' ? (r.lateMinutes ?? 0) > 0 : r.status === query.status))
      : rows;

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    return {
      date: dateKey,
      today: todayKey,
      holiday: holiday ? { name: holiday.name } : null,
      counts,
      data: filtered.slice((page - 1) * limit, page * limit),
      meta: { total: filtered.length, page, limit, totalPages: Math.ceil(filtered.length / limit) },
    };
  }

  // ─── HR / admin: set a day directly ───────────────────────

  async upsertRecord(companyId: string, access: AccessContext, dto: UpsertRecordDto) {
    await this.access.assertEmployeeInScope(access, 'attendance.edit', companyId, dto.employeeId);
    const policy = await this.policies.get(companyId);
    if (dto.date > localDateKey(new Date(), policy.timeZone)) throw new BadRequestException('You cannot record attendance for a future date');
    if (!dto.checkIn && dto.checkOut) throw new BadRequestException('A check-out needs a check-in');

    const shift = await this.shifts.hoursOf(companyId, dto.employeeId);
    const data = dto.checkIn
      ? { ...this.timesFor(withShift(policy, shift), dto.date, dto.checkIn, dto.checkOut ?? null, shift?.overnight), checkInSource: 'ADMIN', checkOutSource: dto.checkOut ? 'ADMIN' : null, autoClosed: false }
      : {
          checkIn: null,
          checkOut: null,
          workingMinutes: null,
          lateMinutes: null,
          status: dto.status ?? AttendanceStatus.ABSENT,
          checkInSource: null,
          checkOutSource: null,
          sessions: 0,
          openSince: null,
          breakMinutes: null,
          earlyCheckout: false,
        };
    const date = dateFromKey(dto.date);
    return this.prisma.attendanceRecord.upsert({
      where: { companyId_employeeId_date: { companyId, employeeId: dto.employeeId, date } },
      update: { ...data, isManualEntry: true, notes: dto.notes ?? null },
      create: { ...data, isManualEntry: true, notes: dto.notes ?? null, companyId, employeeId: dto.employeeId, date },
      select: { ...RECORD_SELECT, employeeId: true },
    });
  }

  /** Check-in / out wall-clock times on a date → stored values (validated). */
  timesFor(policy: CompanyPolicy, dateKey: string, checkIn: string, checkOut: string | null, overnight = false) {
    const inAt = zonedInstant(dateKey, checkIn, policy.timeZone);
    let outAt = checkOut ? zonedInstant(dateKey, checkOut, policy.timeZone) : null;
    // Night shift: a check-out "before" the check-in is the next morning
    if (overnight && outAt && outAt <= inAt) outAt = zonedInstant(addDays(dateKey, 1), checkOut!, policy.timeZone);
    const now = new Date();
    if (inAt > now || (outAt && outAt > now)) throw new BadRequestException('Times cannot be in the future');
    if (outAt && outAt <= inAt) throw new BadRequestException('Check-out must be after check-in');
    const worked = outAt ? workedMinutes(inAt, outAt) : null;
    return {
      checkIn: inAt,
      checkOut: outAt,
      workingMinutes: worked,
      lateMinutes: lateMinutesFor(inAt, policy, policy.timeZone) || null,
      status: worked === null ? AttendanceStatus.PRESENT : statusForMinutes(worked, policy),
      // A corrected day is one session; still running when there's no check-out
      sessions: 1,
      openSince: outAt ? null : inAt,
      breakMinutes: null,
      earlyCheckout: worked !== null && worked < policy.fullDayMinutes,
    };
  }

  // ─── Export ───────────────────────────────────────────────

  /** One row per person per day of the month (CSV). */
  async exportMonth(companyId: string, access: AccessContext, query: ExportQueryDto): Promise<string> {
    const scope = this.access.requireEmployeeScope(access, 'attendance.export');
    const policy = await this.policies.get(companyId);
    const keys = monthKeys(query.month);
    const [from, to] = [keys[0]!, keys[keys.length - 1]!];
    const todayKey = localDateKey(new Date(), policy.timeZone);
    const employees = await this.prisma.employee.findMany({
      where: { AND: [{ companyId, joiningDate: { lte: dateFromKey(to) } }, scope, ...(query.departmentId ? [{ departmentId: query.departmentId }] : [])] },
      select: PERSON,
      orderBy: { employeeId: 'asc' },
    });
    const [records, holidaysOf, leaves] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { companyId, employeeId: { in: employees.map((e) => e.id) }, date: { gte: dateFromKey(from), lte: dateFromKey(to) } },
        select: { ...RECORD_SELECT, employeeId: true },
      }),
      this.holidays.forPeople(companyId, employees, from, to),
      this.leavesBetween(companyId, employees.map((e) => e.id), from, to, policy),
    ]);
    const records2 = new Map(records.map((r) => [`${r.employeeId}|${keyFromDate(r.date)}`, r]));
    const time = (d: Date | null) =>
      d ? new Intl.DateTimeFormat('en-GB', { timeZone: policy.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) : '';

    const lines = [['Employee ID', 'Name', 'Department', 'Date', 'Status', 'Check in', 'Check out', 'Hours', 'Late (min)', 'Manual', 'Holiday', 'Leave'].join(',')];
    for (const e of employees) {
      for (const dateKey of keys) {
        if (dateKey > todayKey) break;
        const record: RecordRow | null = records2.get(`${e.id}|${dateKey}`) ?? null;
        const holiday = holidaysOf.get(e.id)!.get(dateKey);
        const leave = leaves.get(e.id + '|' + dateKey);
        const status = deriveDay({ dateKey, todayKey, joiningKey: keyFromDate(e.joiningDate), record, holiday: Boolean(holiday), policy, leave: this.approved(leave) });
        if (status === 'NOT_JOINED') continue;
        lines.push(
          [
            e.employeeId,
            `${e.firstName} ${e.lastName}`,
            e.department?.name ?? '',
            dateKey,
            status,
            time(record?.checkIn ?? null),
            time(record?.checkOut ?? null),
            record?.workingMinutes ? (record.workingMinutes / 60).toFixed(2) : '',
            record?.lateMinutes ?? '',
            record?.isManualEntry ? 'yes' : '',
            holiday?.name ?? '',
            leave?.status === 'APPROVED' ? leave.code + (leave.halfDay ? ' (half day)' : '') : '',
          ]
            .map(csvCell)
            .join(','),
        );
      }
    }
    return lines.join('\r\n') + '\r\n';
  }

  // ─── Month grid (people × days) ───────────────────────────

  /** Everyone in reach for a month: one status per day (Team attendance → Month grid). */
  async teamMonth(companyId: string, access: AccessContext, query: TeamMonthQueryDto) {
    const scope = this.access.requireEmployeeScope(access, 'attendance.view');
    const policy = await this.policies.get(companyId);
    const keys = monthKeys(query.month);
    const [from, to] = [keys[0]!, keys[keys.length - 1]!];
    const todayKey = localDateKey(new Date(), policy.timeZone);
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        { companyId, joiningDate: { lte: dateFromKey(to) }, OR: [{ employmentStatus: { not: EmploymentStatus.TERMINATED } }, { terminationDate: { gte: dateFromKey(from) } }] },
        scope,
        ...(query.departmentId ? [{ departmentId: query.departmentId }] : []),
        ...(query.search
          ? [{ OR: ['firstName', 'lastName', 'employeeId'].map((f) => ({ [f]: { contains: query.search, mode: 'insensitive' } })) as Prisma.EmployeeWhereInput[] }]
          : []),
      ],
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const [total, employees] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({ where, select: PERSON, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    const days = await this.statusGrid(companyId, employees, from, to, todayKey, policy);
    const holidays = await this.holidays.between(companyId, from, to);
    return {
      month: query.month,
      today: todayKey,
      days: keys,
      holidays: [...holidays.values()].filter((h) => !h.isOptional).map((h) => ({ date: keyFromDate(h.date), name: h.name })),
      data: employees.map((e) => ({ employee: e, days: days.get(e.id)! })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Statuses per person per day (with in / out / late for the details). */
  private async statusGrid(companyId: string, employees: Array<{ id: string; joiningDate: Date; locationId: string | null }>, from: string, to: string, todayKey: string, policy: CompanyPolicy) {
    const ids = employees.map((e) => e.id);
    const [records, holidaysOf, leaves] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { companyId, employeeId: { in: ids }, date: { gte: dateFromKey(from), lte: dateFromKey(to) } }, select: { ...RECORD_SELECT, employeeId: true } }),
      this.holidays.forPeople(companyId, employees, from, to),
      this.leavesBetween(companyId, ids, from, to, policy),
    ]);
    const byKey = new Map(records.map((r) => [`${r.employeeId}|${keyFromDate(r.date)}`, r]));
    const out = new Map<string, Array<{ date: string; status: DayStatus; checkIn: Date | null; checkOut: Date | null; lateMinutes: number | null; leave: string | null }>>();
    for (const e of employees) {
      const row = [];
      for (let key = from; key <= to; key = addDays(key, 1)) {
        const record = byKey.get(`${e.id}|${key}`) ?? null;
        const leave = leaves.get(`${e.id}|${key}`) ?? null;
        const status = deriveDay({ dateKey: key, todayKey, joiningKey: keyFromDate(e.joiningDate), record, holiday: holidaysOf.get(e.id)!.has(key), policy, leave: this.approved(leave) });
        row.push({ date: key, status, checkIn: record?.checkIn ?? null, checkOut: record?.checkOut ?? null, lateMinutes: record?.lateMinutes ?? null, leave: leave?.status === 'APPROVED' ? leave.name : null });
      }
      out.set(e.id, row);
    }
    return out;
  }

  /** One person's last days (for approvers judging a correction). */
  async recentDays(companyId: string, employeeId: string, toKey: string, days = 30) {
    const policy = await this.policies.get(companyId);
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true, joiningDate: true, locationId: true } });
    if (!employee) return [];
    const from = addDays(toKey, -(days - 1));
    const grid = await this.statusGrid(companyId, [employee], from, toKey, localDateKey(new Date(), policy.timeZone), policy);
    return grid.get(employee.id)!.map((d) => ({ date: d.date, status: d.status, late: (d.lateMinutes ?? 0) > 0 }));
  }

  // ─── Needs attention + nudges ─────────────────────────────

  /**
   * What a lead / manager / HR should look at today: missed check-outs
   * yesterday, absent without leave in the last week, people late often and
   * people asking for many corrections this month.
   */
  async insights(companyId: string, access: AccessContext) {
    const scope = this.access.requireEmployeeScope(access, 'attendance.view');
    const policy = await this.policies.get(companyId);
    const todayKey = localDateKey(new Date(), policy.timeZone);
    const monthStart = todayKey.slice(0, 7) + '-01';
    const weekAgo = addDays(todayKey, -7);
    const yesterday = addDays(todayKey, -1);
    const people = await this.prisma.employee.findMany({
      where: { AND: [{ companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } }, scope, { NOT: { userId: access.userId } }] },
      select: PERSON,
    });
    if (!people.length) return { missingCheckout: [], absent: [], lateOften: [], manyCorrections: [], thresholds: { late: policy.lateAlertAt ?? 3, corrections: policy.correctionAlertAt } };
    const ids = people.map((p) => p.id);
    const byId = new Map(people.map((p) => [p.id, p]));
    const lateAt = policy.lateAlertAt ?? 3;
    const [grid, late, corrections] = await Promise.all([
      this.statusGrid(companyId, people, weekAgo, yesterday, todayKey, policy),
      this.prisma.attendanceRecord.groupBy({ by: ['employeeId'], where: { companyId, employeeId: { in: ids }, lateMinutes: { gt: 0 }, date: { gte: dateFromKey(monthStart), lte: dateFromKey(todayKey) } }, _count: { _all: true } }),
      this.prisma.attendanceRegularisation.groupBy({
        by: ['employeeId'],
        where: { companyId, employeeId: { in: ids }, status: { not: 'CANCELLED' }, date: { gte: dateFromKey(monthStart), lte: dateFromKey(todayKey) } },
        _count: { _all: true },
      }),
    ]);
    const person = (id: string) => {
      const p = byId.get(id)!;
      return { id: p.id, employeeId: p.employeeId, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, designation: p.designation };
    };
    const missingCheckout = people.filter((p) => grid.get(p.id)!.some((d) => d.date === yesterday && d.status === 'MISSING_CHECKOUT')).map((p) => ({ employee: person(p.id), date: yesterday }));
    const absent = people
      .map((p) => ({ p, dates: grid.get(p.id)!.filter((d) => d.status === 'ABSENT').map((d) => d.date) }))
      .filter((x) => x.dates.length)
      .map((x) => ({ employee: person(x.p.id), dates: x.dates }));
    return {
      missingCheckout,
      absent,
      lateOften: late.filter((l) => l._count._all >= lateAt).map((l) => ({ employee: person(l.employeeId), count: l._count._all })).sort((a, b) => b.count - a.count),
      manyCorrections: corrections.filter((c) => c._count._all > policy.correctionAlertAt).map((c) => ({ employee: person(c.employeeId), count: c._count._all })).sort((a, b) => b.count - a.count),
      thresholds: { late: lateAt, corrections: policy.correctionAlertAt },
    };
  }

  /**
   * In-app reminder from a team lead, manager or HR: "please check in" or
   * "please fix your missed check-out". Only for people the caller looks after.
   */
  async nudge(companyId: string, access: AccessContext, dto: NudgeDto) {
    const policy = await this.policies.get(companyId);
    const todayKey = localDateKey(new Date(), policy.timeZone);
    const scope = this.access.employeeScope(access, 'attendance.view');
    const inScope = scope
      ? new Set((await this.prisma.employee.findMany({ where: { AND: [{ companyId, id: { in: dto.employeeIds } }, scope, { NOT: { userId: access.userId } }] }, select: { id: true } })).map((e) => e.id))
      : new Set<string>();
    const targets = await this.prisma.employee.findMany({ where: { companyId, id: { in: dto.employeeIds } }, select: { id: true, userId: true } });
    const allowed: string[] = [];
    for (const t of targets) {
      if (t.userId === access.userId) continue;
      if (inScope.has(t.id)) {
        allowed.push(t.userId);
        continue;
      }
      // Team leads / PMs reach their project members through the approval route
      const route = await this.router.route(companyId, t.id, todayKey, todayKey, 1);
      if (route.levels.some((l) => l.approverIds.includes(access.userId))) allowed.push(t.userId);
    }
    if (!allowed.length) throw new ForbiddenException('You can only remind people you look after');
    const me = access.employee ? await this.prisma.employee.findUnique({ where: { id: access.employee.id }, select: { firstName: true } }) : null;
    const from = me?.firstName ?? 'Your manager';
    const sent = await this.notifications.notify({
      companyId,
      userIds: allowed,
      type: dto.kind === 'check_in' ? 'attendance.nudge_check_in' : 'attendance.nudge_fix',
      title: dto.kind === 'check_in' ? `${from} reminded you to check in today` : `${from} asked you to fix a missed check-out`,
      body: dto.kind === 'check_in' ? 'Check in from the Home page or My attendance.' : 'Request a correction with the time you left.',
      link: '/app/attendance',
      actionLabel: dto.kind === 'check_in' ? 'Check in' : 'Fix my attendance',
      email: false,
      dedupeKey: `nudge-${dto.kind}:${todayKey}`,
    });
    return { sent, skipped: dto.employeeIds.length - allowed.length };
  }
}

/** Quotes a CSV cell and neutralises spreadsheet formulas (=, +, -, @). */
function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
