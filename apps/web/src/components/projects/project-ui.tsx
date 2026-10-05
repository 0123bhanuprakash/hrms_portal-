'use client';

import React from 'react';
import { Briefcase, Building2 } from 'lucide-react';
import type { HealthLevel, ProjectHealth, ProjectType } from '@/lib/company/projects';
import { cn } from '@/lib/cn';

export const HEALTH: Record<HealthLevel, { label: string; dot: string; pill: string; emoji: string }> = {
  on_track: { label: 'On track', dot: 'bg-success', pill: 'bg-success-soft text-success', emoji: '🟢' },
  at_risk: { label: 'At risk', dot: 'bg-warning', pill: 'bg-warning-soft text-warning', emoji: '🟠' },
  off_track: { label: 'Off track', dot: 'bg-destructive', pill: 'bg-destructive-soft text-destructive', emoji: '🔴' },
  planned: { label: 'Planned', dot: 'bg-info', pill: 'bg-info-soft text-info', emoji: '🔵' },
  on_hold: { label: 'On hold', dot: 'bg-muted-foreground', pill: 'bg-muted text-muted-foreground', emoji: '⏸' },
  done: { label: 'Completed', dot: 'bg-muted-foreground', pill: 'bg-muted text-muted-foreground', emoji: '✓' },
};

const PALETTE = ['#4F46E5', '#0D9488', '#DB2777', '#F59E0B', '#0EA5E9', '#7C3AED', '#16A34A', '#EF4444'];
/** The project's colour, or a stable one from its code. */
export function projectColor(p: { color: string | null; code: string }): string {
  if (p.color) return p.color;
  let h = 0;
  for (let i = 0; i < p.code.length; i++) h = (h * 31 + p.code.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function HealthPill({ health, className, title }: { health: Pick<ProjectHealth, 'level' | 'reasons'>; className?: string; title?: string }) {
  const h = HEALTH[health.level];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold', h.pill, className)} title={title ?? (health.reasons.join(' · ') || h.label)}>
      <i className={cn('h-1.5 w-1.5 rounded-full', h.dot)} /> {h.label}
    </span>
  );
}

export function TypeBadge({ type, className }: { type: ProjectType; className?: string }) {
  return type === 'CLIENT' ? (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-soft-foreground', className)} title="Client project — billable">
      <Briefcase className="h-3 w-3" /> Client · billable
    </span>
  ) : (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground', className)} title="Company project — investment">
      <Building2 className="h-3 w-3" /> Internal · investment
    </span>
  );
}

/** One segment per milestone (done = filled) with a marker for how much time has gone. */
export function MilestoneBar({ done, total, timePct, color }: { done: number; total: number; timePct: number | null; color: string }) {
  return (
    <div className="relative flex gap-1" role="img" aria-label={`${done} of ${total} milestones done${timePct !== null ? `, ${timePct}% of the time gone` : ''}`}>
      {total ? Array.from({ length: total }, (_, i) => <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i < done ? color : 'hsl(var(--muted))' }} />) : <span className="h-2 flex-1 rounded-full bg-muted" />}
      {timePct !== null && <b className="absolute -top-1 h-4 w-0.5 rounded bg-foreground" style={{ left: `calc(${timePct}% - 1px)` }} title={`${timePct}% of the time gone`} />}
    </div>
  );
}

/** Billable / investment / bench as one stacked bar. */
export function BillingBar({ billable, investment, bench, className, showLegend = true }: { billable: number; investment: number; bench: number; className?: string; showLegend?: boolean }) {
  const total = Math.max(100, billable + investment + bench);
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <span className="bg-primary transition-[width] duration-700" style={{ width: `${(billable / total) * 100}%` }} />
        <span className="bg-teal-500 transition-[width] duration-700" style={{ width: `${(investment / total) * 100}%` }} />
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-primary" /> Billable {fmt(billable)}%</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-teal-500" /> Investment {fmt(investment)}%</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-muted-foreground/30" /> Bench {fmt(bench)}%</span>
        </div>
      )}
    </div>
  );
}
const fmt = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));

export const UPDATE_HEALTH: Array<{ id: 'on_track' | 'at_risk' | 'off_track'; label: string; emoji: string }> = [
  { id: 'on_track', label: 'On track', emoji: '🟢' },
  { id: 'at_risk', label: 'At risk', emoji: '🟠' },
  { id: 'off_track', label: 'Off track', emoji: '🔴' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "24 Oct" from YYYY-MM-DD */
export const shortDate = (k: string) => `${Number(k.slice(8, 10))} ${MONTHS[Number(k.slice(5, 7)) - 1]}`;
/** Whole days from today (local) to a YYYY-MM-DD date */
export function daysFrom(today: string, k: string): number {
  return Math.round((new Date(`${k}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
}
