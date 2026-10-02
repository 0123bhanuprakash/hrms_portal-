import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ExpenseClaimStatus, ExpenseStage, LeaveApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { ApprovalRouterService } from '../projects/approval-router.service';
import { PrivateFilesService } from '../employee-profile/private-files.service';
import { detectFileType, DOCUMENT_TYPES } from '../employee-profile/file-types';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import { ExpenseCategoriesService, toPaise } from './categories.service';
import type { ClaimQueryDto, DecideClaimDto, PayClaimDto, RejectClaimDto, ReportQueryDto, SaveClaimDto, SaveItemDto } from './dto';

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
/** Items older than this can't be claimed */
const MAX_AGE_DAYS = 90;
const MAX_ITEMS = 50;
const FINANCE = 'expense.finance';
const HR = 'expense.hr';

const PERSON = { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } }, department: { select: { name: true } } } satisfies Prisma.EmployeeSelect;
const SELECT = {
  id: true,
  title: true,
  status: true,
  round: true,
  projectId: true,
  submittedAt: true,
  approvedAt: true,
  rejectionReason: true,
  paidAt: true,
  paymentDate: true,
  paymentReference: true,
  createdAt: true,
  updatedAt: true,
  employee: { select: PERSON },
  items: {
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      date: true,
      description: true,
      amountPaise: true,
      approvedPaise: true,
      adjustReason: true,
      receiptName: true,
      receiptMime: true,
      receiptSize: true,
      category: { select: { id: true, name: true } },
    },
  },
  approvals: { select: { id: true, round: true, stage: true, approverIds: true, label: true, status: true, actedById: true, onBehalfOfId: true, comments: true, actedAt: true } },
} satisfies Prisma.ExpenseClaimSelect;
type ClaimRow = Prisma.ExpenseClaimGetPayload<{ select: typeof SELECT }>;
type ApprovalRow = ClaimRow['approvals'][number];

/**
 * Expense claims. Flow per submission ("round"):
 *   manager step (project team lead / PM / line manager — any one) →
 *   Finance and HR in parallel (both needed; either may lower item amounts) →
 *   APPROVED → Finance marks PAID.
 * Rejection at any step sends the claim back; the employee fixes and resubmits.
 */
@Injectable()
export class ExpenseClaimsService {
  private readonly logger = new Logger(ExpenseClaimsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly router: ApprovalRouterService,
    private readonly files: PrivateFilesService,
    private readonly categories: ExpenseCategoriesService,
  ) {}

  // ─── Drafting ──────────────────────────────────────────────

  async create(companyId: string, access: AccessContext, dto: SaveClaimDto) {
    const employeeId = this.myEmployee(access);
    await this.assertProject(companyId, dto.projectId);
    const c = await this.prisma.expenseClaim.create({ data: { companyId, employeeId, title: dto.title, projectId: dto.projectId ?? null }, select: { id: true } });
    return this.get(companyId, access, c.id);
  }

  async update(companyId: string, access: AccessContext, id: string, dto: SaveClaimDto) {
    await this.editable(companyId, access, id);
    await this.assertProject(companyId, dto.projectId);
    await this.prisma.expenseClaim.update({ where: { id }, data: { title: dto.title, projectId: dto.projectId ?? null } });
    return this.get(companyId, access, id);
  }

  async addItem(companyId: string, access: AccessContext, claimId: string, dto: SaveItemDto, file?: Express.Multer.File) {
    await this.editable(companyId, access, claimId);
    if ((await this.prisma.expenseItem.count({ where: { claimId } })) >= MAX_ITEMS) throw new BadRequestException(`A claim can have at most ${MAX_ITEMS} items`);
    await this.checkItem(companyId, dto);
    const receipt = file ? await this.storeReceipt(companyId, claimId, file) : null;
    await this.prisma.expenseItem.create({
      data: { claimId, categoryId: dto.categoryId, date: dateFromKey(dto.date), description: dto.description, amountPaise: toPaise(dto.amount), ...(receipt ?? {}) },
    });
    return this.get(companyId, access, claimId);
  }

