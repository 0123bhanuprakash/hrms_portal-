'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { NotificationItem } from '@/components/notifications/notification-item';
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount, type AppNotification } from '@/lib/notifications';
import { cn } from '@/lib/cn';

/** Top-bar bell: unread badge + the latest notifications. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const list = useNotifications({ limit: 8 }, open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const count = unread.data ?? 0;

  // Ring once when something new arrives (not on first load)
  const [ringKey, setRingKey] = useState(0);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (unread.data === undefined) return;
    if (last.current !== null && unread.data > last.current) setRingKey((k) => k + 1);
    last.current = unread.data;
  }, [unread.data]);

  const openItem = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          key={ringKey}
          className={cn(ringKey > 0 && 'm-ring', 'relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
          aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        >
          <Bell className="h-[18px] w-[18px]" />
          {count > 0 && (
            <span data-count className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className={cn(
            'z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border bg-raised text-raised-foreground shadow-menu',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} loading={markAll.isPending}>
                <CheckCheck /> Mark all read
              </Button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {list.isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !list.data?.data.length ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                <Inbox className="h-5 w-5" /> You’re all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {list.data.data.map((n) => <li key={n.id}><NotificationItem n={n} compact onOpen={openItem} /></li>)}
              </ul>
            )}
          </div>
          <Link href="/app/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-subtle">
            See all notifications
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
