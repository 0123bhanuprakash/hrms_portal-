import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, LeaveAdjustmentKind, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { LeaveTypesService, publicType, type LeaveTypeRow } from './leave-types.service';
import { accruedSoFar, availableDays, canAskForGrant, closeYear, isEligible, proratedQuota, takeBack, toHalf, usableCarry } from './leave-rules';
import { activeGrants, loadPeople, type Person } from './leave-eligibility';
import type { AdjustBalanceDto, LedgerQueryDto, OwedQueryDto, WaiveDto } from './dto';

type Db = PrismaService | Prisma.TransactionClient;
type BalanceRow = { allocated: number; carriedForward: number; adjusted: number; usedDays: number; pendingDays: number };

/** Balance numbers with expired carried-forward days taken out. */
const effective = (type: Pick<LeaveTypeRow, 'carryExpiry'>, b: BalanceRow, year: number, today: Date): BalanceRow => ({
  ...b,
  carriedForward: usableCarry({ carryExpiry: type.carryExpiry, year, today, carriedForward: b.carriedForward, usedDays: b.usedDays, pendingDays: b.pendingDays }),
});

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** Adjusting with a balance: the old "adjust" permission, or the new lend / give one for those two kinds. */
const ADJUST = 'leave.adjust_balance';
const EXTRA_DECIDE = 'leave.extra_decide';

