import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveCategoryDto } from './dto';

export const toPaise = (rupees: number) => Math.round(rupees * 100);

/** Created once for a company without categories (all editable). Amounts in paise. */
const DEFAULTS: Array<Omit<Prisma.ExpenseCategoryUncheckedCreateInput, 'companyId'>> = [
  { name: 'Travel', description: 'Flights, trains, intercity cabs.', receiptRequiredAbovePaise: 0, sortOrder: 10 },
  { name: 'Local conveyance', description: 'Autos, cabs and fuel within the city.', maxPerItemPaise: 200_000, receiptRequiredAbovePaise: 50_000, sortOrder: 20 },
  { name: 'Food', description: 'Meals while travelling or working late.', maxPerItemPaise: 150_000, receiptRequiredAbovePaise: 30_000, sortOrder: 30 },
  { name: 'Accommodation', description: 'Hotels and stays.', receiptRequiredAbovePaise: 0, sortOrder: 40 },
  { name: 'Internet / phone', description: 'Work connectivity bills.', maxPerItemPaise: 150_000, receiptRequiredAbovePaise: 0, sortOrder: 50 },
  { name: 'Client entertainment', description: 'Meals or events with clients.', receiptRequiredAbovePaise: 0, sortOrder: 60 },
  { name: 'Other', description: 'Anything else — explain in the description.', receiptRequiredAbovePaise: 0, sortOrder: 90 },
];

const SELECT = { id: true, name: true, description: true, maxPerItemPaise: true, receiptRequiredAbovePaise: true, isActive: true, sortOrder: true } satisfies Prisma.ExpenseCategorySelect;
export type CategoryRow = Prisma.ExpenseCategoryGetPayload<{ select: typeof SELECT }>;

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, includeInactive = false): Promise<CategoryRow[]> {
    if (!(await this.prisma.expenseCategory.count({ where: { companyId } }))) {
      await this.prisma.expenseCategory.createMany({ data: DEFAULTS.map((d) => ({ ...d, companyId })), skipDuplicates: true });
    }
    return this.prisma.expenseCategory.findMany({
      where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: SELECT,
    });
  }

  async get(companyId: string, id: string): Promise<CategoryRow> {
    const c = await this.prisma.expenseCategory.findFirst({ where: { id, companyId }, select: SELECT });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  async save(companyId: string, id: string | null, dto: SaveCategoryDto) {
    if (id) await this.get(companyId, id);
    const data = {
      name: dto.name,
      description: dto.description ?? null,
      maxPerItemPaise: dto.maxPerItem == null ? null : toPaise(dto.maxPerItem),
      receiptRequiredAbovePaise: dto.receiptRequiredAbove == null ? null : toPaise(dto.receiptRequiredAbove),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 100,
    };
    try {
      return id
        ? await this.prisma.expenseCategory.update({ where: { id }, data, select: SELECT })
        : await this.prisma.expenseCategory.create({ data: { ...data, companyId }, select: SELECT });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException(`A category called "${dto.name}" already exists`);
      throw err;
    }
  }
}
