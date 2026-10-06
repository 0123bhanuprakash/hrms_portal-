import { Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, LeaveStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessContext } from '../access/access.types';
import { ProfileService } from './profile.service';
import type { DirectoryQueryDto } from './dto';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey, zonedInstant } from '../attendance/time-zone';
import { dayContext, statusesOn, weekKeys } from './people-today';
import { wordsWhere } from '../../common/word-search';

/** What any colleague may see about anyone — no personal data. */
const BASIC = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeSelect;

const SPOTLIGHT_DAYS = 30;
/** "New" in the directory: joined in the last 30 days */
const NEW_JOINER_DAYS = 30;
const DAY = 86_400_000;

@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profile: ProfileService,
  ) {}

  /** The caller's own card for the home page: job info, manager, team, profile checklist. */
  async me(companyId: string, access: AccessContext) {
    if (!access.employee) return { employee: null, completion: null };
    const employee = await this.prisma.employee.findFirst({
      where: { id: access.employee.id, companyId },
      select: {
        ...BASIC,
        joiningDate: true,
        employmentType: true,
        employmentStatus: true,
        reportingManager: { select: BASIC },
        subordinates: {
          where: { employmentStatus: { not: EmploymentStatus.TERMINATED } },
          select: BASIC,
          orderBy: { firstName: 'asc' },
          take: 12,
        },
        _count: { select: { subordinates: { where: { employmentStatus: { not: EmploymentStatus.TERMINATED } } } } },
      },
    });
    if (!employee) return { employee: null, completion: null };
    const { _count, ...rest } = employee;
    return { employee: { ...rest, directReportCount: _count.subordinates }, completion: await this.profile.completion(employee.id) };
  }

  /** The caller's team: their manager, people with the same manager, and the people they lead. */
  private async myTeam(companyId: string, access: AccessContext): Promise<Set<string>> {
    const me = access.employee?.id;
    if (!me) return new Set();
    const self = await this.prisma.employee.findFirst({ where: { id: me, companyId }, select: { reportingManagerId: true } });
    const rows = await this.prisma.employee.findMany({
      where: {
        companyId,
        employmentStatus: { not: EmploymentStatus.TERMINATED },
        OR: [{ reportingManagerId: me }, ...(self?.reportingManagerId ? [{ reportingManagerId: self.reportingManagerId }, { id: self.reportingManagerId }] : [])],
      },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id).filter((id) => id !== me));
  }

  /**
   * Company directory: everyone current, basic details only — plus today's
   * status (in / from home / away / checked out / not in yet / off) and small
   * celebrations. Quick-chip counts come back with every page.
   */
  async directory(companyId: string, query: DirectoryQueryDto, access?: AccessContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const ctx = await dayContext(this.prisma, companyId);
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      employmentStatus: { not: EmploymentStatus.TERMINATED },
      joiningDate: { lte: ctx.today },
      ...(query.departmentId && { departmentId: query.departmentId }),
      ...(query.locationId && { locationId: query.locationId }),
      // Every word must match a field: "aadhya bose", "bose aadhya", "aadhya engineering"
      ...wordsWhere(query.search, (w): Prisma.EmployeeWhereInput[] => [
        { firstName: { contains: w, mode: 'insensitive' as const } },
        { lastName: { contains: w, mode: 'insensitive' as const } },
        { email: { contains: w, mode: 'insensitive' as const } },
        { employeeId: { contains: w, mode: 'insensitive' as const } },
        { designation: { name: { contains: w, mode: 'insensitive' as const } } },
        { department: { name: { contains: w, mode: 'insensitive' as const } } },
      ]),
    };
    // Everyone matching the search / team / location, light — chips and filters work on this
    const base = await this.prisma.employee.findMany({ where, select: { id: true, firstName: true, lastName: true, joiningDate: true, dateOfBirth: true } });
    const ids = base.map((b) => b.id);
    const [statuses, team] = await Promise.all([statusesOn(this.prisma, companyId, ids, ctx), access ? this.myTeam(companyId, access) : Promise.resolve(new Set<string>())]);
    const newSince = addDays(ctx.todayKey, -NEW_JOINER_DAYS);
    const isNew = (b: (typeof base)[number]) => keyFromDate(b.joiningDate) >= newSince;

    const counts = {
      everyone: base.length,
      in: 0,
      wfh: 0,
      away: 0,
      out: 0,
      not_in: 0,
      off: 0,
      new: base.filter(isNew).length,
      mine: base.filter((b) => team.has(b.id)).length,
    };
    for (const t of statuses.values()) counts[t.status]++;

    let list = base;
    if (query.group === 'new') list = list.filter(isNew);
    if (query.group === 'mine') list = list.filter((b) => team.has(b.id));
    if (query.status) list = list.filter((b) => statuses.get(b.id)?.status === query.status);
    list = [...list].sort((a, b) =>
      query.sort === 'joined'
        ? b.joiningDate.getTime() - a.joiningDate.getTime()
        : a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName),
    );
    // Letters that have someone (A–Z rail) — before the letter itself is applied
    const letters = [...new Set(list.map((b) => b.firstName.charAt(0).toUpperCase()))].sort();
    if (query.letter) list = list.filter((b) => b.firstName.charAt(0).toUpperCase() === query.letter!.toUpperCase());
    const total = list.length;
    const pageIds = list.slice((page - 1) * limit, page * limit).map((b) => b.id);
    const rows = pageIds.length
      ? await this.prisma.employee.findMany({ where: { id: { in: pageIds } }, select: { ...BASIC, joiningDate: true, dateOfBirth: true, reportingManager: { select: { id: true, firstName: true, lastName: true } } } })
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const md = ctx.todayKey.slice(5);
    const data = pageIds
      .map((id) => byId.get(id)!)
      .filter(Boolean)
      .map(({ dateOfBirth, joiningDate, ...p }) => {
        const joined = keyFromDate(joiningDate);
        const years = Number(ctx.todayKey.slice(0, 4)) - Number(joined.slice(0, 4));
        const today = statuses.get(p.id) ?? { status: 'not_in' as const, since: null };
        return {
          ...p,
          joiningDate: joined,
          today,
          flags: {
            birthdayToday: Boolean(dateOfBirth && monthDay(dateOfBirth) === md),
            newJoinerDays: joined >= newSince ? Math.round((ctx.today.getTime() - joiningDate.getTime()) / DAY) : null,
            anniversaryYears: joined.slice(5) === md && years >= 1 ? years : null,
          },
        };
      });
    // Chip counts and letters ride in meta, so the response stays the usual { data, meta } list
    return { data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), counts, letters } };
  }

  /** The strip above the directory: new this month, birthdays, who's in today. */
  async highlights(companyId: string) {
    const ctx = await dayContext(this.prisma, companyId);
    const people = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: ctx.today } },
      select: { ...BASIC, joiningDate: true, dateOfBirth: true },
    });
    const statuses = await statusesOn(this.prisma, companyId, people.map((p) => p.id), ctx);
    const counts = { in: 0, wfh: 0, away: 0, out: 0, not_in: 0, off: 0 };
    for (const t of statuses.values()) counts[t.status]++;
    const newSince = addDays(ctx.todayKey, -NEW_JOINER_DAYS);
    const strip = ({ joiningDate: _j, dateOfBirth: _d, ...p }: (typeof people)[number]) => p;
    const week = Array.from({ length: 7 }, (_, i) => addDays(ctx.todayKey, i).slice(5));
    const birthdays = people
      .filter((p) => p.dateOfBirth && week.includes(monthDay(p.dateOfBirth)))
      .map((p) => ({ ...strip(p), date: monthDay(p.dateOfBirth!), inDays: week.indexOf(monthDay(p.dateOfBirth!)) }))
      .sort((a, b) => a.inDays - b.inDays);
    return {
      date: ctx.todayKey,
      workingDay: ctx.workingDay,
      holiday: ctx.holiday,
      total: people.length,
      counts,
      away: people.filter((p) => statuses.get(p.id)?.status === 'away').slice(0, 8).map(strip),
      newJoiners: people
        .filter((p) => keyFromDate(p.joiningDate) >= newSince)
        .sort((a, b) => b.joiningDate.getTime() - a.joiningDate.getTime())
        .slice(0, 8)
        .map((p) => ({ ...strip(p), joiningDate: keyFromDate(p.joiningDate) })),
      birthdays,
    };
  }

  /** Quick look: today, reporting line, people they lead, teammates, birthday, anniversary, kudos, this week. */
  async card(companyId: string, employeeId: string) {
    const ctx = await dayContext(this.prisma, companyId);
    const e = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } },
      select: {
        ...BASIC,
        joiningDate: true,
        dateOfBirth: true,
        departmentId: true,
        reportingManager: { select: BASIC },
        subordinates: { where: { employmentStatus: { not: EmploymentStatus.TERMINATED } }, select: BASIC, orderBy: { firstName: 'asc' }, take: 12 },
        _count: { select: { subordinates: { where: { employmentStatus: { not: EmploymentStatus.TERMINATED } } } } },
      },
    });
    if (!e) throw new NotFoundException('Person not found');
    const monthStart = dateFromKey(`${ctx.todayKey.slice(0, 7)}-01`);
    const week = weekKeys(ctx.todayKey);
    const [teammates, teammateCount, kudosTotal, kudosMonth, statuses, weekRecords, weekLeave, weekHolidays] = await Promise.all([
      e.departmentId
        ? this.prisma.employee.findMany({ where: { companyId, departmentId: e.departmentId, id: { not: e.id }, employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: ctx.today } }, select: BASIC, orderBy: { firstName: 'asc' }, take: 8 })
        : Promise.resolve([]),
      e.departmentId ? this.prisma.employee.count({ where: { companyId, departmentId: e.departmentId, id: { not: e.id }, employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: ctx.today } } }) : Promise.resolve(0),
      this.prisma.kudosRecipient.count({ where: { employeeId: e.id, kudos: { deletedAt: null } } }),
      this.prisma.kudosRecipient.count({ where: { employeeId: e.id, kudos: { deletedAt: null, createdAt: { gte: monthStart } } } }),
      statusesOn(this.prisma, companyId, [e.id], ctx),
      this.prisma.attendanceRecord.findMany({ where: { companyId, employeeId: e.id, date: { gte: dateFromKey(week[0]!), lte: dateFromKey(week[4]!) } }, select: { date: true, status: true, checkIn: true } }),
      this.prisma.leaveRequest.findMany({ where: { companyId, employeeId: e.id, status: LeaveStatus.APPROVED, startDate: { lte: dateFromKey(week[4]!) }, endDate: { gte: dateFromKey(week[0]!) } }, select: { startDate: true, endDate: true, leaveType: { select: { category: true } } } }),
      this.prisma.publicHoliday.findMany({ where: { companyId, isOptional: false, date: { gte: dateFromKey(week[0]!), lte: dateFromKey(week[4]!) } }, select: { date: true } }),
    ]);
    const holidayKeys = new Set(weekHolidays.map((h) => keyFromDate(h.date)));
    // Each weekday: in / wfh / away / off (holiday) / none (no record yet) / later (future)
    const thisWeek = week.map((k) => {
      const d = dateFromKey(k);
      const l = weekLeave.find((x) => x.startDate <= d && x.endDate >= d);
      const r = weekRecords.find((x) => keyFromDate(x.date) === k);
      const day = holidayKeys.has(k) ? 'off' : l ? (l.leaveType.category === 'WORK_FROM_HOME' ? 'wfh' : 'away') : r?.status === 'WORK_FROM_HOME' ? 'wfh' : r?.checkIn ? 'in' : k > ctx.todayKey ? 'later' : 'none';
      return { date: k, day };
    });
    const joined = keyFromDate(e.joiningDate);
    const nextAnniv = nextOccurrence(e.joiningDate, ctx.today);
    const { _count, dateOfBirth, joiningDate: _j, departmentId: _dep, ...rest } = e;
    return {
      ...rest,
      joiningDate: joined,
      today: statuses.get(e.id) ?? { status: 'not_in', since: null },
      directReportCount: _count.subordinates,
      teammates,
      teammateCount,
      birthday: dateOfBirth ? monthDay(dateOfBirth) : null,
      anniversary: { date: keyFromDate(nextAnniv), years: nextAnniv.getUTCFullYear() - e.joiningDate.getUTCFullYear() },
      kudos: { total: kudosTotal, thisMonth: kudosMonth },
      thisWeek,
    };
  }

  /**
   * Upcoming birthdays (only people who opted in; day + month, never the year),
   * work anniversaries, recent joiners and the next holidays.
   */
  async spotlight(companyId: string) {
    // "Today" in the company's time zone (UTC midnight of that calendar date)
    const settings = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    const timeZone = settings?.timezone && isValidTimeZone(settings.timezone) ? settings.timezone : 'Asia/Kolkata';
    const today = dateFromKey(localDateKey(new Date(), timeZone));
    const people = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } },
      select: { ...BASIC, dateOfBirth: true, joiningDate: true },
    });

    const basic = ({ dateOfBirth: _d, joiningDate: _j, ...p }: (typeof people)[number]) => p;
    const birthdays: Array<ReturnType<typeof basic> & { date: string; inDays: number }> = [];
    const anniversaries: Array<ReturnType<typeof basic> & { date: string; inDays: number; years: number }> = [];
    const newJoiners: Array<ReturnType<typeof basic> & { joiningDate: Date }> = [];

    for (const person of people) {
      // Everyone’s birthday is celebrated (day and month only — never the year)
      if (person.dateOfBirth) {
        const next = nextOccurrence(person.dateOfBirth, today);
        const inDays = Math.round((next.getTime() - today.getTime()) / DAY);
        if (inDays <= SPOTLIGHT_DAYS) birthdays.push({ ...basic(person), date: monthDay(next), inDays });
      }
      const joined = startOfDay(person.joiningDate);
      if (joined <= today && today.getTime() - joined.getTime() <= SPOTLIGHT_DAYS * DAY) {
        newJoiners.push({ ...basic(person), joiningDate: person.joiningDate });
      }
      const next = nextOccurrence(person.joiningDate, today);
      const years = next.getUTCFullYear() - person.joiningDate.getUTCFullYear();
      const inDays = Math.round((next.getTime() - today.getTime()) / DAY);
      if (years >= 1 && inDays <= SPOTLIGHT_DAYS) anniversaries.push({ ...basic(person), date: monthDay(next), inDays, years });
    }

    // Kudos sent today to people celebrating today (wishes count up live on Home)
    const celebrating = [...birthdays, ...anniversaries].filter((x) => x.inDays === 0).map((x) => x.id);
    const wishes = new Map<string, number>();
    if (celebrating.length) {
      const since = zonedInstant(keyFromDate(today), '00:00', timeZone);
      const rows = await this.prisma.kudosRecipient.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: celebrating }, kudos: { companyId, deletedAt: null, createdAt: { gte: since } } },
        _count: { _all: true },
      });
      for (const r of rows) wishes.set(r.employeeId, r._count._all);
    }
    const withWishes = <T extends { id: string; inDays: number }>(x: T) => (x.inDays === 0 ? { ...x, wishesToday: wishes.get(x.id) ?? 0 } : x);

    const holidays = await this.prisma.publicHoliday.findMany({
      where: { companyId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 6,
      select: { id: true, name: true, date: true, isOptional: true },
    });

    const byDays = (a: { inDays: number }, b: { inDays: number }) => a.inDays - b.inDays;
    return {
      windowDays: SPOTLIGHT_DAYS,
      birthdays: birthdays.sort(byDays).map(withWishes),
      anniversaries: anniversaries.sort(byDays).map(withWishes),
      newJoiners: newJoiners.sort((a, b) => b.joiningDate.getTime() - a.joiningDate.getTime()),
      holidays,
    };
  }
}

/** Dates are calendar dates (@db.Date → UTC midnight); compare in UTC. */
function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Next anniversary of a date (today counts); 29 Feb falls on 28 Feb in non-leap years. */
function nextOccurrence(date: Date, today: Date): Date {
  const at = (year: number) => {
    const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
    return d.getUTCMonth() === date.getUTCMonth() ? d : new Date(Date.UTC(year, date.getUTCMonth() + 1, 0));
  };
  const thisYear = at(today.getUTCFullYear());
  return thisYear >= today ? thisYear : at(today.getUTCFullYear() + 1);
}

/** "MM-DD" — no year, so birthdays never reveal age. */
function monthDay(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
