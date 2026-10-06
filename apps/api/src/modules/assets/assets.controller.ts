import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import { holds, type AccessContext } from '../access/access.types';
import { AssetTypesService } from './asset-types.service';
import { AssetsService } from './assets.service';
import { AssetRequestsService } from './asset-requests.service';
import { AssetKitsService } from './asset-kits.service';
import { AssetChecksService } from './asset-checks.service';
import {
  AssetQueryDto,
  AssignAssetDto,
  BulkMoveDto,
  CheckAnswersDto,
  CreateRequestDto,
  DecideRequestDto,
  ImportAssetsDto,
  KitPreviewQueryDto,
  PeopleQueryDto,
  RejectRequestDto,
  ReportProblemDto,
  RequestPreviewQueryDto,
  RequestQueryDto,
  ReturnAssetDto,
  ReturnRequestDto,
  SaveAssetDto,
  SaveAssetTypeDto,
  SaveKitRuleDto,
  SetStatusDto,
  StartCheckDto,
} from './dto';
import { Live } from '../realtime/live.decorator';

const document = FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

@RequireFeature('ops.assets')
@Live('assets')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly types: AssetTypesService,
    private readonly assets: AssetsService,
    private readonly requests: AssetRequestsService,
    private readonly kits: AssetKitsService,
    private readonly checks: AssetChecksService,
  ) {}

  // ─── Types ─────────────────────────────────────────────────

  @RequirePermission('asset.view')
  @Get('types')
  listTypes(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query('all') all?: string) {
    return this.types.list(ctx.companyId!, all === 'true' && holds(access, 'asset.manage'));
  }

  /** "Request something": requestable types with what's in stock */
  @RequirePermission('asset.request')
  @Get('types/catalog')
  catalog(@TenantCtx() ctx: TenantContext) {
    return this.types.catalog(ctx.companyId!);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:type:create', 'asset_type')
  @Post('types')
  createType(@TenantCtx() ctx: TenantContext, @Body() dto: SaveAssetTypeDto) {
    return this.types.save(ctx.companyId!, null, dto);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:type:update', 'asset_type')
  @Patch('types/:id')
  updateType(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveAssetTypeDto) {
    return this.types.save(ctx.companyId!, id, dto);
  }

  // ─── Starter kits ──────────────────────────────────────────

  @RequirePermission('asset.manage')
  @Get('kits')
  listKits(@TenantCtx() ctx: TenantContext) {
    return this.kits.list(ctx.companyId!);
  }

  /** What a new employee with these details would get (add-employee form). */
  @RequirePermission('asset.view')
  @Get('kits/preview')
  previewKit(@TenantCtx() ctx: TenantContext, @Query() q: KitPreviewQueryDto) {
    return this.kits.preview(ctx.companyId!, q);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:kit:create', 'starter_kit_rule')
  @Post('kits')
  createKit(@TenantCtx() ctx: TenantContext, @Body() dto: SaveKitRuleDto) {
    return this.kits.save(ctx.companyId!, null, dto);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:kit:update', 'starter_kit_rule')
  @Patch('kits/:id')
  updateKit(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveKitRuleDto) {
    return this.kits.save(ctx.companyId!, id, dto);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:kit:delete', 'starter_kit_rule')
  @Delete('kits/:id')
  removeKit(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.kits.remove(ctx.companyId!, id);
  }

  // ─── Requests ──────────────────────────────────────────────

  @RequirePermission('asset.request')
  @Audit('asset:request:create', 'asset_request')
  @Post('requests')
  request(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CreateRequestDto) {
    return this.requests.create(ctx.companyId!, access, dto);
  }

  /** view=mine | review | all | fulfil | joiners */
  @RequirePermission('asset.view')
  @Get('requests')
  listRequests(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RequestQueryDto) {
    return this.requests.list(ctx.companyId!, access, q);
  }

  @Get('requests/pending-count')
  async pendingRequests(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return { count: await this.requests.pendingCount(ctx.companyId!, access) };
  }

  /** Who will approve (and who in my team I can ask for) */
  @RequirePermission('asset.request')
  @Get('requests/preview')
  previewRequest(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RequestPreviewQueryDto) {
    return this.requests.preview(ctx.companyId!, access, q.forEmployeeId);
  }

  @RequirePermission('asset.view')
  @Get('requests/:id')
  getRequest(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.get(ctx.companyId!, access, id);
  }

  /** Best available assets for a request (hand-over) */
  @RequirePermission('asset.manage')
  @Get('requests/:id/matches')
  matches(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.matches(ctx.companyId!, access, id);
  }

  @Audit('asset:request:approve', 'asset_request')
  @Post('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideRequestDto) {
    return this.requests.approve(ctx.companyId!, access, id, dto);
  }

  @Audit('asset:request:reject', 'asset_request')
  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectRequestDto) {
    return this.requests.reject(ctx.companyId!, access, id, dto);
  }

  @Audit('asset:request:cancel', 'asset_request')
  @Post('requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.cancel(ctx.companyId!, access, id);
  }

  // ─── Returns & yearly check ────────────────────────────────

  @RequirePermission('asset.view')
  @Get('returns')
  returns(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.checks.returns(ctx.companyId!, access);
  }

  @RequirePermission('asset.view')
  @Get('checks')
  checksOverview(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.checks.overview(ctx.companyId!, access);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:check:start', 'asset_check')
  @Post('checks')
  startCheck(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: StartCheckDto) {
    return this.checks.start(ctx.companyId!, access, dto);
  }

  @RequirePermission('asset.view')
  @Get('checks/mine')
  myCheck(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.checks.mine(ctx.companyId!, access);
  }

  @RequirePermission('asset.view')
  @Post('checks/answers')
  @HttpCode(HttpStatus.OK)
  answerCheck(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CheckAnswersDto) {
    return this.checks.answer(ctx.companyId!, access, dto);
  }

  @RequirePermission('asset.manage')
  @Post('checks/:id/remind')
  @HttpCode(HttpStatus.OK)
  remindCheck(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.checks.remind(ctx.companyId!, access, id);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:check:close', 'asset_check')
  @Post('checks/:id/close')
  @HttpCode(HttpStatus.OK)
  closeCheck(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.checks.close(ctx.companyId!, access, id);
  }

  // ─── Mine / per employee / summary ─────────────────────────

  @RequirePermission('asset.view')
  @Get('mine')
  mine(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.assets.mine(ctx.companyId!, access);
  }

  @RequirePermission('asset.view')
  @Post('assignments/:id/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.acknowledge(ctx.companyId!, access, id);
  }

  /** Something's wrong → an IT ticket linked to the asset */
  @RequirePermission('asset.view')
  @Post('assignments/:id/problem')
  @HttpCode(HttpStatus.OK)
  problem(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportProblemDto) {
    return this.assets.reportProblem(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('asset.view')
  @Post('assignments/:id/return-request')
  @HttpCode(HttpStatus.OK)
  returnRequest(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnRequestDto) {
    return this.assets.requestReturn(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('asset.view')
  @Get('employee/:employeeId')
  forEmployee(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.assets.forEmployee(ctx.companyId!, access, employeeId);
  }

  @RequirePermission('asset.view')
  @Get('summary')
  summary(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.assets.summary(ctx.companyId!, access);
  }

  // ─── Register ──────────────────────────────────────────────

  @RequirePermission('asset.view')
  @Get()
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: AssetQueryDto) {
    return this.assets.list(ctx.companyId!, access, q);
  }

  /** Register "By person" */
  @RequirePermission('asset.view')
  @Get('people')
  people(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: PeopleQueryDto) {
    return this.assets.byPerson(ctx.companyId!, access, q);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:create', 'asset')
  @Post()
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveAssetDto) {
    return this.assets.create(ctx.companyId!, access, dto);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:import', 'asset')
  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: ImportAssetsDto) {
    return this.assets.importCsv(ctx.companyId!, access, dto);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:move', 'asset')
  @Post('bulk/move')
  @HttpCode(HttpStatus.OK)
  bulkMove(@TenantCtx() ctx: TenantContext, @Body() dto: BulkMoveDto) {
    return this.assets.bulkMove(ctx.companyId!, dto);
  }

  @RequirePermission('asset.view')
  @Get(':id')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.get(ctx.companyId!, access, id);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:update', 'asset')
  @Patch(':id')
  update(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveAssetDto) {
    return this.assets.update(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:assign', 'asset')
  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  assign(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignAssetDto) {
    return this.assets.assign(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:return', 'asset')
  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  returnAsset(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnAssetDto) {
    return this.assets.returnAsset(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('asset.manage')
  @Audit('asset:status', 'asset')
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  status(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetStatusDto) {
    return this.assets.setStatus(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('asset.manage')
  @UseInterceptors(document)
  @Post(':id/documents')
  addDocument(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.assets.addDocument(ctx.companyId!, access, id, file);
  }

  @RequirePermission('asset.view')
  @Get(':id/documents/:docId')
  async openDocument(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string): Promise<StreamableFile> {
    const f = await this.assets.openDocument(ctx.companyId!, access, id, docId);
    return new StreamableFile(f.stream, { type: f.mime, length: f.size, disposition: `inline; filename="${f.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  }

  @RequirePermission('asset.manage')
  @Delete(':id/documents/:docId')
  removeDocument(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.assets.removeDocument(ctx.companyId!, access, id, docId);
  }
}
