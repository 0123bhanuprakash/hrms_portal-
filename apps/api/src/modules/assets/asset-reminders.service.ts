import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetStatus, CompanyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';

const EVERY_MS = 6 * 60 * 60_000;
const WARN_DAYS = 30;

/** Tells IT when an asset's warranty ends within 30 days (once per asset and end date). */
@Injectable()
export class AssetRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AssetRemindersService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.run(), EVERY_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 90_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()): Promise<number> {
    let sent = 0;
    try {
      const companies = await this.prisma.company.findMany({ where: { status: CompanyStatus.ACTIVE }, select: { id: true, settings: { select: { timezone: true } } } });
      for (const c of companies) {
        const tz = c.settings?.timezone && isValidTimeZone(c.settings.timezone) ? c.settings.timezone : 'Asia/Kolkata';
        const today = localDateKey(now, tz);
        const ending = await this.prisma.asset.findMany({
          where: { companyId: c.id, status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] }, warrantyUntil: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, WARN_DAYS)) } },
          select: { id: true, tag: true, name: true, warrantyUntil: true },
        });
        if (!ending.length) continue;
        const it = await this.notifications.companyWideApprovers(c.id, 'asset.manage');
        for (const a of ending) {
          const until = keyFromDate(a.warrantyUntil!);
          sent += await this.notifications.notify({
            companyId: c.id,
            userIds: it,
            type: 'asset.warranty',
            title: `Warranty ends ${until}: ${a.name} (${a.tag})`,
            link: `/app/assets/${a.id}`,
            email: false,
            dedupeKey: `warranty:${a.id}:${until}`,
          });
        }
      }
    } catch (err) {
      this.logger.error('Asset reminders failed', err as Error);
    }
    return sent;
  }
}
