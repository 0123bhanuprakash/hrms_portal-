'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flag, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useTimeline } from '@/lib/company/projects';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { HEALTH, projectColor, shortDate } from './project-ui';

const DAY = 86_400_000;
const ms = (k: string) => new Date(`${k}T00:00:00Z`).getTime();
function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Gantt: when projects run, their milestones, today — and who's on two projects at once. */
export function ProjectTimeline() {
  const [months, setMonths] = useState(6);
  const [from, setFrom] = useState<string | undefined>();
  const q = useTimeline({ from, months });
  const t = q.data;
  const span = t ? ms(t.to) + DAY - ms(t.from) : 1;
  const pos = (k: string) => Math.max(0, Math.min(100, ((ms(k) - (t ? ms(t.from) : 0)) / span) * 100));
  const monthCols = useMemo(() => (t ? Array.from({ length: months }, (_, i) => shiftMonth(t.from.slice(0, 7), i)) : []), [t, months]);

  if (q.isLoadingError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load the timeline')} onRetry={() => q.refetch()} />;
  if (!t) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label="Earlier" onClick={() => setFrom(shiftMonth(t.from.slice(0, 7), -Math.max(1, Math.floor(months / 2))))}><ChevronLeft /></Button>
        <Button size="icon-sm" variant="secondary" aria-label="Later" onClick={() => setFrom(shiftMonth(t.from.slice(0, 7), Math.max(1, Math.floor(months / 2))))}><ChevronRight /></Button>
        <Button size="sm" variant="ghost" onClick={() => setFrom(undefined)}>Today</Button>
        <div className="ml-auto inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Range">
          {[[3, '3 months'], [6, '6 months'], [12, 'Year']].map(([m, l]) => (
            <button key={m} type="button" aria-pressed={months === m} onClick={() => setMonths(m as number)} className={cn('h-7 rounded-md px-3 text-xs font-semibold', months === m ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground')}>{l}</button>
          ))}
        </div>
      </div>

      {!t.projects.length ? (
        <EmptyState icon={<Flag />} title="No projects in this window" />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[220px_1fr] border-b border-border bg-subtle/60 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <span className="px-3 py-2">Project</span>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${months}, 1fr)` }}>
                {monthCols.map((m) => <span key={m} className="border-l border-border px-2 py-2 text-center">{new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: months > 6 ? undefined : '2-digit' })}</span>)}
              </div>
            </div>
            {t.projects.map((p) => {
              const color = projectColor(p);
              const s = pos(p.startDate);
              const e = p.endDate ? pos(p.endDate) + (100 / span) * DAY : 100;
              return (
                <div key={p.id} className="grid grid-cols-[220px_1fr] border-b border-border last:border-b-0">
                  <Link href={`/app/projects/${p.id}`} className="flex min-w-0 items-center gap-2 px-3 py-3 text-sm hover:bg-subtle/60">
                    <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    {p.managers[0] && <PersonAvatar person={p.managers[0]} size="xs" className="h-5 w-5" />}
                  </Link>
                  <div className="relative h-14" style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent 0 calc(${100 / months}% - 1px), hsl(var(--border)) calc(${100 / months}% - 1px) ${100 / months}%)` }}>
                    {t.today >= t.from && t.today <= t.to && <span className="absolute inset-y-0 z-10 w-0.5 bg-destructive" style={{ left: `${pos(t.today)}%` }} aria-hidden />}
                    <Link
                      href={`/app/projects/${p.id}`}
                      className="absolute top-3 flex h-8 items-center gap-1.5 overflow-hidden rounded-lg px-2.5 text-[11px] font-semibold text-white shadow-card transition-transform hover:scale-y-110"
                      style={{ left: `${s}%`, width: `${Math.max(1.5, e - s)}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, opacity: p.status === 'COMPLETED' ? 0.5 : 1 }}
                      title={`${p.name} · ${shortDate(p.startDate)} – ${p.endDate ? shortDate(p.endDate) : 'ongoing'}`}
                    >
                      {p.status === 'ACTIVE' && <i className={cn('h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-white/70', HEALTH[p.health.level].dot)} />}
                      <span className="truncate">{e - s > 12 ? `${shortDate(p.startDate)} – ${p.endDate ? shortDate(p.endDate) : 'ongoing'}` : ''}</span>
                    </Link>
                    {p.milestoneList.map((m) => (
                      <span key={m.id} className={cn('absolute top-[18px] z-20 h-3.5 w-3.5 rotate-45 rounded-[3px] border-2 border-surface shadow', m.done ? 'bg-success' : 'bg-foreground')} style={{ left: `calc(${pos(m.dueDate)}% - 7px)` }} title={`${m.title} · ${shortDate(m.dueDate)}${m.done ? ' · done' : ''}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Flag />} title="Milestones this month" />
          <ul className="space-y-2.5 px-5 pb-5">
            {!t.milestonesThisMonth.length && <li className="text-sm text-muted-foreground">None this month.</li>}
            {t.milestonesThisMonth.map((m) => {
              const late = !m.done && m.dueDate < t.today;
              return (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span className={cn('h-3 w-3 rotate-45 rounded-[3px]', m.done ? 'bg-success' : late ? 'bg-destructive' : 'bg-primary')} />
                  <b className="w-12 shrink-0 text-xs">{shortDate(m.dueDate)}</b>
                  <span className="min-w-0 flex-1"><span className={cn('block truncate font-medium', m.done && 'text-muted-foreground line-through')}>{m.title}</span><span className="block truncate text-xs text-muted-foreground">{m.project}</span></span>
                  <span className={cn('text-xs font-semibold', m.done ? 'text-success' : late ? 'text-destructive' : 'text-muted-foreground')}>{m.done ? 'Done' : late ? 'Late' : 'Coming'}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={<Users />} title="On two projects at once" description="People splitting their time in this window" />
          <ul className="space-y-2.5 px-5 pb-5">
            {!t.overlaps.length && <li className="text-sm text-muted-foreground">Nobody — everyone is on one project at a time.</li>}
            {t.overlaps.map((o) => (
              <li key={o.employee.id} className="flex items-center gap-3 text-sm">
                <PersonAvatar person={o.employee} size="sm" />
                <span className="min-w-0 flex-1"><span className="block font-medium">{o.employee.firstName} {o.employee.lastName}</span><span className="block truncate text-xs text-muted-foreground">{o.projects.map((x) => `${x.name} ${x.allocation}%`).join(' · ')}{o.from > t.today ? ` · from ${shortDate(o.from)}` : ''}</span></span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', o.total >= 100 ? 'bg-success' : 'bg-warning')} style={{ width: `${Math.min(100, o.total)}%` }} /></span>
                <b className="w-10 text-right text-xs tabular-nums">{o.total}%</b>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
