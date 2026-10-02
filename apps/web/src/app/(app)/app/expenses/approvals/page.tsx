'use client';

import React, { useState } from 'react';
import { Inbox, List, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Tabs } from '@/components/ui/feedback';
import { ClaimList } from '@/components/expenses/claim-list';
import { useAccess } from '@/lib/access/use-access';
import { useIsApprover } from '@/lib/company/projects';
import { useClaims } from '@/lib/company/expenses';

export default function ExpenseApprovalsPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const isApprover = useIsApprover('leave.approve');
  const financeOrHr = can('expense.finance') || can('expense.hr');
  const approver = can('expense.approve') || financeOrHr || isApprover;
  const seeAll = financeOrHr || (can('expense.view') && scopeOf('expense.view') !== 'own');
  const [chosen, setView] = useState<'review' | 'all' | null>(null);
  const view = chosen ?? (approver ? 'review' : 'all');
  const [page, setPage] = useState(1);
  const list = useClaims({ view, page }, approver || seeAll);

  if (!accessLoading && !(hasFeature('ops.expenses') && (approver || seeAll))) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t approve expense claims." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Expenses"
        title="Expense approvals"
        description="Claims waiting for you: the manager step (team lead / project manager / line manager), or Finance and HR — who approve together."
      />
      <Tabs
        tabs={[
          ...(approver ? [{ id: 'review' as const, label: 'Waiting for me', icon: <Inbox />, ...(view === 'review' && list.data && { count: list.data.meta.total }) }] : []),
          ...(seeAll ? [{ id: 'all' as const, label: 'All claims', icon: <List /> }] : []),
        ]}
        value={view}
        onChange={(v) => { setView(v); setPage(1); }}
      />
      <ClaimList query={list} showEmployee empty={view === 'review' ? 'Nothing is waiting for you' : 'No claims yet'} page={page} onPage={setPage} />
    </div>
  );
}
