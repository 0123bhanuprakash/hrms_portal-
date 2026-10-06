import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { TicketQueue } from '@prisma/client';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import type { JwtPayload } from '@hrms/types';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { ACCESS_USER_SELECT, holds, type AccessContext } from '../access/access.types';
import { QUEUE_PERMISSION, QUEUES } from '../helpdesk/sla';
import { LIVE_AREAS, RealtimeService, room, type AccessTarget, type LiveArea } from './realtime.service';

/** Records that show "also viewing" to the people who review them. */
const PRESENCE_KINDS = ['employee', 'expense', 'leave'] as const;
type PresenceKind = (typeof PRESENCE_KINDS)[number];

interface LiveSocketData {
  userId: string;
  /** Session (refresh-token family) — lets one device be signed out */
  sid: string | null;
  companyId: string | null;
  firstName: string;
  lastName: string;
  queues: TicketQueue[];
  /** Kinds of record this person reviews, so may see (and show) who else is viewing */
  sees: PresenceKind[];
  /** Viewing rooms this tab is in (re-announced when it closes) */
  viewing?: string[];
}

/** Areas where line managers, project leads and covers approve — they watch these without a permission. */
const APPROVAL_AREAS = new Set<LiveArea>(['attendance', 'leave', 'expenses', 'timesheets', 'assets']);

/**
 * Who watches an area beyond themselves: anyone who views it wider than "own",
 * or approves in it. Line managers, project leads and people covering for
 * someone approve without these permissions — they are added separately.
 */
const AREA_VIEW: Record<LiveArea, string[]> = {
  attendance: ['attendance.view', 'attendance.approve', 'attendance.edit'],
  leave: ['leave.view', 'leave.approve'],
  expenses: ['expense.approve', 'expense.finance', 'expense.hr'],
  timesheets: ['timesheet.approve'],
  assets: ['asset.approve_it', 'asset.approve_hr', 'asset.manage'],
  // Read / confirmation counts go to the people who run announcements
  announcements: ['announcement.manage'],
  kudos: ['kudos.manage'],
  projects: ['project.manage'],
  // Always sent to the whole company
  branding: [],
  people: [],
};
type LiveSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, LiveSocketData>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Socket.IO connection per open tab. The tab signs in with its access
 * token (sent in the handshake body, never in the URL). When the token
 * expires the server says "expired" and drops the connection; the tab
 * reconnects with a fresh token. CORS comes from LiveIoAdapter.
 */
