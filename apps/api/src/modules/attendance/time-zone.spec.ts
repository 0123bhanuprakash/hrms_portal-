import { describe, expect, it } from 'vitest';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey, localMinutes, minutesOf, monthKeys, weekdayOfKey, zonedInstant } from './time-zone';

describe('time-zone helpers', () => {
  it('local date in the company time zone, not UTC', () => {
    // 20:00 UTC on 2 Oct is already 3 Oct in India (UTC+5:30)
    const t = new Date('2026-10-02T20:00:00Z');
    expect(localDateKey(t, 'Asia/Kolkata')).toBe('2026-10-03');
    expect(localDateKey(t, 'UTC')).toBe('2026-10-02');
    expect(localDateKey(t, 'America/New_York')).toBe('2026-10-02');
  });

  it('local minutes of the day', () => {
    expect(localMinutes(new Date('2026-10-02T03:30:00Z'), 'Asia/Kolkata')).toBe(9 * 60);
  });

  it('wall-clock time → instant and back', () => {
    const t = zonedInstant('2026-10-05', '09:15', 'Asia/Kolkata');
    expect(t.toISOString()).toBe('2026-10-05T03:45:00.000Z');
    expect(localMinutes(t, 'Asia/Kolkata')).toBe(minutesOf('09:15'));
  });

  it('date keys round-trip and add days across months and years', () => {
    expect(keyFromDate(dateFromKey('2026-02-28'))).toBe('2026-02-28');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('weekday and month keys', () => {
    expect(weekdayOfKey('2026-10-05')).toBe(1); // Monday
    expect(weekdayOfKey('2026-10-04')).toBe(0); // Sunday
    const feb = monthKeys('2026-02');
    expect(feb).toHaveLength(28);
    expect(feb[0]).toBe('2026-02-01');
    expect(feb[27]).toBe('2026-02-28');
  });

  it('validates time-zone names (cached)', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
