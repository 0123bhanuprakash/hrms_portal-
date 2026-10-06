'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ClipboardList, Copy, List, Plus, Send, ShieldCheck, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { WeekCalendar, blockColor, GENERAL_COLOR } from '@/components/timesheets/week-calendar';
import { BlockDialog, type BlockDraft } from '@/components/timesheets/block-dialog';
import { CopyDayDialog, SubmitDialog } from '@/components/timesheets/submit-dialog';
import { GapsCard, ProjectsCard, TimerCard } from '@/components/timesheets/side-panel';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import { TS_STATUS, addDays, clock, dayLabel, fmtHours, longDayLabel, mondayOf, todayKey, useRecallTime, useWeek, weekLabel, type Block, type Week } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { NoProfile } from '@/components/profile/no-profile';

type View = 'day' | 'week' | 'list';

export default function TimesheetPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Timesheet />
    </Suspense>
  );
}

function Timesheet() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const thisWeek = mondayOf(todayKey());
  const raw = params.get('week');
  const weekStart = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? mondayOf(raw) : thisWeek;
  const employeeId = params.get('employeeId') ?? undefined;
  const view = (['day', 'week', 'list'].includes(params.get('view') ?? '') ? params.get('view') : 'week') as View;
  const allowed = hasFeature('work.timesheets');
  const q = useWeek(weekStart, employeeId, allowed && (Boolean(employeeId) || Boolean(me.data?.employee)));
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copying, setCopying] = useState(false);
  const recall = useRecallTime();

  const setParams = (patch: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
  };
  const go = (w: string) => setParams({ week: w === thisWeek ? null : w, day: null });
  const week = q.data;
  const pickedDay = params.get('day');
  const day = week ? (pickedDay && week.days.some((d) => d.date === pickedDay) ? pickedDay : week.days.some((d) => d.date === week.today) ? week.today : week.weekStart) : weekStart;

  const openNew = (date: string, startMin: number, endMin: number, extra?: Partial<BlockDraft>) => setDraft({ date, startMin, endMin, ...extra });
  /** "Log time": right after the last block of the day (or check-in / 9 am), one hour */
  const logNext = (w: Week, date: string) => {
    const blocks = w.blocks.filter((b) => b.date === date && b.endMin != null);
    const d = w.days.find((x) => x.date === date);
    const start = blocks.length ? Math.max(...blocks.map((b) => b.endMin!)) : d?.attendance?.checkIn != null ? Math.ceil(d.attendance.checkIn / 15) * 15 : 540;
    let end = start + 60;
    if (date === w.today) end = Math.max(start + 15, Math.min(end, Math.floor(w.nowMin / 5) * 5));
    openNew(date, start, end);
  };

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Timesheets are off" description="Your company plan doesn’t include timesheets." />;
  if (!employeeId && me.data && !me.data.employee) return <NoProfile icon={<ClipboardList />} what="Timesheets are for employees." />;

  const own = week?.isOwn ?? !employeeId;
  const waiting = week?.blocks.filter((b) => b.status === 'SUBMITTED') ?? [];
  const logDay = week ? (week.days.some((d) => d.date === week.today) ? week.today : [...week.days].reverse().find((d) => !d.future && !d.weekend)?.date ?? week.weekStart) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work"
        title={own ? 'My timesheet' : week ? `${week.employee.firstName} ${week.employee.lastName}’s timesheet` : 'Timesheet'}
        description={own ? 'Drag on the calendar to log what you worked on · Send sends every day you haven’t sent yet' : 'Read-only — approve their time from Timesheet approvals.'}
        action={
          own && week ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Copy />} onClick={() => setCopying(true)}>Copy a day</Button>
              {waiting.length > 0 && (
                <Button
                  variant="secondary"
                  icon={<Undo2 />}
                  loading={recall.isPending}
                  onClick={async () => {
                    try {
                      const r = await recall.mutateAsync([...new Set(waiting.map((b) => b.date))]);
                      toast.success(`Took back ${r.recalled} block${r.recalled === 1 ? '' : 's'}`);
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, 'Could not take it back'));
                    }
                  }}
                >
                  Take back
                </Button>
              )}
              {logDay && <Button variant="secondary" icon={<Plus />} onClick={() => logNext(week, view === 'day' ? day : logDay)}>Log time</Button>}
              <Button icon={<Send />} onClick={() => setSubmitting(true)} disabled={!week.unsentDays}>
                {week.unsentDays ? `Send ${week.unsentDays} day${week.unsentDays === 1 ? '' : 's'}` : 'All sent'}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label="Previous week" onClick={() => go(addDays(weekStart, -7))}><ChevronLeft /></Button>
        <span className="min-w-[140px] text-center text-sm font-semibold">{weekLabel(weekStart)}</span>
        <Button size="icon-sm" variant="secondary" aria-label="Next week" disabled={weekStart >= thisWeek} onClick={() => go(addDays(weekStart, 7))}><ChevronRight /></Button>
        {weekStart !== thisWeek && <Button size="sm" variant="ghost" onClick={() => go(thisWeek)}>This week</Button>}
        {week && (
          <span className="text-xs text-muted-foreground">
            <b className="text-foreground">{fmtHours(week.totalMinutes)}</b> logged{week.expectedMinutes ? ` of ${fmtHours(week.expectedMinutes)} expected` : ''}
          </span>
        )}
        <div className="ml-auto inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="View">
          {([['day', 'Day', <CalendarDays key="d" />], ['week', 'Week', <CalendarRange key="w" />], ['list', 'List', <List key="l" />]] as const).map(([id, label, icon]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setParams({ view: id === 'week' ? null : id })} className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors [&_svg]:size-3.5', view === id ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading || (!week && !q.isError) ? (
        <Skeleton className="h-[560px] w-full" />
      ) : q.isError || !week ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load the timesheet')} onRetry={() => void q.refetch()} />
      ) : (
        <div className={cn('grid gap-4', own && 'lg:grid-cols-[260px_minmax(0,1fr)]')}>
          {own && (
            <div className="space-y-3">
              <TimerCard week={week} onNeedsEdit={(date, s, e, projectId, description) => openNew(date, s, e, { projectId, description })} />
              <ProjectsCard week={week} />
              <GapsCard week={week} onFill={(date, s, e) => openNew(date, s, e)} />
            </div>
          )}
          <div className="min-w-0 space-y-3">
            {view === 'list' ? (
              <ListView week={week} onOpen={(b) => setDraft({ block: b, date: b.date, startMin: b.startMin ?? 0, endMin: b.endMin ?? 0 })} />
            ) : (
              <>
                {view === 'day' && (
                  <div className="flex items-center gap-2">
                    {week.days.map((d) => (
                      <button key={d.date} type="button" onClick={() => setParams({ day: d.date })} className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold', d.date === day ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-subtle')}>
                        {dayLabel(d.date)}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">{longDayLabel(day)}</span>
                  </div>
                )}
                <WeekCalendar
                  week={week}
                  dates={view === 'day' ? [day] : week.days.map((d) => d.date)}
                  editable={own}
                  hourHeight={view === 'day' ? 58 : 46}
                  onCreate={(date, s, e) => openNew(date, s, Math.min(e, date === week.today ? Math.max(s + 15, Math.floor(week.nowMin / 5) * 5) : e))}
                  onOpen={(b) => setDraft({ block: b, date: b.date, startMin: b.startMin ?? 0, endMin: b.endMin ?? 0 })}
                  onPickDay={view === 'week' ? (d) => setParams({ view: 'day', day: d }) : undefined}
                />
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-success/60" /> Checked in</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-destructive" /> Now</span>
                  <span>Blocks can’t overlap · approved time is locked</span>
                  {own && <span className="ml-auto">Drag on a day to log · click a block to edit</span>}
                </p>
              </>
            )}
            <WeekSummary week={week} />
          </div>
        </div>
      )}

      {week && (
        <>
          <BlockDialog week={week} draft={draft} onClose={() => setDraft(null)} />
          <SubmitDialog open={submitting} onClose={() => setSubmitting(false)} onFillDay={(d) => { setSubmitting(false); setParams({ week: mondayOf(d) === thisWeek ? null : mondayOf(d), view: 'day', day: d }); }} />
          <CopyDayDialog open={copying} onClose={() => setCopying(false)} defaultFrom={addDays(week.today, -1)} defaultTo={week.today} minDate={addDays(thisWeek, -56)} maxDate={week.today} />
        </>
      )}
    </div>
  );
}

