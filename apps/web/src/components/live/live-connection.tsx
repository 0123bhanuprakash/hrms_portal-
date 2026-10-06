'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { onLive, startLive, stopLive, useLiveStatus, type LiveChange } from '@/lib/live/socket';
import { useAuthStore } from '@/store/useAuthStore';
import { SIGNED_OUT_KEY, loginPathFor } from '@/lib/auth/workspace';
import { cn } from '@/lib/cn';

/** Notification type prefix → the query family that shows it (lists, badges). */
const FAMILY: Record<string, string[]> = {
  announcement: ['announcements'],
  kudos: ['kudos'],
  leave: ['leave'],
  attendance: ['attendance'],
  expense: ['expenses'],
  asset: ['assets'],
  ticket: ['helpdesk'],
  timesheet: ['timesheets'],
  project: ['projects'],
  delegation: ['delegations'],
};
const TOPIC: Record<LiveChange['topic'], string[] | string[][]> = {
  notifications: ['notifications'],
  helpdesk: ['helpdesk'],
  system: ['platform-status'],
  // Menus and buttons follow role / permission changes
  access: ['access'],
  // Someone checked in, a request was made or decided — boards, badges and lists reload
  attendance: ['attendance'],
  leave: ['leave'],
  expenses: ['expenses'],
  timesheets: ['timesheets'],
  assets: ['assets'],
  // New posts, reactions and read counts; kudos feed and ticker; project teams
  announcements: ['announcements'],
  // Kudos also feed the Home celebrations ("wishes so far today")
  kudos: [['kudos'], ['people', 'spotlight']],
  projects: ['projects'],
  // Logo, colours, page defaults and seasonal themes re-theme every open screen
  branding: [['company'], ['seasons']],
  // Joiners, manager changes and team moves: org chart, directory, profiles
  people: [['org'], ['people'], ['employee']],
  // Cover started or ended on its own clock
  delegations: ['delegations'],
};

/** One query family (['leave']) or several ([['company'], ['seasons']]). */
const keysOf = (k: string[] | string[][] | undefined): string[][] => (!k ? [] : Array.isArray(k[0]) ? (k as string[][]) : [k as string[]]);

/**
 * Keeps this tab's live connection open while someone is signed in, and turns
 * live events into fresh data: the bell, sidebar badges and open lists reload,
 * and a new notification pops up (bottom right).
 */
export function LiveConnection() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = useAuthStore((s) => s.isAuthenticated && Boolean(s.accessToken));
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!signedIn) return;
    startLive();
    return stopLive;
    // A different person signing in on this tab starts a fresh connection
  }, [signedIn, userId]);

  // Latest path without re-subscribing on every navigation
  const here = React.useRef(pathname);
  here.current = pathname;

  useEffect(() => {
    const refresh = (key: string[]) => void qc.invalidateQueries({ queryKey: key });
    const offs = [
      onLive('notification', (n) => {
        refresh(['notifications']);
        const family = FAMILY[n.type.split('.')[0] ?? ''];
        if (family) refresh(family);
        // Already looking at it — the page refreshes, no pop-up needed
        if (n.link && here.current === n.link.split('?')[0]) return;
        toast(n.title, {
          description: n.body ? (n.body.length > 140 ? `${n.body.slice(0, 137)}…` : n.body) : undefined,
          position: 'bottom-right',
          duration: 6000,
          ...(n.link && { action: { label: 'Open', onClick: () => router.push(n.link!) } }),
        });
      }),
      onLive('changed', (c) => keysOf(TOPIC[c.topic]).forEach(refresh)),
      onLive('resync', () => Object.values(TOPIC).flatMap(keysOf).forEach(refresh)),
      // The server ended this session: sign out here too and say why on the sign-in page
      onLive('signedOut', (reason) => {
        const { user, logout } = useAuthStore.getState();
        const to = loginPathFor(user);
        try {
          sessionStorage.setItem(SIGNED_OUT_KEY, reason);
        } catch {
          /* storage blocked — sign out without the note */
        }
        stopLive();
        logout();
        window.location.href = to;
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [qc, router]);

  return null;
}

/** Tiny connection dot for the top bar — almost invisible while all is well. */
export function LiveDot({ className }: { className?: string }) {
  const status = useLiveStatus();
  if (status === 'off' || status === 'connecting') return null;
  const live = status === 'live';
  return (
    <span
      role="status"
      title={live ? 'Live — updates arrive as they happen' : 'Reconnecting… updates refresh every minute meanwhile'}
      aria-label={live ? 'Live updates on' : 'Reconnecting'}
      className={cn('relative inline-flex h-2 w-2 shrink-0 rounded-full', live ? 'bg-success/70' : 'bg-warning motion-safe:animate-pulse', className)}
    />
  );
}
