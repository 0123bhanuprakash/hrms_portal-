import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EmploymentStatus, LeaveApprovalStatus, LeaveStatus, Prisma } from '@prisma/client';
import { PrivateFilesService } from '../employee-profile/private-files.service';
import { detectFileType, DOCUMENT_TYPES } from '../employee-profile/file-types';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { covering, type AccessContext } from '../access/access.types';
import { AttendancePolicyService } from '../attendance/policy.service';
import { HolidaysService } from '../attendance/holidays.service';
import { addDays, dateFromKey, keyFromDate, localDateKey, monthKeys } from '../attendance/time-zone';
import { LeaveTypesService, type LeaveTypeRow } from './leave-types.service';
import { LeaveBalancesService, eligible } from './leave-balances.service';
import { countLeaveDays } from './leave-rules';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { ApprovalRouterService } from '../projects/approval-router.service';
import type { AskQuestionDto, CancelLeaveDto, CreateLeaveRequestDto, DecideLeaveDto, LeaveCalendarQueryDto, LeaveListQueryDto, LeaveRequestInputDto } from './dto';

const DOC_MAX_BYTES = 10 * 1024 * 1024;

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
  documentName: true,
  documentSize: true,
  documentMime: true,
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
  leaveType: { select: { id: true, name: true, code: true, color: true, countsAsPresent: true, isPaid: true, documentAfterDays: true } },
  approvals: {
    orderBy: { level: 'asc' },
    select: { level: true, status: true, approverId: true, approverIds: true, label: true, actedById: true, comments: true, actedAt: true, approver: NAME, actedBy: NAME, onBehalfOf: NAME },
  },
} satisfies Prisma.LeaveRequestSelect;
type RequestRow = Prisma.LeaveRequestGetPayload<{ select: typeof SELECT }>;

