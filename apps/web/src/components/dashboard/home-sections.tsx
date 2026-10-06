'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Cake,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Heart,
  Home,
  PartyPopper,
  Plane,
  Sparkles,
  Timer,
  UserPlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Skeleton, Tabs } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CountUp, Confetti, RevealWords, SkyHero, useReducedMotion } from '@/components/motion/motion';
import { MomentLayer, type Moment } from '@/components/motion/moments';
import { Donut, HBars, RingsRow, ViewAs, useChartStyle } from '@/components/dashboard/charts';
import { useAccess } from '@/lib/access/use-access';
import { useAuthStore } from '@/store/useAuthStore';
import { STATUS_META, clock, hours, useCalendar, useToday, type CalendarDay } from '@/lib/company/attendance';
import { useLeaveBalances } from '@/lib/company/leave';
import { useMyProjects } from '@/lib/company/projects';
import { useKudosFeed } from '@/lib/company/engagement';
import type { Spotlight } from '@/lib/company/profile';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const todayLabel = () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// ─── Hero ───────────────────────────────────────────────────

export interface HeroStat {
  label: string;
  value: number | undefined;
  format?: (n: number) => string;
  suffix?: React.ReactNode;
  tone?: 'warn';
}
export interface HeroAction {
  href: string;
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
}

