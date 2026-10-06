'use client';

import { NoProfile } from '@/components/profile/no-profile';
import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ClipboardEdit, List, Pencil, ShieldCheck, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { MonthCalendar } from '@/components/attendance/month-calendar';
import { CorrectionDialog } from '@/components/attendance/correction-dialog';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { TodayHero } from '@/components/time/today-hero';
import { DayLine, STATUS_BG, minuteOf, toMinutes } from '@/components/time/visuals';
import { useAccess } from '@/lib/access/use-access';
import {
  CORRECTION_TONE,
  STATUS_META,
  clock,
  dayLabel,
  hours,
  useCalendar,
  useCancelCorrection,
  useCorrections,
  type CalendarDay,
  type CalendarMonth,
  type DayStatus,
  lateBy,
} from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

export default function AttendancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Attendance />
    </Suspense>
  );
}

function Attendance() {
  const params = useSearchParams();
  const employeeId = params.get('employee') ?? undefined; // someone else's calendar (managers / HR)
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const [dialog, setDialog] = useState<'request' | 'edit' | null>(null);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const cal = useCalendar(month, employeeId);

  if (!accessLoading && (!hasFeature('time.attendance') || !can('attendance.view'))) {
    return <EmptyState icon={<ShieldCheck />} title="Attendance isn’t available" description="Attendance isn’t enabled for you." />;
  }

  // Accounts without an employee profile (e.g. a company admin) have no attendance of their own
  if (!employeeId && cal.isError && /no employee profile/i.test(getApiErrorMessage(cal.error, ''))) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Time" title="My attendance" description="Check in, see your month and fix missed punches." />
        <NoProfile what="Attendance is kept for employees." />
      </div>
    );
  }

  const data = cal.data;
  const tz = data?.policy.timeZone ?? 'Asia/Kolkata';
  const isMine = !employeeId;
  const name = data ? `${data.employee.firstName} ${data.employee.lastName}` : '';
  const missed = isMine ? data?.days.filter((d) => (d.status === 'MISSING_CHECKOUT' || d.autoClosed) && d.correction?.status !== 'PENDING' && d.correction?.status !== 'APPROVED') ?? [] : [];
  const fix = (d: CalendarDay) => {
    setSelected(d);
    setDialog('request');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title={isMine ? 'My attendance' : `${name || 'Employee'} · attendance`}
        description={isMine ? 'Check in, see your month and fix missed punches.' : 'Monthly attendance for this person.'}
        action={
          !isMine && (
            <Button variant="secondary" asChild>
              <Link href="/app/attendance/team"><ArrowLeft /> Team</Link>
            </Button>
          )
        }
      />

      {isMine && can('attendance.mark') ? (
        <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
          <TodayHero />
          {data ? <MonthInsights data={data} /> : !cal.isError && <Skeleton className="h-56 w-full rounded-2xl" />}
        </div>
      ) : (
        data && <MonthInsights data={data} person />
      )}

      {missed[0] && (
        <div className="m-rise flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-violet-600" />
          <p className="min-w-0 flex-1">
            <b>{missed[0].autoClosed ? `We closed ${dayLabel(missed[0].date)} for you at ${clock(missed[0].checkOut, tz)}.` : `You didn’t check out on ${dayLabel(missed[0].date)}.`}</b>{' '}
            Tell us when you left and your approver will fix it.{missed.length > 1 && ` (${missed.length - 1} more day${missed.length === 2 ? '' : 's'} this month)`}
          </p>
          <Button size="sm" onClick={() => fix(missed[0]!)}><ClipboardEdit /> Fix it</Button>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div className="flex items-center gap-3">
            {!isMine && data && <PersonAvatar person={data.employee} size="sm" />}
            <h2 className="text-base font-semibold">
              {new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h2>
            <div className="flex items-center gap-1">
              <Button size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => { setMonth((m) => shiftMonth(m, -1)); setSelected(null); }}>
                <ChevronLeft />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setMonth(thisMonth()); setSelected(null); }} disabled={month === thisMonth()}>
                This month
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Next month" onClick={() => { setMonth((m) => shiftMonth(m, 1)); setSelected(null); }} disabled={month >= thisMonth()}>
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="View">
            {([['calendar', 'Calendar', CalendarDays], ['list', 'List', List]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="radio" aria-checked={view === id} onClick={() => setView(id)} className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium', view === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {cal.isLoading ? (
          <div className="px-5 pb-5"><Skeleton className="h-80 w-full" /></div>
        ) : cal.isError ? (
          <div className="px-5 pb-5"><ErrorState message={getApiErrorMessage(cal.error, 'Could not load attendance')} onRetry={() => cal.refetch()} /></div>
        ) : data ? (
          <div className="grid gap-5 px-5 pb-5 xl:grid-cols-[1fr_300px]">
            {view === 'calendar' ? (
              <MonthCalendar days={data.days} today={data.today} timeZone={tz} selected={selected?.date} onSelect={setSelected} fullDayMinutes={data.policy.fullDayMinutes} />
            ) : (
              <DayList data={data} onSelect={setSelected} selected={selected?.date} />
            )}
            <DayPanel
              data={data}
              day={selected ? data.days.find((d) => d.date === selected.date) ?? selected : null}
              canRequest={isMine && can('attendance.mark')}
              canEdit={!isMine && can('attendance.edit')}
              onRequest={() => setDialog('request')}
              onEdit={() => setDialog('edit')}
              onClose={() => setSelected(null)}
            />
          </div>
        ) : null}
      </Card>

      {isMine && <MyCorrections timeZone={tz} />}

      {dialog && selected && (
        <CorrectionDialog
          day={data?.days.find((d) => d.date === selected.date) ?? selected}
          timeZone={tz}
          mode={dialog}
          employeeId={data?.employee.id}
          employeeName={name}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

const BAR_LEGEND: DayStatus[] = ['PRESENT', 'HALF_DAY', 'MISSING_CHECKOUT', 'WORK_FROM_HOME', 'ON_LEAVE', 'ABSENT'];

/** On-time days, average check-in, average hours, and hours per day as bars. */
function MonthInsights({ data, person }: { data: CalendarMonth; person?: boolean }) {
  const tz = data.policy.timeZone;
  const stats = useMemo(() => {
    const worked = data.days.filter((d) => d.checkIn);
    const onTime = worked.filter((d) => !(d.lateMinutes ?? 0)).length;
    const ins = worked.map((d) => minuteOf(d.checkIn!, tz));
    const avgIn = ins.length ? Math.round(ins.reduce((a, b) => a + b, 0) / ins.length) : null;
    return { worked: worked.length, onTime, avgIn };
  }, [data, tz]);
  const shiftStart = toMinutes((data.shift?.start ?? data.policy.shiftStart));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const tiles = [
    { label: 'On time', value: stats.worked ? `${stats.onTime}/${stats.worked}` : '—', sub: 'days', tone: 'text-success' },
    { label: 'Avg check-in', value: stats.avgIn === null ? '—' : fmt(stats.avgIn), sub: stats.avgIn === null ? '' : stats.avgIn <= shiftStart ? `${shiftStart - stats.avgIn} min before shift` : `${stats.avgIn - shiftStart} min after shift`, tone: 'text-primary' },
    { label: 'Avg hours', value: data.summary.averageMinutes ? hours(data.summary.averageMinutes) : '—', sub: 'per worked day', tone: 'text-teal-600 dark:text-teal-400' },
  ];
  const max = Math.max(data.policy.fullDayMinutes * 1.2, ...data.days.map((d) => d.workingMinutes ?? 0));
  return (
    <Card className={cn('p-5', person && 'xl:col-span-2')}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{person ? 'This month' : 'This month so far'}</h2>
        <span className="text-xs text-muted-foreground">{data.summary.present + data.summary.halfDay} present · {data.summary.absent} absent · {data.summary.late} late</span>
      </div>
      <div className="m-stagger mt-3 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-subtle/70 p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
            <p className={cn('text-xl font-bold tabular-nums', t.tone)}>{t.value}</p>
            <p className="truncate text-[11px] text-muted-foreground">{t.sub}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Hours per day</p>
      <div className="mt-1.5 flex h-20 items-end gap-[3px]" role="img" aria-label="Hours worked per day this month">
        {data.days.map((d, i) => (
          <span
            key={d.date}
            title={`${dayLabel(d.date)} · ${d.workingMinutes ? hours(d.workingMinutes) : STATUS_META[d.status].label}`}
            className={cn('m-grow-y flex-1 rounded-t-[3px]', d.workingMinutes ? STATUS_BG[d.status] : d.status === 'ON_LEAVE' || d.status === 'ABSENT' ? cn(STATUS_BG[d.status], 'opacity-40') : 'bg-muted')}
            style={{ height: `${Math.max(6, ((d.workingMinutes ?? (d.status === 'ON_LEAVE' || d.status === 'ABSENT' ? data.policy.fullDayMinutes * 0.25 : 0)) / max) * 100)}%`, animationDelay: `${i * 18}ms` }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {BAR_LEGEND.map((s) => (
          <span key={s} className="inline-flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', STATUS_BG[s])} />{STATUS_META[s].label}</span>
        ))}
      </div>
    </Card>
  );
}

function DayList({ data, onSelect, selected }: { data: CalendarMonth; onSelect: (d: CalendarDay) => void; selected?: string }) {
  const tz = data.policy.timeZone;
  const rows = data.days.filter((d) => d.date <= data.today && d.status !== 'NOT_JOINED').reverse();
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-subtle/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">Day</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">In</th>
            <th className="px-3 py-2 font-semibold">Out</th>
            <th className="px-3 py-2 font-semibold">Worked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((d) => (
            <tr key={d.date} onClick={() => onSelect(d)} className={cn('cursor-pointer hover:bg-muted/40', selected === d.date && 'bg-primary-soft/40')}>
              <td className="px-3 py-2 font-medium">{dayLabel(d.date)}</td>
              <td className="px-3 py-2">
                <Badge tone={STATUS_META[d.status].tone} dot>{d.holiday?.name ?? STATUS_META[d.status].label}</Badge>
                {(d.lateMinutes ?? 0) > 0 && <Badge tone="warning" className="ml-1">Late {lateBy(d.lateMinutes)}</Badge>}
              </td>
              <td className="px-3 py-2 tabular-nums">{clock(d.checkIn, tz)}</td>
              <td className="px-3 py-2 tabular-nums">{clock(d.checkOut, tz)}{d.autoClosed && <span className="ml-1 text-[10px] font-bold uppercase text-violet-600">auto</span>}</td>
              <td className="px-3 py-2">{hours(d.workingMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayPanel({
  data,
  day,
  canRequest,
  canEdit,
  onRequest,
  onEdit,
  onClose,
}: {
  data: CalendarMonth;
  day: CalendarDay | null;
  canRequest: boolean;
  canEdit: boolean;
  onRequest: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const timeZone = data.policy.timeZone;
  if (!day) {
    return (
      <div className="hidden rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground xl:block">
        Pick a day to see its details{canRequest ? ' or request a correction' : ''}.
      </div>
    );
  }
  const meta = STATUS_META[day.status];
  const pending = day.correction?.status === 'PENDING';
  const shift = data.shift ?? { start: data.policy.shiftStart, end: data.policy.shiftEnd, overnight: false };
  const inMin = day.checkIn ? minuteOf(day.checkIn, timeZone) : null;
  let outMin = day.checkOut ? minuteOf(day.checkOut, timeZone) : null;
  if (inMin !== null && outMin !== null && outMin < inMin) outMin += 1440;
  return (
    <div className="m-rise rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{dayLabel(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <Badge tone={meta.tone} dot className="mt-1.5">{day.holiday?.name ?? meta.label}</Badge>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}><X /></Button>
      </div>
      {inMin !== null && (
        <DayLine
          className="mt-4"
          shift={{ start: toMinutes(shift.start), end: toMinutes(shift.end) + (shift.overnight ? 1440 : 0) }}
          blocks={[
            { from: inMin, to: outMin ?? Math.min(inMin + 240, 1439), className: outMin === null ? 'bg-violet-400/40' : STATUS_BG[day.status], title: `${clock(day.checkIn, timeZone)} – ${clock(day.checkOut, timeZone)}` },
          ]}
        />
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Check in</dt><dd className="tabular-nums">{clock(day.checkIn, timeZone)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Check out</dt><dd className="tabular-nums">{clock(day.checkOut, timeZone)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Worked</dt><dd>{hours(day.workingMinutes)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Late</dt><dd>{day.lateMinutes ? lateBy(day.lateMinutes) : '—'}</dd></div>
      </dl>
      {day.autoClosed && <p className="mt-3 rounded-md bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">Closed automatically — you forgot to check out. Request a correction if you left at another time.</p>}
      {day.isManualEntry && <p className="mt-3 text-xs text-muted-foreground">Corrected entry{day.notes ? ` — ${day.notes}` : ''}</p>}
      {pending && <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">A correction for this day is waiting for approval.</p>}
      <div className="mt-4 flex flex-col gap-2">
        {canRequest && !pending && day.status !== 'NOT_JOINED' && (
          <Button size="sm" variant="secondary" onClick={onRequest}><ClipboardEdit /> Request correction</Button>
        )}
        {canEdit && <Button size="sm" variant="secondary" onClick={onEdit}><Pencil /> Edit day</Button>}
      </div>
      {canRequest && <p className="mt-3 text-[11px] text-muted-foreground">There is no limit on corrections — your lead sees a note if there are many in a month.</p>}
    </div>
  );
}

function MyCorrections({ timeZone }: { timeZone: string }) {
  const list = useCorrections({ view: 'mine' });
  const cancel = useCancelCorrection();
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader icon={<ClipboardEdit />} title="My correction requests" />
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold', c.status === 'APPROVED' ? 'border-success bg-success-soft text-success' : c.status === 'PENDING' ? 'border-info bg-info-soft text-info' : 'border-border text-muted-foreground')}>
              {c.status === 'APPROVED' ? '✓' : c.status === 'PENDING' ? '●' : '–'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {dayLabel(c.date)} · <span className="tabular-nums">{clock(c.checkIn, timeZone)}–{clock(c.checkOut, timeZone)}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {c.reason}
                {c.reviewedBy && ` · ${c.status === 'APPROVED' ? 'Approved' : 'Reviewed'} by ${c.reviewedBy.firstName} ${c.reviewedBy.lastName}`}
                {c.onBehalfOf && ` for ${c.onBehalfOf.firstName} ${c.onBehalfOf.lastName}`}
                {c.reviewNote && ` — “${c.reviewNote}”`}
              </p>
            </div>
            <Badge tone={CORRECTION_TONE[c.status]}>{c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Badge>
            {c.status === 'PENDING' && (
              <Button
                size="sm"
                variant="ghost"
                loading={cancel.isPending && cancel.variables === c.id}
                onClick={async () => {
                  try {
                    await cancel.mutateAsync(c.id);
                    toast.success('Request cancelled');
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, 'Could not cancel'));
                  }
                }}
              >
                Cancel
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
