'use client';

import React from 'react';
import { EmojiText } from '@/components/motion/emoji';
import Link from 'next/link';
import { Heart, Mail, MapPin, Network } from 'lucide-react';
import type { DirectoryPerson, Today, TodayStatus } from '@/lib/company/profile';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

/** How "today" reads for colleagues — never why someone is away. */
export const TODAY: Record<TodayStatus, { label: string; dot: string; chip: string }> = {
  in: { label: 'Checked in', dot: 'bg-success', chip: 'Checked in' },
  wfh: { label: 'Working from home', dot: 'bg-info', chip: 'From home' },
  away: { label: 'Away today', dot: 'bg-warning', chip: 'Away today' },
  out: { label: 'Checked out', dot: 'bg-muted-foreground', chip: 'Checked out' },
  not_in: { label: 'Not checked in yet', dot: 'bg-muted-foreground/40', chip: 'Not in yet' },
  off: { label: 'Off today', dot: 'bg-muted-foreground/40', chip: 'Off today' },
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export function todayText(t: Today) {
  if (t.status === 'in' && t.since) return `Checked in since ${time(t.since)}`;
  if (t.status === 'out' && t.since) return `Checked out at ${time(t.since)}`;
  return TODAY[t.status].label;
}

const TINTS = ['from-indigo-500 to-violet-500', 'from-teal-500 to-emerald-500', 'from-amber-500 to-orange-500', 'from-pink-500 to-rose-500', 'from-sky-500 to-blue-500', 'from-fuchsia-500 to-purple-500', 'from-lime-500 to-green-600'];
/** Same colour for a team everywhere. */
export const tintFor = (key: string | null | undefined) => {
  const s = key ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length]!;
};

/** A big photo, or the initials on the team's colour. */
export function Photo({ person, className, rounded = 'rounded-xl', textClass = 'text-3xl' }: { person: Pick<DirectoryPerson, 'firstName' | 'lastName' | 'avatarUrl' | 'department'>; className?: string; rounded?: string; textClass?: string }) {
  const name = `${person.firstName} ${person.lastName}`;
  return person.avatarUrl ? (
    <img src={person.avatarUrl} alt={name} className={cn('object-cover', rounded, className)} />
  ) : (
    <span className={cn('flex items-center justify-center bg-gradient-to-br font-extrabold text-white', tintFor(person.department?.id), rounded, textClass, className)} aria-label={name}>
      {initials(name)}
    </span>
  );
}

export function StatusPill({ today, className }: { today: Today; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-2 py-0.5 text-[10.5px] font-bold text-foreground shadow-card backdrop-blur', className)} title={todayText(today)}>
      <i className={cn('h-1.5 w-1.5 rounded-full', TODAY[today.status].dot, today.status === 'in' && 'animate-pulse')} />
      {TODAY[today.status].chip}
    </span>
  );
}

/** Directory card: photo with today's status and celebrations, then name, role, team and quick actions. */
export function PhotoCard({ person, onOpen }: { person: DirectoryPerson; onOpen: () => void }) {
  const f = person.flags;
  const ribbon = f?.birthdayToday ? '🎂 Birthday today' : f?.anniversaryYears ? `🏆 ${f.anniversaryYears} year${f.anniversaryYears === 1 ? '' : 's'} today` : f?.newJoinerDays !== null && f?.newJoinerDays !== undefined ? `✦ New · ${f.newJoinerDays < 7 ? `${f.newJoinerDays || 'first'} day${f.newJoinerDays === 1 ? '' : 's'}` : `${Math.round(f.newJoinerDays / 7)} week${Math.round(f.newJoinerDays / 7) === 1 ? '' : 's'}`}` : null;
  return (
    <article className="m-lift group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <button type="button" onClick={onOpen} className="relative block aspect-[4/3] w-full overflow-hidden text-left" aria-label={`Quick look at ${person.firstName} ${person.lastName}`}>
        <Photo person={person} rounded="" className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]" textClass="text-4xl" />
        {person.today && <StatusPill today={person.today} className="absolute bottom-2 left-2" />}
        {ribbon && <span className="absolute right-2 top-2 rounded-full bg-surface/95 px-2 py-0.5 text-[10.5px] font-bold text-foreground shadow-card"><EmojiText text={ribbon} play="appear" /></span>}
      </button>
      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-2 pt-3">
        <button type="button" onClick={onOpen} className="truncate text-left font-semibold hover:text-primary">{person.firstName} {person.lastName}</button>
        <p className="truncate text-xs text-muted-foreground">{person.designation?.name ?? '—'}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {person.department && <span className="truncate rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold">{person.department.name}</span>}
          {person.location && <span className="inline-flex items-center gap-1 truncate rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold"><MapPin className="h-3 w-3" />{person.location.name}</span>}
        </div>
      </div>
      <div className="flex gap-1.5 px-3.5 pb-3.5">
        <a href={`mailto:${person.email}`} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-border text-xs font-semibold hover:bg-subtle"><Mail className="h-3.5 w-3.5" />Email</a>
        <Link href={`/app/kudos?to=${person.id}`} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-border text-xs font-semibold hover:bg-subtle"><Heart className="h-3.5 w-3.5" />Kudos</Link>
        <button type="button" onClick={onOpen} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-border text-xs font-semibold hover:bg-subtle"><Network className="h-3.5 w-3.5" />Team</button>
      </div>
    </article>
  );
}
