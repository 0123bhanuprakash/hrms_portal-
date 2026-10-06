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
import { CompanyRolesService } from '../access/company-roles.service';
import { DEFAULT_PLAN_KEY } from '../access/catalog';
import { companyThemeFields, type CompanyThemeInput } from '../themes/company-theme';
import { SeasonsService } from '../seasons/seasons.service';
import { ThemesService } from '../themes/themes.service';
import type { BackdropLevel, BackdropPack, CompanyPersonalization, MenuStyle, ThemeRef, ThemeTokens } from '@hrms/types';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CompanyStatus, Prisma, UserStatus } from '@prisma/client';
import { generateTemporaryPassword, hashPassword } from '../auth/password.util';
import { BACKDROP_LEVELS, BACKDROP_PACKS, MENU_STYLES } from '../themes/personalization';
import { mergeUiState } from '../users/ui-state';
import type { UpdatePersonalizationDto } from './dto/update-personalization.dto';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailProducerService: EmailProducerService,
    private readonly companyRoles: CompanyRolesService,
    private readonly storage: StorageService,
    private readonly themes: ThemesService,
    private readonly seasons: SeasonsService,
  ) {}

  /**
   * Create a new company along with default settings, branding, and initial Company Admin user
   */
  async create(dto: CreateCompanyDto) {
    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId }, select: { isActive: true } });
      if (!plan) throw new NotFoundException('Plan not found');
      if (!plan.isActive) throw new BadRequestException('That plan is archived — choose another');
    }

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
          // Default plan until the Super Admin picks one (Enterprise = every feature)
          plan: { connect: dto.planId ? { id: dto.planId } : { key: DEFAULT_PLAN_KEY } },
        },
      });

      // The company's own, editable copies of the role templates
      const ownerRoleId = await this.companyRoles.roleId(tx, company.id, 'company_admin');

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

      // Create initial Company Admin user
      const adminUser = await tx.user.create({
        data: {
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          mustChangePassword: true,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          companyId: company.id,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Company Admin = the company's owner role (all enabled features)
      await tx.userRole.create({
        data: { userId: adminUser.id, roleId: ownerRoleId, companyId: company.id },
      });

      // Everyone in a company is an employee — the admin too (employee #1).
      // They complete job title, department etc. themselves later.
      const firstNumber = await tx.companySettings.update({ where: { id: settings.id }, data: { employeeIdSequence: { increment: 1 } } });
      const adminEmployee = await tx.employee.create({
        data: {
          companyId: company.id,
          userId: adminUser.id,
          employeeId: `${firstNumber.employeeIdPrefix || 'EMP'}${String(firstNumber.employeeIdSequence).padStart(3, '0')}`,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          joiningDate: new Date(new Date().toISOString().slice(0, 10)),
        },
      });
      await tx.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: adminEmployee.id, descendantId: adminEmployee.id, depth: 0 } });

      return { company, settings: firstNumber, branding, adminUser, adminEmployee };
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
        employeeId: result.adminEmployee.employeeId,
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
  // ─── Company theme ───────────────────────────────────────

  /**
   * The company's theme, or — when it has none yet — the platform's default
   * theme for companies (custom default tokens are included so any client can
   * render it; presets resolve client-side by key).
   */
  async getTheme(companyId: string) {
    const company = await this.findOne(companyId);
    const settings = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { uiDefaults: true } });
    return { ...(await this.describeTheme(company.branding)), personalization: await this.personalization(companyId), uiDefaults: settings?.uiDefaults ?? {} };
  }

  /** What employees may change for themselves (defaults when settings don't exist yet). */
  async personalization(companyId: string): Promise<CompanyPersonalization> {
    const s = await this.prisma.companySettings.findUnique({
      where: { companyId },
      select: { personalThemes: true, allowedThemes: true, personalMenuStyle: true, defaultMenuStyle: true, defaultBackdropPack: true, defaultBackdropLevel: true },
    });
    return {
      personalThemes: s?.personalThemes ?? true,
      allowedThemes: s?.allowedThemes ?? [],
      personalMenuStyle: s?.personalMenuStyle ?? true,
      defaultMenuStyle: ((MENU_STYLES as readonly string[]).includes(s?.defaultMenuStyle ?? '') ? s!.defaultMenuStyle : 'classic') as MenuStyle,
      defaultBackdropPack: ((BACKDROP_PACKS as readonly string[]).includes(s?.defaultBackdropPack ?? '') ? s!.defaultBackdropPack : 'signature') as BackdropPack,
      defaultBackdropLevel: ((BACKDROP_LEVELS as readonly string[]).includes(s?.defaultBackdropLevel ?? '') ? s!.defaultBackdropLevel : 'lively') as BackdropLevel,
    };
  }

  /** Company defaults for view settings (chart styles…); replaces the whole set. */
  async updateUiDefaults(companyId: string, values: Record<string, unknown>) {
    await this.findOne(companyId);
    const uiDefaults = mergeUiState({}, values) as Prisma.InputJsonObject;
    const s = await this.prisma.companySettings.upsert({ where: { companyId }, update: { uiDefaults }, create: { companyId, uiDefaults }, select: { uiDefaults: true } });
    return s.uiDefaults;
  }

  /** Company Admins decide what employees may personalise. */
  async updatePersonalization(companyId: string, dto: UpdatePersonalizationDto) {
    await this.findOne(companyId);
    const data = {
      ...(dto.personalThemes !== undefined && { personalThemes: dto.personalThemes }),
      ...(dto.allowedThemes !== undefined && { allowedThemes: [...new Set(dto.allowedThemes)] }),
      ...(dto.personalMenuStyle !== undefined && { personalMenuStyle: dto.personalMenuStyle }),
      ...(dto.defaultMenuStyle !== undefined && { defaultMenuStyle: dto.defaultMenuStyle }),
      ...(dto.defaultBackdropPack !== undefined && { defaultBackdropPack: dto.defaultBackdropPack }),
      ...(dto.defaultBackdropLevel !== undefined && { defaultBackdropLevel: dto.defaultBackdropLevel }),
    };
    await this.prisma.companySettings.upsert({ where: { companyId }, update: data, create: { companyId, ...data } });
    return this.personalization(companyId);
  }

  /** Company Admins replace their own theme (validated strictly). */
  async updateTheme(companyId: string, input: CompanyThemeInput) {
    const company = await this.findOne(companyId);
    const fields = companyThemeFields(input);
    if (!fields.themeTokens) {
      throw new BadRequestException('themeTokens is required');
    }

    const branding = await this.prisma.companyBranding.upsert({
      where: { companyId },
      update: { ...fields, themeSource: fields.themeSource ?? Prisma.DbNull },
      create: { companyId, displayName: company.name, ...fields },
    });
    return this.describeTheme(branding);
  }

  /** Creates the default branding row for a company that has none. */
  ensureBranding(companyId: string, name: string) {
    return this.prisma.companyBranding.upsert({ where: { companyId }, update: {}, create: { companyId, displayName: name } });
  }

  private async describeTheme(branding: { themeTokens: Prisma.JsonValue; themeSource: Prisma.JsonValue } | null) {
    const themeTokens = (branding?.themeTokens ?? null) as ThemeTokens | null;
    let platformDefault: { ref: ThemeRef; tokens: ThemeTokens | null } | null = null;

    if (!themeTokens) {
      const settings = await this.themes.getSettingsResolved();
      const ref = settings.defaultCompanyTheme;
      platformDefault = { ref, tokens: ref.kind === 'custom' ? (settings.customTokens[ref.id] ?? null) : null };
    }

    return {
      themeTokens,
      themeSource: (branding?.themeSource ?? null) as ThemeRef | null,
      platformDefault,
    };
  }

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
            themeTokens: true,
            themeSource: true,
            tagline: true,
            logoDarkUrl: true,
            signInMessage: true,
            signInBackground: true,
            signInPhotoUrl: true,
          },
        },
      },
    });

    if (!company || company.status !== CompanyStatus.ACTIVE) {
      throw new NotFoundException(`Active company with slug '${slug}' not found`);
    }

    const { themeTokens: _t, themeSource: _s, ...branding } = company.branding ?? { themeTokens: null, themeSource: null };
    return {
      companyName: company.name,
      slug: company.slug,
      branding: company.branding ? branding : null,
      // Lets the public login page render the company's theme
      theme: await this.describeTheme(company.branding),
      // …and its default page background (sign-in hero)
      backdrop: await this.personalization(company.id).then((p) => ({ pack: p.defaultBackdropPack, level: p.defaultBackdropLevel })),
      // A seasonal theme that is on today and dresses up the sign-in page too
      season: await this.seasons.active(company.id).then((s) => (s?.onSignIn ? { name: s.name, emoji: s.emoji, colors: s.colors, decoration: s.decoration, greeting: s.greeting } : null)),
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
        ...(dto.tagline !== undefined && { tagline: dto.tagline.trim() || null }),
        ...(dto.logoDarkUrl !== undefined && { logoDarkUrl: dto.logoDarkUrl }),
        ...(dto.signInMessage !== undefined && { signInMessage: dto.signInMessage.trim() || null }),
        ...(dto.signInBackground && { signInBackground: dto.signInBackground }),
        ...(dto.signInPhotoUrl !== undefined && { signInPhotoUrl: dto.signInPhotoUrl }),
      },
      create: {
        companyId,
        displayName: dto.displayName || 'HRMS Portal',
        logoUrl: dto.logoUrl,
        faviconUrl: dto.faviconUrl,
        primaryColor: dto.primaryColor || '#1E40AF',
        secondaryColor: dto.secondaryColor || '#EFF6FF',
        tagline: dto.tagline?.trim() || null,
        logoDarkUrl: dto.logoDarkUrl ?? null,
        signInMessage: dto.signInMessage?.trim() || null,
        signInBackground: dto.signInBackground ?? 'pack',
        signInPhotoUrl: dto.signInPhotoUrl ?? null,
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
    const logoUrl = await this.storeBrandingAsset(companyId, file, { name: 'logo', ...LOGO_MEDIA });
    return this.updateBranding(companyId, { logoUrl });
  }

  /** Logo for dark mode (usually a white version). */
  async uploadLogoDark(companyId: string, file: Express.Multer.File) {
    const logoDarkUrl = await this.storeBrandingAsset(companyId, file, { name: 'logo-dark', ...LOGO_MEDIA });
    return this.updateBranding(companyId, { logoDarkUrl });
  }

  /** Picture, animation, video or 3D model behind the sign-in box. */
  async uploadSignInPhoto(companyId: string, file: Express.Multer.File) {
    const signInPhotoUrl = await this.storeBrandingAsset(companyId, file, { name: 'sign-in', ...SIGN_IN_MEDIA });
    return this.updateBranding(companyId, { signInPhotoUrl, signInBackground: 'photo' });
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
    opts: { name: string; maxBytes: number; extensions: Record<string, string>; maxBytesByExt?: Record<string, number> },
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException(`No ${opts.name} file provided`);
    }

    // Browsers often send .glb with no MIME type — the content check below confirms it
    const mimetype =
      (!file.mimetype || file.mimetype === 'application/octet-stream') && file.originalname?.toLowerCase().endsWith('.glb')
        ? 'model/gltf-binary'
        : file.mimetype;
    const ext = opts.extensions[mimetype];
    if (!ext) {
      const allowed = [...new Set(Object.values(opts.extensions))].join(', ').toUpperCase();
      throw new BadRequestException(`Invalid file type '${file.mimetype}'. Allowed types: ${allowed}.`);
    }

    const maxBytes = opts.maxBytesByExt?.[ext] ?? opts.maxBytes;
    if (file.size > maxBytes) {
      throw new BadRequestException(`File size exceeds maximum ${Math.round(maxBytes / 1024)}KB limit`);
    }
    assertMediaContent(ext, file.buffer);

    // 404 before touching storage if the company does not exist
    await this.findOne(companyId);

    return this.storage.upload(`${companyId}/branding/${opts.name}.${ext}`, file.buffer, mimetype);
  }
}

