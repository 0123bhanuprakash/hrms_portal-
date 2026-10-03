import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProducerService } from '../email/email.producer.service';
import { AccessService } from '../access/access.service';
import { CompanyRolesService } from '../access/company-roles.service';
import { HierarchyService } from '../access/hierarchy.service';
import { EntitlementService } from '../access/entitlement.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AccessContext } from '../access/access.types';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employee.dto';
import { CreateEmployeeProfileDto } from './dto/create-employee-profile.dto';
import { UserStatus, EmploymentStatus, Prisma } from '@prisma/client';
import { generateTemporaryPassword, hashPassword } from '../auth/password.util';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailProducerService: EmailProducerService,
    private readonly accessService: AccessService,
    private readonly companyRoles: CompanyRolesService,
    private readonly hierarchy: HierarchyService,
    private readonly entitlements: EntitlementService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Next sequential employee ID (e.g. AAK014) — call inside the creating transaction. */
  private async nextEmployeeId(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const settings = await tx.companySettings.upsert({
      where: { companyId },
      update: { employeeIdSequence: { increment: 1 } },
      create: { companyId, employeeIdPrefix: 'EMP', employeeIdSequence: 1 },
    });
    return `${settings.employeeIdPrefix || 'EMP'}${String(settings.employeeIdSequence).padStart(3, '0')}`;
  }

  /** Checks for a new profile before anything is written: linked records + plan limit. */
  async assertProfileInput(companyId: string, dto: CreateEmployeeProfileDto): Promise<void> {
    await this.assertLinksInCompany(companyId, dto);
    await this.assertEmployeeLimit(companyId);
  }

  /**
   * Employee profile for an EXISTING sign-in account (e.g. invited from
   * Users → Invite). Uses the account's name and email; creates no new
   * account and sends no email.
   */
  async createForUser(companyId: string, userId: string, dto: CreateEmployeeProfileDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true, firstName: true, lastName: true, email: true, employee: { select: { employeeId: true } } },
    });
    if (!user) throw new NotFoundException('User not found in this company');
    if (user.employee) throw new ConflictException(`This account already has an employee profile (${user.employee.employeeId})`);
    await this.assertProfileInput(companyId, dto);

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          companyId,
          userId: user.id,
          employeeId: await this.nextEmployeeId(tx, companyId),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: dto.phone?.trim() || null,
          employmentType: dto.employmentType ?? 'FULL_TIME',
          departmentId: dto.departmentId ?? null,
          designationId: dto.designationId ?? null,
          locationId: dto.locationId ?? null,
          reportingManagerId: dto.reportingManagerId ?? null,
          joiningDate: new Date(dto.joiningDate),
        },
        include: { department: true, designation: true, location: true, reportingManager: true },
      });
      await this.hierarchy.addEmployee(tx, companyId, employee.id, employee.reportingManagerId);
      return employee;
    });
  }

  /** Plan limit: maxEmployees counts everyone not terminated (null / missing = unlimited). */
  private async assertEmployeeLimit(companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { featuresVersion: true } });
    if (!company) throw new NotFoundException('Company not found');
    const { limits } = await this.entitlements.forCompany(companyId, company.featuresVersion);
    const max = limits.maxEmployees;
    if (max === null || max === undefined) return;
    const current = await this.prisma.employee.count({
      where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } },
    });
    if (current >= max) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Plan Limit Reached',
        code: 'PLAN_LIMIT_REACHED',
        limit: 'maxEmployees',
        message: `Your plan allows up to ${max} employee${max === 1 ? "" : "s"}. Contact your platform administrator to raise the limit.`,
      });
    }
  }

  /** Fields an employee may change on their own profile ("own" scope). */
  private static readonly SELF_EDITABLE = new Set<keyof UpdateEmployeeDto>([
    'phone',
    'gender',
    'dateOfBirth',
  ]);

  /**
   * Linked records must belong to the same company — otherwise a crafted
   * request could attach another tenant's department / manager (404).
   */
  private async assertLinksInCompany(
    companyId: string,
    links: {
      departmentId?: string | null;
      designationId?: string | null;
      locationId?: string | null;
      reportingManagerId?: string | null;
    },
  ): Promise<void> {
    const db = this.prisma;
    const checks: Array<[string, Promise<number>]> = [];
    if (links.departmentId)
      checks.push([
        'Department',
        db.department.count({ where: { id: links.departmentId, companyId } }),
      ]);
    if (links.designationId)
      checks.push([
        'Designation',
        db.designation.count({ where: { id: links.designationId, companyId } }),
      ]);
    if (links.locationId)
      checks.push([
        'Location',
        db.officeLocation.count({ where: { id: links.locationId, companyId } }),
      ]);
    if (links.reportingManagerId)
      checks.push([
        'Reporting manager',
        db.employee.count({ where: { id: links.reportingManagerId, companyId } }),
      ]);
    for (const [label, count] of checks) {
      if (!(await count)) throw new NotFoundException(`${label} not found in this company`);
    }
  }

  /**
   * Create employee (Admin flow)
   * 1. Auto-generate sequential Employee ID (e.g., CL001)
   * 2. Create User account & default Employee role
   * 3. Create Employee profile
   * 4. Send welcome email with login credentials
   */
  async create(companyId: string, dto: CreateEmployeeDto, opts: { sendWelcome?: boolean } = {}) {
    const emailLower = dto.email.toLowerCase().trim();

    // Check user email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      throw new ConflictException(`User with email '${emailLower}' already exists in system`);
    }

    // Generate random temporary password
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    await this.assertLinksInCompany(companyId, dto);
    await this.assertEmployeeLimit(companyId);

    // Atomic transaction for sequential employee ID & employee creation
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Next sequential employee ID
      const generatedEmployeeId = await this.nextEmployeeId(tx, companyId);

      // 2. Create User account
      const user = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          mustChangePassword: true,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          companyId,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // 3. The company's own "Employee" role (self-service by default)
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: await this.companyRoles.roleId(tx, companyId, 'employee'),
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

      // 5. Place them in the reporting hierarchy (closure table)
      await this.hierarchy.addEmployee(tx, companyId, employee.id, employee.reportingManagerId);

      return { user, employee, generatedEmployeeId };
    });

    // 5. Send Welcome Employee email (async). Bulk imports may skip it —
    //    the invite can be sent later from Users → Resend invite.
    if (opts.sendWelcome === false) return result.employee;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, slug: true },
    });

    try {
      await this.emailProducerService.queueWelcomeEmployee({
        to: emailLower,
        email: emailLower,
        firstName: dto.firstName,
        companyName: company?.name || 'HRMS',
        employeeId: result.generatedEmployeeId,
        loginUrl: `${this.config.get<string>('webUrl')}/login?company=${company?.slug || ''}`,
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
  async findAll(companyId: string, query: QueryEmployeesDto, access: AccessContext) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filters: Prisma.EmployeeWhereInput = {};

    if (query.status) {
      filters.employmentStatus = query.status;
    }

    if (query.employmentType) {
      filters.employmentType = query.employmentType;
    }

    if (query.departmentId) {
      filters.departmentId = query.departmentId;
    }

    if (query.designationId) {
      filters.designationId = query.designationId;
    }

    if (query.locationId) {
      filters.locationId = query.locationId;
    }

    if (query.search) {
      filters.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Tenant + permission scope (own / reports / department / company) + filters
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        { companyId },
        this.accessService.requireEmployeeScope(access, 'employee.view'),
        filters,
      ],
    };

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
  async findOne(
    companyId: string,
    id: string,
    access: AccessContext,
    permission = 'employee.view',
  ) {
    // Outside the caller's scope → 404, exactly like another company's record
    const employee = await this.prisma.employee.findFirst({
      where: {
        AND: [{ id, companyId }, this.accessService.requireEmployeeScope(access, permission)],
      },
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
  async update(companyId: string, id: string, dto: UpdateEmployeeDto, access: AccessContext) {
    const existing = await this.findOne(companyId, id, access, 'employee.edit');

    // Self-service ("own" scope) may only change personal details
    if (!access.isSuperAdmin && access.grants.get('employee.edit') === 'own') {
      const restricted = (Object.keys(dto) as Array<keyof UpdateEmployeeDto>).filter(
        (k) => dto[k] !== undefined && !EmployeesService.SELF_EDITABLE.has(k),
      );
      if (restricted.length) {
        throw new ForbiddenException(
          `You can only update your personal details (not: ${restricted.join(', ')})`,
        );
      }
    }

    // Prevent self-reporting manager assignment
    if (dto.reportingManagerId === id) {
      throw new BadRequestException('An employee cannot be their own reporting manager');
    }
    await this.assertLinksInCompany(companyId, dto);
    const managerChanged =
      dto.reportingManagerId !== undefined &&
      (dto.reportingManagerId ?? null) !== existing.reportingManagerId;

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

    // Leaving (notice period / terminated) while holding company assets → tell IT
    const leaving = dto.employmentStatus && dto.employmentStatus !== existing.employmentStatus && (['NOTICE_PERIOD', 'TERMINATED'] as string[]).includes(dto.employmentStatus);
    if (leaving) void this.warnAboutAssets(companyId, id, dto.employmentStatus === 'TERMINATED');

    // Reporting line and closure table change together (loops are rejected)
    return this.prisma.$transaction(async (tx) => {
      if (managerChanged)
        await this.hierarchy.setManager(tx, companyId, id, dto.reportingManagerId ?? null);
      return tx.employee.update({
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
    });
  }

  private async warnAboutAssets(companyId: string, employeeId: string, left: boolean) {
    try {
      const open = await this.prisma.assetAssignment.findMany({
        where: { companyId, employeeId, returnedAt: null },
        select: { asset: { select: { tag: true, name: true } }, employee: { select: { firstName: true, lastName: true } } },
      });
      if (!open.length) return;
      const who = `${open[0]!.employee.firstName} ${open[0]!.employee.lastName}`;
      const it = await this.notifications.companyWideApprovers(companyId, 'asset.manage');
      await this.notifications.notify({
        companyId,
        userIds: it,
        type: 'asset.offboarding',
        title: `${who} ${left ? 'has left' : 'is leaving'} and still has ${open.length} asset${open.length === 1 ? '' : 's'}`,
        body: open.map((a) => `${a.asset.name} (${a.asset.tag})`).join(', '),
        link: `/app/assets?employeeId=${employeeId}`,
        actionLabel: 'See assets',
      });
    } catch (err) {
      this.logger.error(`Could not warn about assets of ${employeeId}`, err as Error);
    }
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
