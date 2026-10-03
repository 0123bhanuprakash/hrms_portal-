import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketMessageKind, TicketPriority, TicketQueue, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivateFilesService } from '../employee-profile/private-files.service';
import { detectFileType, DOCUMENT_TYPES } from '../employee-profile/file-types';
import { TicketCategoriesService } from './ticket-categories.service';
import { AUTO_CLOSE_DAYS, QUEUE_LABEL, QUEUE_PERMISSION, QUEUES, dueDates } from './sla';
import type { AssignDto, CloseDto, CreateTicketDto, MessageDto, ReopenDto, ResolveDto, SummaryQueryDto, TicketQueryDto, UpdateTicketDto } from './dto';

const FILE_MAX_BYTES = 10 * 1024 * 1024;
const ACTIVE: TicketStatus[] = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING];
const PRIORITY_LABEL: Record<TicketPriority, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };

const SELECT = {
  id: true,
  number: true,
  queue: true,
  subject: true,
  description: true,
  priority: true,
  status: true,
  assigneeId: true,
  firstResponseDueAt: true,
  resolutionDueAt: true,
  firstRespondedAt: true,
  resolvedAt: true,
  closedAt: true,
  reopenCount: true,
  rating: true,
  ratingComment: true,
  lastActivityAt: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
  employee: { select: { id: true, userId: true, employeeId: true, firstName: true, lastName: true, email: true, avatarUrl: true, designation: { select: { name: true } }, department: { select: { name: true } } } },
} satisfies Prisma.TicketSelect;
type Row = Prisma.TicketGetPayload<{ select: typeof SELECT }>;

const MESSAGE = { id: true, authorId: true, kind: true, body: true, fileName: true, fileMime: true, fileSize: true, createdAt: true } satisfies Prisma.TicketMessageSelect;

/**
 * Helpdesk: employees raise tickets to the IT, HR or Finance queue (never
 * anonymously). Agents of a queue (ticket.handle_<queue>) see, assign, answer
 * and resolve its tickets; the employee can reopen within AUTO_CLOSE_DAYS or
 * close and rate. Nobody works their own ticket as an agent.
 */
