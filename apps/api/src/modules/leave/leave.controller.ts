import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { holds } from '../access/access.types';
import { LeaveTypesService } from './leave-types.service';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveRequestsService } from './leave-requests.service';
import {
  AdjustBalanceDto,
  AskQuestionDto,
  BalanceQueryDto,
  CancelLeaveDto,
  CreateLeaveRequestDto,
  DecideLeaveDto,
  LeaveCalendarQueryDto,
  LeaveListQueryDto,
  LeaveRequestInputDto,
  SaveLeaveTypeDto,
  YearQueryDto,
} from './dto';
import { Live } from '../realtime/live.decorator';

const document = FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

@RequireFeature('time.leave')
@Live('leave')
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

  @RequirePermission('leave.manage_types')
  @Get('types/usage')
  usage(@TenantCtx() ctx: TenantContext, @Query() query: YearQueryDto) {
    return this.balances.usage(ctx.companyId!, query.year ?? new Date().getUTCFullYear());
  }

  /** What everyone would carry over / lose on 31 Dec for one type. */
  @RequirePermission('leave.manage_types')
  @Get('types/:id/year-end')
  yearEnd(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Query() query: YearQueryDto) {
    return this.balances.yearEndPreview(ctx.companyId!, id, query.year ?? new Date().getUTCFullYear());
  }

  @RequirePermission('leave.manage_types')
  @Audit('leave:lapse:remind', 'leave_type')
  @Post('types/:id/year-end/remind')
  @HttpCode(HttpStatus.OK)
  remindLapse(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Query() query: YearQueryDto) {
    return this.balances.remindLapse(ctx.companyId!, id, query.year ?? new Date().getUTCFullYear());
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

  /** The person attaches a supporting document (e.g. doctor's note). */
  @RequirePermission('leave.request')
  @Audit('leave:request:document', 'leave_request')
  @UseInterceptors(document)
  @Post('requests/:id/document')
  addDocument(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.requests.addDocument(ctx.companyId!, access, id, file);
  }

  @Get('requests/:id/document')
  async openDocument(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const f = await this.requests.openDocument(ctx.companyId!, access, id);
    return new StreamableFile(f.stream, { type: f.mime, length: f.size, disposition: `inline; filename="${f.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  }

  /** An approver asks the person something; the request stays pending. */
  @Audit('leave:request:question', 'leave_request')
  @Post('requests/:id/question')
  @HttpCode(HttpStatus.OK)
  ask(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AskQuestionDto) {
    return this.requests.ask(ctx.companyId!, access, id, dto);
  }

  // Who may decide is checked per request (project leads, line manager, delegates, HR)
  @Audit('leave:request:approve', 'leave_request')
  @Post('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveDto) {
    return this.requests.approve(ctx.companyId!, access, id, dto);
  }

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
