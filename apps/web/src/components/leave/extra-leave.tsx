'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BookOpenText, Check, HandCoins, Inbox, Plus, Send, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, FormError, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/pickers';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { PersonSearch } from '@/components/people/person-search';
import {
  days,
  useAskExtra,
  useDecideExtra,
  useExtraRequests,
  useLedger,
  useLeaveBalances,
  useLeaveTypes,
  useLendGive,
  useOwed,
  useWaive,
  type ExtraLeaveRequest,
  type LeaveBalance,
  type OwedRow,
} from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

// ============================================================
// Asking for more days when a balance runs out, and lending
// (may go below 0 — what is used is taken from next year) or
// giving extra days (kept). Plus the leave statement.
// ============================================================

const fmt = (k: string) => new Date(`${k}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const range = (a: string | null, b: string | null) => (a && b ? (a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`) : null);

// ─── Employee: ask for more days ────────────────────────────

export interface AskExtraInit {
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  days: number;
  startDate?: string;
  endDate?: string;
}

export function AskExtraDialog({ init, onClose }: { init: AskExtraInit | null; onClose: () => void }) {
  const ask = useAskExtra();
  const [d, setD] = useState(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!init) return;
    setD(Math.max(0.5, init.days));
    setReason('');
    setError(null);
  }, [init]);
  if (!init) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await ask.mutateAsync({ leaveTypeId: init.leaveTypeId, year: init.year, days: Number(d), startDate: init.startDate, endDate: init.endDate, reason });
      toast.success('Sent — you’ll get a notification when it’s answered');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={ask.isPending}
      icon={<Send />}
      title={`Ask for more ${init.leaveTypeName.toLowerCase()}`}
      description="HR can lend you days (taken from next year’s balance if you use them) or give you extra days."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={ask.isPending}>Cancel</Button>
          <Button type="submit" form="ask-extra" loading={ask.isPending}><Send /> Send</Button>
        </>
      }
    >
      <form id="ask-extra" onSubmit={submit} className="space-y-3">
        <FormError>{error}</FormError>
        {range(init.startDate ?? null, init.endDate ?? null) && <p className="rounded-lg bg-subtle/80 px-3 py-2 text-sm">For your leave on <b>{range(init.startDate ?? null, init.endDate ?? null)}</b></p>}
        <Field label="Days needed" htmlFor="ax-days" required><Input id="ax-days" type="number" min={0.5} max={366} step={0.5} value={d} onChange={(e) => setD(Number(e.target.value))} required /></Field>
        <Field label="Why" htmlFor="ax-reason" required><Textarea id="ax-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} placeholder="e.g. Recovering from surgery — doctor advised two more days" /></Field>
      </form>
    </Modal>
  );
}

// ─── Deciders: lend / give / decline ────────────────────────

export type LendInit = { request: ExtraLeaveRequest } | { employeeId?: string; leaveTypeId?: string };

