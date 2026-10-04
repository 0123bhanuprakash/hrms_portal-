import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, EmploymentStatus, LeaveStatus, Prisma, ProjectStatus, TimesheetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { holds, type AccessContext } from '../access/access.types';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import type { MonthQueryDto, RangeQueryDto } from './dto';

const VIEW = 'report.view';
const EXPORT = 'report.export';
const PMO = 'project.manage';
const DAY_HOURS = 8;
const PRESENTISH: AttendanceStatus[] = [AttendanceStatus.PRESENT, AttendanceStatus.WORK_FROM_HOME, AttendanceStatus.HALF_DAY];

/** CSV cell */
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s;
};
const csv = (rows: unknown[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');

/**
 * Role-based analytics. Every number is computed in the database and limited
 * to the people the caller may see:
 *   People, Attendance & leave — report.view (HR: company, managers: their tree)
 *   Utilisation — PMO (project.manage: company) or report.view scope
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // ─── People ────────────────────────────────────────────────

  async people(companyId: string, access: AccessContext) {
    const scope = this.access.requireEmployeeScope(access, VIEW);
    const today = await this.todayKey(companyId);
    const now = dateFromKey(today);

    // One read of everyone in scope (incl. leavers, for the trend); every number below is computed from it
    const [rows, depts, locs, desigs] = await Promise.all([
      this.prisma.employee.findMany({
        where: { AND: [scope, { companyId }] },
        select: {
          id: true, firstName: true, lastName: true, avatarUrl: true, joiningDate: true, confirmationDate: true, terminationDate: true,
          employmentStatus: true, employmentType: true, gender: true, departmentId: true, locationId: true, designationId: true,
        },
      }),
      this.prisma.department.findMany({ where: { companyId }, select: { id: true, name: true } }),
      this.prisma.officeLocation.findMany({ where: { companyId }, select: { id: true, name: true } }),
      this.prisma.designation.findMany({ where: { companyId }, select: { id: true, orgLevel: { select: { id: true, name: true, rank: true } } } }),
    ]);
    type Row = (typeof rows)[number];
    const t = (d: Date | null) => (d ? d.getTime() : null);
    const nowT = now.getTime();
    const left = (e: Row) => e.employmentStatus === EmploymentStatus.TERMINATED;
    /** On the payroll on a date: joined by then, and not yet left. */
    const employedOn = (e: Row, at: number) => e.joiningDate.getTime() <= at && (!left(e) || (t(e.terminationDate) ?? -Infinity) > at);
    const current = rows.filter((e) => !left(e) && e.joiningDate.getTime() <= nowT);
    const headcount = current.length;

    const countBy = <K extends string | null>(key: (e: Row) => K) => {
      const m = new Map<K, number>();
      for (const e of current) m.set(key(e), (m.get(key(e)) ?? 0) + 1);
      return [...m];
    };
    const name = (list: Array<{ id: string; name: string }>, id: string | null) => (id ? list.find((x) => x.id === id)?.name ?? 'Unknown' : 'Not set');
    const sorted = <T extends { count: number }>(r: T[]) => r.sort((a, b) => b.count - a.count);

    const levels = new Map<string, { name: string; rank: number; count: number }>();
    for (const [designationId, count] of countBy((e) => e.designationId)) {
      const lvl = desigs.find((d) => d.id === designationId)?.orgLevel;
      const key = lvl?.id ?? '-';
      const cur = levels.get(key) ?? { name: lvl?.name ?? 'No level', rank: lvl?.rank ?? -1, count: 0 };
      cur.count += count;
      levels.set(key, cur);
    }

    // Tenure: joined at least minY and less than maxY years ago
    const tenure = ([[0, 1], [1, 3], [3, 5], [5, null]] as const).map(([minY, maxY]) => {
      const upper = dateFromKey(this.yearsAgo(today, minY)).getTime();
      const lower = maxY === null ? null : dateFromKey(this.yearsAgo(today, maxY)).getTime();
      return current.filter((e) => e.joiningDate.getTime() <= upper && (lower === null || e.joiningDate.getTime() > lower)).length;
    });

    // Joiners, leavers and month-end headcount for the last 12 months
    const thisMonth = today.slice(0, 7);
    const months = Array.from({ length: 12 }, (_, i) => this.addMonths(thisMonth, i - 11));
    const trend = months.map((m) => {
      const start = dateFromKey(`${m}-01`).getTime();
      const end = dateFromKey(this.monthEnd(m)).getTime();
      const at = Math.min(end, nowT);
      return {
        month: m,
        joiners: rows.filter((e) => e.joiningDate.getTime() >= start && e.joiningDate.getTime() <= end).length,
        leavers: rows.filter((e) => left(e) && (t(e.terminationDate) ?? -1) >= start && (t(e.terminationDate) ?? Infinity) <= end).length,
        headcount: rows.filter((e) => employedOn(e, at)).length,
      };
    });
    const before = dateFromKey(addDays(`${months[0]}-01`, -1)).getTime();
    const startCount = rows.filter((e) => employedOn(e, before)).length;
    const leavers12 = trend.reduce((n, x) => n + x.leavers, 0);
    const avg = (startCount + headcount) / 2;

    const byKey = (a: Date | null, b: Date | null) => (a ? a.getTime() : Infinity) - (b ? b.getTime() : Infinity);
    const probation = current
      .filter((e) => e.employmentStatus === EmploymentStatus.PROBATION)
      .sort((a, b) => byKey(a.confirmationDate, b.confirmationDate) || a.joiningDate.getTime() - b.joiningDate.getTime())
      .slice(0, 10);
    const notice = current
      .filter((e) => e.employmentStatus === EmploymentStatus.NOTICE_PERIOD)
      .sort((a, b) => byKey(a.terminationDate, b.terminationDate))
      .slice(0, 10);
    const person = (e: Row) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, avatarUrl: e.avatarUrl });
    // Who joined or left in the last 12 months (newest first) — for the faces timeline
    const windowStart = dateFromKey(`${months[0]}-01`).getTime();
    const movements = [
      ...rows.filter((e) => e.joiningDate.getTime() >= windowStart && e.joiningDate.getTime() <= nowT).map((e) => ({ ...person(e), kind: 'joined' as const, date: keyFromDate(e.joiningDate) })),
      ...rows.filter((e) => left(e) && e.terminationDate && e.terminationDate.getTime() >= windowStart && e.terminationDate.getTime() <= nowT).map((e) => ({ ...person(e), kind: 'left' as const, date: keyFromDate(e.terminationDate!) })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);
    const avgTenureMonths = headcount ? Math.round(current.reduce((n, e) => n + (nowT - e.joiningDate.getTime()), 0) / headcount / (30.44 * 86_400_000)) : 0;

    return {
      asOf: today,
      headcount,
      upcomingJoiners: rows.filter((e) => !left(e) && e.joiningDate.getTime() > nowT).length,
      attritionPct: avg ? Math.round((leavers12 / avg) * 1000) / 10 : 0,
      leavers12,
      joiners12: trend.reduce((n, x) => n + x.joiners, 0),
      /** Headcount just before the 12-month window (start of the bridge) */
      startHeadcount: startCount,
      avgTenureMonths,
      movements,
      byDepartment: sorted(countBy((e) => e.departmentId).map(([id, count]) => ({ label: name(depts, id), count }))),
      byLocation: sorted(countBy((e) => e.locationId).map(([id, count]) => ({ label: name(locs, id), count }))),
      byType: sorted(countBy((e) => e.employmentType).map(([label, count]) => ({ label, count }))),
      byStatus: sorted(countBy((e) => e.employmentStatus).map(([label, count]) => ({ label, count }))),
      byGender: sorted(countBy((e) => e.gender ?? 'NOT_SET').map(([label, count]) => ({ label, count }))),
      byLevel: [...levels.values()].sort((a, b) => b.rank - a.rank).map(({ name: label, count }) => ({ label, count })),
      tenure: [
        { label: 'Under 1 year', count: tenure[0]! },
        { label: '1–3 years', count: tenure[1]! },
        { label: '3–5 years', count: tenure[2]! },
        { label: '5+ years', count: tenure[3]! },
      ],
      trend,
      probation: probation.map((e) => ({ ...person(e), joiningDate: keyFromDate(e.joiningDate), confirmationDate: e.confirmationDate ? keyFromDate(e.confirmationDate) : null })),
      notice: notice.map((e) => ({ ...person(e), terminationDate: e.terminationDate ? keyFromDate(e.terminationDate) : null })),
    };
  }

  /** Employee roster CSV (report.export). */
  async peopleCsv(companyId: string, access: AccessContext) {
    const scope = this.access.requireEmployeeScope(access, EXPORT);
    const today = await this.todayKey(companyId);
    const rows = await this.prisma.employee.findMany({
      where: { AND: [scope, { companyId }] },
      select: {
        employeeId: true, firstName: true, lastName: true, email: true, employmentType: true, employmentStatus: true, joiningDate: true, confirmationDate: true, terminationDate: true, gender: true,
        department: { select: { name: true } }, designation: { select: { name: true } }, location: { select: { name: true } },
        reportingManager: { select: { firstName: true, lastName: true, employeeId: true } },
      },
      orderBy: [{ employmentStatus: 'asc' }, { firstName: 'asc' }],
    });
    const years = (from: Date) => Math.max(0, Math.round(((dateFromKey(today).getTime() - from.getTime()) / (365.25 * 86400_000)) * 10) / 10);
    return csv([
      ['Employee ID', 'First name', 'Last name', 'Email', 'Department', 'Designation', 'Location', 'Reports to', 'Type', 'Status', 'Gender', 'Joined', 'Confirmed', 'Left', 'Tenure (years)'],
      ...rows.map((e) => [
        e.employeeId, e.firstName, e.lastName, e.email, e.department?.name, e.designation?.name, e.location?.name,
        e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName} (${e.reportingManager.employeeId})` : '',
        e.employmentType, e.employmentStatus, e.gender ?? '', keyFromDate(e.joiningDate), e.confirmationDate ? keyFromDate(e.confirmationDate) : '', e.terminationDate ? keyFromDate(e.terminationDate) : '',
        years(e.joiningDate),
      ]),
    ]);
  }

  // ─── Attendance & leave ───────────────────────────────────

  async attendance(companyId: string, access: AccessContext, q: MonthQueryDto) {
    const scope = this.access.requireEmployeeScope(access, VIEW);
    const today = await this.todayKey(companyId);
    const month = q.month ?? today.slice(0, 7);
    if (month > today.slice(0, 7)) throw new BadRequestException('Pick this month or an earlier one');
    const fromKey = `${month}-01`;
    const toKey = this.monthEnd(month) < today ? this.monthEnd(month) : today;
    const from = dateFromKey(fromKey);
    const to = dateFromKey(toKey);
    const inScope: Prisma.AttendanceRecordWhereInput = { companyId, date: { gte: from, lte: to }, employee: scope };

    const holidays = await this.prisma.publicHoliday.findMany({ where: { companyId, isOptional: false, date: { gte: from, lte: to } }, select: { date: true } });
    const holidayKeys = new Set(holidays.map((h) => keyFromDate(h.date)));
    const workdays: string[] = [];
    for (let d = fromKey; d <= toKey; d = addDays(d, 1)) {
      const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (wd !== 0 && wd !== 6 && !holidayKeys.has(d)) workdays.push(d);
    }

    const leaveWhere: Prisma.LeaveRequestWhereInput = { companyId, status: LeaveStatus.APPROVED, startDate: { lte: to }, endDate: { gte: from }, employee: scope };
    const [headcount, byStatus, late, worked, daily, topLate, leaveByType, topLeave, types] = await Promise.all([
      this.prisma.employee.count({ where: { AND: [scope, this.employedOn(companyId, to)] } }),
      this.prisma.attendanceRecord.groupBy({ by: ['status'], where: inScope, _count: { _all: true } }),
      this.prisma.attendanceRecord.aggregate({ where: { ...inScope, lateMinutes: { gt: 0 } }, _count: { _all: true }, _avg: { lateMinutes: true } }),
      this.prisma.attendanceRecord.aggregate({ where: { ...inScope, workingMinutes: { gt: 0 } }, _avg: { workingMinutes: true }, _count: { _all: true } }),
      this.prisma.attendanceRecord.groupBy({ by: ['date', 'status'], where: inScope, _count: { _all: true } }),
      this.prisma.attendanceRecord.groupBy({ by: ['employeeId'], where: { ...inScope, lateMinutes: { gt: 0 } }, _count: { _all: true }, _sum: { lateMinutes: true }, orderBy: { _count: { employeeId: 'desc' } }, take: 5 }),
      this.prisma.leaveRequest.groupBy({ by: ['leaveTypeId'], where: leaveWhere, _sum: { totalDays: true }, _count: { _all: true } }),
      this.prisma.leaveRequest.groupBy({ by: ['employeeId'], where: leaveWhere, _sum: { totalDays: true }, orderBy: { _sum: { totalDays: 'desc' } }, take: 5 }),
      this.prisma.leaveType.findMany({ where: { companyId }, select: { id: true, name: true, code: true } }),
    ]);
    const names = await this.names([...topLate.map((r) => r.employeeId), ...topLeave.map((r) => r.employeeId)]);

    const status = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Partial<Record<AttendanceStatus, number>>;
    const present = PRESENTISH.reduce((n, s) => n + (status[s] ?? 0), 0);
    const expected = headcount * workdays.length;
    const days = new Map<string, { date: string; present: number; leave: number; absent: number }>();
    for (const d of daily) {
      const k = keyFromDate(d.date);
      const row = days.get(k) ?? { date: k, present: 0, leave: 0, absent: 0 };
      if (PRESENTISH.includes(d.status)) row.present += d._count._all;
      else if (d.status === AttendanceStatus.ON_LEAVE) row.leave += d._count._all;
      else if (d.status === AttendanceStatus.ABSENT) row.absent += d._count._all;
      days.set(k, row);
    }
    return {
      month,
      from: fromKey,
      to: toKey,
      headcount,
      workingDays: workdays.length,
      attendanceRatePct: expected ? Math.round((present / expected) * 1000) / 10 : null,
      byStatus: status,
      wfhDays: status.WORK_FROM_HOME ?? 0,
      lateArrivals: late._count._all,
      avgLateMinutes: late._avg.lateMinutes ? Math.round(late._avg.lateMinutes) : 0,
      avgWorkingMinutes: worked._avg.workingMinutes ? Math.round(worked._avg.workingMinutes) : 0,
      daily: workdays.map((d) => days.get(d) ?? { date: d, present: 0, leave: 0, absent: 0 }),
      topLate: topLate.map((r) => ({ employee: names.get(r.employeeId) ?? null, count: r._count._all, minutes: r._sum.lateMinutes ?? 0 })),
      leaveByType: leaveByType
        .map((r) => ({ type: types.find((t) => t.id === r.leaveTypeId) ?? { id: r.leaveTypeId, name: 'Unknown', code: '?' }, days: r._sum.totalDays ?? 0, requests: r._count._all }))
        .sort((a, b) => b.days - a.days),
      topLeave: topLeave.map((r) => ({ employee: names.get(r.employeeId) ?? null, days: r._sum.totalDays ?? 0 })),
    };
  }

  // ─── Utilisation (PMO) ────────────────────────────────────

  async utilisation(companyId: string, access: AccessContext, q: RangeQueryDto) {
    const { scope, range } = await this.utilisationContext(companyId, access, q);
    const { from, to, asOf, workdays } = range;
    const people = await this.prisma.employee.findMany({
      where: { AND: [scope, this.employedOn(companyId, dateFromKey(asOf))] },
      select: { id: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, joiningDate: true, department: { select: { name: true } }, designation: { select: { name: true } } },
      orderBy: { firstName: 'asc' },
    });
    const ids = people.map((p) => p.id);
    const live = { status: { in: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD] } };
    const asOfDate = dateFromKey(asOf);
    const timesheetsOn = access.features.has('work.timesheets');
    const entryWhere: Prisma.TimesheetEntryWhereInput = {
      companyId,
      employeeId: { in: ids },
      date: { gte: dateFromKey(from), lte: dateFromKey(to) },
      minutes: { gt: 0 },
      timesheet: { status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED] } },
    };
    const [members, byPerson, byProject] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { companyId, employeeId: { in: ids }, startDate: { lte: asOfDate }, OR: [{ endDate: null }, { endDate: { gte: asOfDate } }], project: live },
        select: { employeeId: true, allocation: true, role: true, project: { select: { id: true, code: true, name: true, clientName: true, status: true } } },
      }),
      timesheetsOn ? this.prisma.timesheetEntry.groupBy({ by: ['employeeId', 'billable'], where: entryWhere, _sum: { minutes: true } }) : [],
      timesheetsOn ? this.prisma.timesheetEntry.groupBy({ by: ['projectId', 'billable'], where: entryWhere, _sum: { minutes: true } }) : [],
    ]);

    const capacity = workdays.length * DAY_HOURS * 60;
    const logged = new Map<string, { minutes: number; billable: number }>();
    for (const r of byPerson) {
      const cur = logged.get(r.employeeId) ?? { minutes: 0, billable: 0 };
      cur.minutes += r._sum.minutes ?? 0;
      if (r.billable) cur.billable += r._sum.minutes ?? 0;
      logged.set(r.employeeId, cur);
    }
    const rows = people.map((p) => {
      const mine = members.filter((m) => m.employeeId === p.id);
      const allocation = mine.reduce((n, m) => n + m.allocation, 0);
      const l = logged.get(p.id) ?? { minutes: 0, billable: 0 };
      return {
        employee: { id: p.id, employeeId: p.employeeId, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, department: p.department?.name ?? null, designation: p.designation?.name ?? null },
        allocation,
        projects: mine.map((m) => ({ id: m.project.id, code: m.project.code, name: m.project.name, allocation: m.allocation, role: m.role })),
        loggedMinutes: timesheetsOn ? l.minutes : null,
        billableMinutes: timesheetsOn ? l.billable : null,
        utilisationPct: timesheetsOn && capacity ? Math.round((l.minutes / capacity) * 100) : null,
        billablePct: timesheetsOn && capacity ? Math.round((l.billable / capacity) * 100) : null,
      };
    });

    const projects = new Map<string, { project: { id: string; code: string; name: string; clientName: string | null; status: string }; members: number; fte: number; loggedMinutes: number; billableMinutes: number }>();
    for (const m of members) {
      const cur = projects.get(m.project.id) ?? { project: m.project, members: 0, fte: 0, loggedMinutes: 0, billableMinutes: 0 };
      cur.members++;
      cur.fte += m.allocation / 100;
      projects.set(m.project.id, cur);
    }
    let internal = 0;
    if (byProject.length) {
      const known = await this.prisma.project.findMany({ where: { id: { in: byProject.map((r) => r.projectId).filter((x): x is string => Boolean(x)) } }, select: { id: true, code: true, name: true, clientName: true, status: true } });
      for (const r of byProject) {
        if (!r.projectId) {
          internal += r._sum.minutes ?? 0;
          continue;
        }
        const p = known.find((k) => k.id === r.projectId);
        if (!p) continue;
        const cur = projects.get(p.id) ?? { project: p, members: 0, fte: 0, loggedMinutes: 0, billableMinutes: 0 };
        cur.loggedMinutes += r._sum.minutes ?? 0;
        if (r.billable) cur.billableMinutes += r._sum.minutes ?? 0;
        projects.set(p.id, cur);
      }
    }

    const totalLogged = rows.reduce((n, r) => n + (r.loggedMinutes ?? 0), 0);
    const totalBillable = rows.reduce((n, r) => n + (r.billableMinutes ?? 0), 0);
    return {
      from,
      to,
      asOf,
      workingDays: workdays.length,
      hoursPerDay: DAY_HOURS,
      timesheets: timesheetsOn,
      people: rows.length,
      bench: rows.filter((r) => r.allocation === 0).length,
      partial: rows.filter((r) => r.allocation > 0 && r.allocation < 100).length,
      full: rows.filter((r) => r.allocation >= 100).length,
      avgAllocationPct: rows.length ? Math.round(rows.reduce((n, r) => n + Math.min(r.allocation, 100), 0) / rows.length) : 0,
      utilisationPct: timesheetsOn && rows.length && capacity ? Math.round((totalLogged / (capacity * rows.length)) * 100) : null,
      billablePct: timesheetsOn && rows.length && capacity ? Math.round((totalBillable / (capacity * rows.length)) * 100) : null,
      internalMinutes: timesheetsOn ? internal : null,
      rows: rows.sort((a, b) => a.allocation - b.allocation || a.employee.firstName.localeCompare(b.employee.firstName)),
      projects: [...projects.values()].map((p) => ({ ...p, fte: Math.round(p.fte * 100) / 100 })).sort((a, b) => b.fte - a.fte),
    };
  }

  async utilisationCsv(companyId: string, access: AccessContext, q: RangeQueryDto) {
    if (!holds(access, PMO) && !holds(access, EXPORT)) throw new ForbiddenException('You do not have permission to perform this action. Required: report.export');
    const r = await this.utilisation(companyId, access, q);
    return {
      name: `utilisation-${r.from}-to-${r.to}.csv`,
      body: csv([
        ['Employee ID', 'Name', 'Department', 'Designation', 'Allocation %', 'Projects', ...(r.timesheets ? ['Logged hours', 'Billable hours', 'Utilisation %', 'Billable %'] : [])],
        ...r.rows.map((x) => [
          x.employee.employeeId, `${x.employee.firstName} ${x.employee.lastName}`, x.employee.department, x.employee.designation, x.allocation,
          x.projects.map((p) => `${p.name} ${p.allocation}%`).join('; '),
          ...(r.timesheets ? [Math.round(((x.loggedMinutes ?? 0) / 60) * 100) / 100, Math.round(((x.billableMinutes ?? 0) / 60) * 100) / 100, x.utilisationPct, x.billablePct] : []),
        ]),
      ]),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async utilisationContext(companyId: string, access: AccessContext, q: RangeQueryDto) {
    if (!access.features.has('work.projects')) throw new ForbiddenException('Projects are not enabled for your company');
    const scope: Prisma.EmployeeWhereInput = holds(access, PMO) ? {} : this.access.requireEmployeeScope(access, VIEW);
    const today = await this.todayKey(companyId);
    const to = q.to ?? addDays(today, -1);
    const from = q.from ?? addDays(to, -27);
    if (from > to) throw new BadRequestException('“From” must be before “to”');
    if (to > addDays(from, 366)) throw new BadRequestException('Pick at most a year');
    const holidays = await this.prisma.publicHoliday.findMany({ where: { companyId, isOptional: false, date: { gte: dateFromKey(from), lte: dateFromKey(to) } }, select: { date: true } });
    const hk = new Set(holidays.map((h) => keyFromDate(h.date)));
    const workdays: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (wd !== 0 && wd !== 6 && !hk.has(d)) workdays.push(d);
    }
    return { scope, range: { from, to, asOf: to < today ? to : today, workdays } };
  }

  /** On the payroll on a date: joined by then, and not yet left. */
  private employedOn(companyId: string, date: Date): Prisma.EmployeeWhereInput {
    return {
      companyId,
      joiningDate: { lte: date },
      OR: [{ employmentStatus: { not: EmploymentStatus.TERMINATED } }, { terminationDate: { gt: date } }],
    };
  }

  private async names(ids: string[]) {
    const rows = await this.prisma.employee.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true } });
    return new Map(rows.map((r) => [r.id, r]));
  }

  private yearsAgo(key: string, years: number) {
    return `${Number(key.slice(0, 4)) - years}${key.slice(4)}`;
  }

  private addMonths(ym: string, n: number) {
    const d = new Date(`${ym}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 7);
  }

  private monthEnd(ym: string) {
    return addDays(`${this.addMonths(ym, 1)}-01`, -1);
  }

  async todayKey(companyId: string): Promise<string> {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }
}
