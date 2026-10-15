'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Layers, Moon, Pencil, Plus, Save, Search, ShieldCheck, Trash2, Users, Wifi } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { ColorInput, Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { useEmployees } from '@/lib/company/org';
import {
  STATUS_META,
  WEEKDAY_NAMES,
  useDeleteShift,
  usePolicy,
  useSavePolicy,
  useSaveShift,
  useShiftMembers,
  useShifts,
  type AttendancePolicy,
  type DayStatus,
  type ShiftsList,
} from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Form = Omit<AttendancePolicy, 'timeZone' | 'halfDayMinutes' | 'fullDayMinutes'> & { halfDayHours: string; fullDayHours: string };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;

export default function AttendanceSettingsPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('time.attendance') && can('attendance.policy');
  const policy = usePolicy(allowed);
  const save = useSavePolicy();
  const [tab, setTab] = useState<'rules' | 'shifts'>('rules');
  const [f, setF] = useState<Form | null>(null);

  useEffect(() => {
    const p = policy.data;
    if (!p) return;
    setF({
      workDays: p.workDays,
      shiftStart: p.shiftStart,
      shiftEnd: p.shiftEnd,
      graceMinutes: p.graceMinutes,
      halfDayHours: String(p.halfDayMinutes / 60),
      fullDayHours: String(p.fullDayMinutes / 60),
      regularisationWindowDays: p.regularisationWindowDays,
      webCheckInEnabled: p.webCheckInEnabled,
      correctionAlertAt: p.correctionAlertAt,
      lateAlertAt: p.lateAlertAt,
      autoCloseAfterMinutes: p.autoCloseAfterMinutes,
      optionalHolidayLimit: p.optionalHolidayLimit,
    });
  }, [policy.data]);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You can’t change attendance settings." />;
  if (policy.isLoading || !f) return policy.isLoadingError ? <ErrorState message={getApiErrorMessage(policy.error)} onRetry={() => policy.refetch()} /> : <Skeleton className="h-96 w-full" />;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((prev) => (prev ? { ...prev, [key]: value } : prev));
  const toggleDay = (d: number) => set('workDays', f.workDays.includes(d) ? f.workDays.filter((x) => x !== d) : [...f.workDays, d].sort());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        workDays: f.workDays,
        shiftStart: f.shiftStart,
        shiftEnd: f.shiftEnd,
        graceMinutes: Number(f.graceMinutes),
        halfDayMinutes: Math.round(Number(f.halfDayHours) * 60),
        fullDayMinutes: Math.round(Number(f.fullDayHours) * 60),
        regularisationWindowDays: Number(f.regularisationWindowDays),
        webCheckInEnabled: f.webCheckInEnabled,
        correctionAlertAt: Number(f.correctionAlertAt),
        lateAlertAt: f.lateAlertAt === null ? null : Number(f.lateAlertAt),
        autoCloseAfterMinutes: f.autoCloseAfterMinutes === null ? null : Number(f.autoCloseAfterMinutes),
        optionalHolidayLimit: Number(f.optionalHolidayLimit),
      });
      toast.success('Attendance settings saved');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save settings'));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Attendance settings"
        description={`Rules for the whole company. Times are in ${policy.data!.timeZone.replace(/_/g, ' ')}.`}
        action={tab === 'rules' && <Button type="submit" loading={save.isPending}><Save /> Save changes</Button>}
      />
      <Tabs tabs={[{ id: 'rules' as const, label: 'Shift & day rules', icon: <Clock /> }, { id: 'shifts' as const, label: 'Shifts', icon: <Layers /> }]} value={tab} onChange={setTab} />

      {tab === 'shifts' ? (
        <ShiftsTab general={{ start: f.shiftStart, end: f.shiftEnd }} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <Card>
              <CardHeader icon={<Clock />} title="Your working day" description="Drag the ends of the shift (15-minute steps), or type the times below." />
              <div className="space-y-5 px-5 pb-5">
                <ShiftBar start={f.shiftStart} end={f.shiftEnd} grace={Number(f.graceMinutes)} onChange={(s, e) => setF((p) => (p ? { ...p, shiftStart: s, shiftEnd: e } : p))} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Shift starts" htmlFor="pol-start">
                    <Input id="pol-start" type="time" value={f.shiftStart} onChange={(e) => set('shiftStart', e.target.value)} required />
                  </Field>
                  <Field label="Shift ends" htmlFor="pol-end">
                    <Input id="pol-end" type="time" value={f.shiftEnd} onChange={(e) => set('shiftEnd', e.target.value)} required />
                  </Field>
                  <Field label="Grace period (minutes)" htmlFor="pol-grace" hint="Check-ins within this are not late">
                    <Input id="pol-grace" type="number" min={0} max={240} value={f.graceMinutes} onChange={(e) => set('graceMinutes', Number(e.target.value))} required />
                  </Field>
                </div>
                <Field label="Working days">
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={f.workDays.includes(d)}
                        onClick={() => toggleDay(d)}
                        className={cn('h-9 rounded-full border px-4 text-sm font-medium transition-colors', f.workDays.includes(d) ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-input text-muted-foreground hover:bg-subtle')}
                      >
                        {WEEKDAY_NAMES[d]}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </Card>

            <Card>
              <CardHeader title="How hours become a day" description="Below half a day is Absent; at least a full day is Present." />
              <div className="space-y-4 px-5 pb-5">
                <DayScale half={Number(f.halfDayHours)} full={Number(f.fullDayHours)} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Half day (hours)" htmlFor="pol-half">
                    <Input id="pol-half" type="number" step="0.25" min={0.5} max={24} value={f.halfDayHours} onChange={(e) => set('halfDayHours', e.target.value)} required />
                  </Field>
                  <Field label="Full day (hours)" htmlFor="pol-full">
                    <Input id="pol-full" type="number" step="0.25" min={1} max={24} value={f.fullDayHours} onChange={(e) => set('fullDayHours', e.target.value)} required />
                  </Field>
                  <Field label="Corrections up to (days back)" htmlFor="pol-window">
                    <Input id="pol-window" type="number" min={0} max={365} value={f.regularisationWindowDays} onChange={(e) => set('regularisationWindowDays', Number(e.target.value))} required />
                  </Field>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="More rules" />
              <div className="divide-y divide-border border-t border-border">
                <RuleRow
                  title="Close forgotten check-outs"
                  text="If someone is still checked in this long after their shift ends, close the day for them and mark it “closed automatically”. They can still ask for a correction."
                  on={f.autoCloseAfterMinutes !== null}
                  onToggle={(on) => set('autoCloseAfterMinutes', on ? 120 : null)}
                >
                  <NumberAfter id="pol-auto" value={f.autoCloseAfterMinutes} unit="minutes after the shift" onChange={(v) => set('autoCloseAfterMinutes', v)} min={0} max={720} step={15} />
                </RuleRow>
                <RuleRow title="Late too often" text="Tell the line manager (in-app) when someone is late this many times in a month." on={f.lateAlertAt !== null} onToggle={(on) => set('lateAlertAt', on ? 3 : null)}>
                  <NumberAfter id="pol-late" value={f.lateAlertAt} unit="late arrivals a month" onChange={(v) => set('lateAlertAt', v)} min={1} max={31} />
                </RuleRow>
                <RuleRow title="Many corrections" text="There is no limit on corrections. When someone asks for more than this in a month, their lead, manager and HR get a note.">
                  <NumberAfter id="pol-corr" value={f.correctionAlertAt} unit="corrections a month" onChange={(v) => set('correctionAlertAt', v ?? 8)} min={1} max={31} />
                </RuleRow>
                <RuleRow title="Optional holidays" text="How many optional holidays (festivals, religious days) each person can pick in a year.">
                  <NumberAfter id="pol-opt" value={f.optionalHolidayLimit} unit="per person a year" onChange={(v) => set('optionalHolidayLimit', v ?? 0)} min={0} max={30} />
                </RuleRow>
                <RuleRow title="Web check-in" text="People check in and out from the portal. Turn off if attendance comes only from devices or HR entries." on={f.webCheckInEnabled} onToggle={(on) => set('webCheckInEnabled', on)} />
                <RuleRow title={<span className="inline-flex items-center gap-2"><Wifi className="h-4 w-4" /> Office network only <Badge tone="primary">Coming soon</Badge></span>} text="Allow check-in only from the office Wi-Fi / IP list." />
              </div>
            </Card>
          </div>
          <TryIt f={f} />
        </div>
      )}
    </form>
  );
}

