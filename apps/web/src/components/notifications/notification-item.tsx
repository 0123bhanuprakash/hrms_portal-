'use client';

import React from 'react';
import { ArrowRightLeft, Bell, CalendarClock, Clock, Heart, Megaphone, PartyPopper } from 'lucide-react';
import { notificationKind, type AppNotification } from '@/lib/notifications';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const ICONS = {
  leave: { icon: CalendarClock, tone: 'bg-info-soft text-info' },
  attendance: { icon: Clock, tone: 'bg-warning-soft text-warning' },
  delegation: { icon: ArrowRightLeft, tone: 'bg-success-soft text-success' },
  announcement: { icon: Megaphone, tone: 'bg-primary-soft text-primary-soft-foreground' },
  kudos: { icon: Heart, tone: 'bg-destructive-soft text-destructive' },
  celebration: { icon: PartyPopper, tone: 'celebrate-icon' },
  other: { icon: Bell, tone: 'bg-muted text-muted-foreground' },
} as const;

/** One inbox row: icon, title, body preview, time, unread dot. */
export function NotificationItem({ n, compact, onOpen }: { n: AppNotification; compact?: boolean; onOpen: (n: AppNotification) => void }) {
  const kind = notificationKind(n.type);
  const { icon: Icon, tone } = ICONS[kind];
  const unread = !n.readAt;
  // Birthday / anniversary wishes look like a little greeting card, not a task
  const festive = kind === 'celebration';
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle', unread && (festive ? 'celebrate-note border-y' : 'bg-primary-soft/25'))}
    >
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4', tone)}>
        {festive ? <span className="text-base leading-none">{n.type === 'celebration.anniversary' ? '🏆' : '🎂'}</span> : <Icon />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', unread ? 'font-semibold text-foreground' : 'text-foreground/90')}>{n.title}</span>
        {n.body && <span className={cn('mt-0.5 block whitespace-pre-line text-xs text-muted-foreground', compact && 'line-clamp-2')}>{n.body}</span>}
        <span className="mt-1 block text-2xs text-muted-foreground">{formatRelative(n.createdAt)}</span>
      </span>
      {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
    </button>
  );
}
