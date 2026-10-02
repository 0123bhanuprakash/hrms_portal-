import type { HalfDaySession, LeaveAccrual } from '@prisma/client';
import { addDays, weekdayOfKey } from '../attendance/time-zone';

// ============================================================
// Leave rules — pure functions, no database.
// ============================================================

/** Dates a request covers and how many leave days they cost. */
export function countLeaveDays(opts: {
  startKey: string;
  endKey: string;
  halfDay: HalfDaySession | null;
  includeNonWorkingDays: boolean;
  workDays: number[];
  holidayKeys: Set<string>;
}): { days: number; dates: string[] } {
  const dates: string[] = [];
  for (let key = opts.startKey; key <= opts.endKey; key = addDays(key, 1)) {
    const off = !opts.workDays.includes(weekdayOfKey(key)) || opts.holidayKeys.has(key);
    if (opts.includeNonWorkingDays || !off) dates.push(key);
  }
  const days = opts.halfDay && dates.length === 1 ? 0.5 : dates.length;
  return { days, dates };
}

/** Rounds to the nearest half day (balances are kept in 0.5 steps). */
export const toHalf = (n: number) => Math.round(n * 2) / 2;

/**
 * Full-year entitlement for someone who joined part-way through the year:
 * quota × remaining months (joining month included) / 12.
 */
export function proratedQuota(annualQuota: number, year: number, joining: Date): number {
  const joinYear = joining.getUTCFullYear();
  if (joinYear < year) return annualQuota;
  if (joinYear > year) return 0;
  const months = 12 - joining.getUTCMonth();
  return toHalf((annualQuota * months) / 12);
}

/**
 * What can be used so far this year. Up-front types: everything.
 * Monthly types: the entitlement spread over the months served, credited
 * at the start of each month.
 */
export function accruedSoFar(opts: { accrual: LeaveAccrual; allocated: number; year: number; joining: Date; today: Date }): number {
  const { accrual, allocated, year, joining, today } = opts;
  if (accrual !== 'MONTHLY') return allocated;
  const nowYear = today.getUTCFullYear();
  if (year < nowYear) return allocated;
  if (year > nowYear) return 0;
  const startMonth = joining.getUTCFullYear() === year ? joining.getUTCMonth() : 0;
  const servable = 12 - startMonth;
  const served = Math.max(0, today.getUTCMonth() - startMonth + 1);
  return toHalf((allocated * Math.min(served, servable)) / servable);
}

export interface BalanceNumbers {
  allocated: number;
  carriedForward: number;
  adjusted: number;
  usedDays: number;
  pendingDays: number;
}

/** Days still available to request (null = unlimited). */
export function availableDays(accrual: LeaveAccrual, accrued: number, b: BalanceNumbers): number | null {
  if (accrual === 'NONE') return null;
  return toHalf(accrued + b.carriedForward + b.adjusted - b.usedDays - b.pendingDays);
}
