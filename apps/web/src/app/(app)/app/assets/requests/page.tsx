'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Inbox, List, PackageCheck, ShieldCheck, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { getApiErrorMessage } from '@/lib/errors';
import { RequestList } from '@/components/assets/asset-lists';
import { useAccess } from '@/lib/access/use-access';
import { useAssetRequests, type RequestQuery } from '@/lib/company/assets';

type View = RequestQuery['view'];

export default function AssetRequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Requests />
    </Suspense>
  );
}

function Requests() {
  const params = useSearchParams();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const enabled = hasFeature('ops.assets');
  const it = can('asset.manage');
  const hr = can('asset.approve_hr');
  const seeAll = it || hr || can('asset.approve_it');
  // Anyone can have requests waiting — team leads and managers too.
  const review = useAssetRequests({ view: 'review', page: 1, limit: 1 }, enabled);
  const joiners = useAssetRequests({ view: 'joiners', page: 1, limit: 1 }, enabled && (it || hr));
  const fulfil = useAssetRequests({ view: 'fulfil', page: 1, limit: 1 }, enabled && it);

  const fromUrl = params.get('view') as View | null;
  const [chosen, setView] = useState<View | null>(fromUrl);
  const reviewCount = review.data?.meta.total ?? 0;
  const view: View = chosen ?? (reviewCount > 0 || !seeAll ? 'review' : it ? 'fulfil' : 'all');
  const [page, setPage] = useState(1);
  const list = useAssetRequests({ view, page }, enabled && (seeAll || view === 'review'));

  if (accessLoading || review.isLoading) return <Skeleton className="h-64 w-full" />;
  if (review.isLoadingError) return <ErrorState message={getApiErrorMessage(review.error, 'Could not load asset requests')} onRetry={() => void review.refetch()} />;
  if (!enabled || (!seeAll && reviewCount === 0)) return <EmptyState icon={<ShieldCheck />} title="Nothing for you here" description="Asset requests that need your approval will show up here." />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Assets" title="Asset requests" description="Each request goes team lead → manager → HR → IT head, one after another. Starter kits for new joiners skip approvals and go straight to IT." />
      <Tabs
        tabs={[
          { id: 'review' as const, label: 'Waiting for me', icon: <Inbox />, count: reviewCount },
          ...(it ? [{ id: 'fulfil' as const, label: 'To hand over', icon: <PackageCheck />, count: fulfil.data?.meta.total }] : []),
          ...(it || hr ? [{ id: 'joiners' as const, label: 'New joiners', icon: <UserPlus />, count: joiners.data?.meta.total }] : []),
          ...(seeAll ? [{ id: 'all' as const, label: 'All requests', icon: <List /> }] : []),
        ]}
        value={view}
        onChange={(v) => { setView(v); setPage(1); }}
      />
      <RequestList
        query={list}
        showEmployee
        empty={view === 'review' ? 'Nothing is waiting for you' : view === 'fulfil' ? 'Nothing to hand over' : view === 'joiners' ? 'No new joiners to prepare for' : 'No requests yet'}
        page={page}
        onPage={setPage}
      />
    </div>
  );
}
