import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { RealtimeService, room } from '../realtime/realtime.service';

const EVERY_MS = 60_000;

/**
 * Delegations start and end on a clock, not on a request. Every minute, find
 * the ones that just began or ended and refresh the covering person's access
 * (menus, approval rooms) and both people's delegation screens — so cover
 * starts and stops on time without a reload.
 */
@Injectable()
export class DelegationsLiveService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DelegationsLiveService.name);
  private timer: NodeJS.Timeout | null = null;
  private since = new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly realtime: RealtimeService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick().catch((e) => this.logger.error(e)), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    const now = new Date();
    const from = this.since;
    this.since = now;
    const rows = await this.prisma.approvalDelegation.findMany({
      where: {
        revokedAt: null,
        OR: [
          { startsAt: { gt: from, lte: now } },
          { endsAt: { gt: from, lte: now } },
        ],
      },
      select: { delegateId: true, delegatorId: true },
    });
    if (!rows.length) return;
    const delegates = [...new Set(rows.map((r) => r.delegateId))];
    this.access.invalidateDelegations(...delegates);
    this.realtime.accessChanged({ userIds: delegates });
    this.realtime.changed([...new Set(rows.flatMap((r) => [room.user(r.delegateId), room.user(r.delegatorId)]))], 'delegations');
  }
}
