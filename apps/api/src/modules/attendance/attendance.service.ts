import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { AttendancePolicyService, type CompanyPolicy } from './policy.service';
import { HolidaysService } from './holidays.service';
import { deriveDay, lateMinutesFor, statusForMinutes, workedMinutes, type DayStatus } from './attendance-rules';
import { addDays, dateFromKey, keyFromDate, localDateKey, monthKeys, weekdayOfKey, zonedInstant } from './time-zone';

const addDaysDate = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
import type { CalendarQueryDto, ExportQueryDto, TeamQueryDto, UpsertRecordDto } from './dto';

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
  ) {}

  /**
   * Approved + pending leave per "employeeId|date" between two dates.
   * Only days the leave actually covers (weekly offs / holidays are skipped
   * unless the leave type counts them).
   */
  async leavesBetween(companyId: string, employeeIds: string[], fromKey: string, toKey: string, policy: CompanyPolicy): Promise<Map<string, DayLeaveInfo>> {
    const map = new Map<string, DayLeaveInfo>();
    if (!employeeIds.length) return map;
    const [rows, holidays] = await Promise.all([
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
      this.holidays.between(companyId, fromKey, toKey),
    ]);
    for (const l of rows) {
      const start = keyFromDate(l.startDate) < fromKey ? fromKey : keyFromDate(l.startDate);
      const end = keyFromDate(l.endDate) > toKey ? toKey : keyFromDate(l.endDate);
      for (let key = start; key <= end; key = addDays(key, 1)) {
        const holiday = holidays.get(key);
        const off = !policy.workDays.includes(weekdayOfKey(key)) || Boolean(holiday && !holiday.isOptional);
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
      ? await this.prisma.employee.findFirst({ where: { id: access.employee.id, companyId }, select: { id: true, joiningDate: true } })
      : null;
    if (!employee) return { hasProfile: false, date: todayKey, serverTime: now, policy, record: null, status: null, holiday: null, leave: null };

    const [record, holidays, leaves, punches, nightShift] = await Promise.all([
      this.prisma.attendanceRecord.findUnique({ where: { companyId_employeeId_date: { companyId, employeeId: employee.id, date: dateFromKey(todayKey) } }, select: RECORD_SELECT }),
      this.holidays.between(companyId, todayKey, todayKey),
      this.leavesBetween(companyId, [employee.id], todayKey, todayKey, policy),
      this.prisma.attendancePunch.findMany({ where: { companyId, employeeId: employee.id, date: dateFromKey(todayKey) }, select: PUNCH_SELECT, orderBy: { at: 'asc' } }),
      this.nightShiftAllowed(companyId, employee.id, todayKey),
    ]);
    // A night shift still running from yesterday
    const carried = nightShift ? await this.openNightShift(companyId, employee.id, todayKey, now) : null;
    const holiday = holidays.get(todayKey) ?? null;
    const leave = leaves.get(employee.id + '|' + todayKey) ?? null;
    const status = deriveDay({ dateKey: todayKey, todayKey, joiningKey: keyFromDate(employee.joiningDate), record, holiday: Boolean(holiday), policy, leave: this.approved(leave) });
    return { hasProfile: true, date: todayKey, serverTime: now, policy, record, status, holiday, leave, punches, nightShift, carriedOver: carried ? { date: keyFromDate(carried.date), openSince: carried.openSince } : null };
  }

  /**
   * Check in. The first check-in of the day sets the day's start (and lateness);
   * after a check-out you can check in again — each check-in starts a new session.
   */
  async checkIn(companyId: string, access: AccessContext, ip: string | undefined) {
    const { policy, employeeId, todayKey, existing, carried } = await this.selfContext(companyId, access);
    if (carried) throw new ConflictException('You are still checked in from your night shift — check out first');
    if (existing?.openSince) throw new ConflictException('You are already checked in');
    const now = new Date();
    const date = dateFromKey(todayKey);
    return this.prisma.$transaction(async (tx) => {
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
    });
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

    const [employee, records, holidays, corrections, leaves] = await Promise.all([
      this.prisma.employee.findUniqueOrThrow({ where: { id: targetId }, select: PERSON }),
      this.prisma.attendanceRecord.findMany({ where: { companyId, employeeId: targetId, date: { gte: dateFromKey(from), lte: dateFromKey(to) } }, select: RECORD_SELECT }),
      this.holidays.between(companyId, from, to),
      this.prisma.attendanceRegularisation.findMany({
        where: { companyId, employeeId: targetId, date: { gte: dateFromKey(from), lte: dateFromKey(to) }, status: { in: ['PENDING', 'REJECTED', 'APPROVED'] } },
        select: { id: true, date: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.leavesBetween(companyId, [targetId], from, to, policy),
    ]);
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
        isManualEntry: record?.isManualEntry ?? false,
        notes: record?.notes ?? null,
        holiday: holiday ? { name: holiday.name, isOptional: holiday.isOptional } : null,
        correction: correctionByDate.get(dateKey) ?? null,
      };
    });
    return { employee, month: query.month, today: todayKey, policy, days, summary: summarise(days) };
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
    const [records, holidays, leaves] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { companyId, date, employeeId: { in: employees.map((e) => e.id) } }, select: { ...RECORD_SELECT, employeeId: true } }),
      this.holidays.between(companyId, dateKey, dateKey),
      this.leavesBetween(companyId, employees.map((e) => e.id), dateKey, dateKey, policy),
    ]);
    const byEmployee = new Map(records.map((r) => [r.employeeId, r]));
    const holiday = holidays.get(dateKey) ?? null;

    const rows = employees.map((e) => {
      const record = byEmployee.get(e.id) ?? null;
      const leave = leaves.get(e.id + '|' + dateKey) ?? null;
      return {
        employee: e,
        status: deriveDay({ dateKey, todayKey, joiningKey: keyFromDate(e.joiningDate), record, holiday: Boolean(holiday), policy, leave: this.approved(leave) }),
        leave,
        checkIn: record?.checkIn ?? null,
        checkOut: record?.checkOut ?? null,
        workingMinutes: record?.workingMinutes ?? null,
        lateMinutes: record?.lateMinutes ?? null,
        isManualEntry: record?.isManualEntry ?? false,
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

    const data = dto.checkIn
      ? { ...this.timesFor(policy, dto.date, dto.checkIn, dto.checkOut ?? null), checkInSource: 'ADMIN', checkOutSource: dto.checkOut ? 'ADMIN' : null }
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
  timesFor(policy: CompanyPolicy, dateKey: string, checkIn: string, checkOut: string | null) {
    const inAt = zonedInstant(dateKey, checkIn, policy.timeZone);
    const outAt = checkOut ? zonedInstant(dateKey, checkOut, policy.timeZone) : null;
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
    const [records, holidays, leaves] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { companyId, employeeId: { in: employees.map((e) => e.id) }, date: { gte: dateFromKey(from), lte: dateFromKey(to) } },
        select: { ...RECORD_SELECT, employeeId: true },
      }),
      this.holidays.between(companyId, from, to),
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
        const holiday = holidays.get(dateKey);
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
}

/** Quotes a CSV cell and neutralises spreadsheet formulas (=, +, -, @). */
function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