@WebSocketGateway({ path: '/socket.io', serveClient: false })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly jwt: JwtService;
  private readonly key: crypto.KeyObject;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
    private readonly realtime: RealtimeService,
  ) {
    const secret = config.get<string>('jwt.secret');
    if (!secret) throw new Error('JWT_SECRET is not configured');
    this.key = crypto.createSecretKey(Buffer.from(secret));
    this.jwt = new JwtService({});
  }

  afterInit(server: Server): void {
    this.server = server;
    this.realtime.attach(server, {
      reroom: (target) => this.reroom(target),
      signOut: (userId, which, reason) => this.signOut(userId, which, reason),
    });
  }

  private server: Server | null = null;

  /**
   * The rooms a person belongs in right now, or null when they may no longer
   * be signed in (deactivated, company paused). `fresh` skips the short user cache.
   */
  private async placeFor(userId: string, fresh = false): Promise<{ data: Omit<LiveSocketData, 'sid'>; rooms: string[] } | null> {
    const load = () =>
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          ...ACCESS_USER_SELECT,
          status: true,
          firstName: true,
          lastName: true,
          company: { select: { status: true, featuresVersion: true, hierarchyVersion: true } },
        },
      });
    const user = fresh ? await load() : await this.accessService.cachedUserRow(userId, load);
    if (!user || user.status !== 'ACTIVE' || (user.company && user.company.status !== 'ACTIVE')) return null;
    const access = await this.accessService.resolve(user);

    const queues = access.companyId && !access.isSuperAdmin ? QUEUES.filter((q) => holds(access, QUEUE_PERMISSION[q])) : [];
    const rooms = [room.user(user.id)];
    const sees: PresenceKind[] = [];
    if (access.companyId) {
      rooms.push(room.company(access.companyId));
      const approver = await this.approvesForOthers(access);
      for (const area of LIVE_AREAS) if ((approver && APPROVAL_AREAS.has(area)) || this.watches(access, area)) rooms.push(room.area(access.companyId, area));
      // Reviewers of a kind of record see who else has one open
      const employeeView = access.grants.get('employee.view');
      if (approver || (access.grants.has('employee.view') && employeeView !== 'own')) sees.push('employee');
      if (rooms.includes(room.area(access.companyId, 'expenses'))) sees.push('expense');
      if (rooms.includes(room.area(access.companyId, 'leave'))) sees.push('leave');
    }
    for (const q of queues) rooms.push(room.queue(access.companyId!, q));
    if (access.isSuperAdmin) rooms.push(room.superAdmins);
    return { data: { userId: user.id, companyId: access.companyId, firstName: user.firstName, lastName: user.lastName, queues, sees }, rooms };
  }

  /** Views or approves this area for people other than themselves. */
  private watches(access: AccessContext, area: LiveArea): boolean {
    return AREA_VIEW[area].some((key) => access.grants.has(key) && access.grants.get(key) !== 'own');
  }

  /** Line manager, project lead / manager, or covering for someone — approves without a role permission. */
  private async approvesForOthers(access: AccessContext): Promise<boolean> {
    if (access.delegations.length) return true;
    const me = access.employee?.id;
    if (!me || !access.companyId) return false;
    const today = new Date();
    const [reports, leads] = await Promise.all([
      this.prisma.employee.count({ where: { companyId: access.companyId, reportingManagerId: me, employmentStatus: { not: 'TERMINATED' } } }),
      this.prisma.projectMember.count({
        where: { employeeId: me, role: { in: ['TEAM_LEAD', 'MANAGER'] }, startDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
      }),
    ]);
    return reports + leads > 0;
  }

  /** After an access change: move the open tabs into their new rooms, or sign them out. */
  private async reroom(target: AccessTarget): Promise<void> {
    if (!this.server) return;
    const all = [...this.server.of('/').sockets.values()] as LiveSocket[];
    const sockets = all.filter((s) => s.data?.userId && ('userIds' in target ? target.userIds.includes(s.data.userId) : s.data.companyId === target.companyId));
    const byUser = new Map<string, LiveSocket[]>();
    for (const s of sockets) byUser.set(s.data.userId, [...(byUser.get(s.data.userId) ?? []), s]);
    for (const [userId, tabs] of byUser) {
      const place = await this.placeFor(userId, true);
      for (const s of tabs) {
        if (!place) {
          s.emit('signed-out', { reason: 'inactive' });
          s.disconnect(true);
          continue;
        }
        // Leave rooms that no longer apply (tickets are re-checked below)
        const keep = new Set([s.id, ...place.rooms]);
        for (const r of [...s.rooms]) if (!keep.has(r) && !r.startsWith('t:')) await s.leave(r);
        await s.join(place.rooms);
        s.data = { ...s.data, ...place.data };
        for (const r of [...s.rooms]) if (r.startsWith('t:') && !(await this.canWatch(s.data, r.slice(2)))) await s.leave(r);
        for (const r of [...s.rooms]) {
          if (!r.startsWith('v:') || s.data.sees.includes(r.split(':')[1] as PresenceKind)) continue;
          await s.leave(r);
          await this.announcePresence(r);
        }
        s.emit('changed', { topic: 'access' });
      }
    }
  }

  /** Close the tabs of signed-out sessions. */
  private signOut(userId: string, which: { sid?: string; exceptSid?: string }, reason: string): void {
    if (!this.server) return;
    for (const s of this.server.of('/').sockets.values() as IterableIterator<LiveSocket>) {
      if (s.data?.userId !== userId) continue;
      if (which.sid && s.data.sid !== which.sid) continue;
      if (which.exceptSid && s.data.sid === which.exceptSid) continue;
      s.emit('signed-out', { reason });
      s.disconnect(true);
    }
  }

  async handleConnection(socket: LiveSocket): Promise<void> {
    try {
      const token = socket.handshake.auth?.['token'];
      if (typeof token !== 'string' || !token) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<JwtPayload & { aud?: string }>(token, { secret: this.key as unknown as string });
      if (payload.aud) throw new Error('not an access token');

      const place = await this.placeFor(payload.sub);
      if (!place) throw new Error('inactive');
      socket.data = { ...place.data, sid: payload.sid ?? null };
      await socket.join(place.rooms);

      // Access tokens live 15 minutes — don't keep listening past that
      const ms = (payload.exp ?? 0) * 1000 - Date.now();
      const timer = setTimeout(() => {
        socket.emit('expired');
        socket.disconnect(true);
      }, Math.max(ms, 1000));
      socket.once('disconnect', () => clearTimeout(timer));
      socket.emit('ready');
    } catch (err) {
      this.logger.debug(`Live connection refused: ${(err as Error).message}`);
      socket.emit('unauthorized');
      socket.disconnect(true);
    }
  }

  // ─── "Also viewing" (employee profile, expense claim, leave request) ──

  /** A reviewer opened a record — join its viewing room and tell everyone there who's in. */
  @SubscribeMessage('view:join')
  async viewJoin(@ConnectedSocket() socket: LiveSocket, @MessageBody() body: { kind?: unknown; id?: unknown }): Promise<boolean> {
    const kind = PRESENCE_KINDS.find((k) => k === body?.kind);
    const id = typeof body?.id === 'string' && UUID.test(body.id) ? body.id : null;
    const me = socket.data;
    if (!kind || !id || !me?.companyId || !me.sees.includes(kind)) return false;
    if (!(await this.recordExists(me.companyId, kind, id))) return false;
    const name = `v:${kind}:${id}`;
    await socket.join(name);
    // Remembered so a closed tab can update the rooms it was in
    me.viewing = [...new Set([...(me.viewing ?? []), name])];
    await this.announcePresence(name);
    return true;
  }

  @SubscribeMessage('view:leave')
  async viewLeave(@ConnectedSocket() socket: LiveSocket, @MessageBody() body: { kind?: unknown; id?: unknown }): Promise<void> {
    if (typeof body?.kind !== 'string' || typeof body?.id !== 'string') return;
    const name = `v:${body.kind}:${body.id}`;
    if (!socket.rooms.has(name)) return;
    await socket.leave(name);
    socket.data.viewing = (socket.data.viewing ?? []).filter((v) => v !== name);
    await this.announcePresence(name);
  }

  /** A tab closed: update the viewing rooms it was in. */
  handleDisconnect(socket: LiveSocket): void {
    // Socket.IO has already removed it from its rooms; re-announce the ones it watched
    for (const name of socket.data?.viewing ?? []) void this.announcePresence(name);
  }

  private async recordExists(companyId: string, kind: PresenceKind, id: string): Promise<boolean> {
    const where = { id, companyId };
    if (kind === 'employee') return (await this.prisma.employee.count({ where })) > 0;
    if (kind === 'expense') return (await this.prisma.expenseClaim.count({ where })) > 0;
    return (await this.prisma.leaveRequest.count({ where })) > 0;
  }

  /** Everyone viewing (one entry per person, however many tabs). */
  private async announcePresence(name: string): Promise<void> {
    if (!this.server) return;
    const sockets = (await this.server.in(name).fetchSockets()) as unknown as LiveSocket[];
    const people = new Map<string, { userId: string; name: string; initials: string }>();
    for (const s of sockets) {
      const d = s.data;
      if (d?.userId && !people.has(d.userId)) people.set(d.userId, { userId: d.userId, name: `${d.firstName} ${d.lastName}`.trim(), initials: `${d.firstName[0] ?? ''}${d.lastName[0] ?? ''}`.toUpperCase() });
    }
    const [, kind, id] = name.split(':');
    this.server.to(name).emit('presence', { kind, id, people: [...people.values()] });
  }

  /** A tab opened a ticket — join its room (only if this person may see it). */
  @SubscribeMessage('ticket:watch')
  async watch(@ConnectedSocket() socket: LiveSocket, @MessageBody() body: { id?: unknown }): Promise<boolean> {
    const id = typeof body?.id === 'string' && UUID.test(body.id) ? body.id : null;
    if (!id || !(await this.canWatch(socket.data, id))) return false;
    await socket.join(room.ticket(id));
    return true;
  }

  /** The ticket is this person's own, or in a queue they work. */
  private async canWatch(me: LiveSocketData | undefined, id: string): Promise<boolean> {
    if (!me?.companyId) return false;
    const t = await this.prisma.ticket.findFirst({ where: { id, companyId: me.companyId }, select: { queue: true, employee: { select: { userId: true } } } });
    return Boolean(t && (t.employee.userId === me.userId || me.queues.includes(t.queue)));
  }

  @SubscribeMessage('ticket:unwatch')
  async unwatch(@ConnectedSocket() socket: LiveSocket, @MessageBody() body: { id?: unknown }): Promise<void> {
    if (typeof body?.id === 'string') await socket.leave(room.ticket(body.id));
  }

  /** "Rohit is writing…" — relayed to the other tabs watching the ticket. */
  @SubscribeMessage('ticket:typing')
  typing(@ConnectedSocket() socket: LiveSocket, @MessageBody() body: { id?: unknown; typing?: unknown }): void {
    const id = typeof body?.id === 'string' ? body.id : null;
    if (!id || !socket.rooms.has(room.ticket(id))) return;
    socket.to(room.ticket(id)).emit('typing', { ticketId: id, userId: socket.data.userId, name: socket.data.firstName, typing: body.typing !== false });
  }
}
