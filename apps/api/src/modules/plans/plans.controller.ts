import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, SuperAdminOnly } from '../../common';
import type { JwtPayload } from '@hrms/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CompanyLimitsDto, FeatureOverrideDto, PlanImpactDto, SavePlanDto, SetCompanyPlanDto } from './dto';
import { PlanInsightsService } from './plan-insights.service';
import { PlansService } from './plans.service';
import { Risky } from '../account/reauth.guard';

// ============================================================
// Super Admin — plans and per-company features
//
// GET    /admin/plans                               list
// GET    /admin/plans/:id                           detail
// POST   /admin/plans                               create
// PUT    /admin/plans/:id                           update (all companies on it refresh)
// DELETE /admin/plans/:id                           delete (no companies)
// GET    /admin/plans/overview                      usage per plan, switches & trials, upgrade candidates
// GET    /admin/plans/:id/history                   change history
// POST   /admin/plans/:id/impact                    who is affected by an unsaved change
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
  constructor(
    private readonly plans: PlansService,
    private readonly insights: PlanInsightsService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'List plans with features, limits and company counts' })
  list() {
    return this.plans.list();
  }

  @Get('plans/overview')
  @ApiOperation({ summary: 'Per-plan usage, custom switches and trials, upgrade candidates' })
  overview() {
    return this.insights.overview();
  }

  @Get('plans/:id/history')
  @ApiOperation({ summary: 'What changed on this plan, newest first' })
  history(@Param('id', uuid) id: string) {
    return this.insights.history(id);
  }

  @Post('plans/:id/impact')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview: which companies lose which features (and how much they used them) if the plan is saved like this' })
  impact(@Param('id', uuid) id: string, @Body() dto: PlanImpactDto) {
    return this.insights.impact(id, dto.features, dto.limits);
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

  @Risky()
  @Put('plans/:id')
  @Audit('plan:update', 'plan')
  update(@Param('id', uuid) id: string, @Body() dto: SavePlanDto) {
    return this.plans.update(id, dto);
  }

  @Risky()
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

  @Risky()
  @Put('companies/:id/plan')
  @Audit('company:plan:update', 'company', { companyIdParam: 'id' })
  setPlan(@Param('id', uuid) id: string, @Body() dto: SetCompanyPlanDto) {
    return this.plans.setCompanyPlan(id, dto.planId);
  }

  @Risky()
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

  @Risky()
  @Delete('companies/:id/features/:feature')
  @HttpCode(HttpStatus.OK)
  @Audit('company:feature:reset', 'company', { companyIdParam: 'id' })
  clearOverride(@Param('id', uuid) id: string, @Param('feature') feature: string) {
    return this.plans.clearOverride(id, feature);
  }

  @Risky()
  @Put('companies/:id/limits')
  @Audit('company:limits:update', 'company', { companyIdParam: 'id' })
  setLimits(@Param('id', uuid) id: string, @Body() dto: CompanyLimitsDto) {
    return this.plans.setCompanyLimits(id, dto);
  }
}
