import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import type { CheckAnswersDto, StartCheckDto } from './dto';

const MANAGE = 'asset.manage';
const PERSON = { id: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } } as const;

/**
 * Returns & the yearly check:
 *  - people leaving (on notice / left) who still hold assets, and loans due back;
 *  - the once-a-year "do you still have it?" check — everyone with assets
 *    answers per asset (have it / problem / not with me); IT sees progress.
 * IT runs checks; HR can look.
 */
/** Problems listed on the check card before "See all" */
const REPORTS_SHOWN = 10;

@Injectable()
export class AssetChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private sees(access: AccessContext) {
    return holds(access, MANAGE) || access.grants.has('asset.approve_hr') || (access.grants.has('asset.view') && access.grants.get('asset.view') === 'company');
  }

  /** Leavers with assets to collect, and loans due back soon or overdue. */
  async returns(companyId: string, access: AccessContext) {
    if (!this.sees(access)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const today = await this.todayKey(companyId);
    const [leavers, loans] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId, employmentStatus: { in: [EmploymentStatus.NOTICE_PERIOD, EmploymentStatus.TERMINATED] }, assetAssignments: { some: { returnedAt: null } } },
        select: { ...PERSON, employmentStatus: true, terminationDate: true, assetAssignments: { where: { returnedAt: null }, select: { id: true, asset: { select: { id: true, tag: true, name: true, type: { select: { name: true, icon: true } } } } } } },
        orderBy: { terminationDate: { sort: 'asc', nulls: 'last' } },
      }),
      this.prisma.assetAssignment.findMany({
        where: { companyId, returnedAt: null, dueBack: { lte: dateFromKey(addDays(today, 14)) } },
        select: { id: true, dueBack: true, employee: { select: PERSON }, asset: { select: { id: true, tag: true, name: true, type: { select: { name: true, icon: true } } } } },
        orderBy: { dueBack: 'asc' },
      }),
    ]);
    return {
      today,
      leavers: leavers.map(({ assetAssignments, terminationDate, ...e }) => ({ employee: { ...e, terminationDate: terminationDate ? keyFromDate(terminationDate) : null }, assets: assetAssignments })),
      loans: loans.map((l) => ({ ...l, dueBack: keyFromDate(l.dueBack!), overdue: keyFromDate(l.dueBack!) < today })),
    };
  }

  // ─── Yearly check ──────────────────────────────────────────

  async start(companyId: string, access: AccessContext, dto: StartCheckDto) {
    if (!holds(access, MANAGE)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const today = await this.todayKey(companyId);
    if (dto.dueOn < today) throw new BadRequestException('The due date can’t be in the past');
    if (await this.prisma.assetCheck.count({ where: { companyId, closedAt: null } })) throw new ConflictException('A check is already running — close it first');
    const c = await this.prisma.assetCheck.create({ data: { companyId, name: dto.name, dueOn: dateFromKey(dto.dueOn), startedById: access.userId }, select: { id: true } });
    const holders = await this.holderUsers(companyId);
    void this.notifications.notify({
      companyId,
      userIds: holders,
      type: 'asset.check',
      title: `${dto.name}: confirm you still have your things`,
      body: `Takes a few seconds — please answer by ${dto.dueOn}.`,
      link: '/app/assets/mine',
      actionLabel: 'Confirm',
      email: false,
      dedupeKey: `asset-check:${c.id}`,
    });
    return this.overview(companyId, access);
  }

  /** IT / HR: the running check and past ones. */
  /** Every problem reported in a check, newest first, a page at a time. */
  async reports(companyId: string, access: AccessContext, checkId: string, q: { page?: number; limit?: number }) {
    if (!this.sees(access)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const check = await this.prisma.assetCheck.findFirst({ where: { id: checkId, companyId }, select: { id: true } });
    if (!check) throw new NotFoundException('Check not found');
    return this.problemPage(check.id, q.page ?? 1, q.limit ?? 25);
  }

  private async problemPage(checkId: string, page: number, limit: number) {
    const where = { checkId, answer: { not: 'HAVE' as const } };
    const [total, rows] = await Promise.all([
      this.prisma.assetCheckAnswer.count({ where }),
      this.prisma.assetCheckAnswer.findMany({ where, orderBy: [{ answeredAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit, select: { employeeId: true, answer: true, note: true, answeredAt: true, assetId: true } }),
    ]);
    const [who, assets] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: rows.map((i) => i.employeeId) } }, select: PERSON }),
      this.prisma.asset.findMany({ where: { id: { in: rows.map((i) => i.assetId) } }, select: { id: true, tag: true, name: true } }),
    ]);
    const person = new Map(who.map((w) => [w.id, w]));
    const asset = new Map(assets.map((a) => [a.id, a]));
    return {
      rows: rows.map((i) => ({ answer: i.answer, note: i.note, answeredAt: i.answeredAt, employee: person.get(i.employeeId) ?? null, asset: asset.get(i.assetId) ?? null })),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async overview(companyId: string, access: AccessContext) {
    if (!this.sees(access)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const checks = await this.prisma.assetCheck.findMany({ where: { companyId }, orderBy: { startedAt: 'desc' }, take: 5, select: { id: true, name: true, dueOn: true, startedAt: true, closedAt: true } });
    const open = checks.find((c) => !c.closedAt) ?? null;
    let progress = null;
    if (open) {
      const [assignments, answers] = await Promise.all([
        this.prisma.assetAssignment.findMany({ where: { companyId, returnedAt: null, assignedAt: { lte: open.startedAt } }, select: { id: true, employeeId: true } }),
        this.prisma.assetCheckAnswer.findMany({ where: { checkId: open.id }, select: { assignmentId: true, employeeId: true, answer: true, note: true, answeredAt: true, assetId: true } }),
      ]);
      const people = new Map<string, { total: number; answered: number; issues: number }>();
      const answered = new Map(answers.map((a) => [a.assignmentId, a]));
      for (const a of assignments) {
        const p = people.get(a.employeeId) ?? { total: 0, answered: 0, issues: 0 };
        p.total++;
        const ans = answered.get(a.id);
        if (ans) {
          p.answered++;
          if (ans.answer !== 'HAVE') p.issues++;
        }
        people.set(a.employeeId, p);
      }
      const all = [...people.values()];
      const issues = answers.filter((a) => a.answer !== 'HAVE');
      progress = {
        people: all.length,
        done: all.filter((p) => p.answered === p.total && !p.issues).length,
        reported: all.filter((p) => p.issues).length,
        notAnswered: all.filter((p) => p.answered < p.total).length,
        // The newest few problems; reports() pages through all of them
        reports: (await this.problemPage(open.id, 1, REPORTS_SHOWN)).rows,
        reportsTotal: issues.length,
      };
    }
    return {
      open: open ? { ...open, dueOn: keyFromDate(open.dueOn) } : null,
      progress,
      past: checks.filter((c) => c.closedAt).map((c) => ({ ...c, dueOn: keyFromDate(c.dueOn) })),
      canRun: holds(access, MANAGE),
    };
  }

  /** Mine: the running check and my assets to answer for. */
  async mine(companyId: string, access: AccessContext) {
    if (!access.employee) return null;
    const open = await this.prisma.assetCheck.findFirst({ where: { companyId, closedAt: null }, select: { id: true, name: true, dueOn: true, startedAt: true } });
    if (!open) return null;
    const [assignments, answers] = await Promise.all([
      this.prisma.assetAssignment.findMany({ where: { companyId, employeeId: access.employee.id, returnedAt: null, assignedAt: { lte: open.startedAt } }, select: { id: true, asset: { select: { id: true, tag: true, name: true, type: { select: { icon: true } } } } } }),
      this.prisma.assetCheckAnswer.findMany({ where: { checkId: open.id, employeeId: access.employee.id }, select: { assignmentId: true, answer: true, note: true } }),
    ]);
    if (!assignments.length) return null;
    const by = new Map(answers.map((a) => [a.assignmentId, a]));
    return {
      id: open.id,
      name: open.name,
      dueOn: keyFromDate(open.dueOn),
      items: assignments.map((a) => ({ assignmentId: a.id, asset: a.asset, answer: by.get(a.id)?.answer ?? null, note: by.get(a.id)?.note ?? null })),
      done: assignments.every((a) => by.has(a.id)),
    };
  }

  async answer(companyId: string, access: AccessContext, dto: CheckAnswersDto) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    const open = await this.prisma.assetCheck.findFirst({ where: { companyId, closedAt: null }, select: { id: true } });
    if (!open) throw new BadRequestException('There’s no check running');
    const mine = await this.prisma.assetAssignment.findMany({ where: { companyId, employeeId: access.employee.id, returnedAt: null, id: { in: dto.answers.map((a) => a.assignmentId) } }, select: { id: true, assetId: true } });
    if (mine.length !== new Set(dto.answers.map((a) => a.assignmentId)).size) throw new NotFoundException('Some of those assets aren’t with you');
    for (const a of dto.answers) {
      if (a.answer !== 'HAVE' && !a.note) throw new BadRequestException('Say what’s wrong (or where it is)');
      const assetId = mine.find((m) => m.id === a.assignmentId)!.assetId;
      await this.prisma.assetCheckAnswer.upsert({
        where: { checkId_assignmentId: { checkId: open.id, assignmentId: a.assignmentId } },
        create: { checkId: open.id, assignmentId: a.assignmentId, assetId, employeeId: access.employee.id, answer: a.answer, note: a.note ?? null },
        update: { answer: a.answer, note: a.note ?? null, answeredAt: new Date() },
      });
    }
    const issues = dto.answers.filter((a) => a.answer !== 'HAVE');
    if (issues.length) {
      const it = await this.notifications.companyWideApprovers(companyId, MANAGE);
      const me = await this.prisma.employee.findUnique({ where: { id: access.employee.id }, select: { firstName: true, lastName: true } });
      void this.notifications.notify({ companyId, userIds: it.filter((u) => u !== access.userId), type: 'asset.check_issue', title: `${me?.firstName} ${me?.lastName} reported ${issues.length} problem${issues.length === 1 ? '' : 's'} in the yearly check`, body: issues.map((i) => i.note).join(' · '), link: '/app/assets?tab=checks', email: false });
    }
    return this.mine(companyId, access);
  }

  async remind(companyId: string, access: AccessContext, id: string) {
    if (!holds(access, MANAGE)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const c = await this.prisma.assetCheck.findFirst({ where: { id, companyId, closedAt: null }, select: { id: true, name: true, dueOn: true, startedAt: true } });
    if (!c) throw new NotFoundException('Check not found');
    const [assignments, answers] = await Promise.all([
      this.prisma.assetAssignment.findMany({ where: { companyId, returnedAt: null, assignedAt: { lte: c.startedAt } }, select: { id: true, employee: { select: { userId: true } } } }),
      this.prisma.assetCheckAnswer.findMany({ where: { checkId: id }, select: { assignmentId: true } }),
    ]);
    const done = new Set(answers.map((a) => a.assignmentId));
    const users = [...new Set(assignments.filter((a) => !done.has(a.id)).map((a) => a.employee.userId))];
    const today = await this.todayKey(companyId);
    const sent = await this.notifications.notify({ companyId, userIds: users, type: 'asset.check', title: `Reminder — ${c.name}`, body: `Please confirm your things by ${keyFromDate(c.dueOn)}.`, link: '/app/assets/mine', actionLabel: 'Confirm', email: false, dedupeKey: `asset-check-remind:${id}:${today}` });
    return { reminded: sent };
  }

  async close(companyId: string, access: AccessContext, id: string) {
    if (!holds(access, MANAGE)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const { count } = await this.prisma.assetCheck.updateMany({ where: { id, companyId, closedAt: null }, data: { closedAt: new Date() } });
    if (!count) throw new NotFoundException('Check not found');
    return this.overview(companyId, access);
  }

  private async holderUsers(companyId: string) {
    const rows = await this.prisma.assetAssignment.findMany({ where: { companyId, returnedAt: null }, select: { employee: { select: { userId: true } } }, distinct: ['employeeId'] });
    return rows.map((r) => r.employee.userId);
  }

  private async todayKey(companyId: string) {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }
}
