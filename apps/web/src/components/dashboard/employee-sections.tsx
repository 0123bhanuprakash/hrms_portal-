'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, CalendarX2, LifeBuoy, LogIn, LogOut, Megaphone, PackageCheck, PartyPopper, Receipt, Timer, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { ActionRow, IconTile, Meter, MiniBars, Ring } from '@/components/dashboard/widgets';
import { Burst, Milestones } from '@/components/motion/motion';
import { useAccess } from '@/lib/access/use-access';
import { STATUS_META, clock, hours, useCalendar, useToday, lateBy } from '@/lib/company/attendance';
import { DayTimeline, SessionList, isWorking, liveWorked, useCheckActions } from '@/components/attendance/sessions';
import { useLeaveBalances } from '@/lib/company/leave';
import { useTimesheets } from '@/lib/company/timesheets';
import { useClaims } from '@/lib/company/expenses';
import { QUEUE_INFO, useTickets } from '@/lib/company/helpdesk';
import { useMyAssets } from '@/lib/company/assets';
import { HOME_ANNOUNCEMENTS, useAnnouncements } from '@/lib/company/engagement';
import type { MyCard } from '@/lib/company/profile';
import { formatDate } from '@/lib/format';

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const dayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });

/** Today: worked-time ring, check-in / check-out, late minutes. */
export function TodayCard() {
  const today = useToday();
  const [now, setNow] = useState(() => new Date());
  const [burst, setBurst] = useState(0);
  const actions = useCheckActions(today.data, () => setBurst((n) => n + 1));
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (today.isLoading) return <Skeleton className="h-56 w-full" />;
  const t = today.data;
  if (!t?.hasProfile) return null;
  const tz = t.policy.timeZone;
  const r = t.record;
  const working = isWorking(t);
  const done = Boolean(r?.checkIn && !working);
  const minutes = liveWorked(t, now);
  const status = t.status ? STATUS_META[t.status] : null;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Today"
        action={
          t.holiday ? (
            <Badge tone="primary"><PartyPopper className="h-3 w-3" /> {t.holiday.name}</Badge>
          ) : t.leave?.status === 'APPROVED' ? (
            <Badge tone="info">{t.leave.name}</Badge>
          ) : (
            // Checked out early today: the day isn't over, so no 'Absent' / 'Half day' yet
            done && (t.status === 'ABSENT' || t.status === 'HALF_DAY') ? <Badge tone="neutral" dot>Checked out</Badge> : status && <Badge tone={status.tone === 'outline' ? 'neutral' : status.tone} dot>{status.label}</Badge>
          )
        }
      />
      <div className="flex flex-1 items-center gap-5 px-5 pb-4">
        <Ring value={minutes} max={t.policy.fullDayMinutes} label={`${hours(minutes)} of ${hours(t.policy.fullDayMinutes)} worked`}>
          <span className="text-lg font-bold tabular-nums">{minutes ? hours(minutes) : '0h'}</span>
          <span className="text-2xs text-muted-foreground">of {hours(t.policy.fullDayMinutes)}</span>
        </Ring>
        <div className="min-w-0 space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">First in</span> <b className="tabular-nums">{r?.checkIn ? clock(r.checkIn, tz) : '—'}</b>
            <span className="text-muted-foreground"> · Out</span> <b className="tabular-nums">{r?.checkOut && !working ? clock(r.checkOut, tz) : '—'}</b>
          </p>
          {(r?.sessions ?? 0) > 1 && <p className="text-xs text-muted-foreground">{r!.sessions} sessions{r?.breakMinutes ? ` · break ${hours(r.breakMinutes)}` : ''}</p>}
          {t.carriedOver && <Badge tone="info">Night shift since {clock(t.carriedOver.openSince, tz)}</Badge>}
          {(r?.lateMinutes ?? 0) > 0 && <Badge tone="warning">{lateBy(r!.lateMinutes)} late</Badge>}
          <p className="text-xs text-muted-foreground">Shift {t.policy.shiftStart} – {t.policy.shiftEnd}</p>
        </div>
      </div>
      {(r?.checkIn || t.carriedOver) && (
        <div className="space-y-2 px-5 pb-3">
          <DayTimeline t={t} now={now} />
          <SessionList t={t} now={now} />
        </div>
      )}
      <div className="relative border-t border-border p-3">
        <Burst fire={burst} />
        {!t.policy.webCheckInEnabled ? (
          <p className="text-center text-sm text-muted-foreground">Web check-in is turned off.</p>
        ) : working ? (
          <Button className="w-full" variant="secondary" onClick={actions.requestOut} loading={actions.outPending}><LogOut /> Check out</Button>
        ) : done ? (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm font-medium">Checked out · {hours(r?.workingMinutes)}</p>
            <Button size="sm" variant="secondary" onClick={() => void actions.doIn()} loading={actions.inPending}><LogIn /> Check in again</Button>
          </div>
        ) : (
          <span className="m-pulse block rounded-md"><Button className="w-full" onClick={() => void actions.doIn()} loading={actions.inPending}><LogIn /> Check in</Button></span>
        )}
        {actions.dialog}
      </div>
    </Card>
  );
}

