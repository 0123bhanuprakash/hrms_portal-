'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, Clock, Minus, PackageCheck, PackageOpen, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { HandOverDialog } from '@/components/assets/asset-dialogs';
import { ProductArt } from '@/components/assets/product-art';
import {
  CONDITION_LABEL,
  REQUEST_STATUS,
  STAGE_LABEL,
  useAcknowledgeAsset,
  useApproveAssetRequest,
  useCancelAssetRequest,
  useRejectAssetRequest,
  type AssetRequest,
  type HeldAsset,
} from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

// ─── Assets someone holds (profile tab) ─────────────────────

export function HeldAssets({ data, canConfirm, linkToAsset }: { data: { current: HeldAsset[]; past: HeldAsset[] }; canConfirm?: boolean; linkToAsset?: boolean }) {
  const ack = useAcknowledgeAsset();
  const confirm = async (a: HeldAsset) => {
    try {
      await ack.mutateAsync(a.id);
      toast.success(`Thanks — you confirmed ${a.asset.tag}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not confirm'));
    }
  };

  const row = (a: HeldAsset, past: boolean) => {
    const name = (
      <>
        <p className="truncate font-medium">{a.asset.name} <span className="font-normal text-muted-foreground">· {a.asset.tag}</span></p>
        <p className="truncate text-xs text-muted-foreground">
          {a.asset.type.name}
          {a.asset.serialNumber && ` · S/N ${a.asset.serialNumber}`}
          {past ? ` · ${formatDate(a.assignedAt)} – ${formatDate(a.returnedAt)}` : ` · since ${formatDate(a.assignedAt)} (${CONDITION_LABEL[a.conditionOut].toLowerCase()})`}
          {!past && a.dueBack && ` · on loan until ${formatDate(a.dueBack)}`}
        </p>
      </>
    );
    return (
      <li key={a.id} className={cn('flex items-center gap-3 px-5 py-3', past && 'opacity-70')}>
        <ProductArt icon={a.asset.type.icon} size="xs" />
        {linkToAsset ? <Link href={`/app/assets/${a.asset.id}`} className="min-w-0 flex-1 hover:underline">{name}</Link> : <div className="min-w-0 flex-1">{name}</div>}
        {!past &&
          (a.acknowledgedAt ? (
            <Badge tone="success" dot>Confirmed</Badge>
          ) : canConfirm ? (
            <Button size="sm" variant="soft" onClick={() => void confirm(a)} loading={ack.isPending && ack.variables === a.id}><Check /> I have it</Button>
          ) : (
            <Badge tone="warning" dot>Not confirmed</Badge>
          ))}
      </li>
    );
  };

  if (!data.current.length && !data.past.length) return <EmptyState icon={<PackageOpen />} title="No assets" description="Nothing has been handed over yet." />;
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <p className="border-b border-border px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">With {canConfirm ? 'you' : 'them'} now · {data.current.length}</p>
        {data.current.length ? <ul className="divide-y divide-border">{data.current.map((a) => row(a, false))}</ul> : <p className="px-5 py-4 text-sm text-muted-foreground">Nothing at the moment.</p>}
      </Card>
      {data.past.length > 0 && (
        <Card className="overflow-hidden">
          <p className="border-b border-border px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Returned · {data.past.length}</p>
          <ul className="divide-y divide-border">{data.past.map((a) => row(a, true))}</ul>
        </Card>
      )}
    </div>
  );
}

// ─── Request steps: team lead → manager → HR → IT head ──────

export function RequestSteps({ r }: { r: AssetRequest }) {
  if (r.source === 'KIT') return <p className="text-xs text-muted-foreground">Starter kit — no approvals needed{r.neededBy ? ` · ready by ${formatDate(r.neededBy)}` : ''}</p>;
  const steps = r.steps.filter((s) => s.status !== 'SKIPPED' || s.by);
  const handed = r.status === 'FULFILLED';
  return (
    <ol className="flex items-start gap-1 overflow-x-auto" aria-label="Approval steps">
      {[...steps.map((s) => ({ key: s.stage, label: s.label, who: s.by ? `${s.by.firstName} ${s.status === 'APPROVED' ? '✓' : '✕'}` : s.approver ? s.approver.firstName : s.stage === 'HR' ? 'HR' : s.stage === 'IT' ? 'IT head' : '', state: s.status === 'APPROVED' ? 'done' : s.status === 'REJECTED' ? 'back' : s.status === 'SKIPPED' ? 'skip' : r.stage === s.stage ? 'now' : 'todo' })),
        { key: 'HAND', label: 'Hand-over', who: handed ? (r.asset?.tag ?? 'done') : r.status === 'APPROVED' ? 'IT' : '', state: handed ? 'done' : r.status === 'APPROVED' ? 'now' : 'todo' }]
        .map((s, i, all) => (
          <React.Fragment key={s.key}>
            {i > 0 && <li aria-hidden className={cn('mt-2.5 h-0.5 min-w-3 flex-1 rounded', all[i - 1]!.state === 'done' ? 'bg-success' : 'bg-border')} />}
            <li className="flex shrink-0 items-start gap-1.5">
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2 [&_svg]:size-3',
                s.state === 'done' ? 'border-success bg-success-soft text-success' : s.state === 'now' ? 'border-info bg-info-soft text-info' : s.state === 'back' ? 'border-destructive bg-destructive-soft text-destructive' : 'border-border bg-surface text-muted-foreground')}>
                {s.state === 'done' ? <Check /> : s.state === 'back' ? <X /> : s.state === 'now' ? <Clock /> : s.state === 'skip' ? <Minus /> : <span className="text-[9px] font-bold">{i + 1}</span>}
              </span>
              <span className="leading-tight">
                <span className="block text-xs font-semibold">{s.label}</span>
                <span className="block max-w-[100px] truncate text-[11px] text-muted-foreground">{s.who}</span>
              </span>
            </li>
          </React.Fragment>
        ))}
    </ol>
  );
}

// ─── Requests ───────────────────────────────────────────────

type PageQuery = { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: { data: AssetRequest[]; meta: { total: number; page: number; limit: number; totalPages: number } } };

export function RequestList({ query, showEmployee, empty, page, onPage }: { query: PageQuery; showEmployee?: boolean; empty: string; page: number; onPage: (p: number) => void }) {
  const [deciding, setDeciding] = useState<{ r: AssetRequest; approve: boolean } | null>(null);
  const [handing, setHanding] = useState<AssetRequest | null>(null);
  const cancel = useCancelAssetRequest();

  if (query.isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error, 'Could not load requests')} onRetry={() => query.refetch()} />;
  if (!query.data?.data.length) return <EmptyState icon={<PackageOpen />} title={empty} />;

  return (
    <div className="space-y-2.5">
      {query.data.data.map((r) => {
        const rejected = r.steps.find((s) => s.status === 'REJECTED');
        return (
          <Card key={r.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <ProductArt icon={r.type.icon} size="xs" className="rounded-lg bg-subtle" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {showEmployee && <span className="inline-flex items-center gap-1.5"><PersonAvatar person={r.employee} size="xs" />{r.employee.firstName} {r.employee.lastName} ·</span>}
                  {r.type.name}
                  {r.kind === 'LOAN' && <Badge tone="primary">Loan {r.loanFrom ? `${formatDate(r.loanFrom)} – ` : 'until '}{formatDate(r.loanUntil)}</Badge>}
                  {r.source === 'KIT' && <Badge tone="info">Starter kit</Badge>}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">“{r.reason}”</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRelative(r.createdAt)}
                  {r.requestedBy && ` · asked by ${r.requestedBy.firstName} ${r.requestedBy.lastName}`}
                  {r.neededBy && ` · needed by ${formatDate(r.neededBy)}`}
                  {r.source === 'KIT' && ` · joins ${formatDate(r.employee.joiningDate)}`}
                  {r.asset && <> · got <Link className="font-medium text-foreground hover:underline" href={`/app/assets/${r.asset.id}`}>{r.asset.tag}</Link></>}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                {r.canDecide && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setDeciding({ r, approve: false })}><X /> Reject</Button>
                    <Button size="sm" onClick={() => setDeciding({ r, approve: true })}><Check /> Approve as {STAGE_LABEL[r.decideAs!].toLowerCase()}</Button>
                  </>
                )}
                {r.canFulfil && <Button size="sm" onClick={() => setHanding(r)}><PackageCheck /> Hand over</Button>}
                {r.canCancel && (
                  <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === r.id} onClick={() => cancel.mutate(r.id, { onSuccess: () => toast.success('Request cancelled'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not cancel')) })}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            {r.status !== 'CANCELLED' && <RequestSteps r={r} />}
            {rejected?.note && <p className="rounded-lg bg-destructive-soft px-3 py-1.5 text-xs text-destructive">{rejected.label}: “{rejected.note}”</p>}
          </Card>
        );
      })}
      <Pagination page={page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} limit={query.data.meta.limit} onPageChange={onPage} />
      <DecideDialog value={deciding} onClose={() => setDeciding(null)} />
      <HandOverDialog request={handing} onClose={() => setHanding(null)} />
    </div>
  );
}

function DecideDialog({ value, onClose }: { value: { r: AssetRequest; approve: boolean } | null; onClose: () => void }) {
  const approve = useApproveAssetRequest();
  const reject = useRejectAssetRequest();
  const [text, setText] = useState('');
  const busy = approve.isPending || reject.isPending;
  if (!value) return null;
  const { r } = value;
  const as = STAGE_LABEL[r.decideAs ?? 'HR'];
  const next = r.steps.slice(r.steps.findIndex((s) => s.stage === r.decideAs) + 1).find((s) => s.status === 'PENDING');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (value.approve) {
        const res = await approve.mutateAsync({ id: r.id, note: text });
        toast.success(res.status === 'APPROVED' ? 'Approved — IT can now hand it over' : `Approved as ${as.toLowerCase()} — now with ${next?.label ?? 'the next step'}`);
      } else {
        await reject.mutateAsync({ id: r.id, reason: text });
        toast.success('Request rejected');
      }
      setText('');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the decision'));
    }
  };

  return (
    <Modal
      open
      onClose={() => { setText(''); onClose(); }}
      busy={busy}
      icon={value.approve ? <Check /> : <X />}
      title={`${value.approve ? 'Approve' : 'Reject'} ${r.employee.firstName}’s ${r.type.name.toLowerCase()} request`}
      description={value.approve ? `You’re approving as ${as.toLowerCase()}. ${next ? `Next: ${next.label}.` : 'That’s the last step — IT can hand it over.'}` : `${r.employee.firstName} will see your reason.`}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="decide-form" variant={value.approve ? 'primary' : 'danger'} loading={busy}>{value.approve ? 'Approve' : 'Reject'}</Button>
        </>
      }
    >
      <form id="decide-form" onSubmit={submit} className="space-y-3">
        <p className="rounded-md bg-muted px-3 py-2 text-sm">“{r.reason}”{r.kind === 'LOAN' && <span className="block text-xs text-muted-foreground">Loan until {formatDate(r.loanUntil)}</span>}</p>
        {value.approve ? (
          <Field label="Note (optional)" htmlFor="dc-note"><Input id="dc-note" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} /></Field>
        ) : (
          <Field label="Reason" htmlFor="dc-reason" required><Textarea id="dc-reason" rows={3} value={text} onChange={(e) => setText(e.target.value)} required minLength={3} maxLength={500} /></Field>
        )}
      </form>
    </Modal>
  );
}
