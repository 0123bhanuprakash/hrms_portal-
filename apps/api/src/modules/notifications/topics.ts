// Notification topics people can switch on/off (in the app / by email),
// quiet hours for emails, and the daily summary.

export const NOTIFICATION_TOPICS = [
  { key: 'time', label: 'Leave & attendance', prefixes: ['leave.', 'attendance.', 'delegation.'] },
  { key: 'work', label: 'Timesheets & projects', prefixes: ['timesheet.', 'project.'] },
  { key: 'expenses', label: 'Expenses', prefixes: ['expense.'] },
  { key: 'helpdesk', label: 'Helpdesk', prefixes: ['ticket.'] },
  { key: 'announcements', label: 'Announcements', prefixes: ['announcement.'] },
  { key: 'kudos', label: 'Shout-outs & celebrations', prefixes: ['kudos.', 'celebration.'] },
  { key: 'assets', label: 'Assets', prefixes: ['asset.'] },
] as const;

export type TopicKey = (typeof NOTIFICATION_TOPICS)[number]['key'];
export type TopicPrefs = Partial<Record<TopicKey, { app?: boolean; email?: boolean }>>;
export interface QuietHours {
  on: boolean;
  /** "HH:MM" */
  from: string;
  to: string;
  /** Also quiet all of Saturday and Sunday */
  weekends: boolean;
}

/** Topic of a notification type (null = always on, e.g. account messages). */
export function topicOf(type: string): TopicKey | null {
  return NOTIFICATION_TOPICS.find((t) => t.prefixes.some((p) => type.startsWith(p)))?.key ?? null;
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Local time + weekday in a time zone. */
export function localClock(now: Date, timeZone: string): { minutes: number; weekday: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { minutes: +get('hour') * 60 + +get('minute'), weekday, dateKey: `${get('year')}-${get('month')}-${get('day')}` };
}

/** Is it quiet for this person right now? */
export function isQuiet(q: QuietHours | null | undefined, now: Date, timeZone: string): boolean {
  if (!q?.on) return false;
  const c = localClock(now, timeZone);
  if (q.weekends && (c.weekday === 0 || c.weekday === 6)) return true;
  const from = minutes(q.from);
  const to = minutes(q.to);
  if (from === to) return false;
  return from < to ? c.minutes >= from && c.minutes < to : c.minutes >= from || c.minutes < to;
}

/** The daily summary goes out from this local hour. */
export const SUMMARY_HOUR = 9;
