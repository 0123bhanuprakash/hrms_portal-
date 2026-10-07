'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Plus, Receipt, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ClaimList } from '@/components/expenses/claim-list';
import { useAccess } from '@/lib/access/use-access';
import { useMyProjects } from '@/lib/company/projects';
import { useMyCard } from '@/lib/company/profile';
import { money, useClaims, useCopyClaim, useExpenseSummary, useSaveClaim, type ClaimStatus } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { NoProfile } from '@/components/profile/no-profile';
import { Select } from '@/components/ui/pickers';

type Tab = '' | 'needs' | ClaimStatus;

export default function MyExpensesPage() {
  const router = useRouter();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const allowed = hasFeature('ops.expenses') && can('expense.submit');
  const [tab, setTab] = useState<Tab>('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = useClaims({ view: 'mine', ...(tab === 'needs' ? { filter: 'needs_me' as const } : { status: tab || undefined }), page }, allowed);
  const summary = useExpenseSummary(allowed && Boolean(me.data?.employee));
  const copy = useCopyClaim();

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Expenses aren’t available" />;
  if (me.isLoadingError) return <ErrorState message={getApiErrorMessage(me.error, 'Could not load your profile')} onRetry={() => void me.refetch()} />;
  if (me.isSuccess && !me.data?.employee) return <NoProfile icon={<Receipt />} what="Expense claims need an employee profile." />;
  const s = summary.data;

  const doCopy = async (id: string) => {
    try {
      const c = await copy.mutateAsync(id);
      toast.success('New draft made — attach this month’s bills');
      router.push(`/app/expenses/${c.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not copy'));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expenses"
        title="My expenses"
        description="Add receipts to a claim and follow it: your manager, then Finance and HR, then Finance pays you."
        action={<Button onClick={() => setCreating(true)}><Plus /> New claim</Button>}
      />

      {summary.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(summary.error, 'Could not load your expense summary')} onRetry={() => void summary.refetch()} />
      ) : !s ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Claimed this month', money(s.thisMonth.paise), `${s.thisMonth.items} item${s.thisMonth.items === 1 ? '' : 's'} sent`, 'text-muted-foreground'],
            ['Waiting for approval', money(s.waiting.paise), s.waiting.claims ? `${s.waiting.claims} claim${s.waiting.claims === 1 ? '' : 's'}${s.waiting.oldestSince ? ` · oldest ${formatRelative(s.waiting.oldestSince)}` : ''}` : 'nothing waiting', 'text-info'],
            ['Approved, to be paid', money(s.toBePaid.paise), s.toBePaid.claims ? 'Finance marks it paid' : 'nothing to be paid', 'text-primary'],
            ['Paid this year', money(s.paidThisYear.paise), `${s.paidThisYear.claims} claim${s.paidThisYear.claims === 1 ? '' : 's'}`, 'text-success'],
          ].map(([l, v, sub, c]) => (
            <Card key={l} className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{l}</p>
              <p className="text-xl font-bold tabular-nums">{v}</p>
              <p className={cn('truncate text-xs font-semibold', c)}>{sub}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <Tabs
            tabs={[
              { id: '' as const, label: 'All' },
              { id: 'needs' as const, label: 'Needs me', ...(s?.needsMe ? { count: s.needsMe } : {}) },
              { id: 'PENDING' as const, label: 'Waiting' },
              { id: 'APPROVED' as const, label: 'To be paid' },
              { id: 'PAID' as const, label: 'Paid' },
              { id: 'DRAFT' as const, label: 'Drafts', ...(s?.drafts ? { count: s.drafts } : {}) },
            ]}
            value={tab}
            onChange={(t) => { setTab(t); setPage(1); }}
          />
          <ClaimList
            query={list}
            empty={tab === 'needs' ? 'Nothing needs you right now' : 'No claims here'}
            page={page}
            onPage={setPage}
            action={(c) => (c.status === 'DRAFT' ? null : <Button size="icon-sm" variant="ghost" aria-label={`Copy ${c.title}`} title="Copy as a new draft (monthly bills)" onClick={() => void doCopy(c.id)}><Copy /></Button>)}
          />
        </div>
        <div className="space-y-3">
          {s && s.limits.length > 0 && (
            <Card className="space-y-3 p-4">
              <p className="text-sm font-semibold">Your limits this month</p>
              {s.limits.map((l) => {
                const pct = Math.min(100, (l.usedPaise / l.capPaise) * 100);
                return (
                  <div key={l.category.id}>
                    <div className="flex justify-between gap-2 text-xs"><span>{l.category.name}</span><b className="tabular-nums">{money(l.usedPaise)} <span className="font-normal text-muted-foreground">/ {money(l.capPaise)}</span></b></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', pct >= 100 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground">Going over is allowed with a reason — it’s flagged to your approvers.</p>
            </Card>
          )}
          <Card className="space-y-2 bg-gradient-to-br from-primary-soft/50 to-transparent p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Copy className="h-4 w-4" /> Monthly bills</p>
            <p className="text-xs text-muted-foreground">Internet or phone every month? Use the copy button on last month’s claim — same items, moved to this month. Just attach the new bills.</p>
          </Card>
        </div>
      </div>
      {creating && <NewClaimDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewClaimDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const save = useSaveClaim();
  const projects = useMyProjects();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const mine = (projects.data ?? []).filter((a) => a.active);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const c = await save.mutateAsync({ title, projectId: projectId || null });
      onClose();
      router.push(`/app/expenses/${c.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not create the claim'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Receipt />}
      title="New expense claim"
      description="Next you’ll add each expense with its receipt — or drop several receipts at once."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="new-claim" loading={save.isPending}>Create</Button>
        </>
      }
    >
      <form id="new-claim" onSubmit={submit} className="space-y-3">
        <Field label="Title" htmlFor="nc-title" required hint="e.g. Client visit — Mumbai, October">
          <Input id="nc-title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} />
        </Field>
        {mine.length > 0 && (
          <Field label="Project (optional)" htmlFor="nc-project" hint="Client projects mark the spend as re-billable">
            <Select id="nc-project" className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Not for a project</option>
              {mine.map((a) => <option key={a.project.id} value={a.project.id}>{a.project.name}</option>)}
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  );
}
