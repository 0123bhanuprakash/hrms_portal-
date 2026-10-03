import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus, EmploymentStatus, TimesheetStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { EntitlementService } from '../access/entitlement.service';
import { addDays, dateFromKey, isValidTimeZone, localDateKey } from '../attendance/time-zone';
import { mondayOf } from './timesheets.service';

const EVERY_MS = 60 * 60_000;
/** Local hour on Monday from which last week's reminder goes out */
const REMIND_FROM_HOUR = 10;

/**
 * On Monday mornings (company time zone) reminds people who were on a
 * project last week but haven't submitted that week's timesheet. Once per
 * person and week; in-app only.
 */
@Injectable()
export class TimesheetRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TimesheetRemindersService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly entitlements: EntitlementService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.run(), EVERY_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 150_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date(), onlyCompanyId?: string): Promise<number> {
    let sent = 0;
    try {
      const companies = await this.prisma.company.findMany({
        where: { status: CompanyStatus.ACTIVE, ...(onlyCompanyId && { id: onlyCompanyId }) },
        select: { id: true, featuresVersion: true, settings: { select: { timezone: true } } },
      });
      for (const c of companies) {
        if (!(await this.entitlements.forCompany(c.id, c.featuresVersion)).features.has('work.timesheets')) continue;
        const tz = c.settings?.timezone && isValidTimeZone(c.settings.timezone) ? c.settings.timezone : 'Asia/Kolkata';
        const today = localDateKey(now, tz);
        const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now));
        if (mondayOf(today) !== today || hour < REMIND_FROM_HOUR) continue;
        const week = addDays(today, -7);
        const weekEnd = addDays(week, 6);
        const people = await this.prisma.employee.findMany({
          where: {
            companyId: c.id,
            employmentStatus: { not: EmploymentStatus.TERMINATED },
            user: { status: UserStatus.ACTIVE },
            projectMembers: { some: { startDate: { lte: dateFromKey(weekEnd) }, OR: [{ endDate: null }, { endDate: { gte: dateFromKey(week) } }] } },
            timesheets: { none: { weekStart: dateFromKey(week), status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED] } } },
          },
          select: { userId: true },
        });
        if (!people.length) continue;
        sent += await this.notifications.notify({
          companyId: c.id,
          userIds: people.map((p) => p.userId),
          type: 'timesheet.reminder',
          title: `Submit your timesheet for ${dateRange(week, weekEnd)}`,
          body: 'Log your hours per project and submit the week for approval.',
          link: `/app/timesheets?week=${week}`,
          actionLabel: 'Fill timesheet',
          email: false,
          dedupeKey: `timesheet-missing:${week}`,
        });
      }
    } catch (err) {
      this.logger.error('Timesheet reminders failed', err as Error);
    }
    return sent;
  }
}