/** This month's attendance summary + this week's hours. */
export function MonthCard() {
  const month = thisMonth();
  const cal = useCalendar(month);
  if (cal.isLoading) return <Skeleton className="h-56 w-full" />;
  if (!cal.data) return null;
  const s = cal.data.summary;
  const todayKey = cal.data.today;
  // Monday → Sunday of the current week, from this month's days
  const d = new Date(`${todayKey}T00:00:00Z`);
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const week = Array.from({ length: 5 }, (_, i) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const rec = cal.data!.days.find((x) => x.date === key);
    const m = rec?.workingMinutes ?? 0;
    const tone = rec?.status === 'ON_LEAVE' || rec?.holiday ? ('warning' as const) : rec?.status === 'WORK_FROM_HOME' ? ('info' as const) : ('primary' as const);
    return { label: dayShort.format(day), value: m, tone, title: rec ? `${STATUS_META[rec.status].label}${m ? ` · ${hours(m)}` : ''}` : undefined };
  });
  const stat = (n: number, label: string, warn = false) => (
    <div>
      <p className={warn && n > 0 ? 'text-2xl font-bold tabular-nums text-warning' : 'text-2xl font-bold tabular-nums'}>{n}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
  return (
    <Card className="flex flex-col">
      <CardHeader title="This month" action={<Link href="/app/attendance" className="text-xs font-medium text-primary hover:underline">Calendar</Link>} />
      <div className="grid grid-cols-4 gap-2 px-5">
        {stat(s.present + s.halfDay, 'Present')}
        {stat(s.workFromHome, 'WFH')}
        {stat(s.onLeave, 'Leave')}
        {stat(s.late, 'Late', true)}
      </div>
      <div className="mt-auto px-5 pb-4 pt-4">
        <p className="mb-1 text-xs text-muted-foreground">This week · {s.averageMinutes ? `avg ${hours(s.averageMinutes)} a day this month` : 'no hours yet'}</p>
        <MiniBars bars={week} height={64} label="Hours worked each day this week" />
      </div>
    </Card>
  );
}

