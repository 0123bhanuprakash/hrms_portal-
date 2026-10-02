import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import { holds, type AccessContext } from '../access/access.types';
import { AnnouncementsService } from './announcements.service';
import { KudosService } from './kudos.service';
import { AnnouncementQueryDto, GiveKudosDto, KudosQueryDto, ReactDto, SaveAnnouncementDto, SaveKudosValueDto } from './dto';

@RequireFeature('engage.announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @RequirePermission('announcement.view')
  @Get()
  list(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: AnnouncementQueryDto) {
    return this.announcements.list(ctx.companyId!, access, query);
  }

  /** Opening it marks it read. */
  @RequirePermission('announcement.view')
  @Get(':id')
  get(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.get(ctx.companyId!, access, id);
  }

  @RequirePermission('announcement.view')
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

  @RequirePermission('announcement.post')
  @Get(':id/report')
  report(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.report(ctx.companyId!, id);
  }

  @RequirePermission('announcement.post')
  @Audit('announcement:create', 'announcement')
  @Post()
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveAnnouncementDto) {
    return this.announcements.create(ctx.companyId!, access, dto);
  }

  @RequirePermission('announcement.post')
  @Audit('announcement:update', 'announcement')
  @Patch(':id')
  update(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveAnnouncementDto) {
    return this.announcements.update(ctx.companyId!, access, id, dto);
  }

  @RequirePermission('announcement.post')
  @Audit('announcement:delete', 'announcement')
  @Delete(':id')
  remove(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.remove(ctx.companyId!, id);
  }

  @RequirePermission('announcement.post')
  @Audit('announcement:attachment', 'announcement')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  @Post(':id/attachment')
  attach(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.announcements.attach(ctx.companyId!, id, file);
  }

  @RequirePermission('announcement.post')
  @Delete(':id/attachment')
  removeAttachment(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.removeAttachment(ctx.companyId!, id);
  }
}

@RequireFeature('engage.kudos')
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

  @RequirePermission('kudos.view')
  @Audit('kudos:delete', 'kudos')
  @Delete(':id')
  remove(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.kudos.remove(ctx.companyId!, access, id);
  }
}
