import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { AttendancePolicyService } from './policy.service';
import { addDays, dateFromKey, keyFromDate, localDateKey, wallClock, zonedInstant } from './time-zone';
import { statusForMinutes, withShift, workedMinutes } from './attendance-rules';
import { ShiftsService } from './shifts.service';
import { AttendanceService } from './attendance.service';

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
    private readonly shifts: ShiftsService,
    private readonly attendance: AttendanceService,
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
        if (policy.autoCloseAfterMinutes !== null) sent += await this.autoClose(id, now);
        if (wallClock(now, policy.timeZone).hour < REMIND_FROM_HOUR) continue;
        const yesterday = addDays(localDateKey(now, policy.timeZone), -1);
        const open = await this.prisma.attendanceRecord.findMany({
          // Never checked out, or closed for them automatically — either way they should fix it
          where: { companyId: id, date: dateFromKey(yesterday), checkIn: { not: null }, OR: [{ checkOut: null }, { autoClosed: true }] },
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

  /**
   * Forgotten check-outs: a session still open this long after the person's
   * shift ended is closed at shift end + the company's buffer and marked
   * "closed automatically" (they can still request a correction).
   * Project night-shift people are left alone (they may work past midnight).
   */
  async autoClose(companyId: string, now = new Date()): Promise<number> {
    const policy = await this.policies.get(companyId);
    if (policy.autoCloseAfterMinutes === null) return 0;
    const todayKey = localDateKey(now, policy.timeZone);
    const open = await this.prisma.attendanceRecord.findMany({
      where: { companyId, openSince: { not: null }, date: { gte: dateFromKey(addDays(todayKey, -7)), lte: dateFromKey(todayKey) } },
      select: { id: true, employeeId: true, date: true, openSince: true, workingMinutes: true, employee: { select: { userId: true } } },
    });
    if (!open.length) return 0;
    const shiftOf = await this.shifts.hoursFor(companyId, [...new Set(open.map((r) => r.employeeId))]);
    let closed = 0;
    for (const r of open) {
      const dateKey = keyFromDate(r.date);
      const shift = shiftOf.get(r.employeeId) ?? null;
      if (!shift?.overnight && dateKey >= addDays(todayKey, -1) && (await this.attendance.nightShiftAllowed(companyId, r.employeeId, dateKey))) continue;
      const rules = withShift(policy, shift);
      const endKey = shift?.overnight ? addDays(dateKey, 1) : dateKey;
      const closeAt = new Date(zonedInstant(endKey, rules.shiftEnd, policy.timeZone).getTime() + policy.autoCloseAfterMinutes * 60_000);
      if (now < closeAt) continue;
      const at = r.openSince! > closeAt ? r.openSince! : closeAt;
      const worked = (r.workingMinutes ?? 0) + workedMinutes(r.openSince!, at);
      const { count } = await this.prisma.attendanceRecord.updateMany({
        where: { id: r.id, openSince: { not: null } },
        data: { checkOut: at, openSince: null, workingMinutes: worked, status: statusForMinutes(worked, policy), earlyCheckout: worked < policy.fullDayMinutes, checkOutSource: 'AUTO', autoClosed: true },
      });
      if (!count) continue;
      await this.prisma.attendancePunch.create({ data: { companyId, employeeId: r.employeeId, recordId: r.id, date: r.date, kind: 'OUT', at, source: 'AUTO', note: 'Closed automatically' } });
      closed++;
      const time = new Intl.DateTimeFormat('en-GB', { timeZone: policy.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
      await this.notifications.notify({
        companyId,
        userIds: [r.employee.userId],
        type: 'attendance.auto_closed',
        title: `We closed your day at ${time} on ${dateRange(dateKey, dateKey)}`,
        body: 'You forgot to check out. If you left at another time, request a correction.',
        link: '/app/attendance',
        actionLabel: 'Fix my attendance',
        email: false,
        dedupeKey: `auto-closed:${r.id}`,
      });
    }
    if (closed) this.logger.log(`Closed ${closed} forgotten check-out(s) for ${companyId}`);
    return closed;
  }
}
