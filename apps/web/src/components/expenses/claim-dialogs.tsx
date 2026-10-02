'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, IndianRupee, Paperclip, Receipt, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import {
  STAGE_LABEL,
  money,
  useApproveClaim,
  useExpenseCategories,
  usePayClaim,
  useRejectClaim,
  useSaveItem,
  type Claim,
  type ExpenseItem,
} from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Add / edit one line item, with an optional receipt. */
export function ItemDialog({ claimId, value, onClose }: { claimId: string; value: ExpenseItem | 'new' | null; onClose: () => void }) {
  const cats = useExpenseCategories();
  const save = useSaveItem(claimId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ categoryId: '', date: todayKey(), description: '', amount: '' });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setError(null);
    setReceipt(null);
    setRemoveReceipt(false);
    setF(
      value === 'new'
        ? { categoryId: cats.data?.[0]?.id ?? '', date: todayKey(), description: '', amount: '' }
        : { categoryId: value.category.id, date: value.date, description: value.description, amount: (value.amountPaise / 100).toFixed(2) },
    );
  }, [value, cats.data]);
  if (!value) return null;
  const editing = value !== 'new' ? value : null;
  const cat = cats.data?.find((c) => c.id === f.categoryId);
  const paise = Math.round(Number(f.amount || 0) * 100);
  const needsReceipt = cat && cat.receiptRequiredAbovePaise !== null && paise > cat.receiptRequiredAbovePaise;
  const hasReceipt = Boolean(receipt) || (editing?.hasReceipt && !removeReceipt);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (receipt && receipt.size > 10 * 1024 * 1024) return setError('Receipt must be 10 MB or smaller');
    try {
      await save.mutateAsync({ ...(editing && { id: editing.id }), ...f, receipt, ...(removeReceipt && { removeReceipt: true }) });
      toast.success(editing ? 'Item updated' : 'Item added');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the item'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Receipt />}
      title={editing ? 'Edit item' : 'Add an expense'}
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="item-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{error}</p>}
        <Field label="Category" htmlFor="it-cat" required hint={cat?.maxPerItemPaise ? `Up to ${money(cat.maxPerItemPaise)} per item` : cat?.description ?? undefined}>
          <select id="it-cat" className={inputClass} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} required>
            {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Date" htmlFor="it-date" required>
          <Input id="it-date" type="date" value={f.date} max={todayKey()} onChange={(e) => setF({ ...f, date: e.target.value })} required />
        </Field>
        <Field label="What was it for" htmlFor="it-desc" required className="sm:col-span-2">
          <Input id="it-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required minLength={2} maxLength={300} placeholder="e.g. Cab from airport to client office" />
        </Field>
        <Field label="Amount (₹)" htmlFor="it-amount" required>
          <div className="relative">
            <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input id="it-amount" type="number" min={1} step="0.01" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required className="pl-8 tabular-nums" />
          </div>
        </Field>
        <Field label="Receipt" htmlFor="it-receipt" hint={needsReceipt ? (hasReceipt ? 'Required — attached' : 'Required for this amount') : 'Optional'}>
          <input ref={fileRef} id="it-receipt" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" className="sr-only" onChange={(e) => { setReceipt(e.target.files?.[0] ?? null); setRemoveReceipt(false); e.target.value = ''; }} />
          {receipt || (editing?.hasReceipt && !removeReceipt) ? (
            <p className="flex h-9 items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="truncate">{receipt?.name ?? editing?.receiptName}</span>
              <Button size="icon-sm" variant="ghost" aria-label="Remove receipt" onClick={() => (receipt ? setReceipt(null) : setRemoveReceipt(true))}><X /></Button>
            </p>
          ) : (
            <Button variant={needsReceipt ? 'primary' : 'secondary'} className="w-full" onClick={() => fileRef.current?.click()}><Paperclip /> Attach receipt</Button>
          )}
        </Field>
      </form>
    </Modal>
  );
}

