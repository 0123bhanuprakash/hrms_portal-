'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Clock, LogIn, LogOut, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, Skeleton } from '@/components/ui/feedback';
import { STATUS_META, clock, hours, useToday } from '@/lib/company/attendance';
import { DayTimeline, SessionList, isWorking, liveWorked, useCheckActions } from '@/components/attendance/sessions';

/** Live clock + one-tap check in / out for today. */
export function CheckInCard({ showCalendarLink = true }: { showCalendarLink?: boolean }) {
  const today = useToday();
  const [now, setNow] = useState(() => new Date());
  const actions = useCheckActions(today.data);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (today.isLoading) return <Skeleton className="h-40 w-full" />;
  const t = today.data;
  if (!t?.hasProfile) return null;

  const tz = t.policy.timeZone;
  const r = t.record;
  const working = isWorking(t);
  const done = Boolean(r?.checkIn && !working);
  const liveMinutes = liveWorked(t, now);
  const progress = Math.min(100, Math.round((liveMinutes / t.policy.fullDayMinutes) * 100));

  const time = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  const status = t.status ? STATUS_META[t.status] : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Today · Shift {t.policy.shiftStart}–{t.policy.shiftEnd}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{time}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {t.holiday ? (
              <Badge tone="primary"><PartyPopper className="h-3 w-3" /> {t.holiday.name}</Badge>
            ) : t.leave?.status === 'APPROVED' ? (
              <Badge tone="info">{t.leave.name}{t.leave.halfDay ? ' (half day)' : ''}</Badge>
            ) : (
              done && (t.status === 'ABSENT' || t.status === 'HALF_DAY') ? <Badge tone="neutral" dot>Checked out</Badge> : status && <Badge tone={status.tone} dot>{status.label}</Badge>
            )}
            {r?.checkIn && <span>First in {clock(r.checkIn, tz)}</span>}
            {r?.checkOut && !working && <span>· Out {clock(r.checkOut, tz)}</span>}
            {(r?.sessions ?? 0) > 1 && <span>· {r!.sessions} sessions</span>}
            {(r?.lateMinutes ?? 0) > 0 && <Badge tone="warning">Late by {r!.lateMinutes} min</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {!t.policy.webCheckInEnabled ? (
            <p className="text-sm text-muted-foreground">Web check-in is turned off.</p>
          ) : working ? (
            <Button size="lg" variant="secondary" onClick={actions.requestOut} loading={actions.outPending}>
              <LogOut /> Check out
            </Button>
          ) : done ? (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium">Checked out · {hours(r?.workingMinutes)}</p>
              <Button variant="secondary" onClick={() => void actions.doIn()} loading={actions.inPending}><LogIn /> Check in again</Button>
            </div>
          ) : (
            <Button size="lg" onClick={() => void actions.doIn()} loading={actions.inPending}>
              <LogIn /> Check in
            </Button>
          )}
          {actions.dialog}
          {showCalendarLink && (
            <Link href="/app/attendance" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <CalendarDays className="h-3.5 w-3.5" /> My attendance
            </Link>
          )}
        </div>
      </div>
      {(working || done) && (
        <div className="border-t border-border px-5 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Worked {hours(liveMinutes) === '—' ? '0h 00m' : hours(liveMinutes)}</span>
            <span>Full day {hours(t.policy.fullDayMinutes)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 space-y-2">
            <DayTimeline t={t} now={now} />
            <SessionList t={t} now={now} />
          </div>
        </div>
      )}
    </Card>
  );
}
