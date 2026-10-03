'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Megaphone, Paperclip, Pin, Plus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { AnnouncementDialog } from '@/components/engagement/announcement-dialog';
import { useAccess } from '@/lib/access/use-access';
import { useAnnouncements } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type Filter = 'all' | 'unread' | 'ack';

export default function AnnouncementsPage() {
  const router = useRouter();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const poster = can('announcement.post');
  const [showExpired, setShowExpired] = useState(false);
  const list = useAnnouncements({ filter, page, includeExpired: poster && showExpired });

  if (!accessLoading && !(hasFeature('engage.announcements') && can('announcement.view'))) {
    return <EmptyState icon={<ShieldCheck />} title="Announcements aren’t available" />;
  }
  const meta = list.data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title="Announcements"
        description="News from HR and the leadership team."
        action={poster && <Button onClick={() => setCreating(true)}><Plus /> New announcement</Button>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all' as const, label: 'All' },
            { id: 'unread' as const, label: 'Unread', ...(meta && { count: meta.unread }) },
            { id: 'ack' as const, label: 'Needs my confirmation', ...(meta && { count: meta.needsAck }) },
          ]}
          value={filter}
          onChange={(f) => { setFilter(f); setPage(1); }}
        />
        {poster && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} /> Show expired
          </label>
        )}
      </div>

      {list.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load announcements')} onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState icon={<Megaphone />} title={filter === 'all' ? 'No announcements yet' : 'You’re all caught up'} />
      ) : (
        <div className="space-y-3">
          {list.data.data.map((a) => {
            const unread = !a.readAt;
            const needsAck = a.requiresAck && !a.acknowledgedAt;
            return (
              <Link key={a.id} href={`/app/announcements/${a.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className={cn('p-4 transition-colors hover:border-foreground/20', unread && 'border-primary/40 bg-primary-soft/15', a.expired && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"><Megaphone className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn('truncate', unread ? 'font-semibold' : 'font-medium')}>{a.title}</p>
                        {a.pinned && <Badge tone="primary"><Pin className="h-3 w-3" /> Pinned</Badge>}
                        {needsAck && <Badge tone="warning">Please confirm</Badge>}
                        {a.requiresAck && a.acknowledgedAt && <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Confirmed</Badge>}
                        {a.expired && <Badge>Expired</Badge>}
                        {a.attachmentName && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Has an attachment" />}
                      </div>
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {a.author ? `${a.author.firstName} ${a.author.lastName}` : 'HR'} · {formatRelative(a.publishedAt)}
                        {a.audience !== 'COMPANY' && ` · ${a.audience === 'DEPARTMENTS' ? 'selected departments' : 'selected locations'}`}
                      </p>
                    </div>
                    {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </div>
                </Card>
              </Link>
            );
          })}
          <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
        </div>
      )}
      {creating && <AnnouncementDialog value="new" onClose={() => setCreating(false)} onSaved={(a) => router.push(`/app/announcements/${a.id}`)} />}
    </div>
  );
}
