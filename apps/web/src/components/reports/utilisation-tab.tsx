'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Briefcase, Download, Gauge, Receipt, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { FilterChips, SearchField, useDebounced } from '@/components/ui/list-tools';
import { Select } from '@/components/ui/pickers';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Kpi } from '@/components/reports/charts';
import { downloadCsv, useUtilisationReport, type UtilisationReport, type UtilisationShow, type UtilisationSort } from '@/lib/company/reports';
import { fmtHours } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { shortDate, type ReportParams } from './filters';

type Mode = 'logged' | 'billable' | 'allocated';
const cellTone = (v: number) => (v > 105 ? 'bg-destructive/80 text-white' : v >= 85 ? 'bg-success text-white' : v >= 60 ? 'bg-success/40 text-foreground' : v > 0 ? 'bg-warning/40 text-foreground' : 'bg-muted text-muted-foreground');
/** Bench = no project at all; in the logged / billable views zero just means nothing logged yet. */
const status = (v: number, mode: Mode, allocation: number) =>
  v > 105 ? { label: 'Over', tone: 'danger' as const } : v >= 85 ? { label: 'Healthy', tone: 'success' as const } : v >= 60 ? { label: 'Light', tone: 'warning' as const } : v > 0 ? { label: 'Low', tone: 'warning' as const } : mode === 'allocated' || allocation === 0 ? { label: 'Bench', tone: 'neutral' as const } : { label: 'Nothing logged', tone: 'neutral' as const };

interface ListState {
  search: string;
  show: UtilisationShow;
  sort: UtilisationSort;
  page: number;
}

