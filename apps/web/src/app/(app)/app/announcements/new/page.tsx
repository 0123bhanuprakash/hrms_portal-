'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { AnnouncementComposer } from '@/components/engagement/announcement-composer';
import { useAccess } from '@/lib/access/use-access';

export default function NewAnnouncementPage() {
  const { can, isLoading } = useAccess();
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!(can('announcement.post') || can('announcement.post_team') || can('announcement.manage'))) {
    return <EmptyState icon={<ShieldCheck />} title="You can’t post announcements" description="Ask HR if you need to share something with the company." />;
  }
  return <AnnouncementComposer />;
}
