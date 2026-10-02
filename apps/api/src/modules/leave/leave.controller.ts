import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { holds } from '../access/access.types';
import { LeaveTypesService } from './leave-types.service';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveRequestsService } from './leave-requests.service';
import {
  AdjustBalanceDto,
  BalanceQueryDto,
  CancelLeaveDto,
  CreateLeaveRequestDto,
  DecideLeaveDto,
  LeaveCalendarQueryDto,
  LeaveListQueryDto,
  LeaveRequestInputDto,
  SaveLeaveTypeDto,
} from './dto';

@RequireFeature('time.leave')
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly types: LeaveTypesService,
    private readonly balances: LeaveBalancesService,
    private readonly requests: LeaveRequestsService,
  ) {}

  // ─── Types ─────────────────────────────────────────────────

  @RequirePermission('leave.view')
  @Get('types')
  listTypes(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query('all') all?: string) {
    return this.types.list(ctx.companyId!, all === 'true' && holds(access, 'leave.manage_types'));
  }

  @RequirePermission('leave.manage_types')
  @Audit('leave:type:create', 'leave_type')
  @Post('types')
  createType(@TenantCtx() ctx: TenantContext, @Body() dto: SaveLeaveTypeDto) {
    return this.types.create(ctx.companyId!, dto);
  }

  @RequirePermission('leave.manage_types')
  @Audit('leave:type:update', 'leave_type')
  @Patch('types/:id')
  updateType(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveLeaveTypeDto) {
    return this.types.update(ctx.companyId!, id, dto);
  }

  // ─── Balances ──────────────────────────────────────────────

  @RequirePermission('leave.view')
  @Get('balances')
  balancesFor(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: BalanceQueryDto) {
    return this.balances.summary(ctx.companyId!, access, query.employeeId, query.year ?? new Date().getUTCFullYear());
  }

  @RequirePermission('leave.adjust_balance')
  @Audit('leave:balance:adjust', 'leave_balance')
  @Post('balances/adjust')
  adjust(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: AdjustBalanceDto) {
    return this.balances.adjust(ctx.companyId!, access, dto);
  }

  @RequirePermission('leave.view')
  @Get('balances/:id/history')
  history(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.balances.history(ctx.companyId!, access, id);
  }

  // ─── Requests ──────────────────────────────────────────────

  @RequirePermission('leave.request')
  @Post('requests/preview')
  @HttpCode(HttpStatus.OK)
  preview(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: LeaveRequestInputDto) {
    return this.requests.preview(ctx.companyId!, access, dto);
  }

  @RequirePermission('leave.request')
  @Audit('leave:request:create', 'leave_request')
  @Post('requests')
  apply(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CreateLeaveRequestDto) {
    return this.requests.create(ctx.companyId!, access, dto);
  }

  /** view=mine | review (waiting for me) | all (everyone in my leave.view reach) */
  @Get('requests')
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: LeaveListQueryDto) {
    return this.requests.list(ctx.companyId!, access, query);
  }

  @Get('requests/pending-count')
  async pendingCount(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return { count: await this.requests.pendingCount(ctx.companyId!, access) };
  }

  @Get('requests/:id')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.getRow(ctx.companyId!, access, id);
  }

  @RequirePermission('leave.approve')
  @Audit('leave:request:approve', 'leave_request')
  @Post('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveDto) {
    return this.requests.approve(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('leave.approve')
  @Audit('leave:request:reject', 'leave_request')
  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveDto) {
    return this.requests.reject(ctx.companyId!, access, id, dto);
  }

  @Audit('leave:request:cancel', 'leave_request')
  @Post('requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelLeaveDto) {
    return this.requests.cancel(ctx.companyId!, access, id, dto);
  }

  // ─── Who's off ─────────────────────────────────────────────

  @RequirePermission('leave.view')
  @Get('calendar')
  calendar(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: LeaveCalendarQueryDto) {
    return this.requests.calendar(ctx.companyId!, access, query);
  }
}