@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly files: PrivateFilesService,
    private readonly categories: TicketCategoriesService,
  ) {}

  // ─── Queries ───────────────────────────────────────────────

  async list(companyId: string, access: AccessContext, q: TicketQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const now = new Date();
    const where: Prisma.TicketWhereInput = { companyId };
    if (q.view === 'mine') {
      if (!access.employee) return this.page([], 0, page, limit, access);
      where.employeeId = access.employee.id;
      if (q.queue) where.queue = q.queue;
    } else {
      const mine = this.queuesOf(access);
      if (!mine.length) throw new ForbiddenException('You don’t work any helpdesk queue');
      if (q.queue && !mine.includes(q.queue)) throw new ForbiddenException(`You don’t work the ${QUEUE_LABEL[q.queue]} queue`);
      where.queue = q.queue ?? { in: mine };
      if (q.assignee === 'me') where.assigneeId = access.userId;
      else if (q.assignee === 'unassigned') where.assigneeId = null;
      else if (q.assignee) where.assigneeId = q.assignee;
    }
    if (q.status === 'active') where.status = { in: ACTIVE };
    else if (q.status) where.status = q.status;
    if (q.priority) where.priority = q.priority;
    if (q.overdue === 'true') {
      where.AND = [
        { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
        { OR: [{ resolutionDueAt: { lt: now } }, { firstRespondedAt: null, firstResponseDueAt: { lt: now } }] },
      ];
    }
    if (q.search) {
      const n = Number(q.search.replace(/^#/, ''));
      where.OR = [
        ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
        { subject: { contains: q.search, mode: 'insensitive' } },
        ...(q.view === 'queue'
          ? [{ employee: { OR: [{ firstName: { contains: q.search, mode: 'insensitive' as const } }, { lastName: { contains: q.search, mode: 'insensitive' as const } }, { employeeId: { contains: q.search, mode: 'insensitive' as const } }] } }]
          : []),
      ];
    }
    const activeOnly = q.status === 'active' || (q.status && ACTIVE.includes(q.status as TicketStatus));
    const orderBy: Prisma.TicketOrderByWithRelationInput[] = q.view === 'queue' && activeOnly ? [{ resolutionDueAt: 'asc' }] : [{ lastActivityAt: 'desc' }];
    const [rows, total] = await Promise.all([
      this.prisma.ticket.findMany({ where, select: SELECT, orderBy, skip: (page - 1) * limit, take: limit }),
      this.prisma.ticket.count({ where }),
    ]);
    return this.page(rows, total, page, limit, access);
  }

  async get(companyId: string, access: AccessContext, id: string) {
    const row = await this.visible(companyId, access, id);
    const agent = this.isAgent(access, row);
    const messages = await this.prisma.ticketMessage.findMany({
      where: { ticketId: id, ...(!agent && { kind: { not: TicketMessageKind.NOTE } }) },
      select: MESSAGE,
      orderBy: { createdAt: 'asc' },
    });
    const names = await this.names(messages.map((m) => m.authorId));
    const [t] = await this.present([row], access);
    return {
      ...t!,
      messages: messages.map((m) => ({ ...m, author: m.authorId ? names.get(m.authorId) ?? null : null, fromAgent: Boolean(m.authorId && m.authorId !== row.employee.userId) })),
    };
  }

  /** Nav badges: my tickets that need me, and queue tickets that need an agent. */
  async counts(companyId: string, access: AccessContext) {
    const mine = access.employee
      ? await this.prisma.ticket.count({ where: { companyId, employeeId: access.employee.id, status: { in: [TicketStatus.WAITING, TicketStatus.RESOLVED] } } })
      : 0;
    const queues = this.queuesOf(access);
    const queue = queues.length
      ? await this.prisma.ticket.count({
          where: {
            companyId,
            queue: { in: queues },
            status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
            OR: [{ assigneeId: null }, { assigneeId: access.userId }],
            employee: { userId: { not: access.userId } },
          },
        })
      : 0;
    return { mine, queue };
  }

  /** People who can take tickets in a queue (for the assign picker). */
  async agents(companyId: string, access: AccessContext, queue: TicketQueue) {
    this.assertHandles(access, queue);
    const ids = await this.notifications.companyWideApprovers(companyId, QUEUE_PERMISSION[queue]);
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: 'asc' } });
    return users;
  }

  /** Queue health for agents: workload, SLA and satisfaction over the last N days. */
  async summary(companyId: string, access: AccessContext, q: SummaryQueryDto) {
    const queues = this.queuesOf(access);
    if (!queues.length) throw new ForbiddenException('You don’t work any helpdesk queue');
    const now = new Date();
    const since = new Date(now.getTime() - (q.days ?? 30) * 86400_000);
    const f = this.prisma.ticket.fields;
    const out = [];
    for (const queue of queues) {
      const base = { companyId, queue };
      const [active, unassigned, waiting, overdue, created, resolved, responded, respondedOnTime, resolvedOnTime, rating] = await Promise.all([
        this.prisma.ticket.count({ where: { ...base, status: { in: ACTIVE } } }),
        this.prisma.ticket.count({ where: { ...base, status: { in: ACTIVE }, assigneeId: null } }),
        this.prisma.ticket.count({ where: { ...base, status: TicketStatus.WAITING } }),
        this.prisma.ticket.count({
          where: { ...base, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] }, OR: [{ resolutionDueAt: { lt: now } }, { firstRespondedAt: null, firstResponseDueAt: { lt: now } }] },
        }),
        this.prisma.ticket.count({ where: { ...base, createdAt: { gte: since } } }),
        this.prisma.ticket.count({ where: { ...base, resolvedAt: { gte: since } } }),
        this.prisma.ticket.count({ where: { ...base, firstRespondedAt: { gte: since } } }),
        this.prisma.ticket.count({ where: { ...base, firstRespondedAt: { gte: since, lte: f.firstResponseDueAt } } }),
        this.prisma.ticket.count({ where: { ...base, resolvedAt: { gte: since, lte: f.resolutionDueAt } } }),
        this.prisma.ticket.aggregate({ where: { ...base, closedAt: { gte: since }, rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
      ]);
      out.push({
        queue,
        active,
        unassigned,
        waiting,
        overdue,
        created,
        resolved,
        responseOnTimePct: responded ? Math.round((respondedOnTime / responded) * 100) : null,
        resolutionOnTimePct: resolved ? Math.round((resolvedOnTime / resolved) * 100) : null,
        avgRating: rating._avg.rating === null ? null : Math.round(rating._avg.rating * 10) / 10,
        ratings: rating._count.rating,
      });
    }
    return { days: q.days ?? 30, queues: out };
  }

  async file(companyId: string, access: AccessContext, id: string, messageId: string) {
    const row = await this.visible(companyId, access, id);
    const m = await this.prisma.ticketMessage.findFirst({ where: { id: messageId, ticketId: id }, select: { kind: true, fileKey: true, fileName: true, fileMime: true, fileSize: true } });
    if (!m?.fileKey || (m.kind === TicketMessageKind.NOTE && !this.isAgent(access, row))) throw new NotFoundException('No attachment');
    const stream = await this.files.open(m.fileKey).catch(() => {
      throw new NotFoundException('The file is missing');
    });
    return { stream, name: m.fileName!, mime: m.fileMime!, size: m.fileSize! };
  }

  // ─── Employee actions ──────────────────────────────────────

  async create(companyId: string, access: AccessContext, dto: CreateTicketDto, file?: Express.Multer.File) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    if (dto.categoryId) {
      const c = await this.categories.get(companyId, dto.categoryId);
      if (c.queue !== dto.queue || !c.isActive) throw new BadRequestException('Pick a category from this team');
    }
    const priority = dto.priority ?? TicketPriority.MEDIUM;
    const id = randomUUID();
    const stored = file ? await this.storeFile(companyId, id, file) : null;
    const now = new Date();
    let created: Row | null = null;
    for (let attempt = 0; attempt < 4 && !created; attempt++) {
      const last = await this.prisma.ticket.findFirst({ where: { companyId }, orderBy: { number: 'desc' }, select: { number: true } });
      try {
        created = await this.prisma.$transaction(async (tx) => {
          const t = await tx.ticket.create({
            data: {
              id, companyId, number: (last?.number ?? 0) + 1, queue: dto.queue, categoryId: dto.categoryId ?? null, employeeId: access.employee!.id,
              subject: dto.subject, description: dto.description, priority, ...dueDates(priority, now), lastActivityAt: now,
            },
            select: SELECT,
          });
          await tx.ticketMessage.create({ data: { companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.REPLY, body: dto.description, ...(stored ?? {}) } });
          return t;
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) {
          if (stored) await this.files.remove(stored.fileKey).catch(() => undefined);
          throw e;
        }
      }
    }
    if (!created) throw new ConflictException('Could not number the ticket — please try again');
    const t = created;
    void this.notifyQueue(companyId, t, access.userId, {
      type: 'ticket.created',
      title: `#${t.number} · ${t.employee.firstName} ${t.employee.lastName}: ${t.subject}`,
      body: `${QUEUE_LABEL[t.queue]}${t.category ? ` · ${t.category.name}` : ''} · ${PRIORITY_LABEL[t.priority]} priority`,
      actionLabel: 'Open ticket',
    });
    return this.get(companyId, access, t.id);
  }

  async reopen(companyId: string, access: AccessContext, id: string, dto: ReopenDto) {
    const row = await this.visible(companyId, access, id);
    this.assertRequester(access, row);
    if (row.status !== TicketStatus.RESOLVED) throw new BadRequestException('Only a resolved ticket can be reopened');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id },
        data: { status: row.assigneeId ? TicketStatus.IN_PROGRESS : TicketStatus.OPEN, resolvedAt: null, reopenCount: { increment: 1 }, lastActivityAt: now },
      }),
      this.prisma.ticketMessage.createMany({
        data: [
          { companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.EVENT, body: 'Reopened the ticket', createdAt: now },
          { companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.REPLY, body: dto.reason, createdAt: new Date(now.getTime() + 1) },
        ],
      }),
    ]);
    void this.notifyAgentSide(companyId, row, access.userId, {
      type: 'ticket.reopened',
      title: `#${row.number} reopened by ${row.employee.firstName}: ${row.subject}`,
      body: dto.reason,
    });
    return this.get(companyId, access, id);
  }

  /** The employee closes: rates a resolved ticket, or withdraws an open one. */
  async close(companyId: string, access: AccessContext, id: string, dto: CloseDto) {
    const row = await this.visible(companyId, access, id);
    this.assertRequester(access, row);
    if (row.status === TicketStatus.CLOSED) throw new BadRequestException('This ticket is already closed');
    const resolved = row.status === TicketStatus.RESOLVED;
    if (!resolved && dto.rating) throw new BadRequestException('You can rate a ticket once it’s resolved');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id },
        data: { status: TicketStatus.CLOSED, closedAt: now, lastActivityAt: now, ...(resolved && dto.rating && { rating: dto.rating, ratingComment: dto.comment ?? null }) },
      }),
      this.prisma.ticketMessage.create({
        data: { companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.EVENT, body: resolved ? (dto.rating ? `Closed and rated ${dto.rating}/5` : 'Closed the ticket') : 'Withdrew the ticket' },
      }),
    ]);
    if (!resolved) {
      void this.notifyAgentSide(companyId, row, access.userId, { type: 'ticket.withdrawn', title: `#${row.number} withdrawn by ${row.employee.firstName}: ${row.subject}`, email: false });
    }
    return this.get(companyId, access, id);
  }

  // ─── Conversation ──────────────────────────────────────────

  async message(companyId: string, access: AccessContext, id: string, dto: MessageDto, file?: Express.Multer.File) {
    const row = await this.visible(companyId, access, id);
    const agent = this.isAgent(access, row);
    if (row.status === TicketStatus.CLOSED) throw new BadRequestException('This ticket is closed — raise a new one if you still need help');
    if (!agent && (dto.internal || dto.waitForEmployee)) throw new ForbiddenException('Only the team working this ticket can do that');
    if (!agent && row.status === TicketStatus.RESOLVED) throw new BadRequestException('Reopen the ticket to reply');
    if (dto.internal && dto.waitForEmployee) throw new BadRequestException('An internal note can’t ask the employee for anything');

    const stored = file ? await this.storeFile(companyId, id, file) : null;
    const now = new Date();
    const data: Prisma.TicketUpdateInput = { lastActivityAt: now };
    const events: string[] = [];
    if (agent && !dto.internal) {
      if (!row.firstRespondedAt) data.firstRespondedAt = now;
      if (!row.assigneeId) {
        data.assigneeId = access.userId;
        events.push('Took the ticket');
      }
      if (row.status !== TicketStatus.RESOLVED) {
        const next = dto.waitForEmployee ? TicketStatus.WAITING : TicketStatus.IN_PROGRESS;
        if (next !== row.status) {
          data.status = next;
          if (next === TicketStatus.WAITING) events.push('Asked the employee for more information');
        }
      }
    } else if (!agent && row.status === TicketStatus.WAITING) {
      data.status = TicketStatus.IN_PROGRESS;
    }
    try {
      await this.prisma.$transaction([
        this.prisma.ticket.update({ where: { id }, data }),
        this.prisma.ticketMessage.createMany({
          data: [
            ...events.map((body) => ({ companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.EVENT, body, createdAt: now })),
            {
              companyId, ticketId: id, authorId: access.userId, kind: dto.internal ? TicketMessageKind.NOTE : TicketMessageKind.REPLY, body: dto.body,
              createdAt: new Date(now.getTime() + 1), ...(stored ?? {}),
            },
          ],
        }),
      ]);
    } catch (e) {
      if (stored) await this.files.remove(stored.fileKey).catch(() => undefined);
      throw e;
    }

    const preview = dto.body.length > 300 ? `${dto.body.slice(0, 297)}…` : dto.body;
    if (agent && !dto.internal) {
      const me = await this.names([access.userId]);
      const who = me.get(access.userId);
      void this.notifications.notify({
        companyId,
        userIds: [row.employee.userId],
        type: dto.waitForEmployee ? 'ticket.waiting' : 'ticket.reply',
        title: dto.waitForEmployee ? `${QUEUE_LABEL[row.queue]} needs more information on #${row.number}` : `${who?.firstName ?? QUEUE_LABEL[row.queue]} replied on #${row.number}: ${row.subject}`,
        body: preview,
        link: `/app/helpdesk/${id}`,
        actionLabel: 'Reply',
      });
    } else if (dto.internal) {
      if (row.assigneeId && row.assigneeId !== access.userId) {
        void this.notifications.notify({ companyId, userIds: [row.assigneeId], type: 'ticket.note', title: `Internal note on #${row.number}: ${row.subject}`, body: preview, link: `/app/helpdesk/${id}`, email: false });
      }
    } else {
      void this.notifyAgentSide(companyId, row, access.userId, { type: 'ticket.reply', title: `${row.employee.firstName} replied on #${row.number}: ${row.subject}`, body: preview });
    }
    return this.get(companyId, access, id);
  }

  // ─── Agent actions ─────────────────────────────────────────

  async assign(companyId: string, access: AccessContext, id: string, dto: AssignDto) {
    const row = await this.visible(companyId, access, id);
    this.assertAgent(access, row);
    if (row.status === TicketStatus.CLOSED) throw new BadRequestException('This ticket is closed');
    const to = dto.assigneeId ?? null;
    if (to === row.assigneeId) return this.get(companyId, access, id);
    if (to) {
      if (to === row.employee.userId) throw new BadRequestException('A ticket can’t be assigned to the person who raised it');
      const user = await this.prisma.user.findFirst({ where: { id: to, companyId }, select: { id: true } });
      if (!user || !(await this.notifications.holds(to, QUEUE_PERMISSION[row.queue]))) throw new BadRequestException(`That person doesn’t work the ${QUEUE_LABEL[row.queue]} queue`);
    }
    const names = await this.names([to, access.userId]);
    const n = to ? names.get(to) : null;
    await this.prisma.$transaction([
      this.prisma.ticket.update({ where: { id }, data: { assigneeId: to, lastActivityAt: new Date() } }),
      this.prisma.ticketMessage.create({
        data: { companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.EVENT, body: !to ? 'Unassigned the ticket' : to === access.userId ? 'Took the ticket' : `Assigned to ${n?.firstName} ${n?.lastName}` },
      }),
    ]);
    if (to && to !== access.userId) {
      const by = names.get(access.userId);
      void this.notifications.notify({
        companyId,
        userIds: [to],
        type: 'ticket.assigned',
        title: `${by?.firstName ?? 'Someone'} assigned you #${row.number}: ${row.subject}`,
        body: `${QUEUE_LABEL[row.queue]} · ${PRIORITY_LABEL[row.priority]} priority · from ${row.employee.firstName} ${row.employee.lastName}`,
        link: `/app/helpdesk/${id}`,
        actionLabel: 'Open ticket',
      });
    }
    return this.get(companyId, access, id);
  }

  async update(companyId: string, access: AccessContext, id: string, dto: UpdateTicketDto) {
    const row = await this.visible(companyId, access, id);
    this.assertAgent(access, row);
    if (row.status === TicketStatus.CLOSED) throw new BadRequestException('This ticket is closed');
    const data: Prisma.TicketUncheckedUpdateInput = {};
    const events: string[] = [];
    const queue = dto.queue ?? row.queue;
    const moving = queue !== row.queue;
    if (moving) {
      data.queue = queue;
      data.assigneeId = null;
      data.categoryId = null;
      events.push(`Moved from ${QUEUE_LABEL[row.queue]} to ${QUEUE_LABEL[queue]}`);
    }
    if (dto.categoryId !== undefined && (dto.categoryId ?? null) !== (moving ? null : row.category?.id ?? null)) {
      if (dto.categoryId) {
        const c = await this.categories.get(companyId, dto.categoryId);
        if (c.queue !== queue) throw new BadRequestException('Pick a category from this team');
        events.push(`Category: ${c.name}`);
      }
      data.categoryId = dto.categoryId ?? null;
    }
    if (dto.priority && dto.priority !== row.priority) {
      data.priority = dto.priority;
      Object.assign(data, dueDates(dto.priority, row.createdAt));
      events.push(`Priority: ${PRIORITY_LABEL[row.priority]} → ${PRIORITY_LABEL[dto.priority]}`);
    }
    if (!events.length) return this.get(companyId, access, id);
    const now = new Date();
    data.lastActivityAt = now;
    await this.prisma.$transaction([
      this.prisma.ticket.update({ where: { id }, data }),
      this.prisma.ticketMessage.createMany({ data: events.map((body, i) => ({ companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.EVENT, body, createdAt: new Date(now.getTime() + i) })) }),
    ]);
    if (moving) {
      void this.notifyQueue(companyId, { ...row, queue }, access.userId, {
        type: 'ticket.moved',
        title: `#${row.number} moved to ${QUEUE_LABEL[queue]}: ${row.subject}`,
        body: `From ${row.employee.firstName} ${row.employee.lastName} · ${PRIORITY_LABEL[dto.priority ?? row.priority]} priority`,
        actionLabel: 'Open ticket',
      });
    }
    // An agent who moved it out of their own queues can no longer open it
    return this.queuesOf(access).includes(queue) ? this.get(companyId, access, id) : { id, moved: true, queue };
  }

  async resolve(companyId: string, access: AccessContext, id: string, dto: ResolveDto) {
    const row = await this.visible(companyId, access, id);
    this.assertAgent(access, row);
    if (!ACTIVE.includes(row.status)) throw new BadRequestException('Only an open ticket can be resolved');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id },
        data: { status: TicketStatus.RESOLVED, resolvedAt: now, firstRespondedAt: row.firstRespondedAt ?? now, assigneeId: row.assigneeId ?? access.userId, lastActivityAt: now },
      }),
      this.prisma.ticketMessage.createMany({
        data: [
          { companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.REPLY, body: dto.resolution, createdAt: now },
          { companyId, ticketId: id, authorId: access.userId, kind: TicketMessageKind.EVENT, body: 'Marked as resolved', createdAt: new Date(now.getTime() + 1) },
        ],
      }),
    ]);
    void this.notifications.notify({
      companyId,
      userIds: [row.employee.userId],
      type: 'ticket.resolved',
      title: `#${row.number} is resolved: ${row.subject}`,
      body: `${dto.resolution.length > 300 ? `${dto.resolution.slice(0, 297)}…` : dto.resolution}\n\nNot fixed? Reopen it within ${AUTO_CLOSE_DAYS} days.`,
      link: `/app/helpdesk/${id}`,
      actionLabel: 'View and rate',
    });
    return this.get(companyId, access, id);
  }

  // ─── Helpers ───────────────────────────────────────────────

  queuesOf(access: AccessContext): TicketQueue[] {
    return QUEUES.filter((q) => holds(access, QUEUE_PERMISSION[q]));
  }

  assertHandles(access: AccessContext, queue: TicketQueue) {
    if (!holds(access, QUEUE_PERMISSION[queue])) throw new ForbiddenException(`You don’t work the ${QUEUE_LABEL[queue]} queue`);
  }

  private isAgent(access: AccessContext, row: Pick<Row, 'queue' | 'employee'>) {
    return row.employee.userId !== access.userId && holds(access, QUEUE_PERMISSION[row.queue]);
  }

  private assertAgent(access: AccessContext, row: Row) {
    if (!this.isAgent(access, row)) throw new ForbiddenException(row.employee.userId === access.userId ? 'You can’t work your own ticket' : `You don’t work the ${QUEUE_LABEL[row.queue]} queue`);
  }

  private assertRequester(access: AccessContext, row: Row) {
    if (row.employee.userId !== access.userId) throw new ForbiddenException('Only the person who raised the ticket can do that');
  }

  private async visible(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.ticket.findFirst({ where: { id, companyId }, select: SELECT });
    if (!row || (row.employee.userId !== access.userId && !holds(access, QUEUE_PERMISSION[row.queue]))) throw new NotFoundException('Ticket not found');
    return row;
  }

  private async names(ids: Array<string | null | undefined>) {
    const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!unique.length) return new Map<string, { id: string; firstName: string; lastName: string; avatarUrl: string | null }>();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true, employee: { select: { avatarUrl: true } } } });
    return new Map(users.map((u) => [u.id, { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.employee?.avatarUrl ?? null }]));
  }

  private async present(rows: Row[], access: AccessContext) {
    const names = await this.names(rows.map((r) => r.assigneeId));
    const now = Date.now();
    return rows.map((r) => {
      const agent = this.isAgent(access, r);
      const mine = r.employee.userId === access.userId;
      const { userId: _u, ...employee } = r.employee;
      const running = r.status === TicketStatus.OPEN || r.status === TicketStatus.IN_PROGRESS;
      return {
        ...r,
        employee,
        assignee: r.assigneeId ? names.get(r.assigneeId) ?? null : null,
        responseOverdue: running && !r.firstRespondedAt && r.firstResponseDueAt.getTime() < now,
        resolutionOverdue: running && r.resolutionDueAt.getTime() < now,
        autoCloseAt: r.status === TicketStatus.RESOLVED && r.resolvedAt ? new Date(r.resolvedAt.getTime() + AUTO_CLOSE_DAYS * 86400_000) : null,
        isAgent: agent,
        isMine: mine,
        canReply: (agent && r.status !== TicketStatus.CLOSED) || (mine && ACTIVE.includes(r.status)),
        canResolve: agent && ACTIVE.includes(r.status),
        canReopen: mine && r.status === TicketStatus.RESOLVED,
        canClose: mine && r.status !== TicketStatus.CLOSED,
      };
    });
  }

  private async page(rows: Row[], total: number, page: number, limit: number, access: AccessContext) {
    return { data: await this.present(rows, access), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Everyone in the ticket's queue, except the actor and the requester. */
  private async notifyQueue(companyId: string, row: Pick<Row, 'id' | 'queue' | 'employee'>, actorId: string, n: { type: string; title: string; body?: string; actionLabel?: string; email?: boolean }) {
    const agents = await this.notifications.companyWideApprovers(companyId, QUEUE_PERMISSION[row.queue]);
    return this.notifications.notify({ companyId, userIds: agents.filter((u) => u !== actorId && u !== row.employee.userId), link: `/app/helpdesk/${row.id}`, ...n });
  }

  /** The assignee (email), or — while unassigned — the whole queue (in-app only). */
  private notifyAgentSide(companyId: string, row: Row, actorId: string, n: { type: string; title: string; body?: string; email?: boolean }) {
    if (row.assigneeId) return this.notifications.notify({ companyId, userIds: [row.assigneeId].filter((u) => u !== actorId), link: `/app/helpdesk/${row.id}`, actionLabel: 'Open ticket', ...n });
    return this.notifyQueue(companyId, row, actorId, { ...n, email: false, actionLabel: 'Open ticket' });
  }

  private async storeFile(companyId: string, ticketId: string, file: Express.Multer.File) {
    if (file.size > FILE_MAX_BYTES) throw new BadRequestException('Attachments must be 10 MB or smaller');
    const type = detectFileType(file.buffer, file.mimetype);
    if (!type || !DOCUMENT_TYPES.has(type.ext)) throw new BadRequestException('Attachments can be PDF, JPG, PNG, WebP or Word (.docx)');
    const key = `${companyId}/helpdesk/${ticketId}/${randomUUID()}.${type.ext}`;
    await this.files.save(key, file.buffer);
    const base = (file.originalname ?? 'attachment').split(/[\\/]/).pop()!.replace(/\.[^.]*$/, '').replace(/[^\w\- ().]+/g, '').slice(0, 80) || 'attachment';
    return { fileKey: key, fileName: `${base}.${type.ext}`, fileMime: type.mime, fileSize: file.size };
  }

}
