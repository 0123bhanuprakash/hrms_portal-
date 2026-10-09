import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import type { GiveKudosDto, KudosInsightsQueryDto, KudosQueryDto, SaveKudosValueDto } from './dto';

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
  thanks: { select: { userId: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.KudosSelect;
type Row = Prisma.KudosGetPayload<{ select: typeof SELECT }>;

const DAY = 86_400_000;
const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();

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
    const me = access.employee?.id ?? null;
    const and: Prisma.KudosWhereInput[] = [];
    if (query.employeeId) and.push({ recipients: { some: { employeeId: query.employeeId } } });
    if (query.valueId) and.push({ valueId: query.valueId });
    if (query.filter === 'for-me') and.push(me ? { recipients: { some: { employeeId: me } } } : { id: { in: [] } });
    if (query.filter === 'from-me') and.push({ fromUserId: access.userId });
    if (query.filter === 'team') {
      const team = await this.teamOf(companyId, access);
      and.push({ OR: [{ recipients: { some: { employeeId: { in: team } } } }, { from: { employee: { id: { in: team } } } }] });
    }
    const where: Prisma.KudosWhereInput = { companyId, deletedAt: null, AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.kudos.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, select: SELECT }),
      this.prisma.kudos.count({ where }),
    ]);
    const names = await this.userNames(rows.flatMap((r) => r.thanks.slice(0, 3).map((t) => t.userId)));
    return { data: rows.map((r) => this.present(r, access, names)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** One kudos, shaped like a feed item — for its own page (home card, notifications). */
  async one(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.kudos.findFirst({ where: { id, companyId, deletedAt: null }, select: SELECT });
    if (!row) throw new NotFoundException('Shout-out not found');
    return this.present(row, access, await this.userNames(row.thanks.slice(0, 3).map((t) => t.userId)));
  }

  async give(companyId: string, access: AccessContext, dto: GiveKudosDto) {
    const people = await this.prisma.employee.findMany({
      where: { companyId, id: { in: dto.recipientIds }, employmentStatus: { not: EmploymentStatus.TERMINATED } },
      select: { id: true, userId: true, firstName: true, lastName: true, reportingManager: { select: { userId: true } } },
    });
    if (people.length !== dto.recipientIds.length) throw new NotFoundException('Choose current colleagues only');
    if (people.some((p) => p.userId === access.userId)) throw new BadRequestException('You can’t give yourself a shout-out');
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
      title: `${created.from.firstName} ${created.from.lastName} gave you a shout-out${value ? ` —${value}` : ''}`,
      body: created.message,
      link: `/app/kudos/${created.id}`,
      email: false,
      // Lets a deleted kudos take its notifications back (see remove)
      dedupeKey: `kudos:${created.id}:received`,
    });
    // Their managers like to know too (not the giver, not the people thanked)
    const recipients = new Set(people.map((p) => p.userId));
    const managers = new Map<string, string[]>();
    for (const p of people) {
      const m = p.reportingManager?.userId;
      if (m && m !== access.userId && !recipients.has(m)) managers.set(m, [...(managers.get(m) ?? []), p.firstName]);
    }
    for (const [managerId, firstNames] of managers) {
      void this.notifications.notify({
        companyId,
        userIds: [managerId],
        type: 'kudos.team',
        title: `${created.from.firstName} thanked ${firstNames.join(' & ')} from your team${value ? ` —${value}` : ''}`,
        body: created.message,
        link: `/app/kudos/${created.id}`,
        email: false,
        dedupeKey: `kudos:${created.id}:team`,
      });
    }
    return this.present(created, access);
  }

  /** "Add my thanks" — toggles backing someone else's kudos. */
  async thank(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.kudos.findFirst({ where: { id, companyId, deletedAt: null }, select: SELECT });
    if (!row) throw new NotFoundException('Shout-out not found');
    if (row.fromUserId === access.userId) throw new BadRequestException('You wrote this one');
    if (row.recipients.some((r) => r.employee.id === access.employee?.id)) throw new BadRequestException('You can’t add thanks to your own shout-out');
    const key = { kudosId_userId: { kudosId: id, userId: access.userId } };
    const existing = await this.prisma.kudosThanks.findUnique({ where: key });
    if (existing) await this.prisma.kudosThanks.delete({ where: key });
    else {
      await this.prisma.kudosThanks.create({ data: { kudosId: id, userId: access.userId } });
      const me = await this.prisma.user.findUnique({ where: { id: access.userId }, select: { firstName: true, lastName: true } });
      const recipients = await this.prisma.employee.findMany({ where: { id: { in: row.recipients.map((r) => r.employee.id) } }, select: { userId: true } });
      void this.notifications.notify({
        companyId,
        userIds: recipients.map((r) => r.userId),
        type: 'kudos.thanks',
        title: `${me ? name(me) : 'A colleague'} added their thanks to your shout-out`,
        body: row.message,
        link: `/app/kudos/${id}`,
        email: false,
        dedupeKey: `kudos-thanks:${id}:${access.userId}`,
      });
    }
    const fresh = await this.prisma.kudos.findUniqueOrThrow({ where: { id }, select: SELECT });
    return this.present(fresh, access, await this.userNames(fresh.thanks.slice(0, 3).map((t) => t.userId)));
  }

  /** Most thanked people this month. */
  async leaderboard(companyId: string) {
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rows = await this.prisma.kudosRecipient.groupBy({
      by: ['employeeId'],
      where: { kudos: { companyId, deletedAt: null, createdAt: { gte: since } }, employee: { employmentStatus: { not: EmploymentStatus.TERMINATED } } },
      _count: { _all: true },
      orderBy: { _count: { employeeId: 'desc' } },
      take: 5,
    });
    const people = await this.prisma.employee.findMany({ where: { id: { in: rows.map((r) => r.employeeId) } }, select: PERSON });
    const top = await Promise.all(
      rows.map(async (r) => {
        const v = await this.prisma.kudos.groupBy({ by: ['valueId'], where: { companyId, deletedAt: null, createdAt: { gte: since }, valueId: { not: null }, recipients: { some: { employeeId: r.employeeId } } }, _count: { _all: true }, orderBy: { _count: { valueId: 'desc' } }, take: 1 });
        const value = v[0]?.valueId ? await this.prisma.kudosValue.findUnique({ where: { id: v[0].valueId }, select: { emoji: true, name: true, color: true } }) : null;
        return { employee: people.find((p) => p.id === r.employeeId)!, count: r._count._all, topValue: value };
      }),
    );
    return { month: since.toISOString().slice(0, 7), people: top.filter((t) => t.employee) };
  }

  /** My own numbers: received, given, this month, values. */
  async mine(companyId: string, access: AccessContext) {
    if (!access.employee) {
      return { received: 0, given: await this.prisma.kudos.count({ where: { companyId, fromUserId: access.userId, deletedAt: null } }), thisMonth: 0, values: [] };
    }
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [stats, thisMonth] = await Promise.all([
      this.stats(companyId, access.employee.id),
      this.prisma.kudosRecipient.count({ where: { employeeId: access.employee.id, kudos: { deletedAt: null, createdAt: { gte: since } } } }),
    ]);
    return { received: stats.received, given: stats.given, thisMonth, values: stats.values };
  }

  /** A few people worth thanking: new joiners, and teammates nobody has thanked lately. */
  async suggestions(companyId: string, access: AccessContext) {
    const me = access.employee?.id;
    const now = Date.now();
    const recent = new Date(now - 30 * DAY);
    const [team, joiners, thankedByMe] = await Promise.all([
      this.teamOf(companyId, access),
      this.prisma.employee.findMany({ where: { companyId, joiningDate: { gte: recent, lte: new Date(now) }, employmentStatus: { not: EmploymentStatus.TERMINATED } }, select: { id: true } }),
      this.prisma.kudosRecipient.findMany({ where: { kudos: { companyId, fromUserId: access.userId, deletedAt: null, createdAt: { gte: recent } } }, select: { employeeId: true } }),
    ]);
    const skip = new Set([...thankedByMe.map((t) => t.employeeId), ...(me ? [me] : [])]);
    const ids = [...new Set([...joiners.map((j) => j.id), ...team])].filter((id) => !skip.has(id));
    if (!ids.length) return [];
    const [people, received] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: ids }, employmentStatus: { not: EmploymentStatus.TERMINATED } }, select: { ...PERSON, joiningDate: true } }),
      this.prisma.kudosRecipient.findMany({ where: { employeeId: { in: ids }, kudos: { deletedAt: null } }, select: { employeeId: true, kudos: { select: { createdAt: true } } } }),
    ]);
    const lastAt = new Map<string, number>();
    for (const r of received) lastAt.set(r.employeeId, Math.max(lastAt.get(r.employeeId) ?? 0, r.kudos.createdAt.getTime()));
    const teamSet = new Set(team);
    return people
      .map((p) => {
        const days = Math.floor((now - p.joiningDate.getTime()) / DAY);
        const last = lastAt.get(p.id);
        const reason =
          days <= 30 ? `New — joined ${days <= 7 ? 'this week' : `${days} days ago`}`
          : !last ? 'On your team · never thanked yet'
          : now - last > 30 * DAY ? `On your team · last thanked ${Math.floor((now - last) / DAY)} days ago`
          : 'On your team';
        const score = (days <= 30 ? 3 : 0) + (!last ? 2 : now - last > 30 * DAY ? 1 : 0) + (teamSet.has(p.id) ? 1 : 0);
        return { employee: { id: p.id, employeeId: p.employeeId, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, designation: p.designation }, reason, score };
      })
      .filter((x) => x.score > 1)
      .sort((a, b) => b.score - a.score || a.employee.firstName.localeCompare(b.employee.firstName))
      .slice(0, 3)
      .map((x) => ({ employee: x.employee, reason: x.reason }));
  }

  // ─── Insights (kudos.manage) ───────────────────────────────

  async insights(companyId: string, query: KudosInsightsQueryDto) {
    const months = query.months ?? 6;
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2 * months + 1, 1));
    const current = { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: now } };
    // Everything is counted in the database — no kudos rows are loaded
    const [totals, monthRows, byValueRows, pairs, previous, headcount, values, departments] = await Promise.all([
      this.prisma.$queryRaw<Array<{ sent: number; givers: number; thanked: number }>>`
        SELECT COUNT(DISTINCT k.id)::int AS sent,
               COUNT(DISTINCT k.from_user_id)::int AS givers,
               COUNT(DISTINCT kr.employee_id)::int AS thanked
        FROM kudos k LEFT JOIN kudos_recipients kr ON kr.kudos_id = k.id
        WHERE k.company_id = ${companyId}::uuid AND k.deleted_at IS NULL AND k.created_at >= ${start}`,
      this.prisma.$queryRaw<Array<{ month: string; n: number }>>`
        SELECT to_char(date_trunc('month', k.created_at), 'YYYY-MM') AS month, COUNT(*)::int AS n
        FROM kudos k
        WHERE k.company_id = ${companyId}::uuid AND k.deleted_at IS NULL AND k.created_at >= ${start}
        GROUP BY 1`,
      this.prisma.kudos.groupBy({ by: ['valueId'], where: { companyId, deletedAt: null, createdAt: { gte: start } }, _count: { _all: true } }),
      // Who thanks whom, between departments
      this.prisma.$queryRaw<Array<{ from_dept: string | null; to_dept: string | null; n: number }>>`
        SELECT fe.department_id::text AS from_dept, te.department_id::text AS to_dept, COUNT(*)::int AS n
        FROM kudos k
        JOIN kudos_recipients kr ON kr.kudos_id = k.id
        JOIN employees te ON te.id = kr.employee_id
        LEFT JOIN employees fe ON fe.user_id = k.from_user_id
        WHERE k.company_id = ${companyId}::uuid AND k.deleted_at IS NULL AND k.created_at >= ${start}
        GROUP BY 1, 2`,
      this.prisma.kudos.count({ where: { companyId, deletedAt: null, createdAt: { gte: prevStart, lt: start } } }),
      this.prisma.employee.count({ where: current }),
      this.prisma.kudosValue.findMany({ where: { companyId }, select: { id: true, name: true, emoji: true, color: true } }),
      this.prisma.department.findMany({ where: { companyId }, select: { id: true, name: true } }),
    ]);
    const perMonth = new Map(monthRows.map((r) => [r.month, r.n]));
    const monthly: Array<{ month: string; count: number }> = [];
    for (let i = 0; i < months; i++) {
      const key = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
      monthly.push({ month: key, count: perMonth.get(key) ?? 0 });
    }
    const byValue = new Map<string | null, number>(byValueRows.map((r) => [r.valueId, r._count._all]));
    // Busiest six departments
    const pair = new Map<string, number>();
    const activity = new Map<string, number>();
    for (const r of pairs) {
      const from = r.from_dept ?? 'none';
      const to = r.to_dept ?? 'none';
      pair.set(`${from}>${to}`, (pair.get(`${from}>${to}`) ?? 0) + r.n);
      activity.set(from, (activity.get(from) ?? 0) + r.n);
      activity.set(to, (activity.get(to) ?? 0) + r.n);
    }
    const top = [...activity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
    const t = totals[0] ?? { sent: 0, givers: 0, thanked: 0 };
    const deptName = (id: string) => (id === 'none' ? 'No department' : (departments.find((d) => d.id === id)?.name ?? 'Unknown'));
    return {
      months,
      from: start.toISOString().slice(0, 10),
      sent: t.sent,
      previous,
      headcount,
      peopleThanked: t.thanked,
      givers: t.givers,
      monthly,
      values: [
        ...values.map((v) => ({ value: v as typeof v | null, count: byValue.get(v.id) ?? 0 })).filter((v) => v.count > 0).sort((a, b) => b.count - a.count),
        ...(byValue.get(null) ? [{ value: null, count: byValue.get(null)! }] : []),
      ],
      matrix: {
        departments: top.map((id) => ({ id, name: deptName(id) })),
        counts: top.map((from) => top.map((to) => pair.get(`${from}>${to}`) ?? 0)),
      },
      notThanked: await this.notThanked(companyId),
    };
  }

  /** Current people nobody has thanked in 90 days (HR only — never shown on the wall). */
  private async notThanked(companyId: string) {
    const since = new Date(Date.now() - 90 * DAY);
    const people = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: new Date() }, kudosReceived: { none: { kudos: { deletedAt: null, createdAt: { gte: since } } } } },
      select: { ...PERSON, joiningDate: true, department: { select: { name: true } }, reportingManager: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { joiningDate: 'desc' },
      take: 50,
    });
    // Each person's latest kudos, one row per person
    const ids = people.map((p) => p.id);
    const last = ids.length
      ? await this.prisma.$queryRaw<Array<{ employee_id: string; at: Date }>>`
          SELECT kr.employee_id::text AS employee_id, MAX(k.created_at) AS at
          FROM kudos_recipients kr JOIN kudos k ON k.id = kr.kudos_id
          WHERE kr.employee_id = ANY(${ids}::uuid[]) AND k.deleted_at IS NULL
          GROUP BY kr.employee_id`
      : [];
    const lastAt = new Map(last.map((l) => [l.employee_id, l.at]));
    return people.map(({ reportingManager, department, joiningDate, ...p }) => ({
      employee: p,
      department: department?.name ?? null,
      joiningDate,
      lastKudosAt: lastAt.get(p.id) ?? null,
      manager: reportingManager ? { id: reportingManager.id, name: name(reportingManager) } : null,
    }));
  }

  /** A quiet note to each person's manager — never a public list. */
  async hintManagers(companyId: string, employeeIds: string[]) {
    const people = await this.prisma.employee.findMany({
      where: { companyId, id: { in: employeeIds }, employmentStatus: { not: EmploymentStatus.TERMINATED } },
      select: { id: true, firstName: true, lastName: true, reportingManager: { select: { userId: true } } },
    });
    const month = new Date().toISOString().slice(0, 7);
    let hinted = 0;
    const skipped: string[] = [];
    for (const p of people) {
      if (!p.reportingManager) {
        skipped.push(name(p));
        continue;
      }
      await this.notifications.notify({
        companyId,
        userIds: [p.reportingManager.userId],
        type: 'kudos.hint',
        title: `Nobody has thanked ${p.firstName} in a while`,
        body: `Anything ${p.firstName} did recently that deserves a thank-you?`,
        link: `/app/kudos?to=${p.id}`,
        actionLabel: `Thank ${p.firstName}`,
        email: false,
        dedupeKey: `kudos-hint:${p.id}:${month}`,
      });
      hinted++;
    }
    return { hinted, skipped };
  }

  /** My manager's team (my peers), my manager, and everyone who reports to me. */
  private async teamOf(companyId: string, access: AccessContext): Promise<string[]> {
    const me = access.employee?.id;
    if (!me) return [];
    const self = await this.prisma.employee.findUnique({ where: { id: me }, select: { reportingManagerId: true } });
    const rows = await this.prisma.employee.findMany({
      where: {
        companyId,
        employmentStatus: { not: EmploymentStatus.TERMINATED },
        id: { not: me },
        OR: [
          ...(self?.reportingManagerId ? [{ reportingManagerId: self.reportingManagerId }, { id: self.reportingManagerId }] : []),
          { ancestors: { some: { ancestorId: me, depth: { gte: 1 } } } },
        ],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async userNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, name(u)]));
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
      throw new ForbiddenException(row.fromUserId === access.userId ? `A shout-out can only be taken back within ${UNDO_HOURS} hours` : 'You can’t remove someone else’s shout-out');
    }
    await this.prisma.kudos.update({ where: { id }, data: { deletedAt: new Date(), deletedById: access.userId } });
    // Nobody is told it was removed; its notifications quietly leave the bells
    void this.notifications.withdraw(companyId, { dedupePrefixes: [`kudos:${id}:`, `kudos-thanks:${id}:`] }).catch(() => undefined);
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
    if (!row) throw new NotFoundException('Shout-out not found');
    return row;
  }

  private present(r: Row, access: AccessContext, names: Map<string, string> = new Map()) {
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
      thanks: {
        count: r.thanks.length,
        mine: r.thanks.some((t) => t.userId === access.userId),
        names: r.thanks.slice(0, 3).map((t) => names.get(t.userId)).filter((x): x is string => Boolean(x)),
      },
      canThank: !mine && !r.recipients.some((x) => x.employee.id === access.employee?.id),
      canRemove: (mine && Date.now() - r.createdAt.getTime() < UNDO_HOURS * 3_600_000) || holds(access, 'kudos.manage'),
    };
  }
}