  async updateItem(companyId: string, access: AccessContext, claimId: string, itemId: string, dto: SaveItemDto, file?: Express.Multer.File) {
    await this.editable(companyId, access, claimId);
    const item = await this.prisma.expenseItem.findFirst({ where: { id: itemId, claimId }, select: { receiptKey: true } });
    if (!item) throw new NotFoundException('Item not found');
    await this.checkItem(companyId, dto);
    const receipt = file ? await this.storeReceipt(companyId, claimId, file) : null;
    const dropOld = Boolean(receipt) || dto.removeReceipt;
    await this.prisma.expenseItem.update({
      where: { id: itemId },
      data: {
        categoryId: dto.categoryId,
        date: dateFromKey(dto.date),
        description: dto.description,
        amountPaise: toPaise(dto.amount),
        ...(receipt ?? (dto.removeReceipt ? { receiptKey: null, receiptName: null, receiptMime: null, receiptSize: null } : {})),
      },
    });
    if (dropOld && item.receiptKey) await this.files.remove(item.receiptKey).catch(() => undefined);
    return this.get(companyId, access, claimId);
  }

  async removeItem(companyId: string, access: AccessContext, claimId: string, itemId: string) {
    await this.editable(companyId, access, claimId);
    const item = await this.prisma.expenseItem.findFirst({ where: { id: itemId, claimId }, select: { receiptKey: true } });
    if (!item) throw new NotFoundException('Item not found');
    await this.prisma.expenseItem.delete({ where: { id: itemId } });
    if (item.receiptKey) await this.files.remove(item.receiptKey).catch(() => undefined);
    return this.get(companyId, access, claimId);
  }

  async openReceipt(companyId: string, access: AccessContext, claimId: string, itemId: string) {
    await this.visibleRow(companyId, access, claimId);
    const item = await this.prisma.expenseItem.findFirst({ where: { id: itemId, claimId }, select: { receiptKey: true, receiptName: true, receiptMime: true, receiptSize: true } });
    if (!item?.receiptKey) throw new NotFoundException('No receipt');
    const stream = await this.files.open(item.receiptKey).catch(() => {
      throw new NotFoundException('The file is no longer available');
    });
    return { stream, name: item.receiptName!, mime: item.receiptMime!, size: item.receiptSize! };
  }

  // ─── Submit / decide / pay ─────────────────────────────────

