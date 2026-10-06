import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { AccessContext } from '../access/access.types';
import type { TenantContext } from '../../common/types/request.types';
import { companyOf } from '../user-management/company-context';
import { ReorderOrgLevelsDto, ReportingLineDto, SaveOrgLevelDto } from './dto';
import { OrgService } from './org.service';
import { Live } from '../realtime/live.decorator';

// ============================================================
// Organisation structure (feature: people.org — core)
//
// GET    /org/levels                 company org levels (most senior first)
// POST   /org/levels                 add a level (goes to the bottom)
// POST   /org/levels/suggested       create the suggested set (empty companies)
// PUT    /org/levels/order           reorder (ids most senior → least)
// PUT    /org/levels/:id             rename / recolour
// DELETE /org/levels/:id             delete (designations keep their titles)
// GET    /org/chart                  employees + managers + levels (for the tree)
// POST   /org/reporting-line/preview who gains / loses visibility if X moves under Y
// PUT    /org/reporting-line         move X (and their team) under Y
// ============================================================

@ApiTags('Organisation')
@ApiBearerAuth()
@RequireFeature('people.org')
@Live('people', 'company')
@Controller('org')
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get('levels')
  @RequirePermission('org.view')
  levels(@TenantCtx() ctx: TenantContext) {
    return this.org.listLevels(companyOf(ctx));
  }

  @Post('levels')
  @RequirePermission('org.manage')
  @Audit('org:level:create', 'org_level')
  createLevel(@TenantCtx() ctx: TenantContext, @Body() dto: SaveOrgLevelDto) {
    return this.org.createLevel(companyOf(ctx), dto);
  }

  @Post('levels/suggested')
  @RequirePermission('org.manage')
  @Audit('org:level:create', 'org_level')
  suggested(@TenantCtx() ctx: TenantContext) {
    return this.org.createSuggestedLevels(companyOf(ctx));
  }

  @Put('levels/order')
  @RequirePermission('org.manage')
  @Audit('org:level:reorder', 'org_level')
  reorder(@TenantCtx() ctx: TenantContext, @Body() dto: ReorderOrgLevelsDto) {
    return this.org.reorderLevels(companyOf(ctx), dto.ids);
  }

  @Put('levels/:id')
  @RequirePermission('org.manage')
  @Audit('org:level:update', 'org_level')
  updateLevel(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveOrgLevelDto) {
    return this.org.updateLevel(companyOf(ctx), id, dto);
  }

  @Delete('levels/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('org.manage')
  @Audit('org:level:delete', 'org_level')
  deleteLevel(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.org.deleteLevel(companyOf(ctx), id);
  }

  @Get('people')
  @RequirePermission('org.view')
  @ApiOperation({ summary: 'Light list of current people for pickers (name, photo, title, department)' })
  people(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.org.people(companyOf(ctx), access);
  }

  @Get('chart')
  @RequirePermission('org.view')
  @ApiOperation({ summary: 'Org chart data: employees with their managers, departments, titles and levels' })
  chart(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.org.chart(companyOf(ctx), access);
  }

  @Get('health')
  @RequirePermission('org.manage')
  @ApiOperation({ summary: 'Org health: wide spans, missing managers, departments without a head' })
  health(@TenantCtx() ctx: TenantContext) {
    return this.org.health(companyOf(ctx));
  }

  @Post('reporting-line/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('org.manage')
  @ApiOperation({ summary: 'Preview a reporting change: loop check, people moving, who gains / loses visibility' })
  preview(@TenantCtx() ctx: TenantContext, @Body() dto: ReportingLineDto) {
    return this.org.preview(companyOf(ctx), dto);
  }

  @Put('reporting-line')
  @RequirePermission('org.manage')
  @Audit('org:reporting-line:update', 'employee')
  setReportingLine(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: ReportingLineDto) {
    return this.org.setReportingLine(companyOf(ctx), dto, access);
  }
}
