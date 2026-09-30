import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { CompanyStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Super Admin company detail with admins list & usage stats (no employee PII)
   */
  async getCompanyDetail(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        branding: true,
        settings: true,
        _count: {
          select: {
            users: true,
            employees: true,
            departments: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found`);
    }

    // Find all Company Admins for this tenant
    const companyAdmins = await this.prisma.user.findMany({
      where: {
        companyId,
        userRoles: {
          some: {
            role: {
              name: 'Company Admin',
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return {
      company,
      admins: companyAdmins,
      stats: {
        totalUsers: company._count.users,
        totalEmployees: company._count.employees,
        totalDepartments: company._count.departments,
      },
    };
  }

  /**
   * Activate company
   */
  async activateCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companyId}' not found`);
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: { status: CompanyStatus.ACTIVE },
    });
  }

  /**
   * Deactivate company (SUSPENDED or INACTIVE)
   */
  async deactivateCompany(companyId: string, status: CompanyStatus = CompanyStatus.SUSPENDED) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companyId}' not found`);
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: { status },
    });
  }

  /**
   * Add additional Company Admin to an existing company
   */
  async addCompanyAdmin(companyId: string, dto: CreateCompanyAdminDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company '${companyId}' not found`);
    }

    const emailLower = dto.email.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      throw new ConflictException(`User with email '${emailLower}' already exists`);
    }

    const tempPassword = crypto.randomBytes(8).toString('hex') + 'A1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const adminUser = await this.prisma.$transaction(async (tx) => {
      let companyAdminRole = await tx.role.findFirst({
        where: {
          name: 'Company Admin',
          OR: [{ isSystemRole: true }, { companyId }],
        },
      });

      if (!companyAdminRole) {
        companyAdminRole = await tx.role.create({
          data: {
            name: 'Company Admin',
            description: 'Full administrative access',
            companyId,
            isSystemRole: false,
          },
        });
      }

      const newUser = await tx.user.create({
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

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: companyAdminRole.id,
          companyId,
        },
      });

      return newUser;
    });

    // Send welcome email
    try {
      await this.emailService.sendWelcomeCompanyAdmin({
        to: emailLower,
        email: emailLower,
        firstName: dto.firstName,
        companyName: company.name,
        loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}/login?company=${company.slug}`,
        temporaryPassword: tempPassword,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send welcome email to additional Company Admin ${emailLower}: ${(err as Error).message}`,
      );
    }

    return {
      message: 'Company Admin added successfully',
      user: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
      },
    };
  }

  /**
   * Super Admin Platform Dashboard Statistics
   * STRICT METADATA ONLY — NO EMPLOYEE PII
   */
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
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: CompanyStatus.ACTIVE } }),
      this.prisma.company.count({ where: { status: CompanyStatus.INACTIVE } }),
      this.prisma.company.count({ where: { status: CompanyStatus.SUSPENDED } }),
      this.prisma.company.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.user.count(),
      this.prisma.auditLog.count(),
    ]);

    return {
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        inactive: inactiveCompanies,
        suspended: suspendedCompanies,
        newLast30Days: newCompanies30d,
      },
      users: {
        total: totalUsers,
      },
      auditLogs: {
        total: totalAuditLogs,
      },
    };
  }

  /**
   * Platform-wide Audit Logs (Super Admin view)
   */
  async getPlatformAuditLogs(query: QueryAuditLogsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: { id: true, name: true, slug: true },
          },
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
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
}