/** The general shift on a 24 h bar: drag either end; grace (green) and late (hatched) zones follow. */
function ShiftBar({ start, end, grace, onChange }: { start: string; end: string; grace: number; onChange: (start: string, end: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<'start' | 'end' | null>(null);
  const s = toMin(start);
  const e = toMin(end);
  const pct = (m: number) => `${(Math.max(0, Math.min(1440, m)) / 1440) * 100}%`;
  const fromX = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.round((((clientX - r.left) / r.width) * 1440) / 15) * 15;
  };
  const move = (ev: React.PointerEvent) => {
    if (!drag) return;
    const m = Math.max(0, Math.min(1440 - 15, fromX(ev.clientX)));
    if (drag === 'start' && m < e - 60) onChange(toTime(m), end);
    if (drag === 'end' && m > s + 60) onChange(start, toTime(m));
  };
  const handle = (which: 'start' | 'end', at: number, label: string) => (
    <button
      type="button"
      aria-label={`Drag to change the shift ${which}`}
      onPointerDown={(ev) => { (ev.target as HTMLElement).setPointerCapture(ev.pointerId); setDrag(which); }}
      onKeyDown={(ev) => {
        const by = ev.key === 'ArrowLeft' ? -15 : ev.key === 'ArrowRight' ? 15 : 0;
        if (!by) return;
        ev.preventDefault();
        if (which === 'start' && s + by < e - 60 && s + by >= 0) onChange(toTime(s + by), end);
        if (which === 'end' && e + by > s + 60 && e + by < 1440) onChange(start, toTime(e + by));
      }}
      className="absolute top-1/2 z-10 h-8 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-md bg-surface shadow-md ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ left: pct(at) }}
    >
      <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-surface px-1.5 text-[10px] font-bold tabular-nums text-primary">{label}</span>
    </button>
  );
  return (
    <div className="pt-6">
      <div ref={ref} onPointerMove={move} onPointerUp={() => setDrag(null)} className="relative h-12 select-none rounded-xl border border-border bg-muted/60">
        <span className="absolute inset-y-0 bg-success/25" style={{ left: pct(s), width: `calc(${pct(s + grace)} - ${pct(s)})` }} title="Grace" />
        <span className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,hsl(var(--warning)/0.25)_0_4px,transparent_4px_8px)]" style={{ left: pct(s + grace), width: `calc(${pct(Math.min(e, s + grace + 240))} - ${pct(s + grace)})` }} title="Late" />
        <span className="m-fill-w absolute inset-y-2.5 flex items-center justify-center rounded-lg bg-gradient-to-r from-primary to-indigo-500 text-xs font-semibold text-primary-foreground shadow" style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)})` }}>
          General shift · {Math.round(((e - s) / 60) * 10) / 10} h
        </span>
        {handle('start', s, start)}
        {handle('end', e, end)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold tabular-nums text-muted-foreground">
        {['00', '04', '08', '12', '16', '20', '24'].map((h) => <span key={h}>{h}</span>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary" /> Shift</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-success/40" /> Grace {grace} min</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[repeating-linear-gradient(45deg,hsl(var(--warning)/0.5)_0_3px,transparent_3px_6px)]" /> Late after {toTime(s + grace)}</span>
      </div>
    </div>
  );
}

function DayScale({ half, full }: { half: number; full: number }) {
  const top = Math.max(full * 1.3, full + 2);
  const w = (h: number) => `${(Math.max(0, h) / top) * 100}%`;
  return (
    <div className="flex h-12 overflow-hidden rounded-xl text-xs">
      <div className="m-fill-w flex flex-col justify-center bg-destructive-soft px-3" style={{ width: w(half) }}><b className="text-destructive">Absent</b><span className="text-muted-foreground">under {half} h</span></div>
      <div className="m-fill-w flex flex-col justify-center border-x-2 border-surface bg-warning-soft px-3" style={{ width: w(full - half) }}><b className="text-warning">Half day</b><span className="text-muted-foreground">{half}–{full} h</span></div>
      <div className="m-fill-w flex flex-1 flex-col justify-center bg-success-soft px-3"><b className="text-success">Present</b><span className="text-muted-foreground">{full} h +</span></div>
    </div>
  );
}

function RuleRow({ title, text, on, onToggle, children }: { title: React.ReactNode; text: string; on?: boolean; onToggle?: (on: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
        {children && (on === undefined || on) && <div className="mt-2">{children}</div>}
      </div>
      {onToggle && (
        <button type="button" role="switch" aria-checked={on} onClick={() => onToggle(!on)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-muted-foreground/30')}>
          <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]', on ? 'left-[22px]' : 'left-0.5')} />
        </button>
      )}
    </div>
  );
}

function NumberAfter({ id, value, unit, onChange, min, max, step = 1 }: { id: string; value: number | null; unit: string; onChange: (v: number | null) => void; min: number; max: number; step?: number }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm">
      <Input id={id} type="number" className="w-24" min={min} max={max} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      <span className="text-muted-foreground">{unit}</span>
    </label>
  );
}

/** What the rules do to a few sample days — before saving. */
function TryIt({ f }: { f: Form }) {
  const [samples, setSamples] = useState<Array<{ in: string; out: string }>>([]);
  const start = toMin(f.shiftStart);
  const end = toMin(f.shiftEnd);
  const grace = Number(f.graceMinutes);
  const half = Number(f.halfDayHours) * 60;
  const full = Number(f.fullDayHours) * 60;
  useEffect(() => {
    setSamples([
      { in: toTime(start + Math.max(0, grace - 5)), out: toTime(end + 5) },
      { in: toTime(start + grace + 7), out: toTime(end + 10) },
      { in: toTime(start + 30), out: toTime(start + 30 + Math.round((half + full) / 2)) },
      { in: toTime(start), out: '' },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const judge = (s: { in: string; out: string }): { status: DayStatus; text: string } => {
    const a = toMin(s.in);
    const late = Math.max(0, a - (start + grace));
    if (!s.out) {
      return f.autoCloseAfterMinutes === null
        ? { status: 'MISSING_CHECKOUT', text: 'Missing check-out' }
        : { status: 'MISSING_CHECKOUT', text: `Closed at ${toTime(end + f.autoCloseAfterMinutes)} · missing check-out` };
    }
    const worked = toMin(s.out) - a;
    const status: DayStatus = worked >= full ? 'PRESENT' : worked >= half ? 'HALF_DAY' : 'ABSENT';
    return { status, text: `${STATUS_META[status].label}${late ? ` · late ${late} min` : status === 'PRESENT' ? ' · on time' : ''} · ${Math.floor(worked / 60)}h ${worked % 60}m` };
  };
  const tone = useMemo(() => ({ PRESENT: 'success', HALF_DAY: 'warning', ABSENT: 'danger', MISSING_CHECKOUT: 'outline' }) as Record<string, 'success' | 'warning' | 'danger' | 'outline'>, []);
  return (
    <Card className="h-max p-4 xl:sticky xl:top-20">
      <p className="text-sm font-semibold">Try it</p>
      <p className="text-xs text-muted-foreground">Change the times to see what your rules do — nothing is saved here.</p>
      <ul className="mt-3 space-y-2">
        {samples.map((s, i) => {
          const r = judge(s);
          return (
            <li key={i} className="space-y-1.5 rounded-lg bg-subtle/70 p-2.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">In</span>
                <Input type="time" aria-label="Check in" className="h-7 w-[96px] px-2 text-xs" value={s.in} onChange={(e) => setSamples((x) => x.map((y, j) => (j === i ? { ...y, in: e.target.value } : y)))} />
                <span className="text-muted-foreground">Out</span>
                <Input type="time" aria-label="Check out" className="h-7 w-[96px] px-2 text-xs" value={s.out} onChange={(e) => setSamples((x) => x.map((y, j) => (j === i ? { ...y, out: e.target.value } : y)))} />
              </div>
              <Badge tone={tone[r.status] ?? 'outline'} dot>{r.text}</Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Extra shifts (e.g. Night) and who is on them. */
function ShiftsTab({ general }: { general: { start: string; end: string } }) {
  const shifts = useShifts();
  const remove = useDeleteShift();
  const [editing, setEditing] = useState<ShiftsList['shifts'][number] | 'new' | null>(null);
  const [members, setMembers] = useState<ShiftsList['shifts'][number] | null>(null);
  const [deleting, setDeleting] = useState<ShiftsList['shifts'][number] | null>(null);
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  const bar = (start: string, end: string, color: string) => {
    const s = toMin(start);
    const e = toMin(end);
    const parts = e > s ? [[s, e]] : [[s, 1440], [0, e]];
    return (
      <div className="relative h-3 rounded-full bg-muted">
        {parts.map(([a, b], i) => <span key={i} className="m-fill-w absolute inset-y-0 rounded-full" style={{ left: pct(a!), width: pct(b! - a!), background: color }} />)}
      </div>
    );
  };
  if (shifts.isLoading) return <Skeleton className="h-60 w-full" />;
  const list = shifts.data?.shifts ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Everyone works the general shift unless you put them on another one. A shift that ends before it starts runs past midnight.</p>
        <Button type="button" onClick={() => setEditing('new')}><Plus /> Add shift</Button>
      </div>
      <div className="m-stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between"><p className="font-semibold">General</p><Badge>Default</Badge></div>
          <p className="text-sm text-muted-foreground">{general.start}–{general.end} · everyone else</p>
          <div className="mt-3">{bar(general.start, general.end, 'hsl(var(--primary))')}</div>
        </Card>
        {list.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              <p className="flex-1 font-semibold">{s.name}</p>
              {s.overnight && <Badge tone="primary"><Moon className="h-3 w-3" /> Overnight</Badge>}
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil /></Button>
              <Button type="button" size="icon-sm" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}><Trash2 /></Button>
            </div>
            <p className="text-sm text-muted-foreground">{s.startTime}–{s.endTime} · {s.memberCount} {s.memberCount === 1 ? 'person' : 'people'}</p>
            <div className="mt-3">{bar(s.startTime, s.endTime, s.color)}</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex">{s.employees.slice(0, 6).map((e) => <PersonAvatar key={e.id} person={e} size="xs" className="-ml-1.5 border-2 border-surface first:ml-0" />)}</div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setMembers(s)}><Users /> People</Button>
            </div>
          </Card>
        ))}
      </div>
      {!list.length && <EmptyState icon={<Moon />} title="No other shifts yet" description="Add a Night shift (e.g. 21:00–06:00) and put the people who work it on it — lateness and forgotten check-outs then follow their hours." />}
      {editing && <ShiftDialog shift={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {members && <MembersDialog shift={members} onClose={() => setMembers(null)} />}
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete the ${deleting?.name} shift?`}
        description="Its people go back to the general shift."
        confirmText="Delete"
        isDanger
        isLoading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id);
            toast.success('Shift deleted');
            setDeleting(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete'));
          }
        }}
      />
    </div>
  );
}

