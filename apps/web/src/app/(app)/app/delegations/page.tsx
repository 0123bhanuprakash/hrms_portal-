'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, CalendarRange, Info, ShieldCheck, UserCheck, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { SCOPE_LABELS, useAccess } from '@/lib/access/use-access';
import { useOrgChart } from '@/lib/company/org';
import { useAllDelegations, useCreateDelegation, useMyDelegations, useRevokeDelegation, type Delegation } from '@/lib/company/advanced';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';

const STATUS: Record<Delegation['status'], { label: string; tone: 'success' | 'info' | 'neutral' }> = {
  active: { label: 'Active', tone: 'success' },
  upcoming: { label: 'Upcoming', tone: 'info' },
  ended: { label: 'Ended', tone: 'neutral' },
  revoked: { label: 'Ended early', tone: 'neutral' },
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function DelegationsPage() {
  const { can } = useAccess();
  const me = useMyDelegations();
  const isAdmin = can('user.view');
  const all = useAllDelegations(isAdmin);

  if (me.isError) return <ErrorState message={getApiErrorMessage(me.error, 'Could not load delegations')} onRetry={() => me.refetch()} />;

  const covering = me.data?.received.filter((d) => d.status === 'active' || d.status === 'upcoming') ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title="Delegation"
        description="Going on leave? Hand your approvals to a colleague for a set period. They approve for your team, with your reach — and it ends automatically."
      />

      {covering.length > 0 && (
        <Card className="space-y-2 border-success/30 bg-success-soft/30 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><UserCheck className="h-4 w-4 text-success" /> You’re covering for</p>
          {covering.map((d) => (
            <p key={d.id} className="text-sm">
              <b>{d.delegator.name}</b> · {formatDate(d.startsAt)} – {formatDate(d.endsAt)} <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
              {d.reason && <span className="text-muted-foreground"> · {d.reason}</span>}
            </p>
          ))}
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="My delegations" description="Approvals you’ve handed over." icon={<ArrowRightLeft />} />
          {me.isLoading ? (
            <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          ) : !me.data?.given.length ? (
            <EmptyState icon={<CalendarRange />} title="Nothing delegated" description={me.data?.canDelegate ? 'Use the form to hand over your approvals while you’re away.' : 'You have no approvals to delegate.'} />
          ) : (
            <DelegationList items={me.data.given} show="delegate" />
          )}
        </Card>

        {me.data?.canDelegate ? (
          <DelegateForm delegable={me.data.delegable} />
        ) : (
          <Card className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Delegation is for people who approve leave or attendance (e.g. managers and team leads). Your roles don’t include approvals.</p>
          </Card>
        )}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader title="All current & upcoming" description="Every active hand-over in the company. Admins can end one early or set one up on someone’s behalf." icon={<ShieldCheck />} />
          {all.isLoading ? (
            <div className="p-4"><Skeleton className="h-14" /></div>
          ) : !all.data?.length ? (
            <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">No delegations right now.</p>
          ) : (
            <DelegationList items={all.data} show="both" />
          )}
          {can('user.edit') && <div className="border-t border-border p-4"><DelegateForm onBehalf delegable={[]} /></div>}
        </Card>
      )}
    </div>
  );
}

