import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttendancePolicyService } from './policy.service';
import { dateFromKey, keyFromDate } from './time-zone';
import type { SaveHolidayDto } from './dto';

const SELECT = { id: true, name: true, date: true, isOptional: true, locationIds: true } satisfies Prisma.PublicHolidaySelect;
type HolidayRow = Prisma.PublicHolidayGetPayload<{ select: typeof SELECT }>;

/** National holidays offered by "Import" (dates are the usual ones; HR can edit after importing). */
const INDIA: Record<number, Array<[string, string, boolean?]>> = {
  2026: [['01-26', 'Republic Day'], ['03-04', 'Holi'], ['04-03', 'Good Friday', true], ['05-01', 'Labour Day', true], ['08-15', 'Independence Day'], ['09-14', 'Ganesh Chaturthi'], ['10-02', 'Gandhi Jayanti'], ['10-20', 'Dussehra'], ['11-08', 'Diwali'], ['12-25', 'Christmas']],
  2027: [['01-26', 'Republic Day'], ['03-22', 'Holi'], ['03-26', 'Good Friday', true], ['05-01', 'Labour Day', true], ['08-15', 'Independence Day'], ['09-04', 'Ganesh Chaturthi'], ['10-02', 'Gandhi Jayanti'], ['10-09', 'Dussehra'], ['10-29', 'Diwali'], ['12-25', 'Christmas']],
  2028: [['01-26', 'Republic Day'], ['03-11', 'Holi'], ['04-14', 'Good Friday', true], ['05-01', 'Labour Day', true], ['08-15', 'Independence Day'], ['08-23', 'Ganesh Chaturthi'], ['10-02', 'Gandhi Jayanti'], ['09-27', 'Dussehra'], ['10-17', 'Diwali'], ['12-25', 'Christmas']],
};

export interface PersonForHolidays {
  id: string;
  locationId: string | null;
}

/**
 * Company holiday calendar (holiday.manage to change). A holiday counts for a
 * person when it is for everyone or their office location; an optional holiday
 * only when they picked it (up to the company's limit per year).
 */
