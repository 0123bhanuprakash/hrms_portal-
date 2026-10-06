import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketPriority, TicketQueue, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HelpdeskTeamsService } from './teams.service';
import { QUEUE_LABEL } from './sla';
import type { ReorderCategoriesDto, SaveCategoryDto, TopicQuestionDto } from './dto';

type Default = [TicketQueue, string, string, string];
const DEFAULTS: Default[] = [
  ['IT', 'Laptop / hardware', '💻', 'Laptop, screen, keyboard, battery'],
  ['IT', 'Software & installs', '🧩', 'New software, licences, updates'],
  ['IT', 'Access & passwords', '🔑', 'Locked out, password reset, access to a tool'],
  ['IT', 'Email & accounts', '✉️', 'Outlook, mailbox, distribution lists'],
  ['IT', 'Network / VPN', '📶', 'Wi-Fi, VPN, slow internet'],
  ['IT', 'Other', '❓', ''],
  ['HR', 'Leave & attendance', '🌴', 'Leave balance, attendance corrections'],
  ['HR', 'Letters & documents', '📄', 'Address proof, experience letter, salary certificate'],
  ['HR', 'Policies', '📘', 'Questions about a company policy'],
  ['HR', 'Benefits & insurance', '🩺', 'Health insurance, benefits'],
  ['HR', 'Profile changes', '🪪', 'Name, address, bank or family details'],
  ['HR', 'Other', '❓', ''],
  ['FINANCE', 'Salary & payslip', '💸', 'Payslip, salary credit, deductions'],
  ['FINANCE', 'Reimbursements', '🧾', 'Claims not paid, wrong amount'],
  ['FINANCE', 'Tax & investment proofs', '🧮', 'Form 16, TDS, proofs'],
  ['FINANCE', 'Other', '❓', ''],
  ['DEVOPS', 'Cloud access', '☁️', 'Access to cloud consoles and accounts'],
  ['DEVOPS', 'Deployments & releases', '🚀', 'Release help, failed deploys'],
  ['DEVOPS', 'Repo & CI/CD access', '🔑', 'Git repos, pipelines, secrets'],
  ['DEVOPS', 'Servers & databases', '🖥️', 'Servers, databases, environments'],
  ['DEVOPS', 'Other', '❓', ''],
];

const SELECT = {
  id: true,
  queue: true,
  name: true,
  isActive: true,
  sortOrder: true,
  icon: true,
  description: true,
  defaultPriority: true,
  routeToId: true,
  questions: true,
  quickAnswer: true,
  helpedCount: true,
} satisfies Prisma.TicketCategorySelect;
type Row = Prisma.TicketCategoryGetPayload<{ select: typeof SELECT }>;

export interface TopicQuestion {
  id: string;
  label: string;
  kind: 'text' | 'choice' | 'device';
  options?: string[];
  required: boolean;
}
export interface TicketAnswer {
  label: string;
  answer: string;
}

const questionsOf = (r: Pick<Row, 'questions'>): TopicQuestion[] => (Array.isArray(r.questions) ? (r.questions as unknown as TopicQuestion[]) : []);

/**
 * Topics per queue. A topic can start tickets at a priority, send them
 * straight to one person, ask its own questions and offer a quick answer
 * (shown while the employee types). Defaults are created the first time a
 * company opens the helpdesk, and a queue added later gets its own.
 */
