import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetCondition, AssetRequestStatus, AssetStatus, EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import { AssetTypesService } from './asset-types.service';
import type { AssetQueryDto, AssignAssetDto, ReturnAssetDto, SaveAssetDto, SetStatusDto } from './dto';

const PERSON = { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } } satisfies Prisma.EmployeeSelect;
const ASSIGNMENT = {
  id: true,
  assignedAt: true,
  conditionOut: true,
  notes: true,
  acknowledgedAt: true,
  returnedAt: true,
  conditionIn: true,
  returnNotes: true,
  requestId: true,
  employee: { select: PERSON },
} satisfies Prisma.AssetAssignmentSelect;
const SELECT = {
  id: true,
  tag: true,
  name: true,
  brand: true,
  model: true,
  serialNumber: true,
  purchaseDate: true,
  purchaseCostPaise: true,
  vendor: true,
  warrantyUntil: true,
  condition: true,
  status: true,
  locationId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  type: { select: { id: true, name: true, prefix: true } },
  assignments: { where: { returnedAt: null }, select: ASSIGNMENT, take: 1 },
} satisfies Prisma.AssetSelect;
type Row = Prisma.AssetGetPayload<{ select: typeof SELECT }>;

/**
 * The asset register (IT) and who holds what. An asset has at most one
 * open assignment; the holder confirms receipt in the app.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly types: AssetTypesService,
  ) {}

  /** IT (asset.manage) or company-wide viewers (HR) see the whole register. */
  private seesRegister(access: AccessContext) {
    return holds(access, 'asset.manage') || (access.grants.has('asset.view') && (access.grants.get('asset.view') ?? 'company') === 'company');
  }

  // ─── Register ──────────────────────────────────────────────

  async list(companyId: string, access: AccessContext, q: AssetQueryDto) {
    if (!this.seesRegister(access)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const today = await this.todayKey(companyId);
    const where: Prisma.AssetWhereInput = {
      companyId,
      ...(q.status && { status: q.status }),
      ...(q.typeId && { typeId: q.typeId }),
      ...(q.employeeId && { assignments: { some: { employeeId: q.employeeId, returnedAt: null } } }),
      ...(q.warrantyWithinDays !== undefined && { warrantyUntil: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, q.warrantyWithinDays)) }, status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] } }),
      ...(q.search && {
        OR: ['tag', 'name', 'brand', 'model', 'serialNumber'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } })) as Prisma.AssetWhereInput[],
      }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.asset.findMany({ where, select: SELECT, orderBy: [{ tag: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.asset.count({ where }),
    ]);
    return { data: rows.map((r) => this.present(r, access)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async get(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.asset.findFirst({ where: { id, companyId }, select: SELECT });
    if (!row) throw new NotFoundException('Asset not found');
    const holder = row.assignments[0]?.employee;
    if (!this.seesRegister(access) && holder?.userId !== access.userId) throw new NotFoundException('Asset not found');
    const history = await this.prisma.assetAssignment.findMany({ where: { assetId: id }, select: ASSIGNMENT, orderBy: { assignedAt: 'desc' } });
    return { ...this.present(row, access), history: this.seesRegister(access) ? history.map((h) => this.presentAssignment(h)) : [] };
  }

  async create(companyId: string, access: AccessContext, dto: SaveAssetDto) {
    const type = await this.types.get(companyId, dto.typeId);
    await this.assertLocation(companyId, dto.locationId);
    for (let attempt = 0; attempt < 3; attempt++) {
      const tag = dto.tag ? dto.tag.toUpperCase() : await this.nextTag(companyId, type.prefix);
      try {
        const a = await this.prisma.asset.create({ data: { ...this.data(dto), companyId, tag }, select: { id: true } });
        return this.get(companyId, access, a.id);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          if (dto.tag) throw new ConflictException(`Tag ${tag} is already used`);
          continue; // someone took the generated tag — try the next one
        }
        throw err;
      }
    }
    throw new ConflictException('Could not generate a tag — enter one');
  }

  async update(companyId: string, access: AccessContext, id: string, dto: SaveAssetDto) {
    await this.exists(companyId, id);
    await this.types.get(companyId, dto.typeId);
    await this.assertLocation(companyId, dto.locationId);
    try {
      await this.prisma.asset.update({ where: { id }, data: { ...this.data(dto), ...(dto.tag && { tag: dto.tag.toUpperCase() }) } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException(`Tag ${dto.tag} is already used`);
      throw err;
    }
    return this.get(companyId, access, id);
  }

  // ─── Hand over / take back ─────────────────────────────────

  async assign(companyId: string, access: AccessContext, id: string, dto: AssignAssetDto) {
    const asset = await this.exists(companyId, id);
    if (asset.status !== AssetStatus.AVAILABLE) throw new BadRequestException(`This asset is ${asset.status.toLowerCase().replace('_', ' ')} — only available assets can be assigned`);
    const person = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId }, select: { id: true, userId: true, firstName: true, employmentStatus: true } });
    if (!person) throw new NotFoundException('Employee not found');
    if (person.employmentStatus === EmploymentStatus.TERMINATED) throw new BadRequestException(`${person.firstName} has left the company`);
    if (dto.requestId) {
      const req = await this.prisma.assetRequest.findFirst({ where: { id: dto.requestId, companyId }, select: { status: true, employeeId: true, typeId: true } });
      if (!req) throw new NotFoundException('Request not found');
      if (req.status !== AssetRequestStatus.APPROVED) throw new BadRequestException('That request isn’t approved (or was already fulfilled)');
      if (req.employeeId !== person.id) throw new BadRequestException('That request is from someone else');
      if (req.typeId !== asset.typeId) throw new BadRequestException('This asset is a different type from the one requested');
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.asset.updateMany({ where: { id, status: AssetStatus.AVAILABLE }, data: { status: AssetStatus.ASSIGNED } });
      if (!count) throw new ConflictException('Someone else just assigned this asset');
      await tx.assetAssignment.create({
        data: { companyId, assetId: id, employeeId: person.id, requestId: dto.requestId ?? null, assignedById: access.userId, conditionOut: dto.condition ?? asset.condition, notes: dto.notes ?? null },
      });
      if (dto.requestId) {
        const done = await tx.assetRequest.updateMany({ where: { id: dto.requestId, status: AssetRequestStatus.APPROVED }, data: { status: AssetRequestStatus.FULFILLED, assetId: id } });
        if (!done.count) throw new ConflictException('That request was just fulfilled by someone else');
      }
    });
    void this.notifications.notify({
      companyId,
      userIds: [person.userId],
      type: 'asset.assigned',
      title: `${asset.name} (${asset.tag}) was assigned to you`,
      body: 'Please confirm in the portal once you have received it.',
      link: '/app/assets/mine',
      actionLabel: 'Confirm receipt',
    });
    return this.get(companyId, access, id);
  }

  async returnAsset(companyId: string, access: AccessContext, id: string, dto: ReturnAssetDto) {
    await this.exists(companyId, id);
    const open = await this.prisma.assetAssignment.findFirst({ where: { assetId: id, returnedAt: null }, select: { id: true } });
    if (!open) throw new BadRequestException('This asset isn’t assigned to anyone');
    const damaged = dto.condition === AssetCondition.DAMAGED;
    await this.prisma.$transaction([
      this.prisma.assetAssignment.update({ where: { id: open.id }, data: { returnedAt: new Date(), returnedToId: access.userId, conditionIn: dto.condition, returnNotes: dto.notes ?? null } }),
      this.prisma.asset.update({ where: { id }, data: { status: damaged ? AssetStatus.IN_REPAIR : AssetStatus.AVAILABLE, condition: dto.condition } }),
    ]);
    return this.get(companyId, access, id);
  }

  async setStatus(companyId: string, access: AccessContext, id: string, dto: SetStatusDto) {
    const asset = await this.exists(companyId, id);
    const open = await this.prisma.assetAssignment.findFirst({ where: { assetId: id, returnedAt: null }, select: { id: true } });
    if (open && dto.status !== 'LOST') throw new BadRequestException('Take the asset back first');
    if (asset.status === dto.status) return this.get(companyId, access, id);
    await this.prisma.$transaction(async (tx) => {
      // Lost while someone had it: close their assignment
      if (open) await tx.assetAssignment.update({ where: { id: open.id }, data: { returnedAt: new Date(), returnedToId: access.userId, returnNotes: `Reported lost${dto.notes ? `: ${dto.notes}` : ''}` } });
      await tx.asset.update({ where: { id }, data: { status: dto.status, ...(dto.notes && { notes: dto.notes }) } });
    });
    return this.get(companyId, access, id);
  }

  /** The holder confirms they received it. */
  async acknowledge(companyId: string, access: AccessContext, assignmentId: string) {
    const a = await this.prisma.assetAssignment.findFirst({ where: { id: assignmentId, companyId }, select: { employeeId: true, returnedAt: true, acknowledgedAt: true } });
    if (!a || a.employeeId !== access.employee?.id) throw new NotFoundException('Assignment not found');
    if (a.returnedAt) throw new BadRequestException('This asset was already returned');
    if (!a.acknowledgedAt) await this.prisma.assetAssignment.update({ where: { id: assignmentId }, data: { acknowledgedAt: new Date() } });
    return this.mine(companyId, access);
  }

  // ─── Per person ────────────────────────────────────────────

  async mine(companyId: string, access: AccessContext) {
    if (!access.employee) return { current: [], past: [] };
    return this.forEmployeeRows(companyId, access.employee.id);
  }

  async forEmployee(companyId: string, access: AccessContext, employeeId: string) {
    await this.access.assertEmployeeInScope(access, 'asset.view', companyId, employeeId);
    return this.forEmployeeRows(companyId, employeeId);
  }

  private async forEmployeeRows(companyId: string, employeeId: string) {
    const rows = await this.prisma.assetAssignment.findMany({
      where: { companyId, employeeId },
      orderBy: { assignedAt: 'desc' },
      select: { ...ASSIGNMENT, asset: { select: { id: true, tag: true, name: true, brand: true, model: true, serialNumber: true, type: { select: { name: true } } } } },
    });
    const present = (r: (typeof rows)[number]) => ({ ...this.presentAssignment(r), asset: r.asset });
    return { current: rows.filter((r) => !r.returnedAt).map(present), past: rows.filter((r) => r.returnedAt).map(present) };
  }

  /** IT dashboard numbers. */
  async summary(companyId: string, access: AccessContext) {
    if (!this.seesRegister(access)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const today = await this.todayKey(companyId);
    const [byStatus, byType, types, warranty, unconfirmed, toFulfil] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
      this.prisma.asset.groupBy({ by: ['typeId', 'status'], where: { companyId }, _count: { _all: true } }),
      this.types.list(companyId, true),
      this.prisma.asset.count({ where: { companyId, status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] }, warrantyUntil: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, 30)) } } }),
      this.prisma.assetAssignment.count({ where: { companyId, returnedAt: null, acknowledgedAt: null } }),
      this.prisma.assetRequest.count({ where: { companyId, status: AssetRequestStatus.APPROVED } }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byType: types.map((t) => ({
        type: t,
        total: byType.filter((b) => b.typeId === t.id).reduce((s, b) => s + b._count._all, 0),
        available: byType.find((b) => b.typeId === t.id && b.status === AssetStatus.AVAILABLE)?._count._all ?? 0,
      })),
      warrantyEndingSoon: warranty,
      unconfirmed,
      requestsToFulfil: toFulfil,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async nextTag(companyId: string, prefix: string): Promise<string> {
    const rows = await this.prisma.asset.findMany({ where: { companyId, tag: { startsWith: `${prefix}-` } }, select: { tag: true } });
    const max = rows.reduce((m, r) => Math.max(m, Number(r.tag.slice(prefix.length + 1)) || 0), 0);
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }

  private data(dto: SaveAssetDto) {
    return {
      typeId: dto.typeId,
      name: dto.name,
      brand: dto.brand ?? null,
      model: dto.model ?? null,
      serialNumber: dto.serialNumber ?? null,
      purchaseDate: dto.purchaseDate ? dateFromKey(dto.purchaseDate) : null,
      purchaseCostPaise: dto.purchaseCost == null ? null : Math.round(dto.purchaseCost * 100),
      vendor: dto.vendor ?? null,
      warrantyUntil: dto.warrantyUntil ? dateFromKey(dto.warrantyUntil) : null,
      ...(dto.condition && { condition: dto.condition }),
      locationId: dto.locationId ?? null,
      notes: dto.notes ?? null,
    };
  }

  private async exists(companyId: string, id: string) {
    const a = await this.prisma.asset.findFirst({ where: { id, companyId }, select: { id: true, tag: true, name: true, status: true, typeId: true, condition: true } });
    if (!a) throw new NotFoundException('Asset not found');
    return a;
  }

  private async assertLocation(companyId: string, locationId?: string | null) {
    if (locationId && !(await this.prisma.officeLocation.count({ where: { id: locationId, companyId } }))) throw new NotFoundException('Location not found');
  }

  private presentAssignment(a: Prisma.AssetAssignmentGetPayload<{ select: typeof ASSIGNMENT }>) {
    const { userId: _u, ...employee } = a.employee;
    return { ...a, employee };
  }

  private present(r: Row, access: AccessContext) {
    const open = r.assignments[0];
    const { assignments: _a, ...rest } = r;
    return {
      ...rest,
      purchaseDate: r.purchaseDate ? keyFromDate(r.purchaseDate) : null,
      warrantyUntil: r.warrantyUntil ? keyFromDate(r.warrantyUntil) : null,
      holder: open ? this.presentAssignment(open) : null,
      canManage: holds(access, 'asset.manage'),
    };
  }

  async todayKey(companyId: string): Promise<string> {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }
}
