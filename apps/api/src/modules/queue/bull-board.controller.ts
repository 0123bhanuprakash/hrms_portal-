import { Controller, All, Req, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeController } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { JwtService } from '@nestjs/jwt';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_QUEUE_NAME } from '../email/email.job.types';
import {
  QUEUE_BASE_PATH,
  QUEUE_SESSION_COOKIE,
  QUEUE_TOKEN_AUDIENCE,
  readCookie,
  type QueueSessionPayload,
} from './queue-session';

// ============================================================
// BullBoardController — Bull Board UI at /api/v1/admin/queues/
//
// @Public() only skips the Bearer-token guards (a browser tab cannot send
// an Authorization header). Every request is authenticated here instead,
// using the Super Admin session cookie issued by QueueSessionController.
// ============================================================

@ApiTags('Admin Queues')
@ApiExcludeController()
@Controller('admin/queues')
@Public()
export class BullBoardController {
  private readonly logger = new Logger(BullBoardController.name);
  private readonly serverAdapter: ExpressAdapter;

  constructor(
    @InjectQueue(EMAIL_QUEUE_NAME) private readonly emailQueue: Queue,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath(QUEUE_BASE_PATH);

    createBullBoard({
      queues: [new BullMQAdapter(this.emailQueue)],
      serverAdapter: this.serverAdapter,
    });
  }

  @All('*')
  @ApiOperation({ summary: 'Bull Board Queue Management UI (Super Admin session cookie)' })
  async handleDashboard(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!(await this.isSuperAdminSession(req))) {
      res
        .status(401)
        .type('text/plain')
        .send('Bull Board session missing or expired. Open it again from the Super Admin portal.');
      return;
    }

    const rawUrl = req.originalUrl || req.url || '';
    const [pathOnly, queryString] = rawUrl.split('?');

    // Bull Board router requires trailing slash on base path to render index HTML
    if (pathOnly === QUEUE_BASE_PATH) {
      res.redirect(301, `${QUEUE_BASE_PATH}/${queryString ? `?${queryString}` : ''}`);
      return;
    }

    // ExpressAdapter internal routes are relative to basePath (/ , /static/*, /api/*)
    req.url = rawUrl.substring(QUEUE_BASE_PATH.length) || '/';
    this.serverAdapter.getRouter()(req, res);
  }

  /** Valid queue-session JWT whose user is still an active Super Admin. */
  private async isSuperAdminSession(req: Request): Promise<boolean> {
    const token = readCookie(req.headers.cookie, QUEUE_SESSION_COOKIE);
    if (!token) return false;

    try {
      const payload = this.jwtService.verify<QueueSessionPayload>(token, {
        audience: QUEUE_TOKEN_AUDIENCE,
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isSuperAdmin: true, status: true },
      });
      return Boolean(user?.isSuperAdmin && user.status === 'ACTIVE');
    } catch (err) {
      this.logger.debug(`Rejected Bull Board session: ${(err as Error).message}`);
      return false;
    }
  }
}
