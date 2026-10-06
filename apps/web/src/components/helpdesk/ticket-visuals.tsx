'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { Queue, Ticket } from '@/lib/company/helpdesk';
import { cn } from '@/lib/cn';

export const QUEUE_EMOJI: Record<Queue, string> = { IT: '💻', HR: '🧑‍💼', FINANCE: '💰', DEVOPS: '🚀' };

/** "~2 h", "~1 day" from minutes */
export function replyTime(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60) return `~${Math.max(5, Math.round(minutes / 5) * 5)} min`;
  const h = Math.round(minutes / 60);
  return h < 24 ? `~${h} h` : `~${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'}`;
}

type Timed = Pick<Ticket, 'status' | 'createdAt' | 'firstRespondedAt' | 'firstResponseDueAt' | 'resolutionDueAt' | 'resolvedAt'>;

/**
 * How much of the current target is used: the first-reply target until
 * someone replies, then the resolve target. null when there is no clock
 * (resolved, closed) and paused (waiting) shows where it stopped.
 */
export function targetUse(t: Timed, now = Date.now()): { used: number; label: string; done: boolean } {
  const start = new Date(t.createdAt).getTime();
  if (t.status === 'RESOLVED' || t.status === 'CLOSED') {
    const late = t.resolvedAt ? new Date(t.resolvedAt) > new Date(t.resolutionDueAt) : false;
    return { used: late ? 1 : 0.5, label: late ? 'late' : 'on time', done: true };
  }
  const due = new Date(t.firstRespondedAt ? t.resolutionDueAt : t.firstResponseDueAt).getTime();
  const used = Math.max(0, (now - start) / Math.max(1, due - start));
  return { used, label: `${Math.min(999, Math.round(used * 100))}%`, done: false };
}

const tone = (used: number) => (used >= 1 ? 'hsl(var(--destructive))' : used > 0.75 ? 'hsl(var(--warning))' : 'hsl(var(--success))');

/** Ring that fills as the reply / resolve time is used: green → amber at 75% → red when late. */
export function TargetRing({ t, size = 44 }: { t: Timed; size?: number }) {
  const { used, label, done } = targetUse(t);
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const color = done ? (used >= 1 ? 'hsl(var(--warning))' : 'hsl(var(--success))') : tone(used);
  const title = done ? `Solved ${label}` : t.status === 'WAITING' ? 'Paused — waiting for a reply' : `${label} of the ${t.firstRespondedAt ? 'resolve' : 'first-reply'} time used`;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={title} role="img" aria-label={title}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={4} />
        <circle className="m-draw" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(done ? c : c * Math.min(used, 1)).toFixed(1)} ${c.toFixed(1)}`} />
      </svg>
      {done ? <Check className={size < 32 ? 'relative h-3 w-3' : 'relative h-4 w-4'} style={{ color }} /> : size < 32 ? null : <span className="relative text-[10px] font-bold tabular-nums" style={{ color }}>{t.status === 'WAITING' ? '⏸' : label}</span>}
    </span>
  );
}

const STEPS = ['Sent', 'Picked up', 'Working on it', 'Resolved', 'Closed'] as const;

/** Sent → Picked up → Working on it → Resolved → Closed. The current stop breathes. */
export function Journey({ t, className }: { t: Pick<Ticket, 'status' | 'assignee' | 'firstRespondedAt'>; className?: string }) {
  const picked = Boolean(t.assignee || t.firstRespondedAt);
  // Current stop: waiting to be picked up → being worked on (or waiting for you) → resolved → all done
  const current = t.status === 'CLOSED' ? STEPS.length : t.status === 'RESOLVED' ? 3 : t.status === 'OPEN' && !picked ? 1 : 2;
  const waiting = t.status === 'WAITING';
  return (
    <ol className={cn('flex min-w-0 items-center gap-1', className)} aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const now = i === current;
        const label = waiting && now ? 'Waiting for you' : s;
        return (
          <li key={s} className={cn('flex min-w-0 items-center gap-1', i > 0 && 'flex-1')} aria-current={now ? 'step' : undefined}>
            {i > 0 && <span className={cn('h-0.5 min-w-3 flex-1 rounded-full', i <= current ? 'bg-primary' : 'bg-border')} />}
            <span
              data-tone={waiting && now ? 'warning' : undefined}
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[8px] font-bold',
                done && 'border-primary bg-primary text-primary-foreground',
                now && (waiting ? 'hd-breathe border-warning bg-warning-soft' : 'hd-breathe border-primary bg-primary-soft'),
                !done && !now && 'border-border bg-background',
              )}
            >
              {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            <span className={cn('hidden truncate text-2xs sm:inline', now ? (waiting ? 'font-semibold text-warning' : 'font-semibold text-primary') : done ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