@Injectable()
export class TicketCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: HelpdeskTeamsService,
  ) {}

  /** Employees: active topics. Agents (`withStats`): all of them, with use counts and who gets them. */
  async list(companyId: string, includeInactive: boolean, queue?: TicketQueue, withStats = false) {
    await this.ensureDefaults(companyId);
    const rows = await this.prisma.ticketCategory.findMany({
      where: { companyId, ...(queue && { queue }), ...(!includeInactive && { isActive: true }) },
      select: SELECT,
      orderBy: [{ queue: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    const routeIds = [...new Set(rows.map((r) => r.routeToId).filter((x): x is string => Boolean(x)))];
    const [people, used] = await Promise.all([
      routeIds.length ? this.prisma.user.findMany({ where: { id: { in: routeIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
      withStats
        ? this.prisma.ticket.groupBy({ by: ['categoryId'], where: { companyId, categoryId: { in: rows.map((r) => r.id) }, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: { _all: true } })
        : [],
    ]);
    const who = new Map(people.map((p) => [p.id, p]));
    const usedBy = new Map(used.map((u) => [u.categoryId, u._count._all]));
    return rows.map((r) => ({
      ...r,
      questions: questionsOf(r),
      routeTo: r.routeToId ? (who.get(r.routeToId) ?? null) : null,
      ...(withStats ? { used30: usedBy.get(r.id) ?? 0 } : { helpedCount: undefined }),
    }));
  }

  async get(companyId: string, id: string) {
    const c = await this.prisma.ticketCategory.findFirst({ where: { id, companyId }, select: SELECT });
    if (!c) throw new NotFoundException('Category not found');
    return { ...c, questions: questionsOf(c) };
  }

  async save(companyId: string, id: string | null, dto: SaveCategoryDto) {
    if (dto.routeToId) {
      const members = await this.teams.memberIds(companyId, dto.queue);
      if (!members.includes(dto.routeToId)) throw new BadRequestException(`That person doesn’t work the ${QUEUE_LABEL[dto.queue]} queue`);
    }
    if (dto.questions) this.checkQuestions(dto.questions);
    const data = {
      queue: dto.queue,
      name: dto.name,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.defaultPriority !== undefined && { defaultPriority: dto.defaultPriority }),
      ...(dto.routeToId !== undefined && { routeToId: dto.routeToId }),
      ...(dto.questions !== undefined && { questions: dto.questions.map((q) => ({ id: q.id, label: q.label, kind: q.kind, ...(q.kind === 'choice' && { options: q.options }), required: q.required })) as unknown as Prisma.InputJsonArray }),
      ...(dto.quickAnswer !== undefined && { quickAnswer: dto.quickAnswer }),
    };
    try {
      if (!id) {
        const last = await this.prisma.ticketCategory.findFirst({ where: { companyId, queue: dto.queue, name: { not: 'Other' } }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
        return this.get(companyId, (await this.prisma.ticketCategory.create({ data: { companyId, ...data, sortOrder: dto.sortOrder ?? (last?.sortOrder ?? 0) + 10 }, select: { id: true } })).id);
      }
      const current = await this.get(companyId, id);
      // Moving a topic to another team: its person no longer fits
      const moved = current.queue !== dto.queue && dto.routeToId === undefined ? { routeToId: null } : {};
      await this.prisma.ticketCategory.update({ where: { id }, data: { ...data, ...moved } });
      return this.get(companyId, id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException(`"${dto.name}" already exists in this queue`);
      throw e;
    }
  }

  /** Drag to reorder: the order employees see. */
  async reorder(companyId: string, dto: ReorderCategoriesDto) {
    const rows = await this.prisma.ticketCategory.findMany({ where: { companyId, queue: dto.queue }, select: { id: true } });
    const known = new Set(rows.map((r) => r.id));
    if (dto.ids.some((id) => !known.has(id)) || dto.ids.length !== rows.length) throw new BadRequestException('Send every topic of this team once');
    await this.prisma.$transaction(dto.ids.map((id, i) => this.prisma.ticketCategory.update({ where: { id }, data: { sortOrder: (i + 1) * 10 } })));
    return this.list(companyId, true, dto.queue, true);
  }

  /** "That helped" on a quick answer. */
  async helped(companyId: string, id: string) {
    const { count } = await this.prisma.ticketCategory.updateMany({ where: { id, companyId, isActive: true, quickAnswer: { not: null } }, data: { helpedCount: { increment: 1 } } });
    if (!count) throw new NotFoundException('Category not found');
    return { ok: true };
  }

  /**
   * While an employee types: topics whose quick answer matches, plus their own
   * solved tickets with a similar subject (titles only — never anyone else's).
   */
  async answers(companyId: string, employeeId: string | null, q: string) {
    const words = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3).slice(0, 6);
    if (!words.length) return { topics: [], tickets: [] };
    const any = (field: 'name' | 'description' | 'quickAnswer') => words.map((w) => ({ [field]: { contains: w, mode: 'insensitive' as const } }));
    const [topics, tickets] = await Promise.all([
      this.prisma.ticketCategory.findMany({
        where: { companyId, isActive: true, quickAnswer: { not: null }, OR: [...any('name'), ...any('description'), ...any('quickAnswer')] },
        select: { id: true, queue: true, name: true, icon: true, quickAnswer: true, description: true },
        take: 20,
      }),
      employeeId
        ? this.prisma.ticket.findMany({
            where: { companyId, employeeId, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] }, OR: words.map((w) => ({ subject: { contains: w, mode: 'insensitive' as const } })) },
            select: { id: true, number: true, queue: true, subject: true, resolvedAt: true },
            orderBy: { resolvedAt: 'desc' },
            take: 2,
          })
        : [],
    ]);
    // Best match first: how many of the words each topic contains
    const score = (t: (typeof topics)[number]) => {
      const text = `${t.name} ${t.description ?? ''} ${t.quickAnswer ?? ''}`.toLowerCase();
      return words.filter((w) => text.includes(w)).length + (words.some((w) => t.name.toLowerCase().includes(w)) ? 1 : 0);
    };
    return { topics: topics.sort((a, b) => score(b) - score(a)).slice(0, 3), tickets };
  }

  /**
   * Checks the answers sent with a new ticket against the topic's questions.
   * Returns them as asked (label + answer) and the device picked, if any.
   */
  async readAnswers(companyId: string, topic: { questions: TopicQuestion[] } | null, raw: string | undefined, employeeId: string): Promise<{ answers: TicketAnswer[] | null; assetId: string | null }> {
    const questions = topic?.questions ?? [];
    if (!questions.length) return { answers: null, assetId: null };
    let given: Record<string, unknown> = {};
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) given = parsed as Record<string, unknown>;
        else throw new Error();
      } catch {
        throw new BadRequestException('Answers must be a JSON object');
      }
    }
    const answers: TicketAnswer[] = [];
    let assetId: string | null = null;
    for (const q of questions) {
      const v = typeof given[q.id] === 'string' ? (given[q.id] as string).trim().slice(0, 500) : '';
      if (!v) {
        if (q.required) throw new BadRequestException(`Please answer: ${q.label}`);
        continue;
      }
      if (q.kind === 'choice' && !(q.options ?? []).includes(v)) throw new BadRequestException(`Pick one of the options for: ${q.label}`);
      if (q.kind === 'device') {
        const held = await this.prisma.assetAssignment.findFirst({
          where: { companyId, employeeId, assetId: v, returnedAt: null },
          select: { asset: { select: { id: true, tag: true, name: true } } },
        });
        if (!held) throw new BadRequestException(`Pick one of your devices for: ${q.label}`);
        assetId = held.asset.id;
        answers.push({ label: q.label, answer: `${held.asset.tag} · ${held.asset.name}` });
        continue;
      }
      answers.push({ label: q.label, answer: v });
    }
    return { answers: answers.length ? answers : null, assetId };
  }

  /** Who a new ticket on this topic goes to (still in the queue, not the requester). */
  async routeFor(companyId: string, topic: { queue: TicketQueue; routeToId: string | null } | null, requesterId: string): Promise<string | null> {
    if (!topic?.routeToId || topic.routeToId === requesterId) return null;
    const members = await this.teams.memberIds(companyId, topic.queue);
    return members.includes(topic.routeToId) ? topic.routeToId : null;
  }

  /** Starting priority: what the employee chose, else the topic's, else Medium. */
  static priorityFor(chosen: TicketPriority | undefined, topic: { defaultPriority: TicketPriority | null } | null): TicketPriority {
    return chosen ?? topic?.defaultPriority ?? TicketPriority.MEDIUM;
  }

  private checkQuestions(qs: TopicQuestionDto[]) {
    const ids = new Set<string>();
    for (const q of qs) {
      if (ids.has(q.id)) throw new BadRequestException('Two questions have the same id');
      ids.add(q.id);
    }
    if (qs.filter((q) => q.kind === 'device').length > 1) throw new BadRequestException('Ask for a device only once');
  }

  /** Companies whose default topics already got icons this run */
  private readonly filled = new Set<string>();

  private async ensureDefaults(companyId: string) {
    if (!this.filled.has(companyId)) {
      this.filled.add(companyId);
      // Topics created before icons existed: give the default ones theirs (never overwrites a choice)
      for (const [queue, name, icon, description] of DEFAULTS) {
        await this.prisma.ticketCategory.updateMany({ where: { companyId, queue, name, icon: null }, data: { icon, ...(description && { description }) } });
      }
    }
    // Per queue, so a team added later (DevOps) gets its starter topics too
    const have = new Set((await this.prisma.ticketCategory.groupBy({ by: ['queue'], where: { companyId } })).map((g) => g.queue));
    const missing = DEFAULTS.filter(([queue]) => !have.has(queue));
    if (!missing.length) return;
    await this.prisma.ticketCategory.createMany({
      data: missing.map(([queue, name, icon, description], i) => ({ companyId, queue, name, icon, description: description || null, sortOrder: name === 'Other' ? 90 : (i + 1) * 10 })),
      skipDuplicates: true,
    });
  }
}

