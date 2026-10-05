import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { HierarchyService } from '../access/hierarchy.service';
import { NotificationsService } from '../notifications/notifications.service';
import { holds, type AccessContext } from '../access/access.types';
import { COMPLETION_SELECT, completionOf } from '../employee-profile/profile-completion';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import { accruedSoFar, availableDays } from '../leave/leave-rules';

// ============================================================
// Employee lifecycle: joining soon → probation → active → notice → left.
//
// Who sees what
//   • Probation dates: anyone whose employee.view reaches the person
//     (HR, and managers / team leads for their own team).
//   • Notice period, last day, exit reason and people who have left:
//     only holders of employee.terminate (HR / Company Admin) — and the
//     person themselves. Everyone else sees someone on notice as Active,
//     and people who left simply aren't there.
// ============================================================

export type Stage = 'joining' | 'probation' | 'active' | 'notice' | 'left';
export type StageFilter = Stage | 'current' | 'all';
export const EXIT_REASONS = ['resigned', 'let_go', 'contract_end', 'retired', 'other'] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];
const REASON_LABEL: Record<ExitReason, string> = {
  resigned: 'Resigned',
  let_go: 'Let go',
  contract_end: 'Contract ended',
  retired: 'Retired',
  other: 'Other',
};

const JOINING_ITEMS = [
  'Laptop and accessories ready',
  'Work email and tool access set up',
  'Desk or seat assigned',
  'Buddy assigned',
  'ID and address proof collected',
  'Bank details and PAN added',
  'First-week plan shared by the manager',
];
const EXIT_ITEMS = [
  'Resignation or exit letter on file',
  'Handover plan agreed with the manager',
  'Company assets returned',
  'Email and tool access removed on the last day',
  'Final settlement sent to payroll',
  'Exit interview done',
];

const DAY = 86_400_000;
const PRESENTISH: AttendanceStatus[] = [AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY, AttendanceStatus.WORK_FROM_HOME];
/** More direct reports than this is flagged on Org health */
export const WIDE_SPAN = 8;

const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();
const PERSON = { id: true, firstName: true, lastName: true, avatarUrl: true, employeeId: true } as const;

export interface Today {
  key: string;
  date: Date;
}

@Injectable()
export class EmployeeLifecycleService {
  private readonly logger = new Logger(EmployeeLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly hierarchy: HierarchyService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Who sees what ────────────────────────────────────────

  seesExits(access: AccessContext): boolean {
    return holds(access, 'employee.terminate');
  }

  /** The record as this viewer may see it (notice / exit details stay with HR and the person). */
  mask<T extends { employmentStatus: EmploymentStatus; userId?: string; terminationDate?: Date | null; exitReason?: string | null }>(row: T, access: AccessContext): T {
    if (this.seesExits(access) || (row.userId && row.userId === access.userId)) return row;
    const out = { ...row };
    if (out.employmentStatus === EmploymentStatus.NOTICE_PERIOD) out.employmentStatus = EmploymentStatus.ACTIVE;
    if ('terminationDate' in out) out.terminationDate = null;
    if ('exitReason' in out) out.exitReason = null;
    return out;
  }

  async today(companyId: string): Promise<Today> {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    const tz = s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata';
    const key = localDateKey(new Date(), tz);
    return { key, date: dateFromKey(key) };
  }

  stageOf(e: { employmentStatus: EmploymentStatus; joiningDate: Date }, today: Date): Stage {
    if (e.employmentStatus === EmploymentStatus.TERMINATED) return 'left';
    if (e.employmentStatus === EmploymentStatus.NOTICE_PERIOD) return 'notice';
    if (e.joiningDate > today) return 'joining';
    if (e.employmentStatus === EmploymentStatus.PROBATION) return 'probation';
    return 'active';
  }

  /** Prisma filter for a lifecycle stage. Without exit access, notice counts as active and left is empty. */
  stageWhere(stage: StageFilter | undefined, today: Date, seesExits: boolean): Prisma.EmployeeWhereInput {
    const notLeft: Prisma.EmployeeWhereInput = { employmentStatus: { not: EmploymentStatus.TERMINATED } };
    const started: Prisma.EmployeeWhereInput = { joiningDate: { lte: today } };
    switch (stage) {
      case 'all':
        return seesExits ? {} : notLeft;
      case 'joining':
        return { ...notLeft, joiningDate: { gt: today }, ...(seesExits ? { employmentStatus: { notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.NOTICE_PERIOD] } } : {}) };
      case 'probation':
        return { ...started, employmentStatus: EmploymentStatus.PROBATION };
      case 'active':
        return {
          ...started,
          employmentStatus: { in: seesExits ? [EmploymentStatus.ACTIVE, EmploymentStatus.ON_LEAVE] : [EmploymentStatus.ACTIVE, EmploymentStatus.ON_LEAVE, EmploymentStatus.NOTICE_PERIOD] },
        };
      case 'notice':
        return seesExits ? { employmentStatus: EmploymentStatus.NOTICE_PERIOD } : { id: { in: [] } };
      case 'left':
        return seesExits ? { employmentStatus: EmploymentStatus.TERMINATED } : { id: { in: [] } };
      default:
        return notLeft;
    }
  }

