import type { AttendanceStatus } from '@prisma/client';
import { localMinutes, minutesOf, weekdayOfKey } from './time-zone';

// ============================================================
// Attendance rules — pure functions, no database.
// ============================================================

export interface PolicyRules {
  workDays: number[];
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  halfDayMinutes: number;
  fullDayMinutes: number;
  regularisationWindowDays: number;
  webCheckInEnabled: boolean;
}

export const DEFAULT_POLICY: PolicyRules = {
  workDays: [1, 2, 3, 4, 5],
  shiftStart: '09:30',
  shiftEnd: '18:30',
  graceMinutes: 15,
  halfDayMinutes: 240,
  fullDayMinutes: 480,
  regularisationWindowDays: 30,
  webCheckInEnabled: true,
};

/**
 * What a day looks like on the calendar. Stored statuses plus states that
 * only exist when looking at a day:
 *   WORKING           checked in today, not out yet
 *   MISSING_CHECKOUT  a past day with a check-in but no check-out
 *   NOT_CHECKED_IN    today, nothing yet
 *   UPCOMING          a future working day
 *   NOT_JOINED        before the joining date
 */
export type DayStatus =
  | AttendanceStatus
  | 'WORKING'
  | 'MISSING_CHECKOUT'
  | 'NOT_CHECKED_IN'
  | 'UPCOMING'
  | 'NOT_JOINED';

/** Minutes late past shift start + grace (0 = on time). */
export function lateMinutesFor(checkIn: Date, policy: PolicyRules, timeZone: string): number {
  return Math.max(0, localMinutes(checkIn, timeZone) - (minutesOf(policy.shiftStart) + policy.graceMinutes));
}

/** Status for a completed day from the minutes worked. */
export function statusForMinutes(worked: number, policy: PolicyRules): AttendanceStatus {
  if (worked >= policy.fullDayMinutes) return 'PRESENT';
  if (worked >= policy.halfDayMinutes) return 'HALF_DAY';
  return 'ABSENT';
}

export function workedMinutes(checkIn: Date, checkOut: Date): number {
  return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60_000));
}

export interface DayRecord {
  checkIn: Date | null;
  checkOut: Date | null;
  status: AttendanceStatus;
}

/** Approved leave covering a day (from the leave module). */
export interface DayLeave {
  /** Work from home: the day counts as worked */
  countsAsPresent: boolean;
  halfDay: boolean;
}

export function deriveDay(opts: {
  dateKey: string;
  todayKey: string;
  joiningKey: string;
  record: DayRecord | null;
  holiday: boolean;
  policy: PolicyRules;
  leave?: DayLeave | null;
}): DayStatus {
  const { dateKey, todayKey, joiningKey, record, holiday, policy, leave } = opts;
  if (dateKey < joiningKey) return 'NOT_JOINED';
  const workday = policy.workDays.includes(weekdayOfKey(dateKey));

  if (record?.checkIn) {
    if (!record.checkOut) return dateKey === todayKey ? 'WORKING' : dateKey < todayKey ? 'MISSING_CHECKOUT' : 'UPCOMING';
    // Working from home with check-in / out: shown as WFH (counts as worked)
    if (leave?.countsAsPresent) return 'WORK_FROM_HOME';
    return record.status;
  }
  if (record && record.status !== 'PRESENT') return record.status; // e.g. ON_LEAVE / ABSENT set by HR
  if (holiday) return 'HOLIDAY';
  if (!workday) return 'WEEKEND';
  // Approved leave (past or future) — a half day off still expects a check-in for the other half
  if (leave && !(leave.halfDay && dateKey === todayKey)) return leave.countsAsPresent ? 'WORK_FROM_HOME' : 'ON_LEAVE';
  if (dateKey > todayKey) return 'UPCOMING';
  if (dateKey === todayKey) return 'NOT_CHECKED_IN';
  return 'ABSENT';
}
