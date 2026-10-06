'use client';

import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { onLive, viewRecord, type LivePresence, type PresenceKind } from '@/lib/live/socket';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/cn';

/** Other people (not me) who have this record open right now. */
export function usePresence(kind: PresenceKind, id: string | null | undefined): LivePresence['people'] {
  const me = useAuthStore((s) => s.user?.id);
  const [people, setPeople] = useState<LivePresence['people']>([]);
  useEffect(() => {
    if (!id) return;
    setPeople([]);
    const off = onLive('presence', (p) => {
      if (p.kind === kind && p.id === id) setPeople(p.people.filter((x) => x.userId !== me));
    });
    const leave = viewRecord(kind, id);
    return () => {
      off();
      leave();
    };
  }, [kind, id, me]);
  return people;
}

const WHAT: Record<PresenceKind, string> = { employee: 'profile', expense: 'claim', leave: 'request' };

/**
 * "Ravi is also viewing" — so two reviewers don't act on the same record at
 * once. Only shown to reviewers (the server decides), and only when someone else is here.
 */
export function ViewingNow({ kind, id, className }: { kind: PresenceKind; id: string | null | undefined; className?: string }) {
  const people = usePresence(kind, id);
  if (!people.length) return null;
  const first = people[0]!.name.split(' ')[0];
  const text = people.length === 1 ? `${first} is also viewing this ${WHAT[kind]}` : `${first} and ${people.length - 1} other${people.length > 2 ? 's' : ''} are also viewing`;
  return (
    <span
      role="status"
      title={people.map((p) => p.name).join(', ')}
      className={cn('inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning animate-in fade-in-0', className)}
    >
      <span className="flex -space-x-1.5">
        {people.slice(0, 3).map((p) => (
          <span key={p.userId} className="flex h-5 w-5 items-center justify-center rounded-full bg-warning text-[9px] font-bold text-white ring-2 ring-surface">
            {p.initials || '?'}
          </span>
        ))}
      </span>
      <Eye className="h-3.5 w-3.5 shrink-0" />
      {text}
    </span>
  );
}
