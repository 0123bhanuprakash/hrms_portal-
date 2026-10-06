import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TicketQueue } from '@prisma/client';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { TicketCategoriesService } from './ticket-categories.service';
import { TicketsService } from './tickets.service';
import { HelpdeskTeamsService } from './teams.service';
import { AnswersQueryDto, AssignDto, BulkTicketsDto, CloseDto, CreateTicketDto, MessageDto, ReopenDto, ResolveDto, SaveCategoryDto, SaveTeamDto, ReorderCategoriesDto, SummaryQueryDto, TicketQueryDto, UpdateTicketDto } from './dto';

const attachment = FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

@RequireFeature('ops.helpdesk')
@Controller('helpdesk')
export class HelpdeskController {
  constructor(
    private readonly categories: TicketCategoriesService,
    private readonly tickets: TicketsService,
    private readonly teams: HelpdeskTeamsService,
  ) {}

  // ─── Teams & heads ─────────────────────────────────────────

  @RequirePermission('ticket.view')
  @Get('teams')
  listTeams(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.teams.list(ctx.companyId!, access);
  }

  /** Employees: usual reply time and head per team (raise-a-ticket page, My tickets). */
  @RequirePermission('ticket.view')
  @Get('directory')
  directory(@TenantCtx() ctx: TenantContext) {
    return this.teams.directory(ctx.companyId!);
  }

  @Audit('helpdesk:team:update', 'helpdesk_team')
  @RequirePermission('ticket.manage_teams')
  @Put('teams/:queue')
  saveTeam(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('queue', new ParseEnumPipe(TicketQueue)) queue: TicketQueue, @Body() dto: SaveTeamDto) {
    return this.teams.save(ctx.companyId!, access, queue, dto);
  }

  // ─── Categories ────────────────────────────────────────────

  @RequirePermission('ticket.view')
  @Get('categories')
  listCategories(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query('all') all?: string, @Query('queue') queue?: string) {
    const q = queue && (Object.values(TicketQueue) as string[]).includes(queue) ? (queue as TicketQueue) : undefined;
    const agent = all === 'true' && this.tickets.queuesOf(access).length > 0;
    return this.categories.list(ctx.companyId!, agent, q, agent);
  }

  /** While an employee types: matching quick answers + their own solved tickets (titles only). */
  @RequirePermission('ticket.view')
  @Get('answers')
  answers(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: AnswersQueryDto) {
    return this.categories.answers(ctx.companyId!, access.employee?.id ?? null, q.q);
  }

  @RequirePermission('ticket.view')
  @HttpCode(HttpStatus.OK)
  @Post('categories/:id/helped')
  helped(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.categories.helped(ctx.companyId!, id);
  }

  @Audit('helpdesk:category:reorder', 'ticket_category')
  @HttpCode(HttpStatus.OK)
  @Post('categories/reorder')
  reorderCategories(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: ReorderCategoriesDto) {
    this.tickets.assertHandles(access, dto.queue);
    return this.categories.reorder(ctx.companyId!, dto);
  }

  @Audit('helpdesk:category:create', 'ticket_category')
  @Post('categories')
  createCategory(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveCategoryDto) {
    this.tickets.assertHandles(access, dto.queue);
    return this.categories.save(ctx.companyId!, null, dto);
  }

  @Audit('helpdesk:category:update', 'ticket_category')
  @Patch('categories/:id')
  async updateCategory(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveCategoryDto) {
    const current = await this.categories.get(ctx.companyId!, id);
    this.tickets.assertHandles(access, current.queue);
    this.tickets.assertHandles(access, dto.queue);
    return this.categories.save(ctx.companyId!, id, dto);
  }

  // ─── Lists / dashboards ────────────────────────────────────

  @RequirePermission('ticket.view')
  @Get('tickets')
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: TicketQueryDto) {
    return this.tickets.list(ctx.companyId!, access, q);
  }

  @Get('counts')
  counts(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.tickets.counts(ctx.companyId!, access);
  }

  @Get('summary')
  summary(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: SummaryQueryDto) {
    return this.tickets.summary(ctx.companyId!, access, q);
  }

  @Get('agents/:queue')
  agents(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('queue', new ParseEnumPipe(TicketQueue)) queue: TicketQueue) {
    return this.tickets.agents(ctx.companyId!, access, queue);
  }

  // ─── Tickets ───────────────────────────────────────────────

  @RequirePermission('ticket.create')
  @Audit('helpdesk:ticket:create', 'ticket')
  @Post('tickets')
  @UseInterceptors(attachment)
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CreateTicketDto, @UploadedFile() file?: Express.Multer.File) {
    return this.tickets.create(ctx.companyId!, access, dto, file);
  }

  @RequirePermission('ticket.view')
  @Get('tickets/:id')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.get(ctx.companyId!, access, id);
  }

  @RequirePermission('ticket.view')
  @Post('tickets/:id/messages')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(attachment)
  message(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MessageDto, @UploadedFile() file?: Express.Multer.File) {
    return this.tickets.message(ctx.companyId!, access, id, dto, file);
  }

  @RequirePermission('ticket.view')
  @Get('tickets/:id/messages/:messageId/file')
  async file(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Param('messageId', ParseUUIDPipe) messageId: string): Promise<StreamableFile> {
    const f = await this.tickets.file(ctx.companyId!, access, id, messageId);
    return new StreamableFile(f.stream, { type: f.mime, length: f.size, disposition: `inline; filename="${f.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  }

  @Audit('helpdesk:ticket:bulk', 'ticket')
  @Post('tickets/bulk')
  @HttpCode(HttpStatus.OK)
  bulk(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: BulkTicketsDto) {
    return this.tickets.bulk(ctx.companyId!, access, dto);
  }

  @Audit('helpdesk:ticket:assign', 'ticket')
  @Post('tickets/:id/assign')
  @HttpCode(HttpStatus.OK)
  assign(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    return this.tickets.assign(ctx.companyId!, access, id, dto);
  }

  @Audit('helpdesk:ticket:update', 'ticket')
  @Patch('tickets/:id')
  update(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
    return this.tickets.update(ctx.companyId!, access, id, dto);
  }

  @Audit('helpdesk:ticket:resolve', 'ticket')
  @Post('tickets/:id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDto) {
    return this.tickets.resolve(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('ticket.view')
  @Audit('helpdesk:ticket:reopen', 'ticket')
  @Post('tickets/:id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReopenDto) {
    return this.tickets.reopen(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('ticket.view')
  @Audit('helpdesk:ticket:close', 'ticket')
  @Post('tickets/:id/close')
  @HttpCode(HttpStatus.OK)
  close(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseDto) {
    return this.tickets.close(ctx.companyId!, access, id, dto);
  }
}
