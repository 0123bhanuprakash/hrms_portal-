import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, type SessionDevice, type SessionInfo } from './auth.service';
import { Throttle } from '@nestjs/throttler';
import { AllowPendingPasswordChange, Audit } from '../../common';
import {
  ChangePasswordDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  LoginResponse,
  RefreshResponse,
  AuthUserResponse,
} from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { assertCsrfHeader, clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie';
import type { JwtPayload } from '@hrms/types';

/** Strict limit for credential / token endpoints (per IP): slows brute force and email bombing. */
const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

// ============================================================
// AuthController — /auth/* endpoints
//
// POST /auth/login          Public — email + password → access token (+ refresh cookie)
// POST /auth/refresh        Public — rotate the refresh cookie → new access token
// POST /auth/logout         Public — revoke the refresh cookie's session
//
// The refresh token only ever travels in an httpOnly cookie (refresh-cookie.ts),
// never in a response body, so page scripts can't read it.
// GET  /auth/me             Protected — current user info
// ============================================================

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/login ────────────────────────────────────────

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Returns an access token (15 min); the refresh token (7 days) is set as an httpOnly cookie. ' +
      'Account is locked for 15 minutes after 5 consecutive failures.',
  })
  @ApiResponse({ status: 200, type: LoginResponse })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Account locked — too many failed attempts' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { refresh_token, ...body } = await this.authService.login(dto.email, dto.password, deviceOf(req), {
      portal: dto.portal,
      companySlug: dto.companySlug,
    });
    setRefreshCookie(res, refresh_token);
    return body;
  }

  // ── POST /auth/refresh ──────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and get a new access token',
    description:
      'Reads the refresh token from its httpOnly cookie (requires the X-HRMS-CSRF: 1 header). ' +
      'Implements refresh token rotation with reuse detection. ' +
      'If a previously-used (rotated) token is submitted, ALL sessions for ' +
      'that user are immediately revoked.',
  })
  @ApiResponse({ status: 200, type: RefreshResponse })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<RefreshResponse> {
    assertCsrfHeader(req);
    const token = readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('Not signed in');
    try {
      const { refresh_token, ...body } = await this.authService.refresh(token, deviceOf(req));
      setRefreshCookie(res, refresh_token);
      return body;
    } catch (err) {
      // A refused token is no use to the browser any more
      clearRefreshCookie(res);
      throw err;
    }
  }

  // ── POST /auth/logout ───────────────────────────────────────

  // Public so signing out works even after the access token has expired;
  // it can only end the session whose cookie the browser holds.
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout — revoke this browser’s session',
    description: 'Revokes the refresh token in the httpOnly cookie and clears it (requires X-HRMS-CSRF: 1). The access token will expire naturally (max 15 min).',
  })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ message: string }> {
    assertCsrfHeader(req);
    const token = readRefreshCookie(req);
    if (token) await this.authService.logout(token);
    clearRefreshCookie(res);
    return { message: 'Successfully logged out' };
  }

  // ── GET /auth/me ────────────────────────────────────────────

  @AllowPendingPasswordChange()
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

  // ── POST /auth/forgot-password ──────────────────────────────

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset email',
    description:
      'Sends a reset link to the provided email. Always returns 200 to prevent ' +
      'email enumeration attacks — even if the email does not exist.',
  })
  @ApiResponse({ status: 200, description: 'Reset email sent (if account exists)' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // ── POST /auth/reset-password ───────────────────────────────

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using a token from email',
    description:
      'Validates the token, updates the password, and revokes all existing ' +
      'sessions (refresh tokens) for maximum security.',
  })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or already-used token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password updated successfully. Please log in with your new password.' };
  }

  // ── POST /auth/verify-email ──────────────────────────────────

  @Public()
  @Throttle(AUTH_LIMIT)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email address using token from email link',
    description: 'Validates the verification token and marks the email as verified.',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully. You can now log in.' };
  }

  // ── Own account: password + sessions (any authenticated user) ──

  @AllowPendingPasswordChange()
  @Throttle(AUTH_LIMIT)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth:password:change', 'user')
  @ApiOperation({
    summary: 'Change own password',
    description: 'Requires the current password. All other sessions are signed out; this one stays.',
  })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ id: string; message: string; revokedSessions: number }> {
    const { revokedSessions } = await this.authService.changePassword(
      user.sub,
      dto.current_password,
      dto.new_password,
      user.sid,
      dto.sign_out_others ?? true,
    );
    return { id: user.sub, message: 'Password changed successfully', revokedSessions };
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List own active sessions (devices); `current` marks this one' })
  async listSessions(@CurrentUser() user: JwtPayload): Promise<SessionInfo[]> {
    return this.authService.listSessions(user.sub, user.sid);
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth:sessions:revoke_others', 'user')
  @ApiOperation({ summary: 'Sign out all other devices' })
  async revokeOtherSessions(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ id: string; revokedSessions: number }> {
    const revokedSessions = await this.authService.revokeOtherSessions(user.sub, user.sid);
    return { id: user.sub, revokedSessions };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Audit('auth:session:revoke', 'user')
  @ApiOperation({ summary: 'Sign out one session (device)' })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<{ id: string; message: string }> {
    await this.authService.revokeSession(user.sub, sessionId);
    return { id: user.sub, message: 'Session signed out' };
  }
}

/** User agent + client IP for the session list. */
function deviceOf(req: Request): SessionDevice {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}
