import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, SuperAdminOnly } from '../../common';
import type { JwtPayload } from '@hrms/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CompanyLimitsDto, FeatureOverrideDto, SavePlanDto, SetCompanyPlanDto } from './dto';
import { PlansService } from './plans.service';

// ============================================================
// Super Admin — plans and per-company features
//
// GET    /admin/plans                               list
// GET    /admin/plans/:id                           detail
// POST   /admin/plans                               create
// PUT    /admin/plans/:id                           update (all companies on it refresh)
// DELETE /admin/plans/:id                           delete (no companies)
//
// GET    /admin/companies/:id/features              plan, features (plan / override / effective), limits, usage
// PUT    /admin/companies/:id/plan                  change plan
// PUT    /admin/companies/:id/features/:feature     force ON / OFF (optional reason, end date)
// DELETE /admin/companies/:id/features/:feature     back to the plan
// PUT    /admin/companies/:id/limits                limit overrides ({} = plan)
// ============================================================

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('Admin — Plans')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('admin')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List plans with features, limits and company counts' })
  list() {
    return this.plans.list();
  }

  @Get('plans/:id')
  get(@Param('id', uuid) id: string) {
    return this.plans.get(id);
  }

  @Post('plans')
  @Audit('plan:create', 'plan')
  create(@Body() dto: SavePlanDto) {
    return this.plans.create(dto);
  }

  @Put('plans/:id')
  @Audit('plan:update', 'plan')
  update(@Param('id', uuid) id: string, @Body() dto: SavePlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.OK)
  @Audit('plan:delete', 'plan')
  remove(@Param('id', uuid) id: string) {
    return this.plans.remove(id);
  }

  @Get('companies/:id/features')
  @ApiOperation({ summary: "A company's plan, feature switches, limits and usage" })
  companyFeatures(@Param('id', uuid) id: string) {
    return this.plans.describeCompany(id);
  }

  @Put('companies/:id/plan')
  @Audit('company:plan:update', 'company', { companyIdParam: 'id' })
  setPlan(@Param('id', uuid) id: string, @Body() dto: SetCompanyPlanDto) {
    return this.plans.setCompanyPlan(id, dto.planId);
  }

  @Put('companies/:id/features/:feature')
  @Audit('company:feature:update', 'company', { companyIdParam: 'id' })
  setOverride(
    @Param('id', uuid) id: string,
    @Param('feature') feature: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: FeatureOverrideDto,
  ) {
    return this.plans.setOverride(id, feature, user.sub, dto);
  }

  @Delete('companies/:id/features/:feature')
  @HttpCode(HttpStatus.OK)
  @Audit('company:feature:reset', 'company', { companyIdParam: 'id' })
  clearOverride(@Param('id', uuid) id: string, @Param('feature') feature: string) {
    return this.plans.clearOverride(id, feature);
  }

  @Put('companies/:id/limits')
  @Audit('company:limits:update', 'company', { companyIdParam: 'id' })
  setLimits(@Param('id', uuid) id: string, @Body() dto: CompanyLimitsDto) {
    return this.plans.setCompanyLimits(id, dto);
  }
}
