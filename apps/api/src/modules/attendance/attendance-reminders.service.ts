import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { AttendancePolicyService } from './policy.service';
import { addDays, dateFromKey, localDateKey, wallClock } from './time-zone';

const EVERY_MS = 15 * 60_000;
/** Local hour from which yesterday's missing check-outs are reminded */
const REMIND_FROM_HOUR = 10;

/**
 * Periodic attendance reminders. Safe to run on several API instances:
 * each reminder has a dedupe key (one per person per day).
 */
@Injectable()
export class AttendanceRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AttendanceRemindersService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: AttendancePolicyService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.run(), EVERY_MS);
    setTimeout(() => void this.run(), 60_000).unref();
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Reminds everyone who checked in yesterday but never checked out. */
  async run(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const companies = await this.prisma.company.findMany({ where: { status: CompanyStatus.ACTIVE }, select: { id: true } });
      for (const { id } of companies) {
        const policy = await this.policies.get(id);
        if (wallClock(now, policy.timeZone).hour < REMIND_FROM_HOUR) continue;
        const yesterday = addDays(localDateKey(now, policy.timeZone), -1);
        const open = await this.prisma.attendanceRecord.findMany({
          where: { companyId: id, date: dateFromKey(yesterday), checkIn: { not: null }, checkOut: null },
          select: { employee: { select: { userId: true } } },
        });
        if (!open.length) continue;
        sent += await this.notifications.notify({
          companyId: id,
          userIds: open.map((r) => r.employee.userId),
          type: 'attendance.missing_checkout',
          title: `You didn't check out on ${dateRange(yesterday, yesterday)}`,
          body: 'Request a correction with your check-out time so the day counts properly.',
          link: '/app/attendance',
          actionLabel: 'Fix my attendance',
          dedupeKey: `missing-checkout:${yesterday}`,
        });
      }
      if (sent) this.logger.log(`Sent ${sent} missing check-out reminder(s)`);
    } catch (err) {
      this.logger.error('Attendance reminders failed', err as Error);
    } finally {
      this.running = false;
    }
    return sent;
  }
}
