'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Approve → swipe away. Call `markDone(item)` after a decision; when the
 * list refreshes without that item, it stays in place for a moment with
 * `leaving: true` (render it with `m-swipe`) and then goes. Items that
 * disappear for other reasons (filters, paging) just go.
 */
export function useSwipeAway<T>(items: T[] | undefined, keyOf: (item: T) => string, ms = 480) {
  const [done, setDone] = useState<Map<string, T>>(() => new Map());
  const last = useRef<T[]>([]);

  const markDone = useCallback(
    (item: T) => {
      const k = keyOf(item);
      setDone((m) => new Map(m).set(k, item));
      // Still in the list (e.g. the "All" view)? Forget it after a while
      setTimeout(() => setDone((m) => { if (!m.has(k)) return m; const next = new Map(m); next.delete(k); return next; }), 5000);
    },
    [keyOf],
  );

  const current = items ?? [];
  const present = new Set(current.map(keyOf));
  const out: Array<{ item: T; leaving: boolean }> = current.map((item) => ({ item, leaving: false }));
  // Put each finished-but-gone item back where it was, marked as leaving
  last.current.forEach((item, idx) => {
    const k = keyOf(item);
    if (done.has(k) && !present.has(k)) out.splice(Math.min(idx, out.length), 0, { item, leaving: true });
  });

  const leavingKeys = out.filter((o) => o.leaving).map((o) => keyOf(o.item)).join(',');
  useEffect(() => {
    if (!leavingKeys) return;
    const t = setTimeout(() => {
      setDone((m) => {
        const next = new Map(m);
        for (const k of leavingKeys.split(',')) next.delete(k);
        return next;
      });
    }, ms);
    return () => clearTimeout(t);
  }, [leavingKeys, ms]);

  useEffect(() => {
    last.current = out.map((o) => o.item);
  });

  return { rows: out, markDone };
}
