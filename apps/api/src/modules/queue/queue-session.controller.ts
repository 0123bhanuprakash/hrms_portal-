import { Controller, Delete, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import type { JwtPayload } from '@hrms/types';
import { SuperAdminOnly } from '../../common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  QUEUE_BASE_PATH,
  QUEUE_SESSION_COOKIE,
  QUEUE_SESSION_TTL_SECONDS,
  QUEUE_TOKEN_AUDIENCE,
  type QueueSessionPayload,
} from './queue-session';

@ApiTags('Admin Queues')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('admin/queues/session')
export class QueueSessionController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Issue a short-lived Bull Board session cookie for the current Super Admin.
   * POST /admin/queues/session
   */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Open a Bull Board session (sets an httpOnly cookie, 15 min)' })
  createSession(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) res: Response): void {
    const payload: QueueSessionPayload = { sub: user.sub, aud: QUEUE_TOKEN_AUDIENCE };
    const token = this.jwtService.sign(payload, { expiresIn: `${QUEUE_SESSION_TTL_SECONDS}s` });

    res.cookie(QUEUE_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get<string>('nodeEnv') === 'production',
      path: QUEUE_BASE_PATH,
      maxAge: QUEUE_SESSION_TTL_SECONDS * 1000,
    });
  }

  /**
   * End the Bull Board session.
   * DELETE /admin/queues/session
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Close the Bull Board session (clears the cookie)' })
  deleteSession(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(QUEUE_SESSION_COOKIE, { path: QUEUE_BASE_PATH });
  }
}
