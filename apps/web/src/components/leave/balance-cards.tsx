'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { History, Infinity as InfinityIcon, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ACCRUAL_LABEL, days, useAdjustBalance, useBalanceHistory, useLeaveBalances, type LeaveBalance } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

/** One card per leave type: available / entitlement, used, pending. */
export function BalanceCards({ employeeId, year, canAdjust = false }: { employeeId?: string; year: number; canAdjust?: boolean }) {
  const q = useLeaveBalances(employeeId, year);
  const [adjusting, setAdjusting] = useState<LeaveBalance | null>(null);
  const [history, setHistory] = useState<LeaveBalance | null>(null);

  if (q.isLoading) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (q.isError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load balances')} onRetry={() => q.refetch()} />;

  return (
    <>
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
                  <p className="mt-0.5 text-xs text-muted-foreground">{ACCRUAL_LABEL[b.leaveType.accrual]}{!b.leaveType.isPaid && ' · unpaid'}</p>
                </div>
                {canAdjust && b.leaveType.accrual !== 'NONE' && (
                  <div className="-mr-1.5 -mt-1 flex">
                    <Button size="icon-sm" variant="ghost" aria-label={`History for ${b.leaveType.name}`} onClick={() => setHistory(b)}><History /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Adjust ${b.leaveType.name}`} onClick={() => setAdjusting(b)}><SlidersHorizontal /></Button>
                  </div>
                )}
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
            </Card>
          );
        })}
      </div>
      {adjusting && employeeId && <AdjustDialog balance={adjusting} employeeId={employeeId} year={year} onClose={() => setAdjusting(null)} />}
      {history && <HistoryDialog balance={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function AdjustDialog({ balance, employeeId, year, onClose }: { balance: LeaveBalance; employeeId: string; year: number; onClose: () => void }) {
  const adjust = useAdjustBalance();
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [amount, reason]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n * 2 !== Math.round(n * 2)) return setError('Enter a non-zero number in half-day steps, e.g. 2 or -0.5');
    try {
      await adjust.mutateAsync({ employeeId, leaveTypeId: balance.leaveType.id, year, days: n, reason });
      toast.success(`${balance.leaveType.name}: ${n > 0 ? '+' : ''}${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`);
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
      description={`Currently ${balance.available} available for ${year}. Use a negative number to take days away.`}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={adjust.isPending}>Cancel</Button>
          <Button type="submit" form="adjust-form" loading={adjust.isPending}>Save</Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={submit} className="space-y-3">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Field label="Days" htmlFor="adj-days" required hint="e.g. 2 for comp-off, -1 for encashment">
          <Input id="adj-days" type="number" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Reason" htmlFor="adj-reason" required hint="Kept in the balance history">
          <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} rows={2} />
        </Field>
      </form>
    </Modal>
  );
}

function HistoryDialog({ balance, onClose }: { balance: LeaveBalance; onClose: () => void }) {
  const q = useBalanceHistory(balance.balanceId);
  return (
    <Modal open onClose={onClose} icon={<History />} title={`${balance.leaveType.name} adjustments`} className="sm:max-w-md" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {q.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !q.data?.length ? (
        <p className="text-sm text-muted-foreground">No manual adjustments.</p>
      ) : (
        <ul className="divide-y divide-border">
          {q.data.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p>{a.reason}</p>
                <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}{a.adjustedBy && ` · ${a.adjustedBy.firstName} ${a.adjustedBy.lastName}`}</p>
              </div>
              <span className={a.days > 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>{a.days > 0 ? '+' : ''}{days(a.days)}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
