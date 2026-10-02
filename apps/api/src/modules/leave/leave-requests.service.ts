import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveApprovalStatus, LeaveStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { AttendancePolicyService } from '../attendance/policy.service';
import { HolidaysService } from '../attendance/holidays.service';
import { addDays, dateFromKey, keyFromDate, localDateKey, monthKeys } from '../attendance/time-zone';
import { LeaveTypesService, type LeaveTypeRow } from './leave-types.service';
import { LeaveBalancesService, eligible } from './leave-balances.service';
import { countLeaveDays } from './leave-rules';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import type { CancelLeaveDto, CreateLeaveRequestDto, DecideLeaveDto, LeaveCalendarQueryDto, LeaveListQueryDto, LeaveRequestInputDto } from './dto';

const APPROVE = 'leave.approve';
const ACTIVE: LeaveStatus[] = [LeaveStatus.PENDING, LeaveStatus.APPROVED];

const NAME = { select: { id: true, firstName: true, lastName: true } } as const;
const SELECT = {
  id: true,
  startDate: true,
  endDate: true,
  halfDay: true,
  totalDays: true,
  reason: true,
  status: true,
  currentLevel: true,
  requiredLevels: true,
  createdAt: true,
  decidedAt: true,
  cancelledAt: true,
  cancelReason: true,
  employee: {
    select: {
      id: true,
      userId: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      designation: { select: { name: true } },
      department: { select: { id: true, name: true } },
    },
  },
  leaveType: { select: { id: true, name: true, code: true, color: true, countsAsPresent: true, isPaid: true } },
  approvals: {
    orderBy: { level: 'asc' },
    select: { level: true, status: true, approverId: true, comments: true, actedAt: true, approver: NAME, actedBy: NAME, onBehalfOf: NAME },
  },
} satisfies Prisma.LeaveRequestSelect;
type RequestRow = Prisma.LeaveRequestGetPayload<{ select: typeof SELECT }>;

