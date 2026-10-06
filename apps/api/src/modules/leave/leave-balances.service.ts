import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { LeaveTypesService, type LeaveTypeRow } from './leave-types.service';
import { accruedSoFar, availableDays, proratedQuota, toHalf, usableCarry } from './leave-rules';
import type { AdjustBalanceDto } from './dto';

type Db = PrismaService | Prisma.TransactionClient;
type Person = { id: string; joiningDate: Date; gender: string | null; employmentStatus?: EmploymentStatus; locationId?: string | null };
type BalanceRow = { allocated: number; carriedForward: number; adjusted: number; usedDays: number; pendingDays: number };

/** Balance numbers with expired carried-forward days taken out. */
const effective = (type: Pick<LeaveTypeRow, 'carryExpiry'>, b: BalanceRow, year: number, today: Date): BalanceRow => ({
  ...b,
  carriedForward: usableCarry({ carryExpiry: type.carryExpiry, year, today, carriedForward: b.carriedForward, usedDays: b.usedDays, pendingDays: b.pendingDays }),
});

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
    private readonly notifications: NotificationsService,
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
        carryExpired: toHalf(b.carriedForward - effective(type, b, year, today).carriedForward),
        adjusted: b.adjusted,
        used: b.usedDays,
        pending: b.pendingDays,
        available: availableDays(type.accrual, accrued, effective(type, b, year, today)),
        /** What the person would carry into next year / lose on 31 Dec if they take nothing more */
        yearEnd: this.yearEnd(type, b, year, today),
      });
    }
    return { employeeId: targetId, year, balances: rows };
  }

  /** Days available for a type in a year (null = unlimited). */
  async available(db: Db, companyId: string, person: Person, type: LeaveTypeRow, year: number): Promise<number | null> {
    const b = await this.ensure(db, companyId, person, type, year);
    const today = new Date();
    const accrued = accruedSoFar({ accrual: type.accrual, allocated: b.allocated, year, joining: person.joiningDate, today });
    return availableDays(type.accrual, accrued, effective(type, b, year, today));
  }

  /** Left at year end (everything credited by then), split into carried over and lost. */
  private yearEnd(type: LeaveTypeRow, b: BalanceRow, year: number, today: Date) {
    if (type.accrual === 'NONE') return null;
    const left = Math.max(0, availableDays(type.accrual, b.allocated, effective(type, b, year, today)) ?? 0);
    const carry = type.carryForward ? toHalf(Math.min(type.maxCarryForward, left)) : 0;
    return { left, carry, lapse: toHalf(left - carry) };
  }

  /**
   * Year-end preview for one type (HR): what everyone would carry over or lose
   * on 31 Dec if they take no more leave.
   */
  async yearEndPreview(companyId: string, typeId: string, year: number) {
    const type = await this.types.get(companyId, typeId);
    if (type.accrual === 'NONE') return { leaveType: { id: type.id, name: type.name }, year, carry: 0, lapse: 0, people: 0, losing: [] };
    const people = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: new Date(`${year}-12-31`) } },
      select: { id: true, joiningDate: true, gender: true, firstName: true, lastName: true, avatarUrl: true, employeeId: true },
    });
    const today = new Date();
    let carry = 0;
    let lapse = 0;
    const losing: Array<{ employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null; employeeId: string }; left: number; lapse: number }> = [];
    for (const p of people.filter((x) => eligible(type, x))) {
      const b = await this.ensure(this.prisma, companyId, p, type, year);
      const y = this.yearEnd(type, b, year, today)!;
      carry += y.carry;
      lapse += y.lapse;
      if (y.lapse > 0) losing.push({ employee: { id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, employeeId: p.employeeId }, left: y.left, lapse: y.lapse });
    }
    losing.sort((a, b) => b.lapse - a.lapse);
    return { leaveType: { id: type.id, name: type.name, carryForward: type.carryForward, maxCarryForward: type.maxCarryForward }, year, carry: toHalf(carry), lapse: toHalf(lapse), people: people.length, losing };
  }

  /** Reminds everyone who would lose days of a type at year end (in-app). */
  async remindLapse(companyId: string, typeId: string, year: number) {
    const preview = await this.yearEndPreview(companyId, typeId, year);
    if (!preview.losing.length) return { sent: 0 };
    const users = await this.prisma.employee.findMany({ where: { id: { in: preview.losing.map((l) => l.employee.id) } }, select: { id: true, userId: true } });
    const lapseOf = new Map(preview.losing.map((l) => [l.employee.id, l.lapse]));
    let sent = 0;
    for (const u of users) {
      const days = lapseOf.get(u.id)!;
      sent += await this.notifications.notify({
        companyId,
        userIds: [u.userId],
        type: 'leave.lapse_warning',
        title: `${days} day${days === 1 ? '' : 's'} of ${preview.leaveType.name.toLowerCase()} will lapse on 31 Dec`,
        body: 'Plan some time off before the year ends — unused days beyond the carry-over limit are lost.',
        link: '/app/leave',
        actionLabel: 'Plan leave',
        email: false,
        dedupeKey: `lapse:${typeId}:${year}`,
      });
    }
    return { sent };
  }

  /** Days used / given per type this year (Leave types cards). */
  async usage(companyId: string, year: number) {
    const rows = await this.prisma.leaveBalance.groupBy({ by: ['leaveTypeId'], where: { companyId, year }, _sum: { usedDays: true, allocated: true, carriedForward: true, adjusted: true } });
    return rows.map((r) => {
      const given = (r._sum.allocated ?? 0) + (r._sum.carriedForward ?? 0) + (r._sum.adjusted ?? 0);
      return { leaveTypeId: r.leaveTypeId, used: toHalf(r._sum.usedDays ?? 0), given: toHalf(given), percent: given ? Math.round(((r._sum.usedDays ?? 0) / given) * 100) : null };
    });
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
    const p = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true, joiningDate: true, gender: true, employmentStatus: true, locationId: true } });
    if (!p) throw new NotFoundException('Employee not found');
    return p;
  }
}
