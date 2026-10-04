'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Popover from '@radix-ui/react-popover';
import { CalendarClock, ClipboardCheck, Clock, Headset, LogOut as LeaveIcon, Megaphone, PackageOpen, Receipt, ShieldCheck, Timer, Upload, UserPlus, Users, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Donut, IconTile, Kpi, MiniBars } from '@/components/dashboard/widgets';
import { Blocks, HBars, Lollipop, ViewAs, useChartStyle } from '@/components/dashboard/charts';
import { CountUp } from '@/components/motion/motion';
import { useAccess } from '@/lib/access/use-access';
import { usePendingCorrections, useTeamAttendance } from '@/lib/company/attendance';
import { usePendingLeave, useWhosOff } from '@/lib/company/leave';
import { usePendingExpenses } from '@/lib/company/expenses';
import { usePendingTimesheets } from '@/lib/company/timesheets';
import { usePendingAssetRequests } from '@/lib/company/assets';
import { useHelpdeskCounts } from '@/lib/company/helpdesk';
import { monthLabel, usePeopleReport } from '@/lib/company/reports';
import { useIsApprover } from '@/lib/company/projects';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useUiState } from '@/lib/preferences/ui-state';

const localKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Approvals the signed-in person can act on, per module. */
export function useApprovals() {
  const { can, hasFeature } = useAccess();
  const isApprover = useIsApprover('leave.approve');
  const leave = usePendingLeave();
  const corrections = usePendingCorrections();
  const expenses = usePendingExpenses();
  const timesheets = usePendingTimesheets();
  const assets = usePendingAssetRequests();
  const rows = [
    { key: 'leave', label: 'Leave requests', icon: <CalendarClock />, href: '/app/leave/approvals', count: leave.data, show: hasFeature('time.leave') && (can('leave.approve') || isApprover) },
    { key: 'att', label: 'Attendance corrections', icon: <ClipboardCheck />, href: '/app/attendance/approvals', count: corrections.data, show: hasFeature('time.attendance') && (can('attendance.approve') || isApprover) },
    { key: 'exp', label: 'Expense claims', icon: <Receipt />, href: '/app/expenses/approvals', count: expenses.data, show: hasFeature('ops.expenses') && (can('expense.approve') || can('expense.finance') || can('expense.hr') || isApprover) },
    { key: 'ts', label: 'Timesheets', icon: <Timer />, href: '/app/timesheets/approvals', count: timesheets.data, show: hasFeature('work.timesheets') && (can('timesheet.approve') || isApprover) },
    { key: 'as', label: 'Asset requests', icon: <PackageOpen />, href: '/app/assets/requests', count: assets.data, show: hasFeature('ops.assets') && (can('asset.approve_it') || can('asset.approve_hr') || can('asset.manage')) },
  ].filter((r) => r.show);
  const loaded = rows.every((r) => r.count !== undefined);
  const total = rows.reduce((n, r) => n + (r.count ?? 0), 0);
  return { rows, total: loaded ? total : undefined };
}

/** Today's company numbers for the hero (present, on leave, WFH). */
export function useCompanyToday() {
  const { can, hasFeature, scopeOf } = useAccess();
  const enabled = hasFeature('time.attendance') && can('attendance.view') && scopeOf('attendance.view') === 'company';
  const team = useTeamAttendance({ date: localKey(), limit: 1 }, enabled);
  const c = team.data?.counts;
  return { enabled, counts: c, present: c ? c.present + c.halfDay + c.working + c.missingCheckout : undefined };
}

