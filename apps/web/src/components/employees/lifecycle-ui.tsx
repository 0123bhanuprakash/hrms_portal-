'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, Circle, ClipboardList, DoorOpen, Plus, RotateCcw, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, Drawer } from '@/components/ui/modal';
import { Field, Input, inputClass, FormError } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/feedback';
import {
  EXIT_REASONS,
  daysUntil,
  stageMeta,
  useAddChecklistItem,
  useChecklist,
  useConfirmProbation,
  useExtendProbation,
  useMarkLeft,
  useStartNotice,
  useTickChecklist,
  useWithdrawNotice,
  type ChecklistKind,
  type ExitReason,
} from '@/lib/company/lifecycle';
import type { EmployeeStage } from '@/lib/company/org';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { DateInput, Select } from '@/components/ui/pickers';

const short = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDaysKey = (days: number, from = new Date()) => ymd(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days));
export const addMonthsKey = (months: number, from: string) => {
  const d = new Date(`${from.slice(0, 10)}T00:00:00`);
  return ymd(new Date(d.getFullYear(), d.getMonth() + months, d.getDate()));
};

interface StagePerson {
  stage?: EmployeeStage;
  joiningDate: string;
  confirmationDate?: string | null;
  terminationDate?: string | null;
}

/** "Probation · ends 18 Oct", "Last day 29 Oct", "Joins 12 Oct", "Active". */
export function stageText(p: StagePerson): string {
  const s = p.stage ?? 'active';
  if (s === 'joining') return `Joins ${short(p.joiningDate)}`;
  if (s === 'probation') {
    if (!p.confirmationDate) return 'Probation';
    const d = daysUntil(p.confirmationDate)!;
    return d < 0 ? `Probation · review overdue` : `Probation · ends ${short(p.confirmationDate)}`;
  }
  if (s === 'notice') return p.terminationDate ? `Last day ${short(p.terminationDate)}` : 'Notice period';
  if (s === 'left') return p.terminationDate ? `Left ${short(p.terminationDate)}` : 'Left';
  return 'Active';
}

export function StagePill({ person, className }: { person: StagePerson; className?: string }) {
  const meta = stageMeta(person.stage);
  const overdue = person.stage === 'probation' && (daysUntil(person.confirmationDate) ?? 1) < 0;
  return (
    <Badge tone={overdue ? 'danger' : meta.tone} dot className={className}>
      {stageText(person)}
    </Badge>
  );
}

