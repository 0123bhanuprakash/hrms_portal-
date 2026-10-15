'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Activity, AlertTriangle, BellRing, CalendarDays, ChevronLeft, ChevronRight, Download, Grid3x3, List, Moon, Pencil, Search, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, LoadMore, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CorrectionDialog } from '@/components/attendance/correction-dialog';
import { DayLine, STATUS_BG, minuteOf, toMinutes } from '@/components/time/visuals';
import { useAccess, SCOPE_LABELS } from '@/lib/access/use-access';
import { useDepartments } from '@/lib/company/org';
import {
  STATUS_META,
  clock,
  dayLabel,
  downloadAttendanceCsv,
  hours,
  useInsights,
  useInsightList,
  type InsightList,
  type InsightRow,
  useNudge,
  usePolicy,
  useTeamAttendance,
  useTeamMonth,
  type PersonLite,
  type TeamDay,
  lateBy,
} from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { DateInput, Select } from '@/components/ui/pickers';

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Row = TeamDay['data'][number];
type View = 'today' | 'month' | 'list';

export default function TeamAttendancePage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const [view, setView] = useState<View>('today');
  const [date, setDate] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, departmentId, status, date, view]);

  const scope = scopeOf('attendance.view');
  const allowed = hasFeature('time.attendance') && can('attendance.view') && scope !== 'own';
  const team = useTeamAttendance({ date, search: debounced || undefined, departmentId: departmentId || undefined, status: view === 'list' ? status || undefined : undefined, page: view === 'list' ? page : 1, limit: view === 'list' ? 50 : 200 }, allowed);
  const policy = usePolicy(allowed);
  const departments = useDepartments();
  const tz = policy.data?.timeZone ?? 'Asia/Kolkata';
  const data = team.data;
  const day = data?.date;

  if (!accessLoading && !allowed) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="You can only see your own attendance." />;
  }

  const exportCsv = async () => {
    if (!day) return;
    setExporting(true);
    try {
      await downloadAttendanceCsv(day.slice(0, 7), departmentId || undefined);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not export'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Team attendance"
        description={`${scope && scope !== 'company' ? `Showing: ${SCOPE_LABELS[scope].hint.toLowerCase()}` : 'Everyone in the company'}${day ? ` · ${dayLabel(day, { weekday: 'long', day: 'numeric', month: 'short' })}${day === data?.today ? ' · live' : ''}` : ''}.`}
        action={
          can('attendance.export') && (
            <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={!day}>
              <Download /> Export {day ? new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''}
            </Button>
          )
        }
      />

      <Tabs
        tabs={[
          { id: 'today' as const, label: 'Day', icon: <Activity /> },
          { id: 'month' as const, label: 'Month grid', icon: <Grid3x3 /> },
          { id: 'list' as const, label: 'List', icon: <List /> },
        ]}
        value={view}
        onChange={setView}
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {view !== 'month' && (
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Previous day" onClick={() => day && setDate(addDays(day, -1))}><ChevronLeft /></Button>
            <DateInput value={day ?? ''} max={data?.today} onChange={(e) => setDate(e.target.value || undefined)} className="w-40" aria-label="Date" />
            <Button size="icon-sm" variant="ghost" aria-label="Next day" onClick={() => day && setDate(addDays(day, 1))} disabled={!day || day >= (data?.today ?? '')}><ChevronRight /></Button>
            {day && data && day !== data.today && <Button size="sm" variant="ghost" onClick={() => setDate(undefined)}>Today</Button>}
          </div>
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email or ID" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search" />
        </div>
        <Select className={cn(inputClass, 'lg:w-52')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>

      {data?.holiday && view !== 'month' && <p className="rounded-lg bg-primary-soft px-4 py-2.5 text-sm text-primary-soft-foreground">{dayLabel(data.date)} is a holiday: {data.holiday.name}</p>}

      {view === 'today' && <TodayView team={team} tz={tz} onEdit={can('attendance.edit') && scopeOf('attendance.edit') ? setEditing : null} />}
      {view === 'month' && <MonthGrid departmentId={departmentId} search={debounced} tz={tz} />}
      {view === 'list' && <ListView team={team} tz={tz} status={status} setStatus={setStatus} page={page} setPage={setPage} onEdit={can('attendance.edit') && scopeOf('attendance.edit') ? setEditing : null} />}

      {editing && day && (
        <CorrectionDialog
          mode="edit"
          day={{ date: day, checkIn: editing.checkIn, checkOut: editing.checkOut, notes: null }}
          timeZone={tz}
          employeeId={editing.employee.id}
          employeeName={`${editing.employee.firstName} ${editing.employee.lastName}`}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

type TeamQuery = ReturnType<typeof useTeamAttendance>;

const ZONES: Array<{ id: string; label: string; color: string; test: (r: Row) => boolean }> = [
  { id: 'in', label: 'In office', color: 'border-t-success', test: (r) => (r.status === 'WORKING' || r.status === 'PRESENT' || r.status === 'HALF_DAY') && !(r.lateMinutes ?? 0) },
  { id: 'wfh', label: 'Work from home', color: 'border-t-info', test: (r) => r.status === 'WORK_FROM_HOME' },
  { id: 'late', label: 'Late', color: 'border-t-warning', test: (r) => (r.lateMinutes ?? 0) > 0 },
  { id: 'leave', label: 'On leave', color: 'border-t-pink-500', test: (r) => r.status === 'ON_LEAVE' },
  { id: 'out', label: 'Not in yet', color: 'border-t-muted-foreground', test: (r) => r.status === 'NOT_CHECKED_IN' || r.status === 'ABSENT' || r.status === 'MISSING_CHECKOUT' },
];

/** Presence strip, everyone's day on a line, and what needs attention. */
function TodayView({ team, tz, onEdit }: { team: TeamQuery; tz: string; onEdit: ((r: Row) => void) | null }) {
  const nudge = useNudge();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const data = team.data;
  const rows = useMemo(() => data?.data ?? [], [data]);
  const live = data && data.date === data.today;
  const nowMin = live ? minuteOf(now, tz) : null;
  const notIn = rows.filter((r) => r.status === 'NOT_CHECKED_IN');

  const sendNudge = async (ids: string[], kind: 'check_in' | 'fix') => {
    try {
      const r = await nudge.mutateAsync({ employeeIds: ids, kind });
      toast.success(r.sent ? `Reminder sent to ${r.sent} ${r.sent === 1 ? 'person' : 'people'}` : 'Already reminded today');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send the reminder'));
    }
  };

  if (team.isLoading) return <Skeleton className="h-96 w-full" />;
  if (team.isError) return <ErrorState message={getApiErrorMessage(team.error, 'Could not load attendance')} onRetry={() => team.refetch()} />;
  if (!rows.length) return <EmptyState icon={<Users />} title="No one here" description="Try another day, filter or search." />;

  return (
    <div className="space-y-4">
      <div className="m-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ZONES.map((z) => {
          const ppl = rows.filter(z.test);
          return (
            <div key={z.id} className={cn('rounded-xl border border-t-[3px] border-border bg-surface p-3 shadow-card', z.color)}>
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{z.label}</span>
                <span className="text-xl font-bold tabular-nums">{ppl.length}</span>
              </div>
              <div className="mt-2 flex">
                {ppl.slice(0, 5).map((r) => <PersonAvatar key={r.employee.id} person={r.employee} size="xs" className="-ml-1.5 border-2 border-surface first:ml-0" />)}
                {ppl.length > 5 && <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-muted text-[10px] font-bold text-muted-foreground">+{ppl.length - 5}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{live ? 'Today’s timeline' : `Timeline · ${dayLabel(data!.date)}`}</h2>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {live && <span className="tm-live inline-block h-2 w-2 rounded-full bg-success" />}
              {live ? `Updates live · now ${clock(now.toISOString(), tz)}` : 'Past day'}
            </span>
          </div>
          <ul className="space-y-2.5">
            {rows.slice(0, 60).map((r) => {
              const meta = STATUS_META[r.status];
              const shift = r.shift;
              const inMin = r.checkIn ? minuteOf(r.checkIn, tz) : null;
              let outMin = r.checkOut && !r.openSince ? minuteOf(r.checkOut, tz) : live ? nowMin : null;
              if (inMin !== null && outMin !== null && outMin < inMin) outMin += 1440;
              return (
                <li key={r.employee.id} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3">
                  <Link href={`/app/attendance?employee=${r.employee.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <PersonAvatar person={r.employee} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.employee.firstName} {r.employee.lastName}</span>
                      <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        {shift?.overnight && <Moon className="h-3 w-3" />}
                        {shift && shift.id ? `${shift.name} ${shift.start}–${shift.end}` : r.employee.designation?.name ?? r.employee.employeeId}
                      </span>
                    </span>
                  </Link>
                  <DayLine
                    ruler={false}
                    height="h-3.5"
                    shift={shift ? { start: toMinutes(shift.start), end: toMinutes(shift.end) + (shift.overnight ? 1440 : 0) } : null}
                    blocks={inMin !== null && outMin !== null ? [{ from: inMin, to: outMin, className: STATUS_BG[(r.lateMinutes ?? 0) > 0 ? 'HALF_DAY' : r.status === 'WORKING' ? 'PRESENT' : r.status], title: `${clock(r.checkIn, tz)} – ${r.openSince ? 'now' : clock(r.checkOut, tz)}` }] : []}
                    now={nowMin}
                  />
                  <span className="flex items-center gap-1">
                    <Badge tone={(r.lateMinutes ?? 0) > 0 ? 'warning' : meta.tone} dot>
                      {(r.lateMinutes ?? 0) > 0 ? `Late ${lateBy(r.lateMinutes)}` : r.leave && r.status === 'ON_LEAVE' ? r.leave.name : meta.label}
                    </Badge>
                    {onEdit && <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.employee.firstName}'s day`} onClick={() => onEdit(r)}><Pencil /></Button>}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Bars run from check-in to check-out (or now) · dashed = their shift · red line = now. Click a name for their month.</p>
          {rows.length > 60 && <p className="mt-1 text-xs text-muted-foreground">Showing the first 60 — search or pick a department to narrow down, or use the List view.</p>}
        </Card>

        <div className="space-y-4">
          {live && notIn.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold">{notIn.length} not checked in yet</p>
              <div className="mt-2 flex flex-wrap gap-1">{notIn.slice(0, 8).map((r) => <PersonAvatar key={r.employee.id} person={r.employee} size="xs" />)}</div>
              <Button size="sm" variant="secondary" className="mt-3 w-full" loading={nudge.isPending} onClick={() => void sendNudge(notIn.map((r) => r.employee.id), 'check_in')}>
                <BellRing /> Remind them to check in
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">An in-app reminder (no email). Once a day per person.</p>
            </Card>
          )}
          <NeedsAttention onNudge={sendNudge} busy={nudge.isPending} />
        </div>
      </div>
    </div>
  );
}

/** Missed check-outs, absent without leave, late often, many corrections — with a nudge. */
function NeedsAttention({ onNudge, busy }: { onNudge: (ids: string[], kind: 'check_in' | 'fix') => Promise<void>; busy: boolean }) {
  const insights = useInsights();
  const [seeAll, setSeeAll] = useState<{ list: InsightList; title: string } | null>(null);
  const d = insights.data;
  if (insights.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!d) return null;
  const c = d.counts;
  const items: Array<{ key: InsightList; tone: string; title: string; people: PersonLite[]; count: number; action?: () => void; actionLabel?: string }> = [
    { key: 'missingCheckout', tone: 'bg-violet-500', title: `${c.missingCheckout} missed check-out${c.missingCheckout === 1 ? '' : 's'} yesterday`, people: d.missingCheckout.map((x) => x.employee), count: c.missingCheckout, action: () => void onNudge(d.missingCheckoutIds, 'fix'), actionLabel: 'Ask them to fix it' },
    { key: 'absent', tone: 'bg-destructive', title: `${c.absent} absent without leave (last 7 days)`, people: d.absent.map((x) => x.employee), count: c.absent },
    { key: 'lateOften', tone: 'bg-warning', title: `${c.lateOften} late ${d.thresholds.late}+ times this month`, people: d.lateOften.map((x) => x.employee), count: c.lateOften },
    { key: 'manyCorrections', tone: 'bg-pink-500', title: `${c.manyCorrections} with more than ${d.thresholds.corrections} corrections this month`, people: d.manyCorrections.map((x) => x.employee), count: c.manyCorrections },
  ].filter((x) => x.count) as Array<{ key: InsightList; tone: string; title: string; people: PersonLite[]; count: number; action?: () => void; actionLabel?: string }>;
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Needs your attention</p>
      {!items.length ? (
        <p className="mt-2 text-sm text-muted-foreground">All good — nothing stands out.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((it) => (
            <li key={it.key} className="flex gap-2.5">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', it.tone)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{it.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {it.people.slice(0, 3).map((p) => `${p.firstName} ${p.lastName}`).join(', ')}
                  {it.count > 3 && (
                    <button type="button" onClick={() => setSeeAll({ list: it.key, title: it.title })} className="ml-1 font-semibold text-primary hover:underline">+{it.count - 3} · see all</button>
                  )}
                </p>
                {it.action && <Button size="sm" variant="link" className="h-auto p-0 text-xs" disabled={busy} onClick={it.action}>{it.actionLabel} →</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {seeAll && <InsightPeople list={seeAll.list} title={seeAll.title} onClose={() => setSeeAll(null)} />}
    </Card>
  );
}

/** Everyone behind one "Needs your attention" line, 25 at a time. */
function InsightPeople({ list, title, onClose }: { list: InsightList; title: string; onClose: () => void }) {
  const q = useInsightList(list);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const note = (r: InsightRow) => (r.dates ? r.dates.map((x) => dayLabel(x)).join(', ') : r.date ? dayLabel(r.date) : r.count !== undefined ? `${r.count} times` : '');
  return (
    <Modal open onClose={onClose} title={title} icon={<Users />} size="sm">
      {q.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load')} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.employee.id}>
                <Link href={`/app/attendance?employee=${r.employee.id}`} className="flex items-center gap-3 py-2 text-sm hover:bg-subtle">
                  <PersonAvatar person={r.employee} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.employee.firstName} {r.employee.lastName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{note(r)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <LoadMore shown={rows.length} total={q.data.pages[0]?.meta.total ?? 0} loading={q.isFetchingNextPage} onMore={() => void q.fetchNextPage()} />
        </>
      )}
    </Modal>
  );
}

/** People × days for a month. */
function MonthGrid({ departmentId, search, tz }: { departmentId: string; search: string; tz: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [departmentId, search, month]);
  const q = useTeamMonth({ month, departmentId: departmentId || undefined, search: search || undefined, page });
  const shift = (by: number) => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    setMonth(new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7));
  };
  const d = q.data;
  const holidays = new Map((d?.holidays ?? []).map((h) => [h.date, h.name]));
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
        <Button size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft /></Button>
        <Button size="icon-sm" variant="ghost" aria-label="Next month" onClick={() => shift(1)} disabled={month >= new Date().toISOString().slice(0, 7)}><ChevronRight /></Button>
        <span className="ml-auto text-xs text-muted-foreground">Each square is a day · hover for the details</span>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load the month')} onRetry={() => q.refetch()} />
      ) : !d?.data.length ? (
        <EmptyState icon={<Users />} title="No one here" description="Try another filter or search." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-[3px] text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[160px] bg-surface text-left font-semibold text-muted-foreground">Person</th>
                  {d.days.map((k) => (
                    <th key={k} title={holidays.get(k)} className={cn('min-w-[18px] text-center text-[10px] font-semibold tabular-nums', k === d.today ? 'rounded bg-primary text-primary-foreground' : holidays.has(k) ? 'rounded bg-teal-500/15 text-teal-700 dark:text-teal-300' : 'text-muted-foreground')}>
                      {Number(k.slice(8))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.data.map((row, r) => (
                  <tr key={row.employee.id}>
                    <td className="sticky left-0 z-10 bg-surface pr-2">
                      <Link href={`/app/attendance?employee=${row.employee.id}`} className="flex items-center gap-2 hover:underline">
                        <PersonAvatar person={row.employee} size="xs" />
                        <span className="truncate font-medium">{row.employee.firstName} {row.employee.lastName}</span>
                      </Link>
                    </td>
                    {row.days.map((x, i) => (
                      <td key={x.date} className="p-0">
                        <span
                          title={`${dayLabel(x.date)} · ${x.leave ?? STATUS_META[x.status].label}${x.checkIn ? ` · ${clock(x.checkIn, tz)}–${clock(x.checkOut, tz)}` : ''}${(x.lateMinutes ?? 0) > 0 ? ` · late ${lateBy(x.lateMinutes)}` : ''}`}
                          className={cn('m-pop relative block aspect-square min-w-[16px] rounded-[4px]', x.status === 'UPCOMING' || x.status === 'NOT_JOINED' ? 'bg-transparent' : STATUS_BG[x.status], (x.lateMinutes ?? 0) > 0 && 'ring-2 ring-inset ring-warning')}
                          style={{ animationDelay: `${(i * 8 + r * 25) % 600}ms` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(['PRESENT', 'HALF_DAY', 'ABSENT', 'MISSING_CHECKOUT', 'ON_LEAVE', 'WORK_FROM_HOME', 'WFH_NOT_CHECKED_IN', 'HOLIDAY', 'WEEKEND'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1"><span className={cn('h-2.5 w-2.5 rounded-[3px]', STATUS_BG[s])} />{STATUS_META[s].label}</span>
            ))}
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px] ring-2 ring-inset ring-warning" />Late</span>
          </div>
          <Pagination page={page} totalPages={d.meta.totalPages} total={d.meta.total} limit={d.meta.limit} onPageChange={setPage} />
        </>
      )}
    </Card>
  );
}

/** The detailed table with status filters (as before). */
function ListView({ team, tz, status, setStatus, page, setPage, onEdit }: { team: TeamQuery; tz: string; status: string; setStatus: (s: string) => void; page: number; setPage: (n: number) => void; onEdit: ((r: Row) => void) | null }) {
  const data = team.data;
  const chips: Array<{ id: string; label: string; count: number | undefined }> = [
    { id: '', label: 'Everyone', count: data?.counts.total },
    { id: 'PRESENT', label: 'Present', count: data?.counts.present },
    { id: 'WORKING', label: 'Checked in', count: data?.counts.working },
    { id: 'LATE', label: 'Late', count: data?.counts.late },
    { id: 'HALF_DAY', label: 'Half day', count: data?.counts.halfDay },
    { id: 'NOT_CHECKED_IN', label: 'Not checked in', count: data?.counts.notCheckedIn },
    { id: 'ABSENT', label: 'Absent', count: data?.counts.absent },
    { id: 'MISSING_CHECKOUT', label: 'Missing check-out', count: data?.counts.missingCheckout },
    { id: 'ON_LEAVE', label: 'On leave', count: data?.counts.onLeave },
    { id: 'WORK_FROM_HOME', label: 'Work from home', count: data?.counts.workFromHome },
  ];
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            onClick={() => setStatus(c.id)}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors', status === c.id ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border text-muted-foreground hover:bg-subtle')}
          >
            {c.label}
            <span className="tabular-nums">{c.count ?? '–'}</span>
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        {team.isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : team.isError ? (
          <ErrorState message={getApiErrorMessage(team.error, 'Could not load attendance')} onRetry={() => team.refetch()} />
        ) : !data?.data.length ? (
          <EmptyState icon={<Users />} title="No one here" description="Try another day, filter or search." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-subtle/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">In</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">Out</th>
                    <th className="hidden px-4 py-3 font-semibold md:table-cell">Worked</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <tr key={r.employee.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <PersonAvatar person={r.employee} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.employee.firstName} {r.employee.lastName}</p>
                              <p className="truncate text-xs text-muted-foreground">{r.shift?.id ? `${r.shift.name} shift` : r.employee.designation?.name ?? r.employee.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={meta.tone} dot>{meta.label}</Badge>
                            {(r.lateMinutes ?? 0) > 0 && <Badge tone="warning">Late {lateBy(r.lateMinutes)}</Badge>}
                            {r.isManualEntry && <Badge tone="outline">Corrected</Badge>}
                            {r.autoClosed && <Badge tone="outline">Closed automatically</Badge>}
                            {r.leave && (
                              <Badge tone="outline" title={r.leave.status === 'PENDING' ? 'Waiting for approval' : undefined}>
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.leave.color }} />
                                {r.leave.name}{r.leave.halfDay ? ' (½)' : ''}{r.leave.status === 'PENDING' ? ' · pending' : ''}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="hidden px-4 py-2.5 tabular-nums sm:table-cell">{clock(r.checkIn, tz)}</td>
                        <td className="hidden px-4 py-2.5 tabular-nums sm:table-cell">{clock(r.checkOut, tz)}</td>
                        <td className="hidden px-4 py-2.5 md:table-cell">{hours(r.workingMinutes)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon-sm" variant="ghost" asChild aria-label={`Month view for ${r.employee.firstName}`}>
                              <Link href={`/app/attendance?employee=${r.employee.id}`}><CalendarDays /></Link>
                            </Button>
                            {onEdit && (
                              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.employee.firstName}'s day`} onClick={() => onEdit(r)}>
                                <Pencil />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} onPageChange={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
