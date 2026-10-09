'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Paperclip, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Textarea, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { PlaneTakeoff, Ring } from '@/components/time/visuals';
import { days, previewLeave, useApplyLeave, useAttachDocument, useLeaveBalances, useWhosOff, type HalfDay, type LeavePreview } from '@/lib/company/leave';
import { useUiState } from '@/lib/preferences/ui-state';
import { useMyCard } from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { DateInput } from '@/components/ui/pickers';
import { AskExtraDialog, type AskExtraInit } from '@/components/leave/extra-leave';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthOf = (k: string) => k.slice(0, 7);
const shiftMonth = (m: string, by: number) => {
  const [y, mm] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mm - 1 + by, 1)).toISOString().slice(0, 7);
};

export interface LeaveDraft {
  id: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDay: HalfDay | null;
  reason: string;
  savedAt: string;
}
const isDrafts = (v: unknown): v is LeaveDraft[] => Array.isArray(v);
/** Requests saved without sending (kept with your preferences, max 5). */
export const useLeaveDrafts = () => useUiState<LeaveDraft[]>('leave:drafts', [], isDrafts);

/** Apply for leave: pick a type, pick days on the calendar, see the check live, send. */
export function ApplyLeaveDialog({
  open,
  onClose,
  initialTypeCode,
  initialRange,
  draft,
}: {
  open: boolean;
  onClose: () => void;
  initialTypeCode?: string | null;
  initialRange?: { start: string; end: string } | null;
  draft?: LeaveDraft | null;
}) {
  const balances = useLeaveBalances(undefined, new Date().getFullYear(), open);
  const apply = useApplyLeave();
  const attach = useAttachDocument();
  const [drafts, setDrafts] = useLeaveDrafts();
  const me = useMyCard(open);
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(todayKey);
  const [end, setEnd] = useState(todayKey);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState(() => monthOf(todayKey()));
  const [halfDay, setHalfDay] = useState<'' | HalfDay>('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [askingMore, setAskingMore] = useState<AskExtraInit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flown, setFlown] = useState(0);
  const off = useWhosOff({ month }, open);

  const types = useMemo(() => balances.data?.balances ?? [], [balances.data]);
  const type = types.find((b) => b.leaveType.id === typeId)?.leaveType;

  useEffect(() => {
    if (!open) return;
    const s = draft?.startDate ?? initialRange?.start ?? todayKey();
    setStart(s);
    setEnd(draft?.endDate ?? initialRange?.end ?? s);
    setMonth(monthOf(s));
    setPicking('start');
    setHalfDay(draft?.halfDay ?? '');
    setReason(draft?.reason ?? '');
    setFile(null);
    setPreview(null);
    setError(null);
  }, [open, draft, initialRange]);
  useEffect(() => {
    if (!open || !types.length) return;
    const wanted = draft ? types.find((b) => b.leaveType.id === draft.leaveTypeId) : initialTypeCode ? types.find((b) => b.leaveType.code === initialTypeCode) : undefined;
    setTypeId((current) => (current && types.some((b) => b.leaveType.id === current) && !wanted ? current : (wanted ?? types[0]!).leaveType.id));
  }, [open, types, initialTypeCode, draft]);

  const single = start === end;
  useEffect(() => {
    if (!single || (type && !type.allowHalfDay)) setHalfDay('');
  }, [single, type]);

  // Live check (debounced)
  useEffect(() => {
    if (!open || !typeId || !start || !end) return;
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const p = await previewLeave({ leaveTypeId: typeId, startDate: start, endDate: end, halfDay: halfDay || null });
        if (!cancelled) setPreview(p);
      } catch (err) {
        if (!cancelled) setPreview({ days: 0, dates: [], available: null, after: null, errors: [getApiErrorMessage(err)], warnings: [], leaveType: { id: typeId, name: '', accrual: 'NONE', approvalLevels: 0 } });
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, typeId, start, end, halfDay]);

  // Teammates already off in the chosen days (from Who's off)
  const mineId = me.data?.employee?.id;
  const teamOff = useMemo(() => {
    const leaves = (off.data?.leaves ?? []).filter((l) => l.employee.id !== mineId && l.startDate <= end && l.endDate >= start);
    return [...new Map(leaves.map((l) => [l.employee.id, l.employee])).values()];
  }, [off.data, start, end, mineId]);

  const pick = (k: string) => {
    if (picking === 'start' || k < start) {
      setStart(k);
      setEnd(k);
      setPicking('end');
    } else {
      setEnd(k);
      setPicking('start');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await apply.mutateAsync({ leaveTypeId: typeId, startDate: start, endDate: end, halfDay: halfDay || null, reason });
      setFlown(Date.now());
      if (file) {
        try {
          await attach.mutateAsync({ id: r.id, file });
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'The request was sent, but the document could not be attached — add it from My leave'));
        }
      }
      if (draft) setDrafts(drafts.filter((d) => d.id !== draft.id));
      toast.success(r.status === 'APPROVED' ? `${r.leaveType.name} approved` : `${r.leaveType.name} request sent for approval`);
      setTimeout(onClose, 700);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not apply for leave'));
    }
  };

  const saveDraft = () => {
    const next: LeaveDraft = { id: draft?.id ?? `d${Date.now()}`, leaveTypeId: typeId, startDate: start, endDate: end, halfDay: halfDay || null, reason: reason.slice(0, 300), savedAt: new Date().toISOString() };
    setDrafts([next, ...drafts.filter((d) => d.id !== next.id)].slice(0, 5));
    toast.success('Saved as a draft — find it in My leave');
    onClose();
  };

  const blocked = !preview || preview.errors.length > 0 || checking;
  const balance = types.find((b) => b.leaveType.id === typeId);

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      busy={apply.isPending}
      icon={<CalendarPlus />}
      title="Apply for leave"
      size="lg"
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={saveDraft} disabled={!typeId || apply.isPending}>Save draft</Button>
          <Button variant="secondary" onClick={onClose} disabled={apply.isPending}>Cancel</Button>
          <span className="relative">
            <PlaneTakeoff fire={flown} />
            <Button type="submit" form="apply-leave-form" loading={apply.isPending} disabled={blocked}>
              <Send /> {preview?.leaveType.approvalLevels === 0 ? 'Apply' : 'Send request'}
            </Button>
          </span>
        </>
      }
    >
      <form id="apply-leave-form" onSubmit={submit} className="space-y-4">
        <FormError>{error}</FormError>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">1 · What kind</p>
          <div role="radiogroup" aria-label="Leave type" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {types.map((b) => {
              const on = b.leaveType.id === typeId;
              return (
                <button
                  key={b.leaveType.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTypeId(b.leaveType.id)}
                  className={cn('flex flex-col gap-0.5 rounded-xl border-[1.5px] p-2.5 text-left transition-all', on ? 'shadow-card' : 'border-border hover:bg-subtle')}
                  style={on ? { borderColor: b.leaveType.color, background: `color-mix(in srgb, ${b.leaveType.color} 9%, transparent)` } : undefined}
                >
                  <span className="mb-1 h-1 w-6 rounded-full" style={{ background: b.leaveType.color }} />
                  <span className="truncate text-sm font-semibold">{b.leaveType.name}</span>
                  <span className="text-[11px] font-medium text-muted-foreground">{b.available === null ? 'No limit' : `${b.available} left`}</span>
                </button>
              );
            })}
          </div>
          {type?.description && <p className="mt-1.5 text-xs text-muted-foreground">{type.description}</p>}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">2 · When — click the first and last day</p>
            <RangeCalendar
              month={month}
              setMonth={setMonth}
              start={start}
              end={end}
              hover={picking === 'end' ? hover : null}
              onHover={setHover}
              onPick={pick}
              holidays={off.data?.holidays ?? []}
              leaves={(off.data?.leaves ?? []).filter((l) => l.employee.id !== mineId)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Field label="From" htmlFor="lv-start">
                <DateInput id="lv-start" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); if (e.target.value) setMonth(monthOf(e.target.value)); }} required />
              </Field>
              <Field label="To" htmlFor="lv-end">
                <DateInput id="lv-end" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
              </Field>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">3 · Check</p>
            <div className="rounded-xl border border-border p-3" aria-live="polite">
              {checking || !preview ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</p>
              ) : preview.errors.length ? (
                <>
                  <ul className="space-y-1 text-sm text-destructive">
                    {preview.errors.map((m) => <li key={m} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m}</li>)}
                  </ul>
                  {preview.canAskMore && (
                    balance?.extraRequest ? (
                      <p className="mt-2 text-xs text-muted-foreground">You asked for {days(balance.extraRequest.days)} more — waiting for an answer.</p>
                    ) : (
                      <Button
                        size="sm"
                        variant="soft"
                        className="mt-2"
                        onClick={() => setAskingMore({ leaveTypeId: typeId, leaveTypeName: balance?.leaveType.name ?? 'leave', year: Number(start.slice(0, 4)), days: preview.short ?? 1, startDate: start, endDate: end })}
                      >
                        <Send /> Ask HR for more days
                      </Button>
                    )
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-xl font-bold"><CheckCircle2 className="h-5 w-5 text-success" /> {days(preview.days)}</p>
                    <p className="text-xs text-muted-foreground">Weekly offs and holidays aren’t counted{type?.includeNonWorkingDays ? ' — except for this type' : ''}.</p>
                  </div>
                  {preview.after !== null && balance?.available !== null && balance?.available !== undefined && (
                    <Ring value={Math.max(0, preview.after)} max={Math.max(balance.allocated + balance.carriedForward, balance.available, 1)} size={64} stroke={7} barClass={preview.after < 0 ? 'stroke-destructive' : 'stroke-primary'} label={`${preview.after} left after`}>
                      <span className="text-sm font-bold">{preview.after}</span>
                      <span className="text-[9px] text-muted-foreground">after</span>
                    </Ring>
                  )}
                </div>
              )}
              {single && type?.allowHalfDay && (
                <div className="mt-3 flex rounded-lg border border-border p-0.5 text-xs" role="radiogroup" aria-label="Duration">
                  {([['', 'Full day'], ['FIRST_HALF', 'First half'], ['SECOND_HALF', 'Second half']] as const).map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={halfDay === v} onClick={() => setHalfDay(v)} className={cn('flex-1 rounded-md px-2 py-1 font-medium', halfDay === v ? 'bg-foreground text-background' : 'text-muted-foreground')}>{l}</button>
                  ))}
                </div>
              )}
              {preview?.warnings.map((w) => <p key={w} className="mt-2 text-xs text-warning">{w}</p>)}
            </div>
            {teamOff.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <b>{teamOff.length} of your team {teamOff.length === 1 ? 'is' : 'are'} off on some of these days</b> ({teamOff.slice(0, 3).map((p) => p.firstName).join(', ')}{teamOff.length > 3 ? '…' : ''}). You can still apply.
                </span>
              </div>
            )}
            {preview?.route && preview.route.levels.length > 0 && !preview.errors.length && (
              <div className="text-xs">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Who approves</p>
                <ol className="flex flex-wrap items-center gap-1.5">
                  {preview.route.levels.map((l, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span className="h-px w-4 bg-border" />}
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-border text-[10px] font-bold">{i + 1}</span>
                      <span><b>{l.approvers.length ? l.approvers.map((a) => a.firstName).join(' or ') : 'HR'}</b> <span className="text-muted-foreground">{l.label}</span></span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <Field label="Reason" htmlFor="lv-reason" required>
              <Textarea id="lv-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} rows={2} placeholder="Visible to your approvers" />
            </Field>
            {(preview?.needsDocument || type?.documentAfterDays !== null) && (
              <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs', preview?.needsDocument ? 'border-warning text-warning' : 'border-border text-muted-foreground')}>
                <Paperclip className="h-3.5 w-3.5" />
                <span className="flex-1 truncate">{file ? file.name : preview?.needsDocument ? 'Attach a document (asked for this request)' : 'Attach a document (optional)'}</span>
                <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
        </div>
      </form>
    </Modal>
    <AskExtraDialog init={askingMore} onClose={() => setAskingMore(null)} />
    </>
  );
}

/** One month: click to choose the range; holidays and teammates off are shown. */
function RangeCalendar({
  month,
  setMonth,
  start,
  end,
  hover,
  onHover,
  onPick,
  holidays,
  leaves,
}: {
  month: string;
  setMonth: (m: string) => void;
  start: string;
  end: string;
  hover: string | null;
  onHover: (k: string | null) => void;
  onPick: (k: string) => void;
  holidays: Array<{ date: string; name: string; isOptional: boolean }>;
  leaves: Array<{ employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null }; startDate: string; endDate: string }>;
}) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const len = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // Sunday first
  const hol = new Map(holidays.filter((h) => !h.isOptional).map((h) => [h.date, h.name]));
  const to = hover && hover > start ? hover : end;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
        <p className="text-sm font-semibold">{new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" onMouseLeave={() => onHover(null)}>
        {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: len }, (_, d) => {
          const k = `${month}-${String(d + 1).padStart(2, '0')}`;
          const wd = (lead + d) % 7;
          const inRange = k >= start && k <= to;
          const edge = k === start || k === to;
          const h = hol.get(k);
          const who = leaves.filter((l) => l.startDate <= k && l.endDate >= k).map((l) => l.employee);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              onMouseEnter={() => onHover(k)}
              title={[h, who.length ? `Off: ${who.map((p) => p.firstName).join(', ')}` : ''].filter(Boolean).join(' · ') || undefined}
              className={cn(
                'relative flex h-11 flex-col rounded-lg border p-1 text-left text-[11px] font-semibold tabular-nums transition-colors',
                edge ? 'border-primary bg-primary text-primary-foreground' : inRange ? 'border-primary/30 bg-primary/15' : wd === 0 || wd === 6 ? 'border-transparent bg-muted/60 text-muted-foreground' : 'border-border hover:bg-subtle',
              )}
            >
              {d + 1}
              {h && <span className={cn('mt-auto truncate rounded px-0.5 text-[8.5px] font-bold', edge ? 'bg-white/25' : 'bg-teal-500/20 text-teal-700 dark:text-teal-300')}>{h}</span>}
              {who.length > 0 && (
                <span className="absolute bottom-0.5 right-0.5 flex">
                  {who.slice(0, 2).map((p) => <PersonAvatar key={p.id} person={p} size="xs" className="-ml-1.5 h-3.5 w-3.5 border border-surface text-[6px] first:ml-0" />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-primary" /> your days</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-teal-500/30" /> holiday</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> teammates off</span>
      </div>
    </div>
  );
}
