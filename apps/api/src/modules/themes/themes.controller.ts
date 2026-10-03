import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from '@hrms/types';
import { Audit, SuperAdminOnly } from '../../common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThemesService } from './themes.service';
import {
  createThemeSchema,
  updateThemeSchema,
  updateThemeSettingsSchema,
  ZodBody,
  type CreateThemeInput,
  type UpdateThemeInput,
  type UpdateThemeSettingsInput,
} from './theme.schema';

// ============================================================
// Theme Studio API (Super Admin)
//
// GET    /admin/themes              custom themes in the library
// POST   /admin/themes              save a custom theme
// GET    /admin/themes/:id
// PATCH  /admin/themes/:id
// DELETE /admin/themes/:id          refused while the theme is assigned
// GET    /admin/theme-settings      assignments (+ tokens of custom ones)
// PUT    /admin/theme-settings      set Super Admin portal / company default theme
// ============================================================

const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('Themes')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('admin')
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Get('themes')
  @ApiOperation({ summary: 'List custom themes in the platform library' })
  list() {
    return this.themes.list();
  }

  @Post('themes')
  @Audit('theme:create', 'theme')
  @ApiOperation({ summary: 'Save a custom theme' })
  create(@Body(new ZodBody(createThemeSchema)) body: CreateThemeInput, @CurrentUser() user: JwtPayload) {
    return this.themes.create(body, user.sub);
  }

  @Get('themes/:id')
  @ApiOperation({ summary: 'Get a custom theme' })
  get(@Param('id', uuid) id: string) {
    return this.themes.get(id);
  }

  @Patch('themes/:id')
  @Audit('theme:update', 'theme')
  @ApiOperation({ summary: 'Update a custom theme' })
  update(@Param('id', uuid) id: string, @Body(new ZodBody(updateThemeSchema)) body: UpdateThemeInput) {
    return this.themes.update(id, body);
  }

  @Delete('themes/:id')
  @Audit('theme:delete', 'theme')
  @ApiOperation({ summary: 'Delete a custom theme (not allowed while assigned)' })
  remove(@Param('id', uuid) id: string) {
    return this.themes.remove(id);
  }

  @Get('theme-settings')
  @ApiOperation({ summary: 'Theme assignments for the Super Admin portal and new companies' })
  getSettings() {
    return this.themes.getSettingsResolved();
  }

  @Put('theme-settings')
  @Audit('theme:settings:update', 'platform_settings')
  @ApiOperation({ summary: 'Assign themes to the Super Admin portal and/or new companies' })
  updateSettings(
    @Body(new ZodBody(updateThemeSettingsSchema)) body: UpdateThemeSettingsInput,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.themes.updateSettings(body, user.sub);
  }
}
