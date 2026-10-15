'use client';

import React, { useMemo, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Download, GanttChart, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess, SCOPE_LABELS } from '@/lib/access/use-access';
import { useDepartments } from '@/lib/company/org';
import { days, leaveRange, useWhosOff, type LeaveRequest } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const thisMonth = () => new Date().toISOString().slice(0, 7);
const shift = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1 + by, 1)).toISOString().slice(0, 7);
};
const monthDays = (m: string) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return Array.from({ length: new Date(Date.UTC(y, mo, 0)).getUTCDate() }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`);
};
const isWeekend = (k: string) => [0, 6].includes(new Date(`${k}T00:00:00Z`).getUTCDay());

export default function WhosOffPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const scope = scopeOf('leave.view');
  // Everyone sees at least their own team (same manager, their reports, shared projects)
  const allowed = hasFeature('time.leave') && can('leave.view');
  const [month, setMonth] = useState(thisMonth);
  const [view, setView] = useState<'calendar' | 'timeline'>('timeline');
  const [departmentId, setDepartmentId] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const q = useWhosOff({ month, departmentId: departmentId || undefined }, allowed);
  const current = useWhosOff({ month: thisMonth() }, allowed);
  const departments = useDepartments();

  const keys = useMemo(() => monthDays(month), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    for (const l of q.data?.leaves ?? []) for (const k of keys) if (k >= l.startDate && k <= l.endDate) map.set(k, [...(map.get(k) ?? []), l]);
    return map;
  }, [q.data, keys]);
  const holidays = useMemo(() => new Map((q.data?.holidays ?? []).filter((h) => !h.isOptional).map((h) => [h.date, h])), [q.data]);
  const todayKey = new Date().toISOString().slice(0, 10);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="Leave isn’t enabled for you." />;
  const lead = (new Date(`${keys[0]}T00:00:00Z`).getUTCDay() + 6) % 7;
  const dayList = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Who’s off"
        description={scope && scope !== 'company' ? `Your team, plus ${SCOPE_LABELS[scope].hint.toLowerCase()}.` : 'Approved and pending leave across the company.'}
        action={<Button variant="secondary" onClick={() => downloadIcs(q.data?.leaves ?? [], month)} disabled={!q.data?.leaves.length}><Download /> Add to my calendar (.ics)</Button>}
      />

      <AwayToday leaves={current.data?.leaves ?? []} holidays={current.data?.holidays ?? []} />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs className="flex-1" tabs={[{ id: 'timeline' as const, label: 'Timeline', icon: <GanttChart /> }, { id: 'calendar' as const, label: 'Calendar', icon: <CalendarDays /> }]} value={view} onChange={setView} />
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => { setMonth((m) => shift(m, -1)); setSelected(null); }}><ChevronLeft /></Button>
          <span className="w-36 text-center text-sm font-semibold">{new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Next month" onClick={() => { setMonth((m) => shift(m, 1)); setSelected(null); }}><ChevronRight /></Button>
        </div>
        <Select className={cn(inputClass, 'w-52')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-[480px] w-full" />
      ) : q.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load leave')} onRetry={() => q.refetch()} />
      ) : view === 'timeline' ? (
        <Timeline keys={keys} leaves={q.data?.leaves ?? []} holidays={holidays} today={todayKey} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <Card className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground">
              {HEAD.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
              {keys.map((k) => {
                const list = byDay.get(k) ?? [];
                const holiday = holidays.get(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelected(k)}
                    className={cn(
                      'm-pop flex min-h-[76px] flex-col gap-0.5 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:border-border sm:min-h-[96px]',
                      isWeekend(k) && 'bg-muted/50',
                      holiday && 'bg-primary-soft/60',
                      selected === k && 'border-primary ring-1 ring-primary',
                    )}
                    style={{ animationDelay: `${Number(k.slice(8)) * 10}ms` }}
                    aria-label={`${k}: ${list.length} off${holiday ? `, ${holiday.name}` : ''}`}
                  >
                    <span className={cn('text-xs font-semibold tabular-nums', k === todayKey && 'text-primary')}>{Number(k.slice(8))}</span>
                    {holiday && <span className="truncate text-[10px] font-medium text-primary-soft-foreground">{holiday.name}</span>}
                    {list.slice(0, 3).map((l) => (
                      <span
                        key={l.id}
                        className={cn('truncate rounded px-1 text-[10px] font-medium leading-4 text-white', l.status === 'PENDING' && 'opacity-60 ring-1 ring-inset ring-white/60')}
                        style={{ backgroundColor: l.leaveType.color }}
                        title={`${l.employee.firstName} ${l.employee.lastName} · ${l.leaveType.name}${l.status === 'PENDING' ? ' (pending)' : ''}`}
                      >
                        {l.employee.firstName}
                      </span>
                    ))}
                    {list.length > 3 && <span className="text-[10px] text-muted-foreground">+{list.length - 3} more</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Faded chips are waiting for approval.</p>
          </Card>

          <Card className="p-4">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <CalendarRange className="h-5 w-5" />
                Pick a day to see who’s off.
                <span className="text-xs">{q.data?.leaves.length ?? 0} leave request{q.data?.leaves.length === 1 ? '' : 's'} this month</span>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold">{new Date(`${selected}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</p>
                {holidays.get(selected) && <p className="mt-1 text-xs text-primary">{holidays.get(selected)!.name}</p>}
                {!dayList.length ? (
                  <p className="mt-4 text-sm text-muted-foreground">Nobody is off.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {dayList.map((l) => (
                      <li key={l.id} className="flex items-start gap-2.5 text-sm">
                        <PersonAvatar person={l.employee} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium">{l.employee.firstName} {l.employee.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.leaveType.name} · {leaveRange(l)} · {days(l.totalDays)}
                            {l.status === 'PENDING' && ' · pending'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/** Who is away today, with counts for this week and next. */
function AwayToday({ leaves, holidays }: { leaves: LeaveRequest[]; holidays: Array<{ date: string; name: string; isOptional: boolean }> }) {
  const today = new Date().toISOString().slice(0, 10);
  const now = leaves.filter((l) => l.startDate <= today && l.endDate >= today && l.status === 'APPROVED');
  const monday = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const plus = (k: string, n: number) => {
    const d = new Date(`${k}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const count = (s: string, e: string) => new Set(leaves.filter((l) => l.startDate <= e && l.endDate >= s).map((l) => l.employee.id)).size;
  const nextHoliday = holidays.filter((h) => !h.isOptional && h.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const back = (l: LeaveRequest) => {
    if (l.endDate === today) return 'back tomorrow';
    return `back ${new Date(`${plus(l.endDate, 1)}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  };
  return (
    <section className="flex flex-wrap items-center gap-5 rounded-2xl bg-gradient-to-r from-pink-900 via-pink-800 to-rose-700 p-5 text-white shadow-card">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-200">Away today · {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        {!now.length ? (
          <p className="mt-2 text-lg font-semibold">Everyone is in today <Emoji e="🙌" play="appear" /></p>
        ) : (
          <ul className="m-stagger mt-3 flex flex-wrap gap-4">
            {now.slice(0, 5).map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <PersonAvatar person={l.employee} size="md" className="border-2 border-white/40" />
                <span>
                  <b className="block text-sm">{l.employee.firstName}</b>
                  <span className="text-xs text-white/80">{l.leaveType.name} · {back(l)}</span>
                </span>
              </li>
            ))}
            {now.length > 5 && <li className="self-center text-sm text-white/80">+{now.length - 5} more</li>}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        {[
          ['Off this week', String(count(monday, plus(monday, 4)))],
          ['Off next week', String(count(plus(monday, 7), plus(monday, 11)))],
          ['Next holiday', nextHoliday ? `${nextHoliday.name} · ${new Date(`${nextHoliday.date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : '—'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-white/15 px-3 py-2">
            <p className="text-[10.5px] font-semibold text-white/75">{l}</p>
            <p className="max-w-[160px] truncate text-sm font-bold">{v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** People × days: one bar per leave, pending dashed; a "team in" row at the bottom. */
function Timeline({ keys, leaves, holidays, today }: { keys: string[]; leaves: LeaveRequest[]; holidays: Map<string, { name: string }>; today: string }) {
  const people = useMemo(() => {
    const m = new Map<string, { employee: LeaveRequest['employee']; items: LeaveRequest[] }>();
    for (const l of leaves) {
      const row = m.get(l.employee.id) ?? { employee: l.employee, items: [] };
      row.items.push(l);
      m.set(l.employee.id, row);
    }
    return [...m.values()].sort((a, b) => a.items[0]!.startDate.localeCompare(b.items[0]!.startDate));
  }, [leaves]);
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  const n = keys.length;
  const idx = (k: string) => Math.max(0, Math.min(n - 1, Math.round((Date.parse(`${k}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000)));
  const awayOn = (k: string) => new Set(leaves.filter((l) => l.startDate <= k && l.endDate >= k && l.status === 'APPROVED').map((l) => l.employee.id)).size;
  const maxAway = Math.max(1, ...keys.map(awayOn));
  if (!people.length) return <Card><EmptyState icon={<CalendarRange />} title="Nobody is off this month" description="Approved and pending leave shows up here as bars." /></Card>;
  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid items-end" style={{ gridTemplateColumns: `180px repeat(${n}, minmax(18px, 1fr))` }}>
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Person</span>
            {keys.map((k) => (
              <span key={k} title={holidays.get(k)?.name} className={cn('mx-px rounded py-0.5 text-center text-[10px] font-semibold tabular-nums', k === today ? 'bg-primary text-primary-foreground' : holidays.has(k) ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300' : isWeekend(k) ? 'text-muted-foreground/50' : 'text-muted-foreground')}>
                {Number(k.slice(8))}
              </span>
            ))}
          </div>
          <ul className="mt-1">
            {people.map((p, r) => (
              <li key={p.employee.id} className="grid items-center border-b border-border/60" style={{ gridTemplateColumns: `180px 1fr` }}>
                <span className="flex items-center gap-2 py-1.5 text-sm">
                  <PersonAvatar person={p.employee} size="xs" />
                  <span className="truncate font-medium">{p.employee.firstName} {p.employee.lastName}</span>
                </span>
                <span className="relative h-7">
                  {keys.map((k, i) => isWeekend(k) && <span key={k} className="absolute inset-y-0 bg-muted/50" style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }} />)}
                  {p.items.map((l) => {
                    const a = idx(l.startDate < first ? first : l.startDate);
                    const b = idx(l.endDate > last ? last : l.endDate);
                    return (
                      <span
                        key={l.id}
                        title={`${l.leaveType.name} · ${leaveRange(l)}${l.status === 'PENDING' ? ' · waiting for approval' : ''}`}
                        className={cn('m-fill-w absolute top-1 flex h-5 items-center overflow-hidden whitespace-nowrap rounded-md border-[1.5px] px-1.5 text-[10px] font-bold', l.status === 'PENDING' && 'border-dashed bg-surface')}
                        style={{ left: `${(a / n) * 100}%`, width: `${((b - a + 1) / n) * 100}%`, borderColor: l.leaveType.color, color: l.leaveType.color, background: l.status === 'PENDING' ? undefined : `color-mix(in srgb, ${l.leaveType.color} 16%, transparent)`, animationDelay: `${r * 60}ms` }}
                      >
                        {l.leaveType.name}{l.status === 'PENDING' ? ' · pending' : ''}
                      </span>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid items-end" style={{ gridTemplateColumns: `180px repeat(${n}, minmax(18px, 1fr))` }}>
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Away that day</span>
            {keys.map((k) => {
              const a = awayOn(k);
              return (
                <span key={k} className="flex h-8 items-end justify-center" title={`${a} away`}>
                  {!isWeekend(k) && <span className={cn('m-grow-y w-3/5 rounded-t', a === 0 ? 'bg-success/40' : a >= maxAway * 0.75 ? 'bg-warning' : 'bg-primary/60')} style={{ height: `${Math.max(12, (a / maxAway) * 100)}%` }} />}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Dashed bars are waiting for approval. The bottom row shows how many people are away each working day.</p>
    </Card>
  );
}

/** All-day events for approved leave in the month, made in the browser. */
function downloadIcs(leaves: LeaveRequest[], month: string) {
  const day = (k: string) => k.replace(/-/g, '');
  const next = (k: string) => {
    const d = new Date(`${k}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HRMS Portal//Whos off//EN'];
  for (const l of leaves.filter((x) => x.status === 'APPROVED')) {
    lines.push('BEGIN:VEVENT', `UID:${l.id}@hrms`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${day(l.startDate)}`, `DTEND;VALUE=DATE:${next(l.endDate)}`, `SUMMARY:${l.employee.firstName} ${l.employee.lastName} — ${l.leaveType.name}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `whos-off-${month}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
