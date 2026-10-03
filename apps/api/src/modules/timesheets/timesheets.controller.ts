import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { TimesheetsService } from './timesheets.service';
import { ComplianceQueryDto, DecideDto, RejectDto, ReportQueryDto, SaveWeekDto, TimesheetQueryDto, WeekQueryDto } from './dto';

@RequireFeature('work.timesheets')
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  /** view=mine | review | team. Approvers come from projects, so review needs no permission. */
  @Get()
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: TimesheetQueryDto) {
    return this.timesheets.list(ctx.companyId!, access, q);
  }

  @Get('pending-count')
  async pending(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return { count: await this.timesheets.pendingCount(ctx.companyId!, access) };
  }

  @RequirePermission('timesheet.view')
  @Get('compliance')
  compliance(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: ComplianceQueryDto) {
    return this.timesheets.compliance(ctx.companyId!, access, q);
  }

  @RequirePermission('timesheet.view')
  @Get('report')
  report(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: ReportQueryDto) {
    return this.timesheets.report(ctx.companyId!, access, q);
  }

  @Get('weeks/:weekStart')
  week(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('weekStart') weekStart: string, @Query() q: WeekQueryDto) {
    return this.timesheets.week(ctx.companyId!, access, weekStart, q);
  }

  @RequirePermission('timesheet.submit')
  @Put('weeks/:weekStart')
  save(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('weekStart') weekStart: string, @Body() dto: SaveWeekDto) {
    return this.timesheets.save(ctx.companyId!, access, weekStart, dto);
  }

  @RequirePermission('timesheet.submit')
  @Audit('timesheet:submit', 'timesheet')
  @Post('weeks/:weekStart/submit')
  @HttpCode(HttpStatus.OK)
  submit(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('weekStart') weekStart: string) {
    return this.timesheets.submit(ctx.companyId!, access, weekStart);
  }

  @RequirePermission('timesheet.submit')
  @Post('weeks/:weekStart/recall')
  @HttpCode(HttpStatus.OK)
  recall(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('weekStart') weekStart: string) {
    return this.timesheets.recall(ctx.companyId!, access, weekStart);
  }

  @Audit('timesheet:approve', 'timesheet')
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto) {
    return this.timesheets.approve(ctx.companyId!, access, id, dto);
  }

  @Audit('timesheet:reject', 'timesheet')
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.timesheets.reject(ctx.companyId!, access, id, dto);
  }
}