/** Just what "can I decide this?" needs — for counts and the waiting-for-me filter. */
const DECIDE_SELECT = {
  id: true,
  status: true,
  currentLevel: true,
  employee: { select: { userId: true } },
  approvals: { select: { level: true, status: true, approverId: true, approverIds: true, actedById: true } },
} satisfies Prisma.LeaveRequestSelect;
type DecideRow = Prisma.LeaveRequestGetPayload<{ select: typeof DECIDE_SELECT }>;

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
    private readonly router: ApprovalRouterService,
    private readonly files: PrivateFilesService,
  ) {}

  // ─── Apply ─────────────────────────────────────────────────

  /** Checks a request without saving it: days, balance after, problems. */
  async preview(companyId: string, access: AccessContext, dto: LeaveRequestInputDto) {
    const person = await this.me(companyId, access);
    const type = await this.types.get(companyId, dto.leaveTypeId);
    const result = await this.evaluate(companyId, person, type, dto);
    const ok = dto.endDate >= dto.startDate;
    const route = ok ? await this.router.route(companyId, person.id, dto.startDate, dto.endDate, type.approvalLevels) : { mode: 'reporting_line' as const, levels: [] };
    const names = await this.router.names(route.levels.flatMap((l) => l.approverIds));
    return {
      ...result,
      leaveType: { id: type.id, name: type.name, accrual: type.accrual, approvalLevels: type.approvalLevels },
      route: {
        mode: route.mode,
        levels: route.levels.map((l) => ({ label: l.label, approvers: l.approverIds.map((id) => names.get(id)).filter(Boolean) })),
      },
    };
  }

  async create(companyId: string, access: AccessContext, dto: CreateLeaveRequestDto) {
    const person = await this.me(companyId, access);
    const type = await this.types.get(companyId, dto.leaveTypeId);
    const check = await this.evaluate(companyId, person, type, dto);
    if (check.errors.length) throw new BadRequestException(check.errors[0]);

    const route = await this.router.route(companyId, person.id, dto.startDate, dto.endDate, type.approvalLevels);
    const auto = type.approvalLevels === 0;
    const year = Number(dto.startDate.slice(0, 4));

    const id = await this.prisma.$transaction(async (tx) => {
      // Re-check balance and overlaps inside the transaction (double submits)
      if (check.available !== null && (await this.balances.available(tx, companyId, person, type, year))! + type.negativeBalance < check.days) {
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
          requiredLevels: route.levels.length,
          approvals: {
            create: route.levels.map((l, i) => ({ level: i + 1, approverId: l.approverIds[0] ?? null, approverIds: l.approverIds, label: l.label })),
          },
        },
        select: { id: true },
      });
      await this.balances.change(tx, companyId, person.id, type.id, year, auto ? { used: check.days } : { pending: check.days });
      return request.id;
    });
    if (!auto) void this.notifyApprovers(companyId, id);
    return this.getRow(companyId, access, id, true);
  }

  private async evaluate(companyId: string, person: { id: string; joiningDate: Date; gender: string | null; employmentStatus?: EmploymentStatus; locationId?: string | null }, type: LeaveTypeRow, dto: LeaveRequestInputDto) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const policy = await this.policies.get(companyId);
    const todayKey = localDateKey(new Date(), policy.timeZone);

    if (!type.isActive) errors.push(`${type.name} is no longer available`);
    if (!eligible(type, person)) errors.push(`${type.name} isn’t available to you`);
    if (type.blockDuringProbation && person.employmentStatus === EmploymentStatus.PROBATION) errors.push(`${type.name} can be used once your probation is over`);
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
    if (errors.length) return { days: 0, dates: [] as string[], available: null as number | null, after: null as number | null, needsDocument: false, errors, warnings };

    // The person's own days off: holidays for everyone / their office, plus optional ones they picked
    const holidayKeys = await this.holidays.keysFor(companyId, { id: person.id, locationId: person.locationId ?? null }, dto.startDate, dto.endDate);
    const { days, dates } = countLeaveDays({
      startKey: dto.startDate,
      endKey: dto.endDate,
      halfDay: dto.halfDay ?? null,
      includeNonWorkingDays: type.includeNonWorkingDays,
      workDays: policy.workDays,
      holidayKeys,
      sandwich: type.sandwichRule,
    });
    if (!days) errors.push('There are no working days in these dates');
    if (type.maxConsecutiveDays && days > type.maxConsecutiveDays) errors.push(`${type.name} allows at most ${type.maxConsecutiveDays} days at a time`);
    if (await this.overlapping(this.prisma, companyId, person.id, dto.startDate, dto.endDate)) errors.push('You already have leave in these dates');

    const year = Number(dto.startDate.slice(0, 4));
    const available = await this.balances.available(this.prisma, companyId, person, type, year);
    if (available !== null && days > available + type.negativeBalance) {
      errors.push(`Not enough balance — ${available} day${available === 1 ? '' : 's'} available${type.negativeBalance ? ` (+${type.negativeBalance} in advance)` : ''}`);
    } else if (available !== null && days > available) warnings.push(`${days - available} day${days - available === 1 ? '' : 's'} taken in advance — your balance goes below 0`);
    const offInside = dates.filter((d) => holidayKeys.has(d) || !policy.workDays.includes(new Date(d + 'T00:00:00Z').getUTCDay())).length;
    if (type.sandwichRule && !type.includeNonWorkingDays && offInside) warnings.push(`${offInside} weekend / holiday day${offInside === 1 ? '' : 's'} between your leave days count as leave (company rule)`);
    const needsDocument = type.documentAfterDays !== null && days > type.documentAfterDays;
    if (needsDocument) warnings.push(`Please attach a document (asked for ${type.name.toLowerCase()} over ${type.documentAfterDays} day${type.documentAfterDays === 1 ? '' : 's'})`);
    return { days, dates, available, after: available === null ? null : available - days, needsDocument, errors, warnings };
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
      const pool = level ? this.pool(level) : [];
      const to = [...pool, ...(await this.notifications.coveringFor(pool, APPROVE))];
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
  private deciderFor(access: AccessContext, request: DecideRow): Decider | null {
    if (request.status !== LeaveStatus.PENDING || request.employee.userId === access.userId) return null;
    const row = request.approvals.find((a) => a.level === request.currentLevel);
    if (!row || row.status !== LeaveApprovalStatus.PENDING) return null;
    if (this.companyWide(access)) {
      // HR / Company Admin settles the request — unless they are simply in this level's pool
      if (!this.pool(row).includes(access.userId)) return { mode: 'override', onBehalfOf: null };
    }
    // The same person never approves two levels of one request
    const decidedBefore = request.approvals.some((a) => a.level < row.level && a.actedById === access.userId);
    if (decidedBefore) return this.companyWide(access) ? { mode: 'override', onBehalfOf: null } : null;
    const pool = this.pool(row);
    if (pool.includes(access.userId)) return { mode: 'approver', onBehalfOf: null };
    // Covering for someone in the pool (their authority may come from a project, not a role)
    const cover = covering(access, APPROVE).find((d) => pool.includes(d.fromUserId));
    if (cover) return { mode: 'delegate', onBehalfOf: cover.fromUserId };
    return null;
  }

  /** Everyone who may decide a level (older rows only have approverId). */
  private pool(row: { approverId: string | null; approverIds: string[] }): string[] {
    return row.approverIds.length ? row.approverIds : row.approverId ? [row.approverId] : [];
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
    const pool = level ? this.pool(level) : [];
    const to = pool.length ? [...pool, ...(await this.notifications.coveringFor(pool, APPROVE))] : await this.notifications.companyWideApprovers(companyId, APPROVE);
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
      // Filter on the light rows, then load full details only for this page
      const ids = await this.waitingForMe(companyId, access);
      const pageIds = ids.slice((page - 1) * limit, page * limit);
      const rows = pageIds.length ? await this.prisma.leaveRequest.findMany({ where: { id: { in: pageIds } }, select: SELECT }) : [];
      rows.sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id));
      return this.page(companyId, rows, ids.length, page, limit, access, true);
    }

    const [rows, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({ where, select: SELECT, orderBy: { startDate: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return this.page(companyId, rows, total, page, limit, access, query.view === 'all');
  }

  /** Ids of requests waiting for me (soonest first): current level is mine, someone I cover for, or (company-wide) unassigned / anyone. */
  private async waitingForMe(companyId: string, access: AccessContext): Promise<string[]> {
    const coveredIds = covering(access, APPROVE).map((d) => d.fromUserId);
    const pending = await this.prisma.leaveRequest.findMany({
      where: {
        companyId,
        status: LeaveStatus.PENDING,
        employee: { userId: { not: access.userId } },
        ...(this.companyWide(access) ? {} : { approvals: { some: { status: LeaveApprovalStatus.PENDING, approverIds: { hasSome: [access.userId, ...coveredIds] } } } }),
      },
      select: DECIDE_SELECT,
      orderBy: { startDate: 'asc' },
    });
    const mine = pending.filter((r) => {
      const row = r.approvals.find((a) => a.level === r.currentLevel);
      if (!row) return false;
      const pool = this.pool(row);
      if (pool.includes(access.userId) || pool.some((u) => coveredIds.includes(u))) return Boolean(this.deciderFor(access, r));
      return this.companyWide(access) && pool.length === 0;
    });
    return mine.map((r) => r.id);
  }

  /** The badge: same rule as the approvals list, without building the list. */
  async pendingCount(companyId: string, access: AccessContext): Promise<number> {
    return (await this.waitingForMe(companyId, access)).length;
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
      r.approvals.some((a) => this.pool(a).includes(access.userId) || covering(access, APPROVE).some((d) => this.pool(a).includes(d.fromUserId))) ||
      (scope !== null && (await this.prisma.employee.count({ where: { AND: [{ id: r.employee.id }, scope] } })) > 0);
    if (!visible) throw new NotFoundException('Leave request not found');
    const todayKey = localDateKey(new Date(), (await this.policies.get(companyId)).timeZone);
    return this.present(r, access, todayKey, await this.poolNames([r]));
  }

  /** Who is off in a month (approved + pending), within the caller's leave.view reach. */
  async calendar(companyId: string, access: AccessContext, query: LeaveCalendarQueryDto) {
    const reach = this.access.requireEmployeeScope(access, 'leave.view');
    // Everyone also sees their own team (same manager, their reports, shared projects)
    const team = access.employee ? await this.teammates(companyId, access.employee.id) : [];
    const scope: Prisma.EmployeeWhereInput = team.length ? { OR: [reach, { id: { in: team } }] } : reach;
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
    const names = await this.poolNames(rows);
    return {
      month: query.month,
      holidays: [...holidays.values()].map((h) => ({ id: h.id, name: h.name, date: keyFromDate(h.date), isOptional: h.isOptional })),
      leaves: rows.map((r) => this.present(r, access, todayKey, names)),
    };
  }

  private async page(companyId: string, rows: RequestRow[], total: number, page: number, limit: number, access: AccessContext, withClashes = false) {
    const todayKey = localDateKey(new Date(), (await this.policies.get(companyId)).timeZone);
    const names = await this.poolNames(rows);
    const clashes = withClashes ? await this.clashes(companyId, rows.filter((r) => r.status === LeaveStatus.PENDING)) : new Map();
    return { data: rows.map((r) => ({ ...this.present(r, access, todayKey, names), ...(clashes.get(r.id) && { team: clashes.get(r.id) }) })), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private poolNames(rows: RequestRow[]) {
    return this.router.names(rows.flatMap((r) => r.approvals.flatMap((a) => this.pool(a))));
  }

  private present(r: RequestRow, access: AccessContext, todayKey: string, names: Map<string, { id: string; firstName: string; lastName: string }> = new Map()) {
    const { userId: _u, ...employee } = r.employee;
    const decider = this.deciderFor(access, r);
    return {
      ...r,
      employee,
      startDate: keyFromDate(r.startDate),
      endDate: keyFromDate(r.endDate),
      approvals: r.approvals.map(({ approverId: _a, approverIds: _ids, actedById: _by, ...a }) => ({
        ...a,
        approvers: this.pool({ approverId: _a, approverIds: _ids }).map((id) => names.get(id)).filter(Boolean),
      })),
      canDecide: Boolean(decider),
      decideAs: decider?.mode ?? null,
      canCancel: this.canCancel(access, r, todayKey),
      document: r.documentName ? { name: r.documentName, size: r.documentSize, mime: r.documentMime } : null,
      needsDocument: r.leaveType.documentAfterDays !== null && r.totalDays > r.leaveType.documentAfterDays && !r.documentName,
    };
  }

  // ─── Document, questions, team clashes ─────────────────────

  /** The person attaches a supporting document (e.g. doctor's note) to their own request. */
  async addDocument(companyId: string, access: AccessContext, id: string, file?: Express.Multer.File) {
    const r = await this.prisma.leaveRequest.findFirst({ where: { id, companyId }, select: { id: true, status: true, documentKey: true, employee: { select: { userId: true } } } });
    if (!r || r.employee.userId !== access.userId) throw new NotFoundException('Leave request not found');
    if (!ACTIVE.includes(r.status)) throw new BadRequestException('Documents can only be added to pending or approved leave');
    if (!file) throw new BadRequestException('Choose a file');
    if (file.size > DOC_MAX_BYTES) throw new BadRequestException('Files must be 10 MB or smaller');
    const kind = detectFileType(file.buffer, file.mimetype);
    if (!kind || !DOCUMENT_TYPES.has(kind.ext)) throw new BadRequestException('Documents can be PDF, JPG, PNG, WebP or Word (.docx)');
    const key = `${companyId}/leave/${id}/${randomUUID()}.${kind.ext}`;
    await this.files.save(key, file.buffer);
    const base = (file.originalname ?? 'document').split(/[\\/]/).pop()!.replace(/\.[^.]*$/, '').replace(/[^\w\- ().]+/g, '').slice(0, 80) || 'document';
    await this.prisma.leaveRequest.update({ where: { id }, data: { documentKey: key, documentName: `${base}.${kind.ext}`, documentMime: kind.mime, documentSize: file.size } });
    if (r.documentKey) await this.files.remove(r.documentKey).catch(() => undefined);
    return this.getRow(companyId, access, id);
  }

  /** Anyone who can see the request can open its document. */
  async openDocument(companyId: string, access: AccessContext, id: string) {
    await this.getRow(companyId, access, id);
    const r = await this.prisma.leaveRequest.findUnique({ where: { id }, select: { documentKey: true, documentName: true, documentMime: true, documentSize: true } });
    if (!r?.documentKey) throw new NotFoundException('No document on this request');
    const stream = await this.files.open(r.documentKey).catch(() => {
      throw new NotFoundException('The file is no longer available');
    });
    return { stream, name: r.documentName!, mime: r.documentMime ?? 'application/octet-stream', size: r.documentSize ?? undefined };
  }

  /** An approver asks the person something; the request stays pending (in-app message). */
  async ask(companyId: string, access: AccessContext, id: string, dto: AskQuestionDto) {
    const r = await this.prisma.leaveRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!r || !this.deciderFor(access, r)) throw new NotFoundException('Leave request not found');
    const me = access.employee ? await this.prisma.employee.findUnique({ where: { id: access.employee.id }, select: { firstName: true, lastName: true } }) : null;
    const who = me ? `${me.firstName} ${me.lastName}` : 'Your approver';
    await this.notifications.notify({
      companyId,
      userIds: [r.employee.userId],
      type: 'leave.question',
      title: `${who} has a question about your ${r.leaveType.name.toLowerCase()}`,
      body: `${dateRange(keyFromDate(r.startDate), keyFromDate(r.endDate))}\n“${dto.question}”\nReply to them directly — your request is still pending.`,
      link: '/app/leave',
      actionLabel: 'View my leave',
      email: false,
    });
    return { sent: true };
  }

  /**
   * For approvers: teammates (same manager, or on the same project) who are off
   * during each request, and how big that team is.
   */
  private async clashes(companyId: string, rows: RequestRow[]) {
    type Overlap = { employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null }; startDate: string; endDate: string; leaveType: string; color: string; status: LeaveStatus };
    const out = new Map<string, { teamSize: number; overlaps: Overlap[] }>();
    for (const r of rows) {
      const team = await this.teammates(companyId, r.employee.id);
      if (!team.length) {
        out.set(r.id, { teamSize: 1, overlaps: [] });
        continue;
      }
      const others = await this.prisma.leaveRequest.findMany({
        where: { companyId, employeeId: { in: team }, status: { in: ACTIVE }, startDate: { lte: r.endDate }, endDate: { gte: r.startDate } },
        select: { startDate: true, endDate: true, status: true, leaveType: { select: { name: true, color: true } }, employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { startDate: 'asc' },
      });
      out.set(r.id, {
        teamSize: team.length + 1,
        overlaps: others.map((o) => ({ employee: o.employee, startDate: keyFromDate(o.startDate), endDate: keyFromDate(o.endDate), leaveType: o.leaveType.name, color: o.leaveType.color, status: o.status })),
      });
    }
    return out;
  }

  /** People who share the person's manager, report to them, are their manager, or are on an active project with them. */
  async teammates(companyId: string, employeeId: string): Promise<string[]> {
    const me = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { reportingManagerId: true } });
    const today = new Date();
    const projects = await this.prisma.projectMember.findMany({ where: { companyId, employeeId, OR: [{ endDate: null }, { endDate: { gte: today } }] }, select: { projectId: true } });
    const rows = await this.prisma.employee.findMany({
      where: {
        companyId,
        id: { not: employeeId },
        employmentStatus: { not: EmploymentStatus.TERMINATED },
        OR: [
          ...(me?.reportingManagerId ? [{ reportingManagerId: me.reportingManagerId }, { id: me.reportingManagerId }] : []),
          { reportingManagerId: employeeId },
          ...(projects.length ? [{ projectMembers: { some: { projectId: { in: projects.map((p) => p.projectId) }, OR: [{ endDate: null }, { endDate: { gte: today } }] } } }] : []),
        ],
      },
      select: { id: true },
      take: 200,
    });
    return rows.map((r) => r.id);
  }

  private async me(companyId: string, access: AccessContext) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    return this.balances.person(companyId, access.employee.id);
  }
}
