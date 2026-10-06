'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onLive, sendTyping, watchTicket } from '@/lib/live/socket';
import { useAuthStore } from '@/store/useAuthStore';

/** Hides "… is writing" if the other side goes quiet without saying so. */
const SHOW_MS = 6_000;
/** Send "still writing" at most this often. */
const PING_MS = 3_000;
/** Stop after this long without a keystroke. */
const IDLE_MS = 4_000;

/**
 * Joins the ticket's live room while the page is open and returns the first
 * name of whoever else is writing right now (or null).
 */
export function useTicketLive(ticketId: string): string | null {
  const me = useAuthStore((s) => s.user?.id);
  const [writer, setWriter] = useState<string | null>(null);

  useEffect(() => watchTicket(ticketId), [ticketId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onLive('typing', (t) => {
      if (t.ticketId !== ticketId || t.userId === me) return;
      clearTimeout(timer);
      if (!t.typing) return setWriter(null);
      setWriter(t.name || 'Someone');
      timer = setTimeout(() => setWriter(null), SHOW_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [ticketId, me]);

  return writer;
}

/** Call on every keystroke of a reply (never of an internal note); `done()` after sending. */
export function useTypingSignal(ticketId: string) {
  const lastPing = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const done = useCallback(() => {
    clearTimeout(idle.current);
    if (lastPing.current) sendTyping(ticketId, false);
    lastPing.current = 0;
  }, [ticketId]);

  const typed = useCallback(() => {
    const now = Date.now();
    if (now - lastPing.current > PING_MS) {
      lastPing.current = now;
      sendTyping(ticketId, true);
    }
    clearTimeout(idle.current);
    idle.current = setTimeout(done, IDLE_MS);
  }, [ticketId, done]);

  useEffect(() => done, [done]);
  return { typed, done };
}
