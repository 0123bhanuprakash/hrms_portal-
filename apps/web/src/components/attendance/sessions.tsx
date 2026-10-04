'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Textarea } from '@/components/ui/field';
import { clock, hours, useCheckIn, useCheckOut, type TodayAttendance } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

// ============================================================
// Check in and out many times a day. The day runs 12 AM – 12 AM in
// the company's time zone; time worked = all sessions added up.
// ============================================================

/** Minutes worked today, including a session that is still running. */
export function liveWorked(t: TodayAttendance, now: Date): number {
  const r = t.record;
  const open = r?.openSince ?? (t.carriedOver?.openSince ?? null);
  const closed = r?.workingMinutes ?? 0;
  return closed + (open ? Math.max(0, Math.floor((now.getTime() - new Date(open).getTime()) / 60_000)) : 0);
}

/** Working right now (today's session, or last night's shift still running). */
export const isWorking = (t: TodayAttendance) => Boolean(t.record?.openSince || t.carriedOver);

/** Sessions from the day's taps: [in, out | null]. */
export function sessionsOf(t: TodayAttendance): Array<{ in: string; out: string | null; early: boolean; note: string | null }> {
  const out: Array<{ in: string; out: string | null; early: boolean; note: string | null }> = [];
  for (const p of t.punches ?? []) {
    if (p.kind === 'IN') out.push({ in: p.at, out: null, early: false, note: null });
    else if (out.length && !out[out.length - 1]!.out) Object.assign(out[out.length - 1]!, { out: p.at, early: p.early, note: p.note });
  }
  return out;
}

/** Minutes since midnight in the company's time zone. */
function minuteOfDay(iso: string | Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Today from 12 AM to 12 AM: the shift window and each session. */
export function DayTimeline({ t, now }: { t: TodayAttendance; now: Date }) {
  const tz = t.policy.timeZone;
  const pct = (m: number) => `${(Math.max(0, Math.min(1440, m)) / 1440) * 100}%`;
  const sessions = sessionsOf(t);
  const nowMin = minuteOfDay(now, tz);
  const s = toMin(t.policy.shiftStart);
  const e = toMin(t.policy.shiftEnd);
  return (
    <div>
      <div className="relative h-6 rounded-md bg-muted" role="img" aria-label={`Today: ${sessions.length} session${sessions.length === 1 ? '' : 's'}`}>
        <span className="absolute -bottom-1 -top-1 rounded-md border-[1.5px] border-dashed border-border" style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})` }} aria-hidden />
        {sessions.map((x, i) => {
          const a = minuteOfDay(x.in, tz);
          const b = x.out ? minuteOfDay(x.out, tz) : nowMin;
          return (
            <span
              key={i}
              title={`${clock(x.in, tz)} – ${x.out ? clock(x.out, tz) : 'now'}`}
              className={cn('m-fill-w absolute bottom-1 top-1 rounded-sm', x.out ? 'bg-success' : 'bg-success/80 animate-pulse')}
              style={{ left: pct(a), width: `max(3px, calc(${pct(b)} - ${pct(a)}))`, animationDelay: `${i * 120}ms` }}
            />
          );
        })}
        <span className="absolute -bottom-1.5 -top-1.5 w-0.5 rounded-full bg-primary" style={{ left: pct(nowMin) }} aria-hidden />
      </div>
      <div className="mt-1 flex justify-between text-2xs text-muted-foreground tabular-nums">
        <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
      </div>
    </div>
  );
}

/** "1 · 09:12 – 12:58 · 3h 46m" for each session. */
export function SessionList({ t, now }: { t: TodayAttendance; now: Date }) {
  const tz = t.policy.timeZone;
  const sessions = sessionsOf(t);
  if (sessions.length < 2) return null;
  return (
    <ul className="space-y-1 text-xs">
      {sessions.map((x, i) => {
        const end = x.out ? new Date(x.out) : now;
        const mins = Math.max(0, Math.round((end.getTime() - new Date(x.in).getTime()) / 60_000));
        return (
          <li key={i} className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1 tabular-nums">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-soft text-[10px] font-bold text-success">{i + 1}</span>
            <span className="flex-1">{clock(x.in, tz)} – {x.out ? clock(x.out, tz) : 'now'}</span>
            {x.early && <span className="text-warning" title={x.note ?? undefined}>early</span>}
            <b>{hours(mins) === '—' ? '0m' : hours(mins)}</b>
          </li>
        );
      })}
    </ul>
  );
}

const REASONS = ['Doctor’s appointment', 'Personal work', 'Working remotely later', 'Feeling unwell'];

/**
 * Check in / check out with the early check-out question. `onDone` fires after
 * a successful tap (for the celebration burst).
 */
export function useCheckActions(t: TodayAttendance | undefined, onDone?: () => void) {
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const [asking, setAsking] = useState<{ worked: number } | null>(null);
  const [note, setNote] = useState('');
  const tz = t?.policy.timeZone ?? 'UTC';

  const doIn = async () => {
    try {
      const rec = await checkIn.mutateAsync();
      onDone?.();
      toast.success(rec.sessions > 1 ? `Checked in again at ${clock(rec.openSince ?? rec.checkIn, tz)}` : `Checked in at ${clock(rec.checkIn, tz)}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not check in'));
    }
  };
  const doOut = async (reason?: string) => {
    try {
      const rec = await checkOut.mutateAsync(reason ? { note: reason } : {});
      setAsking(null);
      setNote('');
      onDone?.();
      toast.success(`Checked out — ${hours(rec.workingMinutes)} today${rec.sessions > 1 ? ` over ${rec.sessions} sessions` : ''}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not check out'));
    }
  };
  /** Before a full day, ask (optionally) why; otherwise check out straight away. */
  const requestOut = () => {
    if (!t) return;
    const worked = liveWorked(t, new Date());
    if (worked < t.policy.fullDayMinutes) setAsking({ worked });
    else void doOut();
  };

  const short = asking && t ? t.policy.fullDayMinutes - asking.worked : 0;
  const dialog = (
    <Modal
      open={Boolean(asking)}
      onClose={() => setAsking(null)}
      busy={checkOut.isPending}
      icon={<Clock />}
      title="Checking out early?"
      description={asking ? `You’ve worked ${hours(asking.worked) === '—' ? '0m' : hours(asking.worked)} today — ${hours(short)} short of your ${hours(t?.policy.fullDayMinutes)} day. Add a reason for your manager, or just check out. You can check in again later.` : undefined}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={() => void doOut()} loading={checkOut.isPending && !note.trim()} disabled={checkOut.isPending}>Just check out</Button>
          <Button onClick={() => void doOut(note.trim())} disabled={!note.trim() || checkOut.isPending} loading={checkOut.isPending && Boolean(note.trim())}>Add note &amp; check out</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setNote(r)} className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', note === r ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
              {r}
            </button>
          ))}
        </div>
        <Field label="Reason (optional)" htmlFor="early-note">
          <Textarea id="early-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
        </Field>
      </div>
    </Modal>
  );
  return { doIn, requestOut, dialog, inPending: checkIn.isPending, outPending: checkOut.isPending };
}
