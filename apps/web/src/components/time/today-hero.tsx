'use client';

import React, { useEffect, useState } from 'react';
import { Coffee, LogIn, LogOut, Moon, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { STATUS_META, clock, hours, useToday, lateBy } from '@/lib/company/attendance';
import { isWorking, liveWorked, sessionsOf, useCheckActions } from '@/components/attendance/sessions';
import { DayLine, Ring, minuteOf, toMinutes } from '@/components/time/visuals';

/**
 * Today on My attendance: a ring filling towards a full day, the live clock,
 * one-tap check in / out, and the day on a time line (sessions, breaks, shift, now).
 */
export function TodayHero() {
  const today = useToday();
  const [now, setNow] = useState(() => new Date());
  const actions = useCheckActions(today.data);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (today.isLoading) return <Skeleton className="h-56 w-full rounded-2xl" />;
  const t = today.data;
  if (!t?.hasProfile) return null;

  const tz = t.policy.timeZone;
  const r = t.record;
  const working = isWorking(t);
  const done = Boolean(r?.checkIn && !working);
  const worked = liveWorked(t, now);
  const sessions = sessionsOf(t);
  const nowMin = minuteOf(now, tz);
  const shift = t.shift ?? { name: 'General', start: t.policy.shiftStart, end: t.policy.shiftEnd, overnight: false };
  const shiftStart = toMinutes(shift.start);
  const shiftEnd = toMinutes(shift.end) + (shift.overnight ? 1440 : 0);
  const time = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(now);
  const seconds = new Intl.DateTimeFormat('en-GB', { timeZone: tz, second: '2-digit' }).format(now).padStart(2, '0');
  const status = t.status ? STATUS_META[t.status] : null;
  const breakMin = r?.breakMinutes ?? 0;
  const expectedOut = r?.checkIn ? new Date(new Date(r.checkIn).getTime() + (t.policy.fullDayMinutes + breakMin) * 60_000) : null;

  // Work blocks: each session (a running one goes to "now"); gaps between sessions are breaks
  const blocks = sessions.flatMap((s, i) => {
    const from = minuteOf(s.in, tz);
    const to = s.out ? minuteOf(s.out, tz) : nowMin;
    const work = { from, to: to < from ? to + 1440 : to, className: 'bg-indigo-300', title: `${clock(s.in, tz)} – ${s.out ? clock(s.out, tz) : 'now'}` };
    const next = sessions[i + 1];
    const gap = s.out && next ? [{ from: minuteOf(s.out, tz), to: minuteOf(next.in, tz), className: 'bg-amber-300/90', title: 'Break' }] : [];
    return [work, ...gap];
  });

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-700 p-5 text-white shadow-card sm:p-6">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-400/25 blur-2xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <Ring value={worked} max={t.policy.fullDayMinutes} size={124} stroke={11} trackClass="stroke-white/15" barClass="stroke-amber-200" label={`Worked ${hours(worked)} of ${hours(t.policy.fullDayMinutes)}`}>
          <span className="text-xl font-bold tabular-nums">{worked ? hours(worked).replace(' ', '') : '0h'}</span>
          <span className="text-[10px] font-semibold text-white/60">of {Math.round(t.policy.fullDayMinutes / 60)}h</span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-200">
            {working && <span className="tm-live inline-block h-2 w-2 rounded-full bg-emerald-400" />}
            {working ? `Checked in at ${clock(r?.checkIn ?? t.carriedOver?.openSince ?? null, tz)}` : done ? `Checked out at ${clock(r?.checkOut, tz)}` : 'Not checked in yet'}
            <span className="text-indigo-300/70">·</span>
            <span>{shift.overnight && <Moon className="mr-1 inline h-3 w-3" />}{shift.name} shift {shift.start}–{shift.end}</span>
          </p>
          <p className="text-4xl font-bold tabular-nums tracking-tight">
            {time}
            <span className="ml-1 text-lg font-semibold text-white/50">:{seconds}</span>
          </p>
          <p className="text-xs text-indigo-200">
            {t.holiday ? (
              <span className="inline-flex items-center gap-1"><PartyPopper className="h-3.5 w-3.5" /> {t.holiday.name} — enjoy the day off</span>
            ) : t.leave?.status === 'APPROVED' ? (
              `${t.leave.name}${t.leave.halfDay ? ' (half day)' : ''}`
            ) : (
              <>
                {(r?.lateMinutes ?? 0) > 0 ? `Late by ${lateBy(r!.lateMinutes)}` : r?.checkIn ? 'On time ✓' : status?.label}
                {breakMin > 0 && ` · break ${breakMin} min`}
                {(r?.sessions ?? 0) > 1 && ` · ${r!.sessions} sessions`}
                {working && expectedOut && ` · full day at ~${clock(expectedOut.toISOString(), tz)}`}
                {done && ` · ${hours(r?.workingMinutes)} worked`}
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {!t.policy.webCheckInEnabled ? (
              <p className="text-sm text-indigo-200">Web check-in is turned off.</p>
            ) : working ? (
              <>
                <Button size="sm" variant="secondary" className="border-white/25 bg-white/10 text-white hover:bg-white/20" onClick={() => void actions.doOut('Break')} loading={actions.outPending} title="Checks you out; check in again when you are back — the time away counts as a break">
                  <Coffee /> Take a break
                </Button>
                <Button size="sm" className="bg-white text-indigo-900 hover:bg-white/90" onClick={actions.requestOut} loading={actions.outPending}>
                  <LogOut /> Check out
                </Button>
              </>
            ) : (
              <Button size="sm" className="bg-white text-indigo-900 hover:bg-white/90" onClick={() => void actions.doIn()} loading={actions.inPending}>
                <LogIn /> {done ? 'Check in again' : 'Check in'}
              </Button>
            )}
            {actions.dialog}
          </div>
        </div>
      </div>
      <DayLine
        className="relative mt-5"
        dark
        height="h-5"
        blocks={blocks}
        shift={{ start: shiftStart, end: shiftEnd }}
        now={nowMin + (shift.overnight && nowMin < shiftStart && working ? 1440 : 0)}
      />
      <p className="relative mt-2 text-[11px] text-indigo-200/80">Your day: work (blue), breaks (amber), your shift (dashed) and now (red).</p>
    </section>
  );
}
