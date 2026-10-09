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
  { code: 'ML', name: 'Maternity Leave', category: 'MATERNITY', color: '#EC4899', accrual: 'UPFRONT', annualQuota: 182, allowHalfDay: false, includeNonWorkingDays: true, availability: 'GRANT_ONLY', genders: ['FEMALE'], grantNeedsDocument: true, approvalLevels: 1, sortOrder: 60, description: '26 weeks under the Maternity Benefit Act. Ask HR with a supporting document; HR grants it.' },
  { code: 'PL', name: 'Paternity Leave', category: 'PATERNITY', color: '#F59E0B', accrual: 'UPFRONT', annualQuota: 5, allowHalfDay: false, availability: 'RULES', genders: ['MALE'], sortOrder: 70, description: 'Time off around the birth or adoption of a child.' },
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
  availability: true,
  genders: true,
  departmentIds: true,
  locationIds: true,
  designationIds: true,
  employmentTypes: true,
  minServiceMonths: true,
  managerIds: true,
  managerDeep: true,
  projectIds: true,
  grantNeedsDocument: true,
  members: { select: { employeeId: true, mode: true } },
  blockDuringProbation: true,
  documentAfterDays: true,
  sandwichRule: true,
  negativeBalance: true,
  recoverNegative: true,
  carryExpiry: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.LeaveTypeSelect;
export type LeaveTypeRow = Prisma.LeaveTypeGetPayload<{ select: typeof SELECT }>;

/** What everyone may see of a type — the rules and named people stay with leave admins. */
export function publicType(t: LeaveTypeRow) {
  const { genders, departmentIds, locationIds, designationIds, employmentTypes, minServiceMonths, managerIds, managerDeep, projectIds, members, ...rest } = t;
  void [departmentIds, locationIds, designationIds, employmentTypes, minServiceMonths, managerIds, managerDeep, projectIds, members];
  return { ...rest, genders };
}

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
    await this.checkRefs(companyId, dto);
    try {
      return await this.prisma.leaveType.create({ data: { ...this.data(dto), companyId, members: { create: this.members(dto) } }, select: SELECT });
    } catch (err) {
      throw this.duplicate(err, dto.code);
    }
  }

  async update(companyId: string, id: string, dto: SaveLeaveTypeDto) {
    await this.get(companyId, id);
    this.validate(dto);
    await this.checkRefs(companyId, dto);
    try {
      return await this.prisma.leaveType.update({ where: { id }, data: { ...this.data(dto), members: { deleteMany: {}, create: this.members(dto) } }, select: SELECT });
    } catch (err) {
      throw this.duplicate(err, dto.code);
    }
  }

  /** Rule values must be this company's departments, offices, people… */
  private async checkRefs(companyId: string, dto: SaveLeaveTypeDto) {
    const people = [...new Set([...(dto.managerIds ?? []), ...(dto.members ?? []).map((m) => m.employeeId)])];
    const [departments, locations, designations, employees, projects] = await Promise.all([
      dto.departmentIds?.length ? this.prisma.department.count({ where: { companyId, id: { in: dto.departmentIds } } }) : 0,
      dto.locationIds?.length ? this.prisma.officeLocation.count({ where: { companyId, id: { in: dto.locationIds } } }) : 0,
      dto.designationIds?.length ? this.prisma.designation.count({ where: { companyId, id: { in: dto.designationIds } } }) : 0,
      people.length ? this.prisma.employee.count({ where: { companyId, id: { in: people } } }) : 0,
      dto.projectIds?.length ? this.prisma.project.count({ where: { companyId, id: { in: dto.projectIds } } }) : 0,
    ]);
    const bad =
      departments !== new Set(dto.departmentIds ?? []).size ||
      locations !== new Set(dto.locationIds ?? []).size ||
      designations !== new Set(dto.designationIds ?? []).size ||
      employees !== people.length ||
      projects !== new Set(dto.projectIds ?? []).size;
    if (bad) throw new BadRequestException('Some of the chosen departments, offices, designations, projects or people no longer exist');
  }

  private members(dto: SaveLeaveTypeDto) {
    const seen = new Set<string>();
    return (dto.availability === 'EVERYONE' ? [] : (dto.members ?? [])).filter((m) => !seen.has(m.employeeId) && seen.add(m.employeeId)).map((m) => ({ employeeId: m.employeeId, mode: m.mode }));
  }

  private validate(dto: SaveLeaveTypeDto) {
    if (dto.accrual !== 'NONE' && dto.annualQuota <= 0) throw new BadRequestException('Give the yearly quota, or choose "Unlimited"');
    if (dto.annualQuota * 2 !== Math.round(dto.annualQuota * 2)) throw new BadRequestException('Quota must be in half-day steps');
    if (dto.accrual === 'NONE' && dto.carryForward) throw new BadRequestException('Unlimited leave cannot carry forward');
    if (dto.negativeBalance && dto.accrual === 'NONE') throw new BadRequestException('Unlimited leave has no balance to go below');
    if ((dto.negativeBalance ?? 0) * 2 !== Math.round((dto.negativeBalance ?? 0) * 2)) throw new BadRequestException('Negative balance must be in half-day steps');
    if (dto.carryExpiry && !dto.carryForward) throw new BadRequestException('Carried days can only expire when the type carries days forward');
    if (dto.availability === 'GRANT_ONLY') {
      if (dto.accrual !== 'UPFRONT') throw new BadRequestException('Leave given only by grant uses the quota as the usual number of days per grant — choose "Credited for the year"');
      if (dto.carryForward || dto.negativeBalance) throw new BadRequestException('Leave given only by grant cannot carry forward or go below 0');
    }
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
      availability: dto.availability ?? 'EVERYONE',
      ...this.rules(dto),
      grantNeedsDocument: dto.availability === 'GRANT_ONLY' && Boolean(dto.grantNeedsDocument),
      blockDuringProbation: dto.blockDuringProbation ?? false,
      documentAfterDays: dto.documentAfterDays ?? null,
      sandwichRule: dto.sandwichRule ?? false,
      negativeBalance: dto.accrual === 'NONE' ? 0 : (dto.negativeBalance ?? 0),
      recoverNegative: dto.recoverNegative ?? true,
      carryExpiry: dto.carryForward ? (dto.carryExpiry ?? null) : null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 100,
    };
  }

  /** Rule fields are kept only when the type uses them. */
  private rules(dto: SaveLeaveTypeDto) {
    const on = dto.availability === 'RULES' || dto.availability === 'GRANT_ONLY';
    const uniq = <T,>(list: T[] | undefined) => (on ? [...new Set(list ?? [])] : []);
    return {
      genders: uniq(dto.genders),
      departmentIds: uniq(dto.departmentIds),
      locationIds: uniq(dto.locationIds),
      designationIds: uniq(dto.designationIds),
      employmentTypes: uniq(dto.employmentTypes),
      minServiceMonths: on ? (dto.minServiceMonths ?? null) : null,
      managerIds: uniq(dto.managerIds),
      managerDeep: on && Boolean(dto.managerDeep),
      projectIds: uniq(dto.projectIds),
    };
  }

  private duplicate(err: unknown, code: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return new ConflictException(`A leave type with code ${code} already exists`);
    return err;
  }
}
