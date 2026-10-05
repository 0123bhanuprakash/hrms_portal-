'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Inbox, List, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Tabs } from '@/components/ui/feedback';
import { ClaimList } from '@/components/expenses/claim-list';
import { useAccess } from '@/lib/access/use-access';
import { useIsApprover } from '@/lib/company/projects';
import { money, useBulkApprove, useClaims } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';

type View = 'review' | 'asked' | 'all';

export default function ExpenseApprovalsPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const isApprover = useIsApprover('leave.approve');
  const financeOrHr = can('expense.finance') || can('expense.hr');
  const approver = can('expense.approve') || financeOrHr || isApprover;
  const seeAll = financeOrHr || (can('expense.view') && scopeOf('expense.view') !== 'own');
  const [chosen, setView] = useState<View | null>(null);
  const view = chosen ?? (approver ? 'review' : 'all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const list = useClaims(view === 'asked' ? { view: 'review', filter: 'asked', page } : { view, page }, approver || seeAll);
  const bulk = useBulkApprove();
  useEffect(() => setSelected(new Set()), [view, page]);

  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  const clean = useMemo(() => rows.filter((c) => c.canDecide && !c.flags.length && !c.questionOpen), [rows]);
  const waitingTotal = rows.reduce((n, c) => n + c.totals.claimedPaise, 0);

  if (!accessLoading && !(hasFeature('ops.expenses') && (approver || seeAll))) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t approve expense claims." />;

  const approveSelected = async (ids: string[]) => {
    try {
      const r = await bulk.mutateAsync(ids);
      toast.success(`Approved ${r.approved} claim${r.approved === 1 ? '' : 's'}${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}`);
      if (r.skipped.length) toast.error(r.skipped[0]!.reason);
      setSelected(new Set());
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve'));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expenses"
        title="Expense approvals"
        description="Your step on each claim — the manager step (team lead / PM / line manager), then Finance and HR, who both approve every claim."
      />
      {view === 'review' && list.data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Waiting for you', `${list.data.meta.total} claim${list.data.meta.total === 1 ? '' : 's'}`, money(waitingTotal) + ' on this page', 'text-info'],
            ['Clean — no flags', String(clean.length), clean.length ? 'approve them together' : 'none right now', 'text-success'],
            ['Flagged or questioned', String(rows.length - clean.length), 'over limit · duplicate · late · weekend', 'text-warning'],
          ].map(([l, v, sub, c]) => (
            <Card key={l} className="px-4 py-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p><p className={`text-xs font-semibold ${c}`}>{sub}</p></Card>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            ...(approver ? [{ id: 'review' as const, label: 'Waiting for me', icon: <Inbox />, ...(view === 'review' && list.data && { count: list.data.meta.total }) }] : []),
            ...(approver ? [{ id: 'asked' as const, label: 'Questions I asked', icon: <MessageCircleQuestion /> }] : []),
            ...(seeAll ? [{ id: 'all' as const, label: 'All claims', icon: <List /> }] : []),
          ]}
          value={view}
          onChange={(v) => { setView(v); setPage(1); }}
        />
        {view === 'review' && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {selected.size > 0 ? (
              <Button onClick={() => void approveSelected([...selected])} loading={bulk.isPending}><Check /> Approve {selected.size} selected</Button>
            ) : clean.length > 1 ? (
              <Button variant="secondary" onClick={() => void approveSelected(clean.map((c) => c.id))} loading={bulk.isPending}><Check /> Approve {clean.length} clean claims · {money(clean.reduce((n, c) => n + c.totals.claimedPaise, 0))}</Button>
            ) : null}
          </div>
        )}
      </div>
      <ClaimList
        query={list}
        showEmployee
        showFlags
        empty={view === 'review' ? 'Nothing is waiting for you' : view === 'asked' ? 'No open questions from you' : 'No claims yet'}
        page={page}
        onPage={setPage}
        {...(view === 'review' && {
          selected,
          onSelect: (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; }),
        })}
      />
    </div>
  );
}