function WeekSummary({ week }: { week: Week }) {
  const parts = useMemo(() => {
    const m = new Map<string, { name: string; color: string; minutes: number }>();
    for (const b of week.blocks) {
      const k = b.project?.id ?? 'general';
      const cur = m.get(k) ?? { name: b.project?.name ?? 'General', color: blockColor(b.project), minutes: 0 };
      cur.minutes += b.minutes;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.minutes - a.minutes);
  }, [week.blocks]);
  if (!week.totalMinutes) return null;
  const billable = week.blocks.filter((b) => b.billable).reduce((n, b) => n + b.minutes, 0);
  return (
    <Card className="flex flex-wrap items-center gap-4 px-4 py-3">
      <b className="text-sm">This week</b>
      <div className="flex h-3 min-w-[160px] flex-1 overflow-hidden rounded-full bg-muted">
        {parts.map((p) => <span key={p.name} title={`${p.name} · ${fmtHours(p.minutes)}`} style={{ width: `${(p.minutes / week.totalMinutes) * 100}%`, background: p.color }} />)}
      </div>
      <span className="text-xs"><b className="text-success">{fmtHours(billable)} billable</b> · <b className="text-muted-foreground">{fmtHours(week.totalMinutes - billable)} investment</b></span>
      <div className="flex w-full flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {parts.map((p) => <span key={p.name} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name} {fmtHours(p.minutes)}</span>)}
      </div>
    </Card>
  );
}

