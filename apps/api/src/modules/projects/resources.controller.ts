import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { ResourceRequestsService } from './resources.service';
import { CandidatesQueryDto, ConsentDto, FillDto, HoldDto, NoteDto, RaiseReleaseDto, RaiseRequestDto, ReasonDto, ReleaseDecisionDto, RequestListQueryDto } from './resources.dto';

// Resource requests (Lead → PM → Delivery Director → PMO) and releases.
// Everyone may call these; the service checks the person's role on the
// project (lead, PM, Delivery Director) or the PMO permission.

@RequireFeature('work.projects')
@RequirePermission('project.view')
@Controller('resources')
export class ResourceRequestsController {
  constructor(private readonly resources: ResourceRequestsService) {}

  /** My roles on projects (which buttons and menu items to show). */
  @Get('context')
  context(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.resources.context(ctx.companyId!, access);
  }

  /** Inbox: waiting for me / on hold / raised by me / done. */
  @Get('requests')
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RequestListQueryDto) {
    return this.resources.list(ctx.companyId!, access, q);
  }

  /** Menu badge. */
  @Get('requests/count')
  count(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.resources.waitingCount(ctx.companyId!, access);
  }

  @Get('requests/:id')
  detail(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.resources.detail(ctx.companyId!, access, id);
  }

  @Get('requests/:id/candidates')
  candidates(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Query() q: CandidatesQueryDto) {
    return this.resources.candidates(ctx.companyId!, access, id, q);
  }

  @Audit('resource:request:raise', 'resource_request')
  @Post('requests')
  raise(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: RaiseRequestDto) {
    return this.resources.raise(ctx.companyId!, access, dto);
  }

  @Audit('resource:release:raise', 'resource_request')
  @Post('releases')
  raiseRelease(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: RaiseReleaseDto) {
    return this.resources.raiseRelease(ctx.companyId!, access, dto);
  }

  @Audit('resource:request:forward', 'resource_request')
  @Post('requests/:id/forward')
  @HttpCode(HttpStatus.OK)
  forward(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) {
    return this.resources.forward(ctx.companyId!, access, id, dto.note ?? null);
  }

  @Audit('resource:request:fill', 'resource_request')
  @Post('requests/:id/fill')
  @HttpCode(HttpStatus.OK)
  fill(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FillDto) {
    return this.resources.fill(ctx.companyId!, access, id, dto);
  }

  @Audit('resource:request:hold', 'resource_request')
  @Post('requests/:id/hold')
  @HttpCode(HttpStatus.OK)
  hold(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HoldDto) {
    return this.resources.hold(ctx.companyId!, access, id, dto);
  }

  @Audit('resource:request:unhold', 'resource_request')
  @Post('requests/:id/unhold')
  @HttpCode(HttpStatus.OK)
  unhold(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) {
    return this.resources.unhold(ctx.companyId!, access, id, dto.note ?? null);
  }

  @Audit('resource:request:reject', 'resource_request')
  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.resources.reject(ctx.companyId!, access, id, dto.reason);
  }

  @Audit('resource:request:withdraw', 'resource_request')
  @Post('requests/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  withdraw(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) {
    return this.resources.withdraw(ctx.companyId!, access, id, dto.note ?? null);
  }

  @Audit('resource:request:consent', 'resource_request')
  @Post('requests/:id/consent')
  @HttpCode(HttpStatus.OK)
  consent(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConsentDto) {
    return this.resources.consent(ctx.companyId!, access, id, dto);
  }

  @Audit('resource:release:decide', 'resource_request')
  @Post('requests/:id/release-decision')
  @HttpCode(HttpStatus.OK)
  decideRelease(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleaseDecisionDto) {
    return this.resources.decideRelease(ctx.companyId!, access, id, dto);
  }

  @Post('requests/:id/nudge')
  @HttpCode(HttpStatus.OK)
  nudge(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.resources.nudge(ctx.companyId!, access, id);
  }

  /** PMO pool: who is free now or soon. */
  @Get('pool')
  pool(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.resources.pool(ctx.companyId!, access);
  }

  /** Someone's assignment history. */
  @Get('history/:employeeId')
  history(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.resources.history(ctx.companyId!, access, employeeId);
  }

  /** Skills and technologies already used in the company. */
  @Get('skills')
  skills(@TenantCtx() ctx: TenantContext) {
    return this.resources.skillSuggestions(ctx.companyId!);
  }
}
