import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import type { GiveKudosDto, KudosQueryDto, SaveKudosValueDto } from './dto';

/** Created once for a company with no values yet (HR can edit them). */
const DEFAULT_VALUES = [
  { name: 'Teamwork', emoji: '🤝', color: '#0EA5E9', sortOrder: 10, description: 'Made the team better together.' },
  { name: 'Ownership', emoji: '🎯', color: '#F59E0B', sortOrder: 20, description: 'Took responsibility and saw it through.' },
  { name: 'Customer first', emoji: '💙', color: '#6366F1', sortOrder: 30, description: 'Went out of their way for a customer.' },
  { name: 'Innovation', emoji: '💡', color: '#10B981', sortOrder: 40, description: 'Found a smarter way to do it.' },
  { name: 'Extra mile', emoji: '🚀', color: '#EC4899', sortOrder: 50, description: 'Did more than anyone asked.' },
];
/** The giver can take a kudos back within a day; kudos.manage any time. */
const UNDO_HOURS = 24;

const PERSON = { id: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } } satisfies Prisma.EmployeeSelect;
const SELECT = {
  id: true,
  message: true,
  createdAt: true,
  fromUserId: true,
  from: { select: { id: true, firstName: true, lastName: true, employee: { select: PERSON } } },
  value: { select: { id: true, name: true, emoji: true, color: true } },
  recipients: { select: { employee: { select: PERSON } } },
  reactions: { select: { emoji: true, userId: true } },
} satisfies Prisma.KudosSelect;
type Row = Prisma.KudosGetPayload<{ select: typeof SELECT }>;

