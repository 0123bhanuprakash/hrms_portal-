import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { holds } from '../access/access.types';
import { LeaveTypesService, publicType } from './leave-types.service';
import { LeaveGrantsService } from './leave-grants.service';
import { ExtraLeaveService } from './extra-leave.service';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveRequestsService } from './leave-requests.service';
import {
  AdjustBalanceDto,
  AskExtraDto,
  DecideExtraDto,
  ExtraListQueryDto,
  LedgerQueryDto,
  LendGiveDto,
  OwedQueryDto,
  WaiveDto,
  ApproveGrantRequestDto,
  CreateGrantDto,
  CreateGrantRequestDto,
  EligibilityPreviewDto,
  GrantListQueryDto,
  GrantRequestListQueryDto,
  RejectGrantRequestDto,
  RevokeGrantDto,
  UpdateGrantDto,
  AskQuestionDto,
  LeaveReplyDto,
  CancelRequestDto,
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
import { Live, NoLive } from '../realtime/live.decorator';

const document = FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

type OpenedFile = { stream: NodeJS.ReadableStream & import('stream').Readable; name: string; mime: string; size?: number };
const inline = (f: OpenedFile) => new StreamableFile(f.stream, { type: f.mime, length: f.size, disposition: `inline; filename="${f.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(f.name)}` });

@RequireFeature('time.leave')
@Live('leave')
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly types: LeaveTypesService,
    private readonly balances: LeaveBalancesService,
    private readonly requests: LeaveRequestsService,
    private readonly grants: LeaveGrantsService,
    private readonly extra: ExtraLeaveService,
  ) {}

  // ─── Types ─────────────────────────────────────────────────

  @RequirePermission('leave.view')
  @Get('types')
  async listTypes(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query('all') all?: string) {
    const admin = holds(access, 'leave.manage_types');
    const types = await this.types.list(ctx.companyId!, all === 'true' && admin);
    // The rules and named people are for leave admins only
    return admin ? types : types.map(publicType);
  }

  /** How many people draft rules cover (the leave type form). */
  @RequirePermission('leave.manage_types')
  @NoLive()
  @Post('types/eligible-preview')
  @HttpCode(HttpStatus.OK)
  eligiblePreview(@TenantCtx() ctx: TenantContext, @Body() dto: EligibilityPreviewDto) {
    return this.grants.preview(ctx.companyId!, dto);
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

  // leave.adjust_balance — or leave.extra_decide for lending / giving extra (checked in the service)
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

  /** Cancel what someone owes (earlier years, or this year's minus balance). */
  @Audit('leave:balance:waive', 'leave_balance')
  @Post('balances/:id/waive')
  @HttpCode(HttpStatus.OK)
  waive(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WaiveDto) {
    return this.balances.waive(ctx.companyId!, access, id, dto);
  }

  /** One person's leave statement for a type and year. */
  @RequirePermission('leave.view')
  @Get('ledger')
  ledger(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: LedgerQueryDto) {
    return this.balances.ledger(ctx.companyId!, access, query);
  }

  /** Who owes days / will at year end (lend / give or adjust permission). */
  @Get('owed')
  owed(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: OwedQueryDto) {
    return this.balances.owed(ctx.companyId!, access, query);
  }

  // ─── Asking for more days (lend / give extra) ──────────────

  @RequirePermission('leave.extra_request')
  @Audit('leave:extra:ask', 'extra_leave_request')
  @Post('extra-requests')
  askExtra(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: AskExtraDto) {
    return this.extra.ask(ctx.companyId!, access, dto);
  }

  /** mine = what I asked for; decide = waiting for me */
  @Get('extra-requests')
  listExtra(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: ExtraListQueryDto) {
    return this.extra.list(ctx.companyId!, access, query);
  }

  @RequirePermission('leave.extra_decide')
  @Audit('leave:extra:decide', 'extra_leave_request')
  @Post('extra-requests/:id/decide')
  @HttpCode(HttpStatus.OK)
  decideExtra(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideExtraDto) {
    return this.extra.decide(ctx.companyId!, access, id, dto);
  }

  @Audit('leave:extra:cancel', 'extra_leave_request')
  @Post('extra-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelExtra(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.extra.cancel(ctx.companyId!, access, id);
  }

  /** Lend / give without a request (checked in the service: extra_decide or adjust_balance). */
  @Audit('leave:extra:lend-give', 'leave_balance')
  @Post('extra/lend-give')
  @HttpCode(HttpStatus.OK)
  lendOrGive(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: LendGiveDto) {
    return this.extra.lendOrGive(ctx.companyId!, access, dto);
  }

  // ─── Grants (HR gives "only when granted" leave) ────────────

  @RequirePermission('leave.view')
  @Get('grants')
  listGrants(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: GrantListQueryDto) {
    return this.grants.list(ctx.companyId!, access, query);
  }

  @RequirePermission('leave.adjust_balance')
  @Audit('leave:grant:create', 'leave_grant')
  @UseInterceptors(document)
  @Post('grants')
  createGrant(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CreateGrantDto, @UploadedFile() file?: Express.Multer.File) {
    return this.grants.create(ctx.companyId!, access, dto, file);
  }

  @RequirePermission('leave.adjust_balance')
  @Audit('leave:grant:update', 'leave_grant')
  @Patch('grants/:id')
  updateGrant(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGrantDto) {
    return this.grants.update(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('leave.adjust_balance')
  @Audit('leave:grant:revoke', 'leave_grant')
  @Post('grants/:id/revoke')
  @HttpCode(HttpStatus.OK)
  revokeGrant(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevokeGrantDto) {
    return this.grants.revoke(ctx.companyId!, access, id, dto);
  }

  @Get('grants/:id/document')
  async grantDocument(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    return inline(await this.grants.openGrantDocument(ctx.companyId!, access, id));
  }

  /** mine = what I asked for; review = waiting for HR */
  @Get('grant-requests')
  listGrantRequests(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: GrantRequestListQueryDto) {
    return this.grants.listRequests(ctx.companyId!, access, query);
  }

  @RequirePermission('leave.request')
  @Audit('leave:grant-request:create', 'leave_grant_request')
  @UseInterceptors(document)
  @Post('grant-requests')
  askForGrant(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CreateGrantRequestDto, @UploadedFile() file?: Express.Multer.File) {
    return this.grants.createRequest(ctx.companyId!, access, dto, file);
  }

  @RequirePermission('leave.adjust_balance')
  @Audit('leave:grant-request:approve', 'leave_grant_request')
  @Post('grant-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveGrantRequest(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveGrantRequestDto) {
    return this.grants.approveRequest(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('leave.adjust_balance')
  @Audit('leave:grant-request:reject', 'leave_grant_request')
  @Post('grant-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectGrantRequest(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectGrantRequestDto) {
    return this.grants.rejectRequest(ctx.companyId!, access, id, dto);
  }

  @Audit('leave:grant-request:cancel', 'leave_grant_request')
  @Post('grant-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelGrantRequest(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.grants.cancelRequest(ctx.companyId!, access, id);
  }

  @Get('grant-requests/:id/document')
  async grantRequestDocument(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    return inline(await this.grants.openRequestDocument(ctx.companyId!, access, id));
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

  /** Approved leave that has started: the person asks to cancel it (or to end it early). */
  @Audit('leave:request:cancel-request', 'leave_request')
  @Post('requests/:id/cancel-request')
  @HttpCode(HttpStatus.OK)
  requestCancel(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelRequestDto) {
    return this.requests.requestCancel(ctx.companyId!, access, id, dto);
  }

  /** The person takes their cancellation request back. */
  @Audit('leave:request:cancel-request-withdraw', 'leave_request')
  @Post('requests/:id/cancel-request/withdraw')
  @HttpCode(HttpStatus.OK)
  withdrawCancel(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.withdrawCancel(ctx.companyId!, access, id);
  }

  /** Whoever approved the leave (or HR) agrees to the cancellation — the days go back. */
  @Audit('leave:request:cancel-approve', 'leave_request')
  @Post('requests/:id/cancel-request/approve')
  @HttpCode(HttpStatus.OK)
  approveCancel(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveDto) {
    return this.requests.decideCancel(ctx.companyId!, access, id, true, dto);
  }

  @Audit('leave:request:cancel-reject', 'leave_request')
  @Post('requests/:id/cancel-request/reject')
  @HttpCode(HttpStatus.OK)
  rejectCancel(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveDto) {
    return this.requests.decideCancel(ctx.companyId!, access, id, false, dto);
  }

  /** The person answers the approver's question (their own pending request). */
  @Audit('leave:request:reply', 'leave_request')
  @Post('requests/:id/reply')
  @HttpCode(HttpStatus.OK)
  reply(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveReplyDto) {
    return this.requests.reply(ctx.companyId!, access, id, dto);
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
