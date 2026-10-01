import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Public } from '../auth/decorators/public.decorator';
import {
  SuperAdminOnly,
  RequirePermission,
  Audit,
  TenantCtx,
} from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import { CompanyStatus } from '@prisma/client';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * Semi-public branding lookup by company slug for login UI
   * e.g. GET /companies/branding/by-slug/acme
   */
  @Public()
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
   * Get company by ID
   */
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
    return company.branding;
  }

  /**
   * Update company branding (Company Admin / Super Admin)
   */
  @RequirePermission('branding:manage')
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
  @RequirePermission('branding:manage')
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

  /**
   * Upload favicon file to MinIO (Company Admin / Super Admin)
   * POST /companies/:id/branding/favicon
   */
  @RequirePermission('branding:manage')
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
  @RequirePermission('company:manage')
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
