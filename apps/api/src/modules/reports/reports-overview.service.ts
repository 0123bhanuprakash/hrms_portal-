import { BadRequestException, Injectable } from '@nestjs/common';
import { AttendanceStatus, EmploymentStatus, LeaveStatus, Prisma, TimesheetStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { addDays, dateFromKey, keyFromDate } from '../attendance/time-zone';
import { ReportsService } from './reports.service';
import type { RangeQueryDto } from './dto';

const VIEW = 'report.view';
const DAY_HOURS = 8;
const PRESENTISH: AttendanceStatus[] = [AttendanceStatus.PRESENT, AttendanceStatus.WORK_FROM_HOME, AttendanceStatus.HALF_DAY];
const WEEKDAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays'];

export interface Highlight {
  key: string;
  tone: 'good' | 'bad' | 'warn' | 'info';
  icon: 'up' | 'down' | 'leave' | 'people' | 'clock';
  title: string;
  detail: string;
  /** Which report tab explains it */
  tab: 'people' | 'attendance' | 'utilisation';
}

/**
 * Reports → Overview: the headline numbers for a period next to the same
 * length just before, a short monthly trend for each, the headcount bridge,
 * and a few plain-language findings ("What changed").
 */
@Injectable()
export class ReportsOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly reports: ReportsService,
  ) {}

  async overview(companyId: string, access: AccessContext, q: RangeQueryDto) {
    const scope = this.reports.narrow(this.access.requireEmployeeScope(access, VIEW), q);
    const today = await this.reports.todayKey(companyId);
    const fromKey = q.from ?? `${today.slice(0, 7)}-01`;
    const toKey = q.to && q.to < today ? q.to : today;
    if (fromKey > toKey) throw new BadRequestException('“From” must be before “to”');
    if (toKey > addDays(fromKey, 366)) throw new BadRequestException('Pick at most a year');
    const span = Math.round((dateFromKey(toKey).getTime() - dateFromKey(fromKey).getTime()) / 86_400_000);
    const prevTo = addDays(fromKey, -1);
    const prevFrom = addDays(prevTo, -span);
    const billableOn = access.features.has('work.projects') && access.features.has('work.timesheets');

    // Everyone in scope once (incl. leavers) — headcount, bridge, attrition
    const rows = await this.prisma.employee.findMany({
      where: { AND: [scope, { companyId }] },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, joiningDate: true, terminationDate: true, employmentStatus: true, confirmationDate: true, departmentId: true },
    });
    const left = (e: (typeof rows)[number]) => e.employmentStatus === EmploymentStatus.TERMINATED;
    const employedOn = (k: string) => {
      const at = dateFromKey(k).getTime();
      return rows.filter((e) => e.joiningDate.getTime() <= at && (!left(e) || (e.terminationDate?.getTime() ?? -Infinity) > at)).length;
    };
    const inRange = (d: Date | null, a: string, b: string) => Boolean(d) && keyFromDate(d!) >= a && keyFromDate(d!) <= b;
    const person = (e: (typeof rows)[number]) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, avatarUrl: e.avatarUrl });
    const attrition = (endKey: string) => {
      const startKey = addDays(endKey, -365);
      const leavers = rows.filter((e) => left(e) && inRange(e.terminationDate, startKey, endKey)).length;
      const avg = (employedOn(startKey) + employedOn(endKey)) / 2;
      return avg ? Math.round((leavers / avg) * 1000) / 10 : 0;
    };

    // Monthly trend: the last 7 months (this one so far)
    const thisMonth = today.slice(0, 7);
    const months = Array.from({ length: 7 }, (_, i) => this.reports.addMonths(thisMonth, i - 6));
    const monthRange = (m: string) => ({ a: `${m}-01`, b: this.reports.monthEnd(m) < today ? this.reports.monthEnd(m) : today });

    const [rateNow, ratePrev, leaveNow, leavePrev, billNow, billPrev, lateNow, latePrev, balances, monthly] = await Promise.all([
      this.attendanceRate(companyId, scope, fromKey, toKey),
      this.attendanceRate(companyId, scope, prevFrom, prevTo),
      this.leaveDays(companyId, scope, fromKey, toKey),
      this.leaveDays(companyId, scope, prevFrom, prevTo),
      billableOn ? this.billable(companyId, scope, fromKey, toKey) : null,
      billableOn ? this.billable(companyId, scope, prevFrom, prevTo) : null,
      this.reports.lateByWeekday(companyId, scope, fromKey, toKey),
      this.reports.lateByWeekday(companyId, scope, prevFrom, prevTo),
      this.reports.leaveBalances(companyId, scope, Number(today.slice(0, 4))),
      Promise.all(
        months.map(async (m) => {
          const { a, b } = monthRange(m);
          const [rate, leave, bill] = await Promise.all([
            this.attendanceRate(companyId, scope, a, b),
            this.leaveDays(companyId, scope, a, b),
            billableOn ? this.billable(companyId, scope, a, b) : null,
          ]);
          return { month: m, headcount: employedOn(b), attendanceRatePct: rate.pct, leaveDays: leave, attritionPct: attrition(b), billablePct: bill?.pct ?? null };
        }),
      ),
    ]);

    const headStart = employedOn(addDays(fromKey, -1));
    const headEnd = employedOn(toKey);
    const joiners = rows.filter((e) => inRange(e.joiningDate, fromKey, toKey)).map(person);
    const leavers = rows.filter((e) => left(e) && inRange(e.terminationDate, fromKey, toKey)).map(person);
    const upcoming = rows.filter((e) => !left(e) && keyFromDate(e.joiningDate) > today && keyFromDate(e.joiningDate) <= addDays(today, 14)).map((e) => ({ ...person(e), joiningDate: keyFromDate(e.joiningDate) }));

    // ── What changed ──
    const highlights: Highlight[] = [];
    const worst = lateNow.map((n, i) => ({ i, n, p: latePrev[i] ?? 0 })).filter((d) => d.n >= 5 && d.n >= 2 * Math.max(1, d.p)).sort((a, b) => b.n / Math.max(1, b.p) - a.n / Math.max(1, a.p))[0];
    if (worst) {
      highlights.push({ key: 'late-weekday', tone: 'bad', icon: 'clock', title: `Late arrivals ${worst.p ? (worst.n >= 3 * worst.p ? 'tripled' : 'doubled') : 'jumped'} on ${WEEKDAYS[worst.i]}`, detail: `${worst.n} late check-ins on ${WEEKDAYS[worst.i]} vs ${worst.p} in the period before.`, tab: 'attendance' });
    }
    if (rateNow.pct !== null && ratePrev.pct !== null && Math.abs(rateNow.pct - ratePrev.pct) >= 3) {
      const up = rateNow.pct > ratePrev.pct;
      highlights.push({ key: 'attendance-rate', tone: up ? 'good' : 'bad', icon: up ? 'up' : 'down', title: `Attendance ${up ? 'up' : 'down'} ${Math.abs(Math.round((rateNow.pct - ratePrev.pct) * 10) / 10)} points`, detail: `${rateNow.pct}% of expected days were worked, vs ${ratePrev.pct}% before.`, tab: 'attendance' });
    }
    const monthsLeft = 12 - Number(today.slice(5, 7));
    if (balances.plentyLeft.length && monthsLeft <= 3) {
      const n = balances.plentyLeft.length;
      highlights.push({ key: 'unused-leave', tone: 'warn', icon: 'leave', title: `${n} ${n === 1 ? 'person has' : 'people have'} 15+ days of leave unused`, detail: `With ${monthsLeft === 0 ? 'this month' : `${monthsLeft} month${monthsLeft === 1 ? '' : 's'}`} left in the year — they may lose what doesn’t carry over.`, tab: 'attendance' });
    }
    if (billNow && billPrev) {
      const mover = billNow.projects
        .map((p) => ({ ...p, prev: billPrev.projects.find((x) => x.id === p.id)?.billableMinutes ?? 0 }))
        .filter((p) => Math.abs(p.billableMinutes - p.prev) >= 600 && p.prev > 0)
        .map((p) => ({ ...p, change: Math.round(((p.billableMinutes - p.prev) / p.prev) * 100) }))
        .filter((p) => Math.abs(p.change) >= 10)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
      if (mover) {
        const up = mover.change > 0;
        highlights.push({ key: `billable-${mover.id}`, tone: up ? 'good' : 'warn', icon: up ? 'up' : 'down', title: `Billable time on ${mover.name} is ${up ? 'up' : 'down'} ${Math.abs(mover.change)}%`, detail: `${Math.round(mover.billableMinutes / 60)} billable hours this period vs ${Math.round(mover.prev / 60)} before.`, tab: 'utilisation' });
      }
    }
    const soon = rows.filter((e) => e.employmentStatus === EmploymentStatus.PROBATION && e.confirmationDate && keyFromDate(e.confirmationDate) >= today && keyFromDate(e.confirmationDate) <= addDays(today, 30)).sort((a, b) => a.confirmationDate!.getTime() - b.confirmationDate!.getTime());
    if (soon.length) {
      const names = soon.slice(0, 2).map((e) => `${e.firstName} ${e.lastName} (${keyFromDate(e.confirmationDate!).slice(8)} ${new Date(`${keyFromDate(e.confirmationDate!)}T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' })})`);
      highlights.push({ key: 'probations', tone: 'info', icon: 'people', title: `${soon.length} probation${soon.length === 1 ? '' : 's'} end in the next 30 days`, detail: `${names.join(' and ')}${soon.length > 2 ? ` and ${soon.length - 2} more` : ''} need a confirmation decision.`, tab: 'people' });
    }
    const since90 = addDays(today, -90);
    const deptLeavers = new Map<string, number>();
    for (const e of rows) if (left(e) && inRange(e.terminationDate, since90, today) && e.departmentId) deptLeavers.set(e.departmentId, (deptLeavers.get(e.departmentId) ?? 0) + 1);
    const hot = [...deptLeavers].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0];
    if (hot) {
      const dept = await this.prisma.department.findUnique({ where: { id: hot[0] }, select: { name: true } });
      highlights.push({ key: 'attrition-dept', tone: 'bad', icon: 'down', title: `${hot[1]} people left ${dept?.name ?? 'one department'} in 90 days`, detail: 'More than anywhere else — worth a look at workload and managers.', tab: 'people' });
    }
    if (joiners.length && highlights.length < 4) {
      highlights.push({ key: 'joiners', tone: 'good', icon: 'people', title: `${joiners.length} ${joiners.length === 1 ? 'person' : 'people'} joined`, detail: joiners.slice(0, 3).map((j) => j.firstName).join(', ') + (joiners.length > 3 ? ` and ${joiners.length - 3} more` : '') + '.', tab: 'people' });
    }

    const kpi = (now: number | null, prev: number | null) => ({ value: now, previous: prev, change: now !== null && prev !== null ? Math.round((now - prev) * 10) / 10 : null });
    return {
      from: fromKey,
      to: toKey,
      previous: { from: prevFrom, to: prevTo },
      kpis: {
        headcount: kpi(headEnd, headStart),
        attendanceRatePct: kpi(rateNow.pct, ratePrev.pct),
        leaveDays: kpi(leaveNow, leavePrev),
        attritionPct: kpi(attrition(toKey), attrition(prevTo)),
        billablePct: billableOn ? kpi(billNow?.pct ?? null, billPrev?.pct ?? null) : null,
      },
      monthly,
      bridge: { start: headStart, joined: joiners.length, left: leavers.length, end: headEnd, joiners: joiners.slice(0, 12), leavers: leavers.slice(0, 12), upcoming },
      highlights: highlights.slice(0, 6),
    };
  }

  /** Worked days ÷ (people employed at the end × working days). */
  private async attendanceRate(companyId: string, scope: Prisma.EmployeeWhereInput, a: string, b: string) {
    const [workdays, headcount, present] = await Promise.all([
      this.reports.workdays(companyId, a, b),
      this.prisma.employee.count({ where: { AND: [scope, this.reports.employedOn(companyId, dateFromKey(b))] } }),
      this.prisma.attendanceRecord.count({ where: { companyId, date: { gte: dateFromKey(a), lte: dateFromKey(b) }, status: { in: PRESENTISH }, employee: scope } }),
    ]);
    const expected = headcount * workdays.length;
    return { pct: expected ? Math.round((present / expected) * 1000) / 10 : null };
  }

  /** Approved leave days starting in the range. */
  private async leaveDays(companyId: string, scope: Prisma.EmployeeWhereInput, a: string, b: string) {
    const r = await this.prisma.leaveRequest.aggregate({ where: { companyId, status: LeaveStatus.APPROVED, startDate: { gte: dateFromKey(a), lte: dateFromKey(b) }, employee: scope }, _sum: { totalDays: true } });
    return Math.round((r._sum.totalDays ?? 0) * 10) / 10;
  }

  /** Billable logged time ÷ capacity, and billable minutes per project. */
  private async billable(companyId: string, scope: Prisma.EmployeeWhereInput, a: string, b: string) {
    const where: Prisma.TimesheetEntryWhereInput = {
      companyId,
      date: { gte: dateFromKey(a), lte: dateFromKey(b) },
      minutes: { gt: 0 },
      status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED] },
      timesheet: { employee: scope },
    };
    const [workdays, people, total, byProject] = await Promise.all([
      this.reports.workdays(companyId, a, b),
      // People who were on a project in the range
      this.prisma.employee.count({ where: { AND: [scope, this.reports.employedOn(companyId, dateFromKey(b)), { projectMembers: { some: { startDate: { lte: dateFromKey(b) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(a) } }] } } }] } }),
      this.prisma.timesheetEntry.aggregate({ where: { ...where, billable: true }, _sum: { minutes: true } }),
      this.prisma.timesheetEntry.groupBy({ by: ['projectId'], where: { ...where, billable: true, projectId: { not: null } }, _sum: { minutes: true } }),
    ]);
    const capacity = people * workdays.length * DAY_HOURS * 60;
    const projects = byProject.length ? await this.prisma.project.findMany({ where: { id: { in: byProject.map((p) => p.projectId!).filter(Boolean) } }, select: { id: true, name: true } }) : [];
    return {
      pct: capacity ? Math.round(((total._sum.minutes ?? 0) / capacity) * 100) : null,
      projects: byProject.map((p) => ({ id: p.projectId!, name: projects.find((x) => x.id === p.projectId)?.name ?? 'Project', billableMinutes: p._sum.minutes ?? 0 })),
    };
  }
}
