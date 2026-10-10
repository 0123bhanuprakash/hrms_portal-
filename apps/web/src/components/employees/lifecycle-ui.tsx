'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, Circle, ClipboardList, DoorOpen, GraduationCap, Plus, RotateCcw, Settings2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal, Drawer } from '@/components/ui/modal';
import { Field, Input, inputClass, FormError } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/feedback';
import {
  CONVERT_TYPES,
  EXIT_REASONS,
  daysUntil,
  stageMeta,
  useAddChecklistItem,
  useChecklist,
  useConfirmProbation,
  useConvertIntern,
  useExtendInternship,
  useExtendProbation,
  useInternshipSettings,
  useMarkLeft,
  useStartNotice,
  useTickChecklist,
  useWithdrawNotice,
  type ChecklistKind,
  type ConvertType,
  type ExitReason,
  type InternshipEndAction,
} from '@/lib/company/lifecycle';
import { useDesignations, type EmployeeStage } from '@/lib/company/org';
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

/** Interns still with us: "Intern · ends 12 Nov", "Internship ended — decide", "Intern · no end date". */
export function internshipText(p: { employmentType?: string; internshipEndDate?: string | null; stage?: EmployeeStage }): { text: string; overdue: boolean } | null {
  if (p.employmentType !== 'INTERN' || p.stage === 'notice' || p.stage === 'left') return null;
  if (!p.internshipEndDate) return { text: 'Intern · no end date', overdue: false };
  const d = daysUntil(p.internshipEndDate)!;
  return d < 0 ? { text: 'Internship ended — decide', overdue: true } : { text: `Intern · ends ${short(p.internshipEndDate)}`, overdue: false };
}

/** Whether this person is an intern HR can still convert / extend / end. */
export const isCurrentIntern = (p: { employmentType?: string; stage?: EmployeeStage }) => p.employmentType === 'INTERN' && p.stage !== 'notice' && p.stage !== 'left';

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

export type LifecycleAction = 'confirm' | 'extend' | 'convert' | 'extend-internship' | 'end-internship' | 'notice' | 'withdraw' | 'left';
export interface LifecycleTarget {
  id: string;
  firstName: string;
  lastName: string;
  joiningDate: string;
  confirmationDate?: string | null;
  internshipEndDate?: string | null;
  designationId?: string | null;
  terminationDate?: string | null;
  exitReason?: string | null;
}

const COPY: Record<LifecycleAction, { title: string; icon: React.ReactNode; cta: string }> = {
  confirm: { title: 'Confirm probation', icon: <UserCheck />, cta: 'Confirm' },
  extend: { title: 'Extend probation', icon: <CalendarClock />, cta: 'Extend' },
  convert: { title: 'Convert to employee', icon: <GraduationCap />, cta: 'Convert' },
  'extend-internship': { title: 'Extend internship', icon: <CalendarClock />, cta: 'Extend' },
  'end-internship': { title: 'End internship', icon: <DoorOpen />, cta: 'Start notice period' },
  notice: { title: 'Start notice period', icon: <DoorOpen />, cta: 'Start notice period' },
  withdraw: { title: 'Withdraw notice', icon: <RotateCcw />, cta: 'Withdraw notice' },
  left: { title: 'Mark as left', icon: <DoorOpen />, cta: 'Mark as left' },
};

