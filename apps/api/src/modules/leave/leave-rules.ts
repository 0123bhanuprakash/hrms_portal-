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
  /** Sandwich rule: days off between two leave days count too */
  sandwich?: boolean;
}): { days: number; dates: string[] } {
  const dates: string[] = [];
  const isOff = (key: string) => !opts.workDays.includes(weekdayOfKey(key)) || opts.holidayKeys.has(key);
  const working: string[] = [];
  for (let key = opts.startKey; key <= opts.endKey; key = addDays(key, 1)) if (!isOff(key)) working.push(key);
  const [first, last] = [working[0], working[working.length - 1]];
  for (let key = opts.startKey; key <= opts.endKey; key = addDays(key, 1)) {
    const between = Boolean(opts.sandwich && first && last && key > first && key < last);
    if (opts.includeNonWorkingDays || !isOff(key) || between) dates.push(key);
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

/**
 * Carried-forward days still usable: after the type's expiry date (MM-DD) in
 * the year, only the carried days already used count (we assume carried days are used first).
 */
export function usableCarry(opts: { carryExpiry: string | null; year: number; today: Date; carriedForward: number; usedDays: number; pendingDays: number }): number {
  const { carryExpiry, year, today, carriedForward } = opts;
  if (!carryExpiry || !carriedForward) return carriedForward;
  const expiry = new Date(`${year}-${carryExpiry}T23:59:59Z`);
  if (today <= expiry) return carriedForward;
  return Math.min(carriedForward, opts.usedDays + opts.pendingDays);
}

/** Days still available to request (null = unlimited). */
export function availableDays(accrual: LeaveAccrual, accrued: number, b: BalanceNumbers): number | null {
  if (accrual === 'NONE') return null;
  return toHalf(accrued + b.carriedForward + b.adjusted - b.usedDays - b.pendingDays);
}

// ─── Year end: carry, lapse, owe ──────────────────────────────

/**
 * Closing a year. Days left carry (up to the cap) or lapse. A balance below 0
 * is owed to next year: all of it when the type recovers minus balances,
 * otherwise only the part HR lent. Owed days not yet taken back roll on.
 */
export function closeYear(o: { left: number; carryForward: boolean; maxCarry: number; lendLimit: number; recoverNegative: boolean; owedLeft: number }): { carriedOut: number; lapsed: number; owedOut: number } {
  if (o.left >= 0) {
    const carriedOut = o.carryForward ? toHalf(Math.min(o.maxCarry, o.left)) : 0;
    return { carriedOut, lapsed: toHalf(o.left - carriedOut), owedOut: toHalf(o.owedLeft) };
  }
  const below = -o.left;
  const owed = o.recoverNegative ? below : Math.min(below, o.lendLimit);
  return { carriedOut: 0, lapsed: 0, owedOut: toHalf(owed + o.owedLeft) };
}

/** Owed days taken from a new year's balance: never below 0; the rest stays owed. */
export function takeBack(owed: number, room: number): { taken: number; stillOwed: number } {
  const taken = toHalf(Math.max(0, Math.min(owed, room)));
  return { taken, stillOwed: toHalf(owed - taken) };
}

// ─── Who can use a leave type ─────────────────────────────────

export type Availability = 'EVERYONE' | 'RULES' | 'GRANT_ONLY';

export interface EligibilityRules {
  availability: Availability;
  genders: string[];
  departmentIds: string[];
  locationIds: string[];
  designationIds: string[];
  employmentTypes: string[];
  minServiceMonths: number | null;
  managerIds: string[];
  managerDeep: boolean;
  projectIds: string[];
  members: Array<{ employeeId: string; mode: 'INCLUDE' | 'EXCLUDE' }>;
}

/** What the rules look at for one person. */
export interface PersonFacts {
  id: string;
  gender: string | null;
  departmentId: string | null;
  locationId: string | null;
  designationId: string | null;
  employmentType: string | null;
  joiningDate: Date;
  /** Managers above the person, direct manager first */
  managerChain: string[];
  /** Projects the person is a current member of */
  projectIds: string[];
}

/** Whole months served by `today` (joined 15 Jan → 1 month on 15 Feb). */
export function serviceMonths(joining: Date, today: Date): number {
  let months = (today.getUTCFullYear() - joining.getUTCFullYear()) * 12 + today.getUTCMonth() - joining.getUTCMonth();
  if (today.getUTCDate() < joining.getUTCDate()) months--;
  return Math.max(0, months);
}

/**
 * The rule fields only (ignores availability). Empty rule = anyone.
 * Named people: exclude beats include, include beats the rules.
 */
export function matchesRules(rules: EligibilityRules, p: PersonFacts, today: Date): boolean {
  const member = rules.members.find((m) => m.employeeId === p.id);
  if (member) return member.mode === 'INCLUDE';
  const anyOf = (list: string[], value: string | null) => !list.length || (value !== null && list.includes(value));
  if (!anyOf(rules.genders, p.gender)) return false;
  if (!anyOf(rules.departmentIds, p.departmentId)) return false;
  if (!anyOf(rules.locationIds, p.locationId)) return false;
  if (!anyOf(rules.designationIds, p.designationId)) return false;
  if (!anyOf(rules.employmentTypes, p.employmentType)) return false;
  if (rules.minServiceMonths && serviceMonths(p.joiningDate, today) < rules.minServiceMonths) return false;
  if (rules.managerIds.length) {
    const above = rules.managerDeep ? p.managerChain : p.managerChain.slice(0, 1);
    if (!above.some((m) => rules.managerIds.includes(m))) return false;
  }
  if (rules.projectIds.length && !p.projectIds.some((id) => rules.projectIds.includes(id))) return false;
  return true;
}

/** The type shows up for the person (balances, applying). Grant-only types need an active grant. */
export function isEligible(rules: EligibilityRules, p: PersonFacts, today: Date, hasGrant = false): boolean {
  if (rules.availability === 'GRANT_ONLY') return hasGrant;
  if (rules.availability === 'EVERYONE') return true;
  return matchesRules(rules, p, today);
}

/** Grant-only types: the person may ask HR for a grant. */
export const canAskForGrant = (rules: EligibilityRules, p: PersonFacts, today: Date) => rules.availability === 'GRANT_ONLY' && matchesRules(rules, p, today);

/** A grant with what is already taken from it. */
export interface GrantUse {
  id: string;
  days: number;
  validFrom: string;
  validTo: string;
  /** Days on pending + approved leave against it */
  taken: number;
}

/** The grant a request uses: covers the dates and has room, oldest first. */
export function pickGrant(grants: GrantUse[], startKey: string, endKey: string, days: number): { grant: GrantUse | null; problem: 'dates' | 'days' | null } {
  const covering = grants.filter((g) => g.validFrom <= startKey && endKey <= g.validTo).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  if (!covering.length) return { grant: null, problem: 'dates' };
  const room = covering.find((g) => toHalf(g.days - g.taken) >= days);
  return room ? { grant: room, problem: null } : { grant: null, problem: 'days' };
}
