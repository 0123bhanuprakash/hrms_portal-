'use client';

import React, { useState } from 'react';
import { PackagePlus, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { HeldAssets, RequestList } from '@/components/assets/asset-lists';
import { RequestDialog } from '@/components/assets/asset-dialogs';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import { useAssetRequests, useMyAssets } from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';

export default function MyAssetsPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const allowed = hasFeature('ops.assets') && can('asset.view');
  const mine = useMyAssets(allowed);
  const [page, setPage] = useState(1);
  const requests = useAssetRequests({ view: 'mine', page, limit: 10 }, allowed && can('asset.request'));
  const [requesting, setRequesting] = useState(false);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Assets aren’t available" />;
  if (me.isSuccess && !me.data?.employee) return <EmptyState icon={<UserRound />} title="No employee profile" description="Assets are handed to employees." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assets"
        title="My assets"
        description="Company equipment you have — laptop, phone, ID card and so on. Confirm when you receive something."
        action={can('asset.request') && <Button onClick={() => setRequesting(true)}><PackagePlus /> Request an asset</Button>}
      />
      {mine.isLoading ? <Skeleton className="h-40 w-full" /> : mine.isError ? <ErrorState message={getApiErrorMessage(mine.error, 'Could not load your assets')} onRetry={() => void mine.refetch()} /> : mine.data && <HeldAssets data={mine.data} canConfirm />}
      {can('asset.request') && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">My requests</h2>
          <RequestList query={requests} empty="You haven’t requested anything" page={page} onPage={setPage} />
        </section>
      )}
      <RequestDialog open={requesting} onClose={() => setRequesting(false)} />
    </div>
  );
}
