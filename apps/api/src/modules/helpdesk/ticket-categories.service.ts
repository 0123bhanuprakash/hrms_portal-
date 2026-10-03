import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketQueue } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveCategoryDto } from './dto';

const DEFAULTS: Array<[TicketQueue, string]> = [
  ['IT', 'Laptop / hardware'],
  ['IT', 'Software & installs'],
  ['IT', 'Access & passwords'],
  ['IT', 'Email & accounts'],
  ['IT', 'Network / VPN'],
  ['IT', 'Other'],
  ['HR', 'Leave & attendance'],
  ['HR', 'Letters & documents'],
  ['HR', 'Policies'],
  ['HR', 'Benefits & insurance'],
  ['HR', 'Profile changes'],
  ['HR', 'Other'],
  ['FINANCE', 'Salary & payslip'],
  ['FINANCE', 'Reimbursements'],
  ['FINANCE', 'Tax & investment proofs'],
  ['FINANCE', 'Other'],
];

const SELECT = { id: true, queue: true, name: true, isActive: true, sortOrder: true } satisfies Prisma.TicketCategorySelect;

/** Categories per queue; defaults are created the first time a company opens the helpdesk. */
@Injectable()
export class TicketCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, includeInactive: boolean, queue?: TicketQueue) {
    await this.ensureDefaults(companyId);
    return this.prisma.ticketCategory.findMany({
      where: { companyId, ...(queue && { queue }), ...(!includeInactive && { isActive: true }) },
      select: SELECT,
      orderBy: [{ queue: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async get(companyId: string, id: string) {
    const c = await this.prisma.ticketCategory.findFirst({ where: { id, companyId }, select: SELECT });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  async save(companyId: string, id: string | null, dto: SaveCategoryDto) {
    const data = { queue: dto.queue, name: dto.name, ...(dto.isActive !== undefined && { isActive: dto.isActive }), ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }) };
    try {
      if (!id) return await this.prisma.ticketCategory.create({ data: { companyId, ...data, sortOrder: dto.sortOrder ?? 50 }, select: SELECT });
      await this.get(companyId, id);
      return await this.prisma.ticketCategory.update({ where: { id }, data, select: SELECT });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(`"${dto.name}" already exists in this queue`);
      throw e;
    }
  }

  private async ensureDefaults(companyId: string) {
    if (await this.prisma.ticketCategory.count({ where: { companyId } })) return;
    await this.prisma.ticketCategory.createMany({
      data: DEFAULTS.map(([queue, name], i) => ({ companyId, queue, name, sortOrder: name === 'Other' ? 90 : (i + 1) * 10 })),
      skipDuplicates: true,
    });
  }
}