/** Approve — Finance / HR may pay less for some items (with a reason). */
export function ApproveDialog({ claim, onClose }: { claim: Claim | null; onClose: () => void }) {
  const approve = useApproveClaim();
  const [note, setNote] = useState('');
  const [adj, setAdj] = useState<Record<string, { amount: string; reason: string }>>({});
  useEffect(() => {
    setNote('');
    setAdj({});
  }, [claim]);
  if (!claim) return null;

  const changed = Object.entries(adj).filter(([id, a]) => {
    const it = claim.items.find((i) => i.id === id)!;
    return a.amount !== '' && Math.round(Number(a.amount) * 100) < (it.approvedPaise ?? it.amountPaise);
  });
  const total = claim.items.reduce((s, i) => {
    const a = adj[i.id];
    const current = i.approvedPaise ?? i.amountPaise;
    const proposed = a && a.amount !== '' ? Math.min(current, Math.round(Number(a.amount) * 100)) : current;
    return s + proposed;
  }, 0);

  const submit = async () => {
    if (changed.some(([, a]) => a.reason.trim().length < 3)) {
      toast.error('Give a reason for each reduced amount');
      return;
    }
    try {
      const r = await approve.mutateAsync({
        id: claim.id,
        note: note || null,
        ...(changed.length && { adjustments: changed.map(([itemId, a]) => ({ itemId, approvedAmount: Number(a.amount), reason: a.reason.trim() })) }),
      });
      toast.success(r.status === 'APPROVED' ? 'Approved — ready to be paid' : `${STAGE_LABEL[claim.decideStage!]} approval saved`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={approve.isPending}
      icon={<Check />}
      title={`Approve as ${STAGE_LABEL[claim.decideStage ?? 'MANAGER']}`}
      description={`${claim.employee.firstName} ${claim.employee.lastName} · ${claim.title}`}
      className={claim.canAdjust ? 'sm:max-w-2xl' : 'sm:max-w-md'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={approve.isPending}>Cancel</Button>
          <Button onClick={submit} loading={approve.isPending}><Check /> Approve {money(total)}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {claim.canAdjust && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">To pay less for an item, enter the amount to reimburse and why. If Finance and HR both lower an item, the lower amount is paid.</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {claim.items.map((i) => (
                <li key={i.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_120px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.category.name} · claimed {money(i.amountPaise)}
                      {i.approvedPaise !== null && ` · already lowered to ${money(i.approvedPaise)}`}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={((i.approvedPaise ?? i.amountPaise) / 100).toFixed(2)}
                    value={adj[i.id]?.amount ?? ''}
                    onChange={(e) => setAdj({ ...adj, [i.id]: { amount: e.target.value, reason: adj[i.id]?.reason ?? '' } })}
                    aria-label={`Amount to reimburse for ${i.description}`}
                    className="tabular-nums"
                  />
                  {adj[i.id]?.amount && Math.round(Number(adj[i.id]!.amount) * 100) < (i.approvedPaise ?? i.amountPaise) && (
                    <Input
                      className="sm:col-span-2"
                      placeholder="Reason (the employee will see this)"
                      value={adj[i.id]!.reason}
                      onChange={(e) => setAdj({ ...adj, [i.id]: { ...adj[i.id]!, reason: e.target.value } })}
                      maxLength={300}
                      aria-label={`Reason for ${i.description}`}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field label="Note (optional)" htmlFor="ap-note"><Textarea id="ap-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} /></Field>
      </div>
    </Modal>
  );
}

export function RejectDialog({ claim, onClose }: { claim: Claim | null; onClose: () => void }) {
  const reject = useRejectClaim();
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [claim]);
  if (!claim) return null;
  return (
    <Modal
      open
      onClose={onClose}
      busy={reject.isPending}
      icon={<X />}
      title="Send this claim back?"
      description="The employee can fix it and submit again."
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={reject.isPending}>Cancel</Button>
          <Button
            variant="danger"
            loading={reject.isPending}
            disabled={reason.trim().length < 3}
            onClick={async () => {
              try {
                await reject.mutateAsync({ id: claim.id, reason: reason.trim() });
                toast.success('Claim sent back');
                onClose();
              } catch (err) {
                toast.error(getApiErrorMessage(err, 'Could not send it back'));
              }
            }}
          >
            Send back
          </Button>
        </>
      }
    >
      <Field label="What needs fixing" htmlFor="rj-reason" required>
        <Textarea id="rj-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="e.g. The hotel bill is missing the GST number" />
      </Field>
    </Modal>
  );
}

export function PayDialog({ claim, onClose }: { claim: Claim | null; onClose: () => void }) {
  const pay = usePayClaim();
  const [date, setDate] = useState(todayKey());
  const [ref, setRef] = useState('');
  useEffect(() => {
    setDate(todayKey());
    setRef('');
  }, [claim]);
  if (!claim) return null;
  return (
    <Modal
      open
      onClose={onClose}
      busy={pay.isPending}
      icon={<Wallet />}
      title={`Mark ${money(claim.totals.approvedPaise)} paid`}
      description={`${claim.employee.firstName} ${claim.employee.lastName} · ${claim.title}`}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pay.isPending}>Cancel</Button>
          <Button
            loading={pay.isPending}
            disabled={ref.trim().length < 2}
            onClick={async () => {
              try {
                await pay.mutateAsync({ id: claim.id, paymentDate: date, reference: ref.trim() });
                toast.success('Marked paid — the employee has been told');
                onClose();
              } catch (err) {
                toast.error(getApiErrorMessage(err, 'Could not mark paid'));
              }
            }}
          >
            Mark paid
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Paid on" htmlFor="pay-date" required><Input id="pay-date" type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Payment reference" htmlFor="pay-ref" required hint="e.g. UTR / transaction ID"><Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} /></Field>
      </div>
    </Modal>
  );
}
