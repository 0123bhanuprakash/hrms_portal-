'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, Copy, Lock, Send } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/feedback';
import { blockColor } from '@/components/timesheets/week-calendar';
import { addDays, dayLabel, fmtHours, useCopyDay, useSubmitPreview, useSubmitTime } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const CHECK = {
  ok: { text: 'looks right', cls: 'bg-success/10 text-success' },
  short: { text: 'less than you were in', cls: 'bg-warning/10 text-warning' },
  empty: { text: 'nothing logged', cls: 'bg-warning/10 text-warning' },
  leave: { text: 'on leave — skipped', cls: 'bg-primary-soft text-primary-soft-foreground' },
  off: { text: 'day off — skipped', cls: 'bg-subtle text-muted-foreground' },
  sent: { text: 'already sent', cls: 'bg-info/10 text-info' },
} as const;

/** Send time for approval: just today, or every logged day not sent yet. */
export function SubmitDialog({ open, onClose, onFillDay }: { open: boolean; onClose: () => void; onFillDay: (date: string) => void }) {
  const [scope, setScope] = useState<'today' | 'all'>('all');
  const [note, setNote] = useState('');
  const all = useSubmitPreview('all', open);
  const today = useSubmitPreview('today', open);
  const submit = useSubmitTime();
  useEffect(() => {
    if (open) setNote('');
  }, [open]);
  const pv = scope === 'all' ? all.data : today.data;
  const loading = scope === 'all' ? all.isLoading : today.isLoading;
  const warn = pv?.days.filter((d) => d.check === 'empty' || d.check === 'short') ?? [];

  const go = async () => {
    try {
      const r = await submit.mutateAsync({ scope, note });
      toast.success(`Sent ${r.days} day${r.days === 1 ? '' : 's'} · ${fmtHours(r.minutes)} for approval`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submit.isPending}
      title="Send for approval"
      description="Sends every day you’ve logged but not sent yet, up to today — or just today."
      icon={<Send />}
      className="max-w-xl"
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="flex flex-1 items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Approved time is locked</span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon={<Send />} onClick={() => void go()} loading={submit.isPending} disabled={!pv?.blocks}>
            {pv?.dates.length ? `Send ${pv.dates.length} day${pv.dates.length === 1 ? '' : 's'}` : 'Send'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What to send">
          {([
            ['today', 'Just today', today.data ? (today.data.blocks ? fmtHours(today.data.totalMinutes) : 'nothing to send') : '…'],
            ['all', 'Everything not sent yet', all.data ? (all.data.dates.length ? `${all.data.dates.length} day${all.data.dates.length === 1 ? '' : 's'} · ${fmtHours(all.data.totalMinutes)}` : 'nothing to send') : '…'],
          ] as const).map(([id, label, sub]) => (
            <button key={id} type="button" role="radio" aria-checked={scope === id} onClick={() => setScope(id)} className={cn('flex items-start gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition-colors', scope === id ? 'border-primary bg-primary-soft/50' : 'border-border hover:bg-subtle')}>
              <span className={cn('mt-0.5 h-4 w-4 shrink-0 rounded-full border-2', scope === id ? 'border-[5px] border-primary' : 'border-border')} />
              <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
            </button>
          ))}
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : !pv?.blocks ? (
          <p className="rounded-lg bg-subtle px-3 py-4 text-center text-sm text-muted-foreground">Nothing here that isn’t sent already. Log some time first.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border">
              {pv.days.map((d) => {
                const c = CHECK[d.check];
                return (
                  <div key={d.date} className={cn('flex items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-0', (d.check === 'sent' || d.check === 'off' || d.check === 'leave') && 'opacity-60')}>
                    <b className="w-16">{dayLabel(d.date)}</b>
                    <span className="w-16 tabular-nums">{d.minutes ? <b>{fmtHours(d.minutes)}</b> : '—'}</span>
                    <span className="flex-1 truncate text-xs text-muted-foreground">
                      {d.leave ? d.leave : d.holiday ? d.holiday : d.stillIn ? 'still checked in' : d.attendedMinutes != null ? `in office ${fmtHours(d.attendedMinutes)}` : 'no check-in'}
                    </span>
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', c.cls)}>
                      {d.check === 'ok' && <Check className="h-3 w-3" />}
                      {(d.check === 'short' || d.check === 'empty') && <AlertTriangle className="h-3 w-3" />}
                      {d.check === 'short' && d.attendedMinutes != null ? `${fmtHours(d.attendedMinutes - d.minutes)} in office not logged` : c.text}
                    </span>
                  </div>
                );
              })}
            </div>
            {warn.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span className="flex-1"><b>{warn.map((d) => dayLabel(d.date)).join(', ')} {warn.length === 1 ? 'looks' : 'look'} short.</b> You can still send — add a note so your lead knows why.</span>
                <Button size="sm" variant="secondary" onClick={() => onFillDay(warn[0]!.date)}>Fill it</Button>
              </div>
            )}
            <div className="space-y-2 rounded-xl bg-subtle/70 p-3">
              <p className="text-xs font-bold text-muted-foreground">Goes to the lead on each project</p>
              {pv.projects.map((p) => (
                <div key={p.project?.id ?? 'general'} className="flex items-center gap-2.5 text-sm">
                  <span className="h-6 w-1.5 shrink-0 rounded-full" style={{ background: blockColor(p.project) }} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{p.project?.name ?? 'General'}</b>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.goesTo.map((g) => `${g.people.map((x) => `${x.firstName} ${x.lastName}`).join(', ') || 'HR'} · ${g.label}`).join(' / ')}
                    </span>
                  </span>
                  <b className="tabular-nums">{fmtHours(p.minutes)}</b>
                </div>
              ))}
            </div>
            <Field label="Note for your approvers" htmlFor="sub-note" hint="Optional">
              <Textarea id="sub-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Wed afternoon: interview panel — logged under General" />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Copy one day's blocks onto another day (skips anything that would overlap). */
export function CopyDayDialog({ open, onClose, defaultFrom, defaultTo, minDate, maxDate }: { open: boolean; onClose: () => void; defaultFrom: string; defaultTo: string; minDate: string; maxDate: string }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const copy = useCopyDay();
  useEffect(() => {
    if (open) {
      setFrom(defaultFrom);
      setTo(defaultTo);
    }
  }, [open, defaultFrom, defaultTo]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={copy.isPending}
      title="Copy a day"
      description="Same project, times and description — anything that would overlap is skipped."
      icon={<Copy />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={copy.isPending}
            disabled={!from || !to || from === to}
            onClick={async () => {
              try {
                const r = await copy.mutateAsync({ from, to });
                if (r.copied) toast.success(`Copied ${r.copied} block${r.copied === 1 ? '' : 's'}${r.skipped.length ? ` · skipped ${r.skipped.length}` : ''}`);
                else toast.error(`Nothing copied — ${r.skipped[0] ?? 'it would overlap'}`);
                onClose();
              } catch (err) {
                toast.error(getApiErrorMessage(err, 'Could not copy'));
              }
            }}
          >
            Copy
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="cp-from"><Input id="cp-from" type="date" min={minDate} max={maxDate} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To" htmlFor="cp-to"><Input id="cp-to" type="date" min={minDate} max={maxDate} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[['Yesterday → today', addDays(maxDate, -1), maxDate]].map(([l, f, t]) => (
          <button key={l} type="button" onClick={() => { setFrom(f!); setTo(t!); }} className="rounded-full border border-border px-2.5 py-0.5 text-xs hover:bg-subtle">{l}</button>
        ))}
      </div>
    </Modal>
  );
}