// Animated and 3D media for logos and the sign-in page
const ANIMATED_MEDIA = {
  'image/gif': 'gif',
  'image/apng': 'png',
  'application/json': 'json', // Lottie animation
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'model/gltf-binary': 'glb', // 3D model
};

const LOGO_MEDIA = {
  maxBytes: 2 * 1024 * 1024,
  maxBytesByExt: { gif: 5 * 1024 * 1024, mp4: 5 * 1024 * 1024, webm: 5 * 1024 * 1024, glb: 5 * 1024 * 1024 },
  extensions: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp', ...ANIMATED_MEDIA },
};

const SIGN_IN_MEDIA = {
  maxBytes: 4 * 1024 * 1024,
  maxBytesByExt: { gif: 10 * 1024 * 1024, mp4: 15 * 1024 * 1024, webm: 15 * 1024 * 1024, glb: 15 * 1024 * 1024 },
  extensions: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', ...ANIMATED_MEDIA },
};

/** Lottie and 3D files are read by the browser, so check they really are what they claim. */
function assertMediaContent(ext: string, buf: Buffer) {
  if (ext === 'json') {
    let data: { v?: unknown; layers?: unknown } | null = null;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch {
      throw new BadRequestException('That JSON file could not be read. Export the animation as Lottie JSON.');
    }
    if (!data || typeof data !== 'object' || typeof data.v !== 'string' || !Array.isArray(data.layers)) {
      throw new BadRequestException('That JSON file is not a Lottie animation.');
    }
  }
  if (ext === 'glb' && buf.subarray(0, 4).toString('ascii') !== 'glTF') {
    throw new BadRequestException('That file is not a 3D model in GLB format.');
  }
}
