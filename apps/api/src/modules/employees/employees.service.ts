import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employee.dto';
import { UserStatus, EmploymentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create employee (Admin flow)
   * 1. Auto-generate sequential Employee ID (e.g., CL001)
   * 2. Create User account & default Employee role
   * 3. Create Employee profile
   * 4. Send welcome email with login credentials
   */
  async create(companyId: string, dto: CreateEmployeeDto) {
    const emailLower = dto.email.toLowerCase().trim();

    // Check user email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      throw new ConflictException(
        `User with email '${emailLower}' already exists in system`,
      );
    }

    // Generate random temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex') + 'E1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Atomic transaction for sequential employee ID & employee creation
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch & increment company employee ID sequence
      let settings = await tx.companySettings.findUnique({
        where: { companyId },
      });

      if (!settings) {
        settings = await tx.companySettings.create({
          data: {
            companyId,
            employeeIdPrefix: 'EMP',
            employeeIdSequence: 0,
          },
        });
      }

      const updatedSettings = await tx.companySettings.update({
        where: { companyId },
        data: {
          employeeIdSequence: { increment: 1 },
        },
      });

      const prefix = updatedSettings.employeeIdPrefix || 'EMP';
      const seqStr = String(updatedSettings.employeeIdSequence).padStart(3, '0');
      const generatedEmployeeId = `${prefix}${seqStr}`;

      // 2. Create User account
      const user = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          companyId,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // 3. Find default Employee role or create one for company
      let employeeRole = await tx.role.findFirst({
        where: {
          name: 'Employee',
          OR: [{ isSystemRole: true }, { companyId }],
        },
      });

      if (!employeeRole) {
        employeeRole = await tx.role.create({
          data: {
            name: 'Employee',
            description: 'Standard employee portal access',
            companyId,
            isSystemRole: false,
          },
        });
      }

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: employeeRole.id,
          companyId,
        },
      });

      // 4. Create Employee record
      const employee = await tx.employee.create({
        data: {
          companyId,
          employeeId: generatedEmployeeId,
          userId: user.id,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: emailLower,
          phone: dto.phone,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          employmentType: dto.employmentType || 'FULL_TIME',
          employmentStatus: dto.employmentStatus || 'ACTIVE',
          departmentId: dto.departmentId || null,
          designationId: dto.designationId || null,
          locationId: dto.locationId || null,
          reportingManagerId: dto.reportingManagerId || null,
          joiningDate: new Date(dto.joiningDate),
        },
        include: {
          department: true,
          designation: true,
          location: true,
          reportingManager: true,
        },
      });

      return { user, employee, generatedEmployeeId };
    });

    // 5. Send Welcome Employee email (async)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, slug: true },
    });

    try {
      await this.emailService.sendWelcomeEmployee({
        to: emailLower,
        email: emailLower,
        firstName: dto.firstName,
        companyName: company?.name || 'HRMS',
        employeeId: result.generatedEmployeeId,
        loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}/login?company=${company?.slug || ''}`,
        temporaryPassword: tempPassword,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send welcome email to employee ${emailLower}: ${(err as Error).message}`,
      );
    }

    return result.employee;
  }

  /**
   * List employees with filtering & pagination
   */
  async findAll(companyId: string, query: QueryEmployeesDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.status) {
      where.employmentStatus = query.status;
    }

    if (query.employmentType) {
      where.employmentType = query.employmentType;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.designationId) {
      where.designationId = query.designationId;
    }

    if (query.locationId) {
      where.locationId = query.locationId;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          designation: true,
          location: true,
          reportingManager: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single employee by ID
   */
  async findOne(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            emailVerifiedAt: true,
            lastLoginAt: true,
          },
        },
        department: true,
        designation: true,
        location: true,
        reportingManager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        subordinates: {
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

    if (!employee) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

    return employee;
  }

  /**
   * Update employee profile & associated user account
   */
  async update(companyId: string, id: string, dto: UpdateEmployeeDto) {
    const existing = await this.findOne(companyId, id);

    // Prevent self-reporting manager assignment
    if (dto.reportingManagerId === id) {
      throw new BadRequestException(
        'An employee cannot be their own reporting manager',
      );
    }

    // Update User if name/email changed
    if (dto.firstName || dto.lastName || dto.email) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: {
          ...(dto.firstName && { firstName: dto.firstName.trim() }),
          ...(dto.lastName && { lastName: dto.lastName.trim() }),
          ...(dto.email && { email: dto.email.toLowerCase().trim() }),
        },
      });
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName.trim() }),
        ...(dto.lastName && { lastName: dto.lastName.trim() }),
        ...(dto.email && { email: dto.email.toLowerCase().trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.employmentType && { employmentType: dto.employmentType }),
        ...(dto.employmentStatus && { employmentStatus: dto.employmentStatus }),
        ...(dto.departmentId !== undefined && {
          departmentId: dto.departmentId,
        }),
        ...(dto.designationId !== undefined && {
          designationId: dto.designationId,
        }),
        ...(dto.locationId !== undefined && { locationId: dto.locationId }),
        ...(dto.reportingManagerId !== undefined && {
          reportingManagerId: dto.reportingManagerId,
        }),
        ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
        ...(dto.confirmationDate && {
          confirmationDate: new Date(dto.confirmationDate),
        }),
        ...(dto.terminationDate && {
          terminationDate: new Date(dto.terminationDate),
        }),
      },
      include: {
        department: true,
        designation: true,
        location: true,
        reportingManager: true,
      },
    });
  }

  /**
   * Get complete Org Chart tree for company
   */
  async getOrgChart(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: EmploymentStatus.ACTIVE },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        reportingManagerId: true,
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
    });

    // Build tree
    const map = new Map<string, any>();
    const roots: any[] = [];

    employees.forEach((emp) => {
      map.set(emp.id, { ...emp, subordinates: [] });
    });

    employees.forEach((emp) => {
      if (emp.reportingManagerId && map.has(emp.reportingManagerId)) {
        map.get(emp.reportingManagerId).subordinates.push(map.get(emp.id));
      } else {
        roots.push(map.get(emp.id));
      }
    });

    return roots;
  }
}
