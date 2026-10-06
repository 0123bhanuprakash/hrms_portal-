import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttendancePolicyService } from './policy.service';
import type { ShiftHours } from './attendance-rules';
import { minutesOf } from './time-zone';
import type { SaveShiftDto } from './dto';

const SELECT = { id: true, name: true, startTime: true, endTime: true, color: true } satisfies Prisma.WorkShiftSelect;

/**
 * Extra shifts besides the company's general shift (Attendance settings), e.g.
 * Night 21:00–06:00. People are put on a shift; everyone else works the general one.
 */
@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: AttendancePolicyService,
  ) {}

  async list(companyId: string) {
    const [policy, shifts] = await Promise.all([
      this.policies.get(companyId),
      this.prisma.workShift.findMany({
        where: { companyId },
        orderBy: { startTime: 'asc' },
        select: {
          ...SELECT,
          employees: {
            where: { employmentStatus: { not: EmploymentStatus.TERMINATED } },
            select: { id: true, firstName: true, lastName: true, avatarUrl: true, employeeId: true },
            orderBy: { firstName: 'asc' },
          },
        },
      }),
    ]);
    return {
      general: { name: 'General', startTime: policy.shiftStart, endTime: policy.shiftEnd },
      shifts: shifts.map((s) => ({ ...s, overnight: overnight(s.startTime, s.endTime), memberCount: s.employees.length })),
    };
  }

  async create(companyId: string, dto: SaveShiftDto) {
    this.validate(dto);
    try {
      return await this.prisma.workShift.create({ data: { companyId, name: dto.name, startTime: dto.startTime, endTime: dto.endTime, color: dto.color ?? '#7C3AED' }, select: SELECT });
    } catch (err) {
      throw this.duplicate(err, dto.name);
    }
  }

  async update(companyId: string, id: string, dto: SaveShiftDto) {
    await this.get(companyId, id);
    this.validate(dto);
    try {
      return await this.prisma.workShift.update({ where: { id }, data: { name: dto.name, startTime: dto.startTime, endTime: dto.endTime, ...(dto.color && { color: dto.color }) }, select: SELECT });
    } catch (err) {
      throw this.duplicate(err, dto.name);
    }
  }

  /** Removing a shift puts its people back on the general shift. */
  async remove(companyId: string, id: string) {
    const shift = await this.get(companyId, id);
    await this.prisma.workShift.delete({ where: { id } });
    return shift;
  }

  /** Exactly these people are on the shift (others on it go back to the general shift). */
  async setMembers(companyId: string, id: string, employeeIds: string[]) {
    await this.get(companyId, id);
    const found = await this.prisma.employee.count({ where: { companyId, id: { in: employeeIds } } });
    if (found !== employeeIds.length) throw new BadRequestException('Some people were not found');
    await this.prisma.$transaction([
      this.prisma.employee.updateMany({ where: { companyId, shiftId: id, id: { notIn: employeeIds } }, data: { shiftId: null } }),
      this.prisma.employee.updateMany({ where: { companyId, id: { in: employeeIds } }, data: { shiftId: id } }),
    ]);
    return (await this.list(companyId)).shifts.find((s) => s.id === id);
  }

  /** Working hours per person (missing = general shift). */
  async hoursFor(companyId: string, employeeIds: string[]): Promise<Map<string, ShiftHours>> {
    const map = new Map<string, ShiftHours>();
    if (!employeeIds.length) return map;
    const rows = await this.prisma.employee.findMany({
      where: { companyId, id: { in: employeeIds }, shiftId: { not: null } },
      select: { id: true, shift: { select: SELECT } },
    });
    for (const r of rows) if (r.shift) map.set(r.id, hours(r.shift));
    return map;
  }

  async hoursOf(companyId: string, employeeId: string): Promise<ShiftHours | null> {
    return (await this.hoursFor(companyId, [employeeId])).get(employeeId) ?? null;
  }

  private async get(companyId: string, id: string) {
    const shift = await this.prisma.workShift.findFirst({ where: { id, companyId }, select: SELECT });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  private validate(dto: SaveShiftDto) {
    if (dto.startTime === dto.endTime) throw new BadRequestException('Start and end must be different');
    if (dto.name.trim().toLowerCase() === 'general') throw new BadRequestException('“General” is the company’s main shift — pick another name');
  }

  private duplicate(err: unknown, name: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return new ConflictException(`There is already a shift called ${name}`);
    return err;
  }
}

export const overnight = (start: string, end: string) => minutesOf(end) <= minutesOf(start);
const hours = (s: { id: string; name: string; startTime: string; endTime: string }): ShiftHours => ({ id: s.id, name: s.name, start: s.startTime, end: s.endTime, overnight: overnight(s.startTime, s.endTime) });
