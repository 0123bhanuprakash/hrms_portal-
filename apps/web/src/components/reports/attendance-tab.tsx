'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlarmClock, CalendarCheck, Clock, Home, Plane } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Drawer } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Breakdown, Kpi } from '@/components/reports/charts';
import { useAttendanceDay, useAttendanceReport, type AttendanceDay, type AttendanceReport, type DayPerson, type ReportFilters } from '@/lib/company/reports';
import { fmtHours } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { shortDate, type ReportParams } from './filters';
import { lateBy } from '@/lib/company/attendance';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** One cell per day of the period, coloured by attendance %. */
function AttendanceCalendar({ r, onDay }: { r: AttendanceReport; onDay: (date: string) => void }) {
  const byDate = new Map(r.daily.map((d) => [d.date, d]));
  const days: string[] = [];
  for (let d = r.from; d <= r.to; ) {
    days.push(d);
    const n = new Date(`${d}T00:00:00Z`);
    n.setUTCDate(n.getUTCDate() + 1);
    d = n.toISOString().slice(0, 10);
  }
  const lead = (new Date(`${r.from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const pctOf = (date: string) => {
    const d = byDate.get(date);
    return d && r.headcount ? Math.round((d.present / r.headcount) * 100) : null;
  };
  const tone = (p: number | null) => (p === null ? 'bg-muted text-muted-foreground' : p >= 95 ? 'bg-success text-white' : p >= 85 ? 'bg-success/60 text-white' : p >= 70 ? 'bg-warning/40 text-foreground' : 'bg-destructive/40 text-foreground');
  const long = days.length > 62;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
        {days.map((d) => {
          const working = byDate.has(d);
          const p = working ? pctOf(d) : null;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDay(d)}
              title={working ? `${formatDate(d)}: ${p ?? 0}% in` : `${formatDate(d)}: not a working day`}
              className={cn('flex flex-col justify-between rounded-md px-1.5 py-1 text-left transition-transform hover:scale-105 hover:shadow-card', long ? 'h-7' : 'h-11', working ? tone(p) : 'bg-muted/50 text-muted-foreground/70')}
            >
              <span className="text-[10.5px] font-bold">{Number(d.slice(8))}</span>
              {!long && working && <span className="self-end text-[10px] font-extrabold">{p}%</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-success" /> 95%+</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-success/60" /> 85–94%</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-warning/40" /> 70–84%</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-destructive/40" /> below 70%</span>
        <span className="ml-auto">Click a day to see who was in, on leave or missing</span>
      </div>
    </div>
  );
}

function DayDrawer({ date, filters, onClose }: { date: string | null; filters: ReportFilters; onClose: () => void }) {
  const q = useAttendanceDay(date ? { date, ...filters } : null);
  const d = q.data;
  const groups: Array<[keyof Pick<AttendanceDay, 'present' | 'late' | 'wfh' | 'leave' | 'absent' | 'notRecorded'>, string, 'success' | 'warning' | 'info' | 'primary' | 'danger' | 'neutral']> = [
    ['late', 'Late', 'warning'],
    ['present', 'On time', 'success'],
    ['wfh', 'Working from home', 'info'],
    ['leave', 'On leave', 'primary'],
    ['absent', 'Absent', 'danger'],
    ['notRecorded', 'No check-in recorded', 'neutral'],
  ];
  const time = (p: DayPerson) => (p.checkIn ? new Date(p.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
  return (
    <Drawer
      open={Boolean(date)}
      onClose={onClose}
      icon={<CalendarCheck />}
      title={date ? formatDate(date) : ''}
      description={d ? (d.holiday ? `Holiday: ${d.holiday}` : d.workingDay ? `${d.headcount} people on the payroll` : 'Weekend') : undefined}
    >
      {!d ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="space-y-4">
          {groups.map(([key, title, tone]) => {
            const list = d[key];
            if (!list.length) return null;
            return (
              <section key={key}>
                <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><Badge tone={tone}>{list.length}</Badge>{title}</h3>
                <ul className="divide-y divide-border">
                  {list.map((p) => (
                    <li key={p.id}>
                      <Link href={`/app/employees/${p.id}`} className="flex items-center gap-3 py-2 text-sm hover:bg-subtle">
                        <PersonAvatar person={p} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.firstName} {p.lastName}</span>
                          <span className="block truncate text-xs text-muted-foreground">{p.department ?? p.employeeId}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{key === 'late' ? `${time(p)} · ${lateBy(p.lateMinutes)} late` : time(p)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {groups.every(([key]) => !d[key].length) && <p className="py-6 text-center text-sm text-muted-foreground">Nobody to show for this day.</p>}
        </div>
      )}
    </Drawer>
  );
}

function LateByWeekday({ r }: { r: AttendanceReport }) {
  const max = Math.max(1, ...r.lateByWeekday, ...r.lateByWeekdayPrevious);
  const worst = r.lateByWeekday.indexOf(Math.max(...r.lateByWeekday));
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-muted-foreground" />Late arrivals by weekday<span className="ml-auto text-xs font-normal text-muted-foreground">this period vs the one before</span></h3>
      <div className="flex h-32 items-end gap-3 px-1">
        {r.lateByWeekday.map((n, i) => (
          <div key={WEEK[i]} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 items-end gap-1">
              <i className="block w-3 rounded bg-muted-foreground/30 transition-[height] duration-700" style={{ height: `${(r.lateByWeekdayPrevious[i]! / max) * 100}%` }} title={`Before: ${r.lateByWeekdayPrevious[i]}`} />
              <i className={cn('block w-3 rounded transition-[height] duration-700', n && i === worst ? 'bg-destructive' : 'bg-warning')} style={{ height: `${(n / max) * 100}%` }} title={`Now: ${n}`} />
            </div>
            <span className="text-xs text-muted-foreground">{WEEK[i]}</span>
            <b className="text-xs tabular-nums">{n}</b>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Grey: {shortDate(r.previous.from)} – {shortDate(r.previous.to)}</p>
    </Card>
  );
}

function BalancesCard({ r }: { r: AttendanceReport }) {
  const b = r.leaveBalances;
  const tones = ['bg-primary', 'bg-info', 'bg-success', 'bg-warning'];
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Plane className="h-4 w-4 text-muted-foreground" />Leave left in {b.year}<span className="ml-auto text-xs font-normal text-muted-foreground">days people still have</span></h3>
      {b.byType.length ? (
        <ul className="space-y-2.5">
          {b.byType.map((t, i) => (
            <li key={t.type.id} className="text-xs">
              <div className="flex items-center gap-2"><b className="flex-1 text-sm">{t.type.name}</b><span className="text-muted-foreground">{t.leftDays} of {t.entitledDays} days left</span></div>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted"><i className={cn('m-fill-w block h-full rounded-full', tones[i % tones.length])} style={{ width: `${t.entitledDays ? (t.leftDays / t.entitledDays) * 100 : 0}%` }} /></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No leave balances for this year yet.</p>
      )}
      {b.plentyLeft.length > 0 && (
        <details className="rounded-lg border border-warning/30 bg-warning-soft/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold text-warning">{b.plentyLeft.length} {b.plentyLeft.length === 1 ? 'person has' : 'people have'} 15+ days of one type left</summary>
          <ul className="mt-2 space-y-1.5">
            {b.plentyLeft.map((p) => p.employee && (
              <li key={p.employee.id} className="flex items-center gap-2">
                <PersonAvatar person={p.employee} size="xs" />
                <span className="flex-1 truncate">{p.employee.firstName} {p.employee.lastName}</span>
                <span className="text-muted-foreground">{p.days} days · {p.type}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function Ranked({ title, empty, rows }: { title: string; empty: string; rows: Array<{ employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null; value: string }> }) {
  return (
    <Card className="overflow-hidden">
      <h3 className="border-b border-border px-5 py-3 text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.filter((x) => x.employee).map((x) => (
            <li key={x.employee!.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <PersonAvatar person={x.employee!} size="xs" />
              <span className="flex-1 truncate">{x.employee!.firstName} {x.employee!.lastName}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{x.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </Card>
  );
}

export function AttendanceTab({ params }: { params: ReportParams }) {
  const filters = { departmentId: params.departmentId, locationId: params.locationId };
  const q = useAttendanceReport({ from: params.from, to: params.to, ...filters });
  const [day, setDay] = useState<string | null>(null);
  if (q.isError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load the report')} onRetry={() => void q.refetch()} />;
  const r = q.data;
  if (!r) return <Skeleton className="h-96" />;
  return (
    <div className={cn('space-y-4 transition-opacity', q.isFetching && 'opacity-70')}>
      <div className="m-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<CalendarCheck />} label="Attendance rate" value={r.attendanceRatePct === null ? '—' : `${r.attendanceRatePct}%`} sub={`${r.headcount} people × ${r.workingDays} working day${r.workingDays === 1 ? '' : 's'}`} />
        <Kpi icon={<Clock />} label="Average day" value={r.avgWorkingMinutes ? fmtHours(r.avgWorkingMinutes) : '—'} sub="On days with check-in and out" />
        <Kpi icon={<AlarmClock />} label="Late arrivals" value={r.lateArrivals} sub={r.lateArrivals ? `Average ${lateBy(r.avgLateMinutes)} late` : undefined} />
        <Kpi icon={<Home />} label="Work from home" value={r.wfhDays} sub="Days" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-muted-foreground" />Attendance by day<span className="ml-auto text-xs font-normal text-muted-foreground">{shortDate(r.from)} – {shortDate(r.to)}</span></h3>
          <AttendanceCalendar r={r} onDay={setDay} />
        </Card>
        <div className="space-y-4">
          <LateByWeekday r={r} />
          <BalancesCard r={r} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Breakdown title="Leave taken by type (days)" rows={r.leaveByType.map((x) => ({ label: x.type.name, count: x.days }))} />
        <Ranked title="Most leave" empty="No approved leave" rows={r.topLeave.map((x) => ({ employee: x.employee, value: `${x.days} day${x.days === 1 ? '' : 's'}` }))} />
        <Ranked title="Most often late" empty="Nobody was late" rows={r.topLate.map((x) => ({ employee: x.employee, value: `${x.count}× · ${x.minutes} min` }))} />
      </div>
      <DayDrawer date={day} filters={filters} onClose={() => setDay(null)} />
    </div>
  );
}