function DelegationList({ items, show }: { items: Delegation[]; show: 'delegate' | 'both' }) {
  const revoke = useRevokeDelegation();
  return (
    <ul className="divide-y divide-border border-t border-border">
      {items.map((d) => (
        <li key={d.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {show === 'both' ? <>{d.delegator.name} <ArrowRightLeft className="inline h-3.5 w-3.5 text-muted-foreground" /> {d.delegate.name}</> : <>To {d.delegate.name}</>}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(d.startsAt)} – {formatDate(d.endsAt)}
              {d.reason ? ` · ${d.reason}` : ''}
            </p>
          </div>
          <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
          {(d.status === 'active' || d.status === 'upcoming') && (
            <Button
              variant="ghost"
              size="sm"
              loading={revoke.isPending && revoke.variables === d.id}
              onClick={() =>
                revoke.mutate(d.id, {
                  onSuccess: () => toast.success(`Ended — ${d.delegate.name} no longer covers for ${d.delegator.name}`),
                  onError: (e) => toast.error(getApiErrorMessage(e, 'Could not end the delegation')),
                })
              }
            >
              <X /> End now
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function DelegateForm({ delegable, onBehalf }: { delegable: Array<{ key: string; label: string; scope: import('@hrms/types').AccessScope | null }>; onBehalf?: boolean }) {
  const chart = useOrgChart();
  const myId = useAuthStore((s) => s.user?.id);
  const create = useCreateDelegation();
  const [delegatorId, setDelegatorId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [startsAt, setStartsAt] = useState(isoDate(new Date()));
  const [endsAt, setEndsAt] = useState(isoDate(new Date(Date.now() + 7 * 864e5)));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const people = useMemo(() => (chart.data?.employees ?? []).filter((e) => e.userId), [chart.data]);
  const fromId = onBehalf ? delegatorId : myId;
  // Unique field ids: an admin sees this form twice (mine + on someone's behalf)
  const p = onBehalf ? 'dlb' : 'dl';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (onBehalf && !delegatorId) return setError('Choose whose approvals to hand over');
    if (!delegateId) return setError('Choose who covers');
    const today = isoDate(new Date());
    create.mutate(
      {
        delegateId,
        ...(onBehalf && { delegatorId }),
        // Today → start now; a later date → start of that day
        ...(startsAt > today && { startsAt: new Date(`${startsAt}T00:00:00`).toISOString() }),
        endsAt: new Date(`${endsAt}T23:59:59`).toISOString(),
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: (d) => {
          toast.success(`${d.delegate.name} covers ${onBehalf ? `${d.delegator.name}'s` : 'your'} approvals until ${formatDate(d.endsAt)}`);
          setDelegateId('');
          setReason('');
        },
        onError: (err) => setError(getApiErrorMessage(err, 'Could not set up the delegation')),
      },
    );
  };

  const form = (
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {onBehalf && (
        <Field label="Whose approvals" htmlFor={`${p}-from`}>
          <select id={`${p}-from`} className={inputClass} value={delegatorId} onChange={(e) => setDelegatorId(e.target.value)}>
            <option value="">Choose…</option>
            {people.map((p) => <option key={p.userId} value={p.userId}>{p.firstName} {p.lastName}</option>)}
          </select>
        </Field>
      )}
      <Field label="Who covers" htmlFor={`${p}-to`} hint="They approve for your team, with your reach — on top of their own.">
        <select id={`${p}-to`} className={inputClass} value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
          <option value="">Choose a colleague…</option>
          {people.filter((p) => p.userId !== fromId).map((p) => (
            <option key={p.userId} value={p.userId}>{p.firstName} {p.lastName}{p.designation ? ` — ${p.designation.name}` : ''}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor={`${p}-start`}><Input id={`${p}-start`} type="date" value={startsAt} min={isoDate(new Date())} onChange={(e) => setStartsAt(e.target.value)} /></Field>
        <Field label="Until (inclusive)" htmlFor={`${p}-end`}><Input id={`${p}-end`} type="date" value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
      </div>
      <Field label="Reason" htmlFor={`${p}-reason`}><Input id={`${p}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Annual leave" /></Field>
      <Button type="submit" className="w-full" loading={create.isPending}><ArrowRightLeft /> {onBehalf ? 'Set up delegation' : 'Hand over my approvals'}</Button>
      <p className="text-xs text-muted-foreground">Up to 90 days. You can end it early at any time. Nobody can approve their own requests.</p>
    </form>
  );

  if (onBehalf) return <div><p className="mb-3 text-sm font-semibold">Set up on someone’s behalf</p>{form}</div>;
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold">Hand over my approvals</p>
      <div className="mb-4 mt-2 flex flex-wrap gap-1">
        {delegable.map((d) => <Badge key={d.key} tone="primary">{d.label}{d.scope ? ` · ${SCOPE_LABELS[d.scope].label.toLowerCase()}` : ''}</Badge>)}
      </div>
      {form}
    </Card>
  );
}
