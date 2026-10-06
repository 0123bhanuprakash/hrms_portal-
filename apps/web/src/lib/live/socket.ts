'use client';

import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

// ============================================================
// One live (Socket.IO) connection per tab. The API only says
// "something changed" — screens then reload through the normal API.
// If the connection is down, screens keep their usual 1-minute refresh.
// ============================================================

export type LiveStatus = 'off' | 'connecting' | 'live' | 'reconnecting';

export interface LiveNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
}
export interface LiveChange {
  topic: 'notifications' | 'helpdesk' | 'system' | 'access' | 'delegations' | 'attendance' | 'leave' | 'expenses' | 'timesheets' | 'assets' | 'announcements' | 'kudos' | 'projects' | 'branding' | 'people';
  ticketId?: string;
}
/** Records that show who else is viewing them */
export type PresenceKind = 'employee' | 'expense' | 'leave';
export interface LivePresence {
  kind: PresenceKind;
  id: string;
  people: Array<{ userId: string; name: string; initials: string }>;
}
/** A long job's progress (e.g. employee import) */
export interface LiveProgress {
  id: string;
  done: number;
  total: number;
  label?: string;
}
export interface LiveTyping {
  ticketId: string;
  userId: string;
  name: string;
  typing: boolean;
}

interface Handlers {
  notification: (n: LiveNotification) => void;
  changed: (c: LiveChange) => void;
  typing: (t: LiveTyping) => void;
  /** Connected again after a gap — anything may have been missed */
  resync: () => void;
  /** The server ended this session (deactivated, device signed out, password reset…) */
  signedOut: (reason: string) => void;
  presence: (p: LivePresence) => void;
  progress: (p: LiveProgress) => void;
}

const ORIGIN = new URL(API_BASE_URL).origin;

let socket: Socket | null = null;
let status: LiveStatus = 'off';
let everReady = false;
let refusals: number[] = [];
const statusListeners = new Set<() => void>();
const handlers: { [K in keyof Handlers]: Set<Handlers[K]> } = {
  notification: new Set(),
  changed: new Set(),
  typing: new Set(),
  resync: new Set(),
  signedOut: new Set(),
  presence: new Set(),
  progress: new Set(),
};
/** Tickets this tab has open (re-joined after every reconnect) */
const watching = new Map<string, number>();
/** Records this tab is viewing ("kind:id" → open count), re-joined after every reconnect */
const viewing = new Map<string, number>();

function setStatus(next: LiveStatus) {
  if (next === status) return;
  status = next;
  statusListeners.forEach((fn) => fn());
}

/** The token expired (or was refused): let the API client refresh it, then try again. */
async function renewAndReconnect() {
  const now = Date.now();
  refusals = refusals.filter((t) => now - t < 60_000);
  refusals.push(now);
  // Refused again and again (signed out elsewhere, account paused…) — fall back to polling
  if (refusals.length > 3) return setStatus('off');
  setStatus('reconnecting');
  try {
    await api.get('/notifications/unread-count'); // refreshes the access token on 401
  } catch {
    /* the API client signs the user out if the session is gone */
  }
  if (socket && useAuthStore.getState().accessToken) socket.connect();
}

export function startLive() {
  if (socket || typeof window === 'undefined') return;
  setStatus('connecting');
  socket = io(ORIGIN, {
    path: '/socket.io',
    // Read on every (re)connect, so a refreshed token is used
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    transports: ['websocket', 'polling'],
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
  });
  socket.on('ready', () => {
    refusals = [];
    setStatus('live');
    for (const id of watching.keys()) socket?.emit('ticket:watch', { id });
    for (const key of viewing.keys()) {
      const [kind, id] = key.split(':');
      socket?.emit('view:join', { kind, id });
    }
    if (everReady) handlers.resync.forEach((fn) => fn());
    everReady = true;
  });
  socket.on('expired', () => void renewAndReconnect());
  socket.on('unauthorized', () => void renewAndReconnect());
  socket.on('disconnect', (reason) => {
    // A server-side disconnect is followed by "expired"/"unauthorized"; others retry on their own
    if (reason !== 'io client disconnect') setStatus('reconnecting');
  });
  socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));
  socket.on('notification', (n: LiveNotification) => handlers.notification.forEach((fn) => fn(n)));
  socket.on('changed', (c: LiveChange) => handlers.changed.forEach((fn) => fn(c)));
  socket.on('typing', (t: LiveTyping) => handlers.typing.forEach((fn) => fn(t)));
  socket.on('presence', (p: LivePresence) => handlers.presence.forEach((fn) => fn(p)));
  socket.on('progress', (p: LiveProgress) => handlers.progress.forEach((fn) => fn(p)));
  socket.on('signed-out', (e: { reason?: string } | undefined) => {
    const reason = e?.reason ?? 'signed-out';
    // Don't try to reconnect — this session is over
    if (socket) socket.io.opts.reconnection = false;
    handlers.signedOut.forEach((fn) => fn(reason));
  });
}

export function stopLive() {
  socket?.removeAllListeners();
  socket?.io.removeAllListeners();
  socket?.disconnect();
  socket = null;
  everReady = false;
  refusals = [];
  watching.clear();
  viewing.clear();
  setStatus('off');
}

export function onLive<K extends keyof Handlers>(event: K, fn: Handlers[K]): () => void {
  (handlers[event] as Set<Handlers[K]>).add(fn);
  return () => void (handlers[event] as Set<Handlers[K]>).delete(fn);
}

export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(
    (fn) => {
      statusListeners.add(fn);
      return () => void statusListeners.delete(fn);
    },
    () => status,
    () => 'off',
  );
}

export const isLive = () => status === 'live';

// ─── Ticket page: join its room, send / receive "is writing…" ──

export function watchTicket(id: string): () => void {
  watching.set(id, (watching.get(id) ?? 0) + 1);
  if (status === 'live') socket?.emit('ticket:watch', { id });
  return () => {
    const n = (watching.get(id) ?? 1) - 1;
    if (n > 0) return void watching.set(id, n);
    watching.delete(id);
    socket?.emit('ticket:unwatch', { id });
  };
}

export function sendTyping(ticketId: string, typing: boolean) {
  if (status === 'live') socket?.emit('ticket:typing', { id: ticketId, typing });
}

// ─── "Also viewing": join a record's viewing room while it is open ──

/** Tell the server this tab is viewing a record; returns the cleanup. Reviewers only (the server checks). */
export function viewRecord(kind: PresenceKind, id: string): () => void {
  const key = `${kind}:${id}`;
  viewing.set(key, (viewing.get(key) ?? 0) + 1);
  if (viewing.get(key) === 1 && socket?.connected) socket.emit('view:join', { kind, id });
  return () => {
    const left = (viewing.get(key) ?? 1) - 1;
    if (left > 0) return void viewing.set(key, left);
    viewing.delete(key);
    if (socket?.connected) socket.emit('view:leave', { kind, id });
  };
}