/** The sky card at the top of every home: greeting, a line about today, numbers and shortcuts. */
export function HomeHero({ title, subtitle, stats, actions, className, moment }: { title: string; subtitle?: React.ReactNode; stats: HeroStat[]; actions: HeroAction[]; className?: string; moment?: Moment | null }) {
  const userId = useAuthStore((s) => s.user?.id);
  return (
    <SkyHero className={cn('flex flex-col gap-5 p-6', className)} skyPart={moment?.sky} decoration={moment ? <MomentLayer moment={moment} /> : undefined}>
      <div>
        {moment && <span className="m-moment-pill mb-2">{moment.icon}{moment.pill}</span>}
        <p className="text-xs font-semibold text-white/80">{todayLabel()}</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[32px]">
          <RevealWords text={title} storageKey={`greet-${userId}`} />
        </h1>
        {subtitle && <p className="mt-1 max-w-xl text-sm text-white/85">{subtitle}</p>}
      </div>
      {stats.length > 0 && (
        <div className={cn('grid max-w-2xl gap-2.5', stats.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
          {stats.map((s) => (
            <div key={s.label} className="m-lift rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 backdrop-blur-sm">
              <p className="truncate text-2xs font-medium text-white/75">{s.label}</p>
              <p className={cn('text-[22px] font-bold leading-tight text-white', s.tone === 'warn' && 'text-amber-300')}>
                {s.value === undefined ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-white/20 align-middle" /> : <CountUp value={s.value} format={s.format} />}
                {s.value !== undefined && s.suffix && <span className="text-xs font-semibold text-white/70"> {s.suffix}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
      {actions.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white [&_svg]:size-4',
                a.primary ? 'bg-primary text-primary-foreground shadow-card' : 'border border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20',
              )}
            >
              {a.icon}
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </SkyHero>
  );
}

/** Hero data for an employee: the line about today and three numbers. */
export function useEmployeeHero(needsCount: number | undefined, celebrating: string[]) {
  const { can, hasFeature } = useAccess();
  const user = useAuthStore((s) => s.user);
  const today = useToday(hasFeature('time.attendance'));
  const cal = useCalendar(thisMonth());
  const balances = useLeaveBalances();
  const t = today.data;
  const r = t?.record;
  const tz = t?.policy.timeZone ?? 'UTC';

  const parts: string[] = [];
  if (t?.holiday) parts.push(`Enjoy the holiday — ${t.holiday.name}.`);
  else if (t?.leave?.status === 'APPROVED') parts.push(`You’re on ${t.leave.name.toLowerCase()} today.`);
  else if (t?.status === 'WEEKEND') parts.push('It’s your weekly off.');
  else if (r?.checkIn && !r.checkOut) parts.push(`You’re checked in since ${clock(r.checkIn, tz)}.`);
  else if (r?.checkIn && r.checkOut) parts.push(`You’re done for today — ${hours(r.workingMinutes)}.`);
  else if (t?.hasProfile) parts.push('You haven’t checked in yet.');
  if (needsCount !== undefined) parts.push(needsCount ? `${needsCount} thing${needsCount === 1 ? '' : 's'} need${needsCount === 1 ? 's' : ''} you.` : 'Nothing needs you right now.');
  if (celebrating.length) parts.push(`${celebrating.slice(0, 2).join(' and ')}${celebrating.length > 2 ? ` and ${celebrating.length - 2} more` : ''} ${celebrating.length === 1 ? 'is' : 'are'} celebrating today.`);

  const s = cal.data?.summary;
  const leaveLeft = balances.data?.balances.filter((b) => b.leaveType.isActive && b.available !== null).reduce((n, b) => n + (b.available ?? 0), 0);
  const stats: HeroStat[] = [];
  if (hasFeature('time.attendance') && can('attendance.view')) {
    stats.push({ label: 'Present (month)', value: s ? s.present + s.halfDay : undefined, suffix: 'days' });
    stats.push({ label: 'Avg a day', value: s ? s.averageMinutes : undefined, format: (n) => (n ? hours(Math.round(n)) : '—') });
  }
  if (hasFeature('time.leave') && can('leave.view')) stats.push({ label: 'Leave left', value: leaveLeft, suffix: 'days' });

  const actions: HeroAction[] = [];
  if (hasFeature('time.leave') && can('leave.request')) {
    actions.push({ href: '/app/leave?apply=', label: 'Apply leave', icon: <Plane />, primary: true });
    actions.push({ href: '/app/leave?apply=WFH', label: 'Work from home', icon: <Home /> });
  }
  if (hasFeature('work.timesheets') && can('timesheet.submit')) actions.push({ href: '/app/timesheets', label: 'Timesheet', icon: <Timer /> });
  if (hasFeature('engage.kudos') && can('kudos.give')) actions.push({ href: '/app/kudos', label: 'Give kudos', icon: <Heart /> });

  return { title: `${greeting()}, ${user?.firstName ?? ''}`, subtitle: parts.join(' '), stats, actions };
}

export { greeting };

// ─── My week ────────────────────────────────────────────────

/** Monday to Sunday: status, check-in and check-out for each day. */
export function MyWeekCard() {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monday = new Date(`${todayKey}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const a = useCalendar(monthKey(monday));
  const b = useCalendar(monthKey(sunday));
  if (a.isLoading || b.isLoading) return <Skeleton className="h-60 w-full" />;
  if (!a.data) return null;
  const tz = a.data.policy.timeZone;
  const byDate = new Map<string, CalendarDay>([...(a.data.days ?? []), ...(b.data?.days ?? [])].map((d) => [d.date, d]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    return { key, d, rec: byDate.get(key) };
  });
  const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
  const range = `${formatDate(days[0]!.key)} – ${formatDate(days[6]!.key)}`;
  return (
    <Card className="flex flex-col">
      <CardHeader title="My week" description={range} action={<Link href="/app/attendance" className="text-xs font-medium text-primary hover:underline">Full calendar</Link>} />
      <div className="m-stagger grid grid-cols-2 gap-2 px-5 pb-4 sm:grid-cols-4 lg:grid-cols-7">
        {days.map(({ key, d, rec }) => {
          const isToday = key === todayKey;
          const meta = rec ? STATUS_META[rec.status] : null;
          const off = rec?.status === 'WEEKEND' || rec?.status === 'HOLIDAY';
          return (
            <div key={key} className={cn('flex min-h-[112px] flex-col gap-1.5 rounded-lg border p-2.5', isToday ? 'border-primary bg-primary-soft/40 ring-1 ring-primary' : 'border-border', off && !isToday && 'bg-muted/40')}>
              <div className="flex items-baseline justify-between">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{fmtDay.format(d)}</span>
                <span className="text-lg font-bold tabular-nums">{d.getUTCDate()}</span>
              </div>
              {meta && rec?.status !== 'UPCOMING' && <span className={cn('w-fit rounded-full px-2 py-0.5 text-2xs font-semibold', meta.cell)}>{isToday && rec?.status === 'NOT_CHECKED_IN' ? 'Today' : isToday && rec?.checkOut && (rec.status === 'ABSENT' || rec.status === 'HALF_DAY') ? 'Checked out' : meta.label}</span>}
              {rec?.checkIn && (
                <div className="space-y-0.5 text-2xs tabular-nums">
                  <p className="flex justify-between"><span className="text-muted-foreground">In</span><b>{clock(rec.checkIn, tz)}</b></p>
                  <p className="flex justify-between"><span className="text-muted-foreground">Out</span><b>{rec.checkOut ? clock(rec.checkOut, tz) : '—'}</b></p>
                </div>
              )}
              {((rec?.sessions ?? 0) > 1 || rec?.earlyCheckout) && (
                <span className="text-2xs text-muted-foreground">
                  {(rec?.sessions ?? 0) > 1 && `${rec!.sessions} sessions`}
                  {rec?.earlyCheckout && <b className="ml-1 font-semibold text-warning">early</b>}
                </span>
              )}
              {rec?.holiday && <span className="line-clamp-2 text-2xs text-muted-foreground">{rec.holiday.name}</span>}
              {rec?.leave && !rec.checkIn && <span className="line-clamp-2 text-2xs text-muted-foreground">{rec.leave.name}</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-auto border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
        This month: {a.data.summary.averageMinutes ? `${hours(a.data.summary.averageMinutes)} a day on average` : 'no hours yet'} · {a.data.summary.late} late
      </p>
    </Card>
  );
}

// ─── Leave balance ──────────────────────────────────────────

const LEAVE_STYLES = ['tiles', 'rings', 'list', 'donut'] as const;
const TONES = ['primary', 'success', 'info', 'warning', 'danger'] as const;
const TILE_FILL = ['bg-primary', 'bg-success', 'bg-info', 'bg-warning', 'bg-destructive'];

/** Leave balances as tiles, rings, bars or a donut — the person chooses. */
export function LeaveBalanceCard() {
  const q = useLeaveBalances();
  const [style, setStyle] = useChartStyle('leave-balance', LEAVE_STYLES, 'tiles');
  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  const rows = (q.data?.balances ?? []).filter((b) => b.leaveType.isActive).slice(0, 6);
  if (!rows.length) return null;
  const limited = rows.filter((b) => b.available !== null);
  const total = limited.reduce((n, b) => n + (b.available ?? 0), 0);
  return (
    <Card>
      <CardHeader
        title="Leave balance"
        description={`${total} day${total === 1 ? '' : 's'} available`}
        action={
          <div className="flex items-center gap-3">
            <ViewAs options={LEAVE_STYLES} value={style} onChange={setStyle} />
            <Link href="/app/leave" className="text-xs font-medium text-primary hover:underline">My leave</Link>
          </div>
        }
      />
      <div key={style} className="px-5 pb-5">
        {style === 'tiles' ? (
          <div className="m-stagger flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_170px]">
            {rows.map((b, i) => {
              const tot = b.available === null ? null : b.available + b.used + b.pending;
              return (
                <div key={b.balanceId} className="m-tilt flex flex-col gap-2 rounded-lg border border-border bg-surface p-3.5">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.leaveType.color }} aria-hidden />
                    <span className="truncate">{b.leaveType.name}</span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold tracking-tight">{b.available === null ? '∞' : <CountUp value={b.available} />}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{tot === null ? 'No limit' : `of ${tot} left`}</span>
                  </span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('m-fill-w h-full rounded-full', TILE_FILL[i % TILE_FILL.length])} style={{ width: tot ? `${((b.available ?? 0) / tot) * 100}%` : '100%', opacity: tot ? 1 : 0.35 }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : style === 'rings' ? (
          <RingsRow items={rows.map((b, i) => ({ label: b.leaveType.name, value: b.available ?? 1, max: b.available === null ? 1 : Math.max(1, b.available + b.used + b.pending), tone: TONES[i % TONES.length], center: b.available === null ? '∞' : b.available }))} />
        ) : style === 'list' ? (
          <HBars rows={rows.map((b, i) => ({ label: b.leaveType.name, value: b.available ?? 1, max: b.available === null ? 1 : Math.max(1, b.available + b.used + b.pending), right: b.available === null ? 'No limit' : `${b.available} / ${b.available + b.used + b.pending}`, tone: TONES[i % TONES.length] }))} />
        ) : (
          <Donut label="Leave available" total={total} center={<><span className="text-2xl font-bold tabular-nums">{total}</span><span className="text-2xs text-muted-foreground">days left</span></>} slices={limited.map((b, i) => ({ label: b.leaveType.name, value: b.available ?? 0, tone: TONES[i % TONES.length]! }))} />
        )}
      </div>
    </Card>
  );
}

// ─── My projects ────────────────────────────────────────────

const PROJ_FILL = ['bg-primary', 'bg-info', 'bg-success', 'bg-warning'];
export function MyProjectsCard() {
  const { can, hasFeature } = useAccess();
  const q = useMyProjects(hasFeature('work.projects') && can('project.view'));
  if (!hasFeature('work.projects') || !can('project.view')) return null;
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = (q.data ?? []).filter((a) => a.active);
  if (!rows.length) return null;
  const total = rows.reduce((n, a) => n + a.allocation, 0);
  return (
    <Card className="flex flex-col">
      <CardHeader title="My projects" action={<Badge tone={total > 100 ? 'warning' : 'primary'}>{total}% allocated</Badge>} />
      <ul className="divide-y divide-border px-5">
        {rows.slice(0, 4).map((a, i) => (
          <li key={a.id} className="flex items-center gap-3 py-2.5">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white [&_svg]:size-4', PROJ_FILL[i % PROJ_FILL.length])}><FolderKanban /></span>
            <div className="min-w-0 flex-1">
              <Link href={`/app/projects/${a.project.id}`} className="block truncate text-sm font-semibold hover:underline">{a.project.name}</Link>
              <p className="truncate text-xs text-muted-foreground">{a.roleLabel}{a.lead ? ` · lead ${a.lead.firstName}` : ''}</p>
            </div>
            <span className="text-sm font-bold tabular-nums">{a.allocation}%</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto px-5 pb-4 pt-2">
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {rows.map((a, i) => <div key={a.id} className={cn('m-fill-w h-full', PROJ_FILL[i % PROJ_FILL.length])} style={{ width: `${Math.min(100, a.allocation)}%`, animationDelay: `${i * 120}ms` }} />)}
        </div>
      </div>
    </Card>
  );
}

// ─── Celebrations (today's birthdays + work anniversaries) ───

type Person = Spotlight['birthdays'][number];

/** "12 wishes so far today" — counts up live as kudos arrive. */
function Wishes({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="m-pop inline-flex items-center gap-1 rounded-full bg-surface/80 px-2.5 py-0.5 text-2xs font-semibold text-muted-foreground ring-1 ring-border">
      🎉 <CountUp value={n} /> wish{n === 1 ? '' : 'es'} so far today
    </span>
  );
}
type Slide = { kind: 'birthday'; people: Person[] } | { kind: 'anniversary'; person: Spotlight['anniversaries'][number] };

/** Today’s birthdays (all of them together) and each work anniversary, as a moving card. */
export function CelebrationsCard({ data, loading }: { data?: Spotlight; loading: boolean }) {
  const { can, hasFeature } = useAccess();
  const reduced = useReducedMotion();
  const slides = useMemo<Slide[]>(() => {
    if (!data) return [];
    const bdays = data.birthdays.filter((b) => b.inDays === 0);
    const out: Slide[] = bdays.length ? [{ kind: 'birthday', people: bdays }] : [];
    for (const a of data.anniversaries.filter((x) => x.inDays === 0)) out.push({ kind: 'anniversary', person: a });
    return out;
  }, [data]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || paused || reduced) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length, paused, reduced]);
  const kudos = hasFeature('engage.kudos') && can('kudos.give');

  if (loading) return <Skeleton className="h-72 w-full" />;
  if (!data) return null;

  if (!slides.length) {
    // Nothing today: show what's next so the card is still useful
    const next = [...data.birthdays.map((b) => ({ p: b, what: 'birthday', inDays: b.inDays })), ...data.anniversaries.map((a) => ({ p: a, what: `${a.years}-year work anniversary`, inDays: a.inDays }))].filter((x) => x.inDays > 0).sort((a, b) => a.inDays - b.inDays)[0];
    return (
      <Card>
        <CardHeader icon={<PartyPopper />} title="Celebrations today" />
        <div className="flex items-center gap-3 px-5 pb-5">
          {next ? (
            <>
              <PersonAvatar person={next.p} size="md" />
              <p className="text-sm text-muted-foreground">
                Nothing today. Next: <b className="text-foreground">{next.p.firstName} {next.p.lastName}</b>’s {next.what} {next.inDays === 1 ? 'tomorrow' : `in ${next.inDays} days`}.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No birthdays or work anniversaries coming up.</p>
          )}
        </div>
      </Card>
    );
  }

  const cur = slides[i % slides.length]!;
  const bCount = slides[0]?.kind === 'birthday' ? slides[0].people.length : 0;
  const aCount = slides.length - (bCount ? 1 : 0);
  return (
    <Card className="relative overflow-hidden" >
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        <Confetti />
        <CardHeader
          icon={<PartyPopper />}
          title="Celebrations today"
          action={
            <div className="flex gap-1.5">
              {bCount > 0 && <Badge tone="danger"><Cake className="h-3 w-3" />{bCount}</Badge>}
              {aCount > 0 && <Badge tone="primary"><Award className="h-3 w-3" />{aCount}</Badge>}
            </div>
          }
        />
        <div className="relative px-5 pb-4" aria-live="polite">
          <div key={i} className="m-slide flex min-h-[220px] flex-col items-center justify-center gap-2.5 text-center">
            {cur.kind === 'birthday' ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive-soft px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-destructive"><Cake className="h-3 w-3" />{cur.people.length === 1 ? 'Birthday today' : `${cur.people.length} birthdays today`}</span>
                <div className="flex justify-center">
                  {cur.people.slice(0, 4).map((p, k) => <PersonAvatar key={p.id} person={p} size="xl" className={cn('m-pop ring-4 ring-surface', k > 0 && '-ml-5')} />)}
                  {cur.people.length > 4 && <span className="-ml-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted text-base font-bold ring-4 ring-surface">+{cur.people.length - 4}</span>}
                </div>
                <div>
                  <p className="text-base font-bold">{cur.people.length <= 2 ? cur.people.map((p) => `${p.firstName} ${p.lastName}`).join(' & ') : `${cur.people.slice(0, 2).map((p) => p.firstName).join(', ')} and ${cur.people.length - 2} more`}</p>
                  <p className="text-xs text-muted-foreground">{[...new Set(cur.people.map((p) => p.department?.name).filter(Boolean))].join(' · ') || 'Wish them a happy birthday'}</p>
                </div>
                <Wishes n={cur.people.reduce((t, p) => t + (p.wishesToday ?? 0), 0)} />
                {kudos && <Link href={`/app/kudos?to=${cur.people.map((p) => p.id).join(',')}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"><Cake className="h-3.5 w-3.5" />Send wishes</Link>}
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-primary-soft-foreground"><Award className="h-3 w-3" />Work anniversary</span>
                <div className="flex items-center gap-3">
                  <PersonAvatar person={cur.person} size="xl" className="m-pop ring-4 ring-surface" />
                  <span className="m-medal" aria-hidden>
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-700 text-xl font-extrabold text-amber-950 shadow-card">{cur.person.years}</span>
                  </span>
                </div>
                <div>
                  <p className="text-base font-bold">{cur.person.firstName} {cur.person.lastName} · {cur.person.years} year{cur.person.years === 1 ? '' : 's'}</p>
                  <p className="text-xs text-muted-foreground">{cur.person.designation?.name ?? cur.person.department?.name ?? 'Thank you for your work'}</p>
                </div>
                <Wishes n={cur.person.wishesToday ?? 0} />
                {kudos && <Link href={`/app/kudos?to=${cur.person.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"><Heart className="h-3.5 w-3.5" />Give kudos</Link>}
              </>
            )}
          </div>
          {slides.length > 1 && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <button type="button" aria-label="Previous" onClick={() => setI((n) => (n - 1 + slides.length) % slides.length)} className="rounded-full p-1 text-muted-foreground hover:bg-subtle hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
              {slides.map((_, k) => (
                <button key={k} type="button" aria-label={`Show celebration ${k + 1} of ${slides.length}`} aria-current={k === i % slides.length} onClick={() => setI(k)} className={cn('h-1.5 rounded-full transition-all', k === i % slides.length ? 'w-5 bg-primary' : 'w-1.5 bg-border')} />
              ))}
              <button type="button" aria-label="Next" onClick={() => setI((n) => (n + 1) % slides.length)} className="rounded-full p-1 text-muted-foreground hover:bg-subtle hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Kudos (moving) ─────────────────────────────────────────

/** Recent kudos scrolling slowly; pauses on hover or keyboard focus. */
export function KudosTickerCard({ className }: { className?: string }) {
  const { can, hasFeature } = useAccess();
  const enabled = hasFeature('engage.kudos') && can('kudos.view');
  const q = useKudosFeed({ limit: 8 }, enabled);
  const reduced = useReducedMotion();
  if (!enabled) return null;
  const items = q.data?.data ?? [];
  const moving = items.length >= 3 && !reduced;
  const row = (k: (typeof items)[number], hidden = false) => (
    <li key={`${hidden ? 'b' : 'a'}-${k.id}`} aria-hidden={hidden || undefined} className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-xs">
        <PersonAvatar person={k.from} size="xs" />
        <b className="truncate">{k.from.firstName}</b>
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        <div className="flex -space-x-1.5">{k.recipients.slice(0, 3).map((r) => <PersonAvatar key={r.id} person={r} size="xs" className="ring-2 ring-surface" />)}</div>
        <b className="truncate">{k.recipients.map((r) => r.firstName).join(', ')}</b>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm">{k.message}</p>
      <div className="mt-2 flex items-center gap-2 text-2xs text-muted-foreground">
        {k.value && <span className="rounded-full px-2 py-0.5 font-semibold" style={{ backgroundColor: `${k.value.color}22`, color: k.value.color }}>{k.value.name}</span>}
        <span className="ml-auto">{formatRelative(k.createdAt)}</span>
      </div>
    </li>
  );
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        icon={<Heart />}
        title="Kudos"
        action={<Link href="/app/kudos" className="text-xs font-medium text-primary hover:underline">{can('kudos.give') ? 'Give kudos' : 'See all'}</Link>}
      />
      {q.isLoading ? (
        <div className="space-y-2 px-5 pb-5"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : !items.length ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No kudos yet — thank someone for something great.</p>
      ) : moving ? (
        <div className="m-ticker mx-3 mb-3 min-h-[240px] flex-1 basis-0" style={{ ['--m-dur' as string]: `${items.length * 5}s` }} tabIndex={0} aria-label="Recent kudos (hover or focus to pause)">
          <ul className="flex flex-col gap-2">
            {items.map((k) => row(k))}
            {items.map((k) => row(k, true))}
          </ul>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 px-3 pb-3">{items.map((k) => row(k))}</ul>
      )}
      <Link href="/app/kudos" className="flex items-center justify-center gap-1.5 border-t border-border px-5 py-2.5 text-xs font-semibold text-primary hover:bg-subtle">
        View all kudos <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}

// ─── Coming up (birthdays, anniversaries, new joiners, holidays) ───

type UpTab = 'birthdays' | 'anniversaries' | 'joiners' | 'holidays';
const monthDay = (md: string) => {
  const [m, d] = md.split('-').map(Number);
  return new Date(2000, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
const inDays = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`);
const UP_ROWS = 5;

/** The next 30 days: birthdays, work anniversaries, new joiners and holidays. */
export function ComingUpCard({ data, loading }: { data?: Spotlight; loading: boolean }) {
  const [tab, setTab] = useState<UpTab>('birthdays');
  const { scopeOf } = useAccess();
  // Full profiles only for people who can see beyond themselves (the API re-checks)
  const viewScope = scopeOf('employee.view');
  const canOpenProfile = Boolean(viewScope && viewScope !== 'own');
  const tabs: Array<{ id: UpTab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'birthdays', label: 'Birthdays', icon: <Cake />, count: data?.birthdays.length },
    { id: 'anniversaries', label: 'Anniversaries', icon: <Award />, count: data?.anniversaries.length },
    { id: 'joiners', label: 'New', icon: <UserPlus />, count: data?.newJoiners.length },
    { id: 'holidays', label: 'Holidays', icon: <CalendarDays />, count: data?.holidays.length },
  ];
  const rows =
    tab === 'birthdays'
      ? data?.birthdays.map((p) => ({ key: p.id, p, right: monthDay(p.date), sub: inDays(p.inDays) }))
      : tab === 'anniversaries'
        ? data?.anniversaries.map((p) => ({ key: p.id, p, right: `${p.years} yr${p.years === 1 ? '' : 's'}`, sub: `${inDays(p.inDays)} · ${monthDay(p.date)}` }))
        : tab === 'joiners'
          ? data?.newJoiners.map((p) => ({ key: p.id, p, right: formatDate(p.joiningDate), sub: p.department?.name ?? '' }))
          : data?.holidays.map((h) => ({ key: h.id, p: null, right: new Date(h.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }), sub: new Date(h.date).toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' }) + (h.isOptional ? ' · optional' : ''), name: h.name }));
  const empty = { birthdays: 'No birthdays in the next 30 days.', anniversaries: 'No work anniversaries in the next 30 days.', joiners: 'Nobody new in the last 30 days.', holidays: 'No holidays added yet.' }[tab];
  return (
    <Card>
      <CardHeader icon={<Sparkles />} title="Coming up" description="Next 30 days" />
      <div className="px-5"><Tabs tabs={tabs} value={tab} onChange={setTab} /></div>
      {loading ? (
        <div className="space-y-2 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : !rows?.length ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul
          key={tab}
          tabIndex={rows.length > UP_ROWS ? 0 : undefined}
          aria-label={rows.length > UP_ROWS ? `${rows.length} ${tabs.find((t) => t.id === tab)?.label.toLowerCase()} (scroll for more)` : undefined}
          // 5 rows of 53px in view, the rest scroll; the fade hints there is more
          className={cn('m-stagger divide-y divide-border', rows.length > UP_ROWS && 'max-h-[272px] overflow-y-auto overscroll-contain [mask-image:linear-gradient(#000_85%,transparent)] focus-visible:outline-none')}
        >
          {rows.map((r) => {
            const inner = (
              <>
                {r.p ? <PersonAvatar person={r.p} size="sm" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info-soft text-info [&_svg]:size-4"><CalendarDays /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.p ? `${r.p.firstName} ${r.p.lastName}` : 'name' in r ? r.name : ''}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.sub}</p>
                </div>
                <span className="text-sm font-medium tabular-nums">{r.right}</span>
              </>
            );
            return (
              <li key={r.key}>
                {r.p && canOpenProfile ? (
                  <Link href={`/app/employees/${r.p.id}`} className="flex h-[53px] items-center gap-3 px-5 transition-colors hover:bg-subtle">{inner}</Link>
                ) : (
                  <div className="flex h-[53px] items-center gap-3 px-5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

