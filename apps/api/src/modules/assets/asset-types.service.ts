import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveAssetTypeDto } from './dto';

/** Created once for a company without types (all editable). */
const DEFAULTS = [
  ['Laptop', 'LAP', 10],
  ['Monitor', 'MON', 20],
  ['Phone', 'PHN', 30],
  ['SIM card', 'SIM', 40],
  ['ID card', 'IDC', 50],
  ['Headset', 'HDS', 60],
  ['Keyboard & mouse', 'KBM', 70],
  ['Other', 'OTH', 90],
] as const;

const SELECT = { id: true, name: true, prefix: true, isActive: true, sortOrder: true } satisfies Prisma.AssetTypeSelect;

@Injectable()
export class AssetTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, includeInactive = false) {
    if (!(await this.prisma.assetType.count({ where: { companyId } }))) {
      await this.prisma.assetType.createMany({ data: DEFAULTS.map(([name, prefix, sortOrder]) => ({ companyId, name, prefix, sortOrder })), skipDuplicates: true });
    }
    return this.prisma.assetType.findMany({ where: { companyId, ...(includeInactive ? {} : { isActive: true }) }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: SELECT });
  }

  async get(companyId: string, id: string) {
    const t = await this.prisma.assetType.findFirst({ where: { id, companyId }, select: SELECT });
    if (!t) throw new NotFoundException('Asset type not found');
    return t;
  }

  async save(companyId: string, id: string | null, dto: SaveAssetTypeDto) {
    if (id) await this.get(companyId, id);
    const data = { name: dto.name, prefix: dto.prefix, isActive: dto.isActive ?? true, sortOrder: dto.sortOrder ?? 100 };
    try {
      return id ? await this.prisma.assetType.update({ where: { id }, data, select: SELECT }) : await this.prisma.assetType.create({ data: { ...data, companyId }, select: SELECT });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException(`An asset type called "${dto.name}" already exists`);
      throw err;
    }
  }
}