function WeeklyGrid({ r, list, setList }: { r: UtilisationReport; list: ListState; setList: (next: ListState) => void }) {
  const [mode, setMode] = useState<Mode>(r.timesheets ? 'logged' : 'allocated');
  const pct = (row: UtilisationReport['rows'][number], i: number) => {
    if (mode === 'allocated' || !row.weekly) return row.allocation;
    const cap = r.weeks[i]?.capacityMinutes ?? 0;
    const w = row.weekly[i];
    return cap && w ? Math.round(((mode === 'billable' ? w.billableMinutes : w.loggedMinutes) / cap) * 100) : 0;
  };
  const weeks = r.weeks.slice(-8);
  const offset = r.weeks.length - weeks.length;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <h3 className="mr-auto text-sm font-semibold">By week · {mode === 'allocated' ? 'allocation' : `${mode} ÷ capacity`}</h3>
        <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Show">
          {(['logged', 'billable', 'allocated'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={m !== 'allocated' && !r.timesheets} onClick={() => setMode(m)} className={cn('rounded-md px-2.5 py-1 text-xs font-semibold capitalize disabled:opacity-40', mode === m ? 'bg-surface shadow-card' : 'text-muted-foreground')}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
        <SearchField value={list.search} onChange={(search) => setList({ ...list, search, page: 1 })} placeholder="Name, ID, title or team" label="Search people" className="w-full sm:w-56" />
        <FilterChips
          label="Show"
          value={list.show}
          onChange={(show) => setList({ ...list, show, page: 1 })}
          options={[
            { key: 'all', label: 'Everyone', count: r.counts.all },
            { key: 'bench', label: 'On bench', count: r.counts.bench },
            { key: 'low', label: 'Under 50%', count: r.counts.low },
            { key: 'over', label: 'Over 100%', count: r.counts.over },
            { key: 'nolog', label: 'Not logging', count: r.counts.nolog, hidden: !r.timesheets },
          ]}
        />
        <Select value={list.sort} onChange={(e) => setList({ ...list, sort: e.target.value as UtilisationSort, page: 1 })} aria-label="Sort people" className="h-8 w-44 text-xs sm:ml-auto">
          <option value="allocation">Lowest allocation first</option>
          <option value="utilisation">Lowest utilisation first</option>
          <option value="name">Name A–Z</option>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-2 font-semibold">Person</th>
              {weeks.map((w) => <th key={w.start} className="px-1 py-2 text-center font-semibold">{shortDate(w.start)}</th>)}
              <th className="px-3 py-2 font-semibold">Projects</th>
              <th className="px-5 py-2 text-right font-semibold">Period</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {r.rows.map((row) => {
              const vals = weeks.map((_, i) => pct(row, i + offset));
              const avg = mode === 'allocated' ? row.allocation : mode === 'billable' ? row.billablePct ?? 0 : row.utilisationPct ?? 0;
              const s = status(avg, mode, row.allocation);
              return (
                <tr key={row.employee.id}>
                  <td className="px-5 py-2">
                    <Link href={`/app/employees/${row.employee.id}`} className="flex items-center gap-2 hover:underline">
                      <PersonAvatar person={row.employee} size="xs" />
                      <span className="truncate">{row.employee.firstName} {row.employee.lastName}</span>
                    </Link>
                  </td>
                  {vals.map((v, i) => (
                    <td key={weeks[i]!.start} className="px-1 py-1.5">
                      <span className={cn('flex h-8 items-center justify-center rounded-md text-[11.5px] font-bold tabular-nums', weeks[i]!.capacityMinutes || mode === 'allocated' ? cellTone(v) : 'bg-muted/40 text-muted-foreground')}>{weeks[i]!.capacityMinutes || mode === 'allocated' ? `${v}%` : '—'}</span>
                    </td>
                  ))}
                  <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted-foreground">{row.projects.map((p) => p.name).join(' · ') || '—'}</td>
                  <td className="px-5 py-2 text-right"><Badge tone={s.tone}>{s.label} · {avg}%</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!r.rows.length && <p className="px-5 py-6 text-center text-sm text-muted-foreground">Nobody matches. Try another search or filter.</p>}
      </div>
      <Pagination page={r.meta.page} totalPages={r.meta.totalPages} total={r.meta.total} limit={r.meta.limit} onPageChange={(page) => setList({ ...list, page })} />
      <p className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">Capacity = working days × {r.hoursPerDay} h. Over 105% is marked; holidays are left out.</p>
    </Card>
  );
}

export function UtilisationTab({ params, canExport }: { params: ReportParams; canExport: boolean }) {
  const filters = { departmentId: params.departmentId, locationId: params.locationId };
  const [list, setList] = useState<ListState>({ search: '', show: 'all', sort: 'allocation', page: 1 });
  const search = useDebounced(list.search.trim());
  // A new range or team starts again on page 1
  useEffect(() => setList((l) => ({ ...l, page: 1 })), [params.from, params.to, params.departmentId, params.locationId]);
  const q = useUtilisationReport({ from: params.from, to: params.to, ...filters, search: search || undefined, show: list.show, sort: list.sort, page: list.page });
  const [busy, setBusy] = useState(false);
  if (q.isLoadingError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load the report')} onRetry={() => void q.refetch()} />;
  const r = q.data;
  if (!r) return <Skeleton className="h-96" />;
  return (
    <div className={cn('space-y-4 transition-opacity', q.isFetching && 'opacity-70')}>
      <div className="m-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Briefcase />} label="Average allocation" value={`${r.avgAllocationPct}%`} sub={`${r.full} full · ${r.partial} partial · ${r.bench} on bench`} />
        <Kpi icon={<Users />} label="On the bench" value={r.bench} sub="No live project today" tone={r.bench ? 'danger' : 'success'} />
        <Kpi icon={<Gauge />} label="Utilisation" value={r.utilisationPct === null ? '—' : `${r.utilisationPct}%`} sub={r.timesheets ? `Logged ÷ ${r.workingDays} days × ${r.hoursPerDay}h` : 'Turn on Timesheets to measure'} />
        <Kpi icon={<Receipt />} label="Billable" value={r.billablePct === null ? '—' : `${r.billablePct}%`} sub={r.internalMinutes ? `${fmtHours(r.internalMinutes)} internal work` : 'Of capacity'} />
      </div>

      <WeeklyGrid r={r} list={list} setList={setList} />

      <Card className="overflow-hidden">
        <div className="flex items-center border-b border-border px-5 py-3">
          <h3 className="mr-auto text-sm font-semibold">Projects</h3>
          {canExport && (
            <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
              setBusy(true);
              try {
                await downloadCsv('/reports/utilisation/export', `utilisation-${r.from}-to-${r.to}.csv`, { from: r.from, to: r.to, ...filters });
              } catch (e) {
                toast.error(getApiErrorMessage(e, 'Could not export'));
              } finally {
                setBusy(false);
              }
            }}><Download /> CSV</Button>
          )}
        </div>
        {r.projects.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="px-5 py-2 font-medium">Project</th><th className="px-3 py-2 text-right font-medium">People</th><th className="px-3 py-2 text-right font-medium">FTE</th>{r.timesheets && <><th className="px-3 py-2 text-right font-medium">Logged</th><th className="px-5 py-2 text-right font-medium">Billable</th></>}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {r.projects.map((p) => (
                  <tr key={p.project.id}>
                    <td className="px-5 py-2"><Link href={`/app/projects/${p.project.id}`} className="font-medium hover:underline">{p.project.name}</Link>{p.project.clientName && <span className="text-muted-foreground"> · {p.project.clientName}</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.members}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.fte}</td>
                    {r.timesheets && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtHours(p.loggedMinutes)}</td>
                        <td className="px-5 py-2 text-right">
                          <span className="inline-flex items-center gap-2 tabular-nums">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-info" style={{ width: `${p.loggedMinutes ? (p.billableMinutes / p.loggedMinutes) * 100 : 0}%` }} /></span>
                            {p.loggedMinutes ? `${Math.round((p.billableMinutes / p.loggedMinutes) * 100)}%` : '—'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">Nobody is on a live project.</p>
        )}
      </Card>
    </div>
  );
}
