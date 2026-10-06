'use client';

import React from 'react';
import { Emoji } from '@/components/motion/emoji';
import { toast } from 'sonner';
import { SmilePlus } from 'lucide-react';
import { ANNOUNCEMENT_REACTIONS, useReactAnnouncement, useRsvp, type Announcement, type Category, type Cover, type Rsvp } from '@/lib/company/engagement';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { MENTION, MentionChip } from '@/components/engagement/mentions';

export const CATEGORIES: Record<Category, { label: string; emoji: string; pill: string; cover: Cover }> = {
  policy: { label: 'Policy', emoji: '📘', pill: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300', cover: 'indigo' },
  event: { label: 'Event', emoji: '📅', pill: 'bg-teal-500/10 text-teal-600 dark:text-teal-300', cover: 'teal' },
  celebrate: { label: 'Celebration', emoji: '🎉', pill: 'bg-pink-500/10 text-pink-600 dark:text-pink-300', cover: 'rose' },
  update: { label: 'Update', emoji: '📣', pill: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', cover: 'sky' },
  urgent: { label: 'Urgent', emoji: '⚠️', pill: 'bg-red-500/10 text-red-600 dark:text-red-300', cover: 'sunset' },
};
export const CATEGORY_ORDER: Category[] = ['policy', 'event', 'celebrate', 'update', 'urgent'];

export const COVERS: Record<Cover, string> = {
  indigo: 'from-indigo-600 via-violet-600 to-purple-600',
  teal: 'from-teal-600 via-emerald-500 to-green-500',
  sunset: 'from-amber-500 via-orange-500 to-pink-600',
  sky: 'from-sky-500 via-blue-500 to-indigo-500',
  rose: 'from-pink-500 via-rose-500 to-fuchsia-600',
  slate: 'from-slate-600 via-slate-700 to-slate-800',
};

export const coverOf = (a: Pick<Announcement, 'cover' | 'category'>) => COVERS[a.cover ?? CATEGORIES[a.category]?.cover ?? 'indigo'];
export const emojiOf = (a: Pick<Announcement, 'coverEmoji' | 'category'>) => a.coverEmoji || CATEGORIES[a.category]?.emoji || '📣';

export function CategoryPill({ category, className }: { category: Category; className?: string }) {
  const c = CATEGORIES[category] ?? CATEGORIES.update;
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', c.pill, className)}>{c.emoji} {c.label}</span>;
}

export function audienceLabel(a: Pick<Announcement, 'audience'>): string {
  return a.audience === 'COMPANY' ? 'Everyone' : a.audience === 'TEAM' ? 'Team' : a.audience === 'DEPARTMENTS' ? 'Selected departments' : 'Selected locations';
}

/** About 200 words a minute. */
export function readTime(body: string): string {
  const words = body.trim().split(/\s+/).length;
  return words < 60 ? 'Under a minute' : `${Math.ceil(words / 200)} min read`;
}

// ─── Formatting: **bold**, *italic*, [text](https://…), "- " bullets, @[Name](id) ──

const INLINE = /(@\[[^\]\n]{1,80}\]\([0-9a-f-]{36}\)|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+)/gi;
function inline(text: string, key: string): React.ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const k = `${key}-${i}`;
    const mention = /^@\[([^\]\n]{1,80})\]\([0-9a-f-]{36}\)$/i.exec(part);
    if (mention) return <MentionChip key={k} name={mention[1]!} />;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={k}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={k}>{part.slice(1, -1)}</em>;
    const md = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
    if (md) return <a key={k} href={md[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{md[1]}</a>;
    if (/^https?:\/\//.test(part)) return <a key={k} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">{part}</a>;
    return <React.Fragment key={k}>{part}</React.Fragment>;
  });
}

/** Safe, simple formatting (no HTML is ever injected). */
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    const items = list;
    blocks.push(<ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">{items.map((l, i) => <li key={i}>{inline(l, `li-${blocks.length}-${i}`)}</li>)}</ul>);
    list = [];
  };
  lines.forEach((line, i) => {
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
    if (bullet) return void list.push(bullet[1]!);
    flush();
    blocks.push(line.trim() ? <p key={`p-${i}`}>{inline(line, `p-${i}`)}</p> : <div key={`br-${i}`} className="h-2" />);
  });
  flush();
  return <div className={cn('space-y-1 leading-relaxed', className)}>{blocks}</div>;
}

