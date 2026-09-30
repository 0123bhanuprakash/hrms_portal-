import { Controller, Get, Patch, Body, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
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
}
