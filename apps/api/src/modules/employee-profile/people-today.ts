import { AttendanceStatus, LeaveStatus, type PrismaClient } from '@prisma/client';
import { addDays, dateFromKey, isValidTimeZone, localDateKey } from '../attendance/time-zone';

/**
 * "Today" for the people directory, from attendance and leave — visible to
 * everyone, so it never says why someone is away (no leave type, no reason).
 *
 *   in       checked in, not checked out yet (an open session; a night shift
 *            started yesterday counts)
 *   wfh      approved work-from-home leave today, or today's record is WFH
 *   away     any other approved leave covering today
 *   out      checked in today and checked out
 *   not_in   a working day with no check-in yet
 *   off      weekend or company holiday
 */
export type TodayStatus = 'in' | 'wfh' | 'away' | 'out' | 'not_in' | 'off';
export const TODAY_STATUSES: TodayStatus[] = ['in', 'wfh', 'away', 'out', 'not_in', 'off'];

export interface Today {
  status: TodayStatus;
  /** Since when (check-in / check-out time), when known */
  since: Date | null;
}

export interface DayContext {
  timeZone: string;
  todayKey: string;
  today: Date;
  workingDay: boolean;
  holiday: string | null;
}

type Db = Pick<PrismaClient, 'companySettings' | 'publicHoliday' | 'attendanceRecord' | 'leaveRequest'>;

export async function dayContext(db: Db, companyId: string, key?: string): Promise<DayContext> {
  const s = await db.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
  const timeZone = s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata';
  const todayKey = key ?? localDateKey(new Date(), timeZone);
  const today = dateFromKey(todayKey);
  const holiday = await db.publicHoliday.findFirst({ where: { companyId, date: today, isOptional: false }, select: { name: true } });
  const wd = today.getUTCDay();
  return { timeZone, todayKey, today, workingDay: wd !== 0 && wd !== 6 && !holiday, holiday: holiday?.name ?? null };
}

/** Status for each employee id on one day. */
export async function statusesOn(db: Db, companyId: string, ids: string[], ctx: DayContext): Promise<Map<string, Today>> {
  const out = new Map<string, Today>();
  if (!ids.length) return out;
  const yesterday = dateFromKey(addDays(ctx.todayKey, -1));
  const [records, carried, leaves] = await Promise.all([
    db.attendanceRecord.findMany({
      where: { companyId, date: ctx.today, employeeId: { in: ids } },
      select: { employeeId: true, status: true, checkIn: true, checkOut: true, openSince: true },
    }),
    // A night shift still running from yesterday
    db.attendanceRecord.findMany({
      where: { companyId, date: yesterday, employeeId: { in: ids }, openSince: { gt: new Date(Date.now() - 24 * 3600_000) } },
      select: { employeeId: true, openSince: true },
    }),
    db.leaveRequest.findMany({
      where: { companyId, status: LeaveStatus.APPROVED, startDate: { lte: ctx.today }, endDate: { gte: ctx.today }, employeeId: { in: ids } },
      select: { employeeId: true, leaveType: { select: { category: true } } },
    }),
  ]);
  const rec = new Map(records.map((r) => [r.employeeId, r]));
  const night = new Map(carried.map((r) => [r.employeeId, r.openSince]));
  const leave = new Map(leaves.map((l) => [l.employeeId, l.leaveType.category]));
  for (const id of ids) {
    const r = rec.get(id);
    const l = leave.get(id);
    const wfh = l === 'WORK_FROM_HOME' || r?.status === AttendanceStatus.WORK_FROM_HOME;
    let t: Today;
    if (r?.openSince) t = { status: wfh ? 'wfh' : 'in', since: r.openSince };
    else if (night.get(id)) t = { status: 'in', since: night.get(id)! };
    else if (wfh) t = { status: 'wfh', since: r?.checkIn ?? null };
    else if (l) t = { status: 'away', since: null };
    else if (r?.checkOut) t = { status: 'out', since: r.checkOut };
    else if (r?.status === AttendanceStatus.ON_LEAVE) t = { status: 'away', since: null };
    else if (!ctx.workingDay) t = { status: 'off', since: null };
    else t = { status: 'not_in', since: null };
    out.set(id, t);
  }
  return out;
}

/** Monday … Friday of the week containing `todayKey`. */
export function weekKeys(todayKey: string): string[] {
  const dow = (dateFromKey(todayKey).getUTCDay() + 6) % 7;
  const monday = addDays(todayKey, -dow);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

