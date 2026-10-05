import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { JwtPayload } from '@hrms/types';
import { Audit, SuperAdminOnly } from '../../common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AccountService } from './account.service';
import { Risky } from './reauth.guard';

// ============================================================
// Profile & security (the signed-in person)
//
// GET    /account/overview              details, last sign-in, password age, protection
// GET    /account/actions               your recent actions (audit log)
// POST   /account/avatar                upload a photo (multipart "file")
// DELETE /account/avatar
// POST   /account/email                 start an email change (link to the new address)
// DELETE /account/email                 cancel a pending change
// POST   /account/email/confirm         public: open the link
// GET    /account/sign-ins              your sign-in history (30 days)
// POST   /account/reauth                confirm your password → short-lived token
// GET    /admin/platform-admins         everyone with Super Admin access
// POST   /admin/platform-admins         invite a Super Admin
// DELETE /admin/platform-admins/:id     remove access
// ============================================================

const SECURE_LIMIT = { default: { limit: 10, ttl: 60_000 } };

class EmailChangeDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

class TokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;
}

class PasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

class SignInsQueryDto {
  @ApiPropertyOptional({ enum: ['success', 'failed'] })
  @IsOptional()
  @IsIn(['success', 'failed'])
  status?: 'success' | 'failed';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

class InviteAdminDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;
}

@ApiTags('Account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Your details, last sign-in, password age, devices and protection settings' })
  overview(@CurrentUser() user: JwtPayload) {
    return this.account.overview(user.sub);
  }

  @Get('actions')
  actions(@CurrentUser() user: JwtPayload) {
    return this.account.recentActions(user.sub);
  }

  @Post('avatar')
  @Audit('user:avatar:update', 'user')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  uploadAvatar(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    return this.account.uploadAvatar(user.sub, file);
  }

  @Delete('avatar')
  @Audit('user:avatar:remove', 'user')
  removeAvatar(@CurrentUser() user: JwtPayload) {
    return this.account.removeAvatar(user.sub);
  }

  @Post('email')
  @HttpCode(200)
  @Throttle(SECURE_LIMIT)
  @Audit('user:email:change_requested', 'user')
  requestEmailChange(@CurrentUser() user: JwtPayload, @Body() dto: EmailChangeDto) {
    return this.account.requestEmailChange(user.sub, dto.email, dto.password);
  }

  @Delete('email')
  cancelEmailChange(@CurrentUser() user: JwtPayload) {
    return this.account.cancelEmailChange(user.sub);
  }

  @Public()
  @Post('email/confirm')
  @HttpCode(200)
  @Throttle(SECURE_LIMIT)
  confirmEmailChange(@Body() dto: TokenDto) {
    return this.account.confirmEmailChange(dto.token);
  }

  @Get('sign-ins')
  signIns(@CurrentUser() user: JwtPayload, @Query() query: SignInsQueryDto) {
    return this.account.signIns(user.sub, query);
  }

  @Post('reauth')
  @HttpCode(200)
  @Throttle(SECURE_LIMIT)
  @ApiOperation({ summary: 'Confirm your password; returns a 5-minute token for risky changes (header x-reauth)' })
  reauth(@CurrentUser() user: JwtPayload, @Body() dto: PasswordDto) {
    return this.account.reauth(user.sub, dto.password);
  }
}

@ApiTags('Admin — Platform admins')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('admin/platform-admins')
export class PlatformAdminsController {
  constructor(private readonly account: AccountService) {}

  @Get()
  list() {
    return this.account.platformAdmins();
  }

  @Post()
  @Risky()
  @Audit('platform:admin:invite', 'user')
  invite(@Body() dto: InviteAdminDto) {
    return this.account.inviteAdmin(dto);
  }

  @Delete(':id')
  @Risky()
  @Audit('platform:admin:remove', 'user')
  remove(@CurrentUser() user: JwtPayload, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.account.removeAdmin(user.sub, id);
  }
}
