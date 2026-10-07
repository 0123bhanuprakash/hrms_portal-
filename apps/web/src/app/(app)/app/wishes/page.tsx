'use client';

import React from 'react';
import { PartyPopper } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Emoji } from '@/components/motion/emoji';
import { Confetti } from '@/components/motion/motion';
import { useAuthStore } from '@/store/useAuthStore';
import { useCelebrationsToday, useMyWishes, type Wish, type WishOccasion } from '@/lib/company/celebrations';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

/** The person celebrating: every birthday and work-anniversary wish they got (only they see these). */
export default function WishesPage() {
  const me = useAuthStore((s) => s.user);
  const q = useMyWishes();
  const today = useCelebrationsToday();

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-64 w-full" /></div>;
  if (q.isLoadingError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load your wishes')} onRetry={() => q.refetch()} />;
  const occasions = q.data ?? [];
  const todayKey = today.data?.date;
  const current = occasions.filter((o) => o.date === todayKey);
  const past = occasions.filter((o) => o.date !== todayKey);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Celebrations" title="Your wishes" description="Birthday and work-anniversary wishes from your colleagues. Only you can see them." />
      {!occasions.length && (
        <EmptyState icon={<PartyPopper />} title="No wishes yet" description="When colleagues wish you on your birthday or work anniversary, you’ll find them here." />
      )}
      {current.map((o) => (
        <Card key={`${o.kind}-${o.date}`} className="celebrate-note relative overflow-hidden p-6">
          <Confetti />
          <div className="relative flex flex-col items-center gap-1 text-center">
            <span className="text-5xl"><Emoji e={o.kind === 'birthday' ? '🎂' : '🏆'} play="appear" /></span>
            <h2 className="mt-2 text-xl font-bold">{o.kind === 'birthday' ? `Happy birthday, ${me?.firstName ?? 'you'}!` : `Happy ${o.years ? `${o.years}-year ` : ''}work anniversary, ${me?.firstName ?? 'you'}!`}</h2>
            <p className="text-sm text-muted-foreground">{o.wishes.length} {o.wishes.length === 1 ? 'person has' : 'people have'} wished you so far today</p>
          </div>
          <WishGrid wishes={o.wishes} className="relative mt-6" />
        </Card>
      ))}
      {past.map((o) => <PastOccasion key={`${o.kind}-${o.date}`} o={o} />)}
    </div>
  );
}

function PastOccasion({ o }: { o: WishOccasion }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>{o.kind === 'birthday' ? '🎂' : '🏆'}</span>
        {o.kind === 'birthday' ? 'Birthday' : `${o.years ? `${o.years}-year ` : ''}work anniversary`}
        <span className="font-normal text-muted-foreground">· {formatDate(o.date)} · {o.wishes.length} wish{o.wishes.length === 1 ? '' : 'es'}</span>
      </h3>
      <WishGrid wishes={o.wishes} />
    </section>
  );
}

function WishGrid({ wishes, className }: { wishes: Wish[]; className?: string }) {
  return (
    <ul className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {wishes.map((w) => (
        <li key={w.id}>
          <Card className="emo-host flex h-full flex-col gap-3 p-4 shadow-none">
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none"><Emoji e={w.sticker} /></span>
              <p className={cn('min-w-0 flex-1 whitespace-pre-line text-sm', !w.message && 'italic text-muted-foreground')}>{w.message ? `“${w.message}”` : `Sent you a ${w.sticker}`}</p>
            </div>
            <div className="mt-auto flex items-center gap-2 text-xs">
              <PersonAvatar person={w.from} size="xs" />
              <span className="min-w-0 flex-1 truncate">
                <b>{w.from.firstName} {w.from.lastName}</b>
                {w.from.designation && <span className="text-muted-foreground"> · {w.from.designation.name}</span>}
              </span>
              <span className="shrink-0 text-2xs text-muted-foreground">{formatRelative(w.createdAt)}</span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
