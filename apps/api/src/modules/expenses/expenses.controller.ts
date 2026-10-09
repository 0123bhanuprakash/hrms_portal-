import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import { holds, type AccessContext } from '../access/access.types';
import { ExpenseCategoriesService } from './categories.service';
import { ExpenseClaimsService } from './claims.service';
import { BulkApproveDto, ClaimQueryDto, CommentDto, DecideClaimDto, PayClaimDto, RejectClaimDto, ReportQueryDto, SaveCategoryDto, SaveClaimDto, SaveItemDto, BreakdownQueryDto } from './dto';
import { Live } from '../realtime/live.decorator';

const receipt = FileInterceptor('receipt', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

@RequireFeature('ops.expenses')
@Live('expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly categories: ExpenseCategoriesService,
    private readonly claims: ExpenseClaimsService,
  ) {}

  // ─── Categories ────────────────────────────────────────────

  @RequirePermission('expense.view')
  @Get('categories')
  listCategories(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query('all') all?: string) {
    return this.categories.list(ctx.companyId!, all === 'true' && holds(access, 'expense.manage'));
  }

  @RequirePermission('expense.manage')
  @Audit('expense:category:create', 'expense_category')
  @Post('categories')
  createCategory(@TenantCtx() ctx: TenantContext, @Body() dto: SaveCategoryDto) {
    return this.categories.save(ctx.companyId!, null, dto);
  }

  @RequirePermission('expense.manage')
  @Audit('expense:category:update', 'expense_category')
  @Patch('categories/:id')
  updateCategory(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveCategoryDto) {
    return this.categories.save(ctx.companyId!, id, dto);
  }

  // ─── Reports (Finance / HR) ────────────────────────────────

  @RequirePermission('expense.view')
  @Get('report')
  report(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: ReportQueryDto) {
    return this.claims.report(ctx.companyId!, access, q);
  }

  /** One breakdown of the report (person, project…), a page at a time ("See all"). */
  @RequirePermission('expense.view')
  @Get('report/breakdown')
  breakdown(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: BreakdownQueryDto) {
    return this.claims.breakdown(ctx.companyId!, access, q);
  }

  @RequirePermission('expense.view')
  @Audit('expense:export', 'expense_claim')
  @Get('export')
  async export(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: ReportQueryDto) {
    const csv = await this.claims.exportCsv(ctx.companyId!, access, q);
    return new StreamableFile(Buffer.from('﻿' + csv, 'utf8'), { type: 'text/csv; charset=utf-8', disposition: `attachment; filename="expenses-${q.from}-to-${q.to}.csv"` });
  }

  // ─── Claims ────────────────────────────────────────────────

  /** view=mine | review | all | payable */
  @RequirePermission('expense.view')
  @Get('claims')
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: ClaimQueryDto) {
    return this.claims.list(ctx.companyId!, access, q);
  }

  @Get('claims/pending-count')
  async pendingCount(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return { count: await this.claims.pendingCount(ctx.companyId!, access) };
  }

  /** My numbers for the My expenses page */
  @RequirePermission('expense.submit')
  @Get('claims/summary')
  summary(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.claims.summary(ctx.companyId!, access);
  }

  /** Approve several claims at my step — checked per claim. */
  @Audit('expense:claim:approve', 'expense_claim')
  @Post('claims/approve-bulk')
  @HttpCode(HttpStatus.OK)
  bulkApprove(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: BulkApproveDto) {
    return this.claims.bulkApprove(ctx.companyId!, access, dto.ids);
  }

  @RequirePermission('expense.submit')
  @Audit('expense:claim:create', 'expense_claim')
  @Post('claims')
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveClaimDto) {
    return this.claims.create(ctx.companyId!, access, dto);
  }

  @Get('claims/:id')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.get(ctx.companyId!, access, id);
  }

  @RequirePermission('expense.submit')
  @Patch('claims/:id')
  update(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveClaimDto) {
    return this.claims.update(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('expense.submit')
  @UseInterceptors(receipt)
  @Post('claims/:id/items')
  addItem(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveItemDto, @UploadedFile() file?: Express.Multer.File) {
    return this.claims.addItem(ctx.companyId!, access, id, dto, file);
  }

  @RequirePermission('expense.submit')
  @UseInterceptors(receipt)
  @Patch('claims/:id/items/:itemId')
  updateItem(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: SaveItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.claims.updateItem(ctx.companyId!, access, id, itemId, dto, file);
  }

  @RequirePermission('expense.submit')
  @Delete('claims/:id/items/:itemId')
  removeItem(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.claims.removeItem(ctx.companyId!, access, id, itemId);
  }

  @Get('claims/:id/items/:itemId/receipt')
  async receipt(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string): Promise<StreamableFile> {
    const f = await this.claims.openReceipt(ctx.companyId!, access, id, itemId);
    return new StreamableFile(f.stream, { type: f.mime, length: f.size, disposition: `inline; filename="${f.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  }

  @RequirePermission('expense.submit')
  @Audit('expense:claim:submit', 'expense_claim')
  @Post('claims/:id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.submit(ctx.companyId!, access, id);
  }

  /** Manager (project lead / PM / line manager), Finance or HR — checked per claim. */
  @Audit('expense:claim:approve', 'expense_claim')
  @Post('claims/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideClaimDto) {
    return this.claims.approve(ctx.companyId!, access, id, dto);
  }

  @Audit('expense:claim:reject', 'expense_claim')
  @Post('claims/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectClaimDto) {
    return this.claims.reject(ctx.companyId!, access, id, dto);
  }

  /** Whoever can decide the current step asks a question (claim stays with them). */
  @Post('claims/:id/questions')
  @HttpCode(HttpStatus.OK)
  ask(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto) {
    return this.claims.ask(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('expense.submit')
  @Post('claims/:id/replies')
  @HttpCode(HttpStatus.OK)
  reply(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto) {
    return this.claims.reply(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('expense.submit')
  @Audit('expense:claim:create', 'expense_claim')
  @Post('claims/:id/copy')
  copy(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.copy(ctx.companyId!, access, id);
  }

  @Audit('expense:claim:cancel', 'expense_claim')
  @Post('claims/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.cancel(ctx.companyId!, access, id);
  }

  @RequirePermission('expense.finance')
  @Audit('expense:claim:pay', 'expense_claim')
  @Post('claims/:id/pay')
  @HttpCode(HttpStatus.OK)
  pay(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayClaimDto) {
    return this.claims.pay(ctx.companyId!, access, id, dto);
  }
}
