import { describe, expect, it } from 'vitest';
import { countLeaveDays, usableCarry } from './leave-rules';

const base = { halfDay: null, includeNonWorkingDays: false, workDays: [1, 2, 3, 4, 5], holidayKeys: new Set<string>() };

describe('countLeaveDays', () => {
  // 2026-10-09 is a Friday, 2026-10-12 the Monday after
  it('skips the weekend by default', () => {
    expect(countLeaveDays({ ...base, startKey: '2026-10-09', endKey: '2026-10-12' }).days).toBe(2);
  });

  it('sandwich rule counts the weekend between two leave days', () => {
    const r = countLeaveDays({ ...base, startKey: '2026-10-09', endKey: '2026-10-12', sandwich: true });
    expect(r.days).toBe(4);
    expect(r.dates).toEqual(['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']);
  });

  it('sandwich rule does not add days off at the edges', () => {
    // Sat–Mon: only Monday is a leave day, nothing is "between"
    expect(countLeaveDays({ ...base, startKey: '2026-10-10', endKey: '2026-10-12', sandwich: true }).days).toBe(1);
  });

  it('a holiday between leave days counts with the sandwich rule', () => {
    const r = countLeaveDays({ ...base, holidayKeys: new Set(['2026-10-07']), startKey: '2026-10-06', endKey: '2026-10-08', sandwich: true });
    expect(r.days).toBe(3);
  });
});

describe('usableCarry', () => {
  const opts = { carryExpiry: '03-31', year: 2026, carriedForward: 10, usedDays: 4, pendingDays: 0 };

  it('keeps all carried days before the expiry date', () => {
    expect(usableCarry({ ...opts, today: new Date('2026-03-31T10:00:00Z') })).toBe(10);
  });

  it('after expiry only the carried days already used count', () => {
    expect(usableCarry({ ...opts, today: new Date('2026-04-01T00:00:00Z') })).toBe(4);
  });

  it('never expires without a date', () => {
    expect(usableCarry({ ...opts, carryExpiry: null, today: new Date('2026-12-31T00:00:00Z') })).toBe(10);
  });
});
