import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExtraLeaveStatus, Prisma, RoleStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { dateFromKey, keyFromDate } from '../attendance/time-zone';
import { LeaveTypesService } from './leave-types.service';
import { LeaveBalancesService } from './leave-balances.service';
import { isEligible } from './leave-rules';
import type { AskExtraDto, DecideExtraDto, ExtraListQueryDto, LendGiveDto } from './dto';

const DECIDE = 'leave.extra_decide';
const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

const SELECT = {
  id: true,
  year: true,
  days: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  decidedDays: true,
  decidedById: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  employee: { select: { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true } },
  leaveType: { select: { id: true, name: true, code: true, color: true, annualQuota: true } },
} satisfies Prisma.ExtraLeaveRequestSelect;
type Row = Prisma.ExtraLeaveRequestGetPayload<{ select: typeof SELECT }>;

/**
 * "Ask HR for more days": when a balance runs out the person asks; whoever
 * holds leave.extra_decide over them lends days (may go below 0 — what is
 * used is taken from next year) or gives extra days (kept), or declines.
 */
@Injectable()
export class ExtraLeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly types: LeaveTypesService,
    private readonly balances: LeaveBalancesService,
    private readonly notifications: NotificationsService,
  ) {}

  async ask(companyId: string, access: AccessContext, dto: AskExtraDto) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    const type = await this.types.get(companyId, dto.leaveTypeId);
    if (type.accrual === 'NONE' || type.availability === 'GRANT_ONLY' || !type.isActive) throw new BadRequestException(`${type.name} has no balance to ask more of`);
    const person = await this.balances.person(companyId, access.employee.id);
    if (!isEligible(type, person, new Date())) throw new ForbiddenException(`${type.name} isn’t available to you`);
    if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) throw new BadRequestException('The end date is before the start date');
    if (dto.days * 2 !== Math.round(dto.days * 2)) throw new BadRequestException('Use half-day steps');
    const waiting = await this.prisma.extraLeaveRequest.count({ where: { companyId, employeeId: person.id, leaveTypeId: type.id, year: dto.year, status: ExtraLeaveStatus.PENDING } });
    if (waiting) throw new ConflictException(`You already asked for more ${type.name.toLowerCase()} — waiting for an answer`);

    const r = await this.prisma.extraLeaveRequest.create({
      data: {
        companyId,
        employeeId: person.id,
        leaveTypeId: type.id,
        year: dto.year,
        days: dto.days,
        startDate: dto.startDate ? dateFromKey(dto.startDate) : null,
        endDate: dto.endDate ? dateFromKey(dto.endDate) : null,
        reason: dto.reason,
      },
      select: SELECT,
    });
    const to = (await this.deciders(companyId, person.id)).filter((u) => u !== access.userId);
    void this.notifications.notify({
      companyId,
      userIds: to,
      type: 'leave.extra_requested',
      title: `${r.employee.firstName} ${r.employee.lastName} asks for ${plural(dto.days)} more ${type.name.toLowerCase()}`,
      body: `${dto.startDate && dto.endDate ? `${dateRange(dto.startDate, dto.endDate)}\n` : ''}${dto.reason}`,
      link: '/app/leave/approvals?tab=extra',
      actionLabel: 'Review',
    });
    return this.shape(r, access);
  }

  async list(companyId: string, access: AccessContext, query: ExtraListQueryDto) {
    let where: Prisma.ExtraLeaveRequestWhereInput;
    if (query.view === 'decide') {
      const reach = this.access.requireEmployeeScope(access, DECIDE);
      where = { companyId, status: query.status ?? ExtraLeaveStatus.PENDING, employee: { AND: [reach, { NOT: { userId: access.userId } }] } };
    } else {
      if (!access.employee) return [];
      where = { companyId, employeeId: access.employee.id, ...(query.status && { status: query.status }) };
    }
    const rows = await this.prisma.extraLeaveRequest.findMany({ where, orderBy: { createdAt: 'desc' }, select: SELECT, take: 300 });
    const names = await this.names(rows.map((r) => r.decidedById));
    return rows.map((r) => this.shape(r, access, names));
  }

  async decide(companyId: string, access: AccessContext, id: string, dto: DecideExtraDto) {
    const r = await this.prisma.extraLeaveRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!r) throw new NotFoundException('Request not found');
    await this.access.assertEmployeeInScope(access, DECIDE, companyId, r.employee.id);
    if (r.employee.userId === access.userId) throw new ForbiddenException('You can’t answer your own request');
    if (r.status !== ExtraLeaveStatus.PENDING) throw new ConflictException('This request has already been answered');

    if (dto.action === 'decline') {
      const { count } = await this.prisma.extraLeaveRequest.updateMany({
        where: { id, status: ExtraLeaveStatus.PENDING },
        data: { status: ExtraLeaveStatus.DECLINED, decidedById: access.userId, decidedAt: new Date(), decisionNote: dto.note ?? null },
      });
      if (!count) throw new ConflictException('This request has already been answered');
      void this.notifications.notify({
        companyId,
        userIds: [r.employee.userId],
        type: 'leave.extra_declined',
        title: `Your request for more ${r.leaveType.name.toLowerCase()} was declined`,
        body: dto.note ?? null,
        link: '/app/leave',
      });
    } else {
      // Claim first so two people deciding at once can't both lend
      const { count } = await this.prisma.extraLeaveRequest.updateMany({
        where: { id, status: ExtraLeaveStatus.PENDING },
        data: { status: dto.action === 'lend' ? ExtraLeaveStatus.LENT : ExtraLeaveStatus.GIVEN, decidedDays: dto.days, decidedById: access.userId, decidedAt: new Date() },
      });
      if (!count) throw new ConflictException('This request has already been answered');
      try {
        await this.balances.adjust(
          companyId,
          access,
          { employeeId: r.employee.id, leaveTypeId: r.leaveType.id, year: r.year, kind: dto.action === 'lend' ? 'LEND' : 'EXTRA', days: dto.days!, reason: r.reason },
          r.id,
        );
      } catch (err) {
        // The balance didn't change (e.g. over the lending cap) — put the request back
        await this.prisma.extraLeaveRequest.update({ where: { id }, data: { status: ExtraLeaveStatus.PENDING, decidedDays: null, decidedById: null, decidedAt: null } });
        throw err;
      }
    }
    return this.one(companyId, access, id);
  }

  /** Lend / give without a request. */
  async lendOrGive(companyId: string, access: AccessContext, dto: LendGiveDto) {
    await this.access.assertEmployeeInScope(access, DECIDE, companyId, dto.employeeId).catch(async (err) => {
      // Holders of leave.adjust_balance may do it too
      await this.access.assertEmployeeInScope(access, 'leave.adjust_balance', companyId, dto.employeeId).catch(() => {
        throw err;
      });
    });
    return this.balances.adjust(companyId, access, { employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: dto.year, kind: dto.action === 'lend' ? 'LEND' : 'EXTRA', days: dto.days, reason: dto.reason });
  }

  async cancel(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.extraLeaveRequest.findFirst({ where: { id, companyId }, select: { status: true, employee: { select: { userId: true } } } });
    if (!r || r.employee.userId !== access.userId) throw new NotFoundException('Request not found');
    if (r.status !== ExtraLeaveStatus.PENDING) throw new ConflictException('This request has already been answered');
    await this.prisma.extraLeaveRequest.update({ where: { id }, data: { status: ExtraLeaveStatus.CANCELLED } });
    return this.one(companyId, access, id);
  }

  // ─── Helpers ───────────────────────────────────────────────

  /** Users who may decide for this person: hold leave.extra_decide with a reach that covers them. */
  private async deciders(companyId: string, employeeId: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { status: RoleStatus.ACTIVE, OR: [{ isOwner: true }, { rolePermissions: { some: { permission: { key: DECIDE } } } }] } } },
      },
      select: { id: true },
      take: 50,
    });
    const out: string[] = [];
    for (const u of users) {
      const ctx = await this.access.forUser(u.id).catch(() => null);
      const scope = ctx && this.access.employeeScope(ctx, DECIDE);
      if (scope && (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope] } }))) out.push(u.id);
    }
    return out;
  }

  private async one(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.extraLeaveRequest.findFirstOrThrow({ where: { id, companyId }, select: SELECT });
    return this.shape(r, access, await this.names([r.decidedById]));
  }

  private async names(ids: Array<string | null>) {
    const list = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!list.length) return new Map<string, string>();
    const users = await this.prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }

  private shape(r: Row, access: AccessContext, names = new Map<string, string>()) {
    const { employee, decidedById, ...rest } = r;
    return {
      ...rest,
      startDate: r.startDate ? keyFromDate(r.startDate) : null,
      endDate: r.endDate ? keyFromDate(r.endDate) : null,
      employee: { id: employee.id, employeeId: employee.employeeId, firstName: employee.firstName, lastName: employee.lastName, avatarUrl: employee.avatarUrl },
      decidedBy: decidedById ? (names.get(decidedById) ?? null) : null,
      mine: employee.userId === access.userId,
    };
  }
}
