import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY as policy, deriveDay } from './attendance-rules';

// 2026-10-12 is a Monday
const today = '2026-10-12';
const day = (dateKey: string, opts: Partial<Parameters<typeof deriveDay>[0]> = {}) =>
  deriveDay({ dateKey, todayKey: today, joiningKey: '2025-01-01', record: null, holiday: false, policy, ...opts });
const wfh = { countsAsPresent: true, halfDay: false };
const wfhHalf = { countsAsPresent: true, halfDay: true };
const checkedIn = (status: 'PRESENT' | 'HALF_DAY' = 'PRESENT') => ({ checkIn: new Date('2026-10-09T04:00:00Z'), checkOut: new Date('2026-10-09T13:00:00Z'), status });

describe('deriveDay — work from home needs a check-in', () => {
  it('counts a WFH day as worked once checked in and out', () => {
    expect(day('2026-10-09', { leave: wfh, record: checkedIn() })).toBe('WORK_FROM_HOME');
    expect(day('2026-10-09', { leave: wfhHalf, record: checkedIn('HALF_DAY') })).toBe('WORK_FROM_HOME');
  });

  it('flags a past WFH day with no check-in (full or half day)', () => {
    expect(day('2026-10-09', { leave: wfh })).toBe('WFH_NOT_CHECKED_IN');
    expect(day('2026-10-09', { leave: wfhHalf })).toBe('WFH_NOT_CHECKED_IN');
  });

  it('shows WFH while checked in today, before checking out', () => {
    const open = { checkIn: new Date('2026-10-12T04:00:00Z'), checkOut: null, status: 'PRESENT' as const };
    expect(day(today, { leave: wfh, record: open })).toBe('WORK_FROM_HOME');
    expect(day(today, { leave: wfhHalf, record: open })).toBe('WORK_FROM_HOME');
    expect(day(today, { record: open })).toBe('WORKING');
  });

  it('waits for the check-in today, and shows planned WFH ahead', () => {
    expect(day(today, { leave: wfh })).toBe('NOT_CHECKED_IN');
    expect(day(today, { leave: wfhHalf })).toBe('NOT_CHECKED_IN');
    expect(day('2026-10-14', { leave: wfh })).toBe('WORK_FROM_HOME');
  });

  it('still shows a check-in without check-out as missing, and leaves other leave alone', () => {
    expect(day('2026-10-09', { leave: wfh, record: { checkIn: new Date('2026-10-09T04:00:00Z'), checkOut: null, status: 'PRESENT' } })).toBe('MISSING_CHECKOUT');
    expect(day('2026-10-09', { leave: { countsAsPresent: false, halfDay: false } })).toBe('ON_LEAVE');
    expect(day('2026-10-10', { leave: wfh })).toBe('WEEKEND');
    expect(day('2026-10-09', { leave: wfh, holiday: true })).toBe('HOLIDAY');
  });
});
