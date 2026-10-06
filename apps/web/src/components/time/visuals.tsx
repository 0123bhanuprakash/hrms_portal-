'use client';

import React from 'react';
import { cn } from '@/lib/cn';
import type { DayStatus } from '@/lib/company/attendance';

// ============================================================
// Small visuals shared by the Time pages (attendance + leave).
// Styles: app/motion.css (.tm-*). Motion stops with "Reduce motion".
// ============================================================

/** Minutes since midnight of an instant in a time zone. */
export function minuteOf(iso: string | Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
}
export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Solid colour per day status (bars, squares, dots). */
export const STATUS_BG: Record<DayStatus, string> = {
  PRESENT: 'bg-success',
  HALF_DAY: 'bg-warning',
  ABSENT: 'bg-destructive',
  MISSING_CHECKOUT: 'bg-violet-500',
  ON_LEAVE: 'bg-pink-500',
  WORK_FROM_HOME: 'bg-info',
  HOLIDAY: 'bg-teal-500',
  WEEKEND: 'bg-muted',
  WORKING: 'bg-primary',
  NOT_CHECKED_IN: 'bg-transparent ring-1 ring-inset ring-border',
  UPCOMING: 'bg-transparent ring-1 ring-inset ring-dashed ring-border',
  NOT_JOINED: 'bg-transparent',
};

/** Progress ring that fills in on load. */
export function Ring({
  value,
  max,
  size = 96,
  stroke = 9,
  className,
  trackClass = 'stroke-muted',
  barClass = 'stroke-primary',
  children,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  className?: string;
  trackClass?: string;
  barClass?: string;
  children?: React.ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const len = max > 0 ? Math.max(0, Math.min(1, value / max)) * c : 0;
  return (
    <span role="img" aria-label={label} className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${len} ${c}`}
          className={cn('tm-ring transition-[stroke-dasharray] duration-700', barClass)}
          style={{ '--tm-len': `${len}` } as React.CSSProperties}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">{children}</span>
    </span>
  );
}

export interface LineBlock {
  /** Minutes since midnight; may run past 1440 for night shifts */
  from: number;
  to: number;
  className: string;
  title?: string;
}

/**
 * A day on a 06:00–22:00 line (wider when blocks or the shift fall outside):
 * the shift as a dashed band, work blocks, and an optional "now" marker.
 */
export function DayLine({
  blocks,
  shift,
  now,
  startHour = 6,
  endHour = 22,
  ruler = true,
  className,
  height = 'h-4',
  dark = false,
}: {
  blocks: LineBlock[];
  shift?: { start: number; end: number } | null;
  now?: number | null;
  startHour?: number;
  endHour?: number;
  ruler?: boolean;
  className?: string;
  height?: string;
  dark?: boolean;
}) {
  const all = [...blocks.flatMap((b) => [b.from, b.to]), ...(shift ? [shift.start, shift.end] : []), ...(now != null ? [now] : [])];
  const lo = Math.min(startHour * 60, ...all.map((m) => Math.floor(m / 120) * 120));
  const hi = Math.max(endHour * 60, ...all.map((m) => Math.ceil(m / 120) * 120));
  const pct = (m: number) => `${((Math.max(lo, Math.min(hi, m)) - lo) / (hi - lo)) * 100}%`;
  const ticks: number[] = [];
  for (let m = lo; m <= hi; m += hi - lo > 1200 ? 240 : 120) ticks.push(m);
  return (
    <div className={className}>
      {ruler && (
        <div className={cn('relative mb-1 h-3 text-[10px] font-semibold tabular-nums', dark ? 'text-white/60' : 'text-muted-foreground')} aria-hidden>
          {ticks.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>{String(Math.floor(m / 60) % 24).padStart(2, '0')}</span>
          ))}
        </div>
      )}
      <div className={cn('relative rounded-md', height, dark ? 'bg-white/10' : 'bg-muted')}>
        {shift && (
          <span
            aria-hidden
            className={cn('absolute -bottom-1 -top-1 rounded-md border-[1.5px] border-dashed', dark ? 'border-white/40' : 'border-primary/40 bg-primary/5')}
            style={{ left: pct(shift.start), width: `calc(${pct(shift.end)} - ${pct(shift.start)})` }}
          />
        )}
        {blocks.map((b, i) => (
          <span
            key={i}
            title={b.title}
            className={cn('m-fill-w absolute bottom-0.5 top-0.5 rounded-sm', b.className)}
            style={{ left: pct(b.from), width: `max(3px, calc(${pct(b.to)} - ${pct(b.from)}))`, animationDelay: `${i * 100}ms` }}
          />
        ))}
        {now != null && <span aria-hidden className="tm-now absolute -bottom-1.5 -top-1.5 w-0.5 rounded-full bg-destructive" style={{ left: pct(now) }} />}
      </div>
    </div>
  );
}

/** A row of small squares, one per day. */
export function StatusSquares({ days, className }: { days: Array<{ date: string; status: DayStatus; late?: boolean }>; className?: string }) {
  return (
    <div className={cn('grid grid-cols-10 gap-1', className)}>
      {days.map((d, i) => (
        <span
          key={d.date}
          title={`${d.date}${d.late ? ' · late' : ''}`}
          className={cn('m-pop relative aspect-square rounded-[4px]', STATUS_BG[d.status])}
          style={{ animationDelay: `${i * 15}ms` }}
        >
          {d.late && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-warning ring-1 ring-surface" />}
        </span>
      ))}
    </div>
  );
}

/** "17" as two flip-board digits. */
export function FlipDigits({ value, className, tileClass }: { value: number; className?: string; tileClass?: string }) {
  const digits = String(Math.max(0, value)).padStart(2, '0').split('');
  return (
    <span className={cn('inline-flex gap-1.5', className)} aria-label={String(value)}>
      {digits.map((d, i) => (
        <span key={i} className={cn('relative flex h-12 w-10 items-center justify-center overflow-hidden rounded-lg text-3xl font-bold tabular-nums shadow-lg', tileClass ?? 'bg-surface text-foreground')}>
          <span className="tm-flip" style={{ animationDelay: `${i * 120}ms` }}>{d}</span>
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
        </span>
      ))}
    </span>
  );
}

/** A paper plane that takes off once (when `fire` changes). */
export function PlaneTakeoff({ fire }: { fire: number }) {
  if (!fire) return null;
  return (
    <svg key={fire} aria-hidden className="tm-plane pointer-events-none absolute bottom-2 left-1/2 z-10 text-primary" width="40" height="24" viewBox="0 0 70 40">
      <path d="M2 22 L40 18 L58 4 L64 6 L52 20 L68 22 L64 26 L52 24 L58 36 L52 38 L40 26 L2 24 Z" fill="currentColor" />
    </svg>
  );
}

/** YYYY-MM-DD of a Date (UTC). */
export const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10);

/** Whole days between two YYYY-MM-DD keys (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);
