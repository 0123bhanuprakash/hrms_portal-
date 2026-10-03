import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetRequestStatus, LeaveApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { AssetTypesService } from './asset-types.service';
import type { CreateRequestDto, DecideRequestDto, RejectRequestDto, RequestQueryDto } from './dto';

const IT = 'asset.approve_it';
const HR = 'asset.approve_hr';
const NAME = { select: { id: true, firstName: true, lastName: true } } as const;

const SELECT = {
  id: true,
  reason: true,
  status: true,
  itStatus: true,
  itById: true,
  itAt: true,
  itNote: true,
  hrStatus: true,
  hrById: true,
  hrAt: true,
  hrNote: true,
  assetId: true,
  createdAt: true,
  type: { select: { id: true, name: true } },
  employee: { select: { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } }, department: { select: { name: true } } } },
} satisfies Prisma.AssetRequestSelect;
type Row = Prisma.AssetRequestGetPayload<{ select: typeof SELECT }>;

/**
 * Asset requests: the IT head (asset.approve_it) and HR (asset.approve_hr)
 * both approve, in parallel; then IT hands over an asset of that type.
 * One person never decides both sides, and nobody decides their own request.
 */
@Injectable()
export class AssetRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly types: AssetTypesService,
  ) {}

  async create(companyId: string, access: AccessContext, dto: CreateRequestDto) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    const type = await this.types.get(companyId, dto.typeId);
    if (!type.isActive) throw new BadRequestException(`${type.name} can’t be requested`);
    const open = await this.prisma.assetRequest.count({
      where: { companyId, employeeId: access.employee.id, typeId: type.id, status: { in: [AssetRequestStatus.PENDING, AssetRequestStatus.APPROVED] } },
    });
    if (open) throw new ConflictException(`You already have an open request for a ${type.name.toLowerCase()}`);
    const r = await this.prisma.assetRequest.create({ data: { companyId, employeeId: access.employee.id, typeId: type.id, reason: dto.reason }, select: SELECT });
    const to = [...(await this.notifications.companyWideApprovers(companyId, IT)), ...(await this.notifications.companyWideApprovers(companyId, HR))];
    void this.notifications.notify({
      companyId,
      userIds: to.filter((u) => u !== access.userId),
      type: 'asset.requested',
      title: `${r.employee.firstName} ${r.employee.lastName} requested a ${type.name.toLowerCase()}`,
      body: `Reason: ${dto.reason}`,
      link: '/app/assets/requests',
      actionLabel: 'Review request',
    });
    return (await this.page([r], 1, 1, 1, access)).data[0];
  }

  async list(companyId: string, access: AccessContext, q: RequestQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const it = access.grants.has(IT);
    const hr = access.grants.has(HR);
    let where: Prisma.AssetRequestWhereInput;
    if (q.view === 'mine') {
      if (!access.employee) return this.page([], 0, page, limit, access);
      where = { companyId, employeeId: access.employee.id, ...(q.status && { status: q.status }) };
    } else if (q.view === 'review') {
      // Pending on a side I can decide, not mine, and I haven't decided the other side
      const sides: Prisma.AssetRequestWhereInput[] = [];
      if (it) sides.push({ itStatus: LeaveApprovalStatus.PENDING, OR: [{ hrById: null }, { hrById: { not: access.userId } }] });
      if (hr) sides.push({ hrStatus: LeaveApprovalStatus.PENDING, OR: [{ itById: null }, { itById: { not: access.userId } }] });
      if (!sides.length) return this.page([], 0, page, limit, access);
      where = { companyId, status: AssetRequestStatus.PENDING, employee: { userId: { not: access.userId } }, OR: sides };
    } else if (q.view === 'fulfil') {
      if (!holds(access, 'asset.manage')) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
      where = { companyId, status: AssetRequestStatus.APPROVED };
    } else {
      if (!it && !hr && !holds(access, 'asset.manage')) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
      where = { companyId, ...(q.status && { status: q.status }) };
    }
    const [rows, total] = await Promise.all([
      this.prisma.assetRequest.findMany({ where, select: SELECT, orderBy: { createdAt: q.view === 'mine' ? 'desc' : 'asc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.assetRequest.count({ where }),
    ]);
    return this.page(rows, total, page, limit, access);
  }

  async pendingCount(companyId: string, access: AccessContext) {
    const review = (await this.list(companyId, access, { view: 'review', limit: 1 })).meta.total;
    const fulfil = holds(access, 'asset.manage') ? await this.prisma.assetRequest.count({ where: { companyId, status: AssetRequestStatus.APPROVED } }) : 0;
    return review + fulfil;
  }

  async approve(companyId: string, access: AccessContext, id: string, dto: DecideRequestDto) {
    const { r, side } = await this.decidable(companyId, access, id);
    const both = await this.prisma.$transaction(async (tx) => {
      const data = side === 'IT'
        ? { itStatus: LeaveApprovalStatus.APPROVED, itById: access.userId, itAt: new Date(), itNote: dto.note ?? null }
        : { hrStatus: LeaveApprovalStatus.APPROVED, hrById: access.userId, hrAt: new Date(), hrNote: dto.note ?? null };
      const { count } = await tx.assetRequest.updateMany({ where: { id, status: AssetRequestStatus.PENDING, [side === 'IT' ? 'itStatus' : 'hrStatus']: LeaveApprovalStatus.PENDING }, data });
      if (!count) throw new ConflictException('This side has already been decided');
      const now = await tx.assetRequest.findUniqueOrThrow({ where: { id }, select: { itStatus: true, hrStatus: true } });
      if (now.itStatus === LeaveApprovalStatus.APPROVED && now.hrStatus === LeaveApprovalStatus.APPROVED) {
        await tx.assetRequest.update({ where: { id }, data: { status: AssetRequestStatus.APPROVED } });
        return true;
      }
      return false;
    });
    if (both) {
      void this.notifications.notify({
        companyId,
        userIds: [r.employee.userId],
        type: 'asset.request_approved',
        title: `Your ${r.type.name.toLowerCase()} request was approved`,
        body: 'IT will hand one over to you soon.',
        link: '/app/assets/mine',
      });
      const it = (await this.notifications.companyWideApprovers(companyId, 'asset.manage')).filter((u) => u !== r.employee.userId);
      void this.notifications.notify({ companyId, userIds: it, type: 'asset.to_fulfil', title: `Hand over a ${r.type.name.toLowerCase()} to ${r.employee.firstName} ${r.employee.lastName}`, link: '/app/assets/requests', email: false });
    }
    return this.get(companyId, access, id);
  }

  async reject(companyId: string, access: AccessContext, id: string, dto: RejectRequestDto) {
    const { r, side } = await this.decidable(companyId, access, id);
    const data = side === 'IT'
      ? { itStatus: LeaveApprovalStatus.REJECTED, itById: access.userId, itAt: new Date(), itNote: dto.reason, hrStatus: r.hrStatus === LeaveApprovalStatus.PENDING ? LeaveApprovalStatus.SKIPPED : r.hrStatus }
      : { hrStatus: LeaveApprovalStatus.REJECTED, hrById: access.userId, hrAt: new Date(), hrNote: dto.reason, itStatus: r.itStatus === LeaveApprovalStatus.PENDING ? LeaveApprovalStatus.SKIPPED : r.itStatus };
    const { count } = await this.prisma.assetRequest.updateMany({ where: { id, status: AssetRequestStatus.PENDING }, data: { ...data, status: AssetRequestStatus.REJECTED } });
    if (!count) throw new ConflictException('This request has already been decided');
    void this.notifications.notify({
      companyId,
      userIds: [r.employee.userId],
      type: 'asset.request_rejected',
      title: `Your ${r.type.name.toLowerCase()} request was not approved`,
      body: `${side === 'IT' ? 'IT' : 'HR'}: ${dto.reason}`,
      link: '/app/assets/mine',
    });
    return this.get(companyId, access, id);
  }

  async cancel(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.assetRequest.findFirst({ where: { id, companyId }, select: { employeeId: true } });
    if (!r || r.employeeId !== access.employee?.id) throw new NotFoundException('Request not found');
    const { count } = await this.prisma.assetRequest.updateMany({ where: { id, status: { in: [AssetRequestStatus.PENDING, AssetRequestStatus.APPROVED] } }, data: { status: AssetRequestStatus.CANCELLED } });
    if (!count) throw new BadRequestException('Only open requests can be cancelled');
    return this.get(companyId, access, id);
  }

  async get(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.assetRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!r) throw new NotFoundException('Request not found');
    const allowed = r.employee.userId === access.userId || access.grants.has(IT) || access.grants.has(HR) || holds(access, 'asset.manage');
    if (!allowed) throw new NotFoundException('Request not found');
    return (await this.page([r], 1, 1, 1, access)).data[0]!;
  }

  /** Which side the caller may decide now. */
  private sideFor(access: AccessContext, r: Row): 'IT' | 'HR' | null {
    if (r.status !== AssetRequestStatus.PENDING || r.employee.userId === access.userId) return null;
    if (access.grants.has(IT) && r.itStatus === LeaveApprovalStatus.PENDING && r.hrById !== access.userId) return 'IT';
    if (access.grants.has(HR) && r.hrStatus === LeaveApprovalStatus.PENDING && r.itById !== access.userId) return 'HR';
    return null;
  }

  private async decidable(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.assetRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!r || r.employee.userId === access.userId) throw new NotFoundException('Request not found');
    if (r.status !== AssetRequestStatus.PENDING) throw new ConflictException('This request has already been decided');
    const side = this.sideFor(access, r);
    if (!side) throw new ForbiddenException('This request is waiting for someone else');
    return { r, side };
  }

  private async page(rows: Row[], total: number, page: number, limit: number, access: AccessContext) {
    const ids = [...new Set(rows.flatMap((r) => [r.itById, r.hrById].filter((x): x is string => Boolean(x))))];
    const names = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, ...NAME })).map((u) => [u.id, u]));
    const assetIds = rows.map((r) => r.assetId).filter((x): x is string => Boolean(x));
    const assets = new Map((await this.prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, tag: true, name: true } })).map((a) => [a.id, a]));
    return {
      data: rows.map((r) => {
        const { userId: _u, ...employee } = r.employee;
        const side = this.sideFor(access, r);
        return {
          id: r.id,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
          type: r.type,
          employee,
          it: { status: r.itStatus, by: r.itById ? names.get(r.itById) ?? null : null, at: r.itAt, note: r.itNote },
          hr: { status: r.hrStatus, by: r.hrById ? names.get(r.hrById) ?? null : null, at: r.hrAt, note: r.hrNote },
          asset: r.assetId ? assets.get(r.assetId) ?? null : null,
          canDecide: Boolean(side),
          decideAs: side,
          canFulfil: r.status === AssetRequestStatus.APPROVED && holds(access, 'asset.manage'),
          canCancel: r.employee.userId === access.userId && (r.status === AssetRequestStatus.PENDING || r.status === AssetRequestStatus.APPROVED),
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
