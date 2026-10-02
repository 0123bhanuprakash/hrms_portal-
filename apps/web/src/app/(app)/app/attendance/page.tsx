'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, ClipboardEdit, Clock, Pencil, ShieldCheck, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { StatCard } from '@/components/ui/stat-card';
import { CheckInCard } from '@/components/attendance/check-in-card';
import { MonthCalendar } from '@/components/attendance/month-calendar';
import { CorrectionDialog } from '@/components/attendance/correction-dialog';
import { PersonAvatar } from '@/components/profile/person-avatar';
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
} from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';

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
  const cal = useCalendar(month, employeeId);

  if (!accessLoading && (!hasFeature('time.attendance') || !can('attendance.view'))) {
    return <EmptyState icon={<ShieldCheck />} title="Attendance isn’t available" description="Attendance isn’t enabled for you." />;
  }

  const data = cal.data;
  const tz = data?.policy.timeZone ?? 'Asia/Kolkata';
  const isMine = !employeeId;
  const name = data ? `${data.employee.firstName} ${data.employee.lastName}` : '';

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

      {isMine && can('attendance.mark') && <CheckInCard showCalendarLink={false} />}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div className="flex items-center gap-3">
            {!isMine && data && <PersonAvatar person={data.employee} size="sm" />}
            <h2 className="text-base font-semibold">
              {new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h2>
          </div>
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

        {cal.isLoading ? (
          <div className="px-5 pb-5"><Skeleton className="h-80 w-full" /></div>
        ) : cal.isError ? (
          <div className="px-5 pb-5"><ErrorState message={getApiErrorMessage(cal.error, 'Could not load attendance')} onRetry={() => cal.refetch()} /></div>
        ) : data ? (
          <div className="grid gap-5 px-5 pb-5 xl:grid-cols-[1fr_280px]">
            <MonthCalendar days={data.days} today={data.today} timeZone={tz} selected={selected?.date} onSelect={setSelected} />
            <DayPanel
              day={selected ? data.days.find((d) => d.date === selected.date) ?? selected : null}
              timeZone={tz}
              canRequest={isMine && can('attendance.mark')}
              canEdit={!isMine && can('attendance.edit')}
              onRequest={() => setDialog('request')}
              onEdit={() => setDialog('edit')}
              onClose={() => setSelected(null)}
            />
          </div>
        ) : null}
      </Card>

      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard title="Present" value={data.summary.present + data.summary.halfDay} description={data.summary.halfDay ? `${data.summary.halfDay} half day${data.summary.halfDay === 1 ? '' : 's'}` : undefined} icon={<CalendarCheck />} tone="success" />
          <StatCard title="Absent" value={data.summary.absent} description={data.summary.missingCheckout ? `+ ${data.summary.missingCheckout} missing check-out` : undefined} icon={<X />} tone="neutral" />
          <StatCard title="Late arrivals" value={data.summary.late} icon={<Clock />} tone="info" />
          <StatCard title="Avg. hours / day" value={hours(data.summary.averageMinutes)} icon={<Clock />} tone="primary" />
        </div>
      )}

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

function DayPanel({
  day,
  timeZone,
  canRequest,
  canEdit,
  onRequest,
  onEdit,
  onClose,
}: {
  day: CalendarDay | null;
  timeZone: string;
  canRequest: boolean;
  canEdit: boolean;
  onRequest: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  if (!day) {
    return (
      <div className="hidden rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground xl:block">
        Pick a day to see its details{canRequest ? ' or request a correction' : ''}.
      </div>
    );
  }
  const meta = STATUS_META[day.status];
  const pending = day.correction?.status === 'PENDING';
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{dayLabel(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <Badge tone={meta.tone} dot className="mt-1.5">{day.holiday?.name ?? meta.label}</Badge>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}><X /></Button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Check in</dt><dd className="tabular-nums">{clock(day.checkIn, timeZone)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Check out</dt><dd className="tabular-nums">{clock(day.checkOut, timeZone)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Worked</dt><dd>{hours(day.workingMinutes)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Late</dt><dd>{day.lateMinutes ? `${day.lateMinutes} min` : '—'}</dd></div>
      </dl>
      {day.isManualEntry && <p className="mt-3 text-xs text-muted-foreground">Corrected entry{day.notes ? ` — ${day.notes}` : ''}</p>}
      {pending && <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">A correction for this day is waiting for approval.</p>}
      <div className="mt-4 flex flex-col gap-2">
        {canRequest && !pending && day.status !== 'NOT_JOINED' && (
          <Button size="sm" variant="secondary" onClick={onRequest}><ClipboardEdit /> Request correction</Button>
        )}
        {canEdit && <Button size="sm" variant="secondary" onClick={onEdit}><Pencil /> Edit day</Button>}
      </div>
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
