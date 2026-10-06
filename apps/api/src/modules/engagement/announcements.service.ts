import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AnnouncementAudience, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivateFilesService } from '../employee-profile/private-files.service';
import { detectFileType, DOCUMENT_TYPES } from '../employee-profile/file-types';
import { wordsWhere } from '../../common/word-search';
import { ANNOUNCEMENT_REACTIONS, type AnnouncementAudienceDto, type AnnouncementQueryDto, type SaveAnnouncementDto } from './dto';
import { StorageService } from '../storage/storage.service';

const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const LOTTIE_MAX_BYTES = 1024 * 1024;
const DAY_MS = 86_400_000;
/** Nudges to the same post: at most one every 12 hours */
const NUDGE_GAP_MS = 12 * 3_600_000;
/** The automatic "please confirm" reminder goes this many days before the due date */
const REMIND_DAYS_BEFORE = 2;
const EVERY_MS = 60_000;

const SELECT = {
  id: true,
  title: true,
  body: true,
  mentionIds: true,
  audience: true,
  departmentIds: true,
  locationIds: true,
  teamManagerId: true,
  pinned: true,
  requiresAck: true,
  ackDueAt: true,
  sendEmail: true,
  expiresAt: true,
  publishedAt: true,
  updatedAt: true,
  status: true,
  notifiedAt: true,
  category: true,
  cover: true,
  coverEmoji: true,
  coverScene: true,
  coverArt: true,
  coverMotion: true,
  coverMediaUrl: true,
  coverMediaKind: true,
  coverFocusX: true,
  coverFocusY: true,
  coverDim: true,
  allowReactions: true,
  eventAt: true,
  eventPlace: true,
  lastNudgedAt: true,
  attachmentName: true,
  attachmentMime: true,
  attachmentSize: true,
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, employee: { select: { id: true, avatarUrl: true, designation: { select: { name: true } } } } } },
} satisfies Prisma.AnnouncementSelect;
type Row = Prisma.AnnouncementGetPayload<{ select: typeof SELECT }>;
const WITH_SOCIAL = { ...SELECT, reactions: { select: { emoji: true, userId: true } }, rsvps: { select: { response: true, userId: true } } } satisfies Prisma.AnnouncementSelect;
type SocialRow = Prisma.AnnouncementGetPayload<{ select: typeof WITH_SOCIAL }>;

/** "**bold**", "[text](url)" and "- " bullets → plain text (notifications, emails). */
/** `@[Priya Shah](<employee id>)` in a post body — a mention. */
const MENTION = /@\[([^\]\n]{1,80})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;
const MAX_MENTIONS = 20;

/** Employee ids mentioned in a body (each once). */
export function mentionedEmployeeIds(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION)].map((m) => m[2]!.toLowerCase()))];
}

