import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { AttendancePolicyService, type CompanyPolicy } from './policy.service';
import { HolidaysService } from './holidays.service';
import { deriveDay, lateMinutesFor, statusForMinutes, workedMinutes, type DayStatus } from './attendance-rules';
import { dateFromKey, keyFromDate, localDateKey, monthKeys, zonedInstant } from './time-zone';
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
} satisfies Prisma.AttendanceRecordSelect;
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
    holidays: count('HOLIDAY'),
    late: statuses.filter((d) => (d.lateMinutes ?? 0) > 0).length,
    averageMinutes: worked.length ? Math.round(worked.reduce((sum, d) => sum + (d.workingMinutes ?? 0), 0) / worked.length) : 0,
  };
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly policies: AttendancePolicyService,
    private readonly holidays: HolidaysService,
  ) {}

  // ─── Self-service: today, check in, check out ─────────────

  async today(companyId: string, access: AccessContext) {
    const policy = await this.policies.get(companyId);
    const now = new Date();
    const todayKey = localDateKey(now, policy.timeZone);
    const employee = access.employee
      ? await this.prisma.employee.findFirst({ where: { id: access.employee.id, companyId }, select: { id: true, joiningDate: true } })
      : null;
    if (!employee) return { hasProfile: false, date: todayKey, serverTime: now, policy, record: null, status: null, holiday: null };

    const [record, holidays] = await Promise.all([
      this.prisma.attendanceRecord.findUnique({ where: { companyId_employeeId_date: { companyId, employeeId: employee.id, date: dateFromKey(todayKey) } }, select: RECORD_SELECT }),
      this.holidays.between(companyId, todayKey, todayKey),
    ]);
    const holiday = holidays.get(todayKey) ?? null;
    const status = deriveDay({ dateKey: todayKey, todayKey, joiningKey: keyFromDate(employee.joiningDate), record, holiday: Boolean(holiday), policy });
    return { hasProfile: true, date: todayKey, serverTime: now, policy, record, status, holiday };
  }

  async checkIn(companyId: string, access: AccessContext, ip: string | undefined) {
    const { policy, employeeId, todayKey, existing } = await this.selfContext(companyId, access);
    if (existing?.checkIn) throw new ConflictException('You have already checked in today');
    const now = new Date();
    const data = {
      checkIn: now,
      checkOut: null,
      workingMinutes: null,
      lateMinutes: lateMinutesFor(now, policy, policy.timeZone) || null,
      status: AttendanceStatus.PRESENT,
      checkInSource: 'WEB',
      checkInIp: ip ?? null,
      isManualEntry: false,
    };
    return this.prisma.attendanceRecord.upsert({
      where: { companyId_employeeId_date: { companyId, employeeId, date: dateFromKey(todayKey) } },
      update: data,
      create: { ...data, companyId, employeeId, date: dateFromKey(todayKey) },
      select: RECORD_SELECT,
    });
  }

  async checkOut(companyId: string, access: AccessContext, ip: string | undefined) {
    const { policy, existing } = await this.selfContext(companyId, access);
    if (!existing?.checkIn) throw new BadRequestException('You have not checked in today');
    if (existing.checkOut) throw new ConflictException('You have already checked out today');
    const now = new Date();
    const worked = workedMinutes(existing.checkIn, now);
    return this.prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { checkOut: now, workingMinutes: worked, status: statusForMinutes(worked, policy), checkOutSource: 'WEB', checkOutIp: ip ?? null },
      select: RECORD_SELECT,
    });
  }

  private async selfContext(companyId: string, access: AccessContext) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile, so attendance cannot be recorded');
    const policy = await this.policies.get(companyId);
    if (!policy.webCheckInEnabled) throw new ForbiddenException('Web check-in is turned off for your company');
    const employee = await this.prisma.employee.findFirst({ where: { id: access.employee.id, companyId }, select: { id: true, employmentStatus: true } });
    if (!employee || employee.employmentStatus === EmploymentStatus.TERMINATED) throw new ForbiddenException('Attendance cannot be recorded for this profile');
    const todayKey = localDateKey(new Date(), policy.timeZone);
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { companyId_employeeId_date: { companyId, employeeId: employee.id, date: dateFromKey(todayKey) } },
    });
    return { policy, employeeId: employee.id, todayKey, existing };
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

    const [employee, records, holidays, corrections] = await Promise.all([
      this.prisma.employee.findUniqueOrThrow({ where: { id: targetId }, select: PERSON }),
      this.prisma.attendanceRecord.findMany({ where: { companyId, employeeId: targetId, date: { gte: dateFromKey(from), lte: dateFromKey(to) } }, select: RECORD_SELECT }),
      this.holidays.between(companyId, from, to),
      this.prisma.attendanceRegularisation.findMany({
        where: { companyId, employeeId: targetId, date: { gte: dateFromKey(from), lte: dateFromKey(to) }, status: { in: ['PENDING', 'REJECTED', 'APPROVED'] } },
        select: { id: true, date: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const byDate = new Map(records.map((r) => [keyFromDate(r.date), r]));
    // Latest request per day wins
    const correctionByDate = new Map(corrections.map((c) => [keyFromDate(c.date), { id: c.id, status: c.status }]));
    const joiningKey = keyFromDate(employee.joiningDate);

    const days = keys.map((dateKey) => {
      const record = byDate.get(dateKey) ?? null;
      const holiday = holidays.get(dateKey) ?? null;
      return {
        date: dateKey,
        status: deriveDay({ dateKey, todayKey, joiningKey, record, holiday: Boolean(holiday), policy }),
        checkIn: record?.checkIn ?? null,
        checkOut: record?.checkOut ?? null,
        workingMinutes: record?.workingMinutes ?? null,
        lateMinutes: record?.lateMinutes ?? null,
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
    const [records, holidays] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { companyId, date, employeeId: { in: employees.map((e) => e.id) } }, select: { ...RECORD_SELECT, employeeId: true } }),
      this.holidays.between(companyId, dateKey, dateKey),
    ]);
    const byEmployee = new Map(records.map((r) => [r.employeeId, r]));
    const holiday = holidays.get(dateKey) ?? null;

    const rows = employees.map((e) => {
      const record = byEmployee.get(e.id) ?? null;
      return {
        employee: e,
        status: deriveDay({ dateKey, todayKey, joiningKey: keyFromDate(e.joiningDate), record, holiday: Boolean(holiday), policy }),
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
    const [records, holidays] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { companyId, employeeId: { in: employees.map((e) => e.id) }, date: { gte: dateFromKey(from), lte: dateFromKey(to) } },
        select: { ...RECORD_SELECT, employeeId: true },
      }),
      this.holidays.between(companyId, from, to),
    ]);
    const records2 = new Map(records.map((r) => [`${r.employeeId}|${keyFromDate(r.date)}`, r]));
    const time = (d: Date | null) =>
      d ? new Intl.DateTimeFormat('en-GB', { timeZone: policy.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) : '';

    const lines = [['Employee ID', 'Name', 'Department', 'Date', 'Status', 'Check in', 'Check out', 'Hours', 'Late (min)', 'Manual', 'Holiday'].join(',')];
    for (const e of employees) {
      for (const dateKey of keys) {
        if (dateKey > todayKey) break;
        const record: RecordRow | null = records2.get(`${e.id}|${dateKey}`) ?? null;
        const holiday = holidays.get(dateKey);
        const status = deriveDay({ dateKey, todayKey, joiningKey: keyFromDate(e.joiningDate), record, holiday: Boolean(holiday), policy });
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
