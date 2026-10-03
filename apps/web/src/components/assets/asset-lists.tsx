'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, CheckCircle2, Clock, PackageCheck, PackageOpen, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { FulfilDialog } from '@/components/assets/asset-dialogs';
import {
  CONDITION_LABEL,
  REQUEST_STATUS,
  useAcknowledgeAsset,
  useApproveAssetRequest,
  useCancelAssetRequest,
  useRejectAssetRequest,
  type AssetRequest,
  type HeldAsset,
  type SideStatus,
} from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

// ─── Assets someone holds ───────────────────────────────────

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
          {a.notes && ` · ${a.notes}`}
        </p>
      </>
    );
    return (
      <li key={a.id} className={cn('flex items-center gap-3 px-5 py-3', past && 'opacity-70')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"><PackageCheck className="h-4 w-4" /></span>
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

// ─── Requests ───────────────────────────────────────────────

const SIDE_ICON: Record<SideStatus, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5 text-warning" />,
  APPROVED: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  REJECTED: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  SKIPPED: <span className="h-3.5 w-3.5 text-center text-muted-foreground">–</span>,
};

function Side({ label, s }: { label: string; s: AssetRequest['it'] }) {
  return (
    <span className="inline-flex items-center gap-1" title={s.note ?? undefined}>
      {SIDE_ICON[s.status]}
      {label}
      {s.by && <span className="text-muted-foreground">({s.by.firstName})</span>}
    </span>
  );
}

type PageQuery = { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: { data: AssetRequest[]; meta: { total: number; page: number; limit: number; totalPages: number } } };

export function RequestList({ query, showEmployee, empty, page, onPage }: { query: PageQuery; showEmployee?: boolean; empty: string; page: number; onPage: (p: number) => void }) {
  const [deciding, setDeciding] = useState<{ r: AssetRequest; approve: boolean } | null>(null);
  const [fulfilling, setFulfilling] = useState<AssetRequest | null>(null);
  const cancel = useCancelAssetRequest();

  if (query.isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error, 'Could not load requests')} onRetry={() => query.refetch()} />;
  if (!query.data?.data.length) return <EmptyState icon={<PackageOpen />} title={empty} />;

  return (
    <div className="space-y-2">
      {query.data.data.map((r) => {
        const rejected = [r.it, r.hr].find((s) => s.status === 'REJECTED');
        return (
          <Card key={r.id} className="flex flex-wrap items-center gap-3 p-4">
            {showEmployee ? <PersonAvatar person={r.employee} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"><PackageOpen className="h-4 w-4" /></span>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {showEmployee && <span>{r.employee.firstName} {r.employee.lastName} · </span>}
                {r.type.name}
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{r.reason}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">{formatRelative(r.createdAt)}</span>
                {r.status !== 'CANCELLED' && <><Side label="IT head" s={r.it} /><Side label="HR" s={r.hr} /></>}
                {r.asset && <span>Got <Link className="font-medium hover:underline" href={`/app/assets/${r.asset.id}`}>{r.asset.tag}</Link></span>}
              </p>
              {rejected?.note && <p className="mt-1 text-xs text-destructive">“{rejected.note}”</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
              {r.canDecide && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setDeciding({ r, approve: false })}><X /> Reject</Button>
                  <Button size="sm" onClick={() => setDeciding({ r, approve: true })}><Check /> Approve as {r.decideAs === 'IT' ? 'IT head' : 'HR'}</Button>
                </>
              )}
              {r.canFulfil && <Button size="sm" onClick={() => setFulfilling(r)}><PackageCheck /> Hand over</Button>}
              {r.canCancel && (
                <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === r.id} onClick={() => cancel.mutate(r.id, { onSuccess: () => toast.success('Request cancelled'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not cancel')) })}>
                  Cancel
                </Button>
              )}
            </div>
          </Card>
        );
      })}
      <Pagination page={page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} limit={query.data.meta.limit} onPageChange={onPage} />
      <DecideDialog value={deciding} onClose={() => setDeciding(null)} />
      <FulfilDialog request={fulfilling} onClose={() => setFulfilling(null)} />
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
  const as = r.decideAs === 'IT' ? 'IT head' : 'HR';
  const other = r.decideAs === 'IT' ? r.hr : r.it;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (value.approve) {
        const res = await approve.mutateAsync({ id: r.id, note: text });
        toast.success(res.status === 'APPROVED' ? 'Approved — IT can now hand it over' : `Approved as ${as}; waiting for ${r.decideAs === 'IT' ? 'HR' : 'the IT head'}`);
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
      description={value.approve ? `You’re approving as ${as}. ${other.status === 'APPROVED' ? 'The other side already approved, so it will be ready to hand over.' : 'The other side still needs to approve.'}` : `${r.employee.firstName} will see your reason.`}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="decide-form" variant={value.approve ? 'primary' : 'danger'} loading={busy}>{value.approve ? 'Approve' : 'Reject'}</Button>
        </>
      }
    >
      <form id="decide-form" onSubmit={submit} className="space-y-3">
        <p className="rounded-md bg-muted px-3 py-2 text-sm">“{r.reason}”</p>
        {value.approve ? (
          <Field label="Note (optional)" htmlFor="dc-note"><Input id="dc-note" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} /></Field>
        ) : (
          <Field label="Reason" htmlFor="dc-reason" required><Textarea id="dc-reason" rows={3} value={text} onChange={(e) => setText(e.target.value)} required minLength={3} maxLength={500} /></Field>
        )}
      </form>
    </Modal>
  );
}
