'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Megaphone, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Skeleton } from '@/components/ui/feedback';
import { KudosCard } from '@/components/engagement/kudos-card';
import { useReducedMotion } from '@/components/motion/motion';
import { plain } from '@/components/engagement/announcement-ui';
import { useAccess } from '@/lib/access/use-access';
import { HOME_ANNOUNCEMENTS, useAnnouncements, useKudosFeed } from '@/lib/company/engagement';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Home: announcements like the kudos ticker. Pinned ones stay put at the top;
 * the rest scroll slowly (pausing on hover or keyboard focus). Still when there
 * are only a few, or the person asked for less motion.
 */
export function HomeAnnouncements() {
  const { can, hasFeature } = useAccess();
  const q = useAnnouncements(HOME_ANNOUNCEMENTS);
  const reduced = useReducedMotion();
  if (!hasFeature('engage.announcements') || !can('announcement.view') || !q.data?.data.length) return null;
  const { needsAck } = q.data.meta;
  const pinned = q.data.data.filter((a) => a.pinned);
  const rest = q.data.data.filter((a) => !a.pinned);
  const moving = rest.length >= 3 && !reduced;
  const row = (a: (typeof rest)[number], hidden = false) => (
    <li key={`${hidden ? 'b' : 'a'}-${a.id}`} aria-hidden={hidden || undefined}>
      <Link
        href={`/app/announcements/${a.id}`}
        tabIndex={hidden ? -1 : undefined}
        className={cn('flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-subtle', !a.readAt ? 'bg-primary-soft/25' : 'bg-surface')}
      >
        <div className="min-w-0 flex-1">
          <p className={cn('flex items-center gap-1.5 text-sm', !a.readAt ? 'font-semibold' : 'font-medium')}>
            {a.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
            {!a.readAt && !a.pinned && <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            <span className="truncate">{a.title}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{plain(a.body)}</p>
        </div>
        <div className="shrink-0 text-right">
          {a.requiresAck && !a.acknowledgedAt ? <Badge tone="warning">Confirm</Badge> : <span className="text-2xs text-muted-foreground">{formatRelative(a.publishedAt)}</span>}
        </div>
      </Link>
    </li>
  );
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={<Megaphone />}
        title="Announcements"
        description={needsAck ? `${needsAck} need${needsAck === 1 ? 's' : ''} your confirmation` : undefined}
        action={<Link href="/app/announcements" className="text-xs font-medium text-primary hover:underline">See all</Link>}
      />
      {pinned.length > 0 && <ul className="flex flex-col gap-2 px-3 pb-2">{pinned.slice(0, 2).map((a) => row(a))}</ul>}
      {moving ? (
        <div className="m-ticker mx-3 mb-3 min-h-[220px] flex-1 basis-0" style={{ ['--m-dur' as string]: `${rest.length * 6}s` }} tabIndex={0} aria-label="Latest announcements (hover or focus to pause)">
          <ul className="flex flex-col gap-2">
            {rest.map((a) => row(a))}
            {rest.map((a) => row(a, true))}
          </ul>
        </div>
      ) : (
        rest.length > 0 && <ul className="flex flex-col gap-2 px-3 pb-3">{rest.slice(0, 3).map((a) => row(a))}</ul>
      )}
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
