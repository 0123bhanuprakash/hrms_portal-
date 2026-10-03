import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AnnouncementAudience, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivateFilesService } from '../employee-profile/private-files.service';
import { detectFileType, DOCUMENT_TYPES } from '../employee-profile/file-types';
import type { AnnouncementQueryDto, SaveAnnouncementDto } from './dto';

const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const SELECT = {
  id: true,
  title: true,
  body: true,
  audience: true,
  departmentIds: true,
  locationIds: true,
  pinned: true,
  requiresAck: true,
  sendEmail: true,
  expiresAt: true,
  publishedAt: true,
  updatedAt: true,
  attachmentName: true,
  attachmentMime: true,
  attachmentSize: true,
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} satisfies Prisma.AnnouncementSelect;
type Row = Prisma.AnnouncementGetPayload<{ select: typeof SELECT }>;

/**
 * Announcements to the whole company, some departments (and their
 * sub-departments) or some locations. Everyone is notified in-app; the
 * poster decides whether it is also emailed.
 */
@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly files: PrivateFilesService,
  ) {}

  private canPost(access: AccessContext) {
    return holds(access, 'announcement.post');
  }

  /** Announcements this person is in the audience of (posters see all). */
  private async audienceFilter(companyId: string, access: AccessContext): Promise<Prisma.AnnouncementWhereInput> {
    if (this.canPost(access)) return {};
    const me = access.employee;
    const deptAncestors = me?.departmentId
      ? (await this.prisma.departmentHierarchy.findMany({ where: { companyId, descendantId: me.departmentId }, select: { ancestorId: true } })).map((d) => d.ancestorId)
      : [];
    return {
      OR: [
        { audience: AnnouncementAudience.COMPANY },
        ...(deptAncestors.length ? [{ audience: AnnouncementAudience.DEPARTMENTS, departmentIds: { hasSome: deptAncestors } }] : []),
        ...(me?.locationId ? [{ audience: AnnouncementAudience.LOCATIONS, locationIds: { has: me.locationId } }] : []),
      ],
    };
  }

  async list(companyId: string, access: AccessContext, query: AnnouncementQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();
    const where: Prisma.AnnouncementWhereInput = {
      companyId,
      deletedAt: null,
      AND: [
        await this.audienceFilter(companyId, access),
        ...(query.includeExpired && this.canPost(access) ? [] : [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }]),
        ...(query.filter === 'unread' ? [{ reads: { none: { userId: access.userId } } }] : []),
        ...(query.filter === 'ack' ? [{ requiresAck: true, reads: { none: { userId: access.userId, acknowledgedAt: { not: null } } } }] : []),
      ],
    };
    const [rows, total, unread, needsAck] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { ...SELECT, reads: { where: { userId: access.userId }, select: { readAt: true, acknowledgedAt: true } } },
      }),
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.count({ where: { ...this.liveWhere(companyId, now), AND: [await this.audienceFilter(companyId, access), { reads: { none: { userId: access.userId } } }] } }),
      this.prisma.announcement.count({
        where: { ...this.liveWhere(companyId, now), requiresAck: true, AND: [await this.audienceFilter(companyId, access), { reads: { none: { userId: access.userId, acknowledgedAt: { not: null } } } }] },
      }),
    ]);
    return {
      data: rows.map(({ reads, ...r }) => this.present(r, reads[0] ?? null, access, now)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), unread, needsAck },
    };
  }

  private liveWhere(companyId: string, now: Date): Prisma.AnnouncementWhereInput {
    return { companyId, deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
  }

  /** Opening an announcement marks it read. */
  async get(companyId: string, access: AccessContext, id: string) {
    const row = await this.visible(companyId, access, id);
    const read = await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: access.userId } },
      update: {},
      create: { announcementId: id, userId: access.userId },
      select: { readAt: true, acknowledgedAt: true },
    });
    const stats = this.canPost(access) ? await this.stats(companyId, row) : null;
    return { ...this.present(row, read, access, new Date()), stats };
  }

  async acknowledge(companyId: string, access: AccessContext, id: string) {
    const row = await this.visible(companyId, access, id);
    if (!row.requiresAck) throw new BadRequestException('This announcement doesn’t need an acknowledgement');
    const now = new Date();
    const read = await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: access.userId } },
      update: { acknowledgedAt: now },
      create: { announcementId: id, userId: access.userId, acknowledgedAt: now },
      select: { readAt: true, acknowledgedAt: true },
    });
    return { ...this.present(row, read, access, now), stats: null };
  }

  /** Who in the audience has read / acknowledged (posters). */
  async report(companyId: string, id: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null }, select: SELECT });
    if (!row) throw new NotFoundException('Announcement not found');
    // The author isn't asked to read / confirm their own post
    const audience = (await this.audienceUsers(companyId, row)).filter((u) => u !== row.author?.id);
    const reads = await this.prisma.announcementRead.findMany({ where: { announcementId: id }, select: { userId: true, readAt: true, acknowledgedAt: true } });
    const byUser = new Map(reads.map((r) => [r.userId, r]));
    const people = await this.prisma.user.findMany({
      where: { id: { in: audience } },
      select: { id: true, firstName: true, lastName: true, email: true, employee: { select: { id: true, employeeId: true, avatarUrl: true, department: { select: { name: true } } } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return {
      id,
      requiresAck: row.requiresAck,
      total: people.length,
      read: people.filter((p) => byUser.has(p.id)).length,
      acknowledged: people.filter((p) => byUser.get(p.id)?.acknowledgedAt).length,
      people: people.map((p) => ({ ...p, readAt: byUser.get(p.id)?.readAt ?? null, acknowledgedAt: byUser.get(p.id)?.acknowledgedAt ?? null })),
    };
  }

  // ─── Post / edit / remove ──────────────────────────────────

  async create(companyId: string, access: AccessContext, dto: SaveAnnouncementDto) {
    const data = await this.data(companyId, dto);
    const created = await this.prisma.announcement.create({ data: { ...data, companyId, authorId: access.userId }, select: SELECT });
    void this.announce(companyId, created, access.userId);
    return { ...this.present(created, null, access, new Date()), stats: null };
  }

  async update(companyId: string, access: AccessContext, id: string, dto: SaveAnnouncementDto) {
    await this.exists(companyId, id);
    const data = await this.data(companyId, dto);
    const row = await this.prisma.announcement.update({ where: { id }, data, select: SELECT });
    return { ...this.present(row, null, access, new Date()), stats: null };
  }

  async remove(companyId: string, id: string) {
    const row = await this.exists(companyId, id);
    await this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, title: row.title };
  }

  // ─── Attachment (private storage, downloaded through the API) ─

  async attach(companyId: string, id: string, file: Express.Multer.File | undefined) {
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

  async removeAttachment(companyId: string, id: string) {
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

  // ─── Helpers ───────────────────────────────────────────────

  private async announce(companyId: string, a: Row, authorId: string) {
    try {
      const users = (await this.audienceUsers(companyId, a)).filter((u) => u !== authorId);
      await this.notifications.notify({
        companyId,
        userIds: users,
        type: 'announcement.posted',
        title: a.requiresAck ? `📢 ${a.title} — please read and confirm` : `📢 ${a.title}`,
        body: a.body.length > 280 ? `${a.body.slice(0, 277)}…` : a.body,
        link: `/app/announcements/${a.id}`,
        actionLabel: 'Read announcement',
        email: a.sendEmail,
      });
    } catch (err) {
      this.logger.error(`Could not notify the audience of announcement ${a.id}`, err as Error);
    }
  }

  /** Active users in the audience. */
  private async audienceUsers(companyId: string, a: Pick<Row, 'audience' | 'departmentIds' | 'locationIds'>): Promise<string[]> {
    const base: Prisma.UserWhereInput = { companyId, status: UserStatus.ACTIVE };
    let where: Prisma.UserWhereInput = base;
    if (a.audience === AnnouncementAudience.DEPARTMENTS) {
      const under = await this.prisma.departmentHierarchy.findMany({ where: { companyId, ancestorId: { in: a.departmentIds } }, select: { descendantId: true } });
      where = { ...base, employee: { departmentId: { in: under.map((d) => d.descendantId) } } };
    } else if (a.audience === AnnouncementAudience.LOCATIONS) {
      where = { ...base, employee: { locationId: { in: a.locationIds } } };
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

  private async data(companyId: string, dto: SaveAnnouncementDto) {
    const departmentIds = dto.audience === AnnouncementAudience.DEPARTMENTS ? (dto.departmentIds ?? []) : [];
    const locationIds = dto.audience === AnnouncementAudience.LOCATIONS ? (dto.locationIds ?? []) : [];
    if (dto.audience === AnnouncementAudience.DEPARTMENTS && !departmentIds.length) throw new BadRequestException('Choose at least one department');
    if (dto.audience === AnnouncementAudience.LOCATIONS && !locationIds.length) throw new BadRequestException('Choose at least one location');
    if (departmentIds.length && (await this.prisma.department.count({ where: { companyId, id: { in: departmentIds } } })) !== departmentIds.length) throw new NotFoundException('Department not found');
    if (locationIds.length && (await this.prisma.officeLocation.count({ where: { companyId, id: { in: locationIds } } })) !== locationIds.length) throw new NotFoundException('Location not found');
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) throw new BadRequestException('The expiry must be in the future');
    return {
      title: dto.title,
      body: dto.body,
      audience: dto.audience,
      departmentIds,
      locationIds,
      pinned: dto.pinned ?? false,
      requiresAck: dto.requiresAck ?? false,
      sendEmail: dto.sendEmail ?? false,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    };
  }

  private async visible(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null, AND: [await this.audienceFilter(companyId, access)] }, select: SELECT });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  private async exists(companyId: string, id: string) {
    const row = await this.prisma.announcement.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true, title: true, attachmentKey: true } });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  private present(r: Row, read: { readAt: Date; acknowledgedAt: Date | null } | null, access: AccessContext, now: Date) {
    return {
      ...r,
      readAt: read?.readAt ?? null,
      acknowledgedAt: read?.acknowledgedAt ?? null,
      expired: Boolean(r.expiresAt && r.expiresAt <= now),
      canEdit: this.canPost(access),
    };
  }
}
