import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { LeaveTypesService, type LeaveTypeRow } from './leave-types.service';
import { accruedSoFar, availableDays, proratedQuota, toHalf } from './leave-rules';
import type { AdjustBalanceDto } from './dto';

type Db = PrismaService | Prisma.TransactionClient;
type Person = { id: string; joiningDate: Date; gender: string | null };

export const eligible = (type: Pick<LeaveTypeRow, 'gender'>, person: Pick<Person, 'gender'>) => !type.gender || type.gender === person.gender;

/**
 * Leave balances per employee, type and calendar year. Rows are created on
 * first use: prorated from the joining date, with last year's leftover
 * carried forward (up to the type's cap).
 */
@Injectable()
export class LeaveBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly types: LeaveTypesService,
  ) {}

  /** The balance row for one type / year, created if missing. */
  async ensure(db: Db, companyId: string, person: Person, type: LeaveTypeRow, year: number) {
    const key = { companyId_employeeId_leaveTypeId_year: { companyId, employeeId: person.id, leaveTypeId: type.id, year } };
    const existing = await db.leaveBalance.findUnique({ where: key });
    if (existing) return existing;

    let carried = 0;
    if (type.carryForward && type.accrual !== 'NONE') {
      const last = await db.leaveBalance.findUnique({ where: { companyId_employeeId_leaveTypeId_year: { ...key.companyId_employeeId_leaveTypeId_year, year: year - 1 } } });
      if (last) {
        const left = availableDays(type.accrual, last.allocated, last) ?? 0;
        carried = toHalf(Math.min(type.maxCarryForward, Math.max(0, left)));
      }
    }
    return db.leaveBalance.upsert({
      where: key,
      update: {},
      create: {
        companyId,
        employeeId: person.id,
        leaveTypeId: type.id,
        year,
        allocated: type.accrual === 'NONE' ? 0 : proratedQuota(type.annualQuota, year, person.joiningDate),
        carriedForward: carried,
      },
    });
  }

  /** Balances for every type the person can use, with what is available today. */
  async summary(companyId: string, access: AccessContext, employeeId: string | undefined, year: number) {
    const targetId = employeeId ?? access.employee?.id;
    if (!targetId) throw new BadRequestException('Your account has no employee profile');
    await this.access.assertEmployeeInScope(access, 'leave.view', companyId, targetId);
    const person = await this.person(companyId, targetId);
    const types = (await this.types.list(companyId)).filter((t) => eligible(t, person));
    const today = new Date();

    const rows = [];
    for (const type of types) {
      const b = await this.ensure(this.prisma, companyId, person, type, year);
      const accrued = accruedSoFar({ accrual: type.accrual, allocated: b.allocated, year, joining: person.joiningDate, today });
      rows.push({
        leaveType: type,
        balanceId: b.id,
        allocated: b.allocated,
        accrued,
        carriedForward: b.carriedForward,
        adjusted: b.adjusted,
        used: b.usedDays,
        pending: b.pendingDays,
        available: availableDays(type.accrual, accrued, b),
      });
    }
    return { employeeId: targetId, year, balances: rows };
  }

  /** Days available for a type in a year (null = unlimited). */
  async available(db: Db, companyId: string, person: Person, type: LeaveTypeRow, year: number): Promise<number | null> {
    const b = await this.ensure(db, companyId, person, type, year);
    const accrued = accruedSoFar({ accrual: type.accrual, allocated: b.allocated, year, joining: person.joiningDate, today: new Date() });
    return availableDays(type.accrual, accrued, b);
  }

  /** Moves days between pending / used (positive = add). */
  async change(db: Db, companyId: string, employeeId: string, leaveTypeId: string, year: number, delta: { pending?: number; used?: number }) {
    await db.leaveBalance.update({
      where: { companyId_employeeId_leaveTypeId_year: { companyId, employeeId, leaveTypeId, year } },
      data: {
        ...(delta.pending && { pendingDays: { increment: delta.pending } }),
        ...(delta.used && { usedDays: { increment: delta.used } }),
      },
    });
  }

  async adjust(companyId: string, access: AccessContext, dto: AdjustBalanceDto) {
    await this.access.assertEmployeeInScope(access, 'leave.adjust_balance', companyId, dto.employeeId);
    if (dto.days * 2 !== Math.round(dto.days * 2)) throw new BadRequestException('Adjust in half-day steps');
    const type = await this.types.get(companyId, dto.leaveTypeId);
    if (type.accrual === 'NONE') throw new BadRequestException(`${type.name} is unlimited — there is no balance to adjust`);
    const person = await this.person(companyId, dto.employeeId);

    return this.prisma.$transaction(async (tx) => {
      const b = await this.ensure(tx, companyId, person, type, dto.year);
      const updated = await tx.leaveBalance.update({
        where: { id: b.id },
        data: { adjusted: { increment: dto.days }, adjustments: { create: { days: dto.days, reason: dto.reason, adjustedById: access.userId } } },
      });
      return { id: updated.id, employeeId: dto.employeeId, leaveTypeId: type.id, year: dto.year, adjusted: updated.adjusted, days: dto.days, reason: dto.reason };
    });
  }

  /** Adjustment history for one balance row (same scope as viewing leave). */
  async history(companyId: string, access: AccessContext, balanceId: string) {
    const b = await this.prisma.leaveBalance.findFirst({ where: { id: balanceId, companyId }, select: { employeeId: true } });
    if (!b) throw new NotFoundException('Balance not found');
    await this.access.assertEmployeeInScope(access, 'leave.view', companyId, b.employeeId);
    return this.prisma.leaveBalanceAdjustment.findMany({
      where: { balanceId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, days: true, reason: true, createdAt: true, adjustedBy: { select: { firstName: true, lastName: true } } },
    });
  }

  async person(companyId: string, employeeId: string): Promise<Person> {
    const p = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true, joiningDate: true, gender: true } });
    if (!p) throw new NotFoundException('Employee not found');
    return p;
  }
}
