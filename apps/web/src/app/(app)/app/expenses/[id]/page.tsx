'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Check, CircleDashed, Clock, Paperclip, Pencil, Plus, Send, SearchX, Trash2, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ApproveDialog, ItemDialog, PayDialog, RejectDialog } from '@/components/expenses/claim-dialogs';
import { CLAIM_STATUS, STAGE_LABEL, money, openReceipt, useCancelClaim, useClaim, useRemoveItem, useSubmitClaim, type ExpenseItem } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const q = useClaim(id);
  const submit = useSubmitClaim();
  const cancel = useCancelClaim();
  const removeItem = useRemoveItem(id);
  const [item, setItem] = useState<ExpenseItem | 'new' | null>(null);
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'pay' | 'cancel' | null>(null);

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/expenses"><ArrowLeft /> Expenses</Link>
    </Button>
  );
  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    return status === 404 ? <EmptyState icon={<SearchX />} title="Claim not found" action={back} /> : <ErrorState message={getApiErrorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const c = q.data!;
  const reduced = c.totals.approvedPaise < c.totals.claimedPaise;

  const doSubmit = async () => {
    try {
      await submit.mutateAsync(c.id);
      toast.success('Submitted for approval');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not submit'));
    }
  };

  return (
    <div className="space-y-4">
      <div>{back}</div>
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
              <Badge tone={CLAIM_STATUS[c.status].tone} dot>{CLAIM_STATUS[c.status].label}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <PersonAvatar person={c.employee} size="xs" /> {c.employee.firstName} {c.employee.lastName}
              {c.project && <> · Project {c.project.name}</>}
              {c.submittedAt && <> · submitted {formatRelative(c.submittedAt)}</>}
            </p>
            {c.status === 'REJECTED' && c.rejectionReason && (
              <p className="mt-3 flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Sent back: {c.rejectionReason}</p>
            )}
            {c.status === 'PAID' && (
              <p className="mt-3 text-sm text-success">Paid on {formatDate(c.paymentDate)} · reference {c.paymentReference}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums">{money(c.status === 'DRAFT' ? c.totals.claimedPaise : c.totals.approvedPaise)}</p>
            {reduced && <p className="text-xs text-muted-foreground">claimed {money(c.totals.claimedPaise)}</p>}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {c.canEdit && <Button onClick={doSubmit} loading={submit.isPending} disabled={!c.items.length}><Send /> {c.status === 'REJECTED' ? 'Resubmit' : 'Submit'}</Button>}
              {c.canDecide && (
                <>
                  <Button variant="secondary" onClick={() => setDialog('reject')}><X /> Send back</Button>
                  <Button onClick={() => setDialog('approve')}><Check /> Approve</Button>
                </>
              )}
              {c.canPay && <Button onClick={() => setDialog('pay')}><Wallet /> Mark paid</Button>}
              {c.canCancel && <Button variant="ghost" onClick={() => setDialog('cancel')}>Cancel claim</Button>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Items"
            description={`${c.totals.items} item${c.totals.items === 1 ? '' : 's'}`}
            action={c.canEdit && <Button size="sm" onClick={() => setItem('new')}><Plus /> Add item</Button>}
          />
          {!c.items.length ? (
            <EmptyState icon={<Paperclip />} title="No items yet" description="Add each expense with its receipt." className="py-8" />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {c.items.map((i) => {
                const lowered = i.approvedPaise !== null && i.approvedPaise < i.amountPaise;
                return (
                  <li key={i.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{i.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(i.date)} · {i.category.name}</p>
                      {lowered && <p className="mt-1 text-xs text-warning">Reduced to {money(i.approvedPaise)} — {i.adjustReason}</p>}
                      {i.possibleDuplicate && (
                        <p className="mt-1 text-xs text-warning">
                          Looks like an item in{' '}
                          <Link href={`/app/expenses/${i.possibleDuplicate.claimId}`} className="underline">{i.possibleDuplicate.title}</Link>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-semibold tabular-nums', lowered && 'text-muted-foreground line-through')}>{money(i.amountPaise)}</p>
                      {lowered && <p className="text-sm font-semibold tabular-nums">{money(i.approvedPaise)}</p>}
                    </div>
                    <div className="flex">
                      {i.hasReceipt && (
                        <Button size="icon-sm" variant="ghost" aria-label="Open receipt" onClick={() => openReceipt(c.id, i).catch((e) => toast.error(getApiErrorMessage(e)))}><Paperclip /></Button>
                      )}
                      {c.canEdit && (
                        <>
                          <Button size="icon-sm" variant="ghost" aria-label="Edit item" onClick={() => setItem(i)}><Pencil /></Button>
                          <Button size="icon-sm" variant="ghost" aria-label="Remove item" onClick={() => removeItem.mutate(i.id, { onError: (e) => toast.error(getApiErrorMessage(e)) })}><Trash2 /></Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Approvals" description={c.round > 1 ? `Submission ${c.round}` : undefined} />
          {!c.steps.length ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Submit the claim to start approvals: manager, then Finance and HR together.</p>
          ) : (
            <ol className="space-y-3 px-5 pb-5">
              {c.steps.map((s) => (
                <li key={s.stage} className="flex items-start gap-3 text-sm">
                  <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5',
                    s.status === 'APPROVED' ? 'bg-success-soft text-success' : s.status === 'REJECTED' ? 'bg-destructive-soft text-destructive' : s.status === 'SKIPPED' ? 'bg-muted text-muted-foreground' : 'bg-warning-soft text-warning')}>
                    {s.status === 'APPROVED' ? <Check /> : s.status === 'REJECTED' ? <X /> : s.status === 'SKIPPED' ? <CircleDashed /> : <Clock />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{STAGE_LABEL[s.stage]}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.actedBy
                        ? `${s.status === 'REJECTED' ? 'Sent back' : 'Approved'} by ${s.actedBy.firstName} ${s.actedBy.lastName}${s.onBehalfOf ? ` for ${s.onBehalfOf.firstName}` : ''}${s.actedAt ? ` · ${formatRelative(s.actedAt)}` : ''}`
                        : s.status === 'SKIPPED'
                          ? s.stage === 'MANAGER' ? 'No manager — went straight to Finance and HR' : 'Not needed'
                          : s.stage === 'MANAGER'
                            ? `Waiting for ${s.approvers.map((a) => a.firstName).join(' / ') || 'a manager'}`
                            : `Waiting for ${STAGE_LABEL[s.stage]}`}
                    </p>
                    {s.comments && <p className="mt-0.5 text-xs">“{s.comments}”</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <ItemDialog claimId={c.id} value={item} onClose={() => setItem(null)} />
      <ApproveDialog claim={dialog === 'approve' ? c : null} onClose={() => setDialog(null)} />
      <RejectDialog claim={dialog === 'reject' ? c : null} onClose={() => setDialog(null)} />
      <PayDialog claim={dialog === 'pay' ? c : null} onClose={() => setDialog(null)} />
      <ConfirmDialog
        isOpen={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        isDanger
        isLoading={cancel.isPending}
        title="Cancel this claim?"
        description="It won’t be paid. You can create a new claim later."
        confirmText="Cancel claim"
        cancelText="Keep it"
        onConfirm={async () => {
          try {
            await cancel.mutateAsync(c.id);
            toast.success('Claim cancelled');
            setDialog(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not cancel'));
          }
        }}
      />
    </div>
  );
}
