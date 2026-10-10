import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ForbiddenException,
  ParseUUIDPipe,
  Put,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateCompanyThemeDto } from './dto/update-company-theme.dto';
import { UpdatePersonalizationDto } from './dto/update-personalization.dto';
import { UpdateUiDefaultsDto } from './dto/update-ui-defaults.dto';
import { Public } from '../auth/decorators/public.decorator';
import {
  SuperAdminOnly,
  RequirePermission,
  Audit,
  TenantCtx,
} from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import { CompanyStatus } from '@prisma/client';
import { Live } from '../realtime/live.decorator';

@Live('branding', 'company')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * Semi-public branding lookup by company slug for login UI
   * e.g. GET /companies/branding/by-slug/acme
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('branding/by-slug/:slug')
  async getBrandingBySlug(@Param('slug') slug: string) {
    return this.companiesService.findBrandingBySlug(slug);
  }

  /**
   * Create a new company (Super Admin only)
   */
  @SuperAdminOnly()
  @Audit('company:create', 'company')
  @Post()
  async create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  /**
   * List companies (Super Admin only)
   */
  @SuperAdminOnly()
  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: CompanyStatus,
  ) {
    return this.companiesService.findAll({ page, limit, search, status });
  }

  /**
   * Get company by ID — the full record (plan, limits, contact email, settings) is
   * admin information; the portal itself only needs /branding, /theme and /stats
   */
  @RequirePermission('settings.view')
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.findOne(id);
  }

  /**
   * Update company details or status (Super Admin only)
   */
  @SuperAdminOnly()
  @Audit('company:update', 'company', { companyIdParam: 'id' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, dto);
  }

  /**
   * Get company branding
   */
  @Get(':id/branding')
  async getBranding(
    @Param('id') id: string,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    const company = await this.companiesService.findOne(id);
    // Older or imported companies may have no branding yet — start them with their name
    return company.branding ?? this.companiesService.ensureBranding(id, company.name);
  }

  /**
   * Update company branding (Company Admin / Super Admin)
   */
  @RequirePermission('branding.manage')
  @Audit('company:branding:update', 'company_branding', { companyIdParam: 'id' })
  @Patch(':id/branding')
  async updateBranding(
    @Param('id') id: string,
    @Body() dto: UpdateBrandingDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.updateBranding(id, dto);
  }

  /**
   * Upload logo file to MinIO (Company Admin / Super Admin)
   * POST /companies/:id/branding/logo
   */
  @RequirePermission('branding.manage')
  @Audit('company:branding:logo:upload', 'company_branding', { companyIdParam: 'id' })
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/branding/logo')
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.uploadLogo(id, file);
  }

  @RequirePermission('branding.manage')
  @Audit('company:branding:logo-dark:upload', 'company_branding', { companyIdParam: 'id' })
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/branding/logo-dark')
  async uploadLogoDark(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @TenantCtx() ctx: TenantContext) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.uploadLogoDark(id, file);
  }

  @RequirePermission('branding.manage')
  @Audit('company:branding:sign-in-photo:upload', 'company_branding', { companyIdParam: 'id' })
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/branding/sign-in-photo')
  async uploadSignInPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @TenantCtx() ctx: TenantContext) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.uploadSignInPhoto(id, file);
  }

  /**
   * Upload favicon file to MinIO (Company Admin / Super Admin)
   * POST /companies/:id/branding/favicon
   */
  @RequirePermission('branding.manage')
  @Audit('company:branding:favicon:upload', 'company_branding', { companyIdParam: 'id' })
  @UseInterceptors(FileInterceptor('file'))
  @Post(':id/branding/favicon')
  async uploadFavicon(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.uploadFavicon(id, file);
  }

  /**
   * Get company operational settings
   */
  @RequirePermission('settings.view')
  @Get(':id/settings')
  async getSettings(
    @Param('id') id: string,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    const company = await this.companiesService.findOne(id);
    return company.settings;
  }

  /**
   * Update company operational settings (Company Admin / Super Admin)
   */
  @RequirePermission('settings.manage')
  @Audit('company:settings:update', 'company_settings', { companyIdParam: 'id' })
  @Patch(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateSettingsDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.updateSettings(id, dto);
  }

  /**
   * Get company stats
   */
  @Get(':id/stats')
  async getStats(
    @Param('id') id: string,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.getStats(id);
  }

  /**
   * Company theme (any user of the company — needed to render their portal)
   * GET /companies/:id/theme
   */
  @Get(':id/theme')
  async getTheme(@Param('id', new ParseUUIDPipe()) id: string, @TenantCtx() ctx: TenantContext) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.getTheme(id);
  }

  /**
   * Replace the company theme (Company Admin / Super Admin)
   * PUT /companies/:id/theme
   */
  @RequirePermission('branding.manage')
  @Audit('company:theme:update', 'company_branding', { companyIdParam: 'id' })
  @Put(':id/theme')
  async updateTheme(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCompanyThemeDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.updateTheme(id, dto);
  }

  /**
   * What employees may personalise (own theme, menu style) — Company Admin
   * PUT /companies/:id/personalization
   */
  @RequirePermission('branding.manage')
  @Audit('company:personalization:update', 'company_settings', { companyIdParam: 'id' })
  @Put(':id/personalization')
  async updatePersonalization(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePersonalizationDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.updatePersonalization(id, dto);
  }

  /**
   * Company defaults for view settings — Company Admin
   * PUT /companies/:id/ui-defaults  { values: { key: value } }
   */
  @RequirePermission('branding.manage')
  @Audit('company:ui-defaults:update', 'company_settings', { companyIdParam: 'id' })
  @Put(':id/ui-defaults')
  async updateUiDefaults(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUiDefaultsDto,
    @TenantCtx() ctx: TenantContext,
  ) {
    this.assertTenantAccess(id, ctx);
    return this.companiesService.updateUiDefaults(id, dto.values);
  }

  /**
   * Helper method to verify tenant isolation
   */
  private assertTenantAccess(targetCompanyId: string, ctx: TenantContext) {
    if (ctx.isSuperAdmin) return;
    if (ctx.companyId !== targetCompanyId) {
      throw new ForbiddenException(
        'Access denied: You cannot access resources belonging to another tenant',
      );
    }
  }
}
