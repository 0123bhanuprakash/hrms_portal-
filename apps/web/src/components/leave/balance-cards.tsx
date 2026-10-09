'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpenText, Gift, HandCoins, Infinity as InfinityIcon, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ACCRUAL_LABEL, days, useAdjustBalance, useLeaveBalances, useLeaveTypes, type AdjustKind, type LeaveBalance } from '@/lib/company/leave';
import { LedgerDialog } from '@/components/leave/extra-leave';
import { Select } from '@/components/ui/pickers';
import { inputClass } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { GrantDialog, windowLabel } from '@/components/leave/grants';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

/** One card per leave type: available / entitlement, used, pending. */
export function BalanceCards({ employeeId, year, canAdjust = false }: { employeeId?: string; year: number; canAdjust?: boolean }) {
  const q = useLeaveBalances(employeeId, year);
  const [adjusting, setAdjusting] = useState<LeaveBalance | null>(null);
  const [history, setHistory] = useState<LeaveBalance | null>(null);
  const [granting, setGranting] = useState(false);
  // HR can grant "only when granted" leave from someone's profile
  const types = useLeaveTypes(false, canAdjust && Boolean(employeeId));
  const grantable = (types.data ?? []).filter((t) => t.availability === 'GRANT_ONLY' && t.isActive);

  if (q.isLoading) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (q.isError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load balances')} onRetry={() => q.refetch()} />;

  return (
    <>
      {canAdjust && employeeId && grantable.length > 0 && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => setGranting(true)}><Gift /> Grant leave</Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {q.data!.balances.map((b) => {
          const total = b.accrued + b.carriedForward + b.adjusted;
          const usedPct = total > 0 ? Math.min(100, ((b.used + b.pending) / total) * 100) : 0;
          return (
            <Card key={b.leaveType.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.leaveType.color }} />
                    {b.leaveType.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.grants ? 'Given by HR grant' : ACCRUAL_LABEL[b.leaveType.accrual]}{!b.leaveType.isPaid && ' · unpaid'}</p>
                </div>
                <div className="-mr-1.5 -mt-1 flex">
                  <Button size="icon-sm" variant="ghost" aria-label={`Statement for ${b.leaveType.name}`} title="Statement" onClick={() => setHistory(b)}><BookOpenText /></Button>
                  {canAdjust && b.leaveType.accrual !== 'NONE' && !b.grants && (
                    <Button size="icon-sm" variant="ghost" aria-label={`Adjust ${b.leaveType.name}`} title="Adjust" onClick={() => setAdjusting(b)}><SlidersHorizontal /></Button>
                  )}
                </div>
              </div>
              {b.available === null ? (
                <p className="mt-3 flex items-center gap-1.5 text-2xl font-semibold"><InfinityIcon className="h-6 w-6 text-muted-foreground" /><span className="text-sm font-normal text-muted-foreground">Unlimited</span></p>
              ) : (
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {b.available}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">of {total} available</span>
                </p>
              )}
              {b.available !== null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${usedPct}%`, backgroundColor: b.leaveType.color }} />
                </div>
              )}
              <p className="mt-auto pt-3 text-xs text-muted-foreground">
                Used {b.used}
                {b.pending > 0 && ` · ${b.pending} pending`}
                {b.carriedForward > 0 && ` · ${b.carriedForward} carried over`}
                {b.adjusted !== 0 && ` · ${b.adjusted > 0 ? '+' : ''}${b.adjusted} adjusted`}
                {b.leaveType.accrual === 'MONTHLY' && b.allocated !== b.accrued && ` · ${b.allocated} by year end`}
              </p>
              {(b.lent ?? 0) > 0 && <p className="text-xs font-medium text-info"><HandCoins className="mr-1 inline h-3 w-3" />{days(b.lent!)} lent · may go {b.below} below 0 · used days come from {year + 1}</p>}
              {(b.owedLeft ?? 0) > 0 && <p className="text-xs font-medium text-warning">{days(b.owedLeft!)} still owed — taken from {year + 1}</p>}
              {(b.yearEnd?.owe ?? 0) > 0 && !(b.owedLeft ?? 0) && <p className="text-xs font-medium text-destructive">−{b.yearEnd!.owe} will be taken from {year + 1}</p>}
              {b.grants?.map((g) => (
                <p key={g.id} className="text-xs text-muted-foreground">{days(g.days)} · {windowLabel(g.validFrom, g.validTo)}{g.left === 0 && g.taken < g.days ? ' · ended' : ''}</p>
              ))}
            </Card>
          );
        })}
      </div>
      {adjusting && employeeId && <AdjustDialog balance={adjusting} employeeId={employeeId} year={year} onClose={() => setAdjusting(null)} />}
      <LedgerDialog employeeId={employeeId} balance={history} year={year} onClose={() => setHistory(null)} />
      {employeeId && <GrantDialog open={granting} onClose={() => setGranting(false)} types={grantable} employeeId={employeeId} />}
    </>
  );
}

const KINDS: Array<{ id: AdjustKind; label: string; hint: string }> = [
  { id: 'EXTRA', label: 'Give extra', hint: 'Added for good — nothing taken back' },
  { id: 'LEND', label: 'Lend', hint: 'May go below 0; used days are taken from next year' },
  { id: 'CORRECTION', label: 'Correction', hint: 'Fix a mistake (+ or −)' },
  { id: 'DEDUCTION', label: 'Deduction', hint: 'Take days away (encashment, leave outside the system)' },
];

function AdjustDialog({ balance, employeeId, year, onClose }: { balance: LeaveBalance; employeeId: string; year: number; onClose: () => void }) {
  const adjust = useAdjustBalance();
  const [kind, setKind] = useState<AdjustKind>('EXTRA');
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [amount, reason, kind]);
  const n = Number(amount);
  const quota = balance.leaveType.annualQuota;
  const canLend = Math.max(0, quota - (balance.lent ?? 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!n || n * 2 !== Math.round(n * 2)) return setError('Enter a non-zero number in half-day steps, e.g. 2 or 0.5');
    const days_ = kind === 'DEDUCTION' ? -Math.abs(n) : kind === 'EXTRA' || kind === 'LEND' ? Math.abs(n) : n;
    if (kind === 'LEND' && days_ > canLend) return setError(`You can lend at most ${days(canLend)} — next year’s quota is ${quota}`);
    try {
      await adjust.mutateAsync({ employeeId, leaveTypeId: balance.leaveType.id, year, kind, days: days_, reason });
      toast.success(kind === 'LEND' ? `${balance.leaveType.name}: lent ${days(days_)}` : `${balance.leaveType.name}: ${days_ > 0 ? '+' : ''}${days_} ${Math.abs(days_) === 1 ? 'day' : 'days'}`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not adjust the balance'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={adjust.isPending}
      icon={<SlidersHorizontal />}
      title={`Adjust ${balance.leaveType.name}`}
      description={`Currently ${balance.available} available for ${year}${balance.lent ? ` · ${days(balance.lent)} lent` : ''}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={adjust.isPending}>Cancel</Button>
          <Button type="submit" form="adjust-form" loading={adjust.isPending}>Save</Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={submit} className="space-y-3">
        <FormError>{error}</FormError>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Kind">
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className={cn('rounded-xl border p-2.5 text-left', kind === k.id ? 'border-primary bg-primary-soft/60 ring-1 ring-primary' : 'border-border hover:bg-subtle')}>
              <span className="block text-sm font-semibold">{k.label}</span>
              <span className="block text-xs text-muted-foreground">{k.hint}</span>
            </button>
          ))}
        </div>
        <Field label="Days" htmlFor="adj-days" required hint={kind === 'LEND' ? `Up to ${days(canLend)} (next year’s quota)` : kind === 'CORRECTION' ? 'Negative to take days away' : undefined}>
          <Input id="adj-days" type="number" step="0.5" min={kind === 'CORRECTION' ? undefined : 0.5} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        {balance.available !== null && n > 0 && (
          <p className="rounded-lg border border-border px-3 py-2 text-sm" aria-live="polite">
            {kind === 'LEND'
              ? <>May go <b>{(balance.below ?? 0) + n}</b> below 0 · up to {days((balance.lent ?? 0) + n)} taken from {year + 1} if used</>
              : <>Available becomes <b>{balance.available + (kind === 'DEDUCTION' ? -n : n)}</b>{kind === 'EXTRA' ? ' · kept' : ''}</>}
          </p>
        )}
        <Field label="Reason" htmlFor="adj-reason" required hint="Kept in the leave statement">
          <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} rows={2} />
        </Field>
      </form>
    </Modal>
  );
}