/** Leave balances as meters. */
export function BalancesCard() {
  const q = useLeaveBalances();
  if (q.isLoading) return <Skeleton className="h-56 w-full" />;
  const rows = (q.data?.balances ?? []).filter((b) => b.leaveType.isActive).slice(0, 5);
  if (!rows.length) return null;
  return (
    <Card className="flex flex-col">
      <CardHeader title="Leave balance" action={<Link href="/app/leave" className="text-xs font-medium text-primary hover:underline">My leave</Link>} />
      <div className="space-y-3 px-5 pb-5">
        {rows.map((b) => {
          // Entitlement so far = what is left + what is used or waiting
          return (
            <div key={b.balanceId}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{b.leaveType.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{b.available === null ? 'No limit' : `${b.available} of ${b.available + b.used + b.pending} left`}</span>
              </div>
              <Meter value={b.available ?? 0} max={b.available === null ? 1 : b.available + b.used + b.pending} label={`${b.leaveType.name} left`} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Everything waiting on the person, collected from each module they use. */
export function useNeedsAction(me: MyCard | undefined) {
  const { can, hasFeature } = useAccess();
  const month = thisMonth();
  const sheets = useTimesheets({ view: 'mine', status: 'REJECTED', limit: 3 }, hasFeature('work.timesheets') && can('timesheet.submit'));
  const claims = useClaims({ view: 'mine', status: 'REJECTED', limit: 3 }, can('expense.submit'));
  const tickets = useTickets({ view: 'mine', status: 'WAITING', limit: 3 }, can('ticket.view'));
  const assets = useMyAssets(can('asset.view'));
  // Only ask for the list when something waits for my confirmation
  const latest = useAnnouncements(HOME_ANNOUNCEMENTS);
  const acks = useAnnouncements({ filter: 'ack', limit: 3 }, hasFeature('engage.announcements') && can('announcement.view') && (latest.data?.meta.needsAck ?? 0) > 0);
  const cal = useCalendar(month);

  const rows: React.ReactNode[] = [];
  for (const s of sheets.data?.data ?? []) rows.push(<ActionRow key={`ts-${s.id}`} tone="danger" icon={<Timer />} title="Time sent back" detail={`Week of ${formatDate(s.weekStart)}${s.decisionNote ? ` · “${s.decisionNote}”` : ''}`} href={`/app/timesheets?week=${s.weekStart}`} cta="Fix" />);
  for (const c of claims.data?.data ?? []) rows.push(<ActionRow key={`ex-${c.id}`} tone="danger" icon={<Receipt />} title="Expense claim sent back" detail={c.title} href={`/app/expenses/${c.id}`} cta="Fix" />);
  for (const t of tickets.data?.data ?? []) rows.push(<ActionRow key={`tk-${t.id}`} tone="warning" icon={<LifeBuoy />} title={`${QUEUE_INFO[t.queue].label} needs more information`} detail={`#${t.number} · ${t.subject}`} href={`/app/helpdesk/${t.id}`} cta="Reply" />);
  for (const a of (assets.data?.current ?? []).filter((x) => !x.acknowledgedAt)) rows.push(<ActionRow key={`as-${a.id}`} tone="info" icon={<PackageCheck />} title={`Confirm you received ${a.asset.tag}`} detail={a.asset.name} href="/app/assets/mine" cta="Confirm" />);
  for (const d of (cal.data?.days ?? []).filter((x) => x.status === 'MISSING_CHECKOUT' && !x.correction).slice(-2)) rows.push(<ActionRow key={`mc-${d.date}`} tone="warning" icon={<CalendarX2 />} title="Missed check-out" detail={formatDate(d.date)} href="/app/attendance" cta="Fix" />);
  for (const a of (acks.data?.data ?? []).filter((x) => x.requiresAck && !x.acknowledgedAt)) rows.push(<ActionRow key={`an-${a.id}`} tone="neutral" icon={<Megaphone />} title="Confirm you’ve read an announcement" detail={a.title} href={`/app/announcements/${a.id}`} cta="Read" />);
  if (me?.completion && me.completion.percent < 100) {
    const next = me.completion.items.find((i) => !i.done);
    rows.push(
      <li key="profile" className="flex items-center gap-3 py-2.5">
        <IconTile tone="primary"><UserRound /></IconTile>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-sm font-semibold">Complete your profile · {me.completion.percent}%</p>
          <Milestones percent={me.completion.percent} label="Profile completion" />
          {next && <p className="truncate text-xs text-muted-foreground">Next: {next.label.toLowerCase()}</p>}
        </div>
        <Link href="/app/profile" className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-xs font-semibold transition-colors hover:bg-subtle">Open</Link>
      </li>,
    );
  }

  const loading = sheets.isLoading || claims.isLoading || tickets.isLoading || acks.isLoading;
  return { rows, loading };
}

export function NeedsActionCard({ me }: { me: MyCard | undefined }) {
  const { rows, loading } = useNeedsAction(me);
  return (
    <Card className="flex flex-col">
      <CardHeader title="Needs your action" action={rows.length ? <Badge tone="danger">{rows.length}</Badge> : undefined} />
      {loading && !rows.length ? (
        <div className="space-y-2 px-5 pb-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : rows.length ? (
        <ul className="divide-y divide-border px-5 pb-2">{rows}</ul>
      ) : (
        <div className="flex items-center gap-3 px-5 pb-5 text-sm text-muted-foreground">
          <BadgeCheck className="h-5 w-5 text-success" /> You’re all caught up.
        </div>
      )}
    </Card>
  );
}