/** Thin profile-completeness bar + percent. */
export function ProfileMeter({ percent, className }: { percent: number | null | undefined; className?: string }) {
  if (percent === null || percent === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = percent === 100 ? 'bg-success' : percent >= 70 ? 'bg-teal-500' : 'bg-warning';
  return (
    <span className={cn('inline-flex items-center gap-2', className)} title={`Profile ${percent}% complete`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span className={cn('m-fill-w block h-full rounded-full', tone)} style={{ width: `${percent}%` }} />
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{percent}%</span>
    </span>
  );
}

// ─── Confirm / extend / notice / withdraw / left ─────────────

export type LifecycleAction = 'confirm' | 'extend' | 'notice' | 'withdraw' | 'left';
export interface LifecycleTarget {
  id: string;
  firstName: string;
  lastName: string;
  joiningDate: string;
  confirmationDate?: string | null;
  terminationDate?: string | null;
  exitReason?: string | null;
}

const COPY: Record<LifecycleAction, { title: string; icon: React.ReactNode; cta: string }> = {
  confirm: { title: 'Confirm probation', icon: <UserCheck />, cta: 'Confirm' },
  extend: { title: 'Extend probation', icon: <CalendarClock />, cta: 'Extend' },
  notice: { title: 'Start notice period', icon: <DoorOpen />, cta: 'Start notice period' },
  withdraw: { title: 'Withdraw notice', icon: <RotateCcw />, cta: 'Withdraw notice' },
  left: { title: 'Mark as left', icon: <DoorOpen />, cta: 'Mark as left' },
};

export function LifecycleDialog({ action, person, onClose }: { action: LifecycleAction | null; person: LifecycleTarget | null; onClose: () => void }) {
  const confirm = useConfirmProbation();
  const extend = useExtendProbation();
  const notice = useStartNotice();
  const withdraw = useWithdrawNotice();
  const left = useMarkLeft();
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState<ExitReason>('resigned');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setNote('');
    if (!action || !person) return;
    if (action === 'extend') setDate(addMonthsKey(3, person.confirmationDate && person.confirmationDate > addDaysKey(0) ? person.confirmationDate : addDaysKey(0)));
    if (action === 'notice') setDate(addDaysKey(30));
    if (action === 'left') setDate(person.terminationDate && person.terminationDate.slice(0, 10) <= addDaysKey(0) ? person.terminationDate.slice(0, 10) : addDaysKey(0));
    setReason((person.exitReason as ExitReason) || 'resigned');
  }, [action, person]);

  if (!action || !person) return null;
  const name = `${person.firstName} ${person.lastName}`;
  const busy = confirm.isPending || extend.isPending || notice.isPending || withdraw.isPending || left.isPending;
  const c = COPY[action];

  const submit = async () => {
    setError(null);
    try {
      const n = note.trim() || undefined;
      if (action === 'confirm') await confirm.mutateAsync({ id: person.id, note: n });
      if (action === 'extend') await extend.mutateAsync({ id: person.id, until: date, note: n });
      if (action === 'notice') await notice.mutateAsync({ id: person.id, lastDay: date, reason, note: n });
      if (action === 'withdraw') await withdraw.mutateAsync({ id: person.id, note: n });
      if (action === 'left') await left.mutateAsync({ id: person.id, lastDay: date, reason, note: n });
      toast.success(
        action === 'confirm' ? `${person.firstName} is confirmed — they’ve been told`
        : action === 'extend' ? `Probation extended to ${formatDate(date)}`
        : action === 'notice' ? `Notice period started — last day ${formatDate(date)}`
        : action === 'withdraw' ? `${person.firstName} is staying on`
        : `${person.firstName} is marked as left`,
      );
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not save'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={c.icon}
      title={`${c.title} — ${name}`}
      description={
        action === 'confirm' ? `${person.firstName} becomes Active from today. ${person.confirmationDate ? `Probation was due to end ${formatDate(person.confirmationDate)}.` : ''}`
        : action === 'extend' ? `Currently ends ${person.confirmationDate ? formatDate(person.confirmationDate) : '—'}. Pick the new review date.`
        : action === 'notice' ? 'Only HR sees this — colleagues and managers keep seeing them as Active until their last day.'
        : action === 'withdraw' ? 'They go back to Active and the exit checklist is cleared.'
        : 'They disappear from People and the org chart. HR can still find them under “Left”.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={action === 'left' ? 'danger' : 'primary'} onClick={submit} loading={busy}>{c.cta}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError>{error}</FormError>
        {action === 'extend' && (
          <>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((m) => {
                const k = addMonthsKey(m, person.confirmationDate && person.confirmationDate > addDaysKey(0) ? person.confirmationDate : addDaysKey(0));
                return (
                  <button key={m} type="button" onClick={() => setDate(k)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', date === k ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
                    +{m} month{m > 1 ? 's' : ''}
                  </button>
                );
              })}
            </div>
            <Field label="New end date" htmlFor="lc-date" required><DateInput id="lc-date" value={date} min={addDaysKey(1)} onChange={(e) => setDate(e.target.value)} /></Field>
          </>
        )}
        {(action === 'notice' || action === 'left') && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Last day" htmlFor="lc-date" required>
              <DateInput id="lc-date" value={date} max={action === 'left' ? addDaysKey(0) : undefined} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Reason" htmlFor="lc-reason">
              <Select id="lc-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value as ExitReason)}>
                {EXIT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            </Field>
          </div>
        )}
        {action === 'notice' && (
          <p className="rounded-lg bg-info-soft p-3 text-xs text-info">An exit checklist is created (handover, assets, access, final settlement). IT is told if they still hold company assets.</p>
        )}
        <Field label="Note" htmlFor="lc-note" hint="Kept in their employment history.">
          <textarea id="lc-note" className={cn(inputClass, 'min-h-[72px] py-2')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={action === 'confirm' ? 'e.g. Great first six months' : 'Optional'} />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Joining / exit checklist ───────────────────────────────

export function ChecklistDrawer({ person, kind, onClose }: { person: { id: string; firstName: string; lastName: string } | null; kind: ChecklistKind; onClose: () => void }) {
  const list = useChecklist(person?.id ?? null, kind);
  const tick = useTickChecklist(person?.id ?? '', kind);
  const add = useAddChecklistItem(person?.id ?? '', kind);
  const [label, setLabel] = useState('');
  if (!person) return null;
  const items = list.data ?? [];
  const done = items.filter((i) => i.doneAt).length;

  return (
    <Drawer
      open
      onClose={onClose}
      icon={<ClipboardList />}
      title={`${kind === 'joining' ? 'Joining' : 'Exit'} checklist — ${person.firstName} ${person.lastName}`}
      description={items.length ? `${done} of ${items.length} done` : undefined}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : list.isError ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(list.error, 'Could not load the checklist')}</p>
      ) : (
        <div className="space-y-4">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemax={items.length} aria-label="Checklist progress">
            <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => tick.mutate({ itemId: i.id, done: !i.doneAt }, { onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update')) })}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-subtle"
                  aria-pressed={Boolean(i.doneAt)}
                >
                  {i.doneAt ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', i.doneAt && 'text-muted-foreground line-through')}>{i.label}</span>
                    {i.doneAt && <span className="block text-xs text-muted-foreground">{i.doneBy ?? 'Someone'} · {formatRelative(i.doneAt)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!label.trim()) return;
              add.mutate(label.trim(), { onSuccess: () => setLabel(''), onError: (err) => toast.error(getApiErrorMessage(err, 'Could not add')) });
            }}
          >
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add an item…" maxLength={120} aria-label="New checklist item" />
            <Button type="submit" variant="secondary" loading={add.isPending} disabled={!label.trim()}><Plus /> Add</Button>
          </form>
        </div>
      )}
    </Drawer>
  );
}
