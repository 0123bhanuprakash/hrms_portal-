import { Controller, Delete, Get, Patch, Body, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateUiStateDto } from './dto/update-ui-state.dto';
import { Audit } from '../../common';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get logged-in user profile
   */
  @Get('me')
  async getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.sub);
  }

  /**
   * Update logged-in user profile
   */
  @Audit('user:profile:update', 'user')
  @Patch('me')
  async updateProfile(
    @Request() req: any,
    @Body() body: { firstName?: string; lastName?: string; avatarUrl?: string },
  ) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  /**
   * Get logged-in user preferences
   */
  @Get('me/preferences')
  async getPreferences(@Request() req: any) {
    return this.usersService.getPreferences(req.user.sub);
  }

  /**
   * Update logged-in user preferences (e.g. theme toggle)
   */
  @Patch('me/preferences')
  async updatePreferences(
    @Request() req: any,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(req.user.sub, dto);
  }

  /**
   * Save view settings (chart styles, open menu sections…): { changes: { key: value | null } }
   */
  @Patch('me/ui-state')
  async updateUiState(@Request() req: any, @Body() body: UpdateUiStateDto) {
    return this.usersService.updateUiState(req.user.sub, body.changes);
  }

  /**
   * Forget every saved view setting (back to the company defaults)
   */
  @Delete('me/ui-state')
  async resetUiState(@Request() req: any) {
    return this.usersService.resetUiState(req.user.sub);
  }
}
