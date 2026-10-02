import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RegularisationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext, ActiveDelegation } from '../access/access.types';
import { AttendanceService } from './attendance.service';
import { AttendancePolicyService } from './policy.service';
import { addDays, dateFromKey, keyFromDate, localDateKey } from './time-zone';
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
    const times = this.attendance.timesFor(policy, dto.date, dto.checkIn, dto.checkOut ?? null);

    const pending = await this.prisma.attendanceRegularisation.count({
      where: { companyId, employeeId: employee.id, date: dateFromKey(dto.date), status: RegularisationStatus.PENDING },
    });
    if (pending) throw new ConflictException('You already have a pending correction for this day');

    return this.prisma.attendanceRegularisation.create({
      data: { companyId, employeeId: employee.id, date: dateFromKey(dto.date), checkIn: times.checkIn, checkOut: times.checkOut, reason: dto.reason },
      select: SELECT,
    });
  }

  async list(companyId: string, access: AccessContext, query: RegularisationQueryDto) {
    let where: Prisma.AttendanceRegularisationWhereInput;
    if (query.view === 'mine') {
      if (!access.employee) return { data: [], meta: { total: 0, page: 1, limit: query.limit ?? 20, totalPages: 0 } };
      where = { companyId, employeeId: access.employee.id, ...(query.status && { status: query.status }) };
    } else {
      const scope = this.access.requireEmployeeScope(access, APPROVE);
      where = { companyId, employee: scope, status: query.status ?? RegularisationStatus.PENDING };
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
    return {
      data: rows.map(({ employeeId, ...r }) => {
        const c = current.get(`${employeeId}|${keyFromDate(r.date)}`);
        return { ...r, date: keyFromDate(r.date), current: c ? { checkIn: c.checkIn, checkOut: c.checkOut, status: c.status } : null };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), timeZone: policy.timeZone },
    };
  }

  /** Requests waiting for the caller (nav badge). */
  async pendingCount(companyId: string, access: AccessContext): Promise<number> {
    const scope = this.access.employeeScope(access, APPROVE);
    if (!scope) return 0;
    return this.prisma.attendanceRegularisation.count({ where: { companyId, status: RegularisationStatus.PENDING, employee: scope } });
  }

  async approve(companyId: string, access: AccessContext, id: string, dto: ReviewRegularisationDto) {
    const request = await this.reviewable(companyId, access, id);
    const onBehalfOf = await this.coveringFor(companyId, access, request.employeeId);
    const policy = await this.policies.get(companyId);
    const dateKey = keyFromDate(request.date);
    const toHHmm = (d: Date) =>
      new Intl.DateTimeFormat('en-GB', { timeZone: policy.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    const times = this.attendance.timesFor(policy, dateKey, toHHmm(request.checkIn), request.checkOut ? toHHmm(request.checkOut) : null);

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attendanceRegularisation.updateMany({
        where: { id, status: RegularisationStatus.PENDING },
        data: { status: RegularisationStatus.APPROVED, reviewedById: access.userId, onBehalfOfId: onBehalfOf, reviewedAt: new Date(), reviewNote: dto.note ?? null },
      });
      if (!count) throw new ConflictException('This request has already been decided');
      const data = { ...times, checkInSource: 'REGULARISED', checkOutSource: times.checkOut ? 'REGULARISED' : null, isManualEntry: true, notes: `Correction: ${request.reason}`.slice(0, 500) };
      await tx.attendanceRecord.upsert({
        where: { companyId_employeeId_date: { companyId, employeeId: request.employeeId, date: request.date } },
        update: data,
        create: { ...data, companyId, employeeId: request.employeeId, date: request.date },
      });
      return tx.attendanceRegularisation.findUniqueOrThrow({ where: { id }, select: SELECT });
    });
  }

  async reject(companyId: string, access: AccessContext, id: string, dto: ReviewRegularisationDto) {
    const request = await this.reviewable(companyId, access, id);
    const onBehalfOf = await this.coveringFor(companyId, access, request.employeeId);
    const { count } = await this.prisma.attendanceRegularisation.updateMany({
      where: { id, status: RegularisationStatus.PENDING },
      data: { status: RegularisationStatus.REJECTED, reviewedById: access.userId, onBehalfOfId: onBehalfOf, reviewedAt: new Date(), reviewNote: dto.note ?? null },
    });
    if (!count) throw new ConflictException('This request has already been decided');
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
  private async reviewable(companyId: string, access: AccessContext, id: string) {
    const scope = this.access.requireEmployeeScope(access, APPROVE);
    const request = await this.prisma.attendanceRegularisation.findFirst({
      where: { id, companyId, employee: scope },
      select: { id: true, employeeId: true, date: true, checkIn: true, checkOut: true, reason: true, status: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== RegularisationStatus.PENDING) throw new ConflictException('This request has already been decided');
    return request;
  }

  /**
   * null when the caller's own roles reach the employee; otherwise the user
   * they are covering for (recorded as "on behalf of").
   */
  private async coveringFor(companyId: string, access: AccessContext, employeeId: string): Promise<string | null> {
    const reaches = async (ctx: AccessContext) => {
      const scope = this.access.employeeScope(ctx, APPROVE);
      return Boolean(scope) && (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope!] } })) > 0;
    };
    if (access.isSuperAdmin || (await reaches({ ...access, delegations: [] }))) return null;
    for (const d of access.delegations as ActiveDelegation[]) {
      if (await reaches({ ...access, grants: new Map(), delegations: [d] })) return d.fromUserId;
    }
    throw new ForbiddenException('You do not have permission to perform this action. Required: attendance.approve');
  }
}