  async submit(companyId: string, access: AccessContext, id: string) {
    const claim = await this.editable(companyId, access, id);
    const items = await this.prisma.expenseItem.findMany({ where: { claimId: id }, select: { categoryId: true, date: true, amountPaise: true, receiptKey: true, description: true } });
    if (!items.length) throw new BadRequestException('Add at least one item');
    const cats = new Map((await this.categories.list(companyId, true)).map((c) => [c.id, c]));
    for (const it of items) {
      const c = cats.get(it.categoryId)!;
      if (!c.isActive) throw new BadRequestException(`"${c.name}" can no longer be claimed — change the category of "${it.description}"`);
      if (c.receiptRequiredAbovePaise !== null && it.amountPaise > c.receiptRequiredAbovePaise && !it.receiptKey) {
        throw new BadRequestException(`"${it.description}" needs a receipt`);
      }
    }
    const dates = items.map((i) => keyFromDate(i.date)).sort();
    const route = await this.router.route(companyId, claim.employeeId, dates[0]!, dates[dates.length - 1]!, 1);
    const pool = route.levels[0]?.approverIds ?? [];
    const round = claim.round + 1;

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.expenseClaim.updateMany({
        where: { id, status: { in: [ExpenseClaimStatus.DRAFT, ExpenseClaimStatus.REJECTED] } },
        data: { status: ExpenseClaimStatus.PENDING, round, submittedAt: new Date(), rejectionReason: null, approvedAt: null },
      });
      if (!count) throw new ConflictException('This claim has changed — refresh and try again');
      // A fresh round: earlier reductions no longer apply
      await tx.expenseItem.updateMany({ where: { claimId: id }, data: { approvedPaise: null, adjustReason: null, adjustedById: null } });
      await tx.expenseApproval.createMany({
        data: [
          { claimId: id, round, stage: ExpenseStage.MANAGER, approverIds: pool, label: route.levels[0]?.label ?? null, status: pool.length ? LeaveApprovalStatus.PENDING : LeaveApprovalStatus.SKIPPED },
          { claimId: id, round, stage: ExpenseStage.FINANCE, label: 'Finance' },
          { claimId: id, round, stage: ExpenseStage.HR, label: 'HR' },
        ],
      });
    });
    void this.notifyNext(companyId, id);
    return this.get(companyId, access, id, true);
  }

  async approve(companyId: string, access: AccessContext, id: string, dto: DecideClaimDto) {
    const { claim, step, onBehalfOf } = await this.decidable(companyId, access, id);
    if (dto.adjustments?.length && step.stage === ExpenseStage.MANAGER) throw new BadRequestException('Only Finance and HR can change amounts');
    const items = new Map(claim.items.map((i) => [i.id, i]));
    for (const a of dto.adjustments ?? []) {
      const it = items.get(a.itemId);
      if (!it) throw new NotFoundException('Item not found');
      if (toPaise(a.approvedAmount) > it.amountPaise) throw new BadRequestException(`You can only lower an amount (“${it.description}” claims ₹${(it.amountPaise / 100).toFixed(2)})`);
    }

    const done = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.expenseApproval.updateMany({
        where: { id: step.id, status: LeaveApprovalStatus.PENDING },
        data: { status: LeaveApprovalStatus.APPROVED, actedById: access.userId, onBehalfOfId: onBehalfOf, comments: dto.note ?? null, actedAt: new Date() },
      });
      if (!count) throw new ConflictException('This step has already been decided');
      for (const a of dto.adjustments ?? []) {
        const it = items.get(a.itemId)!;
        // The lower decision wins — a higher one changes nothing (and keeps the other step's reason)
        if (toPaise(a.approvedAmount) >= (it.approvedPaise ?? it.amountPaise)) continue;
        await tx.expenseItem.update({ where: { id: a.itemId }, data: { approvedPaise: toPaise(a.approvedAmount), adjustReason: a.reason, adjustedById: access.userId } });
      }
      const rows = await tx.expenseApproval.findMany({ where: { claimId: id, round: claim.round }, select: { stage: true, status: true } });
      const ok = (s: ExpenseStage) => rows.some((r) => r.stage === s && r.status === LeaveApprovalStatus.APPROVED);
      if (ok(ExpenseStage.FINANCE) && ok(ExpenseStage.HR)) {
        await tx.expenseClaim.update({ where: { id }, data: { status: ExpenseClaimStatus.APPROVED, approvedAt: new Date() } });
        return true;
      }
      return false;
    });

    if (done) {
      const row = await this.get(companyId, access, id, true);
      void this.notifications.notify({
        companyId,
        userIds: [claim.employee.userId],
        type: 'expense.approved',
        title: `Your expense claim “${claim.title}” was approved`,
        body: `₹${(row.totals.approvedPaise / 100).toFixed(2)} will be reimbursed${row.totals.approvedPaise < row.totals.claimedPaise ? ` (claimed ₹${(row.totals.claimedPaise / 100).toFixed(2)})` : ''}.`,
        link: `/app/expenses/${id}`,
        actionLabel: 'View claim',
      });
      const finance = (await this.notifications.companyWideApprovers(companyId, FINANCE)).filter((u) => u !== claim.employee.userId);
      void this.notifications.notify({ companyId, userIds: finance, type: 'expense.payable', title: `Ready to pay: ${claim.employee.firstName} ${claim.employee.lastName} — ${claim.title}`, link: '/app/expenses/payments', email: false });
      return row;
    }
    if (step.stage === ExpenseStage.MANAGER) void this.notifyNext(companyId, id);
    return this.get(companyId, access, id, true);
  }

  async reject(companyId: string, access: AccessContext, id: string, dto: RejectClaimDto) {
    const { claim, step, onBehalfOf } = await this.decidable(companyId, access, id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.expenseApproval.updateMany({
        where: { id: step.id, status: LeaveApprovalStatus.PENDING },
        data: { status: LeaveApprovalStatus.REJECTED, actedById: access.userId, onBehalfOfId: onBehalfOf, comments: dto.reason, actedAt: new Date() },
      });
      if (!count) throw new ConflictException('This step has already been decided');
      await tx.expenseApproval.updateMany({ where: { claimId: id, round: claim.round, status: LeaveApprovalStatus.PENDING }, data: { status: LeaveApprovalStatus.SKIPPED } });
      await tx.expenseClaim.update({ where: { id }, data: { status: ExpenseClaimStatus.REJECTED, rejectionReason: dto.reason } });
    });
    void this.notifications.notify({
      companyId,
      userIds: [claim.employee.userId],
      type: 'expense.rejected',
      title: `Your expense claim “${claim.title}” was sent back`,
      body: `${this.stageName(step.stage)}: ${dto.reason}\nFix it and submit again.`,
      link: `/app/expenses/${id}`,
      actionLabel: 'Open claim',
    });
    return this.get(companyId, access, id, true);
  }

  async cancel(companyId: string, access: AccessContext, id: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, companyId }, select: { employeeId: true, status: true, round: true } });
    if (!claim || claim.employeeId !== access.employee?.id) throw new NotFoundException('Claim not found');
    const cancellable: ExpenseClaimStatus[] = [ExpenseClaimStatus.DRAFT, ExpenseClaimStatus.PENDING, ExpenseClaimStatus.REJECTED];
    if (!cancellable.includes(claim.status)) throw new BadRequestException('Approved or paid claims can’t be cancelled');
    await this.prisma.$transaction([
      this.prisma.expenseClaim.update({ where: { id }, data: { status: ExpenseClaimStatus.CANCELLED } }),
      this.prisma.expenseApproval.updateMany({ where: { claimId: id, round: claim.round, status: LeaveApprovalStatus.PENDING }, data: { status: LeaveApprovalStatus.SKIPPED } }),
    ]);
    return this.get(companyId, access, id, true);
  }

  async pay(companyId: string, access: AccessContext, id: string, dto: PayClaimDto) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, companyId }, select: { status: true, title: true, employee: { select: { userId: true } } } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.employee.userId === access.userId) throw new ForbiddenException('You can’t mark your own claim paid');
    if (dto.paymentDate > (await this.todayKey(companyId))) throw new BadRequestException('The payment date can’t be in the future');
    const { count } = await this.prisma.expenseClaim.updateMany({
      where: { id, status: ExpenseClaimStatus.APPROVED },
      data: { status: ExpenseClaimStatus.PAID, paidAt: new Date(), paidById: access.userId, paymentDate: dateFromKey(dto.paymentDate), paymentReference: dto.reference },
    });
    if (!count) throw new ConflictException('Only approved, unpaid claims can be marked paid');
    const row = await this.get(companyId, access, id, true);
    void this.notifications.notify({
      companyId,
      userIds: [claim.employee.userId],
      type: 'expense.paid',
      title: `₹${(row.totals.approvedPaise / 100).toFixed(2)} reimbursed for “${claim.title}”`,
      body: `Paid on ${dto.paymentDate} · reference ${dto.reference}`,
      link: `/app/expenses/${id}`,
      actionLabel: 'View claim',
    });
    return row;
  }

  // ─── Read ──────────────────────────────────────────────────

  async list(companyId: string, access: AccessContext, q: ClaimQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const filters: Prisma.ExpenseClaimWhereInput = {
      companyId,
      ...(q.status && { status: q.status as ExpenseClaimStatus }),
      ...(q.employeeId && { employeeId: q.employeeId }),
      ...(q.projectId && { projectId: q.projectId }),
    };
    let where: Prisma.ExpenseClaimWhereInput;
    if (q.view === 'mine') {
      if (!access.employee) return this.page(companyId, [], 0, page, limit, access);
      where = { ...filters, employeeId: access.employee.id };
    } else if (q.view === 'payable') {
      if (!holds(access, FINANCE)) throw new ForbiddenException('You do not have permission to perform this action. Required: expense.finance');
      where = { ...filters, status: ExpenseClaimStatus.APPROVED };
    } else if (q.view === 'all') {
      const all = holds(access, FINANCE) || holds(access, HR);
      where = { ...filters, NOT: { status: ExpenseClaimStatus.DRAFT }, ...(all ? {} : { employee: this.access.requireEmployeeScope(access, 'expense.view') }) };
    } else {
      // Waiting for me — check each pending claim's current step
      const pending = await this.prisma.expenseClaim.findMany({
        where: { companyId, status: ExpenseClaimStatus.PENDING, employee: { userId: { not: access.userId } } },
        select: SELECT,
        orderBy: { submittedAt: 'asc' },
      });
      const mine = pending.filter((c) => this.stepFor(access, c));
      return this.page(companyId, mine.slice((page - 1) * limit, page * limit), mine.length, page, limit, access);
    }
    const [rows, total] = await Promise.all([
      this.prisma.expenseClaim.findMany({ where, select: SELECT, orderBy: [{ submittedAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.expenseClaim.count({ where }),
    ]);
    return this.page(companyId, rows, total, page, limit, access);
  }

  async pendingCount(companyId: string, access: AccessContext) {
    return (await this.list(companyId, access, { view: 'review', limit: 100 })).meta.total;
  }

  async get(companyId: string, access: AccessContext, id: string, decided = false) {
    const row = decided ? await this.prisma.expenseClaim.findFirst({ where: { id, companyId }, select: SELECT }) : await this.visibleRow(companyId, access, id);
    if (!row) throw new NotFoundException('Claim not found');
    const [presented] = (await this.page(companyId, [row], 1, 1, 1, access)).data;
    // Possible duplicates: same day, category and amount in another claim of this person
    const duplicates = await this.prisma.expenseItem.findMany({
      where: {
        claimId: { not: id },
        claim: { employeeId: row.employee.id, status: { notIn: [ExpenseClaimStatus.CANCELLED] } },
        OR: row.items.map((i) => ({ date: i.date, amountPaise: i.amountPaise, categoryId: i.category.id })),
      },
      select: { date: true, amountPaise: true, categoryId: true, claim: { select: { id: true, title: true } } },
    });
    return {
      ...presented!,
      items: presented!.items.map((i) => {
        const d = duplicates.find((x) => keyFromDate(x.date) === i.date && x.amountPaise === i.amountPaise && x.categoryId === i.category.id);
        return { ...i, possibleDuplicate: d ? { claimId: d.claim.id, title: d.claim.title } : null };
      }),
    };
  }

  /** Spend between two dates (item dates), approved + paid claims. */
  async report(companyId: string, access: AccessContext, q: ReportQueryDto) {
    if (!holds(access, FINANCE) && !holds(access, HR)) throw new ForbiddenException('You do not have permission to perform this action. Required: expense.finance');
    const items = await this.reportItems(companyId, q);
    const sum = <K extends string>(key: (i: (typeof items)[number]) => K, label: (i: (typeof items)[number]) => string) => {
      const m = new Map<K, { key: K; label: string; claimedPaise: number; approvedPaise: number; items: number }>();
      for (const i of items) {
        const k = key(i);
        const e = m.get(k) ?? { key: k, label: label(i), claimedPaise: 0, approvedPaise: 0, items: 0 };
        e.claimedPaise += i.amountPaise;
        e.approvedPaise += i.approvedPaise ?? i.amountPaise;
        e.items++;
        m.set(k, e);
      }
      return [...m.values()].sort((a, b) => b.approvedPaise - a.approvedPaise);
    };
    const projects = new Map((await this.prisma.project.findMany({ where: { companyId }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    return {
      from: q.from,
      to: q.to,
      totals: {
        claimedPaise: items.reduce((s, i) => s + i.amountPaise, 0),
        approvedPaise: items.reduce((s, i) => s + (i.approvedPaise ?? i.amountPaise), 0),
        paidPaise: items.filter((i) => i.claim.status === ExpenseClaimStatus.PAID).reduce((s, i) => s + (i.approvedPaise ?? i.amountPaise), 0),
        items: items.length,
      },
      byCategory: sum((i) => i.category.id, (i) => i.category.name),
      byEmployee: sum((i) => i.claim.employee.id, (i) => `${i.claim.employee.firstName} ${i.claim.employee.lastName}`),
      byProject: sum((i) => i.claim.projectId ?? 'none', (i) => (i.claim.projectId ? (projects.get(i.claim.projectId) ?? 'Project') : 'No project')),
    };
  }

  async exportCsv(companyId: string, access: AccessContext, q: ReportQueryDto): Promise<string> {
    if (!holds(access, FINANCE) && !holds(access, HR)) throw new ForbiddenException('You do not have permission to perform this action. Required: expense.finance');
    const items = await this.reportItems(companyId, q);
    const projects = new Map((await this.prisma.project.findMany({ where: { companyId }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    const cell = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [['Employee ID', 'Name', 'Claim', 'Status', 'Project', 'Date', 'Category', 'Description', 'Claimed (INR)', 'Approved (INR)', 'Reduction reason', 'Paid on', 'Payment ref'].join(',')];
    for (const i of items) {
      lines.push(
        [
          i.claim.employee.employeeId,
          `${i.claim.employee.firstName} ${i.claim.employee.lastName}`,
          i.claim.title,
          i.claim.status,
          i.claim.projectId ? projects.get(i.claim.projectId) ?? '' : '',
          keyFromDate(i.date),
          i.category.name,
          i.description,
          (i.amountPaise / 100).toFixed(2),
          ((i.approvedPaise ?? i.amountPaise) / 100).toFixed(2),
          i.adjustReason ?? '',
          i.claim.paymentDate ? keyFromDate(i.claim.paymentDate) : '',
          i.claim.paymentReference ?? '',
        ]
          .map(cell)
          .join(','),
      );
    }
    return lines.join('\r\n') + '\r\n';
  }

  private reportItems(companyId: string, q: ReportQueryDto) {
    if (q.to < q.from) throw new BadRequestException('"to" is before "from"');
    return this.prisma.expenseItem.findMany({
      where: { date: { gte: dateFromKey(q.from), lte: dateFromKey(q.to) }, claim: { companyId, status: { in: [ExpenseClaimStatus.APPROVED, ExpenseClaimStatus.PAID] } } },
      orderBy: [{ date: 'asc' }],
      select: {
        date: true,
        description: true,
        amountPaise: true,
        approvedPaise: true,
        adjustReason: true,
        category: { select: { id: true, name: true } },
        claim: { select: { title: true, status: true, projectId: true, paymentDate: true, paymentReference: true, employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } } } },
      },
    });
  }

  // ─── Rules ─────────────────────────────────────────────────

  /** The step the caller may decide right now, if any (never their own claim). */
  private stepFor(access: AccessContext, c: ClaimRow): { step: ApprovalRow; onBehalfOf: string | null } | null {
    if (c.status !== ExpenseClaimStatus.PENDING || c.employee.userId === access.userId) return null;
    const rows = c.approvals.filter((a) => a.round === c.round);
    const manager = rows.find((a) => a.stage === ExpenseStage.MANAGER);
    const actedBefore = (stage: ExpenseStage) => rows.some((a) => a.stage !== stage && a.actedById === access.userId);
    if (manager?.status === LeaveApprovalStatus.PENDING) {
      if (actedBefore(ExpenseStage.MANAGER)) return null;
      if (manager.approverIds.includes(access.userId)) return { step: manager, onBehalfOf: null };
      const cover = access.delegations.find((d) => manager.approverIds.includes(d.fromUserId));
      return cover ? { step: manager, onBehalfOf: cover.fromUserId } : null;
    }
    // Finance and HR in parallel; one person never decides two steps of a round
    for (const [stage, perm] of [[ExpenseStage.FINANCE, FINANCE], [ExpenseStage.HR, HR]] as const) {
      const r = rows.find((a) => a.stage === stage);
      if (r?.status === LeaveApprovalStatus.PENDING && access.grants.has(perm) && !actedBefore(stage)) return { step: r, onBehalfOf: null };
    }
    return null;
  }

  private async decidable(companyId: string, access: AccessContext, id: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, companyId }, select: SELECT });
    if (!claim || claim.employee.userId === access.userId) throw new NotFoundException('Claim not found');
    if (claim.status !== ExpenseClaimStatus.PENDING) throw new ConflictException('This claim isn’t waiting for approval');
    const s = this.stepFor(access, claim);
    if (!s) throw new ForbiddenException('This claim is waiting for someone else');
    return { claim, ...s };
  }

  private async editable(companyId: string, access: AccessContext, id: string) {
    const claim = await this.prisma.expenseClaim.findFirst({ where: { id, companyId }, select: { id: true, employeeId: true, status: true, round: true } });
    if (!claim || claim.employeeId !== access.employee?.id) throw new NotFoundException('Claim not found');
    const editableStatuses: ExpenseClaimStatus[] = [ExpenseClaimStatus.DRAFT, ExpenseClaimStatus.REJECTED];
    if (!editableStatuses.includes(claim.status)) throw new BadRequestException('Only draft or sent-back claims can be changed');
    return claim;
  }

  private async checkItem(companyId: string, dto: SaveItemDto) {
    const c = await this.categories.get(companyId, dto.categoryId);
    if (!c.isActive) throw new BadRequestException(`"${c.name}" can no longer be claimed`);
    const paise = toPaise(dto.amount);
    if (c.maxPerItemPaise !== null && paise > c.maxPerItemPaise) throw new BadRequestException(`${c.name} is limited to ₹${(c.maxPerItemPaise / 100).toFixed(2)} per item`);
    const today = await this.todayKey(companyId);
    if (dto.date > today) throw new BadRequestException('The expense date can’t be in the future');
    if (dto.date < addDays(today, -MAX_AGE_DAYS)) throw new BadRequestException(`Expenses older than ${MAX_AGE_DAYS} days can’t be claimed`);
  }

  private async storeReceipt(companyId: string, claimId: string, file: Express.Multer.File) {
    if (file.size > RECEIPT_MAX_BYTES) throw new BadRequestException('Receipt must be 10 MB or smaller');
    const type = detectFileType(file.buffer, file.mimetype);
    if (!type || !DOCUMENT_TYPES.has(type.ext)) throw new BadRequestException('Receipts can be PDF, JPG, PNG, WebP or Word (.docx)');
    const key = `${companyId}/expenses/${claimId}/${randomUUID()}.${type.ext}`;
    await this.files.save(key, file.buffer);
    const base = (file.originalname ?? 'receipt').split(/[\\/]/).pop()!.replace(/\.[^.]*$/, '').replace(/[^\w\- ().]+/g, '').slice(0, 80) || 'receipt';
    return { receiptKey: key, receiptName: `${base}.${type.ext}`, receiptMime: type.mime, receiptSize: file.size };
  }

  private async visibleRow(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.expenseClaim.findFirst({ where: { id, companyId }, select: SELECT });
    if (!row) throw new NotFoundException('Claim not found');
    if (row.employee.userId === access.userId) return row;
    if (row.status === ExpenseClaimStatus.DRAFT) throw new NotFoundException('Claim not found');
    if (holds(access, FINANCE) || holds(access, HR)) return row;
    if (row.approvals.some((a) => a.approverIds.includes(access.userId) || a.actedById === access.userId || access.delegations.some((d) => a.approverIds.includes(d.fromUserId)))) return row;
    const scope = this.access.employeeScope(access, 'expense.view');
    if (scope && (await this.prisma.employee.count({ where: { AND: [{ id: row.employee.id }, scope] } }))) return row;
    throw new NotFoundException('Claim not found');
  }

  private async page(companyId: string, rows: ClaimRow[], total: number, page: number, limit: number, access: AccessContext) {
    const ids = [...new Set(rows.flatMap((r) => r.approvals.flatMap((a) => [...a.approverIds, a.actedById, a.onBehalfOfId].filter((x): x is string => Boolean(x)))))];
    const names = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, u]));
    const projectIds = [...new Set(rows.map((r) => r.projectId).filter((x): x is string => Boolean(x)))];
    const projects = new Map((await this.prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true, code: true } })).map((p) => [p.id, p]));
    const finance = holds(access, FINANCE);
    return {
      data: rows.map((r) => {
        const step = this.stepFor(access, r);
        const steps = r.approvals
          .filter((a) => a.round === r.round)
          .sort((a, b) => ['MANAGER', 'FINANCE', 'HR'].indexOf(a.stage) - ['MANAGER', 'FINANCE', 'HR'].indexOf(b.stage))
          .map((a) => ({
            stage: a.stage,
            status: a.status,
            label: a.label,
            approvers: a.approverIds.map((id) => names.get(id)).filter(Boolean),
            actedBy: a.actedById ? names.get(a.actedById) ?? null : null,
            onBehalfOf: a.onBehalfOfId ? names.get(a.onBehalfOfId) ?? null : null,
            comments: a.comments,
            actedAt: a.actedAt,
          }));
        const claimedPaise = r.items.reduce((s, i) => s + i.amountPaise, 0);
        const approvedPaise = r.items.reduce((s, i) => s + (i.approvedPaise ?? i.amountPaise), 0);
        const own = r.employee.userId === access.userId;
        const { userId: _u, ...employee } = r.employee;
        return {
          id: r.id,
          title: r.title,
          status: r.status,
          round: r.round,
          project: r.projectId ? projects.get(r.projectId) ?? null : null,
          submittedAt: r.submittedAt,
          approvedAt: r.approvedAt,
          rejectionReason: r.rejectionReason,
          paidAt: r.paidAt,
          paymentDate: r.paymentDate ? keyFromDate(r.paymentDate) : null,
          paymentReference: r.paymentReference,
          createdAt: r.createdAt,
          employee,
          items: r.items.map((i) => ({ ...i, date: keyFromDate(i.date), hasReceipt: Boolean(i.receiptName) })),
          totals: { claimedPaise, approvedPaise, items: r.items.length },
          steps,
          canEdit: own && (r.status === ExpenseClaimStatus.DRAFT || r.status === ExpenseClaimStatus.REJECTED),
          canCancel: own && ([ExpenseClaimStatus.DRAFT, ExpenseClaimStatus.PENDING, ExpenseClaimStatus.REJECTED] as ExpenseClaimStatus[]).includes(r.status),
          canDecide: Boolean(step),
          decideStage: step?.step.stage ?? null,
          canAdjust: step ? step.step.stage !== ExpenseStage.MANAGER : false,
          canPay: finance && !own && r.status === ExpenseClaimStatus.APPROVED,
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Tell whoever acts next: the manager pool (or covering delegates), else Finance + HR. */
  private async notifyNext(companyId: string, id: string) {
    try {
      const c = await this.prisma.expenseClaim.findUnique({ where: { id }, select: SELECT });
      if (!c || c.status !== ExpenseClaimStatus.PENDING) return;
      const rows = c.approvals.filter((a) => a.round === c.round);
      const manager = rows.find((a) => a.stage === ExpenseStage.MANAGER)!;
      const total = c.items.reduce((s, i) => s + i.amountPaise, 0);
      const who = `${c.employee.firstName} ${c.employee.lastName}`;
      let to: string[];
      let step: string;
      if (manager.status === LeaveApprovalStatus.PENDING) {
        to = [...manager.approverIds, ...(await this.notifications.coveringFor(manager.approverIds))];
        step = 'manager approval';
      } else {
        to = [...(await this.notifications.companyWideApprovers(companyId, FINANCE)), ...(await this.notifications.companyWideApprovers(companyId, HR))];
        step = 'Finance and HR approval';
      }
      await this.notifications.notify({
        companyId,
        userIds: to.filter((u) => u !== c.employee.userId),
        type: 'expense.submitted',
        title: `${who} submitted an expense claim (${step})`,
        body: `${c.title} · ₹${(total / 100).toFixed(2)} · ${c.items.length} item${c.items.length === 1 ? '' : 's'}`,
        link: `/app/expenses/${id}`,
        actionLabel: 'Review claim',
      });
    } catch (err) {
      this.logger.error(`Could not notify approvers for claim ${id}`, err as Error);
    }
  }

  private stageName(s: ExpenseStage) {
    return s === ExpenseStage.MANAGER ? 'Manager' : s === ExpenseStage.FINANCE ? 'Finance' : 'HR';
  }

  private myEmployee(access: AccessContext): string {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    return access.employee.id;
  }

  private async assertProject(companyId: string, projectId?: string | null) {
    if (projectId && !(await this.prisma.project.count({ where: { id: projectId, companyId } }))) throw new NotFoundException('Project not found');
  }

  private async todayKey(companyId: string): Promise<string> {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }
}