function ListView({ week, onOpen }: { week: Week; onOpen: (b: Block) => void }) {
  const days = week.days.filter((d) => week.blocks.some((b) => b.date === d.date));
  if (!days.length) return <EmptyState icon={<ClipboardList />} title="Nothing logged this week" description={week.isOwn ? 'Switch to Day or Week and drag on the calendar to log time.' : undefined} />;
  return (
    <Card className="divide-y divide-border">
      {days.map((d) => (
        <div key={d.date} className="px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-xs"><b>{longDayLabel(d.date)}</b><span className="text-muted-foreground">{fmtHours(d.minutes)}</span></div>
          <div className="space-y-1.5">
            {week.blocks.filter((b) => b.date === d.date).map((b) => (
              <button key={b.id} type="button" onClick={() => onOpen(b)} className="flex w-full items-center gap-3 rounded-lg border border-border/70 border-l-4 px-3 py-2 text-left text-sm hover:bg-subtle" style={{ borderLeftColor: b.project ? blockColor(b.project) : GENERAL_COLOR }}>
                <span className="w-32 shrink-0 text-xs tabular-nums text-muted-foreground">{b.startMin != null ? `${clock(b.startMin)} – ${clock(b.endMin!)}` : 'no times'}</span>
                <span className="w-28 shrink-0 truncate text-xs font-bold">{b.project?.name ?? 'General'}</span>
                <span className="min-w-0 flex-1 truncate">{b.description}</span>
                <b className="shrink-0 tabular-nums">{fmtHours(b.minutes)}</b>
                <Badge tone={TS_STATUS[b.status].tone} className="shrink-0">{TS_STATUS[b.status].label}</Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}
