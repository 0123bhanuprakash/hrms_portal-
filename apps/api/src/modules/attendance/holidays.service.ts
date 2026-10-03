import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dateFromKey } from './time-zone';
import type { SaveHolidayDto } from './dto';

const SELECT = { id: true, name: true, date: true, isOptional: true } satisfies Prisma.PublicHolidaySelect;

/** Company holiday calendar (holiday.manage to change). */
@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string, year: number) {
    return this.prisma.publicHoliday.findMany({ where: { companyId, year }, orderBy: { date: 'asc' }, select: SELECT });
  }

  /** Holidays between two date keys (inclusive) → Map<dateKey, holiday>. */
  async between(companyId: string, fromKey: string, toKey: string) {
    const rows = await this.prisma.publicHoliday.findMany({
      where: { companyId, date: { gte: dateFromKey(fromKey), lte: dateFromKey(toKey) } },
      select: SELECT,
    });
    return new Map(rows.map((h) => [h.date.toISOString().slice(0, 10), h]));
  }

  async create(companyId: string, dto: SaveHolidayDto) {
    const date = dateFromKey(dto.date);
    try {
      return await this.prisma.publicHoliday.create({
        data: { companyId, name: dto.name, date, year: date.getUTCFullYear(), isOptional: dto.isOptional ?? false },
        select: SELECT,
      });
    } catch (err) {
      throw this.duplicate(err, dto.date);
    }
  }

  async update(companyId: string, id: string, dto: SaveHolidayDto) {
    await this.assertExists(companyId, id);
    const date = dateFromKey(dto.date);
    try {
      return await this.prisma.publicHoliday.update({
        where: { id },
        data: { name: dto.name, date, year: date.getUTCFullYear(), isOptional: dto.isOptional ?? false },
        select: SELECT,
      });
    } catch (err) {
      throw this.duplicate(err, dto.date);
    }
  }

  async remove(companyId: string, id: string) {
    const holiday = await this.assertExists(companyId, id);
    await this.prisma.publicHoliday.delete({ where: { id } });
    return holiday;
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
