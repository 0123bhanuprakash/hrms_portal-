import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, CurrentAccess, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { companyOf } from '../user-management/company-context';
import { DelegationsService } from './delegations.service';
import { CreateDelegationDto } from './dto';

// ============================================================
// Approval delegation
// GET    /delegations        mine: given + received (+ what I can delegate)
// GET    /delegations/all    every current / upcoming one (user.view)
// POST   /delegations        hand over my approvals (admins: someone else's)
// DELETE /delegations/:id    end early (delegator, delegate or admin)
// ============================================================

@ApiTags('Delegations')
@ApiBearerAuth()
@Controller('delegations')
export class DelegationsController {
  constructor(private readonly delegations: DelegationsService) {}

  @Get()
  @ApiOperation({ summary: "Approvals I've delegated and approvals I'm covering" })
  mine(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.delegations.mine(companyOf(ctx), access.userId);
  }

  @Get('all')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'All current and upcoming delegations in the company' })
  all(@TenantCtx() ctx: TenantContext) {
    return this.delegations.all(companyOf(ctx));
  }

  @Post()
  @Audit('delegation:create', 'delegation')
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CreateDelegationDto) {
    return this.delegations.create(companyOf(ctx), access, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Audit('delegation:revoke', 'delegation')
  revoke(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.delegations.revoke(companyOf(ctx), access, id);
  }
}
