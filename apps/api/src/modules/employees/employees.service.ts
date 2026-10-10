import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
  Optional,
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
import { wordsWhere } from '../../common/word-search';
import { EmployeeLifecycleService, type JobSnapshot } from './lifecycle.service';
import { AssetKitsService } from '../assets/asset-kits.service';

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
    private readonly lifecycle: EmployeeLifecycleService,
    @Optional() private readonly kits?: AssetKitsService,
  ) {}

  /** Starter kit items for a new joiner / someone who moved into a kit group (best-effort). */
  provisionKit(companyId: string, employeeId: string, why: 'joined' | 'promotion') {
    void this.kits?.provision(companyId, employeeId, why);
  }

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
          reportsToPmo: Boolean(dto.reportsToPmo && !dto.reportingManagerId),
          joiningDate: new Date(dto.joiningDate),
        },
        include: { department: true, designation: true, location: true, reportingManager: true },
      });
      await this.hierarchy.addEmployee(tx, companyId, employee.id, employee.reportingManagerId);
      await this.lifecycle.record(tx, {
        companyId,
        employeeId: employee.id,
        actor: null,
        kind: 'joined',
        to: employee.designation?.name ?? null,
        effectiveOn: employee.joiningDate,
      });
      return employee;
    });
  }

  /**
   * Everyone in a company is an employee: a basic profile (name, email, joining
   * today) for an account that has none. Job title, department and the rest are
   * filled in later ("Complete your profile").
   */
  async basicProfileFor(companyId: string, userId: string) {
    const settings = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: settings?.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return this.createForUser(companyId, userId, { joiningDate: today });
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
  async create(companyId: string, dto: CreateEmployeeDto, opts: { sendWelcome?: boolean; actorUserId?: string; importing?: boolean } = {}) {
    const emailLower = dto.email.toLowerCase().trim();
    if (dto.employmentStatus && !(['ACTIVE', 'PROBATION'] as string[]).includes(dto.employmentStatus)) {
      throw new BadRequestException('A new employee starts as Active or on Probation');
    }
    if (dto.confirmationDate && dto.confirmationDate <= dto.joiningDate.slice(0, 10)) {
      throw new BadRequestException('Probation must end after the joining date');
    }
    const intern = dto.employmentType === 'INTERN';
    // Imports may leave it out — Employees then flags the intern as having no end date
    if (intern && !dto.internshipEndDate && !opts.importing) throw new BadRequestException('Add the date the internship ends');
    if (intern && dto.internshipEndDate && dto.internshipEndDate.slice(0, 10) <= dto.joiningDate.slice(0, 10)) {
      throw new BadRequestException('The internship must end after the joining date');
    }

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
          reportsToPmo: Boolean(dto.reportsToPmo && !dto.reportingManagerId),
          joiningDate: new Date(dto.joiningDate),
          confirmationDate: dto.confirmationDate ? new Date(dto.confirmationDate) : null,
          internshipEndDate: intern && dto.internshipEndDate ? new Date(dto.internshipEndDate) : null,
          skipAutoConvert: intern && Boolean(dto.skipAutoConvert),
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
      await this.lifecycle.record(tx, { companyId, employeeId: employee.id, actor: opts.actorUserId ?? null, kind: 'joined', to: employee.designation?.name ?? null, effectiveOn: employee.joiningDate });

      return { user, employee, generatedEmployeeId };
    });

    // Starter kit: IT is asked to have their things ready by the joining date
    this.provisionKit(companyId, result.employee.id, 'joined');

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
    const today = await this.lifecycle.today(companyId);
    const seesExits = this.lifecycle.seesExits(access);

    if (query.managerId) filters.reportingManagerId = query.managerId === 'none' ? null : query.managerId;

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

    // Every word must match a field: "aadhya bose" finds Aadhya Bose
    const search = wordsWhere(query.search, (w): Prisma.EmployeeWhereInput[] => [
      { firstName: { contains: w, mode: 'insensitive' as const } },
      { lastName: { contains: w, mode: 'insensitive' as const } },
      { email: { contains: w, mode: 'insensitive' as const } },
      { employeeId: { contains: w, mode: 'insensitive' as const } },
    ]);
    if (search) filters.AND = search.AND;

    // Tenant + permission scope (own / reports / department / company) + lifecycle stage + filters.
    // A status filter for notice / left needs exit access (otherwise nothing matches).
    const hiddenStatus = !seesExits && (query.status === 'NOTICE_PERIOD' || query.status === 'TERMINATED');
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        { companyId },
        this.accessService.requireEmployeeScope(access, 'employee.view'),
        this.lifecycle.stageWhere(query.stage ?? 'current', today.date, seesExits),
        hiddenStatus ? { id: { in: [] } } : {},
        filters,
      ],
    };
    const ORDER: Record<string, Prisma.EmployeeOrderByWithRelationInput[]> = {
      recent: [{ createdAt: 'desc' }],
      name: [{ firstName: 'asc' }, { lastName: 'asc' }],
      joined: [{ joiningDate: 'asc' }],
      joined_desc: [{ joiningDate: 'desc' }],
      probation: [{ confirmationDate: { sort: 'asc', nulls: 'last' } }],
      internship: [{ internshipEndDate: { sort: 'asc', nulls: 'first' } }],
      last_day: [{ terminationDate: { sort: 'asc', nulls: 'last' } }],
    };

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: [...(ORDER[query.sort ?? 'recent'] ?? ORDER.recent!), { id: 'asc' }],
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
      data: await this.lifecycle.enrich(companyId, items, access, today.date),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        seesExits,
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
    // People who left are only visible to HR (and themselves)
    if (employee.employmentStatus === EmploymentStatus.TERMINATED && !this.lifecycle.seesExits(access) && employee.userId !== access.userId) {
      throw new NotFoundException(`Employee with ID '${id}' not found`);
    }

    return this.lifecycle.mask(employee, access);
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
    if (dto.reportsToPmo && dto.reportingManagerId) throw new BadRequestException('Pick a person or the PMO — not both');
    // Reporting to the PMO means nobody is their manager
    if (dto.reportsToPmo) dto.reportingManagerId = null as unknown as string;
    await this.assertLinksInCompany(companyId, dto);
    const exitStatus = (s?: string) => s === EmploymentStatus.NOTICE_PERIOD || s === EmploymentStatus.TERMINATED;
    if (dto.employmentStatus && dto.employmentStatus !== existing.employmentStatus && (exitStatus(dto.employmentStatus) || exitStatus(existing.employmentStatus)) && !this.lifecycle.seesExits(access)) {
      throw new ForbiddenException('Only HR can start or end a notice period');
    }
    // Internship end: interns only, after joining; leaving Intern clears it
    const intern = (dto.employmentType ?? existing.employmentType) === 'INTERN';
    if (dto.internshipEndDate && !intern) throw new BadRequestException('Only interns have an internship end date');
    if (intern && dto.employmentType === 'INTERN' && existing.employmentType !== 'INTERN' && !dto.internshipEndDate && !existing.internshipEndDate) {
      throw new BadRequestException('Add the date the internship ends');
    }
    const joinKey = (dto.joiningDate ?? existing.joiningDate.toISOString()).slice(0, 10);
    if (dto.internshipEndDate && dto.internshipEndDate.slice(0, 10) <= joinKey) throw new BadRequestException('The internship must end after the joining date');
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
    const before = await this.jobSnapshot(id);

    // Moving into a kit group (new title / team) → the extra items
    const moved = (dto.designationId !== undefined && dto.designationId !== existing.designationId) || (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId);

    // Reporting line and closure table change together (loops are rejected)
    const saved = await this.prisma.$transaction(async (tx) => {
      if (managerChanged)
        await this.hierarchy.setManager(tx, companyId, id, dto.reportingManagerId ?? null);
      const updated = await tx.employee.update({
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
          ...(dto.reportsToPmo !== undefined && { reportsToPmo: dto.reportsToPmo }),
          // A person as manager means they no longer report to the PMO
          ...(dto.reportingManagerId && { reportsToPmo: false }),
          ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
          ...(dto.confirmationDate && {
            confirmationDate: new Date(dto.confirmationDate),
          }),
          ...(dto.terminationDate && {
            terminationDate: new Date(dto.terminationDate),
          }),
          ...(intern
            ? {
                ...(dto.internshipEndDate && { internshipEndDate: new Date(dto.internshipEndDate) }),
                ...(dto.skipAutoConvert !== undefined && { skipAutoConvert: dto.skipAutoConvert }),
              }
            : { internshipEndDate: null, skipAutoConvert: false }),
        },
        include: {
          department: true,
          designation: true,
          location: true,
          reportingManager: true,
        },
      });
      // No longer an intern → the Intern role makes way for Employee
      if (existing.employmentType === 'INTERN' && dto.employmentType && dto.employmentType !== 'INTERN') await this.lifecycle.swapInternRole(tx, companyId, existing.userId, access.userId);
      await this.lifecycle.recordChanges(tx, companyId, access.userId, before, await this.jobSnapshot(id, tx));
      return updated;
    });
    if (moved) this.provisionKit(companyId, id, 'promotion');
    return saved;
  }

  /** Manager / team / title / office / type / status as names, for the history. */
  private async jobSnapshot(id: string, db: Prisma.TransactionClient = this.prisma): Promise<JobSnapshot> {
    const e = await db.employee.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        employmentType: true,
        employmentStatus: true,
        terminationDate: true,
        reportingManager: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
        designation: { select: { name: true } },
        location: { select: { name: true } },
      },
    });
    return {
      id: e.id,
      manager: e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : null,
      department: e.department?.name ?? null,
      title: e.designation?.name ?? null,
      location: e.location?.name ?? null,
      type: e.employmentType,
      status: e.employmentStatus,
      terminationDate: e.terminationDate,
    };
  }

  /** The ID the next new employee will get (preview only — nothing is reserved). */
  async nextId(companyId: string) {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { employeeIdPrefix: true, employeeIdSequence: true } });
    const prefix = s?.employeeIdPrefix || 'EMP';
    return { employeeId: `${prefix}${String((s?.employeeIdSequence ?? 0) + 1).padStart(3, '0')}` };
  }

  /** CSV of the list as filtered (same scope and stage rules as the list). */
  async exportCsv(companyId: string, query: QueryEmployeesDto, access: AccessContext): Promise<string> {
    const rows: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= 50; page++) {
      const res = await this.findAll(companyId, { ...query, page, limit: 100 }, access);
      rows.push(...(res.data as Array<Record<string, unknown>>));
      if (page >= res.meta.totalPages) break;
    }
    const sees = this.lifecycle.seesExits(access);
    const head = ['Employee ID', 'First name', 'Last name', 'Email', 'Job title', 'Department', 'Location', 'Manager', 'Type', 'Status', 'Joined', 'Probation ends', ...(sees ? ['Last day', 'Exit reason'] : []), 'Profile %'];
    const d = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'string' ? v.slice(0, 10) : '');
    const lines = rows.map((r: any) => [
      r.employeeId, r.firstName, r.lastName, r.email, r.designation?.name, r.department?.name, r.location?.name,
      r.reportingManager ? `${r.reportingManager.firstName} ${r.reportingManager.lastName}` : '',
      r.employmentType, r.employmentStatus, d(r.joiningDate), r.employmentStatus === 'PROBATION' ? d(r.confirmationDate) : '',
      ...(sees ? [d(r.terminationDate), r.exitReason ?? ''] : []),
      r.profilePercent ?? '',
    ]);
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // no spreadsheet formulas
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    return [head, ...lines].map((l) => l.map(cell).join(',')).join('\n') + '\n';
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
}
