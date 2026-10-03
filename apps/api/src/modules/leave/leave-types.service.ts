import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveLeaveTypeDto } from './dto';

type TypeSeed = Omit<Prisma.LeaveTypeUncheckedCreateInput, 'companyId'>;

/** Created once for a company that has no leave types yet (all editable). */
const DEFAULT_TYPES: TypeSeed[] = [
  { code: 'CL', name: 'Casual Leave', category: 'CASUAL', color: '#0EA5E9', accrual: 'UPFRONT', annualQuota: 12, minNoticeDays: 1, maxConsecutiveDays: 3, sortOrder: 10, description: 'Short personal needs.' },
  { code: 'SL', name: 'Sick Leave', category: 'SICK', color: '#F43F5E', accrual: 'UPFRONT', annualQuota: 12, sortOrder: 20, description: 'Illness or medical appointments. Can be applied after the fact.' },
  { code: 'EL', name: 'Earned Leave', category: 'EARNED', color: '#10B981', accrual: 'MONTHLY', annualQuota: 18, carryForward: true, maxCarryForward: 30, minNoticeDays: 7, sortOrder: 30, description: 'Planned vacations. Builds up monthly; unused days carry forward.' },
  { code: 'WFH', name: 'Work From Home', category: 'WORK_FROM_HOME', color: '#8B5CF6', accrual: 'NONE', annualQuota: 0, countsAsPresent: true, sortOrder: 40, description: 'Working remotely — counts as a working day.' },
  { code: 'LOP', name: 'Unpaid Leave', category: 'UNPAID', color: '#64748B', accrual: 'NONE', annualQuota: 0, isPaid: false, sortOrder: 50, description: 'Leave without pay (loss of pay).' },
  { code: 'ML', name: 'Maternity Leave', category: 'MATERNITY', color: '#EC4899', accrual: 'UPFRONT', annualQuota: 182, allowHalfDay: false, includeNonWorkingDays: true, gender: 'FEMALE', approvalLevels: 1, sortOrder: 60, description: '26 weeks under the Maternity Benefit Act.' },
  { code: 'PL', name: 'Paternity Leave', category: 'PATERNITY', color: '#F59E0B', accrual: 'UPFRONT', annualQuota: 5, allowHalfDay: false, gender: 'MALE', sortOrder: 70, description: 'Time off around the birth or adoption of a child.' },
];

const SELECT = {
  id: true,
  name: true,
  code: true,
  category: true,
  description: true,
  color: true,
  accrual: true,
  annualQuota: true,
  carryForward: true,
  maxCarryForward: true,
  isPaid: true,
  allowHalfDay: true,
  approvalLevels: true,
  minNoticeDays: true,
  maxConsecutiveDays: true,
  includeNonWorkingDays: true,
  countsAsPresent: true,
  gender: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.LeaveTypeSelect;
export type LeaveTypeRow = Prisma.LeaveTypeGetPayload<{ select: typeof SELECT }>;

@Injectable()
export class LeaveTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active types (all, for admins), creating the defaults the first time. */
  async list(companyId: string, includeInactive = false): Promise<LeaveTypeRow[]> {
    await this.ensureDefaults(companyId);
    return this.prisma.leaveType.findMany({
      where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: SELECT,
    });
  }

  async get(companyId: string, id: string): Promise<LeaveTypeRow> {
    const type = await this.prisma.leaveType.findFirst({ where: { id, companyId }, select: SELECT });
    if (!type) throw new NotFoundException('Leave type not found');
    return type;
  }

  async ensureDefaults(companyId: string): Promise<void> {
    if (await this.prisma.leaveType.count({ where: { companyId } })) return;
    await this.prisma.leaveType.createMany({ data: DEFAULT_TYPES.map((t) => ({ ...t, companyId })), skipDuplicates: true });
  }

  async create(companyId: string, dto: SaveLeaveTypeDto) {
    await this.ensureDefaults(companyId);
    this.validate(dto);
    try {
      return await this.prisma.leaveType.create({ data: { ...this.data(dto), companyId }, select: SELECT });
    } catch (err) {
      throw this.duplicate(err, dto.code);
    }
  }

  async update(companyId: string, id: string, dto: SaveLeaveTypeDto) {
    await this.get(companyId, id);
    this.validate(dto);
    try {
      return await this.prisma.leaveType.update({ where: { id }, data: this.data(dto), select: SELECT });
    } catch (err) {
      throw this.duplicate(err, dto.code);
    }
  }

  private validate(dto: SaveLeaveTypeDto) {
    if (dto.accrual !== 'NONE' && dto.annualQuota <= 0) throw new BadRequestException('Give the yearly quota, or choose "Unlimited"');
    if (dto.annualQuota * 2 !== Math.round(dto.annualQuota * 2)) throw new BadRequestException('Quota must be in half-day steps');
    if (dto.accrual === 'NONE' && dto.carryForward) throw new BadRequestException('Unlimited leave cannot carry forward');
  }

  private data(dto: SaveLeaveTypeDto) {
    return {
      name: dto.name,
      code: dto.code,
      category: dto.category,
      description: dto.description ?? null,
      color: dto.color ?? '#6366F1',
      accrual: dto.accrual,
      annualQuota: dto.accrual === 'NONE' ? 0 : dto.annualQuota,
      carryForward: dto.accrual !== 'NONE' && Boolean(dto.carryForward),
      maxCarryForward: dto.carryForward ? (dto.maxCarryForward ?? 0) : 0,
      isPaid: dto.isPaid ?? true,
      allowHalfDay: dto.allowHalfDay ?? true,
      approvalLevels: dto.approvalLevels,
      minNoticeDays: dto.minNoticeDays ?? 0,
      maxConsecutiveDays: dto.maxConsecutiveDays ?? null,
      includeNonWorkingDays: dto.includeNonWorkingDays ?? false,
      countsAsPresent: dto.countsAsPresent ?? false,
      gender: dto.gender ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 100,
    };
  }

  private duplicate(err: unknown, code: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return new ConflictException(`A leave type with code ${code} already exists`);
    return err;
  }
}
