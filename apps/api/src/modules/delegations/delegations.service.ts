import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { ACCESS_USER_SELECT, type AccessContext } from '../access/access.types';
import { DELEGABLE_PERMISSIONS, MAX_DELEGATION_DAYS, PERMISSION_BY_KEY } from '../access/catalog';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateDelegationDto } from './dto';

const SELECT = {
  id: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  permissions: true,
  revokedAt: true,
  createdAt: true,
  delegator: { select: { id: true, firstName: true, lastName: true, email: true } },
  delegate: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.ApprovalDelegationSelect;

type Row = Prisma.ApprovalDelegationGetPayload<{ select: typeof SELECT }>;

/**
 * Approval delegation: someone covers a person's approvals for a period,
 * with that person's reach (their team), e.g. while they're on leave.
 */
@Injectable()
export class DelegationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Mine: what I've handed over and what I'm covering (active, upcoming, ended in the last 30 days). */
  async mine(companyId: string, userId: string) {
    const recent = { OR: [{ endsAt: { gt: new Date(Date.now() - 30 * 864e5) } }] };
    const [given, received] = await Promise.all([
      this.prisma.approvalDelegation.findMany({ where: { companyId, delegatorId: userId, ...recent }, select: SELECT, orderBy: { startsAt: 'desc' } }),
      this.prisma.approvalDelegation.findMany({ where: { companyId, delegateId: userId, ...recent }, select: SELECT, orderBy: { startsAt: 'desc' } }),
    ]);
    const delegable = await this.delegableFor(userId);
    return { given: given.map((r) => this.present(r)), received: received.map((r) => this.present(r)), canDelegate: delegable.length > 0, delegable };
  }

  /** Admin view: every current and upcoming delegation in the company. */
  /** Current and upcoming hand-overs, soonest first, a page at a time. */
  async all(companyId: string, q: { page?: number; limit?: number } = {}) {
    const where = { companyId, revokedAt: null, endsAt: { gt: new Date() } };
    const limit = q.limit ?? 25;
    const page = q.page ?? 1;
    const [total, rows] = await Promise.all([
      this.prisma.approvalDelegation.count({ where }),
      this.prisma.approvalDelegation.findMany({ where, select: SELECT, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
    ]);
    return { rows: rows.map((r) => this.present(r)), meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async create(companyId: string, actor: AccessContext, dto: CreateDelegationDto) {
    const delegatorId = dto.delegatorId ?? actor.userId;
    if (delegatorId !== actor.userId && !actor.isOwner && !actor.grants.has('user.edit')) {
      throw new ForbiddenException("Only admins can set up a delegation on someone else's behalf");
    }
    if (dto.delegateId === delegatorId) throw new BadRequestException('Choose someone else to cover the approvals');

    const [delegator, delegate] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: delegatorId, companyId }, select: { id: true, status: true, firstName: true } }),
      this.prisma.user.findFirst({ where: { id: dto.delegateId, companyId }, select: { id: true, status: true, firstName: true } }),
    ]);
    if (!delegator) throw new NotFoundException('User not found in this company');
    if (!delegate) throw new NotFoundException('The person covering must be in this company');
    if (delegate.status !== UserStatus.ACTIVE) throw new BadRequestException(`${delegate.firstName}'s account isn't active`);

    const all = await this.delegableFor(delegatorId);
    if (!all.length) throw new BadRequestException(`${delegator.firstName} has no approvals to delegate`);
    // Hand over some of them, or (default) all
    const permissions = dto.permissions?.length ? all.filter((p) => dto.permissions!.includes(p.key)) : all;
    if (!permissions.length) throw new BadRequestException(`${delegator.firstName} can't approve any of the chosen kinds`);
    const chosen = permissions.length === all.length ? [] : permissions.map((p) => p.key);

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = new Date(dto.endsAt);
    if (endsAt.getTime() <= Date.now()) throw new BadRequestException('The end date must be in the future');
    if (endsAt <= startsAt) throw new BadRequestException('The end date must be after the start date');
    if (endsAt.getTime() - startsAt.getTime() > MAX_DELEGATION_DAYS * 864e5) {
      throw new BadRequestException(`A delegation can last at most ${MAX_DELEGATION_DAYS} days`);
    }

    const overlap = await this.prisma.approvalDelegation.findFirst({
      where: { companyId, delegatorId, revokedAt: null, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      select: { delegate: { select: { firstName: true, lastName: true } } },
    });
    if (overlap) {
      throw new ConflictException(`${delegator.firstName}'s approvals are already delegated to ${overlap.delegate.firstName} ${overlap.delegate.lastName} for part of that time`);
    }

    const row = await this.prisma.approvalDelegation.create({
      data: { companyId, delegatorId, delegateId: dto.delegateId, startsAt, endsAt, reason: dto.reason?.trim() || null, permissions: chosen, createdById: actor.userId },
      select: SELECT,
    });
    this.access.invalidateDelegations(dto.delegateId);
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    void this.notifications.notify({
      companyId,
      userIds: [dto.delegateId],
      type: 'delegation.assigned',
      title: `You're covering approvals for ${delegator.firstName}`,
      body: `From ${fmt(startsAt)} to ${fmt(endsAt)}: ${permissions.map((p) => p.label).join(', ')}.${row.reason ? `\nReason: ${row.reason}` : ''}`,
      link: '/app/delegations',
      actionLabel: 'See delegation',
    });
    return { ...this.present(row), permissions };
  }

  async revoke(companyId: string, actor: AccessContext, id: string) {
    const row = await this.prisma.approvalDelegation.findFirst({ where: { id, companyId }, select: { ...SELECT, delegatorId: true, delegateId: true } });
    if (!row) throw new NotFoundException('Delegation not found');
    const involved = row.delegatorId === actor.userId || row.delegateId === actor.userId;
    if (!involved && !actor.isOwner && !actor.grants.has('user.edit')) {
      throw new ForbiddenException('Only the people involved or an admin can end a delegation');
    }
    if (row.revokedAt) return this.present(row);
    const updated = await this.prisma.approvalDelegation.update({
      where: { id },
      data: { revokedAt: new Date(), revokedById: actor.userId },
      select: SELECT,
    });
    this.access.invalidateDelegations(row.delegateId);
    return this.present(updated);
  }

  /** Approval permissions a user holds through their own roles. */
  private async delegableFor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: ACCESS_USER_SELECT });
    if (!user) return [];
    const ctx = await this.access.resolve(user, { withDelegations: false });
    const fromRoles = DELEGABLE_PERMISSIONS.filter((k) => ctx.grants.has(k)).map((key) => ({
      key,
      label: PERMISSION_BY_KEY.get(key)?.label ?? key,
      scope: ctx.grants.get(key) ?? null,
    }));
    // Project team leads / managers approve leave and attendance through the project
    if (ctx.features.has('work.projects') && user.employee) {
      const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
      const leads = await this.prisma.projectMember.count({
        where: {
          employeeId: user.employee.id,
          role: { in: ['TEAM_LEAD', 'MANAGER'] },
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
          project: { status: { in: ['ACTIVE', 'ON_HOLD'] } },
        },
      });
      if (leads) {
        for (const key of ['leave.approve', 'attendance.approve']) {
          if (!fromRoles.some((p) => p.key === key)) fromRoles.push({ key, label: `${PERMISSION_BY_KEY.get(key)?.label ?? key} (project)`, scope: null });
        }
      }
    }
    return fromRoles;
  }

  private present(r: Row) {
    const now = Date.now();
    const status = r.revokedAt ? 'revoked' : r.endsAt.getTime() <= now ? 'ended' : r.startsAt.getTime() > now ? 'upcoming' : 'active';
    return {
      id: r.id,
      status,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      reason: r.reason,
      /** Approval kinds handed over; empty = all */
      permissions: r.permissions,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
      delegator: { id: r.delegator.id, name: `${r.delegator.firstName} ${r.delegator.lastName}`, email: r.delegator.email },
      delegate: { id: r.delegate.id, name: `${r.delegate.firstName} ${r.delegate.lastName}`, email: r.delegate.email },
    };
  }
}