export function plainText(body: string): string {
  return body
    .replace(MENTION, '@$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S.*?)\*/g, '$1$2')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/^\s*[-•]\s+/gm, '• ');
}

/**
 * Announcements to the whole company, some departments (and their
 * sub-departments), some locations — or, for managers and team leads,
 * their own team (everyone below them in the reporting line).
 *
 *   announcement.manage     HR / Company Admin: pin (one post at a time), edit or
 *                           remove anyone's posts, every read report
 *   announcement.post       + IT Admin: post to everyone / departments / locations
 *   announcement.post_team  Managers / team leads: their own team
 * Posters always manage (edit, remove, read report, nudge) their own posts.
 *
 * Posts can be drafts, scheduled for later, or published now. The audience
 * is notified once, when a post is published.
 */
@Injectable()
export class AnnouncementsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AnnouncementsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly files: PrivateFilesService,
    private readonly storage?: StorageService,
    private readonly config?: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config?.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.runDue(), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ─── Who may do what ──────────────────────────────────────

  /** Pins and manages everyone's posts */
  private isManager(access: AccessContext) {
    return holds(access, 'announcement.manage');
  }
  /** Posts to everyone / departments / locations */
  private isHr(access: AccessContext) {
    return holds(access, 'announcement.post') || this.isManager(access);
  }
  private isTeamPoster(access: AccessContext) {
    return holds(access, 'announcement.post_team') && Boolean(access.employee);
  }
  canWrite(access: AccessContext) {
    return this.isHr(access) || this.isTeamPoster(access);
  }
  /** Managers: any post. Posters: their own. */
  private canManage(row: { author: { id: string } | null }, access: AccessContext) {
    return this.isManager(access) || (this.canWrite(access) && row.author?.id === access.userId);
  }

  /** Announcements this person is in the audience of (managers see all; authors see their own). */
  private async audienceFilter(companyId: string, access: AccessContext): Promise<Prisma.AnnouncementWhereInput> {
    if (this.isManager(access)) return {};
    const me = access.employee;
    const [deptAncestors, managers] = await Promise.all([
      me?.departmentId
        ? this.prisma.departmentHierarchy.findMany({ where: { companyId, descendantId: me.departmentId }, select: { ancestorId: true } }).then((r) => r.map((d) => d.ancestorId))
        : Promise.resolve([] as string[]),
      me ? this.prisma.employeeHierarchy.findMany({ where: { descendantId: me.id, depth: { gte: 1 } }, select: { ancestorId: true } }).then((r) => r.map((d) => d.ancestorId)) : Promise.resolve([] as string[]),
    ]);
    return {
      OR: [
        { audience: AnnouncementAudience.COMPANY },
        ...(deptAncestors.length ? [{ audience: AnnouncementAudience.DEPARTMENTS, departmentIds: { hasSome: deptAncestors } }] : []),
        ...(me?.locationId ? [{ audience: AnnouncementAudience.LOCATIONS, locationIds: { has: me.locationId } }] : []),
        ...(managers.length ? [{ audience: AnnouncementAudience.TEAM, teamManagerId: { in: managers } }] : []),
        { authorId: access.userId },
      ],
    };
  }

  private published(now: Date): Prisma.AnnouncementWhereInput {
    return { status: 'published', publishedAt: { lte: now } };
  }

  // ─── Feed ─────────────────────────────────────────────────

  async list(companyId: string, access: AccessContext, query: AnnouncementQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();
    const audience = await this.audienceFilter(companyId, access);
    const drafts = query.view === 'drafts';
    if (drafts && !this.canWrite(access)) throw new ForbiddenException('Only people who post announcements have drafts');
    const where: Prisma.AnnouncementWhereInput = {
      companyId,
      deletedAt: null,
      AND: [
        audience,
        drafts ? { status: { in: ['draft', 'scheduled'] }, ...(this.isManager(access) ? {} : { authorId: access.userId }) } : this.published(now),
        ...(drafts || (query.includeExpired && this.canWrite(access)) ? [] : [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }]),
        ...(query.filter === 'unread' ? [{ reads: { none: { userId: access.userId } } }] : []),
        ...(query.filter === 'ack' ? [{ requiresAck: true, reads: { none: { userId: access.userId, acknowledgedAt: { not: null } } } }] : []),
        ...(query.category ? [{ category: query.category }] : []),
        ...(query.search ? [wordsWhere(query.search, (w): Prisma.AnnouncementWhereInput[] => [{ title: { contains: w, mode: 'insensitive' } }, { body: { contains: w, mode: 'insensitive' } }])!] : []),
      ],
    };
    const live: Prisma.AnnouncementWhereInput = { companyId, deletedAt: null, ...this.published(now), OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
    const [rows, total, unread, needsAck, draftCount] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: drafts ? [{ updatedAt: 'desc' }] : [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { ...WITH_SOCIAL, reads: { where: { userId: access.userId }, select: { readAt: true, acknowledgedAt: true } } },
      }),
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.count({ where: { ...live, AND: [audience, { NOT: { authorId: access.userId } }, { reads: { none: { userId: access.userId } } }] } }),
      this.prisma.announcement.count({ where: { ...live, requiresAck: true, AND: [audience, { NOT: { authorId: access.userId } }, { reads: { none: { userId: access.userId, acknowledgedAt: { not: null } } } }] } }),
      this.canWrite(access)
        ? this.prisma.announcement.count({ where: { companyId, deletedAt: null, status: { in: ['draft', 'scheduled'] }, ...(this.isManager(access) ? {} : { authorId: access.userId }) } })
        : Promise.resolve(0),
    ]);
    const extras = await this.extras(companyId, rows);
    return {
      data: rows.map(({ reads, ...r }) => ({ ...this.present(r, reads[0] ?? null, access, now), ...extras.get(r.id) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), unread, needsAck, drafts: draftCount, canPost: this.canWrite(access), canPostCompany: this.isHr(access), canPin: this.isManager(access) },
    };
  }

  /** Side panel: what I still need to confirm, events coming up, and (posters) how my posts are doing. */
  async overview(companyId: string, access: AccessContext) {
    const now = new Date();
    const audience = await this.audienceFilter(companyId, access);
    const live: Prisma.AnnouncementWhereInput = { companyId, deletedAt: null, ...this.published(now), OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
    const [toConfirm, events] = await Promise.all([
      this.prisma.announcement.findMany({
        where: { ...live, requiresAck: true, AND: [audience, { NOT: { authorId: access.userId } }, { reads: { none: { userId: access.userId, acknowledgedAt: { not: null } } } }] },
        orderBy: [{ ackDueAt: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'desc' }],
        take: 5,
        select: { id: true, title: true, category: true, coverEmoji: true, ackDueAt: true, publishedAt: true },
      }),
      this.prisma.announcement.findMany({
        where: { ...live, eventAt: { gte: new Date(now.getTime() - 3 * 3_600_000) }, AND: [audience] },
        orderBy: { eventAt: 'asc' },
        take: 5,
        select: { id: true, title: true, category: true, coverEmoji: true, eventAt: true, eventPlace: true, rsvps: { select: { response: true, userId: true } } },
      }),
    ]);
    let mine: null | { posts: number; avgReadPct: number | null; avgConfirmPct: number | null; lagging: { id: string; title: string; waiting: number } | null } = null;
    if (this.canWrite(access)) {
      const since = new Date(now.getFullYear(), now.getMonth(), 1);
      const posts = await this.prisma.announcement.findMany({
        where: { companyId, deletedAt: null, authorId: access.userId, status: 'published', publishedAt: { gte: since, lte: now } },
        select: SELECT,
        orderBy: { publishedAt: 'desc' },
        take: 20,
      });
      const stats = await Promise.all(posts.map(async (p) => ({ p, s: await this.stats(companyId, p) })));
      const reads = stats.filter((x) => x.s.audience > 0);
      const acks = reads.filter((x) => x.p.requiresAck);
      const lag = acks.map((x) => ({ id: x.p.id, title: x.p.title, waiting: x.s.audience - x.s.acknowledged })).filter((x) => x.waiting > 0).sort((a, b) => b.waiting - a.waiting)[0] ?? null;
      mine = {
        posts: posts.length,
        avgReadPct: reads.length ? Math.round((reads.reduce((n, x) => n + x.s.read / x.s.audience, 0) / reads.length) * 100) : null,
        avgConfirmPct: acks.length ? Math.round((acks.reduce((n, x) => n + x.s.acknowledged / x.s.audience, 0) / acks.length) * 100) : null,
        lagging: lag,
      };
    }
    // Reading this month, streak, most loved, documents, and what to feature at the top
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const visibleLive: Prisma.AnnouncementWhereInput = { ...live, AND: [audience, { NOT: { authorId: access.userId } }] };
    const [monthTotal, monthRead, reads, loved, documents, featuredRows] = await Promise.all([
      this.prisma.announcement.count({ where: { ...visibleLive, publishedAt: { gte: monthStart, lte: now } } }),
      this.prisma.announcement.count({ where: { ...visibleLive, publishedAt: { gte: monthStart, lte: now }, reads: { some: { userId: access.userId } } } }),
      this.prisma.announcementRead.findMany({ where: { userId: access.userId, readAt: { gte: new Date(now.getTime() - 60 * DAY_MS) } }, select: { readAt: true } }),
      this.prisma.announcement.findMany({
        where: { ...live, AND: [audience], publishedAt: { gte: new Date(now.getTime() - 7 * DAY_MS), lte: now }, reactions: { some: {} } },
        select: { id: true, title: true, category: true, coverEmoji: true, _count: { select: { reactions: true } } },
        orderBy: { reactions: { _count: 'desc' } },
        take: 3,
      }),
      this.prisma.announcement.findMany({
        where: { ...live, AND: [audience], attachmentName: { not: null } },
        select: { id: true, title: true, attachmentName: true, attachmentMime: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      }),
      this.prisma.announcement.findMany({
        where: {
          ...live,
          AND: [audience],
          OR: [{ pinned: true }, { eventAt: { gte: now } }, { category: 'urgent', publishedAt: { gte: new Date(now.getTime() - 2 * DAY_MS) } }],
        },
        select: { ...WITH_SOCIAL, reads: { where: { userId: access.userId }, select: { readAt: true, acknowledgedAt: true } } },
        orderBy: [{ pinned: 'desc' }, { eventAt: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'desc' }],
        take: 6,
      }),
    ]);
    // Days in a row (ending today or yesterday) with at least one read
    const days = new Set(reads.map((r) => r.readAt.toISOString().slice(0, 10)));
    let streak = 0;
    for (let d = new Date(now); ; d = new Date(d.getTime() - DAY_MS)) {
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) streak++;
      else if (streak > 0 || key !== now.toISOString().slice(0, 10)) break;
    }
    const pinnedFirst = featuredRows.find((f) => f.pinned);
    const nextEvent = featuredRows.filter((f) => f.eventAt && f.eventAt >= now && f.id !== pinnedFirst?.id).sort((a, b) => a.eventAt!.getTime() - b.eventAt!.getTime())[0];
    const urgent = featuredRows.find((f) => f.category === 'urgent' && f.id !== pinnedFirst?.id && f.id !== nextEvent?.id);
    const featured = [pinnedFirst, nextEvent, urgent].filter((x): x is NonNullable<typeof x> => Boolean(x));
    const featuredExtras = await this.extras(companyId, featured);
    return {
      toConfirm,
      events: events.map(({ rsvps, ...e }) => ({ ...e, going: rsvps.filter((r) => r.response === 'going').length, mine: rsvps.find((r) => r.userId === access.userId)?.response ?? null })),
      mine,
      reading: { total: monthTotal, read: monthRead, streak, allConfirmed: toConfirm.length === 0 },
      mostLoved: loved.map(({ _count, ...l }) => ({ ...l, reactions: _count.reactions })),
      documents,
      featured: featured.map(({ reads: r, ...f }) => ({ ...this.present(f, r[0] ?? null, access, now), ...featuredExtras.get(f.id) })),
    };
  }

  /** Who's going (faces) for events, and how much of the audience confirmed (posts that ask). */
  private async extras(companyId: string, rows: Array<SocialRow>) {
    const out = new Map<string, { goingFaces?: Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null }>; confirmedPct?: number | null }>();
    const goingIds = [...new Set(rows.filter((r) => r.eventAt).flatMap((r) => r.rsvps.filter((x) => x.response === 'going').slice(0, 5).map((x) => x.userId)))];
    const users = goingIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: goingIds } }, select: { id: true, firstName: true, lastName: true, avatarUrl: true, employee: { select: { avatarUrl: true } } } })
      : [];
    const byId = new Map(users.map((u) => [u.id, { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.employee?.avatarUrl ?? u.avatarUrl }]));
    for (const r of rows) {
      const e: { goingFaces?: Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null }>; confirmedPct?: number | null } = {};
      if (r.eventAt) e.goingFaces = r.rsvps.filter((x) => x.response === 'going').slice(0, 5).map((x) => byId.get(x.userId)).filter((x): x is NonNullable<typeof x> => Boolean(x));
      if (r.requiresAck && r.status === 'published') {
        const s = await this.stats(companyId, r);
        e.confirmedPct = s.audience ? Math.round((s.acknowledged / s.audience) * 100) : null;
      }
      out.set(r.id, e);
    }
    return out;
  }

  /** Marks posts as read when they scroll into view (not "confirmed" — that stays a click). */
  async markSeen(companyId: string, access: AccessContext, ids: string[]) {
    const now = new Date();
    const visible = await this.prisma.announcement.findMany({
      where: { id: { in: ids }, companyId, deletedAt: null, ...this.published(now), AND: [await this.audienceFilter(companyId, access)] },
      select: { id: true },
    });
    const { count } = await this.prisma.announcementRead.createMany({ data: visible.map((v) => ({ announcementId: v.id, userId: access.userId })), skipDuplicates: true });
    return { seen: count };
  }

  /** Everything I can see, marked read (confirmations still need a click). */
  async readAll(companyId: string, access: AccessContext) {
    const now = new Date();
    const unread = await this.prisma.announcement.findMany({
      where: { companyId, deletedAt: null, ...this.published(now), AND: [await this.audienceFilter(companyId, access), { reads: { none: { userId: access.userId } } }] },
      select: { id: true },
      take: 500,
    });
    const { count } = await this.prisma.announcementRead.createMany({ data: unread.map((v) => ({ announcementId: v.id, userId: access.userId })), skipDuplicates: true });
    return { read: count };
  }

  /** Opening an announcement marks it read (once it is published). */
  async get(companyId: string, access: AccessContext, id: string) {
    const row = await this.visible(companyId, access, id);
    const isLive = row.status === 'published' && row.publishedAt <= new Date();
    const read = isLive
      ? await this.prisma.announcementRead.upsert({
          where: { announcementId_userId: { announcementId: id, userId: access.userId } },
          update: {},
          create: { announcementId: id, userId: access.userId },
          select: { readAt: true, acknowledgedAt: true },
        })
      : null;
    const stats = this.canManage(row, access) && isLive ? await this.stats(companyId, row) : null;
    const [seenCount, seenFaces, related, extras] = await Promise.all([
      this.prisma.announcementRead.count({ where: { announcementId: id, NOT: { userId: row.author?.id ?? '' } } }),
      // Faces of who read it: only for the people who manage the post
      this.canManage(row, access)
        ? this.prisma.announcementRead.findMany({ where: { announcementId: id }, orderBy: { readAt: 'desc' }, take: 6, select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, employee: { select: { avatarUrl: true } } } } } })
        : Promise.resolve([]),
      isLive
        ? this.prisma.announcement.findMany({
            where: { companyId, deletedAt: null, ...this.published(new Date()), id: { not: id }, category: row.category, AND: [await this.audienceFilter(companyId, access)] },
            orderBy: { publishedAt: 'desc' },
            take: 3,
            select: { id: true, title: true, category: true, cover: true, coverEmoji: true, coverArt: true, coverMediaUrl: true, coverMediaKind: true, publishedAt: true },
          })
        : Promise.resolve([]),
      this.extras(companyId, [row]),
    ]);
    return {
      ...this.present(row, read, access, new Date()),
      ...extras.get(row.id),
      stats,
      seen: { count: seenCount, faces: seenFaces.map((s) => ({ id: s.user.id, firstName: s.user.firstName, lastName: s.user.lastName, avatarUrl: s.user.employee?.avatarUrl ?? s.user.avatarUrl })) },
      related,
    };
  }

  async acknowledge(companyId: string, access: AccessContext, id: string) {
    const row = await this.visible(companyId, access, id);
    if (!row.requiresAck) throw new BadRequestException('This announcement doesn’t need an acknowledgement');
    if (row.status !== 'published') throw new BadRequestException('This announcement isn’t published yet');
    const now = new Date();
    const read = await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: access.userId } },
      update: { acknowledgedAt: now },
      create: { announcementId: id, userId: access.userId, acknowledgedAt: now },
      select: { readAt: true, acknowledgedAt: true },
    });
    return { ...this.present(await this.visible(companyId, access, id), read, access, now), stats: null };
  }

  async react(companyId: string, access: AccessContext, id: string, emoji: string) {
    const row = await this.visible(companyId, access, id);
    if (row.status !== 'published') throw new BadRequestException('This announcement isn’t published yet');
    if (!row.allowReactions) throw new BadRequestException('Reactions are turned off for this announcement');
    if (!(ANNOUNCEMENT_REACTIONS as readonly string[]).includes(emoji)) throw new BadRequestException('Unknown reaction');
    const key = { announcementId_userId_emoji: { announcementId: id, userId: access.userId, emoji } };
    const existing = await this.prisma.announcementReaction.findUnique({ where: key });
    if (existing) await this.prisma.announcementReaction.delete({ where: key });
    else await this.prisma.announcementReaction.create({ data: { announcementId: id, userId: access.userId, emoji } });
    return this.socialOf(id, access);
  }

  async rsvp(companyId: string, access: AccessContext, id: string, response: 'going' | 'maybe' | 'no' | null) {
    const row = await this.visible(companyId, access, id);
    if (!row.eventAt) throw new BadRequestException('This isn’t an event');
    if (row.status !== 'published') throw new BadRequestException('This announcement isn’t published yet');
    const key = { announcementId_userId: { announcementId: id, userId: access.userId } };
    if (response === null) await this.prisma.announcementRsvp.deleteMany({ where: { announcementId: id, userId: access.userId } });
    else await this.prisma.announcementRsvp.upsert({ where: key, update: { response }, create: { announcementId: id, userId: access.userId, response } });
    return this.socialOf(id, access);
  }

  private async socialOf(id: string, access: AccessContext) {
    const r = await this.prisma.announcement.findUniqueOrThrow({ where: { id }, select: { reactions: { select: { emoji: true, userId: true } }, rsvps: { select: { response: true, userId: true } } } });
    return { id, ...this.social(r, access) };
  }

  /** Who in the audience has read / confirmed / replied (the post's managers). */
  async report(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null }, select: SELECT });
    if (!row) throw new NotFoundException('Announcement not found');
    if (!this.canManage(row, access)) throw new ForbiddenException('Only the person who posted it (or HR) can see this');
    // The author isn't asked to read / confirm their own post
    const audience = (await this.audienceUsers(companyId, row)).filter((u) => u !== row.author?.id);
    const [reads, rsvps] = await Promise.all([
      this.prisma.announcementRead.findMany({ where: { announcementId: id }, select: { userId: true, readAt: true, acknowledgedAt: true } }),
      this.prisma.announcementRsvp.findMany({ where: { announcementId: id }, select: { userId: true, response: true } }),
    ]);
    const byUser = new Map(reads.map((r) => [r.userId, r]));
    const replies = new Map(rsvps.map((r) => [r.userId, r.response]));
    const people = await this.prisma.user.findMany({
      where: { id: { in: audience } },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, employee: { select: { id: true, employeeId: true, avatarUrl: true, department: { select: { id: true, name: true } } } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return {
      id,
      requiresAck: row.requiresAck,
      ackDueAt: row.ackDueAt,
      lastNudgedAt: row.lastNudgedAt,
      sendEmail: row.sendEmail,
      total: people.length,
      read: people.filter((p) => byUser.has(p.id)).length,
      acknowledged: people.filter((p) => byUser.get(p.id)?.acknowledgedAt).length,
      people: people.map((p) => ({ ...p, readAt: byUser.get(p.id)?.readAt ?? null, acknowledgedAt: byUser.get(p.id)?.acknowledgedAt ?? null, rsvp: replies.get(p.id) ?? null })),
    };
  }

  /** Reminds everyone who hasn't read (or confirmed) yet. */
  async nudge(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null }, select: SELECT });
    if (!row) throw new NotFoundException('Announcement not found');
    if (!this.canManage(row, access)) throw new ForbiddenException('Only the person who posted it (or HR) can see this');
    if (row.status !== 'published') throw new BadRequestException('Publish it first');
    if (row.lastNudgedAt && Date.now() - row.lastNudgedAt.getTime() < NUDGE_GAP_MS) {
      const hours = Math.ceil((NUDGE_GAP_MS - (Date.now() - row.lastNudgedAt.getTime())) / 3_600_000);
      throw new BadRequestException(`You nudged them recently — you can nudge again in ${hours} hour${hours === 1 ? '' : 's'}`);
    }
    const waiting = await this.waiting(companyId, row);
    if (!waiting.length) return { id, nudged: 0 };
    await this.prisma.announcement.update({ where: { id }, data: { lastNudgedAt: new Date() } });
    await this.notifications.notify({
      companyId,
      userIds: waiting,
      type: 'announcement.nudge',
      title: row.requiresAck ? `Reminder: please read and confirm “${row.title}”` : `Reminder: “${row.title}”`,
      body: row.ackDueAt ? `Please confirm by ${row.ackDueAt.toISOString().slice(0, 10)}.` : null,
      link: `/app/announcements/${row.id}`,
      actionLabel: 'Read announcement',
      email: row.sendEmail,
    });
    return { id, nudged: waiting.length };
  }

  /** People in the audience who still haven't read (or, if asked, confirmed). */
  private async waiting(companyId: string, row: Row): Promise<string[]> {
    const audience = (await this.audienceUsers(companyId, row)).filter((u) => u !== row.author?.id);
    const done = await this.prisma.announcementRead.findMany({
      where: { announcementId: row.id, userId: { in: audience }, ...(row.requiresAck ? { acknowledgedAt: { not: null } } : {}) },
      select: { userId: true },
    });
    const ok = new Set(done.map((d) => d.userId));
    return audience.filter((u) => !ok.has(u));
  }

  /** How many people a post would reach, before it is published. */
  async audiencePreview(companyId: string, access: AccessContext, dto: AnnouncementAudienceDto) {
    if (!this.canWrite(access)) throw new ForbiddenException('You can’t post announcements');
    const target = await this.target(companyId, access, dto);
    const users = (await this.audienceUsers(companyId, target)).filter((u) => u !== access.userId);
    const [emailable, sample] = await Promise.all([
      this.prisma.user.count({ where: { id: { in: users }, OR: [{ preferences: null }, { preferences: { emailNotifications: true } }] } }),
      this.prisma.user.findMany({ where: { id: { in: users } }, take: 6, orderBy: { firstName: 'asc' }, select: { id: true, firstName: true, lastName: true, avatarUrl: true, employee: { select: { avatarUrl: true } } } }),
    ]);
    return { count: users.length, emailable, sample: sample.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, avatarUrl: s.employee?.avatarUrl ?? s.avatarUrl })) };
  }

  // ─── Post / edit / remove ──────────────────────────────────

  async create(companyId: string, access: AccessContext, dto: SaveAnnouncementDto) {
    if (!this.canWrite(access)) throw new ForbiddenException('You can’t post announcements');
    const data = await this.data(companyId, access, dto, null);
    const created = await this.prisma.announcement.create({ data: { ...data, companyId, authorId: access.userId }, select: SELECT });
    if (created.pinned) await this.onlyPinned(companyId, created.id);
    if (created.status === 'published') await this.publishNow(companyId, created);
    return { ...this.present(await this.reload(created.id), null, access, new Date()), stats: null };
  }

  async update(companyId: string, access: AccessContext, id: string, dto: SaveAnnouncementDto) {
    const existing = await this.managed(companyId, access, id);
    const data = await this.data(companyId, access, dto, existing);
    const row = await this.prisma.announcement.update({ where: { id }, data, select: SELECT });
    if (row.pinned && !existing.pinned) await this.onlyPinned(companyId, id);
    if (row.status === 'published' && !row.notifiedAt) await this.publishNow(companyId, row);
    else if (row.status === 'published' && row.notifiedAt) {
      const before = new Set(existing.mentionIds);
      void this.notifyMentioned(companyId, row, row.mentionIds.filter((u) => !before.has(u))).catch(() => undefined);
    }
    return { ...this.present(await this.reload(id), null, access, new Date()), stats: null };
  }

  /** Pin (or unpin) for everyone — one pinned post at a time. */
  async pin(companyId: string, access: AccessContext, id: string, pinned: boolean) {
    if (!this.isManager(access)) throw new ForbiddenException('Only HR can pin announcements');
    await this.exists(companyId, id);
    await this.prisma.announcement.update({ where: { id }, data: { pinned } });
    if (pinned) await this.onlyPinned(companyId, id);
    return { id, pinned };
  }

  private async onlyPinned(companyId: string, id: string) {
    await this.prisma.announcement.updateMany({ where: { companyId, pinned: true, id: { not: id } }, data: { pinned: false } });
  }

  async remove(companyId: string, access: AccessContext, id: string) {
    const row = await this.managed(companyId, access, id);
    await this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
    void this.afterRemove(companyId, access, row).catch((err) => this.logger.error(`After removing announcement ${id}`, err as Error));
    return { id, title: row.title };
  }

  private async afterRemove(companyId: string, access: AccessContext, row: Row) {
    // Old "new post" / reminder / mention notifications would point at nothing
    await this.notifications.withdraw(companyId, { linkPrefix: `/app/announcements/${row.id}` });
    // Only people mentioned in a post that went out are told — nobody else
    if (!row.notifiedAt || !row.mentionIds.length) return;
    const active = await this.prisma.user.findMany({ where: { id: { in: row.mentionIds.filter((u) => u !== access.userId) }, companyId, status: UserStatus.ACTIVE }, select: { id: true } });
    if (!active.length) return;
    await this.notifications.notify({
      companyId,
      userIds: active.map((u) => u.id),
      type: 'announcement.removed',
      title: `“${row.title}” was removed`,
      body: 'An announcement you were mentioned in has been deleted.',
      link: null,
      email: false,
    });
  }

  // ─── Attachment (private storage, downloaded through the API) ─

  async attach(companyId: string, access: AccessContext, id: string, file: Express.Multer.File | undefined) {
    await this.managed(companyId, access, id);
    const row = await this.exists(companyId, id);
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > ATTACHMENT_MAX_BYTES) throw new BadRequestException('File must be 10 MB or smaller');
    const type = detectFileType(file.buffer, file.mimetype);
    if (!type || !DOCUMENT_TYPES.has(type.ext)) throw new BadRequestException('Allowed files: PDF, JPG, PNG, WebP or Word (.docx)');
    const key = `${companyId}/announcements/${id}/${randomUUID()}.${type.ext}`;
    await this.files.save(key, file.buffer);
    const name = (file.originalname ?? 'attachment').split(/[\\/]/).pop()!.replace(/[^\w\- ().]+/g, '').slice(0, 100) || 'attachment';
    await this.prisma.announcement.update({
      where: { id },
      data: { attachmentKey: key, attachmentName: name.endsWith(`.${type.ext}`) ? name : `${name.replace(/\.[^.]*$/, '')}.${type.ext}`, attachmentMime: type.mime, attachmentSize: file.size },
    });
    if (row.attachmentKey) await this.files.remove(row.attachmentKey).catch(() => undefined);
    return { id, attachmentName: name };
  }

  /** Cover image, GIF, short video (MP4 / WebM) or Lottie animation — public URL with a random name. */
  async uploadCover(companyId: string, access: AccessContext, id: string, file: Express.Multer.File | undefined) {
    await this.managed(companyId, access, id);
    if (!file) throw new BadRequestException('No file provided');
    if (!this.storage) throw new BadRequestException('Uploads aren’t available');
    const kind = coverKind(file);
    if (!kind) throw new BadRequestException('Use a JPG, PNG, WebP or GIF image, an MP4 / WebM video, or a Lottie (.json) animation');
    if (file.size > (kind.kind === 'lottie' ? LOTTIE_MAX_BYTES : COVER_MAX_BYTES)) {
      throw new BadRequestException(kind.kind === 'lottie' ? 'Lottie files must be 1 MB or smaller' : 'Covers must be 5 MB or smaller');
    }
    const key = `${companyId}/announcements/cover-${randomUUID().replace(/-/g, '')}.${kind.ext}`;
    const url = await this.storage.upload(key, file.buffer, kind.mime);
    await this.prisma.announcement.update({ where: { id }, data: { coverMediaUrl: url, coverMediaKind: kind.kind } });
    return { id, coverMediaUrl: url, coverMediaKind: kind.kind };
  }

  async removeCover(companyId: string, access: AccessContext, id: string) {
    await this.managed(companyId, access, id);
    await this.prisma.announcement.update({ where: { id }, data: { coverMediaUrl: null, coverMediaKind: null } });
    return { id };
  }

  async removeAttachment(companyId: string, access: AccessContext, id: string) {
    await this.managed(companyId, access, id);
    const row = await this.exists(companyId, id);
    await this.prisma.announcement.update({ where: { id }, data: { attachmentKey: null, attachmentName: null, attachmentMime: null, attachmentSize: null } });
    if (row.attachmentKey) await this.files.remove(row.attachmentKey).catch(() => undefined);
    return { id };
  }

  async openAttachment(companyId: string, access: AccessContext, id: string) {
    await this.visible(companyId, access, id);
    const row = await this.prisma.announcement.findUniqueOrThrow({ where: { id }, select: { attachmentKey: true, attachmentName: true, attachmentMime: true, attachmentSize: true } });
    if (!row.attachmentKey) throw new NotFoundException('No attachment');
    const stream = await this.files.open(row.attachmentKey).catch(() => {
      throw new NotFoundException('The file is no longer available');
    });
    return { stream, name: row.attachmentName!, mime: row.attachmentMime!, size: row.attachmentSize! };
  }

  // ─── Scheduled work (every minute) ─────────────────────────

  /** Publishes scheduled posts that are due, and sends "please confirm" reminders. */
  async runDue(now = new Date()) {
    try {
      const due = await this.prisma.announcement.findMany({ where: { deletedAt: null, status: 'scheduled', publishedAt: { lte: now } }, select: { ...SELECT, companyId: true }, take: 50 });
      for (const a of due) {
        const claimed = await this.prisma.announcement.updateMany({ where: { id: a.id, status: 'scheduled' }, data: { status: 'published' } });
        if (claimed.count) await this.publishNow(a.companyId, a);
      }
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const soon = new Date(today.getTime() + REMIND_DAYS_BEFORE * 86_400_000);
      const remind = await this.prisma.announcement.findMany({
        where: { deletedAt: null, status: 'published', requiresAck: true, ackReminderSentAt: null, ackDueAt: { gte: today, lte: soon } },
        select: { ...SELECT, companyId: true },
        take: 50,
      });
      for (const a of remind) {
        const claimed = await this.prisma.announcement.updateMany({ where: { id: a.id, ackReminderSentAt: null }, data: { ackReminderSentAt: now } });
        if (!claimed.count) continue;
        const waiting = await this.waiting(a.companyId, a);
        if (!waiting.length) continue;
        await this.notifications.notify({
          companyId: a.companyId,
          userIds: waiting,
          type: 'announcement.reminder',
          title: `Please confirm “${a.title}” by ${a.ackDueAt!.toISOString().slice(0, 10)}`,
          body: null,
          link: `/app/announcements/${a.id}`,
          actionLabel: 'Read and confirm',
          email: a.sendEmail,
        });
      }
      return { published: due.length, reminded: remind.length };
    } catch (err) {
      this.logger.error('Scheduled announcements failed', err as Error);
      return { published: 0, reminded: 0 };
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async publishNow(companyId: string, a: Row) {
    await this.prisma.announcement.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
    void this.announce(companyId, a, a.author?.id ?? null);
  }

  private async announce(companyId: string, a: Row, authorId: string | null) {
    try {
      const mentioned = new Set(a.mentionIds);
      const users = (await this.audienceUsers(companyId, a)).filter((u) => u !== authorId && !mentioned.has(u));
      const body = plainText(a.body);
      await this.notifyMentioned(companyId, a, [...mentioned]);
      await this.notifications.notify({
        companyId,
        userIds: users,
        type: 'announcement.posted',
        title: `${a.coverEmoji ?? '📢'} ${a.title}${a.requiresAck ? ' — please read and confirm' : ''}`,
        body: body.length > 280 ? `${body.slice(0, 277)}…` : body,
        link: `/app/announcements/${a.id}`,
        actionLabel: 'Read announcement',
        email: a.sendEmail,
      });
    } catch (err) {
      this.logger.error(`Could not notify the audience of announcement ${a.id}`, err as Error);
    }
  }

  /** Active users in the audience. */
  private async audienceUsers(companyId: string, a: Pick<Row, 'audience' | 'departmentIds' | 'locationIds' | 'teamManagerId'>): Promise<string[]> {
    const base: Prisma.UserWhereInput = { companyId, status: UserStatus.ACTIVE };
    let where: Prisma.UserWhereInput = base;
    if (a.audience === AnnouncementAudience.DEPARTMENTS) {
      const under = await this.prisma.departmentHierarchy.findMany({ where: { companyId, ancestorId: { in: a.departmentIds } }, select: { descendantId: true } });
      where = { ...base, employee: { departmentId: { in: under.map((d) => d.descendantId) } } };
    } else if (a.audience === AnnouncementAudience.LOCATIONS) {
      where = { ...base, employee: { locationId: { in: a.locationIds } } };
    } else if (a.audience === AnnouncementAudience.TEAM) {
      if (!a.teamManagerId) return [];
      where = { ...base, employee: { ancestors: { some: { ancestorId: a.teamManagerId, depth: { gte: 1 } } } } };
    }
    return (await this.prisma.user.findMany({ where, select: { id: true } })).map((u) => u.id);
  }

  private async stats(companyId: string, row: Row) {
    // The author isn't asked to read / confirm their own post
    const audience = (await this.audienceUsers(companyId, row)).filter((u) => u !== row.author?.id);
    const [read, acknowledged] = await Promise.all([
      this.prisma.announcementRead.count({ where: { announcementId: row.id, userId: { in: audience } } }),
      this.prisma.announcementRead.count({ where: { announcementId: row.id, userId: { in: audience }, acknowledgedAt: { not: null } } }),
    ]);
    return { audience: audience.length, read, acknowledged };
  }

  /** The audience a poster may use: HR any; team posters their own reporting line only. */
  private async target(companyId: string, access: AccessContext, dto: AnnouncementAudienceDto) {
    let audience = dto.audience;
    if (!this.isHr(access) && audience !== AnnouncementAudience.TEAM) throw new ForbiddenException('You can post to your own team only');
    const departmentIds = audience === AnnouncementAudience.DEPARTMENTS ? (dto.departmentIds ?? []) : [];
    const locationIds = audience === AnnouncementAudience.LOCATIONS ? (dto.locationIds ?? []) : [];
    if (audience === AnnouncementAudience.TEAM && !access.employee) throw new BadRequestException('You need an employee profile to post to a team');
    if (audience === AnnouncementAudience.DEPARTMENTS && !departmentIds.length) throw new BadRequestException('Choose at least one department');
    if (audience === AnnouncementAudience.LOCATIONS && !locationIds.length) throw new BadRequestException('Choose at least one location');
    if (departmentIds.length && (await this.prisma.department.count({ where: { companyId, id: { in: departmentIds } } })) !== departmentIds.length) throw new NotFoundException('Department not found');
    if (locationIds.length && (await this.prisma.officeLocation.count({ where: { companyId, id: { in: locationIds } } })) !== locationIds.length) throw new NotFoundException('Location not found');
    if (audience === AnnouncementAudience.TEAM && !(await this.prisma.employeeHierarchy.count({ where: { ancestorId: access.employee!.id, depth: { gte: 1 } } }))) {
      throw new BadRequestException('Nobody reports to you yet, so there’s no team to post to');
    }
    audience = audience ?? AnnouncementAudience.COMPANY;
    return { audience, departmentIds, locationIds, teamManagerId: audience === AnnouncementAudience.TEAM ? access.employee!.id : null };
  }

  private async data(companyId: string, access: AccessContext, dto: SaveAnnouncementDto, existing: Row | null) {
    // HR editing a manager's team post keeps that manager's team
    const keepTeam = existing?.audience === AnnouncementAudience.TEAM && dto.audience === AnnouncementAudience.TEAM;
    const target = keepTeam
      ? { audience: AnnouncementAudience.TEAM, departmentIds: [] as string[], locationIds: [] as string[], teamManagerId: existing!.teamManagerId }
      : await this.target(companyId, access, dto);
    const now = new Date();
    if (dto.expiresAt && new Date(dto.expiresAt) <= now) throw new BadRequestException('The expiry must be in the future');
    if (dto.ackDueAt && !dto.requiresAck) throw new BadRequestException('A confirm-by date needs “ask people to confirm” turned on');
    if (dto.ackDueAt && dto.ackDueAt < now.toISOString().slice(0, 10)) throw new BadRequestException('The confirm-by date can’t be in the past');
    // What happens on save: publish now, keep as draft, or schedule
    const wasLive = existing?.status === 'published';
    let status = existing?.status ?? 'published';
    let publishedAt = existing?.publishedAt ?? now;
    const action = dto.action ?? (wasLive ? 'publish' : 'publish');
    if (wasLive) {
      if (action !== 'publish') throw new BadRequestException('This announcement is already published');
    } else if (action === 'draft') {
      status = 'draft';
      publishedAt = now;
    } else if (action === 'schedule') {
      if (!dto.publishAt) throw new BadRequestException('Pick when it should go out');
      const at = new Date(dto.publishAt);
      if (at.getTime() <= now.getTime() + 60_000) throw new BadRequestException('Pick a time at least a couple of minutes ahead');
      status = 'scheduled';
      publishedAt = at;
    } else {
      status = 'published';
      publishedAt = now;
    }
    const mentionIds = await this.mentions(companyId, target, dto.body, existing?.author?.id ?? access.userId);
    return {
      title: dto.title,
      body: dto.body,
      mentionIds,
      ...target,
      category: dto.category ?? 'update',
      cover: dto.cover ?? null,
      coverEmoji: dto.coverEmoji ?? null,
      coverScene: dto.coverScene ?? null,
      coverArt: dto.coverArt ?? null,
      coverMotion: dto.coverMotion ?? 'gentle',
      coverFocusX: dto.coverFocusX ?? existing?.coverFocusX ?? 50,
      coverFocusY: dto.coverFocusY ?? existing?.coverFocusY ?? 50,
      coverDim: dto.coverDim ?? existing?.coverDim ?? 25,
      // Only managers pin; everyone else keeps what the post had
      pinned: this.isManager(access) ? (dto.pinned ?? existing?.pinned ?? false) : (existing?.pinned ?? false),
      requiresAck: dto.requiresAck ?? false,
      ackDueAt: dto.requiresAck && dto.ackDueAt ? new Date(`${dto.ackDueAt}T00:00:00Z`) : null,
      ...(existing && existing.ackDueAt?.toISOString().slice(0, 10) !== dto.ackDueAt ? { ackReminderSentAt: null } : {}),
      sendEmail: dto.sendEmail ?? false,
      allowReactions: dto.allowReactions ?? true,
      eventAt: dto.eventAt ? new Date(dto.eventAt) : null,
      eventPlace: dto.eventAt ? (dto.eventPlace ?? null) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      status,
      publishedAt,
    };
  }

  /**
   * Who is @mentioned (user ids, never the author). Everyone mentioned must be
   * in the audience — otherwise they'd be told about a post they can't open.
   */
  private async mentions(companyId: string, target: Pick<Row, 'audience' | 'departmentIds' | 'locationIds' | 'teamManagerId'>, body: string, authorId: string): Promise<string[]> {
    const ids = mentionedEmployeeIds(body);
    if (!ids.length) return [];
    if (ids.length > MAX_MENTIONS) throw new BadRequestException(`You can mention up to ${MAX_MENTIONS} people in one post`);
    const people = await this.prisma.employee.findMany({ where: { companyId, id: { in: ids } }, select: { userId: true, firstName: true, lastName: true } });
    if (people.length !== ids.length) throw new BadRequestException('Some people you mentioned aren’t in your company');
    const audience = new Set(await this.audienceUsers(companyId, target));
    const outside = people.filter((p) => !p.userId || !audience.has(p.userId));
    if (outside.length) {
      const names = outside.map((p) => `${p.firstName} ${p.lastName}`);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
      throw new BadRequestException(`${list} ${names.length > 1 ? 'aren’t' : 'isn’t'} in this post’s audience, so they couldn’t open it. Remove the mention or widen the audience.`);
    }
    return [...new Set(people.map((p) => p.userId!).filter((u) => u !== authorId))];
  }

  /** Tell people they were mentioned (on publish, or when added to a live post). */
  private async notifyMentioned(companyId: string, a: Row, userIds: string[]) {
    if (!userIds.length) return;
    const author = a.author ? `${a.author.firstName} ${a.author.lastName}` : 'Someone';
    const body = plainText(a.body);
    await this.notifications.notify({
      companyId,
      userIds,
      type: 'announcement.mention',
      title: `${author} mentioned you in “${a.title}”`,
      body: body.length > 280 ? `${body.slice(0, 277)}…` : body,
      link: `/app/announcements/${a.id}`,
      actionLabel: 'Read announcement',
      email: a.sendEmail,
    });
  }

  private async reload(id: string) {
    return this.prisma.announcement.findUniqueOrThrow({ where: { id }, select: WITH_SOCIAL });
  }

  /** Visible to this person: in the audience and published — or theirs / HR's to manage. */
  private async visible(companyId: string, access: AccessContext, id: string): Promise<SocialRow> {
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null, AND: [await this.audienceFilter(companyId, access)] }, select: WITH_SOCIAL });
    if (!row) throw new NotFoundException('Announcement not found');
    const live = row.status === 'published' && row.publishedAt <= new Date();
    if (!live && !this.canManage(row, access)) throw new NotFoundException('Announcement not found');
    return row;
  }

  /** A post this person may edit / delete. */
  private async managed(companyId: string, access: AccessContext, id: string): Promise<Row> {
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null }, select: SELECT });
    if (!row) throw new NotFoundException('Announcement not found');
    if (!this.canManage(row, access)) throw new ForbiddenException('You can only change your own announcements');
    return row;
  }

  private async exists(companyId: string, id: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true, title: true, attachmentKey: true } });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  private social(r: { reactions: Array<{ emoji: string; userId: string }>; rsvps: Array<{ response: string; userId: string }> }, access: AccessContext) {
    const counts = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const x of r.reactions) {
      const c = counts.get(x.emoji) ?? { emoji: x.emoji, count: 0, mine: false };
      c.count++;
      if (x.userId === access.userId) c.mine = true;
      counts.set(x.emoji, c);
    }
    return {
      reactions: ANNOUNCEMENT_REACTIONS.map((e) => counts.get(e)).filter((x): x is { emoji: string; count: number; mine: boolean } => Boolean(x)),
      rsvp: {
        going: r.rsvps.filter((x) => x.response === 'going').length,
        maybe: r.rsvps.filter((x) => x.response === 'maybe').length,
        mine: (r.rsvps.find((x) => x.userId === access.userId)?.response ?? null) as 'going' | 'maybe' | 'no' | null,
      },
    };
  }

  private present(r: SocialRow, read: { readAt: Date; acknowledgedAt: Date | null } | null, access: AccessContext, now: Date) {
    const { reactions, rsvps, lastNudgedAt, author, ...rest } = r;
    return {
      ...rest,
      author: author ? { id: author.id, firstName: author.firstName, lastName: author.lastName, avatarUrl: author.employee?.avatarUrl ?? author.avatarUrl, title: author.employee?.designation?.name ?? null } : null,
      ...this.social({ reactions, rsvps }, access),
      readAt: read?.readAt ?? null,
      acknowledgedAt: read?.acknowledgedAt ?? null,
      expired: Boolean(r.expiresAt && r.expiresAt <= now),
      isMine: author?.id === access.userId,
      canEdit: this.canManage(r, access),
      canPin: this.isManager(access),
    };
  }
}