  /** Adds stage, profile % (when the viewer may see private details) and checklist progress to list rows. */
  async enrich<T extends { id: string; userId: string; employmentStatus: EmploymentStatus; joiningDate: Date; terminationDate: Date | null; exitReason?: string | null }>(
    companyId: string,
    rows: T[],
    access: AccessContext,
    today: Date,
  ) {
    const ids = rows.map((r) => r.id);
    const privateScope = this.access.employeeScope(access, 'employee.view_private');
    const [privateIds, completion, checklists] = await Promise.all([
      privateScope && ids.length
        ? this.prisma.employee.findMany({ where: { AND: [{ id: { in: ids }, companyId }, privateScope] }, select: { id: true } }).then((r) => new Set(r.map((x) => x.id)))
        : Promise.resolve(new Set<string>()),
      ids.length ? this.prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, ...COMPLETION_SELECT } }) : Promise.resolve([]),
      ids.length && this.canEditOthers(access)
        ? this.prisma.employeeChecklistItem.groupBy({ by: ['employeeId', 'kind'], where: { employeeId: { in: ids } }, _count: { _all: true } })
        : Promise.resolve([]),
    ]);
    const done = ids.length && checklists.length
      ? await this.prisma.employeeChecklistItem.groupBy({ by: ['employeeId', 'kind'], where: { employeeId: { in: ids }, doneAt: { not: null } }, _count: { _all: true } })
      : [];
    const pct = new Map(completion.map((c) => [c.id, completionOf(c).percent]));
    const total = new Map(checklists.map((c) => [`${c.employeeId}:${c.kind}`, c._count._all]));
    const finished = new Map(done.map((c) => [`${c.employeeId}:${c.kind}`, c._count._all]));
    return rows.map((r) => {
      const masked = this.mask(r, access);
      const stage = this.stageOf(masked, today);
      const kind = stage === 'joining' ? 'joining' : stage === 'notice' ? 'exit' : null;
      const key = kind ? `${r.id}:${kind}` : '';
      return {
        ...masked,
        stage,
        profilePercent: privateIds.has(r.id) || r.userId === access.userId ? (pct.get(r.id) ?? null) : null,
        checklist: kind && total.get(key) ? { kind, done: finished.get(key) ?? 0, total: total.get(key)! } : null,
      };
    });
  }

  /** employee.edit reaching beyond "own" (HR, admins). */
  private canEditOthers(access: AccessContext): boolean {
    if (access.isSuperAdmin || access.isOwner) return true;
    const s = access.grants.get('employee.edit');
    return access.grants.has('employee.edit') && s !== 'own';
  }

  // ─── Summary (counts + needs attention) ───────────────────

  async summary(companyId: string, access: AccessContext) {
    const scope = this.access.requireEmployeeScope(access, 'employee.view');
    const { date: today, key } = await this.today(companyId);
    const sees = this.seesExits(access);
    const count = (stage: StageFilter, extra: Prisma.EmployeeWhereInput = {}) =>
      this.prisma.employee.count({ where: { AND: [{ companyId }, scope, this.stageWhere(stage, today, sees), extra] } });
    const in30 = dateFromKey(addDays(key, 30));
    const ago90 = dateFromKey(addDays(key, -90));

    const [all, joining, probation, active, notice, left] = await Promise.all([
      count('current'),
      count('joining'),
      count('probation'),
      count('active'),
      sees ? count('notice') : Promise.resolve(null),
      sees ? count('left', { terminationDate: { gte: ago90 } }) : Promise.resolve(null),
    ]);

    // Self-service only (sees just their own record): counts, no to-do list
    const ownOnly = !access.isSuperAdmin && access.grants.get('employee.view') === 'own' && !access.delegations.some((d) => d.grants.has('employee.view'));
    const attention: Array<{ key: string; tone: 'warning' | 'danger' | 'info' | 'primary'; title: string; detail: string; people: Array<{ id: string; name: string; avatarUrl: string | null; date?: string | null }>; action: string }> = [];
    const list = (p: { id: string; firstName: string; lastName: string; avatarUrl: string | null }, date?: Date | null) => ({ id: p.id, name: name(p), avatarUrl: p.avatarUrl, date: date ? keyFromDate(date) : null });

    // Probations ending in the next 30 days (or already overdue)
    const probations = ownOnly ? [] : await this.prisma.employee.findMany({
      where: { AND: [{ companyId }, scope, this.stageWhere('probation', today, sees), { confirmationDate: { lte: in30 } }] },
      orderBy: { confirmationDate: 'asc' },
      select: { ...PERSON, confirmationDate: true },
      take: 20,
    });
    if (probations.length) {
      const overdue = probations.filter((p) => p.confirmationDate && p.confirmationDate < today).length;
      attention.push({
        key: 'probation',
        tone: 'warning',
        title: `${probations.length} probation${probations.length === 1 ? ' ends' : 's end'} soon${overdue ? ` · ${overdue} overdue` : ''}`,
        detail: probations.slice(0, 3).map((p) => `${p.firstName} (${p.confirmationDate ? fmt(p.confirmationDate) : '—'})`).join(', ') + (probations.length > 3 ? ` +${probations.length - 3}` : '') + ' — confirm or extend',
        people: probations.map((p) => list(p, p.confirmationDate)),
        action: 'probation',
      });
    }

    if (sees && !ownOnly) {
      const exits = await this.prisma.employee.findMany({
        where: { AND: [{ companyId }, scope, { employmentStatus: EmploymentStatus.NOTICE_PERIOD }, { OR: [{ terminationDate: null }, { terminationDate: { lte: in30 } }] }] },
        orderBy: { terminationDate: 'asc' },
        select: { ...PERSON, terminationDate: true },
        take: 20,
      });
      if (exits.length) {
        attention.push({
          key: 'exits',
          tone: 'danger',
          title: `${exits.length} ${exits.length === 1 ? 'exit' : 'exits'} in the next 30 days`,
          detail: exits.slice(0, 3).map((p) => `${p.firstName} — last day ${p.terminationDate ? fmt(p.terminationDate) : 'not set'}`).join(', '),
          people: exits.map((p) => list(p, p.terminationDate)),
          action: 'notice',
        });
      }
    }

    // No manager: only meaningful to people who see (and can fix) the whole company
    if (this.access.employeeScope(access, 'employee.view') && Object.keys(scope).length === 0) {
      const orphans = await this.prisma.employee.findMany({
        where: { companyId, reportingManagerId: null, employmentStatus: { not: EmploymentStatus.TERMINATED }, subordinates: { none: {} } },
        select: PERSON,
        orderBy: { firstName: 'asc' },
        take: 20,
      });
      const headcount = all;
      if (orphans.length && headcount > 1) {
        attention.push({
          key: 'no-manager',
          tone: 'info',
          title: `${orphans.length} ${orphans.length === 1 ? 'person has' : 'people have'} no manager`,
          detail: `${orphans.slice(0, 3).map((p) => p.firstName).join(', ')} — their leave and timesheets have no approver`,
          people: orphans.map((p) => list(p)),
          action: 'no-manager',
        });
      }
    }

    // Incomplete profiles: only for people who may see private details company-wide
    const privateScope = this.access.employeeScope(access, 'employee.view_private');
    if (privateScope && Object.keys(privateScope).length === 0) {
      const rows = await this.prisma.employee.findMany({
        where: { AND: [{ companyId }, this.stageWhere('current', today, sees)] },
        select: { ...PERSON, ...COMPLETION_SELECT },
      });
      const incomplete = rows.map((r) => ({ r, c: completionOf(r) })).filter((x) => x.c.percent < 100).sort((a, b) => a.c.percent - b.c.percent);
      if (incomplete.length) {
        const missing = new Map<string, number>();
        for (const x of incomplete) for (const i of x.c.items) if (!i.done) missing.set(i.label, (missing.get(i.label) ?? 0) + 1);
        const top = [...missing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l.toLowerCase());
        attention.push({
          key: 'profiles',
          tone: 'primary',
          title: `${incomplete.length} ${incomplete.length === 1 ? 'profile is' : 'profiles are'} incomplete`,
          detail: `Mostly missing ${top.join(', ')}`,
          people: incomplete.slice(0, 20).map((x) => list(x.r)),
          action: 'profiles',
        });
      }
    }

    return {
      seesExits: sees,
      counts: { all, joining, probation, active, notice, left },
      attention,
    };
  }

  // ─── Board ─────────────────────────────────────────────────

  async board(companyId: string, access: AccessContext) {
    const scope = this.access.requireEmployeeScope(access, 'employee.view');
    const { date: today, key } = await this.today(companyId);
    const sees = this.seesExits(access);
    const ago90 = dateFromKey(addDays(key, -90));
    const SELECT = {
      ...PERSON,
      userId: true,
      employmentStatus: true,
      employmentType: true,
      joiningDate: true,
      confirmationDate: true,
      terminationDate: true,
      exitReason: true,
      designation: { select: { name: true } },
      department: { select: { name: true } },
    } satisfies Prisma.EmployeeSelect;
    const lane = async (stage: Stage, orderBy: Prisma.EmployeeOrderByWithRelationInput[], extra: Prisma.EmployeeWhereInput = {}) => {
      const where = { AND: [{ companyId }, scope, this.stageWhere(stage, today, sees), extra] };
      const [rows, total] = await Promise.all([this.prisma.employee.findMany({ where, orderBy, take: 30, select: SELECT }), this.prisma.employee.count({ where })]);
      return { stage, total, people: await this.enrich(companyId, rows, access, today) };
    };
    const lanes = await Promise.all([
      lane('joining', [{ joiningDate: 'asc' }]),
      lane('probation', [{ confirmationDate: { sort: 'asc', nulls: 'last' } }]),
      lane('active', [{ joiningDate: 'desc' }]),
      ...(sees ? [lane('notice', [{ terminationDate: { sort: 'asc', nulls: 'last' } }]), lane('left', [{ terminationDate: 'desc' }], { terminationDate: { gte: ago90 } })] : []),
    ]);
    return { seesExits: sees, today: key, lanes };
  }

  // ─── Actions ───────────────────────────────────────────────

  /** The person, if the caller's `permission` reaches them and they aren't the caller. */
  private async target(companyId: string, id: string, access: AccessContext, permission: string) {
    const scope = this.access.requireEmployeeScope(access, permission);
    const e = await this.prisma.employee.findFirst({
      where: { AND: [{ id, companyId }, scope] },
      select: { id: true, userId: true, firstName: true, lastName: true, employmentStatus: true, joiningDate: true, confirmationDate: true, terminationDate: true, exitReason: true },
    });
    if (!e) throw new NotFoundException('Employee not found');
    if (e.userId === access.userId && !access.isSuperAdmin) throw new ForbiddenException('You can’t change your own employment status');
    return e;
  }

  async confirm(companyId: string, id: string, access: AccessContext, note?: string) {
    const e = await this.target(companyId, id, access, 'employee.edit');
    if (!this.canEditOthers(access)) throw new ForbiddenException('You do not have permission to confirm probations');
    if (e.employmentStatus !== EmploymentStatus.PROBATION) throw new BadRequestException(`${e.firstName} isn’t on probation`);
    const { date: today } = await this.today(companyId);
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { employmentStatus: EmploymentStatus.ACTIVE, confirmationDate: today } });
      await this.record(tx, { companyId, employeeId: id, actor: access.userId, kind: 'confirmed', from: e.confirmationDate ? fmt(e.confirmationDate) : null, effectiveOn: today, note });
    });
    void this.notifications.notify({ companyId, userIds: [e.userId], type: 'employee.confirmed', title: 'Your probation is confirmed — congratulations!', body: note ?? null, link: '/app/profile' });
    return { id, employmentStatus: EmploymentStatus.ACTIVE, confirmationDate: keyFromDate(today) };
  }

  async extendProbation(companyId: string, id: string, access: AccessContext, until: string, note?: string) {
    const e = await this.target(companyId, id, access, 'employee.edit');
    if (!this.canEditOthers(access)) throw new ForbiddenException('You do not have permission to extend probations');
    if (e.employmentStatus !== EmploymentStatus.PROBATION) throw new BadRequestException(`${e.firstName} isn’t on probation`);
    const { key } = await this.today(companyId);
    if (until <= key) throw new BadRequestException('Pick a date after today');
    const date = dateFromKey(until);
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { confirmationDate: date } });
      await this.record(tx, { companyId, employeeId: id, actor: access.userId, kind: 'probation_extended', from: e.confirmationDate ? fmt(e.confirmationDate) : null, to: fmt(date), effectiveOn: date, note });
    });
    return { id, confirmationDate: until };
  }

  async startNotice(companyId: string, id: string, access: AccessContext, dto: { lastDay: string; reason: ExitReason; note?: string }) {
    const e = await this.target(companyId, id, access, 'employee.terminate');
    if (e.employmentStatus === EmploymentStatus.TERMINATED) throw new BadRequestException(`${e.firstName} has already left`);
    if (e.employmentStatus === EmploymentStatus.NOTICE_PERIOD) throw new BadRequestException(`${e.firstName} is already on notice`);
    const lastDay = dateFromKey(dto.lastDay);
    if (lastDay < e.joiningDate) throw new BadRequestException('The last day can’t be before they joined');
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { employmentStatus: EmploymentStatus.NOTICE_PERIOD, terminationDate: lastDay, exitReason: dto.reason } });
      await tx.employeeChecklistItem.deleteMany({ where: { employeeId: id, kind: 'exit' } });
      await tx.employeeChecklistItem.createMany({ data: EXIT_ITEMS.map((label, i) => ({ companyId, employeeId: id, kind: 'exit', label, sortOrder: i })) });
      await this.record(tx, { companyId, employeeId: id, actor: access.userId, kind: 'notice', to: REASON_LABEL[dto.reason], effectiveOn: lastDay, note: dto.note });
    });
    void this.warnAboutAssets(companyId, id, false);
    return { id, employmentStatus: EmploymentStatus.NOTICE_PERIOD, terminationDate: dto.lastDay, exitReason: dto.reason };
  }

  async withdrawNotice(companyId: string, id: string, access: AccessContext, note?: string) {
    const e = await this.target(companyId, id, access, 'employee.terminate');
    if (e.employmentStatus !== EmploymentStatus.NOTICE_PERIOD) throw new BadRequestException(`${e.firstName} isn’t on notice`);
    const { date: today } = await this.today(companyId);
    // Back to probation if it hasn't ended yet
    const status = e.confirmationDate && e.confirmationDate > today && !(await this.wasConfirmed(id)) ? EmploymentStatus.PROBATION : EmploymentStatus.ACTIVE;
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { employmentStatus: status, terminationDate: null, exitReason: null } });
      await tx.employeeChecklistItem.deleteMany({ where: { employeeId: id, kind: 'exit' } });
      await this.record(tx, { companyId, employeeId: id, actor: access.userId, kind: 'notice_withdrawn', note });
    });
    return { id, employmentStatus: status };
  }

  async markLeft(companyId: string, id: string, access: AccessContext, dto: { lastDay?: string; reason?: ExitReason; note?: string }) {
    const e = await this.target(companyId, id, access, 'employee.terminate');
    if (e.employmentStatus === EmploymentStatus.TERMINATED) throw new BadRequestException(`${e.firstName} has already left`);
    const { date: today } = await this.today(companyId);
    const lastDay = dto.lastDay ? dateFromKey(dto.lastDay) : (e.terminationDate ?? today);
    if (lastDay > today) throw new BadRequestException('The last day is still ahead — keep them on notice until then');
    const reason = dto.reason ?? (e.exitReason as ExitReason | null) ?? 'other';
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: { employmentStatus: EmploymentStatus.TERMINATED, terminationDate: lastDay, exitReason: reason } });
      await this.record(tx, { companyId, employeeId: id, actor: access.userId, kind: 'left', to: REASON_LABEL[reason as ExitReason] ?? null, effectiveOn: lastDay, note: dto.note });
    });
    void this.warnAboutAssets(companyId, id, true);
    return { id, employmentStatus: EmploymentStatus.TERMINATED, terminationDate: keyFromDate(lastDay) };
  }

  private async wasConfirmed(id: string): Promise<boolean> {
    return (await this.prisma.employeeEvent.count({ where: { employeeId: id, kind: 'confirmed' } })) > 0;
  }

  // ─── Checklists ────────────────────────────────────────────

  async checklist(companyId: string, id: string, access: AccessContext, kind: 'joining' | 'exit') {
    if (!this.canEditOthers(access)) throw new ForbiddenException('You do not have permission to see checklists');
    if (kind === 'exit' && !this.seesExits(access)) throw new ForbiddenException('You do not have permission to see exit checklists');
    const scope = this.access.requireEmployeeScope(access, 'employee.edit');
    const e = await this.prisma.employee.findFirst({ where: { AND: [{ id, companyId }, scope] }, select: { id: true, joiningDate: true, employmentStatus: true } });
    if (!e) throw new NotFoundException('Employee not found');
    let items = await this.prisma.employeeChecklistItem.findMany({ where: { employeeId: id, kind }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    if (!items.length && kind === 'joining') {
      await this.prisma.employeeChecklistItem.createMany({ data: JOINING_ITEMS.map((label, i) => ({ companyId, employeeId: id, kind, label, sortOrder: i })) });
      items = await this.prisma.employeeChecklistItem.findMany({ where: { employeeId: id, kind }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    }
    const who = await this.userNames(items.map((i) => i.doneByUserId));
    return items.map((i) => ({ id: i.id, label: i.label, doneAt: i.doneAt, doneBy: i.doneByUserId ? (who.get(i.doneByUserId) ?? null) : null }));
  }

  async tickChecklist(companyId: string, id: string, itemId: string, done: boolean, access: AccessContext) {
    const item = await this.prisma.employeeChecklistItem.findFirst({ where: { id: itemId, employeeId: id, companyId } });
    if (!item) throw new NotFoundException('Checklist item not found');
    await this.checklist(companyId, id, access, item.kind as 'joining' | 'exit'); // permission + scope
    await this.prisma.employeeChecklistItem.update({ where: { id: itemId }, data: done ? { doneAt: new Date(), doneByUserId: access.userId } : { doneAt: null, doneByUserId: null } });
    return this.checklist(companyId, id, access, item.kind as 'joining' | 'exit');
  }

  async addChecklistItem(companyId: string, id: string, kind: 'joining' | 'exit', label: string, access: AccessContext) {
    const items = await this.checklist(companyId, id, access, kind);
    if (items.length >= 30) throw new BadRequestException('A checklist can have at most 30 items');
    await this.prisma.employeeChecklistItem.create({ data: { companyId, employeeId: id, kind, label: label.trim(), sortOrder: items.length } });
    return this.checklist(companyId, id, access, kind);
  }

  // ─── History ───────────────────────────────────────────────

  async history(companyId: string, id: string, access: AccessContext) {
    const scope = this.access.requireEmployeeScope(access, 'employee.view');
    const e = await this.prisma.employee.findFirst({
      where: { AND: [{ id, companyId }, scope] },
      select: { id: true, userId: true, employmentStatus: true, joiningDate: true, confirmationDate: true, terminationDate: true, exitReason: true, employmentType: true, designation: { select: { name: true } }, department: { select: { name: true } }, location: { select: { name: true } } },
    });
    if (!e) throw new NotFoundException('Employee not found');
    const sees = this.seesExits(access) || e.userId === access.userId;
    if (e.employmentStatus === EmploymentStatus.TERMINATED && !sees) throw new NotFoundException('Employee not found');
    const PRIVATE = new Set(['notice', 'notice_withdrawn', 'left']);
    const events = (await this.prisma.employeeEvent.findMany({ where: { employeeId: id, companyId }, orderBy: { createdAt: 'asc' } })).filter((ev) => sees || !PRIVATE.has(ev.kind));
    const who = await this.userNames(events.map((ev) => ev.actorUserId));
    const { date: today } = await this.today(companyId);

    const items: Array<{ id: string; kind: string; title: string; detail: string | null; at: string; effectiveOn: string | null; by: string | null; upcoming?: boolean; note?: string | null }> = [];
    if (!events.some((ev) => ev.kind === 'joined')) {
      items.push({
        id: 'joined',
        kind: 'joined',
        title: `Joined${e.designation ? ` as ${e.designation.name}` : ''}`,
        detail: [e.department?.name, e.location?.name].filter(Boolean).join(' · ') || null,
        at: e.joiningDate.toISOString(),
        effectiveOn: keyFromDate(e.joiningDate),
        by: null,
      });
    }
    for (const ev of events) {
      items.push({ id: ev.id, kind: ev.kind, title: this.eventTitle(ev), detail: ev.fromLabel && ev.toLabel ? `${ev.fromLabel} → ${ev.toLabel}` : (ev.toLabel ?? ev.fromLabel), at: ev.createdAt.toISOString(), effectiveOn: ev.effectiveOn ? keyFromDate(ev.effectiveOn) : null, by: ev.actorUserId ? (who.get(ev.actorUserId) ?? null) : null, note: ev.note });
    }
    // What's coming next
    if (e.employmentStatus === EmploymentStatus.PROBATION && e.confirmationDate) {
      items.push({ id: 'upcoming-probation', kind: 'upcoming', title: e.confirmationDate < today ? 'Probation review is overdue' : 'Probation review due', detail: `Confirm or extend by ${fmt(e.confirmationDate)}`, at: e.confirmationDate.toISOString(), effectiveOn: keyFromDate(e.confirmationDate), by: null, upcoming: true });
    }
    if (sees && e.employmentStatus === EmploymentStatus.NOTICE_PERIOD && e.terminationDate) {
      items.push({ id: 'upcoming-last-day', kind: 'upcoming', title: 'Last day', detail: fmt(e.terminationDate), at: e.terminationDate.toISOString(), effectiveOn: keyFromDate(e.terminationDate), by: null, upcoming: true });
    }
    if (e.joiningDate > today) items[0] = { ...items[0]!, title: items[0]!.title.replace('Joined', 'Joins'), upcoming: true };
    return items;
  }

  private eventTitle(ev: { kind: string; toLabel: string | null }): string {
    switch (ev.kind) {
      case 'joined': return `Joined${ev.toLabel ? ` as ${ev.toLabel}` : ''}`;
      case 'manager': return 'Manager changed';
      case 'department': return 'Moved team';
      case 'title': return 'Job title changed';
      case 'location': return 'Office changed';
      case 'type': return 'Employment type changed';
      case 'status': return 'Status changed';
      case 'confirmed': return 'Probation confirmed';
      case 'probation_extended': return 'Probation extended';
      case 'notice': return 'Notice period started';
      case 'notice_withdrawn': return 'Notice withdrawn — staying on';
      case 'left': return 'Left the company';
      default: return ev.kind;
    }
  }

  /** Writes one history row (inside the caller's transaction when given one). */
  async record(
    db: Prisma.TransactionClient | PrismaService,
    ev: { companyId: string; employeeId: string; actor: string | null; kind: string; from?: string | null; to?: string | null; effectiveOn?: Date | null; note?: string | null },
  ) {
    await db.employeeEvent.create({
      data: { companyId: ev.companyId, employeeId: ev.employeeId, actorUserId: ev.actor, kind: ev.kind, fromLabel: ev.from ?? null, toLabel: ev.to ?? null, effectiveOn: ev.effectiveOn ?? null, note: ev.note?.trim() || null },
    });
  }

  /** History rows for a profile edit: manager / team / title / office / type / status. */
  async recordChanges(
    db: Prisma.TransactionClient,
    companyId: string,
    actor: string,
    before: JobSnapshot,
    after: JobSnapshot,
  ) {
    const pairs: Array<[string, string | null, string | null]> = [
      ['manager', before.manager, after.manager],
      ['department', before.department, after.department],
      ['title', before.title, after.title],
      ['location', before.location, after.location],
      ['type', pretty(before.type), pretty(after.type)],
    ];
    for (const [kind, from, to] of pairs) {
      if ((from ?? null) !== (to ?? null)) await this.record(db, { companyId, employeeId: after.id, actor, kind, from: from ?? 'None', to: to ?? 'None' });
    }
    if (before.status !== after.status) {
      const kind =
        before.status === EmploymentStatus.PROBATION && after.status === EmploymentStatus.ACTIVE ? 'confirmed'
        : after.status === EmploymentStatus.NOTICE_PERIOD ? 'notice'
        : after.status === EmploymentStatus.TERMINATED ? 'left'
        : before.status === EmploymentStatus.NOTICE_PERIOD ? 'notice_withdrawn'
        : 'status';
      await this.record(db, { companyId, employeeId: after.id, actor, kind, from: pretty(before.status), to: pretty(after.status), effectiveOn: kind === 'left' || kind === 'notice' ? after.terminationDate : null });
    }
  }

  // ─── At a glance (profile header numbers) ──────────────────

  async glance(companyId: string, id: string, access: AccessContext) {
    const scope = this.access.requireEmployeeScope(access, 'employee.view');
    const e = await this.prisma.employee.findFirst({ where: { AND: [{ id, companyId }, scope] }, select: { id: true, userId: true, joiningDate: true, employmentStatus: true } });
    if (!e) throw new NotFoundException('Employee not found');
    const reaches = async (permission: string) => {
      const s = this.access.employeeScope(access, permission);
      return s ? (await this.prisma.employee.count({ where: { AND: [{ id, companyId }, s] } })) > 0 : false;
    };
    const [leaveOk, attendanceOk, projectOk, assetOk, privateOk] = await Promise.all([
      reaches('leave.view'),
      reaches('attendance.view'),
      Promise.resolve(holds(access, 'project.view')),
      reaches('asset.view'),
      reaches('employee.view_private'),
    ]);
    const { key, date: today } = await this.today(companyId);
    const year = Number(key.slice(0, 4));
    const monthStart = dateFromKey(`${key.slice(0, 7)}-01`);

    const [leave, attendance, projects, assets, completion] = await Promise.all([
      leaveOk ? this.leaveLeft(companyId, id, year, e.joiningDate, today) : null,
      attendanceOk ? this.attendanceThisMonth(companyId, id, monthStart, today, e.joiningDate) : null,
      projectOk
        ? this.prisma.projectMember.findMany({
            where: { companyId, employeeId: id, startDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] },
            select: { allocation: true, project: { select: { name: true } } },
            orderBy: { allocation: 'desc' },
          })
        : null,
      assetOk ? this.prisma.assetAssignment.findMany({ where: { companyId, employeeId: id, returnedAt: null }, select: { asset: { select: { name: true } } } }) : null,
      privateOk || e.userId === access.userId ? this.prisma.employee.findUnique({ where: { id }, select: COMPLETION_SELECT }).then((r) => (r ? completionOf(r) : null)) : null,
    ]);
    return {
      leave,
      attendance,
      projects: projects ? { count: projects.length, items: projects.map((p) => ({ name: p.project.name, allocation: p.allocation })) } : null,
      assets: assets ? { count: assets.length, items: assets.map((a) => a.asset.name) } : null,
      completion,
    };
  }

  private async leaveLeft(companyId: string, employeeId: string, year: number, joining: Date, today: Date) {
    const rows = await this.prisma.leaveBalance.findMany({
      where: { companyId, employeeId, year },
      select: { allocated: true, carriedForward: true, adjusted: true, usedDays: true, pendingDays: true, leaveType: { select: { name: true, accrual: true } } },
    });
    const items = rows
      .map((b) => ({ name: b.leaveType.name, days: availableDays(b.leaveType.accrual, accruedSoFar({ accrual: b.leaveType.accrual, allocated: b.allocated, year, joining, today }), b) }))
      .filter((b): b is { name: string; days: number } => b.days !== null)
      .sort((a, b) => b.days - a.days);
    return { days: items.reduce((n, b) => n + b.days, 0), items };
  }

  private async attendanceThisMonth(companyId: string, employeeId: string, monthStart: Date, today: Date, joining: Date) {
    const from = joining > monthStart ? joining : monthStart;
    const [records, holidays] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { companyId, employeeId, date: { gte: from, lte: today } }, select: { status: true, lateMinutes: true } }),
      this.prisma.publicHoliday.findMany({ where: { companyId, date: { gte: from, lte: today }, isOptional: false }, select: { date: true } }),
    ]);
    const off = new Set(holidays.map((h) => keyFromDate(h.date)));
    let workdays = 0;
    for (let t = from.getTime(); t <= today.getTime(); t += DAY) {
      const d = new Date(t);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !off.has(keyFromDate(d))) workdays++;
    }
    const present = records.filter((r) => PRESENTISH.includes(r.status)).length;
    const onLeave = records.filter((r) => r.status === AttendanceStatus.ON_LEAVE).length;
    const expected = Math.max(0, workdays - onLeave);
    return { pct: expected ? Math.min(100, Math.round((present / expected) * 100)) : null, present, workdays, late: records.filter((r) => (r.lateMinutes ?? 0) > 0).length };
  }

  // ─── Bulk ──────────────────────────────────────────────────

  async bulk(companyId: string, access: AccessContext, dto: { ids: string[]; action: 'manager' | 'department' | 'location' | 'remind'; value?: string | null }) {
    if (!this.canEditOthers(access)) throw new ForbiddenException('You do not have permission to change several people at once');
    const scope = this.access.requireEmployeeScope(access, 'employee.edit');
    const people = await this.prisma.employee.findMany({
      where: { AND: [{ companyId, id: { in: dto.ids } }, scope] },
      select: { id: true, userId: true, firstName: true, lastName: true, reportingManagerId: true, departmentId: true, locationId: true, employmentStatus: true, reportingManager: { select: { firstName: true, lastName: true } }, department: { select: { name: true } }, location: { select: { name: true } }, ...COMPLETION_SELECT },
    });
    const found = new Set(people.map((p) => p.id));
    const skipped: Array<{ id: string; name: string | null; reason: string }> = dto.ids.filter((id) => !found.has(id)).map((id) => ({ id, name: null, reason: 'Not found or outside your access' }));
    let updated = 0;

    if (dto.action === 'remind') {
      for (const p of people) {
        const c = completionOf(p);
        const missing = c.items.filter((i) => !i.done).map((i) => i.label);
        if (!missing.length) { skipped.push({ id: p.id, name: name(p), reason: 'Profile already complete' }); continue; }
        if (p.employmentStatus === EmploymentStatus.TERMINATED) { skipped.push({ id: p.id, name: name(p), reason: 'Has left' }); continue; }
        await this.notifications.notify({
          companyId,
          userIds: [p.userId],
          type: 'profile.reminder',
          title: 'Please finish your profile',
          body: `Still missing: ${missing.join(', ')}.`,
          link: '/app/profile',
          actionLabel: 'Open my profile',
          dedupeKey: `profile-reminder:${p.id}:${new Date().toISOString().slice(0, 10)}`,
        });
        updated++;
      }
      return { action: dto.action, updated, skipped };
    }

    // Validate the new value once
    let label: string | null = null;
    if (dto.value) {
      if (dto.action === 'manager') {
        const m = await this.prisma.employee.findFirst({ where: { id: dto.value, companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } }, select: { firstName: true, lastName: true } });
        if (!m) throw new NotFoundException('Manager not found');
        label = name(m);
      } else if (dto.action === 'department') {
        const d = await this.prisma.department.findFirst({ where: { id: dto.value, companyId }, select: { name: true } });
        if (!d) throw new NotFoundException('Department not found');
        label = d.name;
      } else {
        const l = await this.prisma.officeLocation.findFirst({ where: { id: dto.value, companyId }, select: { name: true } });
        if (!l) throw new NotFoundException('Location not found');
        label = l.name;
      }
    }
    const value = dto.value ?? null;
    for (const p of people) {
      if (p.userId === access.userId && !access.isSuperAdmin) { skipped.push({ id: p.id, name: name(p), reason: 'That’s you — change your own record from your profile' }); continue; }
      const current = dto.action === 'manager' ? p.reportingManagerId : dto.action === 'department' ? p.departmentId : p.locationId;
      if ((current ?? null) === value) { skipped.push({ id: p.id, name: name(p), reason: 'Already set' }); continue; }
      const from = dto.action === 'manager' ? (p.reportingManager ? name(p.reportingManager) : 'None') : dto.action === 'department' ? (p.department?.name ?? 'None') : (p.location?.name ?? 'None');
      try {
        await this.prisma.$transaction(async (tx) => {
          if (dto.action === 'manager') {
            await this.hierarchy.setManager(tx, companyId, p.id, value);
            await tx.employee.update({ where: { id: p.id }, data: { reportingManagerId: value } });
          } else if (dto.action === 'department') {
            await tx.employee.update({ where: { id: p.id }, data: { departmentId: value } });
          } else {
            await tx.employee.update({ where: { id: p.id }, data: { locationId: value } });
          }
          await this.record(tx, { companyId, employeeId: p.id, actor: access.userId, kind: dto.action, from, to: label ?? 'None' });
        });
        updated++;
      } catch (err) {
        skipped.push({ id: p.id, name: name(p), reason: err instanceof BadRequestException ? err.message : 'Could not update' });
      }
    }
    return { action: dto.action, updated, skipped };
  }

  // ─── Helpers ───────────────────────────────────────────────

  async userNames(ids: Array<string | null>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!unique.length) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, name(u)]));
  }

  async warnAboutAssets(companyId: string, employeeId: string, left: boolean) {
    try {
      const open = await this.prisma.assetAssignment.findMany({
        where: { companyId, employeeId, returnedAt: null },
        select: { asset: { select: { tag: true, name: true } }, employee: { select: { firstName: true, lastName: true } } },
      });
      if (!open.length) return;
      const who = name(open[0]!.employee);
      const it = await this.notifications.companyWideApprovers(companyId, 'asset.manage');
      await this.notifications.notify({
        companyId,
        userIds: it,
        type: 'asset.offboarding',
        title: `${who} ${left ? 'has left' : 'is leaving'} and still has ${open.length} asset${open.length === 1 ? '' : 's'}`,
        body: open.map((a) => `${a.asset.name} (${a.asset.tag})`).join(', '),
        link: `/app/assets?employeeId=${employeeId}`,
        actionLabel: 'See assets',
      });
    } catch (err) {
      this.logger.error(`Could not warn about assets of ${employeeId}`, err as Error);
    }
  }
}

export interface JobSnapshot {
  id: string;
  manager: string | null;
  department: string | null;
  title: string | null;
  location: string | null;
  type: string;
  status: EmploymentStatus;
  terminationDate: Date | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 18 Oct 2026 */
export function fmt(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function pretty(s: string | null): string | null {
  return s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : null;
}
