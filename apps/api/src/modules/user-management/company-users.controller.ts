import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { companyOf } from './company-context';
import { CompanyUsersService } from './company-users.service';
import { BulkUsersDto, InviteManyDto, InviteUserDto, PreviewRolesDto, QueryCompanyUsersDto, SetUserRolesDto, UpdateCompanyUserDto, UserStatusDto } from './dto';
import { LiveAccess } from '../realtime/live.decorator';

// ============================================================
// Company Admin → Users  (/company/users)
// GET   /                       list (search, role, status incl. INVITED)
// GET   /:id                    detail
// POST  /                       invite (temporary password email)
// PATCH /:id                    edit name
// PUT   /:id/roles              replace roles (≥ 1)
// PATCH /:id/status             activate / deactivate (signs out everywhere)
// POST  /:id/resend-invite      new temporary password (never signed in)
// POST  /:id/reset-password     email a reset link
// ============================================================

@ApiTags('Users')
@ApiBearerAuth()
@RequireFeature('admin.users')
@LiveAccess('user')
@Controller('company/users')
export class CompanyUsersController {
  constructor(private readonly users: CompanyUsersService) {}

  @Get()
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'List the users of your company' })
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: QueryCompanyUsersDto) {
    return this.users.list(companyOf(ctx), query, access);
  }

  @Get('insights')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Counts and "needs a look" items for the Users page' })
  insights(@TenantCtx() ctx: TenantContext) {
    return this.users.insights(companyOf(ctx));
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user.view')
  @Audit('user:bulk', 'user')
  bulk(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: BulkUsersDto) {
    return this.users.bulk(companyOf(ctx), access, dto);
  }

  @Post('invite-many')
  @RequirePermission('user.invite')
  @Audit('user:invite:many', 'user')
  inviteMany(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: InviteManyDto) {
    return this.users.inviteMany(companyOf(ctx), access, dto.emails, dto.roleIds);
  }

  @Post(':id/roles/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user.view')
  preview(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PreviewRolesDto) {
    return this.users.previewRoles(companyOf(ctx), id, dto.roleIds);
  }

  @Get(':id/history')
  @RequirePermission('user.view')
  history(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.history(companyOf(ctx), id);
  }

  @Get(':id')
  @RequirePermission('user.view')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(companyOf(ctx), id, access);
  }

  @Post()
  @RequirePermission('user.invite')
  @Audit('user:invite', 'user')
  invite(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: InviteUserDto) {
    return this.users.invite(companyOf(ctx), access, dto);
  }

  @Patch(':id')
  @RequirePermission('user.edit')
  @Audit('user:update', 'user')
  update(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyUserDto,
  ) {
    return this.users.update(companyOf(ctx), id, access, dto);
  }

  @Put(':id/roles')
  @RequirePermission('user.assign_roles')
  @Audit('user:roles:update', 'user')
  setRoles(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
  ) {
    return this.users.setRoles(companyOf(ctx), id, access, dto.roleIds);
  }

  @Patch(':id/status')
  @RequirePermission('user.deactivate')
  @Audit('user:status:update', 'user')
  setStatus(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UserStatusDto,
  ) {
    return this.users.setStatus(companyOf(ctx), id, access, dto.status);
  }

  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user.invite')
  @Audit('user:invite:resend', 'user')
  resendInvite(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.resendInvite(companyOf(ctx), id, access);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('user.edit')
  @Audit('user:password:reset', 'user')
  resetPassword(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.sendPasswordReset(companyOf(ctx), id);
  }
}
