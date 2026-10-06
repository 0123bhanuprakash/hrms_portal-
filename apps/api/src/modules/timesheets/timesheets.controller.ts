import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { TimesheetsService } from './timesheets.service';
import { ApproveBlocksDto, BlockDto, CalendarQueryDto, ComplianceQueryDto, CopyDayDto, RecallDto, SendBackDto, SubmitDto, SubmitPreviewQueryDto, TeamQueryDto, TimesheetQueryDto } from './dto';
import { Live } from '../realtime/live.decorator';

@RequireFeature('work.timesheets')
@Live('timesheets')
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  /** Week rows (view=mine | team) — e.g. weeks sent back. */
  @Get()
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: TimesheetQueryDto) {
    return this.timesheets.list(ctx.companyId!, access, q);
  }

  /** Approvers come from projects, so this needs no permission. */
  @Get('pending-count')
  async pending(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return { count: await this.timesheets.pendingCount(ctx.companyId!, access) };
  }

  @RequirePermission('timesheet.view')
  @Get('compliance')
  compliance(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: ComplianceQueryDto) {
    return this.timesheets.compliance(ctx.companyId!, access, q);
  }

  /** One week of blocks, attendance, leave and my projects. */
  @Get('weeks/:weekStart')
  calendar(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('weekStart') weekStart: string, @Query() q: CalendarQueryDto) {
    return this.timesheets.calendar(ctx.companyId!, access, weekStart, q);
  }

  @RequirePermission('timesheet.submit')
  @Post('blocks')
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: BlockDto) {
    return this.timesheets.createBlock(ctx.companyId!, access, dto);
  }

  @RequirePermission('timesheet.submit')
  @Put('blocks/:id')
  update(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BlockDto) {
    return this.timesheets.updateBlock(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('timesheet.submit')
  @Delete('blocks/:id')
  remove(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.timesheets.deleteBlock(ctx.companyId!, access, id);
  }

  @RequirePermission('timesheet.submit')
  @Post('copy-day')
  @HttpCode(HttpStatus.OK)
  copyDay(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CopyDayDto) {
    return this.timesheets.copyDay(ctx.companyId!, access, dto);
  }

  @RequirePermission('timesheet.submit')
  @Get('submit-preview')
  preview(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: SubmitPreviewQueryDto) {
    return this.timesheets.submitPreview(ctx.companyId!, access, q.scope);
  }

  @RequirePermission('timesheet.submit')
  @Audit('timesheet:submit', 'timesheet')
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  submit(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SubmitDto) {
    return this.timesheets.submit(ctx.companyId!, access, dto);
  }

  @RequirePermission('timesheet.submit')
  @Post('recall')
  @HttpCode(HttpStatus.OK)
  recall(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: RecallDto) {
    return this.timesheets.recall(ctx.companyId!, access, dto);
  }

  /** People whose time I approve, as a people × days grid. */
  @Get('team')
  team(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: TeamQueryDto) {
    return this.timesheets.team(ctx.companyId!, access, q.weekStart);
  }

  @Audit('timesheet:approve', 'timesheet')
  @Post('approve')
  @HttpCode(HttpStatus.OK)
  approve(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: ApproveBlocksDto) {
    return this.timesheets.approve(ctx.companyId!, access, dto);
  }

  @Audit('timesheet:reject', 'timesheet')
  @Post('send-back')
  @HttpCode(HttpStatus.OK)
  sendBack(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SendBackDto) {
    return this.timesheets.sendBack(ctx.companyId!, access, dto);
  }

  @Post('nudge/:employeeId')
  @HttpCode(HttpStatus.OK)
  nudge(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.timesheets.nudge(ctx.companyId!, access, employeeId);
  }
}