@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: AttendancePolicyService,
  ) {}

  /** The year's holidays, with the caller's own picks (the pick limit is on the attendance policy). */
  async list(companyId: string, year: number, employeeId?: string | null) {
    const [rows, picks, me] = await Promise.all([
      this.prisma.publicHoliday.findMany({ where: { companyId, year }, orderBy: { date: 'asc' }, select: SELECT }),
      employeeId ? this.prisma.holidayChoice.findMany({ where: { companyId, employeeId, holiday: { year } }, select: { holidayId: true } }) : Promise.resolve([]),
      employeeId ? this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { locationId: true } }) : Promise.resolve(null),
    ]);
    const picked = new Set(picks.map((p) => p.holidayId));
    return rows.map((h) => ({ ...h, date: keyFromDate(h.date), chosen: picked.has(h.id), appliesToMe: applies(h, me?.locationId ?? null) }));
  }

  /** All company holidays between two dates (display: calendars, who's off). */
  async between(companyId: string, fromKey: string, toKey: string) {
    const rows = await this.prisma.publicHoliday.findMany({
      where: { companyId, date: { gte: dateFromKey(fromKey), lte: dateFromKey(toKey) } },
      select: SELECT,
    });
    return new Map(rows.map((h) => [keyFromDate(h.date), h]));
  }

  /**
   * The days off each person actually gets: holidays for everyone or their
   * location, plus optional ones they picked → Map<employeeId, Map<dateKey, holiday>>.
   */
  async forPeople(companyId: string, people: PersonForHolidays[], fromKey: string, toKey: string): Promise<Map<string, Map<string, HolidayRow>>> {
    const out = new Map<string, Map<string, HolidayRow>>(people.map((p) => [p.id, new Map()]));
    if (!people.length) return out;
    const [all, picks] = await Promise.all([
      this.between(companyId, fromKey, toKey),
      this.prisma.holidayChoice.findMany({
        where: { companyId, employeeId: { in: people.map((p) => p.id) }, holiday: { date: { gte: dateFromKey(fromKey), lte: dateFromKey(toKey) } } },
        select: { employeeId: true, holidayId: true },
      }),
    ]);
    const picked = new Set(picks.map((p) => `${p.employeeId}|${p.holidayId}`));
    for (const p of people) {
      const mine = out.get(p.id)!;
      for (const [key, h] of all) {
        if (h.isOptional ? picked.has(`${p.id}|${h.id}`) : applies(h, p.locationId)) mine.set(key, h);
      }
    }
    return out;
  }

  /** One person's days off between two dates (date keys). */
  async keysFor(companyId: string, person: PersonForHolidays, fromKey: string, toKey: string): Promise<Set<string>> {
    return new Set((await this.forPeople(companyId, [person], fromKey, toKey)).get(person.id)!.keys());
  }

  async create(companyId: string, dto: SaveHolidayDto) {
    const date = dateFromKey(dto.date);
    try {
      return this.out(await this.prisma.publicHoliday.create({ data: { companyId, name: dto.name, date, year: date.getUTCFullYear(), isOptional: dto.isOptional ?? false, locationIds: await this.locations(companyId, dto.locationIds) }, select: SELECT }));
    } catch (err) {
      throw this.duplicate(err, dto.date);
    }
  }

  async update(companyId: string, id: string, dto: SaveHolidayDto) {
    await this.assertExists(companyId, id);
    const date = dateFromKey(dto.date);
    try {
      const row = await this.prisma.publicHoliday.update({
        where: { id },
        data: { name: dto.name, date, year: date.getUTCFullYear(), isOptional: dto.isOptional ?? false, locationIds: await this.locations(companyId, dto.locationIds) },
        select: SELECT,
      });
      // No longer optional → nobody needs to pick it any more
      if (!row.isOptional) await this.prisma.holidayChoice.deleteMany({ where: { holidayId: id } });
      return this.out(row);
    } catch (err) {
      throw this.duplicate(err, dto.date);
    }
  }

  async remove(companyId: string, id: string) {
    const holiday = await this.assertExists(companyId, id);
    await this.prisma.publicHoliday.delete({ where: { id } });
    return this.out(holiday);
  }

  /** Adds the national list for a year; days that already have a holiday are left alone. */
  async importPreset(companyId: string, year: number) {
    const list = INDIA[year];
    if (!list) throw new BadRequestException(`No national list for ${year} yet`);
    const { count } = await this.prisma.publicHoliday.createMany({
      data: list.map(([md, name, optional]) => ({ companyId, name, date: dateFromKey(`${year}-${md}`), year, isOptional: Boolean(optional) })),
      skipDuplicates: true,
    });
    return { added: count, skipped: list.length - count };
  }

  /** Pick an optional holiday (for yourself). */
  async choose(companyId: string, employeeId: string | undefined, id: string) {
    if (!employeeId) throw new BadRequestException('Your account has no employee profile');
    const holiday = await this.assertExists(companyId, id);
    if (!holiday.isOptional) throw new BadRequestException('Only optional holidays are picked — this one is for everyone');
    const me = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { locationId: true } });
    if (!applies(holiday, me?.locationId ?? null)) throw new BadRequestException('This holiday is not offered at your location');
    const { optionalHolidayLimit: limit } = await this.policies.get(companyId);
    const year = holiday.date.getUTCFullYear();
    const taken = await this.prisma.holidayChoice.count({ where: { companyId, employeeId, holiday: { year }, NOT: { holidayId: id } } });
    if (taken >= limit) throw new BadRequestException(`You can pick ${limit} optional holiday${limit === 1 ? '' : 's'} a year — remove one first`);
    await this.prisma.holidayChoice.upsert({ where: { employeeId_holidayId: { employeeId, holidayId: id } }, update: {}, create: { companyId, employeeId, holidayId: id } });
    return this.list(companyId, year, employeeId);
  }

  async unchoose(companyId: string, employeeId: string | undefined, id: string) {
    if (!employeeId) throw new BadRequestException('Your account has no employee profile');
    const holiday = await this.assertExists(companyId, id);
    await this.prisma.holidayChoice.deleteMany({ where: { companyId, employeeId, holidayId: id } });
    return this.list(companyId, holiday.date.getUTCFullYear(), employeeId);
  }

  private async locations(companyId: string, ids: string[] | undefined): Promise<string[]> {
    if (!ids?.length) return [];
    const found = await this.prisma.officeLocation.count({ where: { companyId, id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Unknown office location');
    return ids;
  }

  private out(h: HolidayRow) {
    return { ...h, date: keyFromDate(h.date) };
  }

  private async assertExists(companyId: string, id: string) {
    const holiday = await this.prisma.publicHoliday.findFirst({ where: { id, companyId }, select: SELECT });
    if (!holiday) throw new NotFoundException('Holiday not found');
    return holiday;
  }

  private duplicate(err: unknown, date: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictException(`There is already a holiday on ${date}`);
    }
    return err;
  }
}

/** Holiday for everyone, or for this person's office location. */
const applies = (h: { locationIds: string[] }, locationId: string | null) => !h.locationIds.length || (locationId !== null && h.locationIds.includes(locationId));
