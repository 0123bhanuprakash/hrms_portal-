import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveAssetTypeDto } from './dto';

export const ASSET_ICONS = ['laptop', 'monitor', 'phone', 'idcard', 'headset', 'keyboard', 'sim', 'box'] as const;

/** Created once for a company without types (all editable). */
const DEFAULTS: Array<Omit<Prisma.AssetTypeUncheckedCreateInput, 'companyId'>> = [
  { name: 'Laptop', prefix: 'LAP', sortOrder: 10, icon: 'laptop', warrantyMonths: 12, replaceAfterYears: 4, loanable: true, maxLoanDays: 30, fields: ['Processor', 'Memory', 'Storage', 'OS'], checklist: ['Charger', 'Tag sticker on the base'] },
  { name: 'Monitor', prefix: 'MON', sortOrder: 20, icon: 'monitor', warrantyMonths: 36, replaceAfterYears: 6, loanable: true, maxLoanDays: 30, checklist: ['Power and display cables'] },
  { name: 'Phone', prefix: 'PHN', sortOrder: 30, icon: 'phone', warrantyMonths: 12, replaceAfterYears: 3, loanable: true, maxLoanDays: 30, fields: ['IMEI'], checklist: ['Charger'] },
  { name: 'SIM card', prefix: 'SIM', sortOrder: 40, icon: 'sim' },
  { name: 'ID card', prefix: 'IDC', sortOrder: 50, icon: 'idcard' },
  { name: 'Headset', prefix: 'HDS', sortOrder: 60, icon: 'headset', loanable: true, maxLoanDays: 30 },
  { name: 'Keyboard & mouse', prefix: 'KBM', sortOrder: 70, icon: 'keyboard' },
  { name: 'Other', prefix: 'OTH', sortOrder: 90, icon: 'box' },
];

const SELECT = {
  id: true,
  name: true,
  prefix: true,
  isActive: true,
  sortOrder: true,
  icon: true,
  description: true,
  warrantyMonths: true,
  replaceAfterYears: true,
  minStock: true,
  requestable: true,
  loanable: true,
  maxLoanDays: true,
  fields: true,
  checklist: true,
} satisfies Prisma.AssetTypeSelect;
export type AssetTypeRow = Prisma.AssetTypeGetPayload<{ select: typeof SELECT }>;

@Injectable()
export class AssetTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, includeInactive = false): Promise<AssetTypeRow[]> {
    if (!(await this.prisma.assetType.count({ where: { companyId } }))) {
      await this.prisma.assetType.createMany({ data: DEFAULTS.map((d) => ({ ...d, companyId })), skipDuplicates: true });
    }
    return this.prisma.assetType.findMany({ where: { companyId, ...(includeInactive ? {} : { isActive: true }) }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: SELECT });
  }

  /** Types with what's in stock — for "Request something". */
  async catalog(companyId: string) {
    const types = (await this.list(companyId)).filter((t) => t.requestable);
    const counts = await this.prisma.asset.groupBy({ by: ['typeId'], where: { companyId, status: 'AVAILABLE' }, _count: { _all: true } });
    return types.map((t) => ({ ...t, available: counts.find((c) => c.typeId === t.id)?._count._all ?? 0 }));
  }

  async get(companyId: string, id: string): Promise<AssetTypeRow> {
    const t = await this.prisma.assetType.findFirst({ where: { id, companyId }, select: SELECT });
    if (!t) throw new NotFoundException('Asset type not found');
    return t;
  }

  async save(companyId: string, id: string | null, dto: SaveAssetTypeDto) {
    if (id) await this.get(companyId, id);
    const clean = (xs?: string[]) => [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))].slice(0, 20);
    const data = {
      name: dto.name,
      prefix: dto.prefix,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 100,
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.warrantyMonths !== undefined && { warrantyMonths: dto.warrantyMonths }),
      ...(dto.replaceAfterYears !== undefined && { replaceAfterYears: dto.replaceAfterYears }),
      ...(dto.minStock !== undefined && { minStock: dto.minStock }),
      ...(dto.requestable !== undefined && { requestable: dto.requestable }),
      ...(dto.loanable !== undefined && { loanable: dto.loanable }),
      ...(dto.maxLoanDays !== undefined && { maxLoanDays: dto.maxLoanDays }),
      ...(dto.fields !== undefined && { fields: clean(dto.fields) }),
      ...(dto.checklist !== undefined && { checklist: clean(dto.checklist) }),
    };
    try {
      return id ? await this.prisma.assetType.update({ where: { id }, data, select: SELECT }) : await this.prisma.assetType.create({ data: { ...data, companyId }, select: SELECT });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException(`An asset type called "${dto.name}" already exists`);
      throw err;
    }
  }
}