type Decider = { mode: 'approver' | 'delegate' | 'override'; onBehalfOf: string | null };

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly policies: AttendancePolicyService,
    private readonly holidays: HolidaysService,
    private readonly types: LeaveTypesService,
    private readonly balances: LeaveBalancesService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Apply ─────────────────────────────────────────────────

  /** Checks a request without saving it: days, balance after, problems. */
  async preview(companyId: string, access: AccessContext, dto: LeaveRequestInputDto) {
    const person = await this.me(companyId, access);
    const type = await this.types.get(companyId, dto.leaveTypeId);
    const result = await this.evaluate(companyId, person, type, dto);
    return { ...result, leaveType: { id: type.id, name: type.name, accrual: type.accrual, approvalLevels: type.approvalLevels } };
  }

  async create(companyId: string, access: AccessContext, dto: CreateLeaveRequestDto) {
    const person = await this.me(companyId, access);
    const type = await this.types.get(companyId, dto.leaveTypeId);
    const check = await this.evaluate(companyId, person, type, dto);
    if (check.errors.length) throw new BadRequestException(check.errors[0]);

    const chain = await this.approverChain(companyId, person.id, type.approvalLevels);
    const auto = type.approvalLevels === 0;
    const year = Number(dto.startDate.slice(0, 4));

    const id = await this.prisma.$transaction(async (tx) => {
      // Re-check balance and overlaps inside the transaction (double submits)
      if (check.available !== null && (await this.balances.available(tx, companyId, person, type, year))! < check.days) {
        throw new BadRequestException('Not enough balance');
      }
      if (await this.overlapping(tx, companyId, person.id, dto.startDate, dto.endDate)) throw new ConflictException('You already have leave in these dates');

      const request = await tx.leaveRequest.create({
        data: {
          companyId,
          employeeId: person.id,
          leaveTypeId: type.id,
          startDate: dateFromKey(dto.startDate),
          endDate: dateFromKey(dto.endDate),
          halfDay: dto.halfDay ?? null,
          totalDays: check.days,
          reason: dto.reason,
          status: auto ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
          decidedAt: auto ? new Date() : null,
          currentLevel: 1,
          requiredLevels: chain.length,
          approvals: { create: chain.map((approverId, i) => ({ level: i + 1, approverId })) },
        },
        select: { id: true },
      });
      await this.balances.change(tx, companyId, person.id, type.id, year, auto ? { used: check.days } : { pending: check.days });
      return request.id;
    });
    if (!auto) void this.notifyApprovers(companyId, id);
    return this.getRow(companyId, access, id, true);
  }

  /**
   * Designated approver per level, walking up the reporting chain.
   * Levels without anyone above are dropped; if nobody is above at all,
   * one level is left for company-wide approvers (HR).
   */
  private async approverChain(companyId: string, employeeId: string, levels: number): Promise<Array<string | null>> {
    if (levels === 0) return [];
    const above = await this.prisma.employeeHierarchy.findMany({
      where: { companyId, descendantId: employeeId, depth: { gte: 1, lte: levels } },
      orderBy: { depth: 'asc' },
      select: { ancestor: { select: { userId: true, employmentStatus: true } } },
    });
    const chain = above.filter((a) => a.ancestor.employmentStatus !== 'TERMINATED').map((a) => a.ancestor.userId);
    return chain.length ? chain : [null];
  }

  private async evaluate(companyId: string, person: { id: string; joiningDate: Date; gender: string | null }, type: LeaveTypeRow, dto: LeaveRequestInputDto) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const policy = await this.policies.get(companyId);
    const todayKey = localDateKey(new Date(), policy.timeZone);

    if (!type.isActive) errors.push(`${type.name} is no longer available`);
    if (!eligible(type, person)) errors.push(`${type.name} isn’t available to you`);
    if (dto.endDate < dto.startDate) errors.push('The end date is before the start date');
    if (dto.startDate.slice(0, 4) !== dto.endDate.slice(0, 4)) errors.push('Leave can’t span two calendar years — split it into two requests');
    if (dto.halfDay && dto.startDate !== dto.endDate) errors.push('A half day must be a single date');
    if (dto.halfDay && !type.allowHalfDay) errors.push(`${type.name} can’t be taken as a half day`);
    if (dto.startDate < keyFromDate(person.joiningDate)) errors.push('That is before your joining date');
    if (dto.startDate < addDays(todayKey, -policy.regularisationWindowDays)) errors.push(`Leave can only be applied up to ${policy.regularisationWindowDays} days back`);
    if (dto.startDate >= todayKey && type.minNoticeDays > 0 && dto.startDate < addDays(todayKey, type.minNoticeDays)) {
      errors.push(`${type.name} needs ${type.minNoticeDays} day${type.minNoticeDays === 1 ? '' : 's'}’ notice`);
    }
    if (dto.startDate < todayKey) warnings.push('These dates are in the past');
    if (errors.length) return { days: 0, dates: [] as string[], available: null as number | null, after: null as number | null, errors, warnings };

    const holidays = await this.holidays.between(companyId, dto.startDate, dto.endDate);
    const holidayKeys = new Set([...holidays.entries()].filter(([, h]) => !h.isOptional).map(([k]) => k));
    const { days, dates } = countLeaveDays({
      startKey: dto.startDate,
      endKey: dto.endDate,
      halfDay: dto.halfDay ?? null,
      includeNonWorkingDays: type.includeNonWorkingDays,
      workDays: policy.workDays,
      holidayKeys,
    });
    if (!days) errors.push('There are no working days in these dates');
    if (type.maxConsecutiveDays && days > type.maxConsecutiveDays) errors.push(`${type.name} allows at most ${type.maxConsecutiveDays} days at a time`);
    if (await this.overlapping(this.prisma, companyId, person.id, dto.startDate, dto.endDate)) errors.push('You already have leave in these dates');

    const year = Number(dto.startDate.slice(0, 4));
    const available = await this.balances.available(this.prisma, companyId, person, type, year);
    if (available !== null && days > available) errors.push(`Not enough balance — ${available} day${available === 1 ? '' : 's'} available`);
    return { days, dates, available, after: available === null ? null : available - days, errors, warnings };
  }

  private async overlapping(db: PrismaService | Prisma.TransactionClient, companyId: string, employeeId: string, startKey: string, endKey: string) {
    return (
      (await db.leaveRequest.count({
        where: { companyId, employeeId, status: { in: ACTIVE }, startDate: { lte: dateFromKey(endKey) }, endDate: { gte: dateFromKey(startKey) } },
      })) > 0
    );
  }

  // ─── Decide ────────────────────────────────────────────────

  async approve(companyId: string, access: AccessContext, id: string, dto: DecideLeaveDto) {
    const { request, decider } = await this.decidable(companyId, access, id);
    const next = request.approvals.find((a) => a.level > request.currentLevel && a.status === LeaveApprovalStatus.PENDING);
    const year = request.startDate.getUTCFullYear();

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leaveApproval.updateMany({
        where: { leaveRequestId: id, level: request.currentLevel, status: LeaveApprovalStatus.PENDING },
        data: { status: LeaveApprovalStatus.APPROVED, actedById: access.userId, onBehalfOfId: decider.onBehalfOf, comments: dto.note ?? null, actedAt: new Date() },
      });
      if (!count) throw new ConflictException('This request has already been decided');
      if (next && decider.mode !== 'override') {
        await tx.leaveRequest.update({ where: { id }, data: { currentLevel: next.level } });
        return;
      }
      // Final approval (a company-wide approver's decision also settles the remaining levels)
      await tx.leaveApproval.updateMany({ where: { leaveRequestId: id, status: LeaveApprovalStatus.PENDING }, data: { status: LeaveApprovalStatus.SKIPPED } });
      await tx.leaveRequest.update({ where: { id }, data: { status: LeaveStatus.APPROVED, decidedAt: new Date() } });
      await this.balances.change(tx, companyId, request.employee.id, request.leaveType.id, year, { pending: -request.totalDays, used: request.totalDays });
    });
    const row = await this.getRow(companyId, access, id, true);
    if (row.status === LeaveStatus.PENDING) void this.notifyApprovers(companyId, id);
    else void this.notifyEmployee(companyId, request, 'leave.approved', `Your ${request.leaveType.name.toLowerCase()} was approved`, this.decidedBy(row, dto.note));
    return row;
  }

  async reject(companyId: string, access: AccessContext, id: string, dto: DecideLeaveDto) {
    const { request, decider } = await this.decidable(companyId, access, id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leaveApproval.updateMany({
        where: { leaveRequestId: id, level: request.currentLevel, status: LeaveApprovalStatus.PENDING },
        data: { status: LeaveApprovalStatus.REJECTED, actedById: access.userId, onBehalfOfId: decider.onBehalfOf, comments: dto.note ?? null, actedAt: new Date() },
      });
      if (!count) throw new ConflictException('This request has already been decided');
      await tx.leaveApproval.updateMany({ where: { leaveRequestId: id, status: LeaveApprovalStatus.PENDING }, data: { status: LeaveApprovalStatus.SKIPPED } });
      await tx.leaveRequest.update({ where: { id }, data: { status: LeaveStatus.REJECTED, decidedAt: new Date() } });
      await this.balances.change(tx, companyId, request.employee.id, request.leaveType.id, request.startDate.getUTCFullYear(), { pending: -request.totalDays });
    });
    const row = await this.getRow(companyId, access, id, true);
    void this.notifyEmployee(companyId, request, 'leave.rejected', `Your ${request.leaveType.name.toLowerCase()} was not approved`, this.decidedBy(row, dto.note));
    return row;
  }

  async cancel(companyId: string, access: AccessContext, id: string, dto: CancelLeaveDto) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!request) throw new NotFoundException('Leave request not found');
    const todayKey = localDateKey(new Date(), (await this.policies.get(companyId)).timeZone);
    if (!this.canCancel(access, request, todayKey)) {
      if (request.employee.userId === access.userId || this.companyWide(access)) {
        throw new BadRequestException('Only pending leave, or approved leave that hasn’t started, can be cancelled — ask HR');
      }
      throw new NotFoundException('Leave request not found');
    }
    const wasApproved = request.status === LeaveStatus.APPROVED;
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leaveRequest.updateMany({
        where: { id, status: request.status },
        data: { status: LeaveStatus.CANCELLED, cancelledAt: new Date(), cancelledById: access.userId, cancelReason: dto.reason ?? null },
      });
      if (!count) throw new ConflictException('This request has changed — refresh and try again');
      await tx.leaveApproval.updateMany({ where: { leaveRequestId: id, status: LeaveApprovalStatus.PENDING }, data: { status: LeaveApprovalStatus.SKIPPED } });
      await this.balances.change(
        tx,
        companyId,
        request.employee.id,
        request.leaveType.id,
        request.startDate.getUTCFullYear(),
        wasApproved ? { used: -request.totalDays } : { pending: -request.totalDays },
      );
    });
    if (request.employee.userId !== access.userId) {
      void this.notifyEmployee(companyId, request, 'leave.cancelled', `Your ${request.leaveType.name.toLowerCase()} was cancelled`, dto.reason ? `Reason: ${dto.reason}` : null);
    } else if (!wasApproved) {
      // Withdrawn while pending: let the approver know it no longer needs them (in-app only)
      const level = request.approvals.find((a) => a.level === request.currentLevel);
      const to = level?.approverId ? [level.approverId, ...(await this.notifications.coveringFor([level.approverId]))] : [];
      void this.notifications.notify({
        companyId,
        userIds: to,
        type: 'leave.withdrawn',
        title: `${request.employee.firstName} ${request.employee.lastName} withdrew a leave request`,
        body: `${request.leaveType.name}, ${dateRange(keyFromDate(request.startDate), keyFromDate(request.endDate))}`,
        link: '/app/leave/approvals',
        email: false,
      });
    }
    return this.getRow(companyId, access, id, true);
  }

  /** Pending request at a level the caller may decide (never their own). */
  private async decidable(companyId: string, access: AccessContext, id: string) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!request || request.employee.userId === access.userId) throw new NotFoundException('Leave request not found');
    if (request.status !== LeaveStatus.PENDING) throw new ConflictException('This request has already been decided');
    const decider = this.deciderFor(access, request);
    if (!decider) throw new ForbiddenException('This request is waiting for someone else');
    return { request, decider };
  }

  /** How the caller may decide the current level, if at all. */
  private deciderFor(access: AccessContext, request: RequestRow): Decider | null {
    if (request.status !== LeaveStatus.PENDING || request.employee.userId === access.userId) return null;
    const row = request.approvals.find((a) => a.level === request.currentLevel);
    if (!row || row.status !== LeaveApprovalStatus.PENDING) return null;
    if (row.approverId && row.approverId === access.userId && access.grants.has(APPROVE)) return { mode: 'approver', onBehalfOf: null };
    const covering = row.approverId ? access.delegations.find((d) => d.fromUserId === row.approverId && d.grants.has(APPROVE)) : undefined;
    if (covering) return { mode: 'delegate', onBehalfOf: covering.fromUserId };
    if (this.companyWide(access)) return { mode: 'override', onBehalfOf: null };
    return null;
  }

  /** HR / Company Admin: leave.approve across the whole company. */
  private companyWide(access: AccessContext): boolean {
    return access.isSuperAdmin || access.isOwner || (access.grants.has(APPROVE) && (access.grants.get(APPROVE) ?? 'company') === 'company');
  }

  private canCancel(access: AccessContext, r: RequestRow, todayKey: string): boolean {
    if (!ACTIVE.includes(r.status)) return false;
    if (this.companyWide(access)) return true;
    if (r.employee.userId !== access.userId) return false;
    return r.status === LeaveStatus.PENDING || keyFromDate(r.startDate) > todayKey;
  }

  // ─── Notifications ─────────────────────────────────────────

  /** Tell whoever decides the current level (and anyone covering for them). */
  private async notifyApprovers(companyId: string, id: string) {
    const r = await this.prisma.leaveRequest.findUnique({ where: { id }, select: SELECT });
    if (!r || r.status !== LeaveStatus.PENDING) return;
    const level = r.approvals.find((a) => a.level === r.currentLevel);
    const to = level?.approverId
      ? [level.approverId, ...(await this.notifications.coveringFor([level.approverId]))]
      : await this.notifications.companyWideApprovers(companyId, APPROVE);
    const who = `${r.employee.firstName} ${r.employee.lastName}`;
    const step = r.requiredLevels > 1 ? ` (approval ${r.currentLevel} of ${r.requiredLevels})` : '';
    await this.notifications.notify({
      companyId,
      userIds: to.filter((u) => u !== r.employee.userId),
      type: 'leave.submitted',
      title: `${who} requested ${r.leaveType.name.toLowerCase()}${step}`,
      body: `${dateRange(keyFromDate(r.startDate), keyFromDate(r.endDate))} · ${r.totalDays} day${r.totalDays === 1 ? '' : 's'}\nReason: ${r.reason}`,
      link: '/app/leave/approvals',
      actionLabel: 'Review request',
    });
  }

  private async notifyEmployee(companyId: string, r: RequestRow, type: string, title: string, body: string | null) {
    await this.notifications.notify({
      companyId,
      userIds: [r.employee.userId],
      type,
      title,
      body: [`${r.leaveType.name}, ${dateRange(keyFromDate(r.startDate), keyFromDate(r.endDate))}`, body].filter(Boolean).join('\n'),
      link: '/app/leave',
      actionLabel: 'View my leave',
    });
  }

  /** "Decided by Priya Sharma (for Ravi Kumar): note" */
  private decidedBy(row: { approvals: Array<{ status: string; actedBy: { firstName: string; lastName: string } | null; onBehalfOf: { firstName: string; lastName: string } | null }> }, note?: string | null): string | null {
    const acted = [...row.approvals].reverse().find((a) => a.actedBy && a.status !== 'PENDING' && a.status !== 'SKIPPED');
    const by = acted?.actedBy ? `By ${acted.actedBy.firstName} ${acted.actedBy.lastName}${acted.onBehalfOf ? ` (for ${acted.onBehalfOf.firstName} ${acted.onBehalfOf.lastName})` : ''}` : null;
    return [by, note ? `Note: ${note}` : null].filter(Boolean).join('\n') || null;
  }

  // ─── Read ──────────────────────────────────────────────────

  async list(companyId: string, access: AccessContext, query: LeaveListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters: Prisma.LeaveRequestWhereInput = {
      companyId,
      ...(query.status && { status: query.status }),
      ...(query.leaveTypeId && { leaveTypeId: query.leaveTypeId }),
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.to && { startDate: { lte: dateFromKey(query.to) } }),
      ...(query.from && { endDate: { gte: dateFromKey(query.from) } }),
    };

    let where: Prisma.LeaveRequestWhereInput;
    if (query.view === 'mine') {
      if (!access.employee) return this.page(companyId, [], 0, page, limit, access);
      where = { ...filters, employeeId: access.employee.id };
    } else if (query.view === 'all') {
      where = { ...filters, employee: this.access.requireEmployeeScope(access, 'leave.view') };
    } else {
      // Waiting for me: current level is mine, someone I cover for, or (company-wide) unassigned / anyone
      const covering = access.delegations.filter((d) => d.grants.has(APPROVE)).map((d) => d.fromUserId);
      const pending = await this.prisma.leaveRequest.findMany({
        where: {
          companyId,
          status: LeaveStatus.PENDING,
          employee: { userId: { not: access.userId } },
          ...(this.companyWide(access) ? {} : { approvals: { some: { status: LeaveApprovalStatus.PENDING, approverId: { in: [access.userId, ...covering] } } } }),
        },
        select: SELECT,
        orderBy: { startDate: 'asc' },
      });
      const mine = pending.filter((r) => {
        const row = r.approvals.find((a) => a.level === r.currentLevel);
        if (!row) return false;
        if (row.approverId === access.userId || (row.approverId && covering.includes(row.approverId))) return Boolean(this.deciderFor(access, r));
        return this.companyWide(access) && row.approverId === null;
      });
      return this.page(companyId, mine.slice((page - 1) * limit, page * limit), mine.length, page, limit, access);
    }

    const [rows, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({ where, select: SELECT, orderBy: { startDate: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return this.page(companyId, rows, total, page, limit, access);
  }

  async pendingCount(companyId: string, access: AccessContext): Promise<number> {
    if (!access.grants.has(APPROVE) && !access.delegations.some((d) => d.grants.has(APPROVE)) && !access.isSuperAdmin) return 0;
    return (await this.list(companyId, access, { view: 'review', limit: 100 })).meta.total;
  }

  /** `decided`: the caller just acted on it, so it is theirs to see. */
  async getRow(companyId: string, access: AccessContext, id: string, decided = false) {
    const r = await this.prisma.leaveRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!r) throw new NotFoundException('Leave request not found');
    const scope = this.access.employeeScope(access, 'leave.view');
    const visible =
      r.employee.userId === access.userId ||
      Boolean(this.deciderFor(access, r)) ||
      decided ||
      r.approvals.some((a) => a.approverId === access.userId || access.delegations.some((d) => d.fromUserId === a.approverId && d.grants.has(APPROVE))) ||
      (scope !== null && (await this.prisma.employee.count({ where: { AND: [{ id: r.employee.id }, scope] } })) > 0);
    if (!visible) throw new NotFoundException('Leave request not found');
    const todayKey = localDateKey(new Date(), (await this.policies.get(companyId)).timeZone);
    return this.present(r, access, todayKey);
  }

  /** Who is off in a month (approved + pending), within the caller's leave.view reach. */
  async calendar(companyId: string, access: AccessContext, query: LeaveCalendarQueryDto) {
    const scope = this.access.requireEmployeeScope(access, 'leave.view');
    const keys = monthKeys(query.month);
    const [from, to] = [keys[0]!, keys[keys.length - 1]!];
    const [rows, holidays] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          companyId,
          status: { in: ACTIVE },
          startDate: { lte: dateFromKey(to) },
          endDate: { gte: dateFromKey(from) },
          employee: { AND: [scope, ...(query.departmentId ? [{ departmentId: query.departmentId }] : [])] },
        },
        select: SELECT,
        orderBy: { startDate: 'asc' },
      }),
      this.holidays.between(companyId, from, to),
    ]);
    const todayKey = localDateKey(new Date(), (await this.policies.get(companyId)).timeZone);
    return {
      month: query.month,
      holidays: [...holidays.values()].map((h) => ({ id: h.id, name: h.name, date: keyFromDate(h.date), isOptional: h.isOptional })),
      leaves: rows.map((r) => this.present(r, access, todayKey)),
    };
  }

  private async page(companyId: string, rows: RequestRow[], total: number, page: number, limit: number, access: AccessContext) {
    const todayKey = localDateKey(new Date(), (await this.policies.get(companyId)).timeZone);
    return { data: rows.map((r) => this.present(r, access, todayKey)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private present(r: RequestRow, access: AccessContext, todayKey: string) {
    const { userId: _u, ...employee } = r.employee;
    const decider = this.deciderFor(access, r);
    return {
      ...r,
      employee,
      startDate: keyFromDate(r.startDate),
      endDate: keyFromDate(r.endDate),
      approvals: r.approvals.map(({ approverId: _a, ...a }) => a),
      canDecide: Boolean(decider),
      decideAs: decider?.mode ?? null,
      canCancel: this.canCancel(access, r, todayKey),
    };
  }

  private async me(companyId: string, access: AccessContext) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    return this.balances.person(companyId, access.employee.id);
  }
}
