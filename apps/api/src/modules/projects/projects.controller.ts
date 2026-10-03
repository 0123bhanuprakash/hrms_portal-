import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { ProjectsService } from './projects.service';
import { CapacityQueryDto, ProjectQueryDto, SaveMemberDto, SaveProjectDto } from './dto';

@RequireFeature('work.projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @RequirePermission('project.view')
  @Get()
  list(@TenantCtx() ctx: TenantContext, @Query() query: ProjectQueryDto) {
    return this.projects.list(ctx.companyId!, query);
  }

  /** My current and upcoming assignments (no permission needed — they're mine). */
  @Get('mine')
  mine(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.projects.mine(ctx.companyId!, access.employee?.id);
  }

  @RequirePermission('project.view')
  @Get('capacity/:employeeId')
  capacity(@TenantCtx() ctx: TenantContext, @Param('employeeId', ParseUUIDPipe) employeeId: string, @Query() query: CapacityQueryDto) {
    return this.projects.capacity(ctx.companyId!, employeeId, query);
  }

  @RequirePermission('project.view')
  @Get(':id')
  get(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(ctx.companyId!, id);
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
  update(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveProjectDto) {
    return this.projects.update(ctx.companyId!, id, dto);
  }

  @RequirePermission('project.manage')
  @Audit('project:member:add', 'project_member')
  @Post(':id/members')
  addMember(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveMemberDto) {
    return this.projects.addMember(ctx.companyId!, id, dto);
  }

  @RequirePermission('project.manage')
  @Audit('project:member:update', 'project_member')
  @Patch(':id/members/:memberId')
  updateMember(
    @TenantCtx() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SaveMemberDto,
  ) {
    return this.projects.updateMember(ctx.companyId!, id, memberId, dto);
  }

  @RequirePermission('project.manage')
  @Audit('project:member:remove', 'project_member')
  @Delete(':id/members/:memberId')
  removeMember(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.projects.removeMember(ctx.companyId!, id, memberId);
  }
}
