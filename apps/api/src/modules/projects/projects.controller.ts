import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { ProjectsService } from './projects.service';
import { ProjectPlanningService } from './planning.service';
import { AvailableQueryDto, BilledDto, CapacityQueryDto, MilestoneDto, MilestonePatchDto, OpenRoleDto, PlannerQueryDto, ProjectQueryDto, ProjectUpdateDto, SaveMemberDto, SaveProjectDto, TimelineQueryDto } from './dto';

@RequireFeature('work.projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly planning: ProjectPlanningService,
  ) {}

  /** Portfolio: health, milestones, team, last update. */
  @RequirePermission('project.view')
  @Get()
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: ProjectQueryDto) {
    return this.planning.list(ctx.companyId!, query, access);
  }

  /** Company-wide numbers (health, billing) — PMO only. */
  @RequirePermission('project.manage')
  @Get('summary')
  summary(@TenantCtx() ctx: TenantContext) {
    return this.planning.summary(ctx.companyId!);
  }

  @RequirePermission('project.manage')
  @Get('timeline')
  timeline(@TenantCtx() ctx: TenantContext, @Query() q: TimelineQueryDto) {
    return this.planning.timeline(ctx.companyId!, q);
  }

  /** Resource planner — the PMO's view of everyone's allocations by week. */
  @RequirePermission('project.manage')
  @Get('planner')
  planner(@TenantCtx() ctx: TenantContext, @Query() q: PlannerQueryDto) {
    return this.planning.planner(ctx.companyId!, q);
  }

  @RequirePermission('project.manage')
  @Get('available')
  available(@TenantCtx() ctx: TenantContext, @Query() q: AvailableQueryDto) {
    return this.planning.available(ctx.companyId!, q);
  }

  /** My projects with lead / approver, latest update, coming milestones, who's away. */
  @Get('my-overview')
  myOverview(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.planning.myOverview(ctx.companyId!, access);
  }

  /** Billable / investment / bench split for one person today. */
  @RequirePermission('project.view')
  @Get('billing/:employeeId')
  async billing(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('employeeId', ParseUUIDPipe) employeeId: string) {
    await this.planning.assertCanSeePerson(ctx.companyId!, access, employeeId);
    return this.planning.personBilling(ctx.companyId!, employeeId);
  }

  /** My current and upcoming assignments (no permission needed — they're mine). */
  @Get('mine')
  mine(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.projects.mine(ctx.companyId!, access.employee?.id);
  }

  @RequirePermission('project.view')
  @Get('capacity/:employeeId')
  async capacity(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('employeeId', ParseUUIDPipe) employeeId: string, @Query() query: CapacityQueryDto) {
    await this.planning.assertCanSeePerson(ctx.companyId!, access, employeeId);
    return this.projects.capacity(ctx.companyId!, employeeId, query);
  }

  @RequirePermission('project.view')
  @Get(':id')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.planning.detail(ctx.companyId!, id, access);
  }

  // ─── Milestones / updates / open roles (PMO or the project's manager) ──

  @RequirePermission('project.view')
  @Audit('project:milestone:add', 'project')
  @Post(':id/milestones')
  addMilestone(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MilestoneDto) {
    return this.planning.addMilestone(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('project.view')
  @Patch(':id/milestones/:milestoneId')
  updateMilestone(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('milestoneId', ParseUUIDPipe) milestoneId: string, @Body() dto: MilestonePatchDto) {
    return this.planning.updateMilestone(ctx.companyId!, access, id, milestoneId, dto);
  }

  @RequirePermission('project.view')
  @Delete(':id/milestones/:milestoneId')
  removeMilestone(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('milestoneId', ParseUUIDPipe) milestoneId: string) {
    return this.planning.removeMilestone(ctx.companyId!, access, id, milestoneId);
  }

  @RequirePermission('project.view')
  @Audit('project:update:post', 'project')
  @Post(':id/updates')
  postUpdate(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProjectUpdateDto) {
    return this.planning.postUpdate(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('project.view')
  @Post(':id/roles')
  openRole(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OpenRoleDto) {
    return this.planning.openRole(ctx.companyId!, access, id, dto);
  }

  /** filled=true marks the role filled; false removes it. */
  @RequirePermission('project.view')
  @Put(':id/roles/:roleId')
  @HttpCode(HttpStatus.OK)
  closeRole(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('roleId', ParseUUIDPipe) roleId: string, @Query('filled', ParseBoolPipe) filled: boolean) {
    return this.planning.closeRole(ctx.companyId!, access, id, roleId, filled);
  }

  @RequirePermission('project.manage')
  @Audit('project:member:billed', 'project_member')
  @Put(':id/members/:memberId/billed')
  setBilled(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string, @Body() dto: BilledDto) {
    return this.projects.setBilled(ctx.companyId!, id, memberId, dto.billed, access.userId);
  }

  @RequirePermission('project.manage')
  @Audit('project:create', 'project')
  @Post()
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveProjectDto) {
    return this.projects.create(ctx.companyId!, access.userId, dto);
  }

  @RequirePermission('project.manage')
  @Audit('project:update', 'project')
  @Patch(':id')
  update(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveProjectDto) {
    return this.projects.update(ctx.companyId!, id, dto, access.userId);
  }

  @RequirePermission('project.manage')
  @Audit('project:member:add', 'project_member')
  @Post(':id/members')
  addMember(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveMemberDto) {
    return this.projects.addMember(ctx.companyId!, id, dto, access.userId);
  }

  @RequirePermission('project.manage')
  @Audit('project:member:update', 'project_member')
  @Patch(':id/members/:memberId')
  updateMember(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SaveMemberDto,
  ) {
    return this.projects.updateMember(ctx.companyId!, id, memberId, dto, access.userId);
  }

  @RequirePermission('project.manage')
  @Audit('project:member:remove', 'project_member')
  @Delete(':id/members/:memberId')
  removeMember(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.projects.removeMember(ctx.companyId!, id, memberId, access.userId);
  }
}
