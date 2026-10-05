import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetCondition, AssetRequestStatus, AssetStatus, EmploymentStatus, LeaveApprovalStatus, Prisma, ProjectRole, ProjectStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import { AssetTypesService } from './asset-types.service';
import type { CreateRequestDto, DecideRequestDto, RejectRequestDto, RequestQueryDto } from './dto';

const IT = 'asset.approve_it';
const HR = 'asset.approve_hr';
const MANAGE = 'asset.manage';
type Stage = 'LEAD' | 'MANAGER' | 'HR' | 'IT';
const ORDER: Stage[] = ['LEAD', 'MANAGER', 'HR', 'IT'];
const STAGE_LABEL: Record<Stage, string> = { LEAD: 'Team lead', MANAGER: 'Manager', HR: 'HR', IT: 'IT head' };
const LIVE = { employmentStatus: { not: EmploymentStatus.TERMINATED }, user: { status: UserStatus.ACTIVE } } satisfies Prisma.EmployeeWhereInput;
const CONDITION_RANK: Record<AssetCondition, number> = { NEW: 0, GOOD: 1, FAIR: 2, POOR: 3, DAMAGED: 4 };

const SELECT = {
  id: true,
  reason: true,
  status: true,
  source: true,
  kind: true,
  loanFrom: true,
  loanUntil: true,
  neededBy: true,
  stage: true,
  requestedById: true,
  leadApproverId: true,
  leadStatus: true,
  leadById: true,
  leadAt: true,
  leadNote: true,
  managerApproverId: true,
  managerStatus: true,
  managerById: true,
  managerAt: true,
  managerNote: true,
  hrStatus: true,
  hrById: true,
  hrAt: true,
  hrNote: true,
  itStatus: true,
  itById: true,
  itAt: true,
  itNote: true,
  assetId: true,
  createdAt: true,
  type: { select: { id: true, name: true, icon: true, checklist: true, loanable: true } },
  employee: { select: { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, joiningDate: true, designation: { select: { name: true } }, department: { select: { name: true } } } },
} satisfies Prisma.AssetRequestSelect;
type Row = Prisma.AssetRequestGetPayload<{ select: typeof SELECT }>;

/**
 * Asset requests, approved one step after another:
 *   team lead (on their project) → manager (line manager) → HR → IT head,
 * then IT hands over an asset of that type. A step is skipped when nobody
 * fills it or that person asked (a manager requesting for their team).
 * Nobody approves their own request, and one person never decides two steps.
 * Requests can be to keep or a loan (with a return date). Starter kits
 * (source KIT) come in approved — company policy.
 */
