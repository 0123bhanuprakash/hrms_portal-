import { Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoleStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProducerService } from '../email/email.producer.service';
import { RealtimeService, room } from '../realtime/realtime.service';
import { isQuiet, localClock, SUMMARY_HOUR, topicOf, type QuietHours, type TopicPrefs } from './topics';

const RELEASE_EVERY_MS = 15 * 60_000;

export interface NotifyInput {
  companyId: string | null;
  userIds: Array<string | null | undefined>;
  /** e.g. leave.submitted — used for icons and filtering */
  type: string;
  title: string;
  body?: string | null;
  /** App path, e.g. /app/leave/approvals */
  link?: string | null;
  actionLabel?: string;
  /** One notification per user per key (reminders) */
  dedupeKey?: string;
  /** Also email (if the user allows notification emails). Default true. */
  email?: boolean;
}

/**
 * In-app inbox + notification emails. `notify` never throws — a failed
 * notification must not undo the leave approval that caused it.
 */
@Injectable()
export class NotificationsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProducerService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Every 15 minutes: send emails held back by quiet hours / the daily summary. */
  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.releaseHeld().catch((e) => this.logger.error(e)), RELEASE_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async notify(input: NotifyInput): Promise<number> {
    try {
      let userIds = [...new Set(input.userIds.filter((id): id is string => Boolean(id)))];
      if (!userIds.length) return 0;
      // Per-topic choices: in-app off → arrives already read (no ping); both off → nothing at all
      const topic = topicOf(input.type);
      const chosen = new Map<string, { app?: boolean; email?: boolean }>();
      if (topic) {
        const prefs = await this.prisma.userPreferences.findMany({ where: { userId: { in: userIds } }, select: { userId: true, notificationTopics: true } });
        for (const p of prefs) chosen.set(p.userId, ((p.notificationTopics ?? {}) as TopicPrefs)[topic] ?? {});
        userIds = userIds.filter((u) => !(chosen.get(u)?.app === false && chosen.get(u)?.email === false));
        if (!userIds.length) return 0;
      }
      const silent = (u: string) => chosen.get(u)?.app === false;
      const created: Array<{ id: string; userId: string; createdAt: Date }> = [];
      if (!input.dedupeKey) {
        // Bulk (e.g. a company-wide announcement)
        const rows = await this.prisma.notification.createManyAndReturn({
          data: userIds.map((userId) => ({
            companyId: input.companyId,
            userId,
            type: input.type,
            title: input.title.slice(0, 200),
            body: input.body?.slice(0, 1000) ?? null,
            link: input.link ?? null,
            readAt: silent(userId) ? new Date() : null,
          })),
          select: { id: true, userId: true, createdAt: true },
        });
        created.push(...rows);
      }
      for (const userId of input.dedupeKey ? userIds : []) {
        try {
          const n = await this.prisma.notification.create({
            data: {
              companyId: input.companyId,
              userId,
              type: input.type,
              title: input.title.slice(0, 200),
              body: input.body?.slice(0, 1000) ?? null,
              link: input.link ?? null,
              dedupeKey: input.dedupeKey ?? null,
              readAt: silent(userId) ? new Date() : null,
            },
            select: { id: true, userId: true, createdAt: true },
          });
          created.push(n);
        } catch (err) {
          // Already notified for this dedupe key → skip quietly
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        }
      }
      for (const n of created) {
        if (silent(n.userId)) continue;
        this.realtime.notification(n.userId, { id: n.id, type: input.type, title: input.title.slice(0, 200), body: input.body?.slice(0, 1000) ?? null, link: input.link ?? null, createdAt: n.createdAt });
      }
      if (created.length && input.email !== false) void this.emailOut(created.map((n) => n.id), input);
      return created.length;
    } catch (err) {
      this.logger.error(`Could not create "${input.type}" notifications`, err as Error);
      return 0;
    }
  }

  /** Emails the new notifications to users who allow notification emails. */
  private async emailOut(ids: string[], input: NotifyInput): Promise<void> {
    try {
      const rows = await this.prisma.notification.findMany({
        where: { id: { in: ids }, user: { status: UserStatus.ACTIVE, OR: [{ preferences: null }, { preferences: { emailNotifications: true } }] } },
        select: { id: true, user: { select: { email: true, firstName: true, preferences: { select: { notificationTopics: true, quietHours: true, dailySummary: true, timezone: true } } } } },
      });
      if (!rows.length) return;
      const topic = topicOf(input.type);
      const now = new Date();
      const company = input.companyId
        ? await this.prisma.company.findUnique({ where: { id: input.companyId }, select: { name: true, branding: { select: { displayName: true, primaryColor: true, logoUrl: true } } } })
        : null;
      const webUrl = (this.config.get<string>('webUrl') ?? 'http://localhost:3000').replace(/\/+$/, '');
      for (const row of rows) {
        const prefs = row.user.preferences;
        if (topic && ((prefs?.notificationTopics ?? {}) as TopicPrefs)[topic]?.email === false) continue;
        // Quiet hours or a daily summary: keep it for the summary email
        if (prefs && (prefs.dailySummary || isQuiet(prefs.quietHours as QuietHours | null, now, prefs.timezone || 'Asia/Kolkata'))) {
          await this.prisma.notification.update({ where: { id: row.id }, data: { emailHeld: true } });
          continue;
        }
        await this.email.queueNotification({
          to: row.user.email,
          firstName: row.user.firstName,
          title: input.title,
          body: input.body ?? null,
          actionUrl: input.link ? `${webUrl}${input.link}` : null,
          actionLabel: input.actionLabel,
          preferencesUrl: `${webUrl}/app/settings/preferences`,
          companyName: company?.branding?.displayName || company?.name || undefined,
          primaryColor: company?.branding?.primaryColor ?? undefined,
          logoUrl: company?.branding?.logoUrl ?? undefined,
        });
        await this.prisma.notification.update({ where: { id: row.id }, data: { emailedAt: new Date() } });
      }
    } catch (err) {
      this.logger.error(`Could not email "${input.type}" notifications`, err as Error);
    }
  }

  /**
   * Sends emails held back by quiet hours (once they end) or the daily summary
   * (from 09:00 local, with everything from before 09:00) — one email per person.
   */
  async releaseHeld(now = new Date(), onlyCompanyId?: string): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: { emailHeld: true, emailedAt: null, user: { status: UserStatus.ACTIVE }, ...(onlyCompanyId && { companyId: onlyCompanyId }) },
      select: {
        id: true,
        companyId: true,
        title: true,
        link: true,
        createdAt: true,
        userId: true,
        user: { select: { email: true, firstName: true, preferences: { select: { quietHours: true, dailySummary: true, timezone: true, emailNotifications: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });
    const byUser = new Map<string, typeof rows>();
    for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    const webUrl = (this.config.get<string>('webUrl') ?? 'http://localhost:3000').replace(/\/+$/, '');
    let sent = 0;
    for (const list of byUser.values()) {
      const p = list[0]!.user.preferences;
      const tz = p?.timezone || 'Asia/Kolkata';
      if (p && !p.emailNotifications) {
        await this.prisma.notification.updateMany({ where: { id: { in: list.map((r) => r.id) } }, data: { emailHeld: false } });
        continue;
      }
      if (isQuiet(p?.quietHours as QuietHours | null, now, tz)) continue;
      let due = list;
      if (p?.dailySummary) {
        const today = localClock(now, tz);
        if (today.minutes < SUMMARY_HOUR * 60) continue;
        // Everything from before 09:00 today; later ones wait for tomorrow's summary
        due = list.filter((r) => {
          const c = localClock(r.createdAt, tz);
          return c.dateKey < today.dateKey || c.minutes < SUMMARY_HOUR * 60;
        });
        if (!due.length) continue;
      }
      const first = due[0]!;
      const company = first.companyId
        ? await this.prisma.company.findUnique({ where: { id: first.companyId }, select: { name: true, branding: { select: { displayName: true, primaryColor: true, logoUrl: true } } } })
        : null;
      const one = due.length === 1;
      try {
        await this.email.queueNotification({
          to: first.user.email,
          firstName: first.user.firstName,
          title: one ? first.title : p?.dailySummary ? `Your daily summary — ${due.length} updates` : `${due.length} updates while things were quiet`,
          body: one ? null : due.slice(0, 15).map((r) => `• ${r.title}`).join('\n') + (due.length > 15 ? `\n…and ${due.length - 15} more` : ''),
          actionUrl: one && first.link ? `${webUrl}${first.link}` : `${webUrl}/app`,
          actionLabel: one ? undefined : 'Open the portal',
          preferencesUrl: `${webUrl}/app/settings/preferences`,
          companyName: company?.branding?.displayName || company?.name || undefined,
          primaryColor: company?.branding?.primaryColor ?? undefined,
          logoUrl: company?.branding?.logoUrl ?? undefined,
        });
        await this.prisma.notification.updateMany({ where: { id: { in: due.map((r) => r.id) } }, data: { emailHeld: false, emailedAt: now } });
        sent++;
      } catch (err) {
        this.logger.error(`Could not send the held emails to ${first.user.email}`, err as Error);
      }
    }
    return sent;
  }

  // ─── Inbox ─────────────────────────────────────────────────

  async list(userId: string, opts: { unreadOnly?: boolean; page?: number; limit?: number }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const where: Prisma.NotificationWhereInput = { userId, ...(opts.unreadOnly && { readAt: null }) };
    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      }),
      this.prisma.notification.count({ where }),
      this.unreadCount(userId),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit), unread } };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    if (!count && !(await this.prisma.notification.count({ where: { id, userId } }))) throw new NotFoundException('Notification not found');
    if (count) this.realtime.changed([room.user(userId)], 'notifications');
    return { id, unread: await this.unreadCount(userId) };
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    if (count) this.realtime.changed([room.user(userId)], 'notifications');
    return { marked: count, unread: 0 };
  }

  /**
   * Quietly takes back notifications about something that no longer exists
   * (a deleted post or kudos): removed from every bell, no new alert.
   * Match by app link prefix and / or dedupe-key prefix.
   */
  async withdraw(companyId: string, match: { linkPrefix?: string; dedupePrefixes?: string[] }): Promise<number> {
    const or: Prisma.NotificationWhereInput[] = [
      ...(match.linkPrefix ? [{ link: { startsWith: match.linkPrefix } }] : []),
      ...(match.dedupePrefixes ?? []).map((p) => ({ dedupeKey: { startsWith: p } })),
    ];
    if (!or.length) return 0;
    const where: Prisma.NotificationWhereInput = { companyId, OR: or };
    const users = await this.prisma.notification.findMany({ where, select: { userId: true }, distinct: ['userId'] });
    if (!users.length) return 0;
    const { count } = await this.prisma.notification.deleteMany({ where });
    this.realtime.changed(users.map((u) => room.user(u.userId)), 'notifications');
    return count;
  }

  // ─── Recipients ────────────────────────────────────────────

  /** Active users whose roles hold `permission` company-wide (HR), plus Company Admins. */
  async companyWideApprovers(companyId: string, permission: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: {
              status: RoleStatus.ACTIVE,
              OR: [{ isOwner: true }, { rolePermissions: { some: { permission: { key: permission }, OR: [{ scope: 'company' }, { scope: null }] } } }],
            },
          },
        },
      },
      select: { id: true },
      take: 25,
    });
    return users.map((u) => u.id);
  }

  /** Whether a user's roles include a permission (any scope). */
  async holds(userId: string, permission: string): Promise<boolean> {
    return (
      (await this.prisma.userRole.count({
        where: {
          userId,
          user: { status: UserStatus.ACTIVE },
          role: { status: RoleStatus.ACTIVE, OR: [{ isOwner: true }, { rolePermissions: { some: { permission: { key: permission } } } }] },
        },
      })) > 0
    );
  }

  /** People covering approvals for these users right now (active delegations), optionally for one approval kind. */
  async coveringFor(userIds: string[], permission?: string): Promise<string[]> {
    if (!userIds.length) return [];
    const now = new Date();
    const rows = await this.prisma.approvalDelegation.findMany({
      where: {
        delegatorId: { in: userIds },
        revokedAt: null,
        startsAt: { lte: now },
        endsAt: { gt: now },
        ...(permission && { OR: [{ permissions: { isEmpty: true } }, { permissions: { has: permission } }] }),
      },
      select: { delegateId: true },
    });
    return rows.map((r) => r.delegateId);
  }
}

/** "Mon, 5 Oct" or "5 Oct – 9 Oct" from date keys. */
export function dateRange(startKey: string, endKey: string): string {
  const fmt = (k: string, withDay: boolean) =>
    new Date(`${k}T00:00:00Z`).toLocaleDateString('en-GB', { ...(withDay && { weekday: 'short' }), day: 'numeric', month: 'short', timeZone: 'UTC' });
  return startKey === endKey ? fmt(startKey, true) : `${fmt(startKey, false)} – ${fmt(endKey, false)}`;
}
