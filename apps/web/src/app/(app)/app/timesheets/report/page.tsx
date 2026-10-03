'use client';

import React, { useState } from 'react';
import { BarChart3, Clock, ShieldCheck, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { addDays, fmtHours, mondayOf, todayKey, useHoursReport } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';

export default function HoursReportPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('work.timesheets') && can('timesheet.view') && scopeOf('timesheet.view') !== 'own';
  const thisWeek = mondayOf(todayKey());
  const [from, setFrom] = useState(addDays(thisWeek, -28));
  const [to, setTo] = useState(addDays(thisWeek, -1));
  const [approvedOnly, setApprovedOnly] = useState(false);
  const q = useHoursReport({ from, to, approvedOnly: approvedOnly ? 'true' : undefined }, allowed && from <= to);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" />;
  const r = q.data;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const max = Math.max(1, ...(r?.byProject.map((x) => x.minutes) ?? [1]));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Timesheets" title="Hours by project" description="Logged hours from submitted and approved timesheets, for the people you can see." />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From" htmlFor="hr-from"><Input id="hr-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To" htmlFor="hr-to"><Input id="hr-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} /> Approved weeks only</label>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load the report')} onRetry={() => void q.refetch()} />
      ) : r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Card className="p-4"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Logged</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmtHours(r.totalMinutes)}</p></Card>
            <Card className="p-4"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Billable</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmtHours(r.billableMinutes)}</p><p className="text-2xs text-muted-foreground">{pct(r.billableMinutes, r.totalMinutes)} of logged</p></Card>
            <Card className="p-4"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><BarChart3 className="h-3.5 w-3.5" /> People</p><p className="mt-1 text-2xl font-semibold tabular-nums">{r.byEmployee.length}</p></Card>
          </div>
          {!r.totalMinutes ? (
            <EmptyState icon={<Clock />} title="No hours in this period" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">By project</h2>
                <ul className="space-y-3">
                  {r.byProject.map((x) => (
                    <li key={x.project?.id ?? 'internal'}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{x.project ? x.project.name : 'Internal / non-project'}{x.project?.clientName && <span className="font-normal text-muted-foreground"> · {x.project.clientName}</span>}</span>
                        <span className="shrink-0 tabular-nums">{fmtHours(x.minutes)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" title={`${pct(x.billableMinutes, x.minutes)} billable`}>
                        <div className="flex h-full" style={{ width: `${(x.minutes / max) * 100}%` }}>
                          <div className="h-full bg-primary" style={{ width: `${(x.billableMinutes / x.minutes) * 100}%` }} />
                          <div className="h-full flex-1 bg-primary/35" />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-2xs text-muted-foreground">Dark = billable, light = non-billable.</p>
              </Card>
              <Card className="overflow-hidden">
                <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">By person</h2>
                <ul className="divide-y divide-border">
                  {r.byEmployee.map((x) => (
                    <li key={x.employee.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <PersonAvatar person={x.employee} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{x.employee.firstName} {x.employee.lastName}</span>
                      <span className="text-xs text-muted-foreground">{pct(x.billableMinutes, x.minutes)} billable</span>
                      <span className="w-16 text-right font-medium tabular-nums">{fmtHours(x.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
