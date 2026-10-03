'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarDays, Clock, LogIn, LogOut, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, Skeleton } from '@/components/ui/feedback';
import { STATUS_META, clock, hours, useCheckIn, useCheckOut, useToday } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';

/** Live clock + one-tap check in / out for today. */
export function CheckInCard({ showCalendarLink = true }: { showCalendarLink?: boolean }) {
  const today = useToday();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (today.isLoading) return <Skeleton className="h-40 w-full" />;
  const t = today.data;
  if (!t?.hasProfile) return null;

  const tz = t.policy.timeZone;
  const r = t.record;
  const working = Boolean(r?.checkIn && !r.checkOut);
  const done = Boolean(r?.checkIn && r.checkOut);
  const liveMinutes = working && r?.checkIn ? Math.max(0, Math.floor((now.getTime() - new Date(r.checkIn).getTime()) / 60_000)) : (r?.workingMinutes ?? 0);
  const progress = Math.min(100, Math.round((liveMinutes / t.policy.fullDayMinutes) * 100));

  const act = async (kind: 'in' | 'out') => {
    try {
      const rec = await (kind === 'in' ? checkIn : checkOut).mutateAsync();
      toast.success(kind === 'in' ? `Checked in at ${clock(rec.checkIn, tz)}` : `Checked out — ${hours(rec.workingMinutes)} today`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, kind === 'in' ? 'Could not check in' : 'Could not check out'));
    }
  };

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
              status && <Badge tone={status.tone} dot>{status.label}</Badge>
            )}
            {r?.checkIn && <span>In {clock(r.checkIn, tz)}</span>}
            {r?.checkOut && <span>· Out {clock(r.checkOut, tz)}</span>}
            {(r?.lateMinutes ?? 0) > 0 && <Badge tone="warning">Late by {r!.lateMinutes} min</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {!t.policy.webCheckInEnabled ? (
            <p className="text-sm text-muted-foreground">Web check-in is turned off.</p>
          ) : done ? (
            <p className="text-sm font-medium">Done for today · {hours(r?.workingMinutes)}</p>
          ) : working ? (
            <Button size="lg" variant="secondary" onClick={() => act('out')} loading={checkOut.isPending}>
              <LogOut /> Check out
            </Button>
          ) : (
            <Button size="lg" onClick={() => act('in')} loading={checkIn.isPending}>
              <LogIn /> Check in
            </Button>
          )}
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
        </div>
      )}
    </Card>
  );
}
