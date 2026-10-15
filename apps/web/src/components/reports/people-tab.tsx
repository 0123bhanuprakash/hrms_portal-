'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarClock, Download, Gauge, Heart, LogOut, Network, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, LoadMore, Skeleton } from '@/components/ui/feedback';
import { Drawer } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Donut, type Slice } from '@/components/dashboard/charts';
import { Kpi, TrendChart } from '@/components/reports/charts';
import { downloadCsv, fetchWholeDrill, label, monthLabel, saveCsv, usePeopleList, usePeopleReport, type PeopleReport, type ReportFilters } from '@/lib/company/reports';
import { SearchField, useDebounced } from '@/components/ui/list-tools';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export interface Drill {
  dimension: string;
  value: string;
  title: string;
}

/** The people behind one number — opened from any clickable count. */
export function PeopleDrawer({ drill, filters, onClose }: { drill: Drill | null; filters: ReportFilters; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const typed = useDebounced(search.trim());
  // A new number starts with an empty search
  const key = drill ? `${drill.dimension}:${drill.value}` : '';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setSearch('');
  }
  const query = drill ? { dimension: drill.dimension, value: drill.value, ...filters, search: typed || undefined } : null;
  const list = usePeopleList(query);
  const rows = list.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = list.data?.pages[0]?.meta.total ?? 0;
  const tenure = (m: number) => (m < 12 ? `${m} mo` : `${Math.round((m / 12) * 10) / 10} yrs`);
  const exportAll = async () => {
    if (!query) return;
    setExporting(true);
    try {
      const all = await fetchWholeDrill(query);
      saveCsv(
        [['Employee ID', 'First name', 'Last name', 'Department', 'Designation', 'Location', 'Status', 'Joined', 'Left'], ...all.map((r) => [r.employeeId, r.firstName, r.lastName, r.department, r.designation, r.location, label(r.status), r.joiningDate, r.terminationDate])],
        `${(drill?.title ?? 'people').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
      );
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not export'));
    } finally {
      setExporting(false);
    }
  };
  return (
    <Drawer
      open={Boolean(drill)}
      onClose={onClose}
      icon={<Users />}
      title={drill ? `${drill.title}${list.data ? ` · ${total} ${total === 1 ? 'person' : 'people'}` : ''}` : ''}
      description="Only people you can see in reports, with the filters above."
      footer={
        <Button variant="secondary" size="sm" disabled={!total} loading={exporting} onClick={() => void exportAll()}>
          <Download /> Export these {total || ''}
        </Button>
      }
    >
      <SearchField value={search} onChange={setSearch} placeholder="Name, ID or title" label="Search these people" className="mb-3" />
      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : list.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load')} onRetry={() => void list.refetch()} />
      ) : rows.length ? (
        <>
        <ul className="m-stagger divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/app/employees/${r.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-subtle">
                <PersonAvatar person={r} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.firstName} {r.lastName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[r.designation, r.department].filter(Boolean).join(' · ') || r.employeeId}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.terminationDate ? `left ${formatDate(r.terminationDate)}` : tenure(r.tenureMonths)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <LoadMore shown={rows.length} total={total} loading={list.isFetchingNextPage} onMore={() => void list.fetchNextPage()} />
        </>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">{typed ? 'Nobody matches that search.' : 'Nobody here.'}</p>
      )}
    </Drawer>
  );
}

/** Horizontal bars where each row opens the people behind it. */
function Breakdown({ title, rows, dimension, onDrill, format = label }: { title: string; rows: PeopleReport['byDepartment']; dimension: string; onDrill: (d: Drill) => void; format?: (s: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const sum = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Card className="p-5">
      <h3 className="mb-3 flex items-center text-sm font-semibold">{title}<span className="ml-auto text-xs font-normal text-muted-foreground">click to see who</span></h3>
      {rows.length ? (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key ?? r.label}>
              <button type="button" onClick={() => onDrill({ dimension, value: r.key ?? r.label, title: `${title.replace(/^By (.)/, (_m, c: string) => c.toUpperCase())}: ${format(r.label)}` })} className="w-full rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-subtle">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{format(r.label)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{r.count} <span className="text-xs">· {sum ? Math.round((r.count / sum) * 100) : 0}%</span></span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                  <i className="m-fill-w block h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No data</p>
      )}
    </Card>
  );
}

const LEVEL_TONES = ['bg-primary', 'bg-info', 'bg-success', 'bg-warning', 'bg-destructive/70', 'bg-muted-foreground/50'];
const GENDER_TONES: Record<string, Slice['tone']> = { MALE: 'primary', FEMALE: 'info', OTHER: 'success', PREFER_NOT_TO_SAY: 'warning', NOT_SET: 'neutral' };

function LevelsCard({ r, onDrill }: { r: PeopleReport; onDrill: (d: Drill) => void }) {
  const max = Math.max(1, ...r.byLevel.map((l) => l.count));
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Network className="h-4 w-4 text-muted-foreground" />Levels</h3>
      {r.byLevel.length ? (
        <ul className="m-stagger space-y-1.5">
          {r.byLevel.map((l, i) => (
            <li key={l.key ?? l.label}>
              <button type="button" onClick={() => onDrill({ dimension: 'level', value: l.key ?? 'none', title: `Level: ${l.label}` })} className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-subtle">
                <span className="w-24 truncate text-right text-xs text-muted-foreground">{l.label}</span>
                <span className="flex flex-1 justify-center">
                  <i className={cn('m-fill-w block h-6 rounded-md', LEVEL_TONES[i % LEVEL_TONES.length])} style={{ width: `${Math.max(6, (l.count / max) * 100)}%` }} />
                </span>
                <b className="w-7 text-right text-sm tabular-nums">{l.count}</b>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No levels set up.</p>
      )}
      <div className="flex items-center gap-4 border-t border-border pt-3">
        <Donut slices={r.byGender.map((g) => ({ label: label(g.label), value: g.count, tone: GENDER_TONES[g.label] ?? 'neutral' }))} size={96} label="Gender" center={<b className="text-lg">{r.headcount}</b>} />
        <ul className="space-y-1 text-xs">
          <li className="text-sm font-semibold">Gender</li>
          {r.byGender.map((g) => (
            <li key={g.label}>
              <button type="button" className="hover:underline" onClick={() => onDrill({ dimension: 'gender', value: g.key ?? g.label, title: `Gender: ${label(g.label)}` })}>{label(g.label)} · {g.count}</button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function LeaversHeat({ r, onDrill }: { r: PeopleReport; onDrill: (d: Drill) => void }) {
  const months = r.trend.map((t) => t.month);
  if (!r.leaversByDepartment.some((d) => d.leavers > 0)) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold">Leavers by department · 12 months</h3>
        <p className="mt-3 text-sm text-muted-foreground">Nobody left in the last 12 months.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto p-5">
      <h3 className="mb-3 flex items-center text-sm font-semibold">Leavers by department · 12 months<span className="ml-auto text-xs font-normal text-muted-foreground">darker = more left · click a cell to see who</span></h3>
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 text-left font-semibold">Department</th>
            {months.map((m) => <th key={m} className="px-0.5 py-1.5 text-center font-semibold" title={monthLabel(m)}>{monthLabel(m).slice(0, 1)}</th>)}
            <th className="py-1.5 text-right font-semibold" title="Share of the department who left">Left %</th>
          </tr>
        </thead>
        <tbody>
          {r.leaversByDepartment.map((d) => (
            <tr key={d.key} className="border-t border-border">
              <td className="py-1.5 pr-2"><b>{d.label}</b> <span className="text-xs text-muted-foreground">{d.headcount}</span></td>
              {d.months.map((n, i) => (
                <td key={months[i]} className="px-0.5 py-1.5">
                  <button
                    type="button"
                    disabled={!n}
                    title={`${monthLabel(months[i]!)}: ${n} left`}
                    onClick={() => onDrill({ dimension: 'left', value: months[i]!, title: `Left in ${monthLabel(months[i]!)}` })}
                    className={cn('block h-5 w-full rounded', n ? (n >= 3 ? 'bg-destructive' : n === 2 ? 'bg-destructive/70' : 'bg-destructive/40') : 'bg-muted', n && 'hover:ring-2 hover:ring-destructive/40')}
                  />
                </td>
              ))}
              <td className="py-1.5 pl-2 text-right"><Badge tone={d.ratePct > 30 ? 'danger' : d.ratePct > 0 ? 'warning' : 'success'}>{d.ratePct}%</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ComingUp({ r }: { r: PeopleReport }) {
  const items = [
    ...r.probation.map((e) => ({ key: `p-${e.id}`, person: e, date: e.confirmationDate, text: e.confirmationDate ? `Probation ends ${formatDate(e.confirmationDate)}` : `On probation since ${formatDate(e.joiningDate)}`, tone: 'warning' as const, action: { href: `/app/employees/${e.id}`, label: 'Review' } })),
    ...r.notice.map((e) => ({ key: `n-${e.id}`, person: e, date: e.terminationDate, text: e.terminationDate ? `Last day ${formatDate(e.terminationDate)}` : 'Serving notice', tone: 'danger' as const, action: { href: `/app/employees/${e.id}`, label: 'Open' } })),
    ...r.anniversaries.map((e) => ({ key: `a-${e.id}`, person: e, date: e.date, text: `${e.years} year${e.years === 1 ? '' : 's'} on ${formatDate(e.date)}`, tone: 'primary' as const, action: { href: `/app/kudos?to=${e.id}`, label: 'Send a shout-out' } })),
  ].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  return (
    <Card className="flex flex-col gap-2 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4 text-muted-foreground" />Coming up<span className="ml-auto text-xs font-normal text-muted-foreground">probation, notice, anniversaries</span></h3>
      {items.length ? (
        <ul className="m-stagger divide-y divide-border">
          {items.slice(0, 10).map((i) => (
            <li key={i.key} className="flex items-center gap-3 py-2 text-sm">
              <PersonAvatar person={i.person} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{i.person.firstName} {i.person.lastName}</span>
                <Badge tone={i.tone}>{i.text}</Badge>
              </span>
              <Link href={i.action.href} className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-subtle">
                {i.action.label === 'Send a shout-out' && <Heart className="mr-1 inline h-3 w-3" />}
                {i.action.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing coming up.</p>
      )}
    </Card>
  );
}

export function PeopleTab({ filters, canExport }: { filters: ReportFilters; canExport: boolean }) {
  const q = usePeopleReport(filters);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [busy, setBusy] = useState(false);
  if (q.isLoadingError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load the report')} onRetry={() => void q.refetch()} />;
  const r = q.data;
  if (!r) return <Skeleton className="h-96" />;
  const lastMonth = r.trend[r.trend.length - 1]?.month;
  return (
    <div className={cn('space-y-4 transition-opacity', q.isFetching && 'opacity-70')}>
      <p className="text-xs text-muted-foreground">Today’s numbers, and the last 12 months · the period above doesn’t apply here</p>
      <div className="m-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" className="text-left" onClick={() => setDrill({ dimension: 'all', value: '*', title: 'Everyone' })}>
          <Kpi icon={<Users />} label="Headcount" value={r.headcount} sub={r.upcomingJoiners ? `+${r.upcomingJoiners} joining soon` : `as of ${formatDate(r.asOf)}`} />
        </button>
        <button type="button" className="text-left" disabled={!lastMonth} onClick={() => lastMonth && setDrill({ dimension: 'joined', value: lastMonth, title: `Joined in ${monthLabel(lastMonth)}` })}>
          <Kpi icon={<UserPlus />} label="Joined (12 months)" value={r.joiners12} sub={`avg tenure ${r.avgTenureMonths < 12 ? `${r.avgTenureMonths} mo` : `${Math.round(r.avgTenureMonths / 1.2) / 10} yrs`}`} />
        </button>
        <Kpi icon={<LogOut />} label="Left (12 months)" value={r.leavers12} />
        <Kpi icon={<Gauge />} label="Attrition (12 months)" value={`${r.attritionPct}%`} sub="Leavers ÷ average headcount" tone={r.attritionPct >= 20 ? 'danger' : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Joiners, leavers and headcount</h3>
            {canExport && (
              <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
                setBusy(true);
                try {
                  await downloadCsv('/reports/people/export', `employees-${r.asOf}.csv`);
                } catch (e) {
                  toast.error(getApiErrorMessage(e, 'Could not export'));
                } finally {
                  setBusy(false);
                }
              }}><Download /> Employee list (CSV)</Button>
            )}
          </div>
          <TrendChart data={r.trend.map((t) => ({ ...t, label: monthLabel(t.month) }))} />
        </Card>
        <LevelsCard r={r} onDrill={setDrill} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <LeaversHeat r={r} onDrill={setDrill} />
        <ComingUp r={r} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Breakdown title="By department" rows={r.byDepartment} dimension="department" onDrill={setDrill} format={(s) => s} />
        <Breakdown title="By location" rows={r.byLocation} dimension="location" onDrill={setDrill} format={(s) => s} />
        <Breakdown title="Tenure" rows={r.tenure} dimension="tenure" onDrill={setDrill} format={(s) => s} />
        <Breakdown title="Employment type" rows={r.byType} dimension="type" onDrill={setDrill} />
      </div>

      <PeopleDrawer drill={drill} filters={filters} onClose={() => setDrill(null)} />
    </div>
  );
}
