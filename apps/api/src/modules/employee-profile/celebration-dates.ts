import type { PrismaService } from '../prisma/prisma.service';
import { dateFromKey, isValidTimeZone, localDateKey } from '../attendance/time-zone';

// Birthdays and work anniversaries: shared by Home's spotlight and wishes.
// Dates are calendar dates (@db.Date → UTC midnight); compare in UTC.

/** The company's time zone and today's date there (UTC midnight of that calendar day). */
export async function companyToday(prisma: PrismaService, companyId: string): Promise<{ timeZone: string; today: Date }> {
  const settings = await prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
  const timeZone = settings?.timezone && isValidTimeZone(settings.timezone) ? settings.timezone : 'Asia/Kolkata';
  return { timeZone, today: dateFromKey(localDateKey(new Date(), timeZone)) };
}

export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Next anniversary of a date (today counts); 29 Feb falls on 28 Feb in non-leap years. */
export function nextOccurrence(date: Date, today: Date): Date {
  const at = (year: number) => {
    const d = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
    return d.getUTCMonth() === date.getUTCMonth() ? d : new Date(Date.UTC(year, date.getUTCMonth() + 1, 0));
  };
  const thisYear = at(today.getUTCFullYear());
  return thisYear >= today ? thisYear : at(today.getUTCFullYear() + 1);
}

/** "MM-DD" — no year, so birthdays never reveal age. */
export function monthDay(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
