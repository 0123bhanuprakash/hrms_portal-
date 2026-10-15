'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart, SearchX, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { KudosCard } from '@/components/engagement/kudos-card';
import { useAccess } from '@/lib/access/use-access';
import { useKudos, useKudosFeed } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';

/** One kudos on its own page — opened from the Home card and from notifications. */
export default function KudosDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const q = useKudos(id);
  // After removing it here we go back to the wall — don't flash "not found" meanwhile
  const [leaving, setLeaving] = useState(false);
  const first = q.data?.recipients[0];
  const more = useKudosFeed({ employeeId: first?.id, limit: 4 }, Boolean(first));

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/kudos"><ArrowLeft /> Shout-outs</Link>
    </Button>
  );
  if (!accessLoading && !(hasFeature('engage.kudos') && can('kudos.view'))) return <EmptyState icon={<ShieldCheck />} title="Shout-outs aren’t available" />;
  if (q.isLoading || accessLoading || leaving) return <Skeleton className="h-64 w-full" />;
  if (q.isLoadingError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    return status === 404
      ? <EmptyState icon={<SearchX />} title="Shout-out not found" description="It may have been removed." action={back} />
      : <ErrorState message={getApiErrorMessage(q.error, 'Could not load this shout-out')} onRetry={() => q.refetch()} />;
  }
  const k = q.data!;
  const others = (more.data?.data ?? []).filter((x) => x.id !== k.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {back}
      <KudosCard k={k} onRemoved={() => {
          setLeaving(true);
          router.push('/app/kudos');
        }} />
      {first && others.length > 0 && (
        <Card>
          <CardHeader icon={<Heart />} title={`More shout-outs for ${first.firstName}`} />
          <ul className="space-y-2 px-3 pb-3">
            {others.map((x) => (
              <li key={x.id}>
                <Link href={`/app/kudos/${x.id}`} className="block rounded-lg transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <KudosCard k={x} compact />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {can('kudos.give') && (
        <div className="flex justify-center">
          <Button variant="secondary" asChild>
            <Link href={`/app/kudos?to=${k.recipients.map((r) => r.id).join(',')}`}><Heart /> Thank {k.recipients.length === 1 && first ? first.firstName : 'them'} too</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
