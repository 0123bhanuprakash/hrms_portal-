'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCheck, Inbox, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { NotificationItem } from '@/components/notifications/notification-item';
import { useMarkAllRead, useMarkRead, useNotifications, type AppNotification } from '@/lib/notifications';
import { getApiErrorMessage } from '@/lib/errors';

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const list = useNotifications({ ...(filter === 'unread' && { unreadOnly: true }), page, limit: 20 });
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = list.data?.meta.unread ?? 0;

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Requests waiting for you, decisions on your requests, and reminders."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href="/app/settings/preferences"><SlidersHorizontal /> Email settings</Link>
            </Button>
            <Button variant="secondary" onClick={() => markAll.mutate()} loading={markAll.isPending} disabled={!unread}>
              <CheckCheck /> Mark all read
            </Button>
          </div>
        }
      />
      <Tabs
        tabs={[
          { id: 'all' as const, label: 'All' },
          { id: 'unread' as const, label: 'Unread', count: unread },
        ]}
        value={filter}
        onChange={(f) => { setFilter(f); setPage(1); }}
      />
      <Card className="overflow-hidden">
        {list.isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : list.isError ? (
          <ErrorState message={getApiErrorMessage(list.error, 'Could not load notifications')} onRetry={() => list.refetch()} />
        ) : !list.data?.data.length ? (
          <EmptyState icon={<Inbox />} title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'} description="Leave and attendance updates will show up here." />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {list.data.data.map((n) => <li key={n.id}><NotificationItem n={n} onOpen={open} /></li>)}
            </ul>
            <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
