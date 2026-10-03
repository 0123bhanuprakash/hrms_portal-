import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import { holds, type AccessContext } from '../access/access.types';
import { AssetTypesService } from './asset-types.service';
import { AssetsService } from './assets.service';
import { AssetRequestsService } from './asset-requests.service';
import {
  AssetQueryDto,
  AssignAssetDto,
  CreateRequestDto,
  DecideRequestDto,
  RejectRequestDto,
  RequestQueryDto,
  ReturnAssetDto,
  SaveAssetDto,
  SaveAssetTypeDto,
  SetStatusDto,
} from './dto';

@RequireFeature('ops.assets')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly types: AssetTypesService,
    private readonly assets: AssetsService,
    private readonly requests: AssetRequestsService,
  ) {}

  // ─── Types ─────────────────────────────────────────────────

  @RequirePermission('asset.view')
  @Get('types')
  listTypes(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query('all') all?: string) {
    return this.types.list(ctx.companyId!, all === 'true' && holds(access, 'asset.manage'));
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

  // ─── Requests ──────────────────────────────────────────────

  @RequirePermission('asset.request')
  @Audit('asset:request:create', 'asset_request')
  @Post('requests')
  request(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CreateRequestDto) {
    return this.requests.create(ctx.companyId!, access, dto);
  }

  /** view=mine | review | all | fulfil */
  @RequirePermission('asset.view')
  @Get('requests')
  listRequests(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RequestQueryDto) {
    return this.requests.list(ctx.companyId!, access, q);
  }

  @Get('requests/pending-count')
  async pendingRequests(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return { count: await this.requests.pendingCount(ctx.companyId!, access) };
  }

  @RequirePermission('asset.view')
  @Get('requests/:id')
  getRequest(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.get(ctx.companyId!, access, id);
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

  @RequirePermission('asset.manage')
  @Audit('asset:create', 'asset')
  @Post()
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveAssetDto) {
    return this.assets.create(ctx.companyId!, access, dto);
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
}
