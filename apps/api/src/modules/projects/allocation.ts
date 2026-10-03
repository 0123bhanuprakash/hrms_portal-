// ============================================================
// Allocation maths — pure functions.
// An employee's assignments overlap in time; the busiest moment
// (peak) must never exceed 100%.
// ============================================================

export interface Span {
  allocation: number;
  /** "YYYY-MM-DD" */
  start: string;
  /** "YYYY-MM-DD" inclusive; null = open-ended */
  end: string | null;
}

const OPEN = '9999-12-31';

/** Highest total allocation at any moment within [from, to] (inclusive). */
export function peakAllocation(spans: Span[], from: string, to: string | null): number {
  const lo = from;
  const hi = to ?? OPEN;
  const relevant = spans.filter((s) => s.start <= hi && (s.end ?? OPEN) >= lo);
  if (!relevant.length) return 0;
  // The total can only change where a span starts; check each of those points
  const points = new Set<string>([lo, ...relevant.map((s) => (s.start > lo ? s.start : lo))]);
  let peak = 0;
  for (const p of points) {
    if (p > hi) continue;
    const total = relevant.filter((s) => s.start <= p && (s.end ?? OPEN) >= p).reduce((sum, s) => sum + s.allocation, 0);
    peak = Math.max(peak, total);
  }
  return peak;
}

/** Allocation in effect on one date. */
export function allocationOn(spans: Span[], date: string): number {
  return spans.filter((s) => s.start <= date && (s.end ?? OPEN) >= date).reduce((sum, s) => sum + s.allocation, 0);
}