/** Plain preview text for cards (formatting removed). */
export function plain(text: string): string {
  return text.replace(MENTION, '@$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^\s*[-•*]\s+/gm, '• ');
}

// ─── Reactions and RSVP ─────────────────────────────────────

/** One reaction: the emoji does its move on hover; a new reaction pops it and floats up 3 copies. */
function ReactionPill({ emoji, count, mine, className, onReact }: { emoji: string; count: number; mine: boolean; className: string; onReact: () => void }) {
  const [fire, setFire] = React.useState(0);
  return (
    <button
      type="button"
      aria-pressed={mine}
      aria-label={`React ${emoji}`}
      onClick={() => { if (!mine) setFire((n) => n + 1); onReact(); }}
      className={cn('emo-host', className, mine ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface hover:bg-subtle')}
    >
      <Emoji e={emoji} fire={fire} burst /> <span className="tabular-nums">{count}</span>
    </button>
  );
}

export function ReactionBar({ a, size = 'md' }: { a: Announcement; size?: 'sm' | 'md' }) {
  const react = useReactAnnouncement();
  if (!a.allowReactions || a.status !== 'published') return null;
  const go = (emoji: string) => react.mutate({ id: a.id, emoji }, { onError: (e) => toast.error(getApiErrorMessage(e, 'Could not react')) });
  const pill = cn('inline-flex items-center gap-1 rounded-full border font-semibold transition-colors', size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs');
  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.preventDefault()}>
      {a.reactions.map((r) => <ReactionPill key={r.emoji} emoji={r.emoji} count={r.count} mine={r.mine} className={pill} onReact={() => go(r.emoji)} />)}
      <DropdownMenu
        label="Add a reaction"
        align="left"
        items={ANNOUNCEMENT_REACTIONS.map((e) => ({ label: e, onSelect: () => go(e) }))}
        trigger={() => (
          <button type="button" aria-label="Add a reaction" className={cn(pill, 'border-border bg-surface text-muted-foreground hover:bg-subtle')}>
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        )}
      />
    </div>
  );
}

export function RsvpBar({ a, onDark }: { a: Announcement; onDark?: boolean }) {
  const rsvp = useRsvp();
  if (!a.eventAt || a.status !== 'published') return null;
  const set = (r: Rsvp) => rsvp.mutate({ id: a.id, response: a.rsvp.mine === r ? null : r }, { onError: (e) => toast.error(getApiErrorMessage(e, 'Could not reply')) });
  const btn = (on: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
      onDark ? (on ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25') : on ? 'bg-primary text-primary-foreground' : 'border border-border bg-surface hover:bg-subtle',
    );
  return (
    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.preventDefault()}>
      <button type="button" className={btn(a.rsvp.mine === 'going')} aria-pressed={a.rsvp.mine === 'going'} onClick={() => set('going')}>✓ I’ll be there{a.rsvp.going ? ` · ${a.rsvp.going}` : ''}</button>
      <button type="button" className={btn(a.rsvp.mine === 'maybe')} aria-pressed={a.rsvp.mine === 'maybe'} onClick={() => set('maybe')}>Maybe{a.rsvp.maybe ? ` · ${a.rsvp.maybe}` : ''}</button>
      <button type="button" className={btn(a.rsvp.mine === 'no')} aria-pressed={a.rsvp.mine === 'no'} onClick={() => set('no')}>Can’t make it</button>
    </div>
  );
}

const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const eventWhen = (iso: string) => when.format(new Date(iso));

/** Downloads an .ics file so the event lands in Outlook / Google / Apple calendar. */
export function downloadIcs(a: Pick<Announcement, 'id' | 'title' | 'body' | 'eventAt' | 'eventPlace'>) {
  if (!a.eventAt) return;
  const start = new Date(a.eventAt);
  const end = new Date(start.getTime() + 60 * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HRMS//Announcements//EN', 'BEGIN:VEVENT',
    `UID:${a.id}@hrms`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(a.title)}`, ...(a.eventPlace ? [`LOCATION:${esc(a.eventPlace)}`] : []), `DESCRIPTION:${esc(plain(a.body).slice(0, 900))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${a.title.slice(0, 40).replace(/[^\w ]+/g, '').trim() || 'event'}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "in 3 days 06 h", "in 4 h 10 min", "now" */
export function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'happening now';
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `in ${d} day${d === 1 ? '' : 's'} ${String(h).padStart(2, '0')} h`;
  if (h > 0) return `in ${h} h ${m % 60} min`;
  return `in ${m} min`;
}
