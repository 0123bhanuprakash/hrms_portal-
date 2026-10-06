import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import { holds, type AccessContext } from '../access/access.types';
import { AnnouncementsService } from './announcements.service';
import { KudosService } from './kudos.service';
import { Live, NoLive } from '../realtime/live.decorator';
import { SeenDto, AnnouncementAudienceDto, AnnouncementQueryDto, AnnouncementReactDto, GiveKudosDto, KudosHintDto, KudosInsightsQueryDto, KudosQueryDto, ReactDto, RsvpDto, SaveAnnouncementDto, SaveKudosValueDto } from './dto';

@RequireFeature('engage.announcements')
@Live('announcements', 'company')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @RequirePermission('announcement.view')
  @Get()
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: AnnouncementQueryDto) {
    return this.announcements.list(ctx.companyId!, access, query);
  }

  /** To confirm, events coming up, and how my posts are doing. */
  @RequirePermission('announcement.view')
  @Get('overview')
  overview(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.announcements.overview(ctx.companyId!, access);
  }

  /** Posts scrolled into view count as read. */
  @RequirePermission('announcement.view')
  @Live('announcements')
  @Post('seen')
  @HttpCode(HttpStatus.OK)
  seen(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SeenDto) {
    return this.announcements.markSeen(ctx.companyId!, access, dto.ids);
  }

  @RequirePermission('announcement.view')
  @Live('announcements')
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.announcements.readAll(ctx.companyId!, access);
  }

  /** How many people a post would reach (before posting). */
  @RequirePermission('announcement.view')
  @NoLive()
  @Post('audience')
  @HttpCode(HttpStatus.OK)
  audience(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: AnnouncementAudienceDto) {
    return this.announcements.audiencePreview(ctx.companyId!, access, dto);
  }

  /** Opening it marks it read. */
  @RequirePermission('announcement.view')
  @Get(':id')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.get(ctx.companyId!, access, id);
  }

  @RequirePermission('announcement.view')
  @Live('announcements')
  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.acknowledge(ctx.companyId!, access, id);
  }

  @RequirePermission('announcement.view')
  @Get(':id/attachment')
  async download(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const f = await this.announcements.openAttachment(ctx.companyId!, access, id);
    return new StreamableFile(f.stream, {
      type: f.mime,
      length: f.size,
      disposition: `attachment; filename="${f.name.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    });
  }

  @RequirePermission('announcement.view')
  @Get(':id/report')
  report(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.report(ctx.companyId!, access, id);
  }

  @RequirePermission('announcement.view')
  @Audit('announcement:nudge', 'announcement')
  @NoLive()
  @Post(':id/nudge')
  @HttpCode(HttpStatus.OK)
  nudge(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.nudge(ctx.companyId!, access, id);
  }

  @RequirePermission('announcement.manage')
  @Audit('announcement:pin', 'announcement')
  @Put(':id/pin')
  pin(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body('pinned', ParseBoolPipe) pinned: boolean) {
    return this.announcements.pin(ctx.companyId!, access, id, pinned);
  }

  @RequirePermission('announcement.view')
  @Post(':id/reactions')
  @HttpCode(HttpStatus.OK)
  react(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnnouncementReactDto) {
    return this.announcements.react(ctx.companyId!, access, id, dto.emoji);
  }

  @RequirePermission('announcement.view')
  @Put(':id/rsvp')
  rsvp(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RsvpDto) {
    return this.announcements.rsvp(ctx.companyId!, access, id, dto.response ?? null);
  }

  @RequirePermission('announcement.view')
  @Audit('announcement:create', 'announcement')
  @Post()
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveAnnouncementDto) {
    return this.announcements.create(ctx.companyId!, access, dto);
  }

  @RequirePermission('announcement.view')
  @Audit('announcement:update', 'announcement')
  @Patch(':id')
  update(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveAnnouncementDto) {
    return this.announcements.update(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('announcement.view')
  @Audit('announcement:delete', 'announcement')
  @Delete(':id')
  remove(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.remove(ctx.companyId!, access, id);
  }

  @RequirePermission('announcement.view')
  @Audit('announcement:attachment', 'announcement')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  @Post(':id/attachment')
  attach(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.announcements.attach(ctx.companyId!, access, id, file);
  }

  @RequirePermission('announcement.view')
  @Audit('announcement:cover', 'announcement')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  @Post(':id/cover')
  uploadCover(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.announcements.uploadCover(ctx.companyId!, access, id, file);
  }

  @RequirePermission('announcement.view')
  @Delete(':id/cover')
  removeCover(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.removeCover(ctx.companyId!, access, id);
  }

  @RequirePermission('announcement.view')
  @Delete(':id/attachment')
  removeAttachment(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.removeAttachment(ctx.companyId!, access, id);
  }
}

@RequireFeature('engage.kudos')
@Live('kudos', 'company')
@Controller('kudos')
export class KudosController {
  constructor(private readonly kudos: KudosService) {}

  @RequirePermission('kudos.view')
  @Get()
  feed(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: KudosQueryDto) {
    return this.kudos.feed(ctx.companyId!, access, query);
  }

  @RequirePermission('kudos.give')
  @Audit('kudos:give', 'kudos')
  @Post()
  give(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: GiveKudosDto) {
    return this.kudos.give(ctx.companyId!, access, dto);
  }

  @RequirePermission('kudos.view')
  @Get('leaderboard')
  leaderboard(@TenantCtx() ctx: TenantContext) {
    return this.kudos.leaderboard(ctx.companyId!);
  }

  @RequirePermission('kudos.view')
  @Get('me')
  mine(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.kudos.mine(ctx.companyId!, access);
  }

  @RequirePermission('kudos.give')
  @Get('suggestions')
  suggestions(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.kudos.suggestions(ctx.companyId!, access);
  }

  /** Recognition insights — HR only (incl. who nobody has thanked lately). */
  @RequirePermission('kudos.manage')
  @Get('insights')
  insights(@TenantCtx() ctx: TenantContext, @Query() query: KudosInsightsQueryDto) {
    return this.kudos.insights(ctx.companyId!, query);
  }

  @RequirePermission('kudos.manage')
  @Audit('kudos:hint', 'kudos')
  @NoLive()
  @Post('insights/hint')
  @HttpCode(HttpStatus.OK)
  hint(@TenantCtx() ctx: TenantContext, @Body() dto: KudosHintDto) {
    return this.kudos.hintManagers(ctx.companyId!, dto.employeeIds);
  }

  @RequirePermission('kudos.view')
  @Get('values')
  values(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query('all') all?: string) {
    return this.kudos.values(ctx.companyId!, all === 'true' && holds(access, 'kudos.manage'));
  }

  @RequirePermission('kudos.manage')
  @Audit('kudos:value:create', 'kudos_value')
  @Post('values')
  createValue(@TenantCtx() ctx: TenantContext, @Body() dto: SaveKudosValueDto) {
    return this.kudos.saveValue(ctx.companyId!, null, dto);
  }

  @RequirePermission('kudos.manage')
  @Audit('kudos:value:update', 'kudos_value')
  @Patch('values/:id')
  updateValue(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveKudosValueDto) {
    return this.kudos.saveValue(ctx.companyId!, id, dto);
  }

  @RequirePermission('kudos.view')
  @Get('stats/:employeeId')
  stats(@TenantCtx() ctx: TenantContext, @Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.kudos.stats(ctx.companyId!, employeeId);
  }

  @RequirePermission('kudos.view')
  @Post(':id/reactions')
  @HttpCode(HttpStatus.OK)
  react(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactDto) {
    return this.kudos.react(ctx.companyId!, access, id, dto.emoji);
  }

  /** "Add my thanks" (toggle). */
  @RequirePermission('kudos.give')
  @Post(':id/thanks')
  @HttpCode(HttpStatus.OK)
  thank(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.kudos.thank(ctx.companyId!, access, id);
  }

  @RequirePermission('kudos.view')
  @Audit('kudos:delete', 'kudos')
  @Delete(':id')
  remove(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.kudos.remove(ctx.companyId!, access, id);
  }
}
