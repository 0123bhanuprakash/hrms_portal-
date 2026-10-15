'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarDays, Flag, FolderKanban, MessageSquareText, Palmtree } from 'lucide-react';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ROLE_LABEL, useMyOverview, type MyOverview } from '@/lib/company/projects';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { BillingBar, HEALTH, HealthPill, TypeBadge, daysFrom, projectColor, shortDate } from './project-ui';

/** The employee's view: my assignments, who leads me there, what's coming, who's away. */
export function MyProjects() {
  const q = useMyOverview();
  if (q.isLoadingError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load your projects')} onRetry={() => q.refetch()} />;
  if (!q.data) return <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;
  const d = q.data;
  const booked = 100 - d.billing.bench;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {!d.assignments.length && <EmptyState icon={<FolderKanban />} title="You’re not on a project right now" description="When the PMO assigns you, it shows up here with your lead and what’s coming up." />}
        {d.assignments.map((a) => <AssignmentCard key={a.memberId} a={a} today={d.today} />)}
      </div>
      <aside className="space-y-4">
        <Card className="flex flex-col items-center gap-3 p-5 text-center">
          <Ring billable={d.billing.billable} investment={d.billing.investment} />
          <p className="text-sm font-semibold">{booked >= 100 ? 'Your time is fully booked' : booked === 0 ? 'You’re free right now' : `${booked}% of your time is booked`}</p>
          <p className="text-xs text-muted-foreground">
            {d.assignments.filter((a) => !a.upcoming).map((a) => `${a.project.name} ${a.allocation}%`).join(' · ') || 'No current assignments'}
            {d.freeFrom ? ` · ${d.freeFrom.free}% free from ${shortDate(d.freeFrom.date)}` : ''}
          </p>
          <BillingBar billable={d.billing.billable} investment={d.billing.investment} bench={d.billing.bench} className="w-full" />
        </Card>
        <Card>
          <CardHeader icon={<Flag />} title="Coming up for your projects" />
          <ul className="space-y-2.5 px-5 pb-5">
            {!d.milestones.length && <li className="text-sm text-muted-foreground">No milestones coming up.</li>}
            {d.milestones.map((m) => {
              const days = daysFrom(d.today, m.dueDate);
              return (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-primary" />
                  <b className="w-12 shrink-0 text-xs">{shortDate(m.dueDate)}</b>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{m.title}</span><span className="block truncate text-xs text-muted-foreground">{m.project}</span></span>
                  <span className="text-xs text-muted-foreground">{days === 0 ? 'today' : `in ${days} d`}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={<Palmtree />} title="Away from your teams this week" />
          <ul className="space-y-2.5 px-5 pb-5">
            {!d.away.length && <li className="text-sm text-muted-foreground">Everyone’s around.</li>}
            {d.away.map((x) => (
              <li key={`${x.employee.id}-${x.startDate}`} className="flex items-center gap-3 text-sm">
                <PersonAvatar person={x.employee} size="sm" />
                <span className="min-w-0"><span className="block font-medium">{x.employee.firstName} {x.employee.lastName}</span><span className="block truncate text-xs text-muted-foreground">{x.startDate === x.endDate ? shortDate(x.startDate) : `${shortDate(x.startDate)} – ${shortDate(x.endDate)}`} · {x.projects.join(', ')}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function AssignmentCard({ a, today }: { a: MyOverview['assignments'][number]; today: string }) {
  const color = projectColor(a.project);
  const next = a.nextMilestone;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <span className="block h-1.5" style={{ background: color }} />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-[11px] font-black" style={{ background: `${color}1f`, color }}>{a.project.code.slice(0, 4)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/app/projects/${a.project.id}`} className="font-semibold hover:text-primary">{a.project.name}</Link>
              {a.project.status === 'ACTIVE' && !a.upcoming && <HealthPill health={a.health} />}
              {a.upcoming && <span className="rounded-full bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">Starts {shortDate(a.startDate)}</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              You’re <b className="text-foreground">{ROLE_LABEL[a.role]}</b> · {a.allocation}% of your time · {a.endDate ? `until ${shortDate(a.endDate)}` : 'ongoing'}
              {a.project.type === 'CLIENT' && !a.billed ? ' · not billed to the client' : ''}
            </p>
          </div>
          <MiniRing pct={a.allocation} color={color} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {a.approver ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2">
              <PersonAvatar person={a.approver} size="sm" />
              <span className="min-w-0"><span className="block text-[11px] text-muted-foreground">{a.approver.as} · approves your leave</span><span className="block truncate text-sm font-semibold">{a.approver.firstName} {a.approver.lastName}</span></span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">You lead this project — your leave goes to your line manager.</div>
          )}
          <div className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0"><span className="block text-[11px] text-muted-foreground">Next milestone</span><span className="block truncate text-sm font-semibold">{next ? `${next.title} · ${daysFrom(today, next.dueDate) < 0 ? 'late' : shortDate(next.dueDate)}` : 'None yet'}</span></span>
          </div>
        </div>
        {a.lastUpdate && (
          <div className="flex items-start gap-2 rounded-xl bg-subtle/70 px-3 py-2 text-xs">
            <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1"><b>{HEALTH[a.lastUpdate.health].emoji} Latest update</b>{a.lastUpdate.author ? ` from ${a.lastUpdate.author}` : ''} · {formatRelative(a.lastUpdate.at)} — <span className="text-muted-foreground">{a.lastUpdate.note}</span></span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex -space-x-2">{a.team.map((m) => <PersonAvatar key={m.id} person={m} size="xs" className="h-6 w-6 ring-2 ring-surface" />)}</span>
          {a.teamCount > a.team.length && <span>+{a.teamCount - a.team.length}</span>}
          <TypeBadge type={a.project.type} className="ml-auto" />
          <Link href={`/app/projects/${a.project.id}`} className="font-semibold text-primary hover:underline">Open</Link>
        </div>
      </div>
    </div>
  );
}

function MiniRing({ pct, color }: { pct: number; color: string }) {
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${color} 0 ${pct}%, hsl(var(--muted)) 0)` }}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-xs font-bold tabular-nums">{pct}%</span>
    </span>
  );
}

function Ring({ billable, investment }: { billable: number; investment: number }) {
  const total = Math.min(100, billable + investment);
  return (
    <span className="relative flex h-28 w-28 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) 0 ${billable}%, rgb(20 184 166) 0 ${billable + investment}%, hsl(var(--muted)) 0)` }}>
      <span className={cn('flex h-[86px] w-[86px] flex-col items-center justify-center rounded-full bg-surface')}>
        <b className="text-xl tabular-nums">{total}%</b>
        <span className="text-[10px] text-muted-foreground">booked</span>
      </span>
    </span>
  );
}
