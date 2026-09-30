import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  LoginResponse,
  RefreshResponse,
  AuthUserResponse,
} from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from '@hrms/types';

// ============================================================
// AuthController — /auth/* endpoints
//
// POST /auth/login          Public — email + password → tokens
// POST /auth/refresh        Public — rotate refresh token
// POST /auth/logout         Protected — revoke refresh token
// GET  /auth/me             Protected — current user info
// ============================================================

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/login ────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Returns an access token (15 min) and a refresh token (7 days). ' +
      'Account is locked for 15 minutes after 5 consecutive failures.',
  })
  @ApiResponse({ status: 200, type: LoginResponse })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Account locked — too many failed attempts' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<LoginResponse> {
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip;
    return this.authService.login(dto.email, dto.password, ip);
  }

  // ── POST /auth/refresh ──────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and get a new access token',
    description:
      'Implements refresh token rotation with reuse detection. ' +
      'If a previously-used (rotated) token is submitted, ALL sessions for ' +
      'that user are immediately revoked.',
  })
  @ApiResponse({ status: 200, type: RefreshResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponse> {
    return this.authService.refresh(dto.refresh_token);
  }

  // ── POST /auth/logout ───────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout — revoke current refresh token',
    description: 'Revokes the provided refresh token. The access token will expire naturally (max 15 min).',
  })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(dto.refresh_token);
    return { message: 'Successfully logged out' };
  }

  // ── GET /auth/me ────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current authenticated user',
    description: 'Returns the authenticated user with their roles and effective permissions.',
  })
  @ApiResponse({ status: 200, type: AuthUserResponse })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@CurrentUser() user: JwtPayload): Promise<AuthUserResponse> {
    return this.authService.me(user.sub);
  }
}