function ShiftDialog({ shift, onClose }: { shift: ShiftsList['shifts'][number] | null; onClose: () => void }) {
  const save = useSaveShift();
  const [f, setF] = useState({ name: shift?.name ?? 'Night', startTime: shift?.startTime ?? '21:00', endTime: shift?.endTime ?? '06:00', color: shift?.color ?? '#7C3AED' });
  const submit = async () => {
    try {
      await save.mutateAsync({ id: shift?.id, ...f });
      toast.success(shift ? 'Shift saved' : `${f.name} shift added`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the shift'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Layers />}
      title={shift ? `Edit ${shift.name}` : 'Add a shift'}
      description="An end time before the start means the shift runs past midnight."
      size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="sh-name" className="sm:col-span-2"><Input id="sh-name" value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Starts" htmlFor="sh-start"><Input id="sh-start" type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field>
        <Field label="Ends" htmlFor="sh-end"><Input id="sh-end" type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field>
        <Field label="Colour" htmlFor="sh-color"><ColorInput id="sh-color" value={f.color} onChange={(v) => setF({ ...f, color: v })} /></Field>
      </div>
    </Modal>
  );
}

function MembersDialog({ shift, onClose }: { shift: ShiftsList['shifts'][number]; onClose: () => void }) {
  const save = useShiftMembers();
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState(() => new Map(shift.employees.map((e) => [e.id, e])));
  const people = useEmployees({ search: search.trim() || undefined, stage: 'current', limit: 20, sort: 'name' });
  const rows = people.data?.data ?? [];
  const submit = async () => {
    try {
      await save.mutateAsync({ id: shift.id, employeeIds: [...chosen.keys()] });
      toast.success(`${chosen.size} ${chosen.size === 1 ? 'person' : 'people'} on the ${shift.name} shift`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Users />}
      title={`People on the ${shift.name} shift`}
      description="Tick everyone who works this shift. Others stay on the general shift."
      size="md"
      footer={<><span className="mr-auto text-sm text-muted-foreground">{chosen.size} chosen</span><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save</Button></>}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search people" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search people" />
      </div>
      <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {rows.map((e) => (
          <li key={e.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-subtle/60">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                checked={chosen.has(e.id)}
                onChange={() => setChosen((m) => {
                  const n = new Map(m);
                  if (n.has(e.id)) n.delete(e.id);
                  else n.set(e.id, { id: e.id, firstName: e.firstName, lastName: e.lastName, avatarUrl: e.avatarUrl ?? null, employeeId: e.employeeId });
                  return n;
                })}
              />
              <PersonAvatar person={e} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.firstName} {e.lastName}</span>
              <span className="text-xs text-muted-foreground">{e.employeeId}</span>
            </label>
          </li>
        ))}
        {!rows.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{people.isLoading ? 'Loading…' : 'No one found'}</li>}
      </ul>
    </Modal>
  );
}