/** Headline numbers for people who look after the whole company. */
export function AdminKpis({ employeeCount, departmentCount, portalUsers }: { employeeCount?: number; departmentCount?: number; portalUsers?: { total: number; active: number } }) {
  const { can, hasFeature, scopeOf } = useAccess();
  const companyAttendance = hasFeature('time.attendance') && can('attendance.view') && scopeOf('attendance.view') === 'company';
  const team = useTeamAttendance({ date: localKey(), limit: 1 }, companyAttendance);
  const approvals = useApprovals();
  const tickets = useHelpdeskCounts();
  const handlesTickets = ['ticket.handle_it', 'ticket.handle_hr', 'ticket.handle_finance'].some(can);
  const c = team.data?.counts;
  const present = c ? c.present + c.halfDay + c.working + c.missingCheckout : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Kpi label="Employees" icon={<Users />} value={employeeCount} hint={departmentCount !== undefined ? `${departmentCount} departments${portalUsers ? ` · ${portalUsers.active} of ${portalUsers.total} portal users active` : ''}` : undefined} href="/app/employees" />
      {companyAttendance && <Kpi label="Present today" icon={<UsersRound />} value={present} hint={c ? `of ${c.total} · ${c.notCheckedIn} not checked in` : undefined} href="/app/attendance/team" />}
      {companyAttendance && <Kpi label="On leave today" icon={<LeaveIcon />} value={c?.onLeave} hint={c ? `${c.workFromHome} working from home` : undefined} href="/app/leave/calendar" />}
      <Kpi label="Waiting for you" icon={<Clock />} value={approvals.total} tone={approvals.total ? 'primary' : undefined} hint={`across ${approvals.rows.length} module${approvals.rows.length === 1 ? '' : 's'}`} />
      {handlesTickets && <Kpi label="Tickets to handle" icon={<Headset />} value={tickets.data?.queue} hint="Unassigned or yours" href="/app/helpdesk/queue" />}
    </div>
  );
}

/** Today across the company: in office / WFH / leave / not checked in. */
const ATT_STYLES = ['donut', 'list'] as const;
export function AttendanceTodayCard({ className }: { className?: string }) {
  const { can, hasFeature, scopeOf } = useAccess();
  const [style, setStyle] = useChartStyle('attendance-today', ATT_STYLES, 'donut');
  const enabled = hasFeature('time.attendance') && can('attendance.view') && scopeOf('attendance.view') !== 'own';
  const team = useTeamAttendance({ date: localKey(), limit: 1 }, enabled);
  if (!enabled) return null;
  const c = team.data?.counts;
  return (
    <Card className={className}>
      <CardHeader title="Attendance today" description={team.data?.holiday ? team.data.holiday.name : undefined} action={<div className="flex items-center gap-3"><ViewAs options={ATT_STYLES} value={style} onChange={setStyle} /><Link href="/app/attendance/team" className="text-xs font-medium text-primary hover:underline">Team</Link></div>} />
      <div key={style} className="px-5 pb-5">
        {!c ? (
          <Skeleton className="h-32 w-full" />
        ) : c.present + c.halfDay + c.working + c.missingCheckout + c.workFromHome + c.onLeave + c.notCheckedIn + c.absent === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{team.data?.holiday ? `${team.data.holiday.name} — a holiday.` : 'Not a working day — nobody is expected in.'}</p>
        ) : style === 'list' ? (
          <HBars
            rows={[
              { label: 'In office', value: c.present + c.halfDay + c.working + c.missingCheckout, max: c.total, tone: 'primary' },
              { label: 'Work from home', value: c.workFromHome, max: c.total, tone: 'info' },
              { label: 'On leave', value: c.onLeave, max: c.total, tone: 'warning' },
              { label: 'Not checked in', value: c.notCheckedIn + c.absent, max: c.total, tone: 'neutral' },
            ]}
          />
        ) : (
          <Donut
            label="Attendance today"
            total={c.total}
            center={<><span className="text-2xl font-bold tabular-nums">{c.total}</span><span className="text-2xs text-muted-foreground">people</span></>}
            slices={[
              { label: 'In office', value: c.present + c.halfDay + c.working + c.missingCheckout, tone: 'primary' },
              { label: 'Work from home', value: c.workFromHome, tone: 'info' },
              { label: 'On leave', value: c.onLeave, tone: 'warning' },
              { label: 'Not checked in', value: c.notCheckedIn + c.absent, tone: 'neutral' },
            ]}
          />
        )}
      </div>
    </Card>
  );
}

/** Approvals waiting for the signed-in person, per module. */
export function ApprovalsCard() {
  const { rows, total } = useApprovals();
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader title="Waiting for your approval" action={total ? <Badge tone="primary">{total}</Badge> : undefined} />
      <ul className="m-stagger divide-y divide-border px-5 pb-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 py-2.5">
            <IconTile tone={r.count ? 'primary' : 'neutral'}>{r.icon}</IconTile>
            <span className="flex-1 text-sm font-medium">{r.label}</span>
            {r.count === undefined ? <Skeleton className="h-5 w-8" /> : <Badge tone={r.count ? 'primary' : 'neutral'}>{r.count}</Badge>}
            <Link href={r.href} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-subtle">Review</Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function usePeople() {
  const { can, hasFeature } = useAccess();
  const enabled = hasFeature('insights.reports') && can('report.view');
  return { enabled, q: usePeopleReport(enabled) };
}