/** One dialog for answering a request and for lending / giving without one. */
export function LendGiveDialog({ init, onClose }: { init: LendInit | null; onClose: () => void }) {
  const decide = useDecideExtra();
  const direct = useLendGive();
  const req = init && 'request' in init ? init.request : null;
  const year = req?.year ?? new Date().getFullYear();
  const [employeeId, setEmployeeId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [action, setAction] = useState<'lend' | 'give' | 'decline'>('lend');
  const [d, setD] = useState(1);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const types = useLeaveTypes(false, Boolean(init));
  const balances = useLeaveBalances(employeeId || undefined, year, Boolean(init && employeeId));
  const b: LeaveBalance | undefined = balances.data?.balances.find((x) => x.leaveType.id === typeId);
  const type = (types.data ?? []).find((t) => t.id === typeId);
  const quota = req?.leaveType.annualQuota ?? type?.annualQuota ?? 0;
  const canLend = Math.max(0, quota - (b?.lent ?? 0));

  useEffect(() => {
    if (!init) return;
    setError(null);
    setText('');
    if (req) {
      setEmployeeId(req.employee.id);
      setTypeId(req.leaveType.id);
      setD(req.days);
      setAction('lend');
    } else {
      const i = init as { employeeId?: string; leaveTypeId?: string };
      setEmployeeId(i.employeeId ?? '');
      setTypeId(i.leaveTypeId ?? '');
      setD(1);
      setAction('lend');
    }
  }, [init]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!init) return null;
  const busy = decide.isPending || direct.isPending;
  const balanced = (types.data ?? []).filter((t) => t.accrual !== 'NONE' && t.availability !== 'GRANT_ONLY' && t.isActive);
  const after = b?.available !== null && b?.available !== undefined ? (action === 'give' ? b.available + Number(d) : b.available) : null;
  const submit = async () => {
    setError(null);
    try {
      if (req) await decide.mutateAsync({ id: req.id, action, ...(action === 'decline' ? { note: text } : { days: Number(d) }) });
      else {
        if (!employeeId || !typeId) return setError('Choose a person and a leave type');
        await direct.mutateAsync({ employeeId, leaveTypeId: typeId, year, action: action === 'decline' ? 'lend' : action, days: Number(d), reason: text });
      }
      toast.success(action === 'decline' ? 'Request declined' : action === 'lend' ? `Lent ${days(Number(d))}` : `Gave ${days(Number(d))} extra`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save'));
    }
  };
  const blocked = action === 'decline' ? text.trim().length < 3 : !Number(d) || (action === 'lend' && Number(d) > canLend) || (!req && text.trim().length < 3);

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={<HandCoins />}
      title={req ? `${req.employee.firstName} ${req.employee.lastName} asks for ${days(req.days)} more ${req.leaveType.name.toLowerCase()}` : 'Lend or give leave days'}
      description={req ? [range(req.startDate, req.endDate), `Asked ${fmt(req.createdAt.slice(0, 10))}`].filter(Boolean).join(' · ') : 'For one person. Lent days used below 0 are taken from next year’s balance.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={action === 'decline' ? 'danger' : 'primary'} loading={busy} disabled={blocked} onClick={() => void submit()}>
            {action === 'decline' ? <><X /> Decline</> : action === 'lend' ? <><HandCoins /> Lend {days(Number(d) || 0)}</> : <><Plus /> Give {days(Number(d) || 0)}</>}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError>{error}</FormError>
        {req && <p className="rounded-lg bg-subtle/80 px-3 py-2 text-sm whitespace-pre-wrap">{req.reason}</p>}
        {!req && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Person" htmlFor="lg-person" required><PersonSearch id="lg-person" overlay value={employeeId} onChange={(id) => setEmployeeId(id)} /></Field>
            <Field label="Leave type" htmlFor="lg-type" required>
              <Select id="lg-type" className={inputClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">Choose…</option>
                {balanced.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Answer">
          {([['lend', 'Lend days', 'May go below 0; used days come from next year'], ['give', 'Give extra', 'Added for good'], ...(req ? [['decline', 'Decline', '']] : [])] as Array<[typeof action, string, string]>).map(([k, label, hint]) => (
            <button key={k} type="button" role="radio" aria-checked={action === k} title={hint} onClick={() => setAction(k)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', action === k ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
              {label}
            </button>
          ))}
        </div>
        {action !== 'decline' && (
          <Field label="Days" htmlFor="lg-days" hint={action === 'lend' ? `Up to ${days(canLend)} — next year’s quota is ${quota}${b?.lent ? `, ${b.lent} already lent` : ''}` : undefined} required>
            <Input id="lg-days" type="number" min={0.5} max={action === 'lend' ? canLend : 366} step={0.5} value={d} onChange={(e) => setD(Number(e.target.value))} invalid={action === 'lend' && Number(d) > canLend} />
          </Field>
        )}
        {b && action !== 'decline' && (
          <p className="rounded-lg border border-border px-3 py-2 text-sm" aria-live="polite">
            Now <b>{b.available}</b> available{b.below ? ` (may go ${b.below} below 0)` : ''} →{' '}
            {action === 'lend' ? (
              <>may go <b>{(b.below ?? 0) + Number(d)}</b> below 0 · up to {days((b.lent ?? 0) + Number(d))} taken from {year + 1} if used</>
            ) : (
              <><b>{after}</b> available · nothing taken back</>
            )}
          </p>
        )}
        {(action === 'decline' || !req) && (
          <Field label={action === 'decline' ? 'Why' : 'Reason'} htmlFor="lg-text" required hint={action === 'decline' ? 'The person sees this' : 'Kept in the leave statement'}>
            <Textarea id="lg-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder={action === 'decline' ? 'e.g. Please use unpaid leave for these days' : 'e.g. Family emergency — approved by HR head'} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

// ─── Leave statement ────────────────────────────────────────

const KIND_TONE: Record<string, string> = { LEAVE: 'text-foreground', TAKEN_BACK: 'text-destructive', DEDUCTION: 'text-destructive', CARRY_EXPIRED: 'text-destructive', LEND: 'text-info', WAIVED: 'text-success', EXTRA: 'text-success', YEAR_END: 'text-muted-foreground' };

export function LedgerDialog({ employeeId, balance, year, onClose }: { employeeId?: string; balance: LeaveBalance | null; year: number; onClose: () => void }) {
  const [y, setY] = useState(year);
  useEffect(() => setY(year), [balance, year]);
  const q = useLedger(balance ? { employeeId, leaveTypeId: balance.leaveType.id, year: y } : null);
  if (!balance) return null;
  const l = q.data;
  return (
    <Modal
      open
      onClose={onClose}
      icon={<BookOpenText />}
      title={`${balance.leaveType.name} · statement`}
      description="Every change to this balance, oldest first."
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setY(y - 1)} aria-label="Previous year">‹</Button>
        <b className="tabular-nums">{y}</b>
        <Button size="sm" variant="ghost" onClick={() => setY(y + 1)} aria-label="Next year" disabled={y >= new Date().getFullYear() + 1}>›</Button>
        {l && (l.lent > 0 || l.owedLeft > 0) && (
          <span className="ml-auto flex gap-1.5">
            {l.lent > 0 && <Badge tone="info">{days(l.lent)} lent</Badge>}
            {l.owedLeft > 0 && <Badge tone="warning">{days(l.owedLeft)} still owed</Badge>}
          </span>
        )}
      </div>
      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !l?.entries.length ? (
        <p className="text-sm text-muted-foreground">Nothing recorded for {y}.</p>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="py-1.5 pr-3 font-semibold">Date</th><th className="py-1.5 pr-3 font-semibold">What</th><th className="py-1.5 pr-3 text-right font-semibold">Days</th><th className="py-1.5 text-right font-semibold">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {l.entries.map((e, i) => (
                <tr key={i} className={cn(e.pending && 'opacity-70')}>
                  <td className="whitespace-nowrap py-2 pr-3 align-top tabular-nums text-muted-foreground">{fmt(e.date)}</td>
                  <td className="py-2 pr-3 align-top">
                    <span className={cn('font-medium', KIND_TONE[e.kind])}>{e.label.replace(/\d{4}-\d{2}-\d{2}/g, (k) => fmt(k))}</span>
                    {e.pending && <Badge tone="warning" className="ml-1.5">Pending</Badge>}
                    {(e.note || e.by) && <span className="block text-xs text-muted-foreground">{[e.note, e.by].filter(Boolean).join(' · ')}</span>}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right align-top tabular-nums">{e.days === null ? '—' : `${e.days > 0 ? '+' : ''}${e.days}`}</td>
                  <td className={cn('whitespace-nowrap py-2 text-right align-top font-semibold tabular-nums', (e.balance ?? 0) < 0 && 'text-destructive')}>{e.balance ?? '∞'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ─── The "Extra leave" tab (Leave approvals) ────────────────

export function ExtraLeavePanel() {
  const year = new Date().getFullYear();
  const requests = useExtraRequests({ view: 'decide' });
  const owed = useOwed(year);
  const waive = useWaive();
  const [lending, setLending] = useState<LendInit | null>(null);
  const [waiving, setWaiving] = useState<OwedRow | null>(null);
  const [note, setNote] = useState('');
  const owedRows = useMemo(() => owed.data?.rows ?? [], [owed.data]);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="flex flex-1 items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4 text-muted-foreground" /> Asking for more days {!!requests.data?.length && <Badge tone="warning">{requests.data.length}</Badge>}</h2>
          <Button size="sm" onClick={() => setLending({})}><HandCoins /> Lend / give days</Button>
        </div>
        {requests.isLoadingError ? (
          <ErrorState message={getApiErrorMessage(requests.error)} onRetry={() => requests.refetch()} />
        ) : !requests.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !requests.data.length ? (
          <EmptyState icon={<Check />} title="Nothing waiting" description="When someone runs out of a leave type and asks for more days, it shows here." />
        ) : (
          <ul className="divide-y divide-border">
            {requests.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <PersonAvatar person={r.employee} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.employee.firstName} {r.employee.lastName} · <span style={{ color: r.leaveType.color }}>{days(r.days)} more {r.leaveType.name.toLowerCase()}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{[range(r.startDate, r.endDate), r.reason].filter(Boolean).join(' · ')}</p>
                </div>
                <Button size="sm" onClick={() => setLending({ request: r })}>Review</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Undo2 className="h-4 w-4 text-muted-foreground" /> Owed to next year</h2>
        <p className="mb-3 text-xs text-muted-foreground">People below 0 or with lent days. If nothing changes, these days are taken from their {year + 1} balance.</p>
        {owed.isLoadingError ? (
          <ErrorState message={getApiErrorMessage(owed.error)} onRetry={() => owed.refetch()} />
        ) : !owed.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !owedRows.length ? (
          <p className="text-sm text-muted-foreground">Nobody owes days.</p>
        ) : (
          <ul className="divide-y divide-border">
            {owedRows.map((r) => (
              <li key={r.balanceId} className="flex flex-wrap items-center gap-3 py-2.5">
                <PersonAvatar person={r.employee} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {r.employee.firstName} {r.employee.lastName} · <span style={{ color: r.leaveType.color }}>{r.leaveType.name}</span>
                    {r.leaving && <Badge tone="danger" className="ml-2"><AlertTriangle className="h-3 w-3" /> Leaving — settle on exit</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Balance {r.available}{r.lent ? ` · ${days(r.lent)} lent` : ''}{r.owedLeft ? ` · ${days(r.owedLeft)} still owed from earlier` : ''}
                  </p>
                </div>
                <b className={cn('tabular-nums', r.owesAtYearEnd ? 'text-destructive' : 'text-muted-foreground')}>{r.owesAtYearEnd ? `−${r.owesAtYearEnd} in ${year + 1}` : 'nothing yet'}</b>
                {(r.owesAtYearEnd > 0 || r.owedLeft > 0) && <Button size="sm" variant="ghost" onClick={() => { setWaiving(r); setNote(''); }}>Waive</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <LendGiveDialog init={lending} onClose={() => setLending(null)} />
      <Modal
        open={Boolean(waiving)}
        onClose={() => setWaiving(null)}
        busy={waive.isPending}
        icon={<Undo2 />}
        tone="danger"
        title={waiving ? `Cancel what ${waiving.employee.firstName} owes?` : ''}
        description="Nothing will be taken from next year for this balance. Kept in their leave statement."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWaiving(null)} disabled={waive.isPending}>Keep it</Button>
            <Button
              variant="danger"
              loading={waive.isPending}
              disabled={note.trim().length < 3}
              onClick={async () => {
                try {
                  const r = await waive.mutateAsync({ balanceId: waiving!.balanceId, note });
                  toast.success(`Waived ${days(r.waived)}`);
                  setWaiving(null);
                } catch (err) {
                  toast.error(getApiErrorMessage(err, 'Could not waive'));
                }
              }}
            >
              Waive
            </Button>
          </>
        }
      >
        <Field label="Why" htmlFor="wv-note" required><Textarea id="wv-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Medical emergency — goodwill, approved by HR head" /></Field>
      </Modal>
    </div>
  );
}
