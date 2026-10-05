// ============================================================
// "Live" data: who is checked in, who is away today, present counts.
// These change all day, so such screens never trust a cached copy for
// long: refresh every minute while the tab is open, when you come back
// to the tab, and when the screen opens.
// ============================================================

export const LIVE = {
  staleTime: 10_000,
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnMount: true,
} as const;
