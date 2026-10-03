'use client';

import React, { useState } from 'react';
import { Inbox, List, PackageCheck, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Tabs } from '@/components/ui/feedback';
import { RequestList } from '@/components/assets/asset-lists';
import { useAccess } from '@/lib/access/use-access';
import { useAssetRequests, type RequestQuery } from '@/lib/company/assets';

export default function AssetRequestsPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const approver = can('asset.approve_it') || can('asset.approve_hr');
  const it = can('asset.manage');
  const seeAll = it || (can('asset.view') && scopeOf('asset.view') === 'company');
  const [chosen, setView] = useState<RequestQuery['view'] | null>(null);
  const view = chosen ?? (approver ? 'review' : it ? 'fulfil' : 'all');
  const [page, setPage] = useState(1);
  const list = useAssetRequests({ view, page }, approver || seeAll);

  if (!accessLoading && !(hasFeature('ops.assets') && (approver || seeAll))) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t handle asset requests." />;

  const count = (v: RequestQuery['view']) => (view === v && list.data ? { count: list.data.meta.total } : {});
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Assets" title="Asset requests" description="The IT head and HR approve each request — in any order. Once both have, IT hands the asset over." />
      <Tabs
        tabs={[
          ...(approver ? [{ id: 'review' as const, label: 'Waiting for me', icon: <Inbox />, ...count('review') }] : []),
          ...(it ? [{ id: 'fulfil' as const, label: 'To hand over', icon: <PackageCheck />, ...count('fulfil') }] : []),
          ...(seeAll ? [{ id: 'all' as const, label: 'All requests', icon: <List /> }] : []),
        ]}
        value={view}
        onChange={(v) => { setView(v); setPage(1); }}
      />
      <RequestList query={list} showEmployee empty={view === 'review' ? 'Nothing is waiting for you' : view === 'fulfil' ? 'Nothing to hand over' : 'No requests yet'} page={page} onPage={setPage} />
    </div>
  );
}