/** What an uploaded cover is, by its content (not its name). */
function coverKind(file: Express.Multer.File): { kind: 'image' | 'video' | 'lottie'; ext: string; mime: string } | null {
  const b = file.buffer;
  const at = (o: number, bytes: number[]) => bytes.every((x, i) => b[o + i] === x);
  const img = detectFileType(b);
  if (img && ['jpg', 'png', 'webp'].includes(img.ext)) return { kind: 'image', ext: img.ext, mime: img.mime };
  if (at(0, [0x47, 0x49, 0x46, 0x38])) return { kind: 'image', ext: 'gif', mime: 'image/gif' };
  if (at(4, [0x66, 0x74, 0x79, 0x70])) return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
  if (at(0, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'video', ext: 'webm', mime: 'video/webm' };
  // Lottie: JSON with the fields every Lottie animation has
  if (b[0] === 0x7b && b.length <= LOTTIE_MAX_BYTES * 2) {
    try {
      const j = JSON.parse(b.toString('utf8')) as Record<string, unknown>;
      if (typeof j.v === 'string' && Array.isArray(j.layers) && typeof j.w === 'number' && typeof j.h === 'number') return { kind: 'lottie', ext: 'json', mime: 'application/json' };
    } catch {
      return null;
    }
  }
  return null;
}
