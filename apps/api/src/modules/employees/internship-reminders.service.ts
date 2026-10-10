import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import { CURRENT_INTERN, EmployeeLifecycleService, INTERNSHIP_ESCALATE_DAYS, INTERNSHIP_NOTICE_DAYS, fmt } from './lifecycle.service';

const EVERY_MS = 6 * 60 * 60_000;
const DAY = 86_400_000;

/**
 * Internships coming to an end. Nobody's type changes without a decision:
 *   • 14 days before → HR and the manager get a heads-up
 *   • on the end date → company set to "convert" (and the intern not excluded):
 *     switched to Full-time by the system; otherwise HR is reminded again
 *   • 7 days after with no decision → Company Admins are told
 */
@Injectable()
export class InternshipRemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(InternshipRemindersService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: EmployeeLifecycleService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.run(), EVERY_MS);
    this.timer.unref();
    setTimeout(() => void this.run(), 180_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass over every company (or one, for tests). Returns what happened, for logs and tests. */
  async run(onlyCompanyId?: string, now = new Date()): Promise<{ reminded: number; converted: number; escalated: number }> {
    const out = { reminded: 0, converted: 0, escalated: 0 };
    try {
      // A day of slack either side of UTC; each company's own date decides below
      const horizon = new Date(now.getTime() + (INTERNSHIP_NOTICE_DAYS + 1) * DAY);
      const interns = await this.prisma.employee.findMany({
        where: { ...CURRENT_INTERN, ...(onlyCompanyId && { companyId: onlyCompanyId }), internshipEndDate: { not: null, lte: horizon }, company: { status: 'ACTIVE' } },
        select: { id: true, companyId: true, userId: true, firstName: true, lastName: true, internshipEndDate: true, skipAutoConvert: true, reportingManager: { select: { userId: true } } },
        orderBy: { internshipEndDate: 'asc' },
        take: 1000,
      });
      const companies = [...new Set(interns.map((i) => i.companyId))];
      const settings = new Map(
        (await this.prisma.companySettings.findMany({ where: { companyId: { in: companies } }, select: { companyId: true, timezone: true, internshipEndAction: true } })).map((s) => [s.companyId, s]),
      );
      const hr = new Map<string, string[]>();
      const hrOf = async (companyId: string) => {
        if (!hr.has(companyId)) hr.set(companyId, await this.notifications.companyWideApprovers(companyId, 'employee.edit'));
        return hr.get(companyId)!;
      };

      for (const i of interns) {
        const s = settings.get(i.companyId);
        const todayKey = localDateKey(now, s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
        const end = i.internshipEndDate!;
        const endKey = keyFromDate(end);
        const daysLeft = Math.round((end.getTime() - dateFromKey(todayKey).getTime()) / DAY);
        if (daysLeft > INTERNSHIP_NOTICE_DAYS) continue;
        const who = `${i.firstName} ${i.lastName}`.trim();
        const auto = s?.internshipEndAction === 'convert' && !i.skipAutoConvert;
        const audience = [...(await hrOf(i.companyId)), i.reportingManager?.userId];
        const link = `/app/employees/${i.id}`;

        // The end date has come and the company converts automatically
        if (auto && daysLeft <= 0) {
          await this.prisma.$transaction((tx) => this.lifecycle.applyConversion(tx, i.companyId, i, { employmentType: 'FULL_TIME', startDate: todayKey, actor: null, note: 'Converted automatically when the internship ended' }));
          this.lifecycle.notifyConverted(i.companyId, i.userId, 'FULL_TIME', null);
          await this.notifications.notify({
            companyId: i.companyId,
            userIds: audience,
            type: 'employee.converted',
            title: `${who} is now Full-time — converted automatically`,
            body: `Their internship ended ${fmt(end)}. Add a probation period or new job title from their profile if needed.`,
            link,
            actionLabel: 'Open profile',
            dedupeKey: `internship-converted:${i.id}:${endKey}`,
          });
          out.converted++;
          continue;
        }

        if (daysLeft >= 0) {
          out.reminded += await this.notifications.notify({
            companyId: i.companyId,
            userIds: audience,
            type: 'employee.internship_ending',
            title: daysLeft === 0 ? `${who}’s internship ends today` : `${who}’s internship ends ${fmt(end)}`,
            body: auto ? 'They’ll be converted to Full-time automatically on that day. Exclude them, extend or end the internship if that’s not right.' : 'Convert them, extend the internship or end it.',
            link,
            actionLabel: 'Decide',
            dedupeKey: `internship-ending:${i.id}:${endKey}`,
          });
          continue;
        }

        // Past the end date, still an intern
        out.reminded += await this.notifications.notify({
          companyId: i.companyId,
          userIds: audience,
          type: 'employee.internship_ending',
          title: `${who}’s internship ended ${fmt(end)} — still waiting on a decision`,
          body: 'Convert them, extend the internship or end it.',
          link,
          actionLabel: 'Decide',
          dedupeKey: `internship-ended:${i.id}:${endKey}`,
        });
        if (-daysLeft >= INTERNSHIP_ESCALATE_DAYS) {
          const n = await this.notifications.notify({
            companyId: i.companyId,
            userIds: await this.lifecycle.companyAdmins(i.companyId),
            type: 'employee.internship_ending',
            title: `${who}’s internship ended ${-daysLeft} days ago with no decision`,
            body: 'HR hasn’t converted, extended or ended it yet.',
            link,
            actionLabel: 'Open profile',
            dedupeKey: `internship-escalated:${i.id}:${endKey}`,
          });
          if (n) out.escalated++;
        }
      }
    } catch (err) {
      this.logger.error(`Internship reminders failed: ${(err as Error).message}`);
    }
    return out;
  }
}
