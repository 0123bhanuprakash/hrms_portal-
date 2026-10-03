'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlarmClock,
  BarChart3,
  Briefcase,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Gauge,
  HardDrive,
  Headset,
  Home,
  LayoutGrid,
  LogOut,
  Receipt,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Breakdown, DailyChart, Kpi, TrendChart } from '@/components/reports/charts';
import { useAccess } from '@/lib/access/use-access';
import { downloadCsv, label, monthLabel, useAttendanceReport, usePeopleReport, useUtilisationReport } from '@/lib/company/reports';
import { addDays, fmtHours, todayKey } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

type Tab = 'people' | 'attendance' | 'utilisation' | 'more';

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can, scopeOf, hasFeature, isLoading } = useAccess();
  const reportsOn = hasFeature('insights.reports') && can('report.view');
  const utilOn = hasFeature('work.projects') && (can('project.manage') || can('report.view'));
  const more = moreLinks(can, scopeOf, hasFeature);
  const tabs = [
    ...(reportsOn ? [{ id: 'people' as const, label: 'People', icon: <Users /> }, { id: 'attendance' as const, label: 'Attendance & leave', icon: <CalendarCheck /> }] : []),
    ...(utilOn ? [{ id: 'utilisation' as const, label: 'Utilisation', icon: <Gauge /> }] : []),
    ...(more.length ? [{ id: 'more' as const, label: 'More reports', icon: <LayoutGrid /> }] : []),
  ];
  const asked = params.get('tab') as Tab | null;
  const tab = tabs.find((t) => t.id === asked)?.id ?? tabs[0]?.id;

  if (!isLoading && !tabs.length) return <EmptyState icon={<ShieldCheck />} title="No reports for you" description="Reports are available to HR, managers, the PMO and Finance." />;
  const scopeText = scopeOf('report.view') === 'company' ? 'Everyone in the company' : 'People in your team';
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Reports & analytics" description={tab === 'utilisation' && can('project.manage') ? 'Everyone in the company' : tab === 'more' ? 'Reports that live with each feature.' : scopeText} />
      {tab && <Tabs tabs={tabs} value={tab} onChange={(t) => router.replace(`${pathname}?tab=${t}`)} />}
      {tab === 'people' && <PeopleTab canExport={can('report.export')} />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'utilisation' && <UtilisationTab canExport={can('project.manage') || can('report.export')} />}
      {tab === 'more' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {more.map((m) => (
            <Link key={m.href} href={m.href}>
              <Card className="flex h-full items-start gap-3 p-4 transition-colors hover:border-foreground/20">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground [&_svg]:size-4">{m.icon}</span>
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.text}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function moreLinks(can: (p: string) => boolean, scopeOf: (p: string) => string | null | undefined, hasFeature: (f: string) => boolean) {
  return [
    hasFeature('ops.expenses') && (can('expense.finance') || can('expense.hr')) && { href: '/app/expenses/payments', icon: <Receipt />, title: 'Expense spend', text: 'Claimed, approved and paid — by category, person and project.' },
    hasFeature('work.timesheets') && can('timesheet.view') && scopeOf('timesheet.view') !== 'own' && { href: '/app/timesheets/report', icon: <BarChart3 />, title: 'Hours by project', text: 'Logged and billable hours from timesheets.' },
    hasFeature('ops.helpdesk') && ['ticket.handle_it', 'ticket.handle_hr', 'ticket.handle_finance'].some(can) && { href: '/app/helpdesk/queue', icon: <Headset />, title: 'Helpdesk performance', text: 'Open, overdue, on-time % and ratings per queue.' },
    hasFeature('ops.assets') && (can('asset.manage') || scopeOf('asset.view') === 'company') && { href: '/app/assets', icon: <HardDrive />, title: 'Asset register', text: 'What the company owns, who has it, warranties.' },
  ].filter(Boolean) as Array<{ href: string; icon: React.ReactNode; title: string; text: string }>;
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ─── People ─────────────────────────────────────────────────

function PeopleTab({ canExport }: { canExport: boolean }) {
  const q = usePeopleReport();
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load the report')} onRetry={() => void q.refetch()} />;
  const r = q.data!;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Users />} label="Headcount" value={r.headcount} sub={r.upcomingJoiners ? `+${r.upcomingJoiners} joining soon` : `as of ${formatDate(r.asOf)}`} />
        <Kpi icon={<UserPlus />} label="Joined (12 months)" value={r.joiners12} />
        <Kpi icon={<LogOut />} label="Left (12 months)" value={r.leavers12} />
        <Kpi icon={<Gauge />} label="Attrition (12 months)" value={`${r.attritionPct}%`} sub="Leavers ÷ average headcount" tone={r.attritionPct >= 20 ? 'danger' : undefined} />
      </div>
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Breakdown title="By department" rows={r.byDepartment} />
        <Breakdown title="By location" rows={r.byLocation} />
        <Breakdown title="By level" rows={r.byLevel} />
        <Breakdown title="Tenure" rows={r.tenure} />
        <Breakdown title="Employment type" rows={r.byType.map((x) => ({ ...x, label: label(x.label) }))} />
        <Breakdown title="Gender" rows={r.byGender.map((x) => ({ ...x, label: label(x.label) }))} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PeopleList title="On probation" empty="Nobody on probation" rows={r.probation.map((e) => ({ ...e, note: e.confirmationDate ? `Confirmation due ${formatDate(e.confirmationDate)}` : `Joined ${formatDate(e.joiningDate)}` }))} />
        <PeopleList title="Serving notice" empty="Nobody is serving notice" rows={r.notice.map((e) => ({ ...e, note: e.terminationDate ? `Last day ${formatDate(e.terminationDate)}` : 'Last day not set' }))} />
      </div>
    </div>
  );
}

function PeopleList({ title, empty, rows }: { title: string; empty: string; rows: Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null; note: string }> }) {
  return (
    <Card className="overflow-hidden">
      <h3 className="border-b border-border px-5 py-3 text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((e) => (
            <li key={e.id}>
              <Link href={`/app/employees/${e.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-subtle">
                <PersonAvatar person={e} size="sm" />
                <span className="flex-1 truncate font-medium">{e.firstName} {e.lastName}</span>
                <span className="text-xs text-muted-foreground">{e.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </Card>
  );
}

// ─── Attendance & leave ─────────────────────────────────────

function AttendanceTab() {
  const thisMonth = todayKey().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const shift = (n: number) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  const q = useAttendanceReport(month);
  const r = q.data;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft /></Button>
        <span className="min-w-[110px] text-center text-sm font-semibold">{monthLabel(month)}</span>
        <Button size="icon-sm" variant="secondary" aria-label="Next month" disabled={month >= thisMonth} onClick={() => shift(1)}><ChevronRight /></Button>
        {r && <span className="text-xs text-muted-foreground">{r.workingDays} working days{month === thisMonth && ' so far'}</span>}
      </div>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={getApiErrorMessage(q.error, 'Could not load the report')} onRetry={() => void q.refetch()} /> : r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={<CalendarCheck />} label="Attendance rate" value={r.attendanceRatePct === null ? '—' : `${r.attendanceRatePct}%`} sub={`${r.headcount} people × ${r.workingDays} days`} />
            <Kpi icon={<Clock />} label="Average day" value={r.avgWorkingMinutes ? fmtHours(r.avgWorkingMinutes) : '—'} sub="On days with check-in and out" />
            <Kpi icon={<AlarmClock />} label="Late arrivals" value={r.lateArrivals} sub={r.lateArrivals ? `Average ${r.avgLateMinutes} min late` : undefined} />
            <Kpi icon={<Home />} label="Work from home" value={r.wfhDays} sub="Days" />
          </div>
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">Daily attendance</h3>
            {r.daily.length ? <DailyChart data={r.daily.map((d) => ({ ...d, label: d.date.slice(8) }))} /> : <p className="text-sm text-muted-foreground">No working days yet</p>}
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Breakdown title="Leave taken by type (days)" rows={r.leaveByType.map((x) => ({ label: x.type.name, count: x.days }))} />
            <Ranked title="Most leave" empty="No approved leave" rows={r.topLeave.map((x) => ({ employee: x.employee, value: `${x.days} day${x.days === 1 ? '' : 's'}` }))} />
            <Ranked title="Most often late" empty="Nobody was late" rows={r.topLate.map((x) => ({ employee: x.employee, value: `${x.count}× · ${x.minutes} min` }))} />
          </div>
        </>
      )}
    </div>
  );
}

function Ranked({ title, empty, rows }: { title: string; empty: string; rows: Array<{ employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null; value: string }> }) {
  return (
    <Card className="overflow-hidden">
      <h3 className="border-b border-border px-5 py-3 text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.filter((r) => r.employee).map((r) => (
            <li key={r.employee!.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <PersonAvatar person={r.employee!} size="xs" />
              <span className="flex-1 truncate">{r.employee!.firstName} {r.employee!.lastName}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{r.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </Card>
  );
}

// ─── Utilisation ────────────────────────────────────────────

function UtilisationTab({ canExport }: { canExport: boolean }) {
  const yesterday = addDays(todayKey(), -1);
  const [from, setFrom] = useState(addDays(yesterday, -27));
  const [to, setTo] = useState(yesterday);
  const [filter, setFilter] = useState<'all' | 'bench' | 'partial' | 'full'>('all');
  const [busy, setBusy] = useState(false);
  const q = useUtilisationReport({ from, to }, from <= to);
  const r = q.data;
  const rows = (r?.rows ?? []).filter((x) => filter === 'all' || (filter === 'bench' ? x.allocation === 0 : filter === 'partial' ? x.allocation > 0 && x.allocation < 100 : x.allocation >= 100));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From" htmlFor="ut-from"><Input id="ut-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To" htmlFor="ut-to"><Input id="ut-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        {canExport && (
          <Button variant="secondary" className="mb-0.5 ml-auto" loading={busy} onClick={async () => {
            setBusy(true);
            try {
              await downloadCsv('/reports/utilisation/export', `utilisation-${from}-to-${to}.csv`, { from, to });
            } catch (e) {
              toast.error(getApiErrorMessage(e, 'Could not export'));
            } finally {
              setBusy(false);
            }
          }}><Download /> CSV</Button>
        )}
      </div>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={getApiErrorMessage(q.error, 'Could not load the report')} onRetry={() => void q.refetch()} /> : r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={<Briefcase />} label="Average allocation" value={`${r.avgAllocationPct}%`} sub={`${r.full} full · ${r.partial} partial · ${r.bench} on bench`} />
            <Kpi icon={<Users />} label="On the bench" value={r.bench} sub="No live project today" tone={r.bench ? 'danger' : 'success'} />
            <Kpi icon={<Gauge />} label="Utilisation" value={r.utilisationPct === null ? '—' : `${r.utilisationPct}%`} sub={r.timesheets ? `Logged ÷ ${r.workingDays} days × ${r.hoursPerDay}h` : 'Turn on Timesheets to measure'} />
            <Kpi icon={<Receipt />} label="Billable" value={r.billablePct === null ? '—' : `${r.billablePct}%`} sub={r.internalMinutes ? `${fmtHours(r.internalMinutes)} internal work` : 'Of capacity'} />
          </div>

          <Card className="overflow-hidden">
            <h3 className="border-b border-border px-5 py-3 text-sm font-semibold">Projects</h3>
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
                        {r.timesheets && <><td className="px-3 py-2 text-right tabular-nums">{fmtHours(p.loggedMinutes)}</td><td className="px-5 py-2 text-right tabular-nums">{p.loggedMinutes ? `${Math.round((p.billableMinutes / p.loggedMinutes) * 100)}%` : '—'}</td></>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">Nobody is on a live project.</p>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
              <h3 className="mr-auto text-sm font-semibold">People</h3>
              {(['all', 'bench', 'partial', 'full'] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-md px-2 py-1 text-xs', filter === f ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}>
                  {f === 'all' ? `All ${r.people}` : f === 'bench' ? `Bench ${r.bench}` : f === 'partial' ? `Partial ${r.partial}` : `Full ${r.full}`}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="px-5 py-2 font-medium">Person</th><th className="px-3 py-2 font-medium">Projects</th><th className="px-3 py-2 text-right font-medium">Allocation</th>{r.timesheets && <><th className="px-3 py-2 text-right font-medium">Logged</th><th className="px-5 py-2 text-right font-medium">Utilisation</th></>}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((x) => (
                    <tr key={x.employee.id}>
                      <td className="px-5 py-2">
                        <Link href={`/app/employees/${x.employee.id}`} className="flex items-center gap-2 hover:underline">
                          <PersonAvatar person={x.employee} size="xs" />
                          <span className="truncate">{x.employee.firstName} {x.employee.lastName}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{x.projects.map((p) => `${p.name} ${p.allocation}%`).join(', ') || '—'}</td>
                      <td className="px-3 py-2 text-right"><Badge tone={x.allocation === 0 ? 'danger' : x.allocation < 100 ? 'warning' : 'success'}>{x.allocation}%</Badge></td>
                      {r.timesheets && (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtHours(x.loggedMinutes ?? 0)}</td>
                          <td className="px-5 py-2 text-right tabular-nums">{x.utilisationPct === null ? '—' : `${x.utilisationPct}%`}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
