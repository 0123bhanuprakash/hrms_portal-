'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Camera, Check, Copy, MessageCircleQuestion, MessageSquare, Paperclip, Pencil, Plus, Send, SearchX, Trash2, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ApproveDialog, ItemDialog, PayDialog, RejectDialog } from '@/components/expenses/claim-dialogs';
import { ClaimStepper, FlagChips } from '@/components/expenses/claim-ui';
import {
  CLAIM_STATUS,
  STAGE_LABEL,
  money,
  openReceipt,
  useAskQuestion,
  useCancelClaim,
  useClaim,
  useCopyClaim,
  useRemoveItem,
  useReplyQuestion,
  useSubmitClaim,
  type Claim,
  type ExpenseItem,
} from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ViewingNow } from '@/components/live/viewing-now';

const RECEIPT_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.docx';

export default function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useClaim(id);
  const submit = useSubmitClaim();
  const cancel = useCancelClaim();
  const copy = useCopyClaim();
  const removeItem = useRemoveItem(id);
  const [item, setItem] = useState<ExpenseItem | 'new' | null>(null);
  const [queue, setQueue] = useState<File[]>([]);
  const [queued, setQueued] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'pay' | 'cancel' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
  const own = c.canEdit || c.canCancel || c.canReply;

  const addFiles = (files: FileList | File[]) => {
    const list = [...files].filter((f) => /\.(pdf|jpe?g|png|webp|docx)$/i.test(f.name));
    if (!list.length) {
      toast.error('Receipts can be PDF, JPG, PNG, WebP or Word files');
      return;
    }
    setQueue(list);
    setQueued(list.length);
  };
  const nextFile = queue[0] ?? null;

  const doSubmit = async () => {
    try {
      await submit.mutateAsync(c.id);
      toast.success('Sent for approval');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        {!own && <ViewingNow kind="expense" id={c.id} />}
      </div>
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{c.title}</h1>
              <Badge tone={CLAIM_STATUS[c.status].tone} dot>{CLAIM_STATUS[c.status].label}</Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <PersonAvatar person={c.employee} size="xs" /> {c.employee.firstName} {c.employee.lastName}
              {c.project && <> · Project {c.project.name}</>}
              {c.submittedAt && <> · sent {formatRelative(c.submittedAt)}</>}
              {c.round > 1 && <> · submission {c.round}</>}
            </p>
            {c.canDecide && c.flags.length > 0 && <div className="mt-2"><FlagChips flags={c.flags} /></div>}
            {c.status === 'REJECTED' && c.rejectionReason && (
              <p className="mt-3 flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Sent back: {c.rejectionReason}</p>
            )}
            {c.status === 'PAID' && <p className="mt-3 text-sm text-success">Paid on {formatDate(c.paymentDate)} · reference {c.paymentReference}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums">{money(c.status === 'DRAFT' || c.status === 'PENDING' ? c.totals.claimedPaise : c.totals.approvedPaise)}</p>
            {reduced && <p className="text-xs text-warning">{money(c.totals.claimedPaise - c.totals.approvedPaise)} not paid · claimed {money(c.totals.claimedPaise)}</p>}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {c.canEdit && <Button onClick={doSubmit} loading={submit.isPending} disabled={!c.items.length}><Send /> {c.status === 'REJECTED' ? 'Send again' : 'Send for approval'}</Button>}
              {c.canDecide && (
                <>
                  <Button variant="secondary" onClick={() => setDialog('reject')}><X /> Send back</Button>
                  <Button onClick={() => setDialog('approve')}><Check /> Approve</Button>
                </>
              )}
              {c.canPay && <Button onClick={() => setDialog('pay')}><Wallet /> Mark paid</Button>}
              {own && c.status !== 'DRAFT' && (
                <Button
                  variant="ghost"
                  loading={copy.isPending}
                  onClick={async () => {
                    try {
                      const n = await copy.mutateAsync(c.id);
                      toast.success('New draft made — attach this month’s bills');
                      router.push(`/app/expenses/${n.id}`);
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, 'Could not copy'));
                    }
                  }}
                >
                  <Copy /> Copy
                </Button>
              )}
              {c.canCancel && <Button variant="ghost" onClick={() => setDialog('cancel')}>Cancel claim</Button>}
            </div>
          </div>
        </div>
        {c.status !== 'DRAFT' && c.status !== 'CANCELLED' && <div className="rounded-xl bg-subtle/70 p-3"><ClaimStepper claim={c} /></div>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {c.canEdit && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              className={cn('flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-colors', dragging ? 'border-primary bg-primary-soft/60' : 'border-primary/30 bg-primary-soft/25')}
            >
              <Camera className="h-6 w-6 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Drop receipts here — each one becomes an item</p>
                <p className="text-xs text-muted-foreground">You pick the category and type the amount. PDF, JPG, PNG or WebP up to 10 MB; on a phone you can take photos.</p>
              </div>
              <input ref={fileRef} type="file" multiple accept={RECEIPT_TYPES} className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><Paperclip /> Choose files</Button>
            </div>
          )}
          <Card>
            <CardHeader
              title="Items"
              description={`${c.totals.items} item${c.totals.items === 1 ? '' : 's'}`}
              action={c.canEdit && <Button size="sm" onClick={() => setItem('new')}><Plus /> Add item</Button>}
            />
            {!c.items.length ? (
              <EmptyState icon={<Paperclip />} title="No items yet" description="Drop receipts above, or add each expense." className="py-8" />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {c.items.map((i) => {
                  const lowered = i.approvedPaise !== null && i.approvedPaise < i.amountPaise;
                  return (
                    <li key={i.id} className="flex items-start gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-medium', i.rejected && 'text-muted-foreground line-through')}>{i.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(i.date)} · {i.category.name}</p>
                        {i.overLimit && <p className="mt-1 text-xs text-destructive">⚑ Over the limit — “{i.overLimitReason}”</p>}
                        {i.rejected ? (
                          <p className="mt-1 text-xs text-destructive">Not paid — {i.adjustReason}</p>
                        ) : lowered ? (
                          <p className="mt-1 text-xs text-warning">Lowered to {money(i.approvedPaise)} — {i.adjustReason}</p>
                        ) : null}
                        {i.possibleDuplicate && (
                          <p className="mt-1 text-xs text-warning">
                            Looks like an item in <Link href={`/app/expenses/${i.possibleDuplicate.claimId}`} className="underline">{i.possibleDuplicate.title}</Link>
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-semibold tabular-nums', (lowered || i.rejected) && 'text-muted-foreground line-through')}>{money(i.amountPaise)}</p>
                        {lowered && <p className="text-sm font-semibold tabular-nums">{money(i.approvedPaise)}</p>}
                      </div>
                      <div className="flex">
                        {i.hasReceipt && <Button size="icon-sm" variant="ghost" aria-label="Open receipt" onClick={() => openReceipt(c.id, i).catch((e) => toast.error(getApiErrorMessage(e)))}><Paperclip /></Button>}
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
        </div>

        <div className="space-y-4">
          <Conversation claim={c} />
          <History claim={c} />
        </div>
      </div>

      <ItemDialog
        claimId={c.id}
        value={nextFile ? 'new' : item}
        file={nextFile}
        note={nextFile ? `Receipt ${queued - queue.length + 1} of ${queued}: ${nextFile.name}` : undefined}
        onClose={() => (nextFile ? setQueue((qq) => qq.slice(1)) : setItem(null))}
      />
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

/** Questions and answers — asking doesn't send the claim back. */
function Conversation({ claim: c }: { claim: Claim }) {
  const ask = useAskQuestion();
  const reply = useReplyQuestion();
  const [text, setText] = useState('');
  const comments = c.comments ?? [];
  const mode = c.canAsk ? 'ask' : c.canReply ? 'reply' : null;
  if (!comments.length && !mode) return null;
  const busy = ask.isPending || reply.isPending;
  const send = async () => {
    const body = text.trim();
    if (body.length < 2) return;
    try {
      if (mode === 'ask') await ask.mutateAsync({ id: c.id, body });
      else await reply.mutateAsync({ id: c.id, body });
      setText('');
      toast.success(mode === 'ask' ? 'Question sent — the claim stays with you' : 'Answer sent');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send'));
    }
  };
  return (
    <Card>
      <CardHeader title="Conversation" icon={<MessageSquare />} description={mode === 'ask' ? 'Ask before deciding — it isn’t sent back' : undefined} />
      <div className="space-y-2.5 px-5 pb-4">
        {comments.map((m) => (
          <div key={m.id} className={cn('flex gap-2', m.mine && 'flex-row-reverse')}>
            {m.author && <PersonAvatar person={m.author} size="xs" />}
            <div className={cn('max-w-[85%] rounded-xl px-3 py-2 text-sm', m.mine ? 'bg-primary-soft' : 'bg-subtle')}>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {m.kind === 'QUESTION' && <MessageCircleQuestion className="h-3 w-3" />}
                <b className="text-foreground">{m.mine ? 'You' : `${m.author?.firstName ?? ''} ${m.author?.lastName ?? ''}`}</b> · {formatRelative(m.createdAt)}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          </div>
        ))}
        {c.questionOpen && mode === 'reply' && <p className="rounded-lg bg-warning-soft px-3 py-1.5 text-xs text-warning">Your approver is waiting for your answer.</p>}
        {mode && (
          <div className="space-y-2">
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={mode === 'ask' ? 'e.g. Who was at the dinner?' : 'Write your answer…'} aria-label={mode === 'ask' ? 'Question' : 'Answer'} />
            <div className="flex justify-end"><Button size="sm" onClick={() => void send()} loading={busy} disabled={text.trim().length < 2}>{mode === 'ask' ? 'Ask' : 'Send answer'}</Button></div>
          </div>
        )}
      </div>
    </Card>
  );
}

function History({ claim: c }: { claim: Claim }) {
  const events: Array<{ at: string; text: string }> = [];
  events.push({ at: c.createdAt, text: 'Created' });
  if (c.submittedAt) events.push({ at: c.submittedAt, text: c.round > 1 ? `Sent again (submission ${c.round})` : 'Sent for approval' });
  for (const s of c.steps) {
    if (s.actedAt && s.actedBy) events.push({ at: s.actedAt, text: `${s.status === 'APPROVED' ? 'Approved' : 'Sent back'} by ${s.actedBy.firstName} ${s.actedBy.lastName} (${s.stage === 'MANAGER' ? s.label?.split(' · ')[0] ?? 'Manager' : STAGE_LABEL[s.stage]})${s.comments ? ` — “${s.comments}”` : ''}` });
  }
  for (const m of c.comments ?? []) events.push({ at: m.createdAt, text: `${m.kind === 'QUESTION' ? 'Question from' : 'Answer from'} ${m.author?.firstName ?? 'someone'}` });
  if (c.paidAt) events.push({ at: c.paidAt, text: `Marked paid · ${c.paymentReference ?? ''}` });
  events.sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card>
      <CardHeader title="History" />
      <ol className="space-y-2 px-5 pb-4">
        {events.map((e, i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="flex-1">{e.text}</span>
            <span className="shrink-0 text-muted-foreground">{formatRelative(e.at)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
