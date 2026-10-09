import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, CurrentAccess, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { companyOf } from '../user-management/company-context';
import { DelegationsService } from './delegations.service';
import { CreateDelegationDto, PageQueryDto, RangeQueryDto } from './dto';
import { CoverService } from './cover.service';
import { LiveAccess } from '../realtime/live.decorator';

// ============================================================
// Approval delegation
// GET    /delegations        mine: given + received (+ what I can delegate)
// GET    /delegations/all    every current / upcoming one (user.view)
// POST   /delegations        hand over my approvals (admins: someone else's)
// DELETE /delegations/:id    end early (delegator, delegate or admin)
// ============================================================

@ApiTags('Delegations')
@ApiBearerAuth()
@LiveAccess('caller')
@Controller('delegations')
export class DelegationsController {
  constructor(
    private readonly delegations: DelegationsService,
    private readonly cover: CoverService,
  ) {}

  @Get('away')
  @ApiOperation({ summary: 'My approved leave coming up, and whether someone covers it' })
  away(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.cover.myLeave(companyOf(ctx), access.userId);
  }

  @Get('suggest')
  @ApiOperation({ summary: 'Good covers for my approvals on these dates' })
  suggest(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RangeQueryDto) {
    return this.cover.suggest(companyOf(ctx), access.userId, q.from, q.to);
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Me and my team: leave and who covers' })
  timeline(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RangeQueryDto) {
    return this.cover.timeline(companyOf(ctx), access.userId, q.from, q.to);
  }

  @Get('recap')
  @ApiOperation({ summary: 'While you were away: what your cover decided' })
  recap(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.cover.recap(companyOf(ctx), access.userId);
  }

  @Get('gaps')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Approvers on leave in the next 30 days with nobody covering' })
  gaps(@TenantCtx() ctx: TenantContext) {
    return this.cover.gaps(companyOf(ctx));
  }

  @Get()
  @ApiOperation({ summary: "Approvals I've delegated and approvals I'm covering" })
  mine(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.delegations.mine(companyOf(ctx), access.userId);
  }

  @Get('all')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'All current and upcoming delegations in the company' })
  all(@TenantCtx() ctx: TenantContext, @Query() q: PageQueryDto) {
    return this.delegations.all(companyOf(ctx), q);
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
