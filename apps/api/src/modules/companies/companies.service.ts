import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { MinioService } from '../storage/minio.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CompanyStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Create a new company along with default settings, branding, and initial Company Admin user
   */
  async create(dto: CreateCompanyDto) {
    // 1. Check slug & email uniqueness
    const existingCompany = await this.prisma.company.findFirst({
      where: {
        OR: [{ slug: dto.slug }, { email: dto.email }],
      },
    });

    if (existingCompany) {
      if (existingCompany.slug === dto.slug) {
        throw new ConflictException(`Company slug '${dto.slug}' is already taken`);
      }
      throw new ConflictException(`Company email '${dto.email}' is already registered`);
    }

    // Check admin email uniqueness across all users
    const existingAdminUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail.toLowerCase() },
    });
    if (existingAdminUser) {
      throw new ConflictException(
        `User email '${dto.adminEmail}' is already registered in the system`,
      );
    }

    // 2. Generate initial random password for Company Admin
    const tempPassword = crypto.randomBytes(8).toString('hex') + 'A1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // 3. Perform atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create company
      const company = await tx.company.create({
        data: {
          name: dto.name,
          slug: dto.slug.toLowerCase(),
          email: dto.email.toLowerCase(),
          status: CompanyStatus.ACTIVE,
        },
      });

      // Create company settings
      const settings = await tx.companySettings.create({
        data: {
          companyId: company.id,
          employeeIdPrefix: dto.employeeIdPrefix
            ? dto.employeeIdPrefix.toUpperCase()
            : 'EMP',
          employeeIdSequence: 0,
        },
      });

      // Create company branding
      const branding = await tx.companyBranding.create({
        data: {
          companyId: company.id,
          displayName: dto.name,
          primaryColor: '#1E40AF',
          secondaryColor: '#EFF6FF',
        },
      });

      // Find system "Company Admin" role or create company-level Company Admin role
      let companyAdminRole = await tx.role.findFirst({
        where: {
          name: 'Company Admin',
          isSystemRole: true,
        },
      });

      if (!companyAdminRole) {
        companyAdminRole = await tx.role.create({
          data: {
            name: 'Company Admin',
            description: 'Full administrative access within the company',
            companyId: company.id,
            isSystemRole: false,
          },
        });
      }

      // Create initial Company Admin user
      const adminUser = await tx.user.create({
        data: {
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          companyId: company.id,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Assign Company Admin role
      await tx.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: companyAdminRole.id,
        },
      });

      return { company, settings, branding, adminUser };
    });

    // 4. Send welcome email to Company Admin (asynchronous, non-blocking)
    try {
      await this.emailService.sendWelcomeCompanyAdmin({
        to: dto.adminEmail,
        firstName: dto.adminFirstName,
        email: dto.adminEmail,
        loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}/login?company=${dto.slug}`,
        temporaryPassword: tempPassword,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send welcome email to Company Admin ${dto.adminEmail}: ${(err as Error).message}`,
      );
    }

    return {
      message: 'Company created successfully',
      company: result.company,
      adminUser: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        firstName: result.adminUser.firstName,
        lastName: result.adminUser.lastName,
      },
      branding: result.branding,
      settings: result.settings,
    };
  }

  /**
   * List all companies (Super Admin pagination)
   */
  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: CompanyStatus;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branding: true,
          settings: true,
          _count: {
            select: {
              users: true,
              employees: true,
            },
          },
        },
      }),
      this.prisma.company.count({ where }),
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
   * Find single company by ID
   */
  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
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
      throw new NotFoundException(`Company with ID '${id}' not found`);
    }

    return company;
  }

  /**
   * Semi-public branding lookup by company slug (for login UI branding)
   */
  async findBrandingBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug: slug.toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        branding: {
          select: {
            displayName: true,
            logoUrl: true,
            faviconUrl: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    });

    if (!company || company.status !== CompanyStatus.ACTIVE) {
      throw new NotFoundException(`Active company with slug '${slug}' not found`);
    }

    return {
      companyName: company.name,
      slug: company.slug,
      branding: company.branding,
    };
  }

  /**
   * Update company details or status (Super Admin)
   */
  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.email && { email: dto.email.toLowerCase() }),
        ...(dto.status && { status: dto.status }),
      },
      include: {
        branding: true,
        settings: true,
      },
    });
  }

  /**
   * Update company white-label branding (Company Admin / Super Admin)
   */
  async updateBranding(companyId: string, dto: UpdateBrandingDto) {
    await this.findOne(companyId);

    return this.prisma.companyBranding.upsert({
      where: { companyId },
      update: {
        ...(dto.displayName && { displayName: dto.displayName }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.faviconUrl !== undefined && { faviconUrl: dto.faviconUrl }),
        ...(dto.primaryColor && { primaryColor: dto.primaryColor }),
        ...(dto.secondaryColor && { secondaryColor: dto.secondaryColor }),
      },
      create: {
        companyId,
        displayName: dto.displayName || 'HRMS Portal',
        logoUrl: dto.logoUrl,
        faviconUrl: dto.faviconUrl,
        primaryColor: dto.primaryColor || '#1E40AF',
        secondaryColor: dto.secondaryColor || '#EFF6FF',
      },
    });
  }

  /**
   * Update company settings (Company Admin / Super Admin)
   */
  async updateSettings(companyId: string, dto: UpdateSettingsDto) {
    await this.findOne(companyId);

    return this.prisma.companySettings.upsert({
      where: { companyId },
      update: {
        ...(dto.employeeIdPrefix && {
          employeeIdPrefix: dto.employeeIdPrefix.toUpperCase(),
        }),
        ...(dto.timezone && { timezone: dto.timezone }),
        ...(dto.fiscalYearStart !== undefined && {
          fiscalYearStart: dto.fiscalYearStart,
        }),
        ...(dto.workingDaysPerWeek !== undefined && {
          workingDaysPerWeek: dto.workingDaysPerWeek,
        }),
        ...(dto.workingHoursPerDay !== undefined && {
          workingHoursPerDay: dto.workingHoursPerDay,
        }),
      },
      create: {
        companyId,
        employeeIdPrefix: dto.employeeIdPrefix
          ? dto.employeeIdPrefix.toUpperCase()
          : 'EMP',
        timezone: dto.timezone || 'Asia/Kolkata',
        fiscalYearStart: dto.fiscalYearStart || 4,
        workingDaysPerWeek: dto.workingDaysPerWeek || 5,
        workingHoursPerDay: dto.workingHoursPerDay || 8,
      },
    });
  }

  /**
   * Get metadata stats for a company
   */
  async getStats(companyId: string) {
    const [userCount, employeeCount, departmentCount, activeCount] =
      await Promise.all([
        this.prisma.user.count({ where: { companyId } }),
        this.prisma.employee.count({ where: { companyId } }),
        this.prisma.department.count({ where: { companyId } }),
        this.prisma.user.count({
          where: { companyId, status: UserStatus.ACTIVE },
        }),
      ]);

    return {
      userCount,
      employeeCount,
      departmentCount,
      activeUserCount: activeCount,
    };
  }

  /**
   * Upload logo file to MinIO and update CompanyBranding.logoUrl
   */
  async uploadLogo(companyId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No logo file provided');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type '${file.mimetype}'. Allowed types: JPEG, PNG, SVG, WebP.`,
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds maximum 2MB limit');
    }

    const ext = file.originalname.split('.').pop() || 'png';
    const objectKey = `${companyId}/branding/logo.${ext}`;

    const logoUrl = await this.minioService.uploadFile(
      this.minioService.brandingBucket,
      objectKey,
      file.buffer,
      file.mimetype,
    );

    return this.updateBranding(companyId, { logoUrl });
  }

  /**
   * Upload favicon file to MinIO and update CompanyBranding.faviconUrl
   */
  async uploadFavicon(companyId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No favicon file provided');
    }

    const allowedMimeTypes = [
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'image/png',
      'image/svg+xml',
      'image/jpeg',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type '${file.mimetype}'. Allowed types: ICO, PNG, SVG, JPEG.`,
      );
    }

    if (file.size > 500 * 1024) {
      throw new BadRequestException('File size exceeds maximum 500KB limit');
    }

    const ext = file.originalname.split('.').pop() || 'ico';
    const objectKey = `${companyId}/branding/favicon.${ext}`;

    const faviconUrl = await this.minioService.uploadFile(
      this.minioService.brandingBucket,
      objectKey,
      file.buffer,
      file.mimetype,
    );

    return this.updateBranding(companyId, { faviconUrl });
  }
}
