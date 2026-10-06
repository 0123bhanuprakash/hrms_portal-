'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import { toast } from 'sonner';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Download, Lightbulb, List, MapPin, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Input, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FlipDigits, daysBetween } from '@/components/time/visuals';
import { useAccess } from '@/lib/access/use-access';
import { useLocations } from '@/lib/company/org';
import { useChooseHoliday, useDeleteHoliday, useHolidays, useImportHolidays, usePolicy, useSaveHoliday, type Holiday } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { DateInput } from '@/components/ui/pickers';

const ART: Array<[RegExp, string]> = [
  [/diwali|deepavali/i, '🪔'], [/holi/i, '🎨'], [/christmas/i, '🎄'], [/new year/i, '🎆'], [/republic|independence/i, '🎖️'], [/gandhi/i, '🕊️'],
  [/dussehra|dasara|vijaya/i, '🏹'], [/ganesh|ganapati/i, '🐘'], [/eid|ramzan|bakri|muharram/i, '🌙'], [/good friday|easter/i, '✝️'], [/onam/i, '🌸'],
  [/pongal|sankranti|lohri/i, '🪁'], [/labour|may day/i, '🛠️'], [/guru nanak|gurpurab/i, '🙏'], [/rajyotsava|maharashtra|formation/i, '🏳️'],
];
const artOf = (name: string) => ART.find(([re]) => re.test(name))?.[1] ?? '🎉';
const todayKey = () => new Date().toISOString().slice(0, 10);
const weekday = (k: string) => new Date(`${k}T00:00:00Z`).getUTCDay();
const fmt = (k: string, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${k}T00:00:00Z`).toLocaleDateString(undefined, { ...o, timeZone: 'UTC' });

export default function HolidaysPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [view, setView] = useState<'year' | 'list'>('year');
  const [mine, setMine] = useState(false);
  const allowed = hasFeature('time.attendance') && can('attendance.view');
  const holidays = useHolidays(year, allowed);
  const nextYear = useHolidays(year + 1, allowed);
  const policy = usePolicy(allowed);
  const locations = useLocations();
  const remove = useDeleteHoliday();
  const importList = useImportHolidays();
  const [editing, setEditing] = useState<Holiday | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Holiday | null>(null);
  const canManage = can('holiday.manage');

  const all = useMemo(() => holidays.data ?? [], [holidays.data]);
  const forMe = (h: Holiday) => (h.isOptional ? Boolean(h.chosen) : h.appliesToMe !== false);
  const shown = mine ? all.filter(forMe) : all;
  const locName = new Map((locations.data ?? []).map((l) => [l.id, l.name]));
  const upcoming = [...all, ...(nextYear.data ?? [])].filter((h) => h.date >= todayKey() && forMe(h));
  const next = upcoming[0];

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="The holiday calendar isn’t available to you." />;

  const doImport = async () => {
    try {
      const r = await importList.mutateAsync(year + 1);
      toast.success(r.added ? `Added ${r.added} holidays for ${year + 1}` : `${year + 1} already has these holidays`);
      setYear(year + 1);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not import'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Holiday calendar"
        description={`Company holidays · ${year}. They count as days off in attendance and leave.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadIcs(all.filter(forMe), year)} disabled={!all.length}><Download /> Add to my calendar</Button>
            {canManage && <Button variant="secondary" onClick={doImport} loading={importList.isPending}><CalendarPlus /> Import {year + 1}</Button>}
            {canManage && <Button onClick={() => setEditing('new')}><Plus /> Add holiday</Button>}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        {next ? <NextHoliday h={next} all={upcoming} /> : <Card className="flex items-center p-6 text-sm text-muted-foreground">No more holidays on the calendar this year.</Card>}
        <OptionalCard list={all.filter((h) => h.isOptional && h.appliesToMe !== false)} limit={policy.data?.optionalHolidayLimit ?? 5} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs className="flex-1" tabs={[{ id: 'year' as const, label: 'Year', icon: <CalendarDays /> }, { id: 'list' as const, label: 'List', icon: <List /> }]} value={view} onChange={setView} />
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}><ChevronLeft /></Button>
          <span className="w-14 text-center text-base font-semibold tabular-nums">{year}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Next year" onClick={() => setYear((y) => y + 1)}><ChevronRight /></Button>
        </div>
        <button type="button" aria-pressed={mine} onClick={() => setMine((m) => !m)} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium', mine ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border text-muted-foreground hover:bg-subtle')}>
          <MapPin className="h-3.5 w-3.5" /> Only my days off
        </button>
      </div>

      {holidays.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : holidays.isError ? (
        <ErrorState message={getApiErrorMessage(holidays.error, 'Could not load holidays')} onRetry={() => holidays.refetch()} />
      ) : !all.length ? (
        <Card>
          <EmptyState
            icon={<CalendarDays />}
            title={`No holidays for ${year}`}
            description={canManage ? 'Add holidays one by one, or import the national list.' : undefined}
            action={canManage && <Button onClick={() => setEditing('new')}><Plus /> Add holiday</Button>}
          />
        </Card>
      ) : view === 'year' ? (
        <YearView year={year} list={shown} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {shown.map((h) => {
              const past = h.date < todayKey();
              return (
                <li key={h.id} className={cn('flex items-center gap-4 px-5 py-3', past && 'opacity-60')}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-subtle text-xl"><Emoji e={artOf(h.name)} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {h.name}
                      {h.isOptional && <Badge tone="primary">{h.chosen ? 'Optional · picked' : 'Optional'}</Badge>}
                      {h.locationIds.map((id) => <Badge key={id} tone="info"><MapPin className="h-3 w-3" />{locName.get(id) ?? 'Office'}</Badge>)}
                    </p>
                    <p className="text-sm text-muted-foreground">{fmt(h.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${h.name}`} onClick={() => setEditing(h)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${h.name}`} onClick={() => setDeleting(h)}><Trash2 /></Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <HolidayDialog holiday={editing} year={year} onClose={() => setEditing(null)} />
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete holiday?"
        description={deleting ? `“${deleting.name}” will be removed. Past attendance for that day will show as a normal working day.` : ''}
        confirmText="Delete"
        isDanger
        isLoading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Holiday deleted');
            setDeleting(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete'));
          }
        }}
      />
    </div>
  );
}

/** Countdown to the next day off, with a long-weekend tip. */
function NextHoliday({ h, all }: { h: Holiday; all: Holiday[] }) {
  const left = daysBetween(todayKey(), h.date);
  const wd = weekday(h.date);
  const tip = wd === 4 ? { day: 'Friday', total: 4 } : wd === 2 ? { day: 'Monday', total: 4 } : wd === 5 || wd === 1 ? { day: null, total: 3 } : null;
  const after = all[1];
  return (
    <section className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-900 via-orange-800 to-orange-600 p-6 text-white shadow-card">
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Next holiday</p>
        <p className="text-3xl font-bold tracking-tight">{h.name}</p>
        <p className="text-sm text-white/80">{fmt(h.date, { weekday: 'long', day: 'numeric', month: 'long' })}{h.isOptional ? ' · your optional pick' : ''}</p>
        <div className="flex items-center gap-3 pt-1">
          {left === 0 ? <span className="text-xl font-bold">Today! <Emoji e="🎉" play="appear" /></span> : <><FlipDigits value={left} tileClass="bg-white text-orange-800" /><span className="text-sm font-semibold text-white/85">day{left === 1 ? '' : 's'} to go</span></>}
        </div>
        {tip && (
          <p className="inline-flex items-start gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs">
            <Lightbulb className="h-3.5 w-3.5 shrink-0" />
            {tip.day ? <>Take {tip.day} off → <b>{tip.total}-day weekend</b>.</> : <>A <b>3-day weekend</b> — no leave needed.</>}
          </p>
        )}
        {after && <p className="text-xs text-white/70">Then {after.name} · {fmt(after.date)}</p>}
      </div>
      <span aria-hidden className="tm-sway text-7xl drop-shadow-xl sm:text-8xl">{artOf(h.name)}</span>
    </section>
  );
}

/** Pick N of the optional holidays (a company setting). */
function OptionalCard({ list, limit }: { list: Holiday[]; limit: number }) {
  const choose = useChooseHoliday();
  const picked = list.filter((h) => h.chosen).length;
  const toggle = async (h: Holiday) => {
    try {
      await choose.mutateAsync({ id: h.id, choose: !h.chosen });
      toast.success(h.chosen ? `${h.name} removed` : `${h.name} is a day off for you`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not change your pick'));
    }
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Optional holidays</h2>
        <Badge tone="primary">{picked} of {limit} picked</Badge>
      </div>
      {!list.length ? (
        <p className="mt-3 text-sm text-muted-foreground">No optional holidays this year.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {list.map((h) => {
            const full = !h.chosen && picked >= limit;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => void toggle(h)}
                  disabled={choose.isPending || full || h.date < todayKey()}
                  aria-pressed={Boolean(h.chosen)}
                  className={cn('flex w-full items-center gap-3 rounded-lg border-[1.5px] px-3 py-2 text-left text-sm transition-colors disabled:opacity-50', h.chosen ? 'border-primary bg-primary-soft/60' : 'border-border hover:bg-subtle')}
                >
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold', h.chosen ? 'm-pop border-primary bg-primary text-primary-foreground' : 'border-border')}>{h.chosen ? '✓' : ''}</span>
                  <span className="text-base"><Emoji e={artOf(h.name)} /></span>
                  <span className="flex-1 font-medium">{h.name}</span>
                  <span className="text-xs text-muted-foreground">{fmt(h.date)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Each person picks up to {limit}. A picked day is a holiday for you only — no leave needed.</p>
    </Card>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function YearView({ year, list }: { year: number; list: Holiday[] }) {
  const byDate = new Map(list.map((h) => [h.date, h]));
  const today = todayKey();
  return (
    <Card className="p-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {MONTHS.map((m, mi) => {
          const lead = (new Date(Date.UTC(year, mi, 1)).getUTCDay() + 6) % 7;
          const len = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
          const current = today.slice(0, 7) === `${year}-${String(mi + 1).padStart(2, '0')}`;
          return (
            <div key={m}>
              <p className={cn('mb-1.5 text-xs font-semibold', current ? 'text-primary' : 'text-foreground')}>{m}</p>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: len }, (_, d) => {
                  const key = `${year}-${String(mi + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
                  const h = byDate.get(key);
                  const wd = weekday(key);
                  return (
                    <span
                      key={key}
                      title={h ? `${h.name}${h.isOptional ? ' (optional)' : ''}` : undefined}
                      className={cn(
                        'flex aspect-square items-center justify-center rounded text-[10px] tabular-nums',
                        h ? cn('m-pop text-sm', h.isOptional ? 'bg-violet-500/15 ring-1 ring-inset ring-violet-400' : h.locationIds.length ? 'bg-info-soft ring-1 ring-inset ring-info/60' : 'bg-orange-500/15 ring-1 ring-inset ring-orange-400') : wd === 0 || wd === 6 ? 'text-muted-foreground/60' : 'bg-subtle/70 text-muted-foreground',
                        key === today && 'ring-2 ring-primary',
                      )}
                    >
                      {h ? artOf(h.name) : d + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-orange-500/20 ring-1 ring-orange-400" /> Everyone</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violet-500/15 ring-1 ring-violet-400" /> Optional</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-info-soft ring-1 ring-info/60" /> One office</span>
      </div>
    </Card>
  );
}

/** All-day events for a calendar app, made in the browser. */
function downloadIcs(list: Holiday[], year: number) {
  const day = (k: string) => k.replace(/-/g, '');
  const next = (k: string) => {
    const d = new Date(`${k}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  };
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HRMS Portal//Holidays//EN', 'CALSCALE:GREGORIAN'];
  for (const h of list) lines.push('BEGIN:VEVENT', `UID:${h.id}@hrms`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${day(h.date)}`, `DTEND;VALUE=DATE:${next(h.date)}`, `SUMMARY:${esc(h.name)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  lines.push('END:VCALENDAR');
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `holidays-${year}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function HolidayDialog({ holiday, year, onClose }: { holiday: Holiday | 'new' | null; year: number; onClose: () => void }) {
  const save = useSaveHoliday();
  const locations = useLocations();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [optional, setOptional] = useState(false);
  const [locs, setLocs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!holiday) return;
    setError(null);
    if (holiday === 'new') {
      setName('');
      setDate(`${year}-01-01`);
      setOptional(false);
      setLocs([]);
    } else {
      setName(holiday.name);
      setDate(holiday.date.slice(0, 10));
      setOptional(holiday.isOptional);
      setLocs(holiday.locationIds ?? []);
    }
  }, [holiday, year]);

  if (!holiday) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ id: holiday === 'new' ? undefined : holiday.id, name, date, isOptional: optional, locationIds: locs });
      toast.success(holiday === 'new' ? 'Holiday added' : 'Holiday updated');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the holiday'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<CalendarDays />}
      title={holiday === 'new' ? 'Add holiday' : 'Edit holiday'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="holiday-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="holiday-form" onSubmit={submit} className="space-y-3">
        <FormError>{error}</FormError>
        <Field label="Name" htmlFor="hol-name" required>
          <Input id="hol-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} placeholder="e.g. Diwali" />
        </Field>
        <Field label="Date" htmlFor="hol-date" required>
          <DateInput id="hol-date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={optional} onChange={(e) => setOptional(e.target.checked)} />
          <span>
            <span className="font-medium">Optional holiday</span>
            <span className="block text-xs text-muted-foreground">People pick the optional days they want (up to the company limit). A picked day is a holiday for them only.</span>
          </span>
        </label>
        {(locations.data?.length ?? 0) > 0 && (
          <Field label="Which offices" hint="None ticked = everyone">
            <div className="flex flex-wrap gap-1.5">
              {locations.data!.map((l) => {
                const on = locs.includes(l.id);
                return (
                  <button key={l.id} type="button" aria-pressed={on} onClick={() => setLocs((x) => (on ? x.filter((y) => y !== l.id) : [...x, l.id]))} className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium', on ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border text-muted-foreground hover:bg-subtle')}>
                    <MapPin className="h-3 w-3" /> {l.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
      </form>
    </Modal>
  );
}
