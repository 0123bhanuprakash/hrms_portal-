import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, CurrentAccess, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { companyOf } from '../user-management/company-context';
import { SaveSeasonDto, UpdateSeasonDto } from './dto';
import { SeasonsService } from './seasons.service';
import { Live } from '../realtime/live.decorator';

// ============================================================
// Seasonal themes (Settings → Theme → Seasonal)
// GET    /seasons/active    what is on today (everyone)
// GET    /seasons           planned seasons + holiday-list suggestions
// GET    /seasons/presets   ready-made national seasons with next dates
// POST   /seasons           add       PATCH /seasons/:id   change
// DELETE /seasons/:id       remove
// ============================================================

@ApiTags('Seasons')
@ApiBearerAuth()
@Live('branding', 'company')
@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  @Get('active')
  @ApiOperation({ summary: 'The seasonal theme that is on today, if any' })
  active(@TenantCtx() ctx: TenantContext) {
    return this.seasons.active(companyOf(ctx));
  }

  @Get()
  @RequirePermission('theme.seasonal')
  list(@TenantCtx() ctx: TenantContext) {
    return this.seasons.list(companyOf(ctx));
  }

  @Get('presets')
  @RequirePermission('theme.seasonal')
  presets(@TenantCtx() ctx: TenantContext) {
    return this.seasons.presets(companyOf(ctx));
  }

  @Post()
  @RequirePermission('theme.seasonal')
  @Audit('season:create', 'seasonal_theme')
  create(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: SaveSeasonDto) {
    return this.seasons.create(companyOf(ctx), access.userId, dto);
  }

  @Patch(':id')
  @RequirePermission('theme.seasonal')
  @Audit('season:update', 'seasonal_theme')
  update(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSeasonDto) {
    return this.seasons.update(companyOf(ctx), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('theme.seasonal')
  @Audit('season:delete', 'seasonal_theme')
  remove(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.seasons.remove(companyOf(ctx), id);
  }
}