const TREND_STYLES = ['mirror', 'bridge', 'faces'] as const;

/** Tiny trend line (theme colour via currentColor). */
function Spark({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const pts = values.map((v, i) => `${(i * 100) / Math.max(1, values.length - 1)},${28 - ((v - min) / (max - min || 1)) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn('h-7 w-full', className)} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="m-line" style={{ ['--m-len' as string]: 300 }} />
    </svg>
  );
}

/** Joiners, leavers and headcount: story tiles on top, then a mirror chart, the headcount bridge, or faces on a timeline. */
export function JoinersCard() {
  const { enabled, q } = usePeople();
  const [style, setStyle] = useChartStyle('headcount-trend', TREND_STYLES, 'mirror');
  if (!enabled) return null;
  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  const r = q.data;
  if (!r) return null;
  const month = (m: string) => monthLabel(m).split(' ')[0]!;
  const thisMonth = r.asOf.slice(0, 7);
  const probationEnds = r.probation.filter((p) => p.confirmationDate?.startsWith(thisMonth)).length;
  const tenure = r.avgTenureMonths >= 12 ? `${(r.avgTenureMonths / 12).toFixed(1)} yrs` : `${r.avgTenureMonths} mo`;
  const tiles = [
    { label: 'Joined', value: r.joiners12, spark: r.trend.map((t) => t.joiners), tone: 'text-success' },
    { label: 'Left', value: r.leavers12, spark: r.trend.map((t) => t.leavers), tone: 'text-destructive' },
    { label: 'Attrition', value: `${r.attritionPct}%`, hint: '12 months' },
    { label: 'Avg tenure', value: tenure, hint: 'company-wide' },
    { label: 'Probation ends', value: probationEnds, hint: 'this month' },
    { label: 'Joining soon', value: r.upcomingJoiners, hint: 'accepted offers' },
  ];
  const maxMove = Math.max(1, ...r.trend.map((t) => Math.max(t.joiners, t.leavers)));
  const heads = r.trend.map((t) => t.headcount);
  const hMax = Math.max(...heads);
  const hMin = Math.min(...heads);

  return (
    <Card>
      <CardHeader
        title="Joiners & leavers"
        description="Last 12 months"
        action={
          <div className="flex items-center gap-3">
            <ViewAs options={TREND_STYLES} value={style} onChange={setStyle} />
            <Link href="/app/reports" className="text-xs font-medium text-primary hover:underline">People report</Link>
          </div>
        }
      />
      {/* Story tiles */}
      <div className="m-stagger grid grid-cols-2 gap-2.5 px-5 sm:grid-cols-3 xl:grid-cols-5">
        <div className="m-lift col-span-2 flex flex-col justify-between gap-1 rounded-lg border border-border bg-gradient-to-br from-primary-soft to-surface p-3 sm:col-span-3 xl:col-span-2 xl:row-span-2">
          <span className="text-xs text-muted-foreground">People today</span>
          <span className="text-4xl font-bold tracking-tight"><CountUp value={r.headcount} /></span>
          <span className="text-xs font-semibold text-success">{r.headcount - r.startHeadcount >= 0 ? '▲' : '▼'} {Math.abs(r.headcount - r.startHeadcount)} in 12 months</span>
          <Spark values={heads} className="text-primary" />
        </div>
        {tiles.map((t) => (
          <div key={t.label} className="m-lift flex flex-col gap-0.5 rounded-lg border border-border p-3">
            <span className="text-xs text-muted-foreground">{t.label}</span>
            <span className={cn('text-xl font-bold tracking-tight', t.tone)}>{typeof t.value === 'number' ? <CountUp value={t.value} /> : t.value}</span>
            {t.spark ? <Spark values={t.spark} className={t.tone} /> : <span className="text-2xs text-muted-foreground">{t.hint}</span>}
          </div>
        ))}
      </div>

      <div key={style} className="px-5 pb-5 pt-4">
        {style === 'mirror' ? (
          <div>
            <div className="mb-2 flex gap-4 text-2xs text-muted-foreground">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-success" />Joined (above)</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-destructive" />Left (below)</span>
              <span className="flex items-center gap-1"><i className="h-0.5 w-3 bg-primary" />Headcount</span>
            </div>
            <div className="relative">
              <svg viewBox="0 0 120 30" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 h-10 w-full text-primary" aria-hidden>
                <polyline points={heads.map((h, i) => `${i * 10 + 5},${26 - ((h - hMin) / (hMax - hMin || 1)) * 22}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" className="m-line" style={{ ['--m-len' as string]: 600 }} />
              </svg>
              <div className="grid grid-cols-12 gap-1.5 pt-11" role="img" aria-label={r.trend.map((t) => `${monthLabel(t.month)}: +${t.joiners} −${t.leavers}`).join(', ')}>
                {r.trend.map((t, i) => (
                  <div key={t.month} className="flex flex-col items-center" title={`${monthLabel(t.month)} · +${t.joiners} joined · −${t.leavers} left · ${t.headcount} people`}>
                    <div className="flex h-16 w-full items-end justify-center">
                      {t.joiners > 0 && <div className="m-grow-y w-full max-w-[26px] rounded-t-md bg-success" style={{ height: `${(t.joiners / maxMove) * 100}%`, animationDelay: `${i * 40}ms` }} />}
                    </div>
                    <div className="h-px w-full bg-border" />
                    <div className="flex h-12 w-full items-start justify-center">
                      {t.leavers > 0 && <div className="m-grow-y w-full max-w-[26px] origin-top rounded-b-md bg-destructive" style={{ height: `${(t.leavers / maxMove) * 100}%`, transformOrigin: 'top', animationDelay: `${i * 40}ms` }} />}
                    </div>
                    <span className="mt-1 text-2xs text-muted-foreground">{month(t.month)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : style === 'bridge' ? (
          <Bridge start={r.startHeadcount} joined={r.joiners12} left={r.leavers12} end={r.headcount} />
        ) : (
          <FacesTimeline months={r.trend.map((t) => t.month)} movements={r.movements} />
        )}
      </div>
    </Card>
  );
}

/** Start → +joined → −left → today, as floating bars. */
function Bridge({ start, joined, left, end }: { start: number; joined: number; left: number; end: number }) {
  const top = Math.max(1, start + joined, end);
  const h = 150;
  const px = (n: number) => (n / top) * h;
  const bars = [
    { label: '12 months ago', value: start, bottom: 0, height: px(start), cls: 'bg-primary' },
    { label: 'Joined', value: `+${joined}`, bottom: px(start), height: px(joined), cls: 'bg-success' },
    { label: 'Left', value: `−${left}`, bottom: px(start + joined - left), height: px(left), cls: 'bg-destructive' },
    { label: 'Today', value: end, bottom: 0, height: px(end), cls: 'bg-primary' },
  ];
  return (
    <div className="grid grid-cols-4 gap-4" role="img" aria-label={`Headcount ${start} → plus ${joined} joined → minus ${left} left → ${end} today`}>
      {bars.map((b, i) => (
        <div key={b.label} className="flex flex-col items-center gap-1.5">
          <div className="relative w-full max-w-[110px]" style={{ height: h + 22 }}>
            <div className={cn('m-pop absolute inset-x-0 rounded-md', b.cls)} style={{ bottom: b.bottom, height: Math.max(3, b.height), animationDelay: `${i * 140}ms` }} />
            <span className="absolute inset-x-0 text-center text-sm font-bold tabular-nums" style={{ bottom: b.bottom + Math.max(3, b.height) + 4 }}>{b.value}</span>
          </div>
          <span className="text-xs text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Profile photos on a 12-month timeline: joiners above the line, leavers below. */
function FacesTimeline({ months, movements }: { months: string[]; movements: Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null; kind: 'joined' | 'left'; date: string }> }) {
  if (!movements.length) return <p className="py-6 text-center text-sm text-muted-foreground">Nobody joined or left in the last 12 months.</p>;
  const all = (kind: 'joined' | 'left', m: string) => movements.filter((x) => x.kind === kind && x.date.startsWith(m));
  const col = (kind: 'joined' | 'left', m: string) => all(kind, m).slice(0, 3);
  const more = (kind: 'joined' | 'left', m: string) => Math.max(0, all(kind, m).length - 3);
  const extra = (n: number) => (n ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold">+{n}</span> : null);
  return (
    <div className="grid grid-cols-12 gap-1">
      {months.map((m, i) => (
        <div key={m} className="flex flex-col items-center">
          <div className="flex h-[112px] flex-col-reverse items-center justify-start gap-1 overflow-hidden">
            {col('joined', m).map((p, k) => (
              <span key={p.id} title={`${p.firstName} ${p.lastName} joined · ${formatDate(p.date)}`} className="m-pop transition-transform hover:z-10 hover:scale-125" style={{ animationDelay: `${(i * 2 + k) * 50}ms` }}>
                <PersonAvatar person={p} size="xs" className="ring-2 ring-success" />
              </span>
            ))}
            {extra(more('joined', m))}
          </div>
          <div className="my-1 h-0.5 w-full bg-border" />
          <div className="flex h-[84px] flex-col items-center gap-1 overflow-hidden">
            {col('left', m).map((p, k) => (
              <span key={p.id} title={`${p.firstName} ${p.lastName} left · ${formatDate(p.date)}`} className="m-pop grayscale-[40%] transition-transform hover:z-10 hover:scale-125" style={{ animationDelay: `${(i * 2 + k) * 50}ms` }}>
                <PersonAvatar person={p} size="xs" className="ring-2 ring-destructive" />
              </span>
            ))}
            {extra(more('left', m))}
          </div>
          <span className="text-2xs text-muted-foreground">{monthLabel(m).split(' ')[0]}</span>
        </div>
      ))}
    </div>
  );
}

const DEPT_STYLES = ['list', 'donut', 'lollipop', 'blocks'] as const;
const DEPT_TONES = ['primary', 'info', 'success', 'warning', 'neutral', 'danger'] as const;
/** Headcount by department. */
export function DepartmentsCard() {
  const { enabled, q } = usePeople();
  const [style, setStyle] = useChartStyle('by-department', DEPT_STYLES, 'list');
  if (!enabled) return null;
  if (q.isLoading) return <Skeleton className="h-56 w-full" />;
  const all = [...(q.data?.byDepartment ?? [])].sort((a, b) => b.count - a.count).map((d) => ({ label: d.label, value: d.count }));
  if (!all.length) return null;
  const total = all.reduce((n, d) => n + d.value, 0);
  // Charts that need every slice readable get the top 7 and "Other"
  const top = all.length > 8 ? [...all.slice(0, 7), { label: `Other (${all.length - 7})`, value: all.slice(7).reduce((n, d) => n + d.value, 0) }] : all;
  return (
    <Card>
      <CardHeader title="By department" description={`${all.length} department${all.length === 1 ? '' : 's'} · ${total} people`} action={<ViewAs options={DEPT_STYLES} value={style} onChange={setStyle} />} />
      <div key={style} className="px-5 pb-5">
        {style === 'list' || style === 'lollipop' ? (
          <div className={cn(all.length > 8 && 'max-h-[272px] overflow-y-auto pr-2 [mask-image:linear-gradient(#000_88%,transparent)]')} tabIndex={all.length > 8 ? 0 : undefined} aria-label={all.length > 8 ? 'All departments (scroll)' : undefined}>
            {style === 'list' ? <HBars rows={all} /> : <Lollipop rows={all} />}
          </div>
        ) : style === 'blocks' ? (
          <Blocks rows={top} />
        ) : (
          <Donut
            label="By department"
            total={total}
            center={<><span className="text-2xl font-bold tabular-nums">{total}</span><span className="text-2xs text-muted-foreground">people</span></>}
            slices={top.map((d, i) => ({ label: d.label, value: d.value, tone: DEPT_TONES[i % DEPT_TONES.length]! }))}
          />
        )}
      </div>
    </Card>
  );
}

/** People on probation or serving notice. */
export function ProbationCard() {
  const { enabled, q } = usePeople();
  const r = q.data;
  if (!enabled || !r || (r.probation.length === 0 && r.notice.length === 0)) return null;
  return (
    <Card>
      <CardHeader title="Probation & notice" />
      <ul className="divide-y divide-border px-5 pb-2">
        {r.probation.slice(0, 4).map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
            <PersonAvatar person={e} size="sm" />
            <Link href={`/app/employees/${e.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{e.firstName} {e.lastName}</Link>
            <span className="text-xs text-muted-foreground">{e.confirmationDate ? `Confirm by ${formatDate(e.confirmationDate)}` : `Joined ${formatDate(e.joiningDate)}`}</span>
            <Badge tone="info">Probation</Badge>
          </li>
        ))}
        {r.notice.slice(0, 4).map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
            <PersonAvatar person={e} size="sm" />
            <Link href={`/app/employees/${e.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{e.firstName} {e.lastName}</Link>
            <span className="text-xs text-muted-foreground">{e.terminationDate ? `Last day ${formatDate(e.terminationDate)}` : 'Last day not set'}</span>
            <Badge tone="warning">Notice</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Who's off: a month calendar (hover a day to preview, click to pin the list) or this week's list. */
const WHOS_OFF_VIEWS = ['calendar', 'list'] as const;
type WhosOffView = (typeof WHOS_OFF_VIEWS)[number];
export function WhosOffCard() {
  const { can, hasFeature, scopeOf } = useAccess();
  const enabled = hasFeature('time.leave') && can('leave.view') && scopeOf('leave.view') !== 'own';
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = localKey(now);
  const q = useWhosOff({ month }, enabled);
  const [view, setView] = useUiState<WhosOffView>('whos-off:view', 'calendar', (v): v is WhosOffView => v === 'calendar' || v === 'list');
  // The day whose details are open in a popup (click a day; Esc or click outside closes it)
  const [openDay, setOpenDay] = useState<string | null>(null);
  if (!enabled) return null;

  const leaves = (q.data?.leaves ?? []).filter((l) => l.status === 'APPROVED');
  const isWfh = (l: (typeof leaves)[number]) => l.leaveType.code === 'WFH' || /home/i.test(l.leaveType.name);
  const holidays = new Map((q.data?.holidays ?? []).map((h) => [h.date.slice(0, 10), h.name]));
  const offOn = (key: string) => leaves.filter((l) => l.startDate.slice(0, 10) <= key && l.endDate.slice(0, 10) >= key);

  // This week (list view)
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const from = localKey(monday);
  const to = localKey(sunday);
  const week = leaves.filter((l) => l.startDate <= to && l.endDate >= from).slice(0, 6);

  // Month grid, Monday first
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: lead + daysIn }, (_, i) => (i < lead ? null : localKey(new Date(now.getFullYear(), now.getMonth(), i - lead + 1))));

  return (
    <Card>
      <CardHeader
        title="Who’s off"
        description={view === 'calendar' ? first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'This week'}
        action={
          <div className="flex items-center gap-3">
            <div role="radiogroup" aria-label="View as" className="inline-flex rounded-md bg-muted p-0.5 text-xs font-semibold">
              {WHOS_OFF_VIEWS.map((v) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn('rounded px-2.5 py-1 capitalize transition-colors', view === v ? 'bg-surface text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground')}>
                  {v}
                </button>
              ))}
            </div>
            <Link href="/app/leave/calendar" className="text-xs font-medium text-primary hover:underline">Calendar</Link>
          </div>
        }
      />
      {q.isLoading ? (
        <div className="px-5 pb-5"><Skeleton className="h-40 w-full" /></div>
      ) : view === 'calendar' ? (
        <div className="px-5 pb-4">
          <div className="grid grid-cols-7 gap-1 text-center text-2xs font-semibold text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((key, i) => {
              if (!key) return <span key={`e${i}`} />;
              const off = offOn(key);
              const holiday = holidays.get(key);
              const weekend = [5, 6].includes(i % 7);
              const preview = holiday ?? (off.length ? off.map((l) => `${l.employee.firstName} · ${isWfh(l) ? 'WFH' : l.leaveType.name}`).join('\n') : 'Nobody off');
              const open = openDay === key;
              const label = new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
              return (
                <Popover.Root key={key} open={open} onOpenChange={(o) => setOpenDay(o ? key : null)}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      aria-label={`${label}: ${holiday ?? `${off.length} off`}`}
                      className={cn(
                        'group relative flex h-11 flex-col items-center justify-center gap-1 rounded-md border text-xs transition-all hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        open ? 'border-primary bg-primary-soft' : 'border-border',
                        holiday && !open && 'bg-info-soft',
                        weekend && !holiday && !open && 'bg-muted/60',
                        key === todayKey && 'ring-1 ring-primary',
                      )}
                    >
                      <b className="tabular-nums">{Number(key.slice(8))}</b>
                      <span className="flex h-1.5 gap-0.5">
                        {off.slice(0, 3).map((l) => <i key={l.id} className={cn('h-1.5 w-1.5 rounded-full', isWfh(l) ? 'bg-info' : 'bg-destructive')} />)}
                      </span>
                      {!open && <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 hidden -translate-x-1/2 whitespace-pre rounded-md bg-foreground px-2 py-1 text-left text-2xs font-medium text-background shadow-menu group-hover:block">{preview}</span>}
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      side="bottom"
                      align="center"
                      sideOffset={6}
                      collisionPadding={12}
                      className="z-50 w-72 rounded-xl border border-border bg-raised p-3 text-raised-foreground shadow-menu data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <p className="flex-1 text-sm font-semibold">{label}</p>
                        {holiday ? <Badge tone="info">Holiday</Badge> : <Badge tone={off.length ? 'danger' : 'neutral'}>{off.length} off</Badge>}
                      </div>
                      {holiday && <p className="mb-2 text-xs text-muted-foreground">{holiday} — company holiday</p>}
                      {off.length ? (
                        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {off.map((l) => (
                            <li key={l.id} className="flex items-center gap-2.5 text-sm">
                              <PersonAvatar person={l.employee} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{l.employee.firstName} {l.employee.lastName}</span>
                                <span className="block truncate text-2xs text-muted-foreground">{formatDate(l.startDate)}{l.endDate !== l.startDate ? ` – ${formatDate(l.endDate)}` : ''}{l.halfDay ? ' · half day' : ''}</span>
                              </span>
                              <Badge tone={isWfh(l) ? 'info' : 'danger'}>{isWfh(l) ? 'WFH' : l.leaveType.name}</Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        !holiday && <p className="text-xs text-muted-foreground">Nobody is off.</p>
                      )}
                      <Link href="/app/leave/calendar" onClick={() => setOpenDay(null)} className="mt-3 block border-t border-border pt-2 text-center text-xs font-medium text-primary hover:underline">
                        Open full calendar
                      </Link>
                      <Popover.Arrow className="fill-[hsl(var(--border))]" />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              );
            })}
          </div>
          <div className="mt-3 flex gap-3 text-2xs text-muted-foreground">
            <span className="mr-auto">Click a day for details</span>
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-destructive" />Leave</span>
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-info" />WFH</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-info-soft" />Holiday</span>
          </div>
        </div>
      ) : week.length ? (
        <ul className="divide-y divide-border px-5 pb-2">
          {week.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
              <PersonAvatar person={l.employee} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.employee.firstName} {l.employee.lastName}</p>
                <p className="truncate text-xs text-muted-foreground">{l.leaveType.name} · {formatDate(l.startDate)}{l.endDate !== l.startDate ? ` – ${formatDate(l.endDate)}` : ''}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Nobody is on leave this week.</p>
      )}
    </Card>
  );
}

/** Admin shortcuts, each only when the person may use it. */
export function AdminActionsCard() {
  const { can, hasFeature } = useAccess();
  const items = [
    { href: '/app/employees', icon: <UserPlus />, title: 'Add employee', text: 'One person', show: can('employee.create') },
    { href: '/app/employees/import', icon: <Upload />, title: 'Import', text: 'CSV upload', show: can('employee.import') },
    { href: '/app/users', icon: <Users />, title: 'Invite user', text: 'Portal access', show: can('user.invite') },
    { href: '/app/roles', icon: <ShieldCheck />, title: 'Roles', text: 'Permissions', show: can('role.view') },
    { href: '/app/announcements', icon: <Megaphone />, title: 'Announce', text: 'Post to everyone', show: hasFeature('engage.announcements') && can('announcement.post') },
  ].filter((i) => i.show);
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader title="Admin shortcuts" />
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        {items.map((i) => (
          <Link key={i.href + i.title} href={i.href} className="m-lift flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:bg-subtle">
            <IconTile tone="neutral" className="h-8 w-8">{i.icon}</IconTile>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{i.title}</span><span className="block truncate text-2xs text-muted-foreground">{i.text}</span></span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
