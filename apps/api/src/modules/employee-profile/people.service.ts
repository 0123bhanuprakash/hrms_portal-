import { Injectable } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessContext } from '../access/access.types';
import { ProfileService } from './profile.service';
import type { DirectoryQueryDto } from './dto';
import { dateFromKey, isValidTimeZone, localDateKey } from '../attendance/time-zone';

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

  /** Company directory: everyone current, basic details only. */
  async directory(companyId: string, query: DirectoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      employmentStatus: { not: EmploymentStatus.TERMINATED },
      ...(query.departmentId && { departmentId: query.departmentId }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { employeeId: { contains: query.search, mode: 'insensitive' } },
          { designation: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: { ...BASIC, reportingManager: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
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
      select: { ...BASIC, dateOfBirth: true, showBirthday: true, joiningDate: true },
    });

    const basic = ({ dateOfBirth: _d, showBirthday: _s, joiningDate: _j, ...p }: (typeof people)[number]) => p;
    const birthdays: Array<ReturnType<typeof basic> & { date: string; inDays: number }> = [];
    const anniversaries: Array<ReturnType<typeof basic> & { date: string; inDays: number; years: number }> = [];
    const newJoiners: Array<ReturnType<typeof basic> & { joiningDate: Date }> = [];

    for (const person of people) {
      if (person.showBirthday && person.dateOfBirth) {
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

    const holidays = await this.prisma.publicHoliday.findMany({
      where: { companyId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 6,
      select: { id: true, name: true, date: true, isOptional: true },
    });

    const byDays = (a: { inDays: number }, b: { inDays: number }) => a.inDays - b.inDays;
    return {
      windowDays: SPOTLIGHT_DAYS,
      birthdays: birthdays.sort(byDays),
      anniversaries: anniversaries.sort(byDays),
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
