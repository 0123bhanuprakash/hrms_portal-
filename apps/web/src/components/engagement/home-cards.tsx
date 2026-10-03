'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Megaphone, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { KudosCard } from '@/components/engagement/kudos-card';
import { useAccess } from '@/lib/access/use-access';
import { useAnnouncements, useKudosFeed } from '@/lib/company/engagement';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Home: pinned / unread announcements, with a nudge to confirm. */
export function HomeAnnouncements() {
  const { can, hasFeature } = useAccess();
  const q = useAnnouncements({ limit: 4 });
  if (!hasFeature('engage.announcements') || !can('announcement.view') || !q.data?.data.length) return null;
  const { needsAck } = q.data.meta;
  return (
    <Card>
      <CardHeader
        icon={<Megaphone />}
        title="Announcements"
        description={needsAck ? `${needsAck} need${needsAck === 1 ? 's' : ''} your confirmation` : undefined}
        action={<Link href="/app/announcements" className="text-xs font-medium text-primary hover:underline">See all</Link>}
      />
      <ul className="divide-y divide-border border-t border-border">
        {q.data.data.slice(0, 3).map((a) => (
          <li key={a.id}>
            <Link href={`/app/announcements/${a.id}`} className={cn('flex items-start gap-3 px-5 py-3 hover:bg-subtle', !a.readAt && 'bg-primary-soft/20')}>
              <div className="min-w-0 flex-1">
                <p className={cn('flex items-center gap-1.5 truncate text-sm', !a.readAt ? 'font-semibold' : 'font-medium')}>
                  {a.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  <span className="truncate">{a.title}</span>
                </p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{a.body}</p>
              </div>
              <div className="shrink-0 text-right">
                {a.requiresAck && !a.acknowledgedAt ? <Badge tone="warning">Confirm</Badge> : <span className="text-2xs text-muted-foreground">{formatRelative(a.publishedAt)}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Home: the latest kudos. */
export function HomeKudos() {
  const { can, hasFeature } = useAccess();
  const q = useKudosFeed({ limit: 3 });
  if (!hasFeature('engage.kudos') || !can('kudos.view')) return null;
  return (
    <Card>
      <CardHeader icon={<Heart />} title="Kudos" action={<Link href="/app/kudos" className="text-xs font-medium text-primary hover:underline">{can('kudos.give') ? 'Give kudos' : 'See all'}</Link>} />
      {q.isLoading ? (
        <div className="px-5 pb-5"><Skeleton className="h-20 w-full" /></div>
      ) : !q.data?.data.length ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No kudos yet — thank someone for something great.</p>
      ) : (
        <div className="space-y-2 px-3 pb-3">
          {q.data.data.map((k) => <KudosCard key={k.id} k={k} compact />)}
        </div>
      )}
    </Card>
  );
}
