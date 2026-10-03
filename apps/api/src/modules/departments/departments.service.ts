import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HierarchyService } from '../access/hierarchy.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: HierarchyService,
  ) {}

  /** Parent department and head must belong to the same company (404 otherwise). */
  private async assertLinksInCompany(companyId: string, parentDepartmentId?: string | null, headEmployeeId?: string | null) {
    if (parentDepartmentId) {
      const parent = await this.prisma.department.count({ where: { id: parentDepartmentId, companyId } });
      if (!parent) throw new NotFoundException('Parent department not found');
    }
    if (headEmployeeId) {
      const head = await this.prisma.employee.count({ where: { id: headEmployeeId, companyId } });
      if (!head) throw new NotFoundException('Department head not found in this company');
    }
  }

  /**
   * Create a new department within a company
   */
  async create(companyId: string, dto: CreateDepartmentDto) {
    const uppercaseCode = dto.code.toUpperCase().trim();

    // Check code uniqueness per company
    const existing = await this.prisma.department.findUnique({
      where: {
        companyId_code: {
          companyId,
          code: uppercaseCode,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Department code '${uppercaseCode}' already exists in this company`,
      );
    }

    await this.assertLinksInCompany(companyId, dto.parentDepartmentId, dto.headEmployeeId);

    const created = await this.prisma.department.create({
      data: {
        companyId,
        name: dto.name.trim(),
        code: uppercaseCode,
        parentDepartmentId: dto.parentDepartmentId || null,
        headEmployeeId: dto.headEmployeeId || null,
      },
      include: {
        parentDepartment: true,
        _count: {
          select: { employees: true, subDepartments: true },
        },
      },
    });
    await this.hierarchy.rebuildDepartments(companyId);
    return created;
  }

  /**
   * List all departments for a company (supports hierarchy view)
   */
  async findAll(companyId: string, query?: { search?: string }) {
    const where: any = { companyId };

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.department.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        parentDepartment: true,
        subDepartments: true,
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  /**
   * Find single department by ID
   */
  async findOne(companyId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId },
      include: {
        parentDepartment: true,
        subDepartments: true,
        employees: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID '${id}' not found`);
    }

    return department;
  }

  /**
   * Update department
   */
  async update(companyId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(companyId, id);

    if (dto.parentDepartmentId === id) {
      throw new BadRequestException(
        'Department cannot be its own parent department',
      );
    }

    await this.assertLinksInCompany(companyId, dto.parentDepartmentId, dto.headEmployeeId);
    // Moving under one of its own sub-departments would create a loop
    if (dto.parentDepartmentId !== undefined) {
      await this.hierarchy.assertNoDepartmentLoop(this.prisma, id, dto.parentDepartmentId);
    }

    if (dto.code) {
      const codeUpper = dto.code.toUpperCase().trim();
      const existing = await this.prisma.department.findFirst({
        where: {
          companyId,
          code: codeUpper,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Department code '${codeUpper}' already in use`,
        );
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.code && { code: dto.code.toUpperCase().trim() }),
        ...(dto.parentDepartmentId !== undefined && {
          parentDepartmentId: dto.parentDepartmentId,
        }),
        ...(dto.headEmployeeId !== undefined && {
          headEmployeeId: dto.headEmployeeId,
        }),
      },
      include: {
        parentDepartment: true,
        subDepartments: true,
      },
    });
    if (dto.parentDepartmentId !== undefined) await this.hierarchy.rebuildDepartments(companyId);
    return updated;
  }

  /**
   * Delete department (only if no employees attached)
   */
  async remove(companyId: string, id: string) {
    const dept = await this.findOne(companyId, id);

    const employeeCount = await this.prisma.employee.count({
      where: { departmentId: id },
    });

    if (employeeCount > 0) {
      throw new BadRequestException(
        `Cannot delete department containing ${employeeCount} employee(s). Reassign them first.`,
      );
    }

    await this.prisma.department.delete({ where: { id } });
    await this.hierarchy.rebuildDepartments(companyId);

    return { message: 'Department deleted successfully' };
  }
}
