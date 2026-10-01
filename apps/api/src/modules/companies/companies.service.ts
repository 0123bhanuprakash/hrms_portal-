import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProducerService } from '../email/email.producer.service';
import { StorageService } from '../storage/storage.service';
import { getSystemRole } from '../prisma/system-roles';
import { companyThemeFields } from '../themes/company-theme';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CompanyStatus, UserStatus } from '@prisma/client';
import { generateTemporaryPassword, hashPassword } from '../auth/password.util';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailProducerService: EmailProducerService,
    private readonly storage: StorageService,
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

    // Validate the optional theme snapshot before writing anything
    const themeFields = companyThemeFields(dto);

    // 2. Generate initial random password for Company Admin
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

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
          primaryColor: dto.primaryColor || '#1E40AF',
          secondaryColor: dto.secondaryColor || '#EFF6FF',
          // A chosen theme wins over the individual colors
          ...themeFields,
        },
      });

      // Seeded system role with the default company admin permissions
      const companyAdminRole = await getSystemRole(tx, 'company_admin');

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

    // 4. Send welcome email to Company Admin (asynchronous, non-blocking queue)
    try {
      await this.emailProducerService.queueWelcomeCompanyAdmin({
        to: dto.adminEmail,
        firstName: dto.adminFirstName,
        email: dto.adminEmail,
        companyName: dto.name,
        loginUrl: `${this.config.get<string>('webUrl')}/login?company=${dto.slug}`,
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
   * Upload logo file and update CompanyBranding.logoUrl
   */
  async uploadLogo(companyId: string, file: Express.Multer.File) {
    const logoUrl = await this.storeBrandingAsset(companyId, file, {
      name: 'logo',
      maxBytes: 2 * 1024 * 1024,
      extensions: {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/svg+xml': 'svg',
        'image/webp': 'webp',
      },
    });

    return this.updateBranding(companyId, { logoUrl });
  }

  /**
   * Upload favicon file and update CompanyBranding.faviconUrl
   */
  async uploadFavicon(companyId: string, file: Express.Multer.File) {
    const faviconUrl = await this.storeBrandingAsset(companyId, file, {
      name: 'favicon',
      maxBytes: 500 * 1024,
      extensions: {
        'image/x-icon': 'ico',
        'image/vnd.microsoft.icon': 'ico',
        'image/png': 'png',
        'image/svg+xml': 'svg',
        'image/jpeg': 'jpg',
      },
    });

    return this.updateBranding(companyId, { faviconUrl });
  }

  /**
   * Validates a branding upload and stores it at `<companyId>/branding/<name>.<ext>`.
   * The extension is derived from the validated MIME type, never from the client filename.
   */
  private async storeBrandingAsset(
    companyId: string,
    file: Express.Multer.File | undefined,
    opts: { name: string; maxBytes: number; extensions: Record<string, string> },
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException(`No ${opts.name} file provided`);
    }

    const ext = opts.extensions[file.mimetype];
    if (!ext) {
      const allowed = [...new Set(Object.values(opts.extensions))].join(', ').toUpperCase();
      throw new BadRequestException(`Invalid file type '${file.mimetype}'. Allowed types: ${allowed}.`);
    }

    if (file.size > opts.maxBytes) {
      throw new BadRequestException(
        `File size exceeds maximum ${Math.round(opts.maxBytes / 1024)}KB limit`,
      );
    }

    // 404 before touching storage if the company does not exist
    await this.findOne(companyId);

    return this.storage.upload(`${companyId}/branding/${opts.name}.${ext}`, file.buffer, file.mimetype);
  }
}
