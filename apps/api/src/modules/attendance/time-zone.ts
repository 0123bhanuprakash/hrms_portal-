// ============================================================
// Wall-clock helpers for a company time zone (IANA, e.g. Asia/Kolkata).
// Attendance "dates" are calendar dates in the company's zone, stored as
// UTC midnight (@db.Date). Instants (check-in / out) are real timestamps.
// ============================================================

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS.indexOf(parts.weekday!),
  };
}

/** "YYYY-MM-DD" of an instant in the zone. */
export function localDateKey(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** Minutes since local midnight. */
export function localMinutes(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  return w.hour * 60 + w.minute;
}

/** Zone offset (ms) at an instant: wall-clock-as-UTC minus the instant. */
function offsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" + "HH:mm" in the zone → the real instant. */
export function zonedInstant(dateKey: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // Re-check once: the offset can differ on the other side of a DST change
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** "YYYY-MM-DD" ↔ Date at UTC midnight (how @db.Date values arrive). */
export function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}
export function keyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a calendar date key. */
export function weekdayOfKey(key: string): number {
  return dateFromKey(key).getUTCDay();
}

export function addDays(key: string, days: number): string {
  const d = dateFromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return keyFromDate(d);
}

/** Every date key of a month ("YYYY-MM"). */
export function monthKeys(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** "HH:mm" → minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