/** Public thank-yous — everyone in the company sees them. */
@Injectable()
export class KudosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async feed(companyId: string, access: AccessContext, query: KudosQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.KudosWhereInput = { companyId, deletedAt: null, ...(query.employeeId && { recipients: { some: { employeeId: query.employeeId } } }) };
    const [rows, total] = await Promise.all([
      this.prisma.kudos.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, select: SELECT }),
      this.prisma.kudos.count({ where }),
    ]);
    return { data: rows.map((r) => this.present(r, access)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async give(companyId: string, access: AccessContext, dto: GiveKudosDto) {
    const people = await this.prisma.employee.findMany({
      where: { companyId, id: { in: dto.recipientIds }, employmentStatus: { not: EmploymentStatus.TERMINATED } },
      select: { id: true, userId: true, firstName: true },
    });
    if (people.length !== dto.recipientIds.length) throw new NotFoundException('Choose current colleagues only');
    if (people.some((p) => p.userId === access.userId)) throw new BadRequestException('You can’t give kudos to yourself');
    if (dto.valueId && !(await this.prisma.kudosValue.count({ where: { id: dto.valueId, companyId, isActive: true } }))) throw new NotFoundException('Value not found');

    const created = await this.prisma.kudos.create({
      data: {
        companyId,
        fromUserId: access.userId,
        message: dto.message,
        valueId: dto.valueId ?? null,
        recipients: { create: people.map((p) => ({ employeeId: p.id })) },
      },
      select: SELECT,
    });
    const value = created.value ? ` ${created.value.emoji} ${created.value.name}` : '';
    void this.notifications.notify({
      companyId,
      userIds: people.map((p) => p.userId),
      type: 'kudos.received',
      title: `${created.from.firstName} ${created.from.lastName} gave you kudos${value ? ` —${value}` : ''}`,
      body: created.message,
      link: '/app/kudos',
      email: false,
    });
    return this.present(created, access);
  }

  async react(companyId: string, access: AccessContext, id: string, emoji: string) {
    await this.exists(companyId, id);
    const key = { kudosId_userId_emoji: { kudosId: id, userId: access.userId, emoji } };
    const existing = await this.prisma.kudosReaction.findUnique({ where: key });
    if (existing) await this.prisma.kudosReaction.delete({ where: key });
    else await this.prisma.kudosReaction.create({ data: { kudosId: id, userId: access.userId, emoji } });
    const row = await this.prisma.kudos.findUniqueOrThrow({ where: { id }, select: SELECT });
    return this.present(row, access);
  }

  async remove(companyId: string, access: AccessContext, id: string) {
    const row = await this.exists(companyId, id);
    const ownRecent = row.fromUserId === access.userId && Date.now() - row.createdAt.getTime() < UNDO_HOURS * 3_600_000;
    if (!ownRecent && !holds(access, 'kudos.manage')) {
      throw new ForbiddenException(row.fromUserId === access.userId ? `Kudos can only be taken back within ${UNDO_HOURS} hours` : 'You can’t remove someone else’s kudos');
    }
    await this.prisma.kudos.update({ where: { id }, data: { deletedAt: new Date(), deletedById: access.userId } });
    return { id };
  }

  /** Received / given counts and the values someone is recognised for. */
  async stats(companyId: string, employeeId: string) {
    const person = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true, userId: true } });
    if (!person) throw new NotFoundException('Employee not found');
    const [received, given, byValue] = await Promise.all([
      this.prisma.kudosRecipient.count({ where: { employeeId, kudos: { deletedAt: null } } }),
      this.prisma.kudos.count({ where: { companyId, fromUserId: person.userId, deletedAt: null } }),
      this.prisma.kudos.groupBy({ by: ['valueId'], where: { companyId, deletedAt: null, valueId: { not: null }, recipients: { some: { employeeId } } }, _count: { _all: true } }),
    ]);
    const values = await this.prisma.kudosValue.findMany({ where: { id: { in: byValue.map((v) => v.valueId!) } }, select: { id: true, name: true, emoji: true, color: true } });
    return {
      employeeId,
      received,
      given,
      values: byValue
        .map((v) => ({ value: values.find((x) => x.id === v.valueId)!, count: v._count._all }))
        .filter((v) => v.value)
        .sort((a, b) => b.count - a.count),
    };
  }

  // ─── Values ────────────────────────────────────────────────

  async values(companyId: string, includeInactive: boolean) {
    if (!(await this.prisma.kudosValue.count({ where: { companyId } }))) {
      await this.prisma.kudosValue.createMany({ data: DEFAULT_VALUES.map((v) => ({ ...v, companyId })), skipDuplicates: true });
    }
    return this.prisma.kudosValue.findMany({
      where: { companyId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, emoji: true, description: true, color: true, isActive: true, sortOrder: true },
    });
  }

  async saveValue(companyId: string, id: string | null, dto: SaveKudosValueDto) {
    const data = { name: dto.name, emoji: dto.emoji, description: dto.description ?? null, color: dto.color ?? '#6366F1', isActive: dto.isActive ?? true, sortOrder: dto.sortOrder ?? 100 };
    if (id && !(await this.prisma.kudosValue.count({ where: { id, companyId } }))) throw new NotFoundException('Value not found');
    try {
      return id ? await this.prisma.kudosValue.update({ where: { id }, data }) : await this.prisma.kudosValue.create({ data: { ...data, companyId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException(`A value called "${dto.name}" already exists`);
      throw err;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async exists(companyId: string, id: string) {
    const row = await this.prisma.kudos.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true, fromUserId: true, createdAt: true } });
    if (!row) throw new NotFoundException('Kudos not found');
    return row;
  }

  private present(r: Row, access: AccessContext) {
    const counts = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const x of r.reactions) {
      const c = counts.get(x.emoji) ?? { emoji: x.emoji, count: 0, mine: false };
      c.count++;
      if (x.userId === access.userId) c.mine = true;
      counts.set(x.emoji, c);
    }
    const mine = r.fromUserId === access.userId;
    return {
      id: r.id,
      message: r.message,
      createdAt: r.createdAt,
      from: r.from.employee ?? { id: null, employeeId: null, firstName: r.from.firstName, lastName: r.from.lastName, avatarUrl: null, designation: null },
      value: r.value,
      recipients: r.recipients.map((x) => x.employee),
      reactions: [...counts.values()],
      canRemove: (mine && Date.now() - r.createdAt.getTime() < UNDO_HOURS * 3_600_000) || holds(access, 'kudos.manage'),
    };
  }
}
