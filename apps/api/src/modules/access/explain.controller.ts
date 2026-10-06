import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import { companyOf } from '../user-management/company-context';
import { ExplainService } from './explain.service';

// ============================================================
// Access Explorer (Company Admin → Roles & permissions)
// GET /access/explain/users/:userId                        what can this user do, and why
// GET /access/explain/employees/:employeeId?permission=…   who can do <permission> on this employee
// ============================================================

@ApiTags('Access')
@ApiBearerAuth()
@RequireFeature('admin.users')
@Controller('access/explain')
export class ExplainController {
  constructor(private readonly explain: ExplainService) {}

  @Get('users/:userId')
  @RequirePermission('role.view')
  @ApiOperation({ summary: "A user's effective permissions with scopes, sources (roles) and reach" })
  user(@TenantCtx() ctx: TenantContext, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.explain.explainUser(companyOf(ctx), userId);
  }

  @Get('sensitive')
  @RequirePermission('role.view')
  @ApiOperation({ summary: 'Who can see or change private data (salary, bank, documents, roles…) for other people' })
  sensitive(@TenantCtx() ctx: TenantContext) {
    return this.explain.sensitiveCheck(companyOf(ctx));
  }

  @Get('employees/:employeeId')
  @RequirePermission('role.view')
  @ApiOperation({ summary: 'Everyone whose access reaches this employee for a permission, and why' })
  employee(
    @TenantCtx() ctx: TenantContext,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('permission') permission = 'employee.view',
  ) {
    return this.explain.whoCanAccess(companyOf(ctx), employeeId, permission);
  }
}
