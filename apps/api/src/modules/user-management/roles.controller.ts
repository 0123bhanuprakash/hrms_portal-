import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { companyOf } from './company-context';
import { DuplicateRoleDto, RoleStatusDto, SaveRoleDto } from './dto';
import { RolesService } from './roles.service';

// ============================================================
// Company Admin → Roles & Permissions  (/company/roles)
// GET    /                 list (+ user & permission counts)
// GET    /:id              role + grants { key: scope }
// POST   /                 create
// PUT    /:id              update name / description / grants (owner role locked)
// POST   /:id/duplicate    copy
// PATCH  /:id/status       activate / deactivate (optionally move users)
// DELETE /:id              delete (no users, not the owner role)
// ============================================================

@ApiTags('Roles')
@ApiBearerAuth()
@RequireFeature('admin.users')
@Controller('company/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('role.view')
  @ApiOperation({ summary: 'List the roles of your company' })
  list(@TenantCtx() ctx: TenantContext) {
    return this.roles.list(companyOf(ctx));
  }

  @Get(':id')
  @RequirePermission('role.view')
  get(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.roles.get(companyOf(ctx), id);
  }

  @Post()
  @RequirePermission('role.manage')
  @Audit('role:create', 'role')
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveRoleDto) {
    return this.roles.create(companyOf(ctx), access, dto);
  }

  @Put(':id')
  @RequirePermission('role.manage')
  @Audit('role:update', 'role')
  update(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveRoleDto,
  ) {
    return this.roles.update(companyOf(ctx), access, id, dto);
  }

  @Post(':id/duplicate')
  @RequirePermission('role.manage')
  @Audit('role:duplicate', 'role')
  duplicate(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateRoleDto,
  ) {
    return this.roles.duplicate(companyOf(ctx), access, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('role.manage')
  @Audit('role:status:update', 'role')
  setStatus(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RoleStatusDto,
  ) {
    return this.roles.setStatus(companyOf(ctx), access, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('role.manage')
  @Audit('role:delete', 'role')
  remove(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(companyOf(ctx), id);
  }
}
