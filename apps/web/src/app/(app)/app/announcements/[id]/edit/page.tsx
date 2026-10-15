'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { SearchX, ShieldCheck } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { AnnouncementComposer } from '@/components/engagement/announcement-composer';
import { useAnnouncement } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';

export default function EditAnnouncementPage() {
  const { id } = useParams<{ id: string }>();
  const q = useAnnouncement(id);
  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isLoadingError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    return status === 404 ? <EmptyState icon={<SearchX />} title="Announcement not found" /> : <ErrorState message={getApiErrorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  if (!q.data!.canEdit) return <EmptyState icon={<ShieldCheck />} title="You can only edit your own announcements" />;
  return <AnnouncementComposer existing={q.data!} />;
}
