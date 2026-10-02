import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProducerService } from '../email/email.producer.service';
import { EmailService } from '../email/email.service';
import { AuthService } from '../auth/auth.service';
import { HealthService } from '../../health/health.service';
import { generateTemporaryPassword, hashPassword } from '../auth/password.util';
import { getSystemRole, type SystemRoleName } from '../prisma/system-roles';
import { isQueueEnabled } from '../queue/queue.config';
import { companyThemeFields } from '../themes/company-theme';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import {
  AdminUpdateCompanyDto,
  UpdateCompanyAdminStatusDto,
  UpdateCompanyStatusDto,
} from './dto/admin-company.dto';

// ============================================================
// AdminService — Super Admin platform operations
//
// STRICT METADATA ONLY — never returns employee PII. Company admins
// are platform-level accounts and are the only users listed here.
// ============================================================

const COMPANY_ADMIN_ROLE: SystemRoleName = 'company_admin';

/** Fields returned for company admin accounts */
const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailProducerService: EmailProducerService,
    private readonly authService: AuthService,
    private readonly healthService: HealthService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Platform ──────────────────────────────────────────────

  /** Which optional services are enabled — lets the UI hide unavailable features. */
  async getSystemStatus() {
    return {
      health: await this.healthService.check(),
      api: {
        version: process.env['npm_package_version'] ?? '0.0.1',
        nodeVersion: process.version,
        environment: this.config.get<string>('nodeEnv') ?? 'development',
        uptimeSeconds: Math.floor(process.uptime()),
      },
      queue: { enabled: isQueueEnabled() },
      storage: { driver: this.config.get<string>('storage.driver') ?? 'local' },
      email: this.emailService.getStatus(),
      search: { enabled: Boolean(this.config.get<string>('elasticsearch.url')) },
    };
  }

  /** Re-checks the SMTP connection and sends a small test email to `to`. */
  async sendTestEmail(to: string) {
    const status = await this.emailService.verifyConnection();
    if (status.state === 'error') {
      throw new BadRequestException(`Email is not working: ${status.detail}`);
    }
    try {
      await this.emailService.send({
        to,
        subject: 'HRMS Portal — test email',
        html: `<p style="font-family:system-ui,sans-serif">This is a test email from your HRMS Portal.</p>
               <p style="font-family:system-ui,sans-serif;color:#71717a">Sent ${new Date().toUTCString()} via ${status.provider}.</p>`,
      });
    } catch {
      throw new BadRequestException(`Sending failed: ${this.emailService.getStatus().detail}`);
    }
    return { id: to, to, message: `Test email sent to ${to}`, email: this.emailService.getStatus() };
  }

  async getPlatformStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalCompanies,
      activeCompanies,
      inactiveCompanies,
      suspendedCompanies,
      newCompanies30d,
      totalUsers,
      totalAuditLogs,
      recentCompanies,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: CompanyStatus.ACTIVE } }),
      this.prisma.company.count({ where: { status: CompanyStatus.INACTIVE } }),
      this.prisma.company.count({ where: { status: CompanyStatus.SUSPENDED } }),
      this.prisma.company.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { isSuperAdmin: false } }),
      this.prisma.auditLog.count(),
      this.prisma.company.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          _count: { select: { users: true } },
          branding: { select: { logoUrl: true, primaryColor: true } },
        },
      }),
    ]);

    return {
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        inactive: inactiveCompanies,
        suspended: suspendedCompanies,
        newLast30Days: newCompanies30d,
      },
      users: { total: totalUsers },
      auditLogs: { total: totalAuditLogs },
      recentCompanies,
    };
  }

  // ─── Companies ─────────────────────────────────────────────

  async listCompanies(query: QueryCompaniesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.CompanyWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
        include: {
          branding: { select: { logoUrl: true, primaryColor: true, displayName: true } },
          settings: { select: { employeeIdPrefix: true } },
          _count: { select: { users: true, employees: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Company detail with admins list & usage stats (no employee PII) */
  async getCompanyDetail(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        branding: true,
        settings: true,
        _count: { select: { users: true, employees: true, departments: true } },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found`);
    }

    const admins = await this.listCompanyAdmins(companyId);

    return {
      company,
      admins,
      stats: {
        totalUsers: company._count.users,
        totalEmployees: company._count.employees,
        totalDepartments: company._count.departments,
      },
    };
  }

  /** Edit company details, employee ID prefix and brand colors in one call. */
  async updateCompany(companyId: string, dto: AdminUpdateCompanyDto) {
    const company = await this.assertCompanyExists(companyId);

    const email = dto.email?.toLowerCase().trim();
    if (email && email !== company.email) {
      const taken = await this.prisma.company.findUnique({ where: { email } });
      if (taken) {
        throw new ConflictException(`Company email '${email}' is already registered`);
      }
    }

    const brandingChanges = {
      ...(dto.primaryColor && { primaryColor: dto.primaryColor }),
      ...(dto.secondaryColor && { secondaryColor: dto.secondaryColor }),
      // A theme snapshot (validated strictly) also syncs the legacy colors
      ...companyThemeFields(dto),
    };

    await this.prisma.$transaction(async (tx) => {
      if (dto.name || email) {
        await tx.company.update({
          where: { id: companyId },
          data: {
            ...(dto.name && { name: dto.name.trim() }),
            ...(email && { email }),
          },
        });
      }

      if (dto.employeeIdPrefix) {
        await tx.companySettings.upsert({
          where: { companyId },
          create: { companyId, employeeIdPrefix: dto.employeeIdPrefix },
          update: { employeeIdPrefix: dto.employeeIdPrefix },
        });
      }

      if (Object.keys(brandingChanges).length > 0) {
        await tx.companyBranding.upsert({
          where: { companyId },
          create: { companyId, displayName: dto.name?.trim() ?? company.name, ...brandingChanges },
          update: brandingChanges,
        });
      }
    });

    return this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: { branding: true, settings: true },
    });
  }

  /**
   * Change company status. Any non-ACTIVE status blocks the company's users:
   * their refresh tokens are revoked here, and login / refresh / every API
   * request checks the company status (AuthService + JwtStrategy).
   */
  async updateCompanyStatus(companyId: string, dto: UpdateCompanyStatusDto) {
    const company = await this.assertCompanyExists(companyId);

    const { updated, revokedSessions } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id: companyId },
        data: { status: dto.status },
      });

      let revokedSessions = 0;
      if (dto.status !== CompanyStatus.ACTIVE) {
        const revoked = await tx.refreshToken.updateMany({
          where: { isRevoked: false, user: { companyId } },
          data: { isRevoked: true },
        });
        revokedSessions = revoked.count;
      }

      return { updated, revokedSessions };
    });

    this.logger.log(
      `Company ${company.slug}: ${company.status} → ${dto.status}` +
        (revokedSessions ? ` (${revokedSessions} session(s) revoked)` : '') +
        (dto.reason ? ` — reason: ${dto.reason}` : ''),
    );

    return {
      ...updated,
      previousStatus: company.status,
      statusReason: dto.reason ?? null,
      revokedSessions,
    };
  }

  // ─── Company admins ────────────────────────────────────────

  async listCompanyAdmins(companyId: string) {
    return this.prisma.user.findMany({
      where: {
        companyId,
        userRoles: { some: { role: { name: COMPANY_ADMIN_ROLE, isSystemRole: true } } },
      },
      select: ADMIN_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async addCompanyAdmin(companyId: string, dto: CreateCompanyAdminDto) {
    const company = await this.assertCompanyExists(companyId);

    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException(`User with email '${email}' already exists`);
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    const adminUser = await this.prisma.$transaction(async (tx) => {
      const companyAdminRole = await getSystemRole(tx, COMPANY_ADMIN_ROLE);

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          mustChangePassword: true,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          companyId,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
        select: ADMIN_USER_SELECT,
      });

      await tx.userRole.create({
        data: { userId: user.id, roleId: companyAdminRole.id, companyId },
      });

      return user;
    });

    await this.sendWelcomeEmail(company, adminUser, tempPassword);

    return adminUser;
  }

  /** Activate / deactivate a company admin. Deactivation revokes their sessions. */
  async updateCompanyAdminStatus(companyId: string, userId: string, dto: UpdateCompanyAdminStatusDto) {
    const admin = await this.findCompanyAdmin(companyId, userId);

    if (dto.status === UserStatus.INACTIVE && admin.status === UserStatus.ACTIVE) {
      const activeAdmins = await this.prisma.user.count({
        where: {
          companyId,
          status: UserStatus.ACTIVE,
          userRoles: { some: { role: { name: COMPANY_ADMIN_ROLE, isSystemRole: true } } },
        },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException(
          'Cannot deactivate the last active Company Admin. Add or activate another admin first.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          status: dto.status,
          // Reactivation also clears any login lockout
          ...(dto.status === UserStatus.ACTIVE && { loginAttempts: 0, lockedUntil: null }),
        },
        select: ADMIN_USER_SELECT,
      });

      if (dto.status === UserStatus.INACTIVE) {
        await tx.refreshToken.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      return user;
    });
  }

  /**
   * Re-send the welcome email with a NEW temporary password.
   * Only for admins who have never logged in — otherwise use reset-password.
   */
  async resendAdminInvite(companyId: string, userId: string) {
    const company = await this.assertCompanyExists(companyId);
    const admin = await this.findCompanyAdmin(companyId, userId);

    if (admin.lastLoginAt) {
      throw new ConflictException(
        'This admin has already logged in. Send a password reset link instead.',
      );
    }
    if (admin.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Activate this admin before re-sending the invite.');
    }

    const tempPassword = generateTemporaryPassword();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, loginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    await this.sendWelcomeEmail(company, admin, tempPassword);

    return { id: admin.id, email: admin.email, message: 'Invite re-sent with a new temporary password' };
  }

  /** Email the standard password reset link to a company admin. */
  async sendAdminPasswordReset(companyId: string, userId: string) {
    const admin = await this.findCompanyAdmin(companyId, userId);

    if (admin.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Activate this admin before sending a password reset.');
    }

    await this.authService.forgotPassword(admin.email);

    return { id: admin.id, email: admin.email, message: 'Password reset link sent' };
  }

  // ─── Audit logs ────────────────────────────────────────────

  async getPlatformAuditLogs(query: QueryAuditLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.companyId && { companyId: query.companyId }),
      ...(query.userId && { userId: query.userId }),
      ...(query.action && { action: { contains: query.action, mode: 'insensitive' } }),
      ...(query.resourceType && { resourceType: query.resourceType }),
      ...(query.userEmail && {
        user: { email: { contains: query.userEmail, mode: 'insensitive' } },
      }),
      ...((query.dateFrom || query.dateTo) && {
        createdAt: {
          ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
          ...(query.dateTo && { lte: new Date(query.dateTo) }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Distinct action names, for the audit log filter dropdown. */
  async listAuditActions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async assertCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company '${companyId}' not found`);
    }
    return company;
  }

  /** A user of this company holding the system company_admin role, else 404. */
  private async findCompanyAdmin(companyId: string, userId: string) {
    const admin = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        userRoles: { some: { role: { name: COMPANY_ADMIN_ROLE, isSystemRole: true } } },
      },
      select: ADMIN_USER_SELECT,
    });
    if (!admin) {
      throw new NotFoundException(`Company Admin '${userId}' not found in this company`);
    }
    return admin;
  }

  private async sendWelcomeEmail(
    company: { name: string; slug: string },
    admin: { email: string; firstName: string },
    temporaryPassword: string,
  ): Promise<void> {
    try {
      await this.emailProducerService.queueWelcomeCompanyAdmin({
        to: admin.email,
        email: admin.email,
        firstName: admin.firstName,
        companyName: company.name,
        loginUrl: `${this.config.get<string>('webUrl')}/login?company=${company.slug}`,
        temporaryPassword,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send welcome email to Company Admin ${admin.email}: ${(err as Error).message}`,
      );
    }
  }
}
