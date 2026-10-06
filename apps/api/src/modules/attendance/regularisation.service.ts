import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RegularisationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { covering, type AccessContext, type ActiveDelegation } from '../access/access.types';
import { AttendanceService } from './attendance.service';
import { AttendancePolicyService } from './policy.service';
import { addDays, dateFromKey, keyFromDate, localDateKey } from './time-zone';
import { withShift } from './attendance-rules';
import { ShiftsService } from './shifts.service';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { ApprovalRouterService } from '../projects/approval-router.service';
import type { CreateRegularisationDto, RegularisationQueryDto, ReviewRegularisationDto } from './dto';

const APPROVE = 'attendance.approve';

const SELECT = {
  id: true,
  date: true,
  checkIn: true,
  checkOut: true,
  reason: true,
  status: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  employee: {
    select: { id: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } },
  },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
  onBehalfOf: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.AttendanceRegularisationSelect;

/**
 * Attendance corrections. Employees ask; whoever holds attendance.approve
 * reaching them (manager, HR, or someone covering via delegation) decides.
 * Nobody approves their own request.
 */
@Injectable()
export class RegularisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly attendance: AttendanceService,
    private readonly policies: AttendancePolicyService,
    private readonly notifications: NotificationsService,
    private readonly router: ApprovalRouterService,
    private readonly shifts: ShiftsService,
  ) {}

  async create(companyId: string, access: AccessContext, dto: CreateRegularisationDto) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    const employee = await this.prisma.employee.findFirst({ where: { id: access.employee.id, companyId }, select: { id: true, joiningDate: true } });
    if (!employee) throw new BadRequestException('Your account has no employee profile');

    const policy = await this.policies.get(companyId);
    const todayKey = localDateKey(new Date(), policy.timeZone);
    if (dto.date > todayKey) throw new BadRequestException('You cannot correct a future date');
    if (dto.date < keyFromDate(employee.joiningDate)) throw new BadRequestException('That date is before you joined');
    if (dto.date < addDays(todayKey, -policy.regularisationWindowDays)) {
      throw new BadRequestException(`Corrections can only be requested for the last ${policy.regularisationWindowDays} days`);
    }
    const shift = await this.shifts.hoursOf(companyId, employee.id);
    const times = this.attendance.timesFor(withShift(policy, shift), dto.date, dto.checkIn, dto.checkOut ?? null, shift?.overnight);

    const pending = await this.prisma.attendanceRegularisation.count({
      where: { companyId, employeeId: employee.id, date: dateFromKey(dto.date), status: RegularisationStatus.PENDING },
    });
    if (pending) throw new ConflictException('You already have a pending correction for this day');

    const route = await this.router.route(companyId, employee.id, dto.date, dto.date, 1);
    const approverIds = route.levels[0]?.approverIds ?? [];
    const created = await this.prisma.attendanceRegularisation.create({
      data: { companyId, employeeId: employee.id, date: dateFromKey(dto.date), checkIn: times.checkIn, checkOut: times.checkOut, reason: dto.reason, approverIds },
      select: SELECT,
    });
    void this.notifyApprovers(companyId, approverIds, created, dto, policy.timeZone);
    void this.manyCorrectionsAlert(companyId, employee.id, dto.date, approverIds, policy.correctionAlertAt);
    return created;
  }

  /** Corrections this person asked for in the month of a date (cancelled ones don't count). */
  private monthCount(companyId: string, employeeId: string, dateKey: string) {
    const month = dateKey.slice(0, 7);
    const last = keyFromDate(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)));
    return this.prisma.attendanceRegularisation.count({
      where: { companyId, employeeId, status: { not: RegularisationStatus.CANCELLED }, date: { gte: dateFromKey(month + '-01'), lte: dateFromKey(last) } },
    });
  }

  /**
   * No monthly limit — but once someone goes over the company's number
   * (8 by default), their lead / manager (the approvers) and line manager hear about it once.
   */
  private async manyCorrectionsAlert(companyId: string, employeeId: string, dateKey: string, pool: string[], threshold: number) {
    const count = await this.monthCount(companyId, employeeId, dateKey);
    if (count !== threshold + 1) return;
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true, userId: true, reportingManager: { select: { userId: true } } } });
    if (!e) return;
    const to = [...new Set([...pool, ...(e.reportingManager ? [e.reportingManager.userId] : [])])].filter((u) => u !== e.userId);
    const month = new Date(dateFromKey(dateKey.slice(0, 7) + '-01')).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
    await this.notifications.notify({
      companyId,
      userIds: to.length ? to : await this.notifications.companyWideApprovers(companyId, APPROVE),
      type: 'attendance.many_corrections',
      title: `${e.firstName} ${e.lastName} has asked for ${count} attendance corrections in ${month}`,
      body: `That is more than ${threshold}. You may want to check in with them.`,
      link: '/app/attendance/approvals',
      actionLabel: 'See their requests',
      email: false,
      dedupeKey: `many-corrections:${employeeId}:${dateKey.slice(0, 7)}`,
    });
  }

  /** The approver pool (team lead / PM / line manager) and anyone covering for them; else HR. */
  private async notifyApprovers(
    companyId: string,
    pool: string[],
    c: { employee: { firstName: string; lastName: string } },
    dto: CreateRegularisationDto,
    timeZone: string,
  ) {
    const to = pool.length ? [...pool, ...(await this.notifications.coveringFor(pool, APPROVE))] : await this.notifications.companyWideApprovers(companyId, APPROVE);
    await this.notifications.notify({
      companyId,
      userIds: to,
      type: 'attendance.correction_submitted',
      title: `${c.employee.firstName} ${c.employee.lastName} asked to correct attendance`,
      body: `${dateRange(dto.date, dto.date)} · ${dto.checkIn}–${dto.checkOut ?? '…'} (${timeZone})\nReason: ${dto.reason}`,
      link: '/app/attendance/approvals',
      actionLabel: 'Review correction',
    });
  }

  private async notifyEmployee(companyId: string, id: string, approved: boolean) {
    const r = await this.prisma.attendanceRegularisation.findUnique({
      where: { id },
      select: { date: true, reviewNote: true, employee: { select: { userId: true } }, reviewedBy: { select: { firstName: true, lastName: true } } },
    });
    if (!r) return;
    const key = keyFromDate(r.date);
    await this.notifications.notify({
      companyId,
      userIds: [r.employee.userId],
      type: approved ? 'attendance.correction_approved' : 'attendance.correction_rejected',
      title: approved ? `Your attendance correction for ${dateRange(key, key)} was approved` : `Your attendance correction for ${dateRange(key, key)} was not approved`,
      body: [r.reviewedBy && `By ${r.reviewedBy.firstName} ${r.reviewedBy.lastName}`, r.reviewNote && `Note: ${r.reviewNote}`].filter(Boolean).join('\n') || null,
      link: '/app/attendance',
      actionLabel: 'View my attendance',
    });
  }

  async list(companyId: string, access: AccessContext, query: RegularisationQueryDto) {
    let where: Prisma.AttendanceRegularisationWhereInput;
    if (query.view === 'mine') {
      if (!access.employee) return { data: [], meta: { total: 0, page: 1, limit: query.limit ?? 20, totalPages: 0 } };
      where = { companyId, employeeId: access.employee.id, ...(query.status && { status: query.status }) };
    } else {
      const reach = this.reviewReach(access);
      if (!reach) return { data: [], meta: { total: 0, page: 1, limit: query.limit ?? 20, totalPages: 0, timeZone: (await this.policies.get(companyId)).timeZone } };
      where = { companyId, status: query.status ?? RegularisationStatus.PENDING, AND: [reach] };
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [rows, total] = await Promise.all([
      this.prisma.attendanceRegularisation.findMany({
        where,
        select: { ...SELECT, employeeId: true },
        orderBy: query.view === 'review' && !query.status ? { createdAt: 'asc' } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendanceRegularisation.count({ where }),
    ]);

    // What is on record today for those days (so reviewers see before → after)
    const records = rows.length
      ? await this.prisma.attendanceRecord.findMany({
          where: { companyId, OR: rows.map((r) => ({ employeeId: r.employeeId, date: r.date })) },
          select: { employeeId: true, date: true, checkIn: true, checkOut: true, status: true },
        })
      : [];
    const current = new Map(records.map((r) => [`${r.employeeId}|${keyFromDate(r.date)}`, r]));
    const policy = await this.policies.get(companyId);
    // For reviewers: corrections that month and the person's last 30 days
    const extra = new Map<string, { monthCount: number; recent: Awaited<ReturnType<AttendanceService['recentDays']>> }>();
    if (query.view === 'review') {
      for (const r of rows) {
        const key = `${r.employeeId}|${keyFromDate(r.date).slice(0, 7)}`;
        if (extra.has(key)) continue;
        const [monthCount, recent] = await Promise.all([this.monthCount(companyId, r.employeeId, keyFromDate(r.date)), this.attendance.recentDays(companyId, r.employeeId, keyFromDate(r.date))]);
        extra.set(key, { monthCount, recent });
      }
    }
    return {
      data: rows.map(({ employeeId, ...r }) => {
        const c = current.get(`${employeeId}|${keyFromDate(r.date)}`);
        const x = extra.get(`${employeeId}|${keyFromDate(r.date).slice(0, 7)}`);
        return { ...r, date: keyFromDate(r.date), current: c ? { checkIn: c.checkIn, checkOut: c.checkOut, status: c.status } : null, ...(x && { monthCount: x.monthCount, overLimit: x.monthCount > policy.correctionAlertAt, recent: x.recent }) };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), timeZone: policy.timeZone },
    };
  }

  /** Requests waiting for the caller (nav badge). */
  async pendingCount(companyId: string, access: AccessContext): Promise<number> {
    const reach = this.reviewReach(access);
    if (!reach) return 0;
    return this.prisma.attendanceRegularisation.count({ where: { companyId, status: RegularisationStatus.PENDING, AND: [reach] } });
  }

  async approve(companyId: string, access: AccessContext, id: string, dto: ReviewRegularisationDto) {
    const request = await this.reviewable(companyId, access, id);
    const onBehalfOf = await this.coveringFor(companyId, access, request.employeeId, request.approverIds);
    const policy = await this.policies.get(companyId);
    const dateKey = keyFromDate(request.date);
    const toHHmm = (d: Date) =>
      new Intl.DateTimeFormat('en-GB', { timeZone: policy.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    const shift = await this.shifts.hoursOf(companyId, request.employeeId);
    const times = this.attendance.timesFor(withShift(policy, shift), dateKey, toHHmm(request.checkIn), request.checkOut ? toHHmm(request.checkOut) : null, shift?.overnight);

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attendanceRegularisation.updateMany({
        where: { id, status: RegularisationStatus.PENDING },
        data: { status: RegularisationStatus.APPROVED, reviewedById: access.userId, onBehalfOfId: onBehalfOf, reviewedAt: new Date(), reviewNote: dto.note ?? null },
      });
      if (!count) throw new ConflictException('This request has already been decided');
      const data = { ...times, checkInSource: 'REGULARISED', checkOutSource: times.checkOut ? 'REGULARISED' : null, isManualEntry: true, autoClosed: false, notes: `Correction: ${request.reason}`.slice(0, 500) };
      await tx.attendanceRecord.upsert({
        where: { companyId_employeeId_date: { companyId, employeeId: request.employeeId, date: request.date } },
        update: data,
        create: { ...data, companyId, employeeId: request.employeeId, date: request.date },
      });
      return tx.attendanceRegularisation.findUniqueOrThrow({ where: { id }, select: SELECT });
    }).then((row) => {
      void this.notifyEmployee(companyId, id, true);
      return row;
    });
  }

  async reject(companyId: string, access: AccessContext, id: string, dto: ReviewRegularisationDto) {
    const request = await this.reviewable(companyId, access, id);
    const onBehalfOf = await this.coveringFor(companyId, access, request.employeeId, request.approverIds);
    const { count } = await this.prisma.attendanceRegularisation.updateMany({
      where: { id, status: RegularisationStatus.PENDING },
      data: { status: RegularisationStatus.REJECTED, reviewedById: access.userId, onBehalfOfId: onBehalfOf, reviewedAt: new Date(), reviewNote: dto.note ?? null },
    });
    if (!count) throw new ConflictException('This request has already been decided');
    void this.notifyEmployee(companyId, id, false);
    return this.prisma.attendanceRegularisation.findUniqueOrThrow({ where: { id }, select: SELECT });
  }

  async cancel(companyId: string, access: AccessContext, id: string) {
    const request = await this.prisma.attendanceRegularisation.findFirst({ where: { id, companyId }, select: { employeeId: true, status: true } });
    if (!request || request.employeeId !== access.employee?.id) throw new NotFoundException('Request not found');
    const { count } = await this.prisma.attendanceRegularisation.updateMany({
      where: { id, status: RegularisationStatus.PENDING },
      data: { status: RegularisationStatus.CANCELLED },
    });
    if (!count) throw new ConflictException('Only pending requests can be cancelled');
    return this.prisma.attendanceRegularisation.findUniqueOrThrow({ where: { id }, select: SELECT });
  }

  /** Pending request whose employee the caller may approve for (404 otherwise). */
  /**
   * Requests the caller may decide: people their attendance.approve scope reaches
   * (managers, HR, delegations), or requests where they are in the approver pool
   * (project team lead / PM / line manager) or cover someone who is. Never their own.
   */
  private reviewReach(access: AccessContext): Prisma.AttendanceRegularisationWhereInput | null {
    const scope = this.access.employeeScope(access, APPROVE);
    const covered = covering(access, APPROVE).map((d) => d.fromUserId);
    return {
      employee: { userId: { not: access.userId } },
      OR: [...(scope ? [{ employee: scope }] : []), { approverIds: { hasSome: [access.userId, ...covered] } }],
    };
  }

  private async reviewable(companyId: string, access: AccessContext, id: string) {
    const request = await this.prisma.attendanceRegularisation.findFirst({
      where: { id, companyId, AND: [this.reviewReach(access)!] },
      select: { id: true, employeeId: true, date: true, checkIn: true, checkOut: true, reason: true, status: true, approverIds: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== RegularisationStatus.PENDING) throw new ConflictException('This request has already been decided');
    return request;
  }

  /**
   * null when the caller's own roles reach the employee; otherwise the user
   * they are covering for (recorded as "on behalf of").
   */
  private async coveringFor(companyId: string, access: AccessContext, employeeId: string, pool: string[] = []): Promise<string | null> {
    if (pool.includes(access.userId)) return null;
    const reaches = async (ctx: AccessContext) => {
      const scope = this.access.employeeScope(ctx, APPROVE);
      return Boolean(scope) && (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope!] } })) > 0;
    };
    if (access.isSuperAdmin || (await reaches({ ...access, delegations: [] }))) return null;
    const forPool = covering(access, APPROVE).find((d) => pool.includes(d.fromUserId));
    if (forPool) return forPool.fromUserId;
    for (const d of covering(access, APPROVE) as ActiveDelegation[]) {
      if (await reaches({ ...access, grants: new Map(), delegations: [d] })) return d.fromUserId;
    }
    throw new ForbiddenException('You do not have permission to perform this action. Required: attendance.approve');
  }
}
