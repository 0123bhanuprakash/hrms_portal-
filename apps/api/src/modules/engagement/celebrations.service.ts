import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService, room } from '../realtime/realtime.service';
import type { AccessContext } from '../access/access.types';
import { companyToday, nextOccurrence, startOfDay } from '../employee-profile/celebration-dates';
import { keyFromDate } from '../attendance/time-zone';
import { WISH_STICKERS, type SendWishDto, type WishKind } from './dto';

const PERSON = { id: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } } as const;

type WishPerson = { id: string | null; firstName: string; lastName: string; avatarUrl: string | null; designation: { name: string } | null };
type Occasion = { kind: WishKind; date: string; years: number | null; wishes: Array<{ id: string; sticker: string; message: string | null; createdAt: Date; from: WishPerson }> };

/**
 * Birthday and work-anniversary wishes. A celebration thing, not kudos:
 * private between the two people (everyone else only sees how many), one per
 * person per occasion, only on the day, and never to yourself.
 */
@Injectable()
export class CelebrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  async send(companyId: string, access: AccessContext, dto: SendWishDto) {
    if (!WISH_STICKERS[dto.kind].includes(dto.sticker)) throw new BadRequestException('Pick one of the stickers');
    if (access.employee && dto.employeeIds.includes(access.employee.id)) throw new BadRequestException('You can’t send wishes to yourself');
    const { today } = await companyToday(this.prisma, companyId);
    const people = await this.prisma.employee.findMany({
      where: { id: { in: dto.employeeIds }, companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } },
      select: { id: true, userId: true, firstName: true, dateOfBirth: true, joiningDate: true },
    });
    if (people.length !== dto.employeeIds.length) throw new NotFoundException('Employee not found');
    if (people.some((p) => p.userId && p.userId === access.userId)) throw new BadRequestException('You can’t send wishes to yourself');
    const years = new Map<string, number | null>();
    for (const p of people) {
      const occasion = celebratesToday(p, dto.kind, today);
      if (occasion === false) throw new BadRequestException(`It isn’t ${p.firstName}’s ${dto.kind === 'birthday' ? 'birthday' : 'work anniversary'} today`);
      years.set(p.id, occasion);
    }
    const message = dto.message?.trim() || null;
    const already = new Set(
      (await this.prisma.celebrationWish.findMany({ where: { fromUserId: access.userId, employeeId: { in: dto.employeeIds }, kind: dto.kind, occasion: today }, select: { employeeId: true } })).map((w) => w.employeeId),
    );
    const fresh = people.filter((p) => !already.has(p.id));
    if (fresh.length) {
      await this.prisma.celebrationWish.createMany({
        data: fresh.map((p) => ({ companyId, fromUserId: access.userId, employeeId: p.id, kind: dto.kind, occasion: today, years: years.get(p.id) ?? null, sticker: dto.sticker, message })),
        skipDuplicates: true,
      });
      for (const p of fresh) if (p.userId) await this.tell(companyId, p.userId, p.id, dto.kind, today, years.get(p.id) ?? null);
      // The celebrant's own "N wishes so far today" counts up (nobody else sees counts);
      // the sender's other tabs flip to "Wished"
      this.realtime.changed([...fresh.flatMap((p) => (p.userId ? [room.user(p.userId)] : [])), room.user(access.userId)], 'celebrations');
    }
    return { sent: fresh.map((p) => p.id), alreadyWished: [...already] };
  }

  /** Today for the caller: whom I've wished, and the wishes I got. */
  async today(companyId: string, access: AccessContext) {
    const { today } = await companyToday(this.prisma, companyId);
    const [wished, received] = await Promise.all([
      this.prisma.celebrationWish.findMany({ where: { companyId, fromUserId: access.userId, occasion: today }, select: { employeeId: true, kind: true } }),
      access.employee ? this.received(companyId, access.employee.id, today) : Promise.resolve([] as Occasion[]),
    ]);
    return { date: keyFromDate(today), wished, received };
  }

  /** The celebrant's own wishes, newest occasion first, last 12 months. */
  async mine(companyId: string, access: AccessContext) {
    if (!access.employee) return [];
    const { today } = await companyToday(this.prisma, companyId);
    return this.received(companyId, access.employee.id, { gte: new Date(today.getTime() - 366 * 86_400_000) });
  }

  /** Wishes grouped by occasion. */
  private async received(companyId: string, employeeId: string, occasion: Date | { gte: Date }): Promise<Occasion[]> {
    const rows = await this.prisma.celebrationWish.findMany({
      where: { companyId, employeeId, occasion },
      orderBy: [{ occasion: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      select: { id: true, kind: true, occasion: true, years: true, sticker: true, message: true, createdAt: true, from: { select: { firstName: true, lastName: true, employee: { select: PERSON } } } },
    });
    const groups = new Map<string, Occasion>();
    for (const r of rows) {
      const key = `${r.kind}:${keyFromDate(r.occasion)}`;
      const g = groups.get(key) ?? { kind: r.kind as WishKind, date: keyFromDate(r.occasion), years: r.years, wishes: [] };
      g.wishes.push({ id: r.id, sticker: r.sticker, message: r.message, createdAt: r.createdAt, from: r.from.employee ?? { id: null, firstName: r.from.firstName, lastName: r.from.lastName, avatarUrl: null, designation: null } });
      groups.set(key, g);
    }
    return [...groups.values()];
  }

  /** One running notification per occasion: "Priya, Amit and 3 others wished you…". */
  private async tell(companyId: string, userId: string, employeeId: string, kind: WishKind, occasion: Date, years: number | null) {
    const wishes = await this.prisma.celebrationWish.findMany({
      where: { employeeId, kind, occasion },
      orderBy: { createdAt: 'desc' },
      select: { sticker: true, message: true, from: { select: { firstName: true, lastName: true } } },
    });
    const latest = wishes[0];
    if (!latest) return;
    const names = wishes.map((w) => w.from.firstName);
    const who =
      names.length === 1
        ? `${latest.from.firstName} ${latest.from.lastName}`
        : names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length === 3 ? '' : 's'}`;
    const what = kind === 'birthday' ? 'a happy birthday 🎂' : `on your ${years ? `${years}-year ` : ''}work anniversary 🏆`;
    await this.notifications.notifyGrouped({
      companyId,
      userId,
      type: `celebration.${kind}`,
      dedupeKey: `wish:${employeeId}:${kind}:${keyFromDate(occasion)}`,
      title: `${who} wished you ${what}`,
      body: latest.message ? `${latest.sticker} “${latest.message}” — ${latest.from.firstName}` : `${latest.sticker} from ${latest.from.firstName}`,
      link: '/app/wishes',
    });
  }
}

/** Years (anniversary) or null (birthday) when the person celebrates `kind` today; false when not. */
function celebratesToday(p: { dateOfBirth: Date | null; joiningDate: Date }, kind: WishKind, today: Date): number | null | false {
  if (kind === 'birthday') return p.dateOfBirth && nextOccurrence(p.dateOfBirth, today).getTime() === today.getTime() ? null : false;
  const joined = startOfDay(p.joiningDate);
  if (nextOccurrence(joined, today).getTime() !== today.getTime()) return false;
  const years = today.getUTCFullYear() - joined.getUTCFullYear();
  return years >= 1 ? years : false;
}
