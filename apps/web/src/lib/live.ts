import { isLive } from '@/lib/live/socket';

// ============================================================
// "Live" data: who is checked in, who is away today, present counts.
// These change all day, so such screens never trust a cached copy for
// long. While the live connection is up, check-ins and leave decisions
// arrive as live updates, so they only re-check every 5 minutes (for
// things without a live update, e.g. the automatic end-of-day check-out).
// Without it: every minute while the tab is open. Always on coming back
// to the tab and when the screen opens.
// ============================================================

export const LIVE = {
  staleTime: 10_000,
  refetchInterval: () => (isLive() ? 5 * 60_000 : 60_000),
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnMount: true,
} as const;
