import { Injectable } from '@nestjs/common';
import type { TicketQueue } from '@prisma/client';
import type { Server } from 'socket.io';

// ============================================================
// Live updates (Socket.IO). Services call these after a write;
// the gateway decides who is in which room when a tab connects.
//
// Events only say "something changed" (plus ids). The page then
// reloads the data through the normal API, so every permission
// check stays in one place.
//
// Rooms:
//   u:<userId>                 — every tab of one person
//   c:<companyId>              — everyone in a company
//   a:<companyId>:<area>       — people who view or approve an area beyond
//                                themselves (attendance board, who's off,
//                                approval queues) — see LIVE_AREAS
//   q:<companyId>:<queue>      — people who work a helpdesk queue
//   t:<ticketId>               — tabs that have this ticket open
//   sa                         — Super Admins
// ============================================================

/** Areas whose writes are pushed live to the people who watch them. */
export const LIVE_AREAS = ['attendance', 'leave', 'expenses', 'timesheets', 'assets', 'announcements', 'kudos', 'projects', 'branding', 'people'] as const;
export type LiveArea = (typeof LIVE_AREAS)[number];

export type LiveTopic = 'notifications' | 'helpdesk' | 'system' | 'access' | 'delegations' | 'resources' | 'celebrations' | LiveArea;

export interface LiveNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: Date;
}

export const room = {
  user: (userId: string) => `u:${userId}`,
  company: (companyId: string) => `c:${companyId}`,
  area: (companyId: string, area: LiveArea) => `a:${companyId}:${area}`,
  queue: (companyId: string, queue: TicketQueue) => `q:${companyId}:${queue}`,
  ticket: (ticketId: string) => `t:${ticketId}`,
  superAdmins: 'sa',
};

/** Whose live rooms (and menus) to refresh after an access change. */
export type AccessTarget = { userIds: string[] } | { companyId: string };

/** Hooks the gateway provides — it knows which tab belongs to whom. */
export interface LiveSessions {
  /** Recompute rooms for these people (sign out anyone no longer active) and tell them access changed. */
  reroom(target: AccessTarget): Promise<void>;
  /** Close tabs of signed-out sessions: one session, all but one, or all. */
  signOut(userId: string, which: { sid?: string; exceptSid?: string }, reason: string): void;
}

/** Bursts (e.g. 500 check-ins at 9 AM) become one "changed" per room every few seconds. */
const COALESCE_MS = 3000;

@Injectable()
export class RealtimeService {
  private server: Server | null = null;
  private sessions: LiveSessions | null = null;
  private readonly pending = new Map<string, { rooms: Set<string>; data: Record<string, unknown> }>();
  private readonly pendingAccess = new Map<string, AccessTarget>();
  private accessTimer: NodeJS.Timeout | null = null;

  /** Set by the gateway once Socket.IO is up (absent in unit tests / scripts). */
  attach(server: Server, sessions?: LiveSessions): void {
    this.server = server;
    this.sessions = sessions ?? null;
  }

  /** A new in-app notification for one person (bell + pop-up). */
  notification(userId: string, n: LiveNotification): void {
    this.server?.to(room.user(userId)).emit('notification', n);
  }

  /** "Reload what you show about <topic>" for the given rooms. */
  changed(rooms: string[], topic: LiveTopic, data: Record<string, unknown> = {}): void {
    if (!this.server || !rooms.length) return;
    this.server.to([...new Set(rooms)]).emit('changed', { topic, ...data });
  }

  /** Like changed(), but many calls for the same topic within a few seconds send one message. */
  soon(rooms: string[], topic: LiveTopic, data: Record<string, unknown> = {}): void {
    if (!this.server || !rooms.length) return;
    const hit = this.pending.get(topic);
    if (hit) {
      rooms.forEach((r) => hit.rooms.add(r));
      return;
    }
    this.pending.set(topic, { rooms: new Set(rooms), data });
    setTimeout(() => {
      const p = this.pending.get(topic);
      this.pending.delete(topic);
      if (p) this.changed([...p.rooms], topic, p.data);
    }, COALESCE_MS).unref?.();
  }

  /** Progress of a long job one person started (import…): their tabs show a live bar. */
  progress(userId: string, p: { id: string; done: number; total: number; label?: string }): void {
    this.server?.to(room.user(userId)).emit('progress', p);
  }

  /** Everyone connected (Super Admin system switches such as maintenance mode). */
  broadcast(topic: LiveTopic, data: Record<string, unknown> = {}): void {
    this.server?.emit('changed', { topic, ...data });
  }

  /** Roles, status, delegations or company access changed — refresh those people's rooms and menus. */
  accessChanged(target: AccessTarget): void {
    if (!this.sessions) return;
    const key = 'userIds' in target ? target.userIds.map((u) => `u:${u}`).join(',') : `c:${target.companyId}`;
    this.pendingAccess.set(key, target);
    // Short wait: the write's transaction has committed and repeated edits collapse
    this.accessTimer ??= setTimeout(() => {
      const targets = [...this.pendingAccess.values()];
      this.pendingAccess.clear();
      this.accessTimer = null;
      for (const t of targets) void this.sessions?.reroom(t).catch(() => undefined);
    }, 500);
    this.accessTimer.unref?.();
  }

  /** Close the open tabs of sessions that were just signed out. */
  signOut(userId: string, which: { sid?: string; exceptSid?: string } = {}, reason = 'signed-out'): void {
    this.sessions?.signOut(userId, which, reason);
  }
}
