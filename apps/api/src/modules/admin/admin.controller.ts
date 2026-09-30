import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { SuperAdminOnly, Audit } from '../../common';
import { CompanyStatus } from '@prisma/client';

@SuperAdminOnly()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Super Admin Platform Dashboard Statistics (metadata counts only, no employee PII)
   * GET /admin/stats
   */
  @Get('stats')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  /**
   * Platform-wide Audit Logs
   * GET /admin/audit-logs
   */
  @Get('audit-logs')
  async getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.adminService.getPlatformAuditLogs(query);
  }

  /**
   * Get company detail + list of admins + usage counts
   * GET /admin/companies/:id
   */
  @Get('companies/:id')
  async getCompanyDetail(@Param('id') id: string) {
    return this.adminService.getCompanyDetail(id);
  }

  /**
   * Activate company
   * PATCH /admin/companies/:id/activate
   */
  @Audit('company:activate', 'company')
  @Patch('companies/:id/activate')
  async activateCompany(@Param('id') id: string) {
    return this.adminService.activateCompany(id);
  }

  /**
   * Deactivate or suspend company
   * PATCH /admin/companies/:id/deactivate
   */
  @Audit('company:deactivate', 'company')
  @Patch('companies/:id/deactivate')
  async deactivateCompany(
    @Param('id') id: string,
    @Body('status') status?: CompanyStatus,
  ) {
    return this.adminService.deactivateCompany(id, status || CompanyStatus.SUSPENDED);
  }

  /**
   * Add an additional Company Admin to an existing company
   * POST /admin/companies/:id/admins
   */
  @Audit('company:admin:add', 'user')
  @Post('companies/:id/admins')
  async addCompanyAdmin(
    @Param('id') id: string,
    @Body() dto: CreateCompanyAdminDto,
  ) {
    return this.adminService.addCompanyAdmin(id, dto);
  }
}