export function LifecycleDialog({ action, person, onClose }: { action: LifecycleAction | null; person: LifecycleTarget | null; onClose: () => void }) {
  const confirm = useConfirmProbation();
  const extend = useExtendProbation();
  const convert = useConvertIntern();
  const extendIntern = useExtendInternship();
  const designations = useDesignations();
  const [type, setType] = useState<ConvertType>('FULL_TIME');
  const [probation, setProbation] = useState('');
  const [title, setTitle] = useState('');
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
    const internEnd = person.internshipEndDate?.slice(0, 10) ?? null;
    if (action === 'extend-internship') setDate(addMonthsKey(3, internEnd && internEnd > addDaysKey(0) ? internEnd : addDaysKey(0)));
    if (action === 'convert') {
      // The day after the internship, or today if it has already ended
      const start = internEnd && internEnd >= addDaysKey(0) ? addDaysKey(1, new Date(`${internEnd}T00:00:00`)) : addDaysKey(0);
      setDate(start);
      setType('FULL_TIME');
      setProbation('');
      setTitle(person.designationId ?? '');
    }
    if (action === 'notice') setDate(addDaysKey(30));
    if (action === 'end-internship') setDate(internEnd && internEnd >= addDaysKey(0) ? internEnd : addDaysKey(0));
    if (action === 'left') setDate(person.terminationDate && person.terminationDate.slice(0, 10) <= addDaysKey(0) ? person.terminationDate.slice(0, 10) : addDaysKey(0));
    setReason(action === 'end-internship' ? 'contract_end' : (person.exitReason as ExitReason) || 'resigned');
  }, [action, person]);

  if (!action || !person) return null;
  const name = `${person.firstName} ${person.lastName}`;
  const busy = confirm.isPending || extend.isPending || convert.isPending || extendIntern.isPending || notice.isPending || withdraw.isPending || left.isPending;
  const c = COPY[action];

  const submit = async () => {
    setError(null);
    try {
      const n = note.trim() || undefined;
      if (action === 'confirm') await confirm.mutateAsync({ id: person.id, note: n });
      if (action === 'extend') await extend.mutateAsync({ id: person.id, until: date, note: n });
      if (action === 'convert') await convert.mutateAsync({ id: person.id, employmentType: type, startDate: date, probationEnd: probation || undefined, designationId: title && title !== person.designationId ? title : undefined, note: n });
      if (action === 'extend-internship') await extendIntern.mutateAsync({ id: person.id, until: date, note: n });
      if (action === 'notice' || action === 'end-internship') await notice.mutateAsync({ id: person.id, lastDay: date, reason, note: n });
      if (action === 'withdraw') await withdraw.mutateAsync({ id: person.id, note: n });
      if (action === 'left') await left.mutateAsync({ id: person.id, lastDay: date, reason, note: n });
      toast.success(
        action === 'confirm' ? `${person.firstName} is confirmed — they’ve been told`
        : action === 'extend' ? `Probation extended to ${formatDate(date)}`
        : action === 'convert' ? `${person.firstName} is now ${CONVERT_TYPES.find((t) => t.id === type)!.label.toLowerCase()} — they’ve been told`
        : action === 'extend-internship' ? `Internship extended to ${formatDate(date)}`
        : action === 'notice' || action === 'end-internship' ? `Notice period started — last day ${formatDate(date)}`
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
        : action === 'convert' ? `${person.firstName}’s internship ${person.internshipEndDate ? `${person.internshipEndDate.slice(0, 10) < addDaysKey(0) ? 'ended' : 'ends'} ${formatDate(person.internshipEndDate)}` : 'has no end date'}. They keep their manager, team, leave and history.`
        : action === 'extend-internship' ? `Currently ends ${person.internshipEndDate ? formatDate(person.internshipEndDate) : '—'}. Pick the new end date — reminders start again 14 days before it.`
        : action === 'end-internship' ? 'They leave on the last day, with an exit checklist like any other exit. Only HR sees this until then.'
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
        {action === 'convert' && (
          <>
            <Field label="New employment type" htmlFor="lc-type" required>
              <div id="lc-type" className="flex flex-wrap gap-2" role="radiogroup">
                {CONVERT_TYPES.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={type === t.id} onClick={() => setType(t.id)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', type === t.id ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts in the new role" htmlFor="lc-date" required hint="Recorded in their history.">
                <DateInput id="lc-date" value={date} min={person.joiningDate.slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Job title" htmlFor="lc-title">
                <Select id="lc-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)}>
                  <option value="">Keep the current title</option>
                  {(designations.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Probation" htmlFor="lc-probation" hint={probation ? 'They start on probation and you’ll be reminded to confirm it.' : 'None — they’re Active straight away.'}>
              <div className="flex flex-wrap items-center gap-2">
                {[0, 3, 6].map((m) => {
                  const k = m ? addMonthsKey(m, date || addDaysKey(0)) : '';
                  return (
                    <button key={m} type="button" onClick={() => setProbation(k)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', probation === k ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
                      {m ? `${m} months` : 'No probation'}
                    </button>
                  );
                })}
                {probation && <DateInput id="lc-probation" className="w-40" value={probation} min={date} onChange={(e) => setProbation(e.target.value)} aria-label="Probation ends" />}
              </div>
            </Field>
            <p className="rounded-lg bg-info-soft p-3 text-xs text-info">If they have the Intern access role, it’s swapped for Employee so they see the usual employee pages.</p>
          </>
        )}
        {action === 'extend-internship' && (
          <>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 6].map((m) => {
                const base = person.internshipEndDate && person.internshipEndDate.slice(0, 10) > addDaysKey(0) ? person.internshipEndDate : addDaysKey(0);
                const k = addMonthsKey(m, base);
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
        {(action === 'notice' || action === 'left' || action === 'end-internship') && (
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
        {(action === 'notice' || action === 'end-internship') && (
          <p className="rounded-lg bg-info-soft p-3 text-xs text-info">An exit checklist is created (handover, assets, access, final settlement). IT is told if they still hold company assets.</p>
        )}
        <Field label="Note" htmlFor="lc-note" hint="Kept in their employment history.">
          <textarea id="lc-note" className={cn(inputClass, 'min-h-[72px] py-2')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={action === 'confirm' ? 'e.g. Great first six months' : action === 'convert' ? 'e.g. Offer accepted on 3 Nov' : 'Optional'} />
        </Field>
      </div>
    </Modal>
  );
}

// ─── What happens when an internship ends ───────────────────

export function InternshipSettingsDialog({ open, value, onClose }: { open: boolean; value: InternshipEndAction; onClose: () => void }) {
  const save = useInternshipSettings();
  const [choice, setChoice] = useState<InternshipEndAction>(value);
  useEffect(() => { if (open) setChoice(value); }, [open, value]);
  if (!open) return null;
  const OPTIONS: Array<{ id: InternshipEndAction; title: string; body: string }> = [
    { id: 'remind', title: 'Remind HR (recommended)', body: 'HR and the manager hear 14 days before. Nobody changes until someone converts, extends or ends the internship. Company Admins hear if it’s still open 7 days after.' },
    { id: 'convert', title: 'Convert to Full-time automatically', body: 'On the end date they become Full-time and Active. HR still gets the heads-up first, and can exclude anyone from their profile.' },
  ];
  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Settings2 />}
      title="When an internship ends"
      description="Applies to every intern in the company."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button
            loading={save.isPending}
            disabled={choice === value}
            onClick={() => save.mutate(choice, { onSuccess: () => { toast.success(choice === 'convert' ? 'Interns are now converted automatically' : 'HR is reminded — nobody changes automatically'); onClose(); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')) })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-2" role="radiogroup" aria-label="When an internship ends">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} onClick={() => setChoice(o.id)} className={cn('flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors', choice === o.id ? 'border-primary bg-primary-soft/50' : 'border-border hover:bg-subtle')}>
            <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', choice === o.id ? 'border-primary' : 'border-muted-foreground')}>
              {choice === o.id && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <span>
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="block text-xs text-muted-foreground">{o.body}</span>
            </span>
          </button>
        ))}
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