@Injectable()
export class AssetRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly types: AssetTypesService,
  ) {}

  /** Who will approve — for the request form. */
  async preview(companyId: string, access: AccessContext, forEmployeeId?: string) {
    const target = await this.target(companyId, access, forEmployeeId);
    const c = await this.chain(companyId, target, access.employee?.id ?? null);
    const names = await this.names([c.lead, c.manager]);
    return {
      for: { id: target.id, firstName: target.firstName, lastName: target.lastName },
      steps: [
        ...(c.lead ? [{ stage: 'LEAD', label: STAGE_LABEL.LEAD, person: names.get(c.lead) ?? null }] : []),
        ...(c.manager ? [{ stage: 'MANAGER', label: STAGE_LABEL.MANAGER, person: names.get(c.manager) ?? null }] : []),
        { stage: 'HR', label: STAGE_LABEL.HR, person: null },
        { stage: 'IT', label: STAGE_LABEL.IT, person: null },
      ],
      team: await this.myTeam(companyId, access),
    };
  }

  async create(companyId: string, access: AccessContext, dto: CreateRequestDto) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    const target = await this.target(companyId, access, dto.forEmployeeId ?? undefined);
    const type = await this.types.get(companyId, dto.typeId);
    if (!type.isActive || !type.requestable) throw new BadRequestException(`${type.name} can’t be requested — ask IT`);
    const today = await this.todayKey(companyId);
    const kind = dto.kind ?? 'KEEP';
    let loanFrom: string | null = null;
    let loanUntil: string | null = null;
    if (kind === 'LOAN') {
      if (!type.loanable) throw new BadRequestException(`${type.name} can’t be borrowed for a while — ask to keep one`);
      loanFrom = dto.loanFrom ?? today;
      loanUntil = dto.loanUntil ?? null;
      if (!loanUntil) throw new BadRequestException('Pick when you’ll return it');
      if (loanFrom < today) throw new BadRequestException('A loan can’t start in the past');
      if (loanUntil <= loanFrom) throw new BadRequestException('The return date must be after the start');
      if (type.maxLoanDays && loanUntil > addDays(loanFrom, type.maxLoanDays)) throw new BadRequestException(`${type.name} can be borrowed for up to ${type.maxLoanDays} days`);
    }
    if (dto.neededBy && dto.neededBy < today) throw new BadRequestException('“Needed by” can’t be in the past');
    const open = await this.prisma.assetRequest.count({
      where: { companyId, employeeId: target.id, typeId: type.id, status: { in: [AssetRequestStatus.PENDING, AssetRequestStatus.APPROVED] } },
    });
    if (open) throw new ConflictException(`${target.id === access.employee.id ? 'You already have' : `${target.firstName} already has`} an open request for a ${type.name.toLowerCase()}`);

    const c = await this.chain(companyId, target, access.employee.id);
    const first: Stage = c.lead ? 'LEAD' : c.manager ? 'MANAGER' : 'HR';
    const r = await this.prisma.assetRequest.create({
      data: {
        companyId,
        employeeId: target.id,
        typeId: type.id,
        reason: dto.reason,
        requestedById: target.id === access.employee.id ? null : access.employee.id,
        kind,
        loanFrom: loanFrom ? dateFromKey(loanFrom) : null,
        loanUntil: loanUntil ? dateFromKey(loanUntil) : null,
        neededBy: dto.neededBy ? dateFromKey(dto.neededBy) : null,
        stage: first,
        leadApproverId: c.lead,
        leadStatus: c.lead ? LeaveApprovalStatus.PENDING : LeaveApprovalStatus.SKIPPED,
        managerApproverId: c.manager,
        managerStatus: c.manager ? LeaveApprovalStatus.PENDING : LeaveApprovalStatus.SKIPPED,
      },
      select: SELECT,
    });
    void this.notifyStage(companyId, r);
    return (await this.page([r], 1, 1, 1, access)).data[0];
  }

  async list(companyId: string, access: AccessContext, q: RequestQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    let where: Prisma.AssetRequestWhereInput;
    if (q.view === 'mine') {
      if (!access.employee) return this.page([], 0, page, limit, access);
      where = { companyId, OR: [{ employeeId: access.employee.id }, { requestedById: access.employee.id }], ...(q.status && { status: q.status }) };
    } else if (q.view === 'review') {
      const me = [access.userId, ...access.delegations.map((d) => d.fromUserId)];
      const stages: Prisma.AssetRequestWhereInput[] = [{ stage: 'LEAD', leadApproverId: { in: me } }, { stage: 'MANAGER', managerApproverId: { in: me } }];
      if (access.grants.has(HR)) stages.push({ stage: 'HR' });
      if (access.grants.has(IT)) stages.push({ stage: 'IT' });
      const candidates = await this.prisma.assetRequest.findMany({
        where: { companyId, status: AssetRequestStatus.PENDING, employee: { userId: { not: access.userId } }, OR: stages },
        select: SELECT,
        orderBy: { createdAt: 'asc' },
      });
      const mine = candidates.filter((r) => this.decideAs(access, r));
      return this.page(mine.slice((page - 1) * limit, page * limit), mine.length, page, limit, access);
    } else if (q.view === 'fulfil' || q.view === 'joiners') {
      if (!holds(access, MANAGE) && !access.grants.has(HR)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
      where = { companyId, status: AssetRequestStatus.APPROVED, ...(q.view === 'joiners' && { source: 'KIT' }) };
    } else {
      if (!access.grants.has(IT) && !access.grants.has(HR) && !holds(access, MANAGE)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
      where = { companyId, ...(q.status && { status: q.status }) };
    }
    const [rows, total] = await Promise.all([
      this.prisma.assetRequest.findMany({
        where,
        select: SELECT,
        orderBy: q.view === 'mine' ? { createdAt: 'desc' } : q.view === 'fulfil' || q.view === 'joiners' ? [{ neededBy: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }] : { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.assetRequest.count({ where }),
    ]);
    return this.page(rows, total, page, limit, access);
  }

  async pendingCount(companyId: string, access: AccessContext) {
    const review = (await this.list(companyId, access, { view: 'review', limit: 1 })).meta.total;
    const fulfil = holds(access, MANAGE) ? await this.prisma.assetRequest.count({ where: { companyId, status: AssetRequestStatus.APPROVED } }) : 0;
    return review + fulfil;
  }

  async approve(companyId: string, access: AccessContext, id: string, dto: DecideRequestDto) {
    const { r, stage } = await this.decidable(companyId, access, id);
    const next = this.nextStage(r, stage);
    const field = this.fields(stage);
    const { count } = await this.prisma.assetRequest.updateMany({
      where: { id, status: AssetRequestStatus.PENDING, stage },
      data: {
        [field.status]: LeaveApprovalStatus.APPROVED,
        [field.by]: access.userId,
        [field.at]: new Date(),
        [field.note]: dto.note ?? null,
        stage: next,
        ...(next === null && { status: AssetRequestStatus.APPROVED }),
      },
    });
    if (!count) throw new ConflictException('This step has already been decided');
    const updated = await this.prisma.assetRequest.findUniqueOrThrow({ where: { id }, select: SELECT });
    if (next) void this.notifyStage(companyId, updated);
    else void this.notifyApproved(companyId, updated);
    return this.get(companyId, access, id);
  }

  async reject(companyId: string, access: AccessContext, id: string, dto: RejectRequestDto) {
    const { r, stage } = await this.decidable(companyId, access, id);
    const field = this.fields(stage);
    const skip = (s: Stage) => (r[this.fields(s).status as 'leadStatus'] === LeaveApprovalStatus.PENDING && s !== stage ? { [this.fields(s).status]: LeaveApprovalStatus.SKIPPED } : {});
    const { count } = await this.prisma.assetRequest.updateMany({
      where: { id, status: AssetRequestStatus.PENDING, stage },
      data: { ...skip('LEAD'), ...skip('MANAGER'), ...skip('HR'), ...skip('IT'), [field.status]: LeaveApprovalStatus.REJECTED, [field.by]: access.userId, [field.at]: new Date(), [field.note]: dto.reason, stage: null, status: AssetRequestStatus.REJECTED },
    });
    if (!count) throw new ConflictException('This request has already been decided');
    const to = [r.employee.userId, ...(await this.requesterUser(r))];
    void this.notifications.notify({
      companyId,
      userIds: [...new Set(to)],
      type: 'asset.request_rejected',
      title: `The ${r.type.name.toLowerCase()} request${r.requestedById ? ` for ${r.employee.firstName}` : ''} was not approved`,
      body: `${STAGE_LABEL[stage]}: ${dto.reason}`,
      link: '/app/assets/mine',
    });
    return this.get(companyId, access, id);
  }

  async cancel(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.assetRequest.findFirst({ where: { id, companyId }, select: { employeeId: true, requestedById: true, source: true } });
    if (!r || (r.employeeId !== access.employee?.id && r.requestedById !== access.employee?.id) || r.source !== 'REQUEST') throw new NotFoundException('Request not found');
    const { count } = await this.prisma.assetRequest.updateMany({ where: { id, status: { in: [AssetRequestStatus.PENDING, AssetRequestStatus.APPROVED] } }, data: { status: AssetRequestStatus.CANCELLED, stage: null } });
    if (!count) throw new BadRequestException('Only open requests can be cancelled');
    return this.get(companyId, access, id);
  }

  async get(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.assetRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!r) throw new NotFoundException('Request not found');
    const mine = r.employee.userId === access.userId || r.requestedById === access.employee?.id;
    const approver = [r.leadApproverId, r.managerApproverId, r.leadById, r.managerById, r.hrById, r.itById].includes(access.userId) || Boolean(this.decideAs(access, r));
    const allowed = mine || approver || access.grants.has(IT) || access.grants.has(HR) || holds(access, MANAGE);
    if (!allowed) throw new NotFoundException('Request not found');
    return (await this.page([r], 1, 1, 1, access)).data[0]!;
  }

  /** Available assets of the requested type, best first (newest condition, longest warranty). */
  async matches(companyId: string, access: AccessContext, id: string) {
    if (!holds(access, MANAGE)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const r = await this.prisma.assetRequest.findFirst({ where: { id, companyId }, select: { typeId: true } });
    if (!r) throw new NotFoundException('Request not found');
    const rows = await this.prisma.asset.findMany({
      where: { companyId, typeId: r.typeId, status: AssetStatus.AVAILABLE },
      select: { id: true, tag: true, name: true, brand: true, model: true, condition: true, warrantyUntil: true, purchaseDate: true },
      take: 50,
    });
    return rows
      .sort((a, b) => CONDITION_RANK[a.condition] - CONDITION_RANK[b.condition] || (b.warrantyUntil?.getTime() ?? 0) - (a.warrantyUntil?.getTime() ?? 0))
      .slice(0, 8)
      .map((a) => ({ ...a, warrantyUntil: a.warrantyUntil ? keyFromDate(a.warrantyUntil) : null, purchaseDate: a.purchaseDate ? keyFromDate(a.purchaseDate) : null }));
  }

  // ─── Rules ─────────────────────────────────────────────────

  /** The person the request is for: me, or someone in my team (I'm their manager up the line, or their team lead). */
  private async target(companyId: string, access: AccessContext, forEmployeeId?: string) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    const id = forEmployeeId ?? access.employee.id;
    const e = await this.prisma.employee.findFirst({ where: { id, companyId, ...LIVE }, select: { id: true, userId: true, firstName: true, lastName: true } });
    if (!e) throw new NotFoundException('Employee not found');
    if (id !== access.employee.id && !(await this.inMyTeam(companyId, access.employee.id, id))) throw new ForbiddenException('You can only ask for people in your team');
    return e;
  }

  private async inMyTeam(companyId: string, me: string, them: string) {
    const [above, led] = await Promise.all([
      this.prisma.employeeHierarchy.count({ where: { companyId, ancestorId: me, descendantId: them, depth: { gte: 1 } } }),
      this.prisma.projectMember.count({ where: { companyId, employeeId: them, leadEmployeeId: me, OR: [{ endDate: null }, { endDate: { gte: new Date() } }] } }),
    ]);
    return above + led > 0;
  }

  /** People I can ask for (reports down the line and people I lead on projects). */
  private async myTeam(companyId: string, access: AccessContext) {
    if (!access.employee) return [];
    const me = access.employee.id;
    const [below, led] = await Promise.all([
      this.prisma.employeeHierarchy.findMany({ where: { companyId, ancestorId: me, depth: { gte: 1 }, descendant: LIVE }, select: { descendantId: true } }),
      this.prisma.projectMember.findMany({ where: { companyId, leadEmployeeId: me, OR: [{ endDate: null }, { endDate: { gte: new Date() } }], employee: LIVE }, select: { employeeId: true } }),
    ]);
    const ids = [...new Set([...below.map((b) => b.descendantId), ...led.map((l) => l.employeeId)])];
    if (!ids.length) return [];
    return this.prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, avatarUrl: true, joiningDate: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] });
  }

  /** Team lead (their lead on a live project, biggest allocation) and line manager — users, not the requester. */
  private async chain(companyId: string, target: { id: string; userId: string }, requesterEmployeeId: string | null) {
    const requester = requesterEmployeeId ? await this.prisma.employee.findUnique({ where: { id: requesterEmployeeId }, select: { userId: true } }) : null;
    const not = new Set([target.userId, requester?.userId].filter(Boolean) as string[]);
    const now = new Date();
    const [member, line] = await Promise.all([
      this.prisma.projectMember.findFirst({
        where: {
          companyId,
          employeeId: target.id,
          role: ProjectRole.MEMBER,
          leadEmployeeId: { not: null },
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          project: { status: { in: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD] } },
          lead: LIVE,
        },
        orderBy: { allocation: 'desc' },
        select: { lead: { select: { userId: true } } },
      }),
      this.prisma.employeeHierarchy.findFirst({ where: { companyId, descendantId: target.id, depth: 1, ancestor: LIVE }, select: { ancestor: { select: { userId: true } } } }),
    ]);
    const lead = member?.lead && !not.has(member.lead.userId) ? member.lead.userId : null;
    const manager = line && !not.has(line.ancestor.userId) && line.ancestor.userId !== lead ? line.ancestor.userId : null;
    return { lead, manager };
  }

  private fields(stage: Stage) {
    const p = stage === 'LEAD' ? 'lead' : stage === 'MANAGER' ? 'manager' : stage === 'HR' ? 'hr' : 'it';
    return { status: `${p}Status`, by: `${p}ById`, at: `${p}At`, note: `${p}Note` } as const;
  }

  private nextStage(r: Row, after: Stage): Stage | null {
    for (const s of ORDER.slice(ORDER.indexOf(after) + 1)) {
      if (r[this.fields(s).status as 'leadStatus'] === LeaveApprovalStatus.PENDING) return s;
    }
    return null;
  }

  /** The step I may decide now (and on whose behalf). */
  private decideAs(access: AccessContext, r: Row): { stage: Stage; onBehalfOf: string | null } | null {
    if (r.status !== AssetRequestStatus.PENDING || !r.stage || r.employee.userId === access.userId) return null;
    if (r.requestedById && r.requestedById === access.employee?.id) return null;
    const stage = r.stage as Stage;
    const decidedOther = [r.leadById, r.managerById, r.hrById, r.itById].includes(access.userId);
    if (decidedOther) return null;
    if (stage === 'LEAD' || stage === 'MANAGER') {
      const who = stage === 'LEAD' ? r.leadApproverId : r.managerApproverId;
      if (!who) return null;
      if (who === access.userId) return { stage, onBehalfOf: null };
      const cover = access.delegations.find((d) => d.fromUserId === who);
      return cover ? { stage, onBehalfOf: who } : null;
    }
    if (stage === 'HR' && access.grants.has(HR)) return { stage, onBehalfOf: null };
    if (stage === 'IT' && access.grants.has(IT)) return { stage, onBehalfOf: null };
    return null;
  }

  private async decidable(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.assetRequest.findFirst({ where: { id, companyId }, select: SELECT });
    if (!r || r.employee.userId === access.userId) throw new NotFoundException('Request not found');
    if (r.status !== AssetRequestStatus.PENDING) throw new ConflictException('This request has already been decided');
    const d = this.decideAs(access, r);
    if (!d) throw new ForbiddenException('This request is waiting for someone else');
    return { r, stage: d.stage };
  }

  private async requesterUser(r: Pick<Row, 'requestedById'>): Promise<string[]> {
    if (!r.requestedById) return [];
    const e = await this.prisma.employee.findUnique({ where: { id: r.requestedById }, select: { userId: true } });
    return e ? [e.userId] : [];
  }

  private async notifyStage(companyId: string, r: Row) {
    try {
      const stage = r.stage as Stage | null;
      if (!stage) return;
      let to: string[];
      if (stage === 'LEAD' || stage === 'MANAGER') {
        const who = (stage === 'LEAD' ? r.leadApproverId : r.managerApproverId)!;
        to = [who, ...(await this.notifications.coveringFor([who]))];
      } else {
        to = await this.notifications.companyWideApprovers(companyId, stage === 'HR' ? HR : IT);
      }
      const what = `${r.kind === 'LOAN' ? 'to borrow ' : ''}a ${r.type.name.toLowerCase()}`;
      await this.notifications.notify({
        companyId,
        userIds: to.filter((u) => u !== r.employee.userId),
        type: 'asset.requested',
        title: `${r.employee.firstName} ${r.employee.lastName} asks ${what} — your approval as ${STAGE_LABEL[stage].toLowerCase()}`,
        body: `Reason: ${r.reason}`,
        link: '/app/assets/requests',
        actionLabel: 'Review request',
        email: false,
      });
    } catch {
      /* notifications are best-effort */
    }
  }

  private async notifyApproved(companyId: string, r: Row) {
    try {
      await this.notifications.notify({
        companyId,
        userIds: [...new Set([r.employee.userId, ...(await this.requesterUser(r))])],
        type: 'asset.request_approved',
        title: `The ${r.type.name.toLowerCase()} request${r.requestedById ? ` for ${r.employee.firstName}` : ''} was approved`,
        body: 'IT will hand one over soon.',
        link: '/app/assets/mine',
      });
      const it = (await this.notifications.companyWideApprovers(companyId, MANAGE)).filter((u) => u !== r.employee.userId);
      await this.notifications.notify({ companyId, userIds: it, type: 'asset.to_fulfil', title: `Hand over a ${r.type.name.toLowerCase()} to ${r.employee.firstName} ${r.employee.lastName}`, link: '/app/assets/requests', email: false });
    } catch {
      /* best-effort */
    }
  }

  private async names(ids: Array<string | null | undefined>) {
    const list = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    const users = await this.prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, u]));
  }

  private async page(rows: Row[], total: number, page: number, limit: number, access: AccessContext) {
    const names = await this.names(rows.flatMap((r) => [r.leadApproverId, r.managerApproverId, r.leadById, r.managerById, r.hrById, r.itById]));
    const requesters = new Map(
      (await this.prisma.employee.findMany({ where: { id: { in: rows.map((r) => r.requestedById).filter((x): x is string => Boolean(x)) } }, select: { id: true, firstName: true, lastName: true } })).map((e) => [e.id, e]),
    );
    const assets = new Map((await this.prisma.asset.findMany({ where: { id: { in: rows.map((r) => r.assetId).filter((x): x is string => Boolean(x)) } }, select: { id: true, tag: true, name: true } })).map((a) => [a.id, a]));
    const step = (r: Row, s: Stage) => {
      const f = this.fields(s);
      const status = r[f.status as 'leadStatus'];
      const by = r[f.by as 'leadById'];
      const approver = s === 'LEAD' ? r.leadApproverId : s === 'MANAGER' ? r.managerApproverId : null;
      return { stage: s, label: STAGE_LABEL[s], status, approver: approver ? names.get(approver) ?? null : null, by: by ? names.get(by) ?? null : null, at: r[f.at as 'leadAt'], note: r[f.note as 'leadNote'] };
    };
    return {
      data: rows.map((r) => {
        const { userId: _u, joiningDate, ...employee } = r.employee;
        const d = this.decideAs(access, r);
        return {
          id: r.id,
          reason: r.reason,
          status: r.status,
          source: r.source,
          kind: r.kind,
          loanFrom: r.loanFrom ? keyFromDate(r.loanFrom) : null,
          loanUntil: r.loanUntil ? keyFromDate(r.loanUntil) : null,
          neededBy: r.neededBy ? keyFromDate(r.neededBy) : null,
          stage: r.stage,
          createdAt: r.createdAt,
          type: r.type,
          employee: { ...employee, joiningDate: keyFromDate(joiningDate) },
          requestedBy: r.requestedById ? requesters.get(r.requestedById) ?? null : null,
          steps: r.source === 'KIT' ? [] : ORDER.map((s) => step(r, s)),
          asset: r.assetId ? assets.get(r.assetId) ?? null : null,
          canDecide: Boolean(d),
          decideAs: d?.stage ?? null,
          canFulfil: r.status === AssetRequestStatus.APPROVED && holds(access, MANAGE),
          canCancel: r.source === 'REQUEST' && (r.employee.userId === access.userId || r.requestedById === access.employee?.id) && (r.status === AssetRequestStatus.PENDING || r.status === AssetRequestStatus.APPROVED),
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async todayKey(companyId: string) {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }
}