/** Balanced types only: unlimited and grant-only types have nothing to lend, owe or adjust. */
const hasBalance = (t: Pick<LeaveTypeRow, 'accrual' | 'availability'>) => t.accrual !== 'NONE' && t.availability !== 'GRANT_ONLY';

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
    const rows = await db.leaveBalance.findMany({ where: { companyId, employeeId: person.id, leaveTypeId: type.id, year: { in: [year - 1, year] } } });
    const last = rows.find((r) => r.year === year - 1) ?? null;
    let row = rows.find((r) => r.year === year) ?? null;
    if (!row) {
      let carried = 0;
      if (type.carryForward && hasBalance(type) && last) {
        const left = availableDays(type.accrual, last.allocated, last) ?? 0;
        carried = toHalf(Math.min(type.maxCarryForward, Math.max(0, left)));
      }
      row = await db.leaveBalance.upsert({
        where: key,
        update: {},
        create: {
          companyId,
          employeeId: person.id,
          leaveTypeId: type.id,
          year,
          // Grant-only types: the days live on the grants; this row only counts what is used / pending in the year
          allocated: hasBalance(type) ? proratedQuota(type.annualQuota, year, person.joiningDate) : 0,
          carriedForward: carried,
        },
      });
    }
    // Once the year has begun, close last year (once): record carry / lapse, take back what is owed
    if (last && !last.closedAt && hasBalance(type) && Date.now() >= Date.UTC(year, 0, 1)) row = await this.closeLastYear(db, companyId, person, type, last, row);
    return row;
  }

  /** Writes last year's carried / lapsed / owed and takes owed days from this year's balance. */
  private async closeLastYear(db: Db, companyId: string, person: Person, type: LeaveTypeRow, last: Prisma.LeaveBalanceGetPayload<object>, row: Prisma.LeaveBalanceGetPayload<object>) {
    const left = availableDays(type.accrual, last.allocated, effective(type, last, last.year, new Date())) ?? 0;
    const close = closeYear({ left, carryForward: type.carryForward, maxCarry: type.maxCarryForward, lendLimit: last.lendLimit, recoverNegative: type.recoverNegative, owedLeft: last.owedLeft });
    // Claim the close so two requests never take days back twice
    const { count } = await db.leaveBalance.updateMany({ where: { id: last.id, closedAt: null }, data: { closedAt: new Date(), carriedOut: close.carriedOut, lapsed: close.lapsed, owedOut: close.owedOut } });
    if (!count || !close.owedOut) return count ? row : ((await db.leaveBalance.findUnique({ where: { id: row.id } })) ?? row);
    const room = availableDays(type.accrual, row.allocated, row) ?? 0;
    const back = takeBack(close.owedOut, room);
    const updated = await db.leaveBalance.update({
      where: { id: row.id },
      data: {
        adjusted: { decrement: back.taken },
        owedLeft: back.stillOwed,
        adjustments: {
          create: {
            kind: LeaveAdjustmentKind.TAKEN_BACK,
            days: -back.taken,
            owedDays: close.owedOut,
            reason: back.stillOwed ? `Taken back: ${plural(back.taken)} of ${plural(close.owedOut)} owed from ${last.year} — ${plural(back.stillOwed)} still owed` : `Taken back: ${plural(close.owedOut)} owed from ${last.year}`,
          },
        },
      },
    });
    if (back.taken) {
      const who = await db.employee.findUnique({ where: { id: person.id }, select: { userId: true } });
      void this.notifications.notify({
        companyId,
        userIds: [who?.userId],
        type: 'leave.taken_back',
        title: `${plural(back.taken)} taken from your ${row.year} ${type.name.toLowerCase()}`,
        body: `You were ${plural(close.owedOut)} below 0 at the end of ${last.year}.${back.stillOwed ? ` ${plural(back.stillOwed)} will be taken from ${row.year + 1}.` : ''}`,
        link: '/app/leave',
        email: false,
        dedupeKey: `taken-back:${row.id}`,
      });
    }
    return updated;
  }

  /** What can be taken: available days and how far below 0 the person may go (type-wide + lent to them). */
  async limits(db: Db, companyId: string, person: Person, type: LeaveTypeRow, year: number) {
    const b = await this.ensure(db, companyId, person, type, year);
    const today = new Date();
    const accrued = accruedSoFar({ accrual: type.accrual, allocated: b.allocated, year, joining: person.joiningDate, today });
    return { available: availableDays(type.accrual, accrued, effective(type, b, year, today)), below: type.negativeBalance + b.lendLimit, lent: b.lendLimit };
  }

  /** Balances for every type the person can use, with what is available today. */
  async summary(companyId: string, access: AccessContext, employeeId: string | undefined, year: number) {
    const targetId = employeeId ?? access.employee?.id;
    if (!targetId) throw new BadRequestException('Your account has no employee profile');
    await this.access.assertEmployeeInScope(access, 'leave.view', companyId, targetId);
    const person = await this.person(companyId, targetId);
    const today = new Date();
    const todayKey = dayKey(today);
    const all = await this.types.list(companyId);
    // Grants that touch this year (a grant can run Nov → Apr)
    const grants = (await activeGrants(this.prisma, companyId, { employeeId: targetId })).filter((g) => g.validFrom <= `${year}-12-31` && g.validTo >= `${year}-01-01`);
    const types = all.filter((t) => isEligible(t, person, today, grants.some((g) => g.leaveTypeId === t.id)));

    const extra = (
      await this.prisma.extraLeaveRequest.findMany({ where: { companyId, employeeId: targetId, year, status: 'PENDING' }, select: { id: true, leaveTypeId: true, days: true, createdAt: true } })
    ).map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    const rows = [];
    for (const type of types) {
      const b = await this.ensure(this.prisma, companyId, person, type, year);
      if (type.availability === 'GRANT_ONLY') {
        const mine = grants.filter((g) => g.leaveTypeId === type.id);
        const given = toHalf(mine.reduce((n, g) => n + g.days, 0));
        rows.push({
          leaveType: publicType(type),
          balanceId: b.id,
          allocated: given,
          accrued: given,
          carriedForward: 0,
          carryExpired: 0,
          adjusted: 0,
          used: b.usedDays,
          pending: b.pendingDays,
          // Days left on grants still open today (unused days lapse when a grant ends)
          available: toHalf(mine.filter((g) => g.validTo >= todayKey).reduce((n, g) => n + Math.max(0, g.days - g.taken), 0)),
          yearEnd: null,
          grants: mine.map((g) => ({ id: g.id, days: g.days, taken: g.taken, used: g.used, left: g.validTo >= todayKey ? toHalf(Math.max(0, g.days - g.taken)) : 0, validFrom: g.validFrom, validTo: g.validTo })),
        });
        continue;
      }
      const accrued = accruedSoFar({ accrual: type.accrual, allocated: b.allocated, year, joining: person.joiningDate, today });
      rows.push({
        leaveType: publicType(type),
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
        /** HR lets them go this far below 0 (on top of the type's own allowance) */
        lent: b.lendLimit,
        /** How far below 0 they may go in all */
        below: toHalf(type.negativeBalance + b.lendLimit),
        /** Owed from earlier years, still to be taken back next year */
        owedLeft: b.owedLeft,
        /** Their "ask for more days" request waiting for a decision */
        extraRequest: extra.find((r) => r.leaveTypeId === type.id) ?? null,
      });
    }
    // Grant-only types the person may ask HR for (no open grant yet), with any request waiting
    const waiting = await this.prisma.leaveGrantRequest.findMany({
      where: { companyId, employeeId: targetId, status: 'PENDING' },
      select: { id: true, leaveTypeId: true, fromDate: true, toDate: true, createdAt: true },
    });
    const askable = all
      .filter((t) => canAskForGrant(t, person, today) && !grants.some((g) => g.leaveTypeId === t.id && g.validTo >= todayKey))
      .map((t) => {
        const r = waiting.find((w) => w.leaveTypeId === t.id);
        return {
          leaveType: { id: t.id, name: t.name, code: t.code, color: t.color, description: t.description, annualQuota: t.annualQuota, grantNeedsDocument: t.grantNeedsDocument },
          request: r ? { id: r.id, fromDate: dayKey(r.fromDate), toDate: dayKey(r.toDate), createdAt: r.createdAt } : null,
        };
      });
    return { employeeId: targetId, year, balances: rows, askable };
  }

  /** Days available for a type in a year (null = unlimited). */
  async available(db: Db, companyId: string, person: Person, type: LeaveTypeRow, year: number): Promise<number | null> {
    const b = await this.ensure(db, companyId, person, type, year);
    const today = new Date();
    const accrued = accruedSoFar({ accrual: type.accrual, allocated: b.allocated, year, joining: person.joiningDate, today });
    return availableDays(type.accrual, accrued, effective(type, b, year, today));
  }

  /** Left at year end (everything credited by then), split into carried over and lost. */
  private yearEnd(type: LeaveTypeRow, b: BalanceRow & { lendLimit: number; owedLeft: number }, year: number, today: Date) {
    if (type.accrual === 'NONE') return null;
    const raw = availableDays(type.accrual, b.allocated, effective(type, b, year, today)) ?? 0;
    const c = closeYear({ left: raw, carryForward: type.carryForward, maxCarry: type.maxCarryForward, lendLimit: b.lendLimit, recoverNegative: type.recoverNegative, owedLeft: b.owedLeft });
    return { left: Math.max(0, raw), carry: c.carriedOut, lapse: c.lapsed, owe: c.owedOut };
  }

  /**
   * Year-end preview for one type (HR): what everyone would carry over or lose
   * on 31 Dec if they take no more leave.
   */
  async yearEndPreview(companyId: string, typeId: string, year: number) {
    const type = await this.types.get(companyId, typeId);
    if (type.accrual === 'NONE' || type.availability === 'GRANT_ONLY') return { leaveType: { id: type.id, name: type.name }, year, carry: 0, lapse: 0, people: 0, losing: [] };
    const today = new Date();
    const people = (
      await loadPeople(
        this.prisma,
        companyId,
        { employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: new Date(`${year}-12-31`) } },
        { firstName: true, lastName: true, avatarUrl: true, employeeId: true },
      )
    ).filter((x) => isEligible(type, x, today));
    let carry = 0;
    let lapse = 0;
    const losing: Array<{ employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null; employeeId: string }; left: number; lapse: number }> = [];
    for (const p of people) {
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
    const [rows, grants] = await Promise.all([
      this.prisma.leaveBalance.groupBy({ by: ['leaveTypeId'], where: { companyId, year }, _sum: { usedDays: true, allocated: true, carriedForward: true, adjusted: true } }),
      // Grant-only types: days on grants starting this year
      this.prisma.leaveGrant.groupBy({ by: ['leaveTypeId'], where: { companyId, status: 'ACTIVE', validFrom: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } }, _sum: { days: true } }),
    ]);
    const granted = new Map(grants.map((g) => [g.leaveTypeId, g._sum.days ?? 0]));
    return rows.map((r) => {
      const given = (r._sum.allocated ?? 0) + (r._sum.carriedForward ?? 0) + (r._sum.adjusted ?? 0) + (granted.get(r.leaveTypeId) ?? 0);
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

  /**
   * HR's adjustments, by kind: EXTRA (+, kept), LEND (may go N below 0; what is
   * used below 0 is taken from next year), CORRECTION (±), DEDUCTION (−).
   * EXTRA and LEND are also open to holders of leave.extra_decide.
   */
  async adjust(companyId: string, access: AccessContext, dto: AdjustBalanceDto, requestId: string | null = null) {
    const kind = dto.kind ?? LeaveAdjustmentKind.CORRECTION;
    await this.assertMayAdjust(companyId, access, kind, dto.employeeId);
    if (dto.employeeId === access.employee?.id && !access.isOwner && !access.isSuperAdmin) throw new ForbiddenException('You can’t change your own leave balance');
    if (dto.days * 2 !== Math.round(dto.days * 2)) throw new BadRequestException('Use half-day steps');
    if ((kind === 'EXTRA' || kind === 'LEND') && dto.days <= 0) throw new BadRequestException('Enter how many days, more than 0');
    if (kind === 'DEDUCTION' && dto.days >= 0) throw new BadRequestException('A deduction takes days away — use a negative number');
    const type = await this.types.get(companyId, dto.leaveTypeId);
    if (type.accrual === 'NONE') throw new BadRequestException(`${type.name} is unlimited — there is no balance to adjust`);
    if (type.availability === 'GRANT_ONLY') throw new BadRequestException(`${type.name} is given by grant — change the person's grant instead`);
    const person = await this.person(companyId, dto.employeeId);

    const result = await this.prisma.$transaction(async (tx) => {
      const b = await this.ensure(tx, companyId, person, type, dto.year);
      if (kind === 'LEND') {
        // Hard cap: never lend more than next year's quota can pay back
        const cap = type.annualQuota;
        if (b.lendLimit + dto.days > cap) {
          const room = toHalf(Math.max(0, cap - b.lendLimit));
          throw new BadRequestException(`You can lend at most ${plural(cap)} of ${type.name.toLowerCase()} — next year's quota${b.lendLimit ? `. ${plural(b.lendLimit)} already lent, so ${plural(room)} more` : ''}`);
        }
        return tx.leaveBalance.update({
          where: { id: b.id },
          data: { lendLimit: { increment: dto.days }, adjustments: { create: { kind, days: 0, lendLimit: dto.days, reason: dto.reason, adjustedById: access.userId, requestId } } },
        });
      }
      return tx.leaveBalance.update({
        where: { id: b.id },
        data: { adjusted: { increment: dto.days }, adjustments: { create: { kind, days: dto.days, reason: dto.reason, adjustedById: access.userId, requestId } } },
      });
    });
    if (kind === 'EXTRA' || kind === 'LEND') void this.tellLentOrGiven(companyId, dto.employeeId, type, kind, dto.days, dto.year, dto.reason);
    return { id: result.id, employeeId: dto.employeeId, leaveTypeId: type.id, year: dto.year, kind, adjusted: result.adjusted, lent: result.lendLimit, days: dto.days, reason: dto.reason };
  }

  private async assertMayAdjust(companyId: string, access: AccessContext, kind: LeaveAdjustmentKind, employeeId: string) {
    const viaAdjust = await this.access.assertEmployeeInScope(access, ADJUST, companyId, employeeId).then(() => true, () => false);
    if (viaAdjust) return;
    if (kind === 'EXTRA' || kind === 'LEND') {
      await this.access.assertEmployeeInScope(access, EXTRA_DECIDE, companyId, employeeId);
      return;
    }
    throw new ForbiddenException(`You do not have permission to perform this action. Required: ${ADJUST}`);
  }

  private async tellLentOrGiven(companyId: string, employeeId: string, type: LeaveTypeRow, kind: 'EXTRA' | 'LEND', days: number, year: number, reason: string) {
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
    await this.notifications.notify({
      companyId,
      userIds: [e?.userId],
      type: kind === 'LEND' ? 'leave.lent' : 'leave.extra_given',
      title: kind === 'LEND' ? `You can take ${plural(days)} more ${type.name.toLowerCase()} (lent)` : `${plural(days)} extra ${type.name.toLowerCase()} added`,
      body: kind === 'LEND' ? `Days you use below 0 will be taken from your ${year + 1} ${type.name.toLowerCase()}.\n${reason}` : `They're yours to keep.\n${reason}`,
      link: '/app/leave',
      actionLabel: 'Apply',
    });
  }

  /** Cancel what someone owes: days owed from earlier years, and/or this year's minus balance. */
  async waive(companyId: string, access: AccessContext, balanceId: string, dto: WaiveDto) {
    const b = await this.prisma.leaveBalance.findFirst({ where: { id: balanceId, companyId }, include: { leaveType: true } });
    if (!b) throw new NotFoundException('Balance not found');
    await this.assertMayAdjust(companyId, access, LeaveAdjustmentKind.EXTRA, b.employeeId);
    const type = await this.types.get(companyId, b.leaveTypeId);
    const person = await this.person(companyId, b.employeeId);
    const today = new Date();
    const minus = Math.max(0, -(availableDays(type.accrual, b.allocated, effective(type, b, b.year, today)) ?? 0));
    if (!b.owedLeft && !minus) throw new BadRequestException('Nothing is owed on this balance');
    await this.prisma.$transaction(async (tx) => {
      await this.ensure(tx, companyId, person, type, b.year);
      await tx.leaveBalance.update({
        where: { id: b.id },
        data: {
          owedLeft: 0,
          // Bringing this year's minus back to 0 means nothing is owed when the year closes
          adjusted: { increment: minus },
          adjustments: { create: { kind: LeaveAdjustmentKind.WAIVED, days: minus, owedDays: toHalf(b.owedLeft + minus), reason: dto.note, adjustedById: access.userId } },
        },
      });
    });
    const e = await this.prisma.employee.findUnique({ where: { id: b.employeeId }, select: { userId: true } });
    void this.notifications.notify({
      companyId,
      userIds: [e?.userId],
      type: 'leave.owed_waived',
      title: `HR cancelled the ${plural(toHalf(b.owedLeft + minus))} of ${type.name.toLowerCase()} you owed`,
      body: dto.note,
      link: '/app/leave',
    });
    return { waived: toHalf(b.owedLeft + minus) };
  }

  /**
   * Who owes days, or will at year end: balances below 0, days lent, owed
   * from earlier years — for the people the caller can lend / give for.
   */
  async owed(companyId: string, access: AccessContext, query: OwedQueryDto) {
    const year = query.year ?? new Date().getUTCFullYear();
    const reach = this.access.employeeScope(access, ADJUST) ?? this.access.requireEmployeeScope(access, EXTRA_DECIDE);
    const rows = await this.prisma.leaveBalance.findMany({
      where: { companyId, year, employee: reach, OR: [{ lendLimit: { gt: 0 } }, { owedLeft: { gt: 0 } }, { leaveType: { negativeBalance: { gt: 0 } } }] },
      include: { leaveType: true, employee: { select: { id: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, employmentStatus: true, joiningDate: true } } },
      take: 2000,
    });
    const today = new Date();
    const out = [];
    for (const b of rows) {
      const raw = availableDays(b.leaveType.accrual, b.allocated, effective(b.leaveType, b, year, today)) ?? 0;
      const accrued = accruedSoFar({ accrual: b.leaveType.accrual, allocated: b.allocated, year, joining: b.employee.joiningDate, today });
      const now = availableDays(b.leaveType.accrual, accrued, effective(b.leaveType, b, year, today)) ?? 0;
      const close = closeYear({ left: raw, carryForward: b.leaveType.carryForward, maxCarry: b.leaveType.maxCarryForward, lendLimit: b.lendLimit, recoverNegative: b.leaveType.recoverNegative, owedLeft: b.owedLeft });
      if (!close.owedOut && !b.lendLimit && now >= 0) continue;
      const { joiningDate: _j, ...employee } = b.employee;
      out.push({
        balanceId: b.id,
        employee,
        leaving: b.employee.employmentStatus === EmploymentStatus.NOTICE_PERIOD || b.employee.employmentStatus === EmploymentStatus.TERMINATED,
        leaveType: { id: b.leaveType.id, name: b.leaveType.name, code: b.leaveType.code, color: b.leaveType.color },
        available: now,
        lent: b.lendLimit,
        owedLeft: b.owedLeft,
        /** Taken from next year's balance if nothing changes */
        owesAtYearEnd: close.owedOut,
      });
    }
    out.sort((a, b) => b.owesAtYearEnd - a.owesAtYearEnd || a.employee.firstName.localeCompare(b.employee.firstName));
    return { year, rows: out };
  }

  /**
   * One person's leave statement for a type and year, like a bank statement:
   * opening, credits, carried in, adjustments, leave, year end — with a running balance.
   */
  async ledger(companyId: string, access: AccessContext, query: LedgerQueryDto) {
    const employeeId = query.employeeId ?? access.employee?.id;
    if (!employeeId) throw new BadRequestException('Your account has no employee profile');
    await this.access.assertEmployeeInScope(access, 'leave.view', companyId, employeeId);
    const year = query.year ?? new Date().getUTCFullYear();
    const type = await this.types.get(companyId, query.leaveTypeId);
    const person = await this.person(companyId, employeeId);
    const b = hasBalance(type) ? await this.ensure(this.prisma, companyId, person, type, year) : await this.prisma.leaveBalance.findUnique({ where: { companyId_employeeId_leaveTypeId_year: { companyId, employeeId, leaveTypeId: type.id, year } } });
    type Entry = { date: string; kind: string; label: string; days: number | null; note?: string | null; by?: string | null; pending?: boolean };
    const entries: Entry[] = [];
    const start = `${year}-01-01`;
    const joined = dayKey(person.joiningDate);
    const opening = joined > start ? joined : start;
    const today = new Date();
    const todayKey = dayKey(today);

    if (b && hasBalance(type)) {
      if (type.accrual === 'MONTHLY') {
        // One credit per month served, as they are credited (start of each month)
        let credited = 0;
        for (let m = 0; m < 12; m++) {
          const at = new Date(Date.UTC(year, m, 1));
          if (dayKey(at) > todayKey) break;
          const so = accruedSoFar({ accrual: 'MONTHLY', allocated: b.allocated, year, joining: person.joiningDate, today: new Date(Date.UTC(year, m, 15)) });
          if (so > credited) {
            entries.push({ date: dayKey(at) < opening ? opening : dayKey(at), kind: 'CREDIT', label: `Monthly credit (${b.allocated} for the year)`, days: toHalf(so - credited) });
            credited = so;
          }
        }
      } else {
        entries.push({ date: opening, kind: 'OPENING', label: joined > start ? `Opening: ${b.allocated} (from joining)` : `Opening: ${b.allocated} for the year`, days: b.allocated });
      }
      if (b.carriedForward) entries.push({ date: start, kind: 'CARRIED_IN', label: `Carried over from ${year - 1}`, days: b.carriedForward });
      const usable = effective(type, b, year, today).carriedForward;
      if (type.carryExpiry && usable < b.carriedForward) entries.push({ date: `${year}-${type.carryExpiry}`, kind: 'CARRY_EXPIRED', label: 'Carried days not used in time expired', days: toHalf(usable - b.carriedForward) });
    }
    if (type.availability === 'GRANT_ONLY') {
      const grants = await this.prisma.leaveGrant.findMany({ where: { companyId, employeeId, leaveTypeId: type.id, status: 'ACTIVE', validFrom: { lte: new Date(`${year}-12-31`) }, validTo: { gte: new Date(start) } } });
      for (const g of grants) entries.push({ date: dayKey(g.validFrom), kind: 'GRANT', label: `Granted · use by ${dayKey(g.validTo)}`, days: g.days, note: g.reason });
    }
    if (b) {
      const adjustments = await this.prisma.leaveBalanceAdjustment.findMany({
        where: { balanceId: b.id },
        orderBy: { createdAt: 'asc' },
        select: { kind: true, days: true, lendLimit: true, owedDays: true, reason: true, createdAt: true, adjustedBy: { select: { firstName: true, lastName: true } } },
      });
      const LABEL: Record<string, string> = { EXTRA: 'Extra days', LEND: 'Lent', CORRECTION: 'Correction', DEDUCTION: 'Deduction', TAKEN_BACK: 'Taken back', WAIVED: 'Owed days cancelled' };
      for (const a of adjustments) {
        const label = a.kind === 'LEND' ? `Lent: may go ${plural(a.lendLimit ?? 0)} below 0` : a.kind === 'WAIVED' ? `Owed days cancelled (${plural(a.owedDays ?? 0)})` : LABEL[a.kind] ?? a.kind;
        entries.push({ date: dayKey(a.createdAt), kind: a.kind, label, days: a.kind === 'LEND' ? null : a.days, note: a.reason, by: a.adjustedBy ? `${a.adjustedBy.firstName} ${a.adjustedBy.lastName}` : null });
      }
    }
    const leaves = await this.prisma.leaveRequest.findMany({
      where: { companyId, employeeId, leaveTypeId: type.id, status: { in: ['APPROVED', 'PENDING'] }, startDate: { gte: new Date(start), lte: new Date(`${year}-12-31`) } },
      orderBy: { startDate: 'asc' },
      select: { startDate: true, endDate: true, totalDays: true, status: true, halfDay: true },
    });
    for (const l of leaves) {
      const s1 = dayKey(l.startDate);
      const e1 = dayKey(l.endDate);
      entries.push({ date: s1, kind: 'LEAVE', label: `Leave ${s1 === e1 ? s1 : `${s1} – ${e1}`}${l.halfDay ? ' (half day)' : ''}`, days: -l.totalDays, pending: l.status === 'PENDING' });
    }
    entries.sort((x, y) => x.date.localeCompare(y.date));

    // Running balance (unlimited types have none)
    let running = 0;
    const rows = entries.map((e) => {
      if (e.days !== null) running = toHalf(running + e.days);
      return { ...e, balance: type.accrual === 'NONE' ? null : running };
    });
    if (b?.closedAt) {
      rows.push({
        date: `${year}-12-31`,
        kind: 'YEAR_END',
        label: `Year end: ${plural(b.carriedOut ?? 0)} carried · ${plural(b.lapsed ?? 0)} lapsed${b.owedOut ? ` · ${plural(b.owedOut)} owed to ${year + 1}` : ''}`,
        days: toHalf(-running),
        balance: 0,
      } as (typeof rows)[number]);
    }
    return {
      year,
      leaveType: { id: type.id, name: type.name, code: type.code, color: type.color, accrual: type.accrual },
      lent: b?.lendLimit ?? 0,
      owedLeft: b?.owedLeft ?? 0,
      closed: Boolean(b?.closedAt),
      entries: rows,
    };
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
    const [p] = await loadPeople(this.prisma, companyId, { id: employeeId });
    if (!p) throw new NotFoundException('Employee not found');
    return p;
  }
}
