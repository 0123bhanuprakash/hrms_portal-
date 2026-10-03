import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CompaniesService } from '../companies/companies.service';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';
import { CreateCompanyDto } from '../companies/dto/create-company.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import {
  AdminUpdateCompanyDto,
  SendTestEmailDto,
  UpdateCompanyAdminStatusDto,
  UpdateCompanyStatusDto,
} from './dto/admin-company.dto';
import { SuperAdminOnly, Audit } from '../../common';

// ============================================================
// AdminController — Super Admin platform API (/api/v1/admin/*)
//
// GET    /admin/system                                   enabled optional services
// GET    /admin/stats                                    platform dashboard stats
// GET    /admin/audit-logs                               platform audit logs (filters)
// GET    /admin/audit-logs/actions                       distinct action names
// GET    /admin/companies                                list (search/filter/sort/paginate)
// POST   /admin/companies                                onboard company + first admin
// GET    /admin/companies/:id                            detail + admins + stats
// PATCH  /admin/companies/:id                            edit details / prefix / colors
// PATCH  /admin/companies/:id/status                     ACTIVE | INACTIVE | SUSPENDED
// GET    /admin/companies/:id/admins                     list company admins
// POST   /admin/companies/:id/admins                     add company admin
// PATCH  /admin/companies/:id/admins/:userId/status      activate / deactivate admin
// POST   /admin/companies/:id/admins/:userId/resend-invite   new temp password email
// POST   /admin/companies/:id/admins/:userId/reset-password  password reset link email
// ============================================================

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('Admin')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly companiesService: CompaniesService,
  ) {}

  // ─── Platform ──────────────────────────────────────────────

  @Get('system')
  @ApiOperation({ summary: 'Optional services enabled on this deployment (queue, storage, email, search)' })
  getSystemStatus() {
    return this.adminService.getSystemStatus();
  }

  @Post('system/test-email')
  @HttpCode(HttpStatus.OK)
  @Audit('system:email:test', 'email')
  @ApiOperation({ summary: 'Verify email settings and send a test email' })
  sendTestEmail(@Body() dto: SendTestEmailDto) {
    return this.adminService.sendTestEmail(dto.to.trim().toLowerCase());
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform dashboard statistics + 5 most recent companies' })
  getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Platform-wide audit logs' })
  getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.adminService.getPlatformAuditLogs(query);
  }

  @Get('audit-logs/actions')
  @ApiOperation({ summary: 'Distinct audit action names (for filters)' })
  getAuditActions() {
    return this.adminService.listAuditActions();
  }

  // ─── Companies ─────────────────────────────────────────────

  @Get('companies')
  @ApiOperation({ summary: 'List companies' })
  getCompanies(@Query() query: QueryCompaniesDto) {
    return this.adminService.listCompanies(query);
  }

  @Audit('company:create', 'company')
  @Post('companies')
  @ApiOperation({ summary: 'Onboard a new company and its first Company Admin' })
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Company detail with admins and usage counts' })
  getCompanyDetail(@Param('id', uuid) id: string) {
    return this.adminService.getCompanyDetail(id);
  }

  @Audit('company:update', 'company', { companyIdParam: 'id' })
  @Patch('companies/:id')
  @ApiOperation({ summary: 'Edit company name, email, employee ID prefix and brand colors' })
  updateCompany(@Param('id', uuid) id: string, @Body() dto: AdminUpdateCompanyDto) {
    return this.adminService.updateCompany(id, dto);
  }

  @Audit('company:status:update', 'company', { companyIdParam: 'id' })
  @Patch('companies/:id/status')
  @ApiOperation({ summary: 'Set company status; non-ACTIVE blocks all its users immediately' })
  updateCompanyStatus(@Param('id', uuid) id: string, @Body() dto: UpdateCompanyStatusDto) {
    return this.adminService.updateCompanyStatus(id, dto);
  }

  // ─── Company admins ────────────────────────────────────────

  @Get('companies/:id/admins')
  @ApiOperation({ summary: 'List Company Admins of a company' })
  getCompanyAdmins(@Param('id', uuid) id: string) {
    return this.adminService.listCompanyAdmins(id);
  }

  @Audit('company:admin:add', 'user', { companyIdParam: 'id' })
  @Post('companies/:id/admins')
  @ApiOperation({ summary: 'Add a Company Admin (welcome email with temporary password)' })
  addCompanyAdmin(@Param('id', uuid) id: string, @Body() dto: CreateCompanyAdminDto) {
    return this.adminService.addCompanyAdmin(id, dto);
  }

  @Audit('company:admin:status:update', 'user', { companyIdParam: 'id' })
  @Patch('companies/:id/admins/:userId/status')
  @ApiOperation({ summary: 'Activate / deactivate a Company Admin (deactivation revokes sessions)' })
  updateCompanyAdminStatus(
    @Param('id', uuid) id: string,
    @Param('userId', uuid) userId: string,
    @Body() dto: UpdateCompanyAdminStatusDto,
  ) {
    return this.adminService.updateCompanyAdminStatus(id, userId, dto);
  }

  @Audit('company:admin:invite:resend', 'user', { companyIdParam: 'id' })
  @Post('companies/:id/admins/:userId/resend-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-send welcome email with a new temporary password (never-logged-in admins only)' })
  resendAdminInvite(@Param('id', uuid) id: string, @Param('userId', uuid) userId: string) {
    return this.adminService.resendAdminInvite(id, userId);
  }

  @Audit('company:admin:password:reset', 'user', { companyIdParam: 'id' })
  @Post('companies/:id/admins/:userId/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email a password reset link to a Company Admin' })
  sendAdminPasswordReset(@Param('id', uuid) id: string, @Param('userId', uuid) userId: string) {
    return this.adminService.sendAdminPasswordReset(id, userId);
  }
}
