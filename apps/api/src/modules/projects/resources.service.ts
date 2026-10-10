import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmploymentStatus, Prisma, ProjectRole, ProjectStatus, ResourceRequestKind, ResourceRequestStatus, ResourceStep, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService, room } from '../realtime/realtime.service';
import { AccessService } from '../access/access.service';
import { holds, type AccessContext } from '../access/access.types';
import { addDays, dateFromKey, keyFromDate } from '../attendance/time-zone';
import { allocationOn, peakAllocation, type Span } from './allocation';
import { searchWords } from '../../common/word-search';
import { ProjectsService } from './projects.service';
import type { AvailablePeopleQueryDto, CandidatesQueryDto, ConsentDto, FillDto, HoldDto, RaiseReleaseDto, RaiseRequestDto, ReleaseDecisionDto, RequestListQueryDto, PoolQueryDto } from './resources.dto';

// ============================================================
// Resource requests & releases.
//
// REQUEST  Lead → Project Manager → Delivery Director → PMO
//   PM / DD may fill it with someone already on their projects, pass it on,
//   hold it (reason) or reject it (reason → back to the Lead). Someone not on
//   their projects can only be assigned by the PMO. Taking time off another
//   PM's project needs that PM to agree. An approver may fill at a lower %.
// RELEASE  Lead → Project Manager / Delivery Director
//   They send the person to the PMO pool, move them to another of their
//   projects, keep them, or hold it. The PMO can only nudge.
// Every step → ResourceRequestEvent; every assignment change → AssignmentLog.
// ============================================================

const OPEN_STATES: ResourceRequestStatus[] = [ResourceRequestStatus.OPEN, ResourceRequestStatus.ON_HOLD, ResourceRequestStatus.AWAITING_CONSENT];
const FACE = { id: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } } as const;
const PMO = 'project.manage';
const HOLD_NUDGE_DAYS = 7;
const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (k: string) => `${Number(k.slice(8, 10))} ${MONTHS[Number(k.slice(5, 7)) - 1]}`;
const fullName = (p: { firstName: string; lastName: string } | null | undefined) => (p ? `${p.firstName} ${p.lastName}`.trim() : 'Someone');
const STEP_LABEL: Record<ResourceStep, string> = { PM: 'Project manager', DD: 'Delivery Director', PMO: 'PMO' };

type Row = Prisma.ResourceRequestGetPayload<{ include: { project: { select: { id: true; name: true; code: true; color: true; endDate: true; startDate: true; deliveryDirectorId: true } } } }>;
interface Person {
  employeeId: string;
  userId: string;
}
/** Who is in charge of a project today */
interface InCharge {
  pm: Person | null;
  dd: Person | null;
  leads: string[];
}
interface PendingFill {
  employeeId: string;
  allocation: number;
  note: string | null;
  takeFrom: { memberId: string; allocation: number } | null;
  byUserId: string;
  consentUserId: string;
  consentProject: string;
}

@Injectable()
export class ResourceRequestsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ResourceRequestsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
    private readonly access?: AccessService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.remindHolds().catch((e) => this.logger.error(e)), 60 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ─── Who's who ────────────────────────────────────────────

  private pmo(access: AccessContext) {
    return holds(access, PMO);
  }

  /** PM, Delivery Director and team leads of a project today. */
  private async inCharge(projectId: string, today: string): Promise<InCharge> {
    const t = dateFromKey(today);
    const live = { startDate: { lte: t }, OR: [{ endDate: null }, { endDate: { gte: t } }] };
    const [members, project] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId, role: { in: [ProjectRole.MANAGER, ProjectRole.TEAM_LEAD] }, ...live, employee: { employmentStatus: { not: EmploymentStatus.TERMINATED } } },
        select: { role: true, employee: { select: { id: true, userId: true } } },
      }),
      this.prisma.project.findUnique({ where: { id: projectId }, select: { deliveryDirector: { select: { id: true, userId: true, employmentStatus: true } } } }),
    ]);
    const pm = members.find((m) => m.role === ProjectRole.MANAGER)?.employee ?? null;
    const dd = project?.deliveryDirector && project.deliveryDirector.employmentStatus !== EmploymentStatus.TERMINATED ? project.deliveryDirector : null;
    return {
      pm: pm ? { employeeId: pm.id, userId: pm.userId } : null,
      dd: dd ? { employeeId: dd.id, userId: dd.userId } : null,
      leads: members.filter((m) => m.role === ProjectRole.TEAM_LEAD).map((m) => m.employee.id),
    };
  }

  /** Projects this person manages (PM today) or directs (Delivery Director). */
  private async myProjects(access: AccessContext, today: string): Promise<{ pm: string[]; dd: string[]; lead: string[] }> {
    const me = access.employee?.id;
    if (!me || !access.companyId) return { pm: [], dd: [], lead: [] };
    const t = dateFromKey(today);
    const [roles, dd] = await Promise.all([
      this.prisma.projectMember.findMany({ where: { employeeId: me, role: { in: [ProjectRole.MANAGER, ProjectRole.TEAM_LEAD] }, startDate: { lte: t }, OR: [{ endDate: null }, { endDate: { gte: t } }] }, select: { projectId: true, role: true } }),
      this.prisma.project.findMany({ where: { companyId: access.companyId, deliveryDirectorId: me, status: { not: ProjectStatus.COMPLETED } }, select: { id: true } }),
    ]);
    return {
      pm: [...new Set(roles.filter((r) => r.role === ProjectRole.MANAGER).map((r) => r.projectId))],
      lead: [...new Set(roles.filter((r) => r.role === ProjectRole.TEAM_LEAD).map((r) => r.projectId))],
      dd: dd.map((p) => p.id),
    };
  }

  /** Where a new request starts (skipping steps the raiser holds or the project lacks). */
  private firstStep(c: InCharge, raiserEmployeeId: string | null): ResourceStep {
    if (c.pm && c.pm.employeeId !== raiserEmployeeId) return ResourceStep.PM;
    return this.after(ResourceStep.PM, c);
  }

  /** The step after this one (no DD, or the PM is also the DD → straight to the PMO). */
  private after(step: ResourceStep, c: InCharge): ResourceStep {
    if (step === ResourceStep.PM && c.dd && c.dd.employeeId !== c.pm?.employeeId) return ResourceStep.DD;
    return ResourceStep.PMO;
  }

  /** May this person act on the request now? */
  private canAct(access: AccessContext, r: Row, c: InCharge): boolean {
    const me = access.employee?.id;
    if (r.status === ResourceRequestStatus.AWAITING_CONSENT) return (r.pendingFill as unknown as PendingFill | null)?.consentUserId === access.userId;
    if (r.status !== ResourceRequestStatus.OPEN && r.status !== ResourceRequestStatus.ON_HOLD) return false;
    if (r.raisedByUserId === access.userId) return false; // nobody approves their own request
    if (r.kind === ResourceRequestKind.RELEASE) return Boolean(me && (c.pm?.employeeId === me || c.dd?.employeeId === me));
    if (r.step === ResourceStep.PM) return Boolean(me && c.pm?.employeeId === me);
    if (r.step === ResourceStep.DD) return Boolean(me && c.dd?.employeeId === me);
    return this.pmo(access);
  }

  /** Users who act on the request now (for notifications and live updates). */
  private async actors(r: Row, c: InCharge): Promise<string[]> {
    if (r.status === ResourceRequestStatus.AWAITING_CONSENT) return [(r.pendingFill as unknown as PendingFill).consentUserId];
    if (r.kind === ResourceRequestKind.RELEASE) return [c.pm?.userId, c.dd?.userId].filter((x): x is string => Boolean(x));
    if (r.step === ResourceStep.PM) return c.pm ? [c.pm.userId] : [];
    if (r.step === ResourceStep.DD) return c.dd ? [c.dd.userId] : [];
    return this.notifications.companyWideApprovers(r.companyId, PMO);
  }

  /** Is this employee on a project the actor manages (PM) or directs (DD) during the window? (PMO: everyone) */
  private async underMe(access: AccessContext, employeeId: string, mine: { pm: string[]; dd: string[] }, from: string, to: string | null): Promise<boolean> {
    if (this.pmo(access)) return true;
    const projects = [...mine.pm, ...mine.dd];
    if (!projects.length) return false;
    return (await this.prisma.projectMember.count({ where: { employeeId, projectId: { in: projects }, ...this.overlap(from, to) } })) > 0;
  }

  private overlap(from: string, to: string | null): Prisma.ProjectMemberWhereInput {
    return { ...(to && { startDate: { lte: dateFromKey(to) } }), OR: [{ endDate: null }, { endDate: { gte: dateFromKey(from) } }] };
  }

  // ─── Raise ────────────────────────────────────────────────

  async raise(companyId: string, access: AccessContext, dto: RaiseRequestDto) {
    const me = access.employee?.id;
    if (!me) throw new BadRequestException('Your account has no employee profile');
    const today = await this.projects.todayKey(companyId);
    const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, companyId }, select: { id: true, name: true, status: true, startDate: true, endDate: true } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.status === ProjectStatus.COMPLETED) throw new BadRequestException('This project is completed');
    const c = await this.inCharge(project.id, today);
    if (!c.leads.includes(me) && c.pm?.employeeId !== me) throw new ForbiddenException('Only the project’s team leads and project manager can request people');
    if (dto.untilDate && dto.untilDate < dto.fromDate) throw new BadRequestException('The end is before the start');
    if (dto.fromDate < today) throw new BadRequestException('The start can’t be in the past');
    if (project.endDate && dto.fromDate > keyFromDate(project.endDate)) throw new BadRequestException('The project ends before that');
    if (dto.preferredEmployeeId) {
      const p = await this.prisma.employee.findFirst({ where: { id: dto.preferredEmployeeId, companyId }, select: { employmentStatus: true, firstName: true } });
      if (!p) throw new NotFoundException('Preferred person not found');
      if (p.employmentStatus === EmploymentStatus.TERMINATED) throw new BadRequestException(`${p.firstName} has left the company`);
    }
    if (dto.previousRequestId && !(await this.prisma.resourceRequest.count({ where: { id: dto.previousRequestId, companyId } }))) throw new NotFoundException('Earlier request not found');
    const step = this.firstStep(c, me);
    const r = await this.prisma.$transaction(async (tx) => {
      const row = await tx.resourceRequest.create({
        data: {
          companyId,
          projectId: project.id,
          kind: ResourceRequestKind.REQUEST,
          step,
          raisedByUserId: access.userId,
          raisedByEmployeeId: me,
          reason: dto.reason,
          title: dto.title,
          skills: [...new Map((dto.skills ?? []).map((s) => s.trim()).filter(Boolean).map((s) => [s.toLowerCase(), s])).values()],
          allocation: dto.allocation,
          fromDate: dateFromKey(dto.fromDate),
          untilDate: dto.untilDate ? dateFromKey(dto.untilDate) : null,
          preferredEmployeeId: dto.preferredEmployeeId ?? null,
          previousRequestId: dto.previousRequestId ?? null,
        },
        include: { project: { select: PROJECT } },
      });
      await tx.resourceRequestEvent.create({ data: { companyId, requestId: row.id, actorUserId: access.userId, kind: 'raised', note: dto.reason, data: { step, ...(dto.previousRequestId && { again: dto.previousRequestId }) } } });
      return row;
    });
    const to = await this.actors(r, c);
    await this.tell(companyId, to, 'resource.request', `${await this.userName(access.userId)} asked for a ${dto.title} on ${project.name}`, `${dto.allocation}% from ${fmt(dto.fromDate)} — ${dto.reason}`, r.id, 'Review');
    this.live(r, [...to, access.userId]);
    return this.detail(companyId, access, r.id);
  }

  /** A Lead no longer needs someone: goes to the PM / Delivery Director. */
  async raiseRelease(companyId: string, access: AccessContext, dto: RaiseReleaseDto) {
    const me = access.employee?.id;
    if (!me) throw new BadRequestException('Your account has no employee profile');
    const today = await this.projects.todayKey(companyId);
    const m = await this.prisma.projectMember.findFirst({
      where: { id: dto.memberId, companyId },
      select: { id: true, projectId: true, employeeId: true, startDate: true, endDate: true, role: true, project: { select: { name: true, status: true } }, employee: { select: { firstName: true, lastName: true } } },
    });
    if (!m) throw new NotFoundException('Assignment not found');
    if (m.role === ProjectRole.MANAGER) throw new BadRequestException('Change the project manager in the project settings');
    if (m.employeeId === me) throw new BadRequestException('Ask your project manager to release you');
    const c = await this.inCharge(m.projectId, today);
    if (!c.leads.includes(me) && c.pm?.employeeId !== me) throw new ForbiddenException('Only the project’s team leads and project manager can release people');
    if (dto.lastDate < today) throw new BadRequestException('The last day can’t be in the past');
    if (m.endDate && dto.lastDate > keyFromDate(m.endDate)) throw new BadRequestException(`Their time here already ends on ${fmt(keyFromDate(m.endDate))}`);
    if (await this.prisma.resourceRequest.count({ where: { memberId: m.id, kind: ResourceRequestKind.RELEASE, status: { in: OPEN_STATES } } })) {
      throw new ConflictException(`A release for ${m.employee.firstName} is already waiting`);
    }
    const r = await this.prisma.$transaction(async (tx) => {
      const row = await tx.resourceRequest.create({
        data: {
          companyId,
          projectId: m.projectId,
          kind: ResourceRequestKind.RELEASE,
          step: ResourceStep.PM,
          raisedByUserId: access.userId,
          raisedByEmployeeId: me,
          reason: dto.reason,
          memberId: m.id,
          releaseEmployeeId: m.employeeId,
          lastDate: dateFromKey(dto.lastDate),
          handover: dto.handover ?? null,
        },
        include: { project: { select: PROJECT } },
      });
      await tx.resourceRequestEvent.create({ data: { companyId, requestId: row.id, actorUserId: access.userId, kind: 'raised', note: dto.reason, data: { lastDate: dto.lastDate } } });
      return row;
    });
    // The person isn't told yet — only once the PM / Delivery Director decides
    const to = (await this.actors(r, c)).filter((u) => u !== access.userId);
    await this.tell(companyId, to, 'resource.release', `${await this.userName(access.userId)} no longer needs ${fullName(m.employee)} on ${m.project.name}`, `Last day ${fmt(dto.lastDate)} — ${dto.reason}`, r.id, 'Decide');
    this.live(r, [...to, access.userId]);
    return this.detail(companyId, access, r.id);
  }

  // ─── Decide ───────────────────────────────────────────────

  /** Approve and pass on: PM → Delivery Director → PMO. */
  async forward(companyId: string, access: AccessContext, id: string, note: string | null) {
    const { r, c } = await this.actionable(companyId, access, id, [ResourceRequestStatus.OPEN]);
    if (r.kind !== ResourceRequestKind.REQUEST) throw new BadRequestException('Releases are decided by the PM or Delivery Director');
    if (r.step === ResourceStep.PMO) throw new BadRequestException('The PMO is the last step — assign someone or reject it');
    const next = this.after(r.step, c);
    const saved = await this.update(r, access.userId, { step: next }, 'forwarded', note, { from: r.step, to: next });
    const to = await this.actors(saved, c);
    await this.tell(companyId, to, 'resource.request', `${r.title} for ${r.project.name} is waiting for you`, `${await this.userName(access.userId)} approved it${note ? `: ${note}` : ''}`, r.id, 'Review');
    await this.tell(companyId, [r.raisedByUserId], 'resource.progress', `Your request for a ${r.title} moved to the ${STEP_LABEL[next]}`, note, r.id);
    this.live(saved, [...to, access.userId, r.raisedByUserId]);
    return this.detail(companyId, access, id);
  }

  /** Hold: reason required; the Lead is told. */
  async hold(companyId: string, access: AccessContext, id: string, dto: HoldDto) {
    const { r, c } = await this.actionable(companyId, access, id, [ResourceRequestStatus.OPEN]);
    const today = await this.projects.todayKey(companyId);
    if (dto.remindAt && dto.remindAt <= today) throw new BadRequestException('Pick a reminder day after today');
    const saved = await this.update(
      r,
      access.userId,
      { status: ResourceRequestStatus.ON_HOLD, holdReason: dto.reason, heldAt: new Date(), heldByUserId: access.userId, remindAt: dto.remindAt ? dateFromKey(dto.remindAt) : null, remindedAt: null, holdNudgedAt: null },
      'held',
      dto.reason,
      dto.remindAt ? { remindAt: dto.remindAt } : undefined,
    );
    await this.tell(companyId, [r.raisedByUserId], 'resource.hold', `${await this.userName(access.userId)} put your ${this.what(r)} on hold`, `Reason: ${dto.reason}`, r.id);
    this.live(saved, [...(await this.actors(saved, c)), r.raisedByUserId]);
    return this.detail(companyId, access, id);
  }

  async unhold(companyId: string, access: AccessContext, id: string, note: string | null) {
    const { r, c } = await this.actionable(companyId, access, id, [ResourceRequestStatus.ON_HOLD]);
    const saved = await this.update(r, access.userId, { status: ResourceRequestStatus.OPEN, holdReason: null, heldAt: null, heldByUserId: null, remindAt: null }, 'unheld', note);
    await this.tell(companyId, [r.raisedByUserId], 'resource.progress', `Your ${this.what(r)} is off hold`, note, r.id);
    this.live(saved, [...(await this.actors(saved, c)), r.raisedByUserId]);
    return this.detail(companyId, access, id);
  }

  /** Reject: reason required; closes and goes back to the Lead (who can raise it again). */
  async reject(companyId: string, access: AccessContext, id: string, reason: string) {
    const { r, c } = await this.actionable(companyId, access, id, [ResourceRequestStatus.OPEN]);
    if (r.kind !== ResourceRequestKind.REQUEST) throw new BadRequestException('Use “Keep” to decline a release');
    const saved = await this.update(r, access.userId, { status: ResourceRequestStatus.REJECTED, outcomeNote: reason, decidedByUserId: access.userId, decidedAt: new Date() }, 'rejected', reason, { step: r.step });
    await this.tell(companyId, [r.raisedByUserId], 'resource.rejected', `Your request for a ${r.title} on ${r.project.name} was rejected`, `Reason: ${reason}`, r.id, 'Raise again');
    this.live(saved, [...(await this.actors(r, c)), r.raisedByUserId, access.userId]);
    return this.detail(companyId, access, id);
  }

  /** The Lead takes it back before it's filled. */
  async withdraw(companyId: string, access: AccessContext, id: string, note: string | null) {
    const r = await this.load(companyId, id);
    if (r.raisedByUserId !== access.userId) throw new ForbiddenException('Only the person who raised it can withdraw it');
    if (!OPEN_STATES.includes(r.status)) throw new ConflictException('It has already been decided');
    const c = await this.inCharge(r.projectId, await this.projects.todayKey(companyId));
    const to = await this.actors(r, c);
    const saved = await this.update(r, access.userId, { status: ResourceRequestStatus.WITHDRAWN, pendingFill: Prisma.DbNull, decidedAt: new Date(), decidedByUserId: access.userId }, 'withdrawn', note);
    await this.tell(companyId, to, 'resource.withdrawn', `${await this.userName(access.userId)} withdrew the ${this.what(r)} on ${r.project.name}`, note, r.id);
    this.live(saved, [...to, access.userId]);
    return this.detail(companyId, access, id);
  }

  /** PMO nudges the PM / Delivery Director about something waiting with them. */
  async nudge(companyId: string, access: AccessContext, id: string) {
    if (!this.pmo(access)) throw new ForbiddenException('Only the PMO can nudge');
    const r = await this.load(companyId, id);
    if (!OPEN_STATES.includes(r.status)) throw new ConflictException('It has already been decided');
    if (r.kind === ResourceRequestKind.REQUEST && r.step === ResourceStep.PMO) throw new BadRequestException('It’s waiting for the PMO');
    if (r.nudgedAt && Date.now() - r.nudgedAt.getTime() < DAY) throw new BadRequestException('Already nudged today');
    const c = await this.inCharge(r.projectId, await this.projects.todayKey(companyId));
    const to = await this.actors(r, c);
    if (!to.length) throw new BadRequestException('Nobody is in charge of this project to nudge');
    const saved = await this.update(r, access.userId, { nudgedAt: new Date() }, 'nudged', null);
    await this.tell(companyId, to, 'resource.nudge', `Reminder from the PMO: the ${this.what(r)} on ${r.project.name} is waiting for you`, r.status === ResourceRequestStatus.ON_HOLD ? `On hold: ${r.holdReason}` : r.reason, r.id, 'Decide');
    this.live(saved, [...to, access.userId]);
    return this.detail(companyId, access, id);
  }

  // ─── Fill ─────────────────────────────────────────────────

  /**
   * Fill a request: the preferred person or another fit, at the asked % or
   * lower (with a note). PM / DD only with people on their projects; the PMO
   * with anyone. Taking time off another PM's project waits for that PM.
   */
  async fill(companyId: string, access: AccessContext, id: string, dto: FillDto) {
    const { r, c } = await this.actionable(companyId, access, id, [ResourceRequestStatus.OPEN]);
    if (r.kind !== ResourceRequestKind.REQUEST) throw new BadRequestException('This is a release');
    const today = await this.projects.todayKey(companyId);
    const { from, until } = this.window(r, today);
    if (dto.allocation > (r.allocation ?? 100)) throw new BadRequestException(`They asked for ${r.allocation}% — fill at that or less`);
    if (dto.allocation < (r.allocation ?? 0) && !dto.note?.trim()) throw new BadRequestException(`Add a note for the Lead: they asked for ${r.allocation}%`);
    const person = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId }, select: { id: true, userId: true, firstName: true, lastName: true, employmentStatus: true } });
    if (!person) throw new NotFoundException('Employee not found');
    if (person.employmentStatus === EmploymentStatus.TERMINATED) throw new BadRequestException(`${person.firstName} has left the company`);
    const mine = await this.myProjects(access, today);
    if (!(await this.underMe(access, person.id, mine, from, until))) {
      throw new ForbiddenException(`${person.firstName} isn’t on your projects — only the PMO can assign them. Approve it onward instead.`);
    }

    // Time taken off another project: whose agreement is needed?
    let consent: { userId: string; project: string } | null = null;
    if (dto.takeFrom) {
      const src = await this.prisma.projectMember.findFirst({ where: { id: dto.takeFrom.memberId, employeeId: person.id }, select: { id: true, projectId: true, allocation: true, project: { select: { name: true } } } });
      if (!src) throw new NotFoundException('That assignment isn’t theirs');
      if (src.projectId === r.projectId) throw new BadRequestException('They’re already on this project');
      if (dto.takeFrom.allocation >= src.allocation) throw new BadRequestException(`Leave less than their current ${src.allocation}% on ${src.project.name}`);
      const owner = await this.inCharge(src.projectId, today);
      const me = access.employee?.id;
      const theirs = me && (owner.pm?.employeeId === me || owner.dd?.employeeId === me);
      const agreeer = owner.pm ?? owner.dd;
      if (!theirs && agreeer && agreeer.userId !== access.userId) consent = { userId: agreeer.userId, project: src.project.name };
    }
    await this.assertFits(person.id, from, until, dto.allocation, dto.takeFrom ?? null, person.firstName);

    if (consent) {
      const pending: PendingFill = { employeeId: person.id, allocation: dto.allocation, note: dto.note ?? null, takeFrom: dto.takeFrom ?? null, byUserId: access.userId, consentUserId: consent.userId, consentProject: consent.project };
      const saved = await this.update(r, access.userId, { status: ResourceRequestStatus.AWAITING_CONSENT, pendingFill: pending as unknown as Prisma.InputJsonValue }, 'consent_asked', dto.note ?? null, { employeeId: person.id, allocation: dto.allocation, project: consent.project });
      await this.tell(companyId, [consent.userId], 'resource.consent', `${await this.userName(access.userId)} wants ${fullName(person)} on ${r.project.name}`, `That cuts their time on ${consent.project} to ${dto.takeFrom!.allocation}% from ${fmt(from)}. Do you agree?`, r.id, 'Agree or decline');
      this.live(saved, [consent.userId, access.userId, r.raisedByUserId]);
      return this.detail(companyId, access, id);
    }
    await this.applyFill(r, access.userId, { employeeId: person.id, allocation: dto.allocation, note: dto.note ?? null, takeFrom: dto.takeFrom ?? null }, today);
    this.live(await this.load(companyId, id), [...(await this.actors(r, c)), access.userId, r.raisedByUserId]);
    return this.detail(companyId, access, id);
  }

  /** The other PM agrees (the fill goes through) or declines (back to whoever was filling). */
  async consent(companyId: string, access: AccessContext, id: string, dto: ConsentDto) {
    const r = await this.load(companyId, id);
    const p = r.pendingFill as unknown as PendingFill | null;
    if (r.status !== ResourceRequestStatus.AWAITING_CONSENT || !p) throw new ConflictException('Nothing is waiting for your agreement');
    if (p.consentUserId !== access.userId) throw new ForbiddenException('This is waiting for another project manager');
    const today = await this.projects.todayKey(companyId);
    if (!dto.agree) {
      const saved = await this.update(r, access.userId, { status: ResourceRequestStatus.OPEN, pendingFill: Prisma.DbNull }, 'consent_declined', dto.note ?? null, { project: p.consentProject });
      await this.tell(companyId, [p.byUserId], 'resource.consent', `${await this.userName(access.userId)} didn’t agree to move someone off ${p.consentProject}`, dto.note ?? 'Pick someone else or ask the PMO.', r.id, 'Review');
      this.live(saved, [p.byUserId, access.userId, r.raisedByUserId]);
      return this.detail(companyId, access, id);
    }
    await this.prisma.resourceRequestEvent.create({ data: { companyId, requestId: r.id, actorUserId: access.userId, kind: 'consent_given', note: dto.note ?? null, data: { project: p.consentProject } } });
    await this.applyFill(r, p.byUserId, p, today);
    this.live(await this.load(companyId, id), [p.byUserId, access.userId, r.raisedByUserId]);
    return this.detail(companyId, access, id);
  }

  private window(r: Row, today: string) {
    const start = r.fromDate ? keyFromDate(r.fromDate) : today;
    const from = start < today ? today : start;
    const projectEnd = r.project.endDate ? keyFromDate(r.project.endDate) : null;
    const until = r.untilDate ? keyFromDate(r.untilDate) : projectEnd;
    return { from, until: until && projectEnd && until > projectEnd ? projectEnd : until };
  }

  /** Over 100% anywhere in the window (after any time taken off another project) → refuse, with the free %. */
  private async assertFits(employeeId: string, from: string, until: string | null, allocation: number, takeFrom: { memberId: string; allocation: number } | null, name: string) {
    const rows = await this.prisma.projectMember.findMany({ where: { employeeId, project: { status: { not: ProjectStatus.COMPLETED } } }, select: { id: true, allocation: true, startDate: true, endDate: true } });
    const spans: Span[] = rows.map((m) => ({ allocation: takeFrom && m.id === takeFrom.memberId ? takeFrom.allocation : m.allocation, start: keyFromDate(m.startDate), end: m.endDate ? keyFromDate(m.endDate) : null }));
    const peak = peakAllocation(spans, from, until);
    if (peak + allocation > 100) {
      throw new BadRequestException(`${name} would be ${peak + allocation}% booked — only ${Math.max(0, 100 - peak)}% is free from ${fmt(from)}${takeFrom ? '' : '. Take time off one of their projects, or fill at a lower %'}`);
    }
  }

  /** Book the person (and cut their other project first, if agreed). */
  private async applyFill(r: Row, byUserId: string, f: { employeeId: string; allocation: number; note: string | null; takeFrom: { memberId: string; allocation: number } | null }, today: string) {
    const { from, until } = this.window(r, today);
    const companyId = r.companyId;
    if (f.takeFrom) await this.cut(companyId, f.takeFrom.memberId, from, f.takeFrom.allocation, byUserId, r.id);
    // Under the Lead who asked, when they lead on this project
    const c = await this.inCharge(r.projectId, today);
    const lead = r.raisedByEmployeeId && c.leads.includes(r.raisedByEmployeeId) ? r.raisedByEmployeeId : null;
    await this.projects.addMember(
      companyId,
      r.projectId,
      { employeeId: f.employeeId, role: ProjectRole.MEMBER, leadEmployeeId: lead, allocation: f.allocation, startDate: from, endDate: until },
      byUserId,
      { requestId: r.id, action: 'assigned', note: `Filled the request “${r.title}”${f.allocation < (r.allocation ?? 0) ? ` at ${f.allocation}% (asked ${r.allocation}%)` : ''}` },
    );
    const saved = await this.update(
      r,
      byUserId,
      { status: ResourceRequestStatus.FILLED, pendingFill: Prisma.DbNull, filledEmployeeId: f.employeeId, filledAllocation: f.allocation, outcomeNote: f.note, decidedByUserId: byUserId, decidedAt: new Date() },
      'filled',
      f.note,
      { employeeId: f.employeeId, allocation: f.allocation, step: r.step },
    );
    const person = await this.prisma.employee.findUniqueOrThrow({ where: { id: f.employeeId }, select: { userId: true, firstName: true, lastName: true } });
    const lower = f.allocation < (r.allocation ?? 0) ? ` at ${f.allocation}% (you asked ${r.allocation}%)` : '';
    await this.tell(companyId, [r.raisedByUserId], 'resource.filled', `${fullName(person)} joins ${r.project.name}${lower}`, `From ${fmt(from)} — your request for a ${r.title}${f.note ? `. Note: ${f.note}` : ''}`, r.id);
    // The person hears only now (never while they were just "requested")
    await this.tell(companyId, [person.userId], 'project.assigned', `You’ve been added to ${r.project.name}`, `${f.allocation}% from ${fmt(from)}${until ? ` to ${fmt(until)}` : ''}`, null, 'Open', `/app/projects/${r.projectId}`);
    return saved;
  }

  /** Their time on another project drops from a date (0 = it ends the day before). */
  private async cut(companyId: string, memberId: string, from: string, allocation: number, actorUserId: string, requestId: string) {
    const m = await this.prisma.projectMember.findUniqueOrThrow({ where: { id: memberId }, select: { id: true, projectId: true, employeeId: true, role: true, leadEmployeeId: true, billed: true, nightShift: true, startDate: true, endDate: true, allocation: true } });
    const start = keyFromDate(m.startDate);
    const end = m.endDate ? keyFromDate(m.endDate) : null;
    const note = allocation === 0 ? 'Time here ended to join another project' : `Cut to ${allocation}% to join another project`;
    if (allocation === 0) return this.projects.endMember(companyId, m.projectId, m.id, addDays(from, -1), actorUserId, 'changed', { requestId, note });
    if (start >= from) {
      return this.projects.updateMember(companyId, m.projectId, m.id, { employeeId: m.employeeId, role: m.role, leadEmployeeId: m.leadEmployeeId, allocation, startDate: start, endDate: end, billed: m.billed, nightShift: m.nightShift }, actorUserId, { requestId, action: 'changed', note });
    }
    // Keep the past as it was: end the old booking, start a smaller one
    await this.projects.endMember(companyId, m.projectId, m.id, addDays(from, -1), actorUserId, 'changed', { requestId, note });
    await this.projects.addMember(companyId, m.projectId, { employeeId: m.employeeId, role: m.role, leadEmployeeId: m.leadEmployeeId, allocation, startDate: from, endDate: end, billed: m.billed, nightShift: m.nightShift }, actorUserId, { requestId, action: 'changed', note });
  }

  // ─── Release decision ─────────────────────────────────────

  async decideRelease(companyId: string, access: AccessContext, id: string, dto: ReleaseDecisionDto) {
    const { r, c } = await this.actionable(companyId, access, id, [ResourceRequestStatus.OPEN]);
    if (r.kind !== ResourceRequestKind.RELEASE) throw new BadRequestException('This is a request');
    if (!r.memberId || !r.releaseEmployeeId || !r.lastDate) throw new BadRequestException('This release is missing its assignment');
    const member = await this.prisma.projectMember.findUnique({ where: { id: r.memberId }, select: { id: true, allocation: true } });
    const person = await this.prisma.employee.findUniqueOrThrow({ where: { id: r.releaseEmployeeId }, select: { userId: true, firstName: true, lastName: true } });
    const lastDay = keyFromDate(r.lastDate);
    const by = await this.userName(access.userId);

    if (dto.outcome === 'keep') {
      if (!dto.note?.trim()) throw new BadRequestException('Say why they stay');
      const saved = await this.update(r, access.userId, { status: ResourceRequestStatus.KEPT, outcomeNote: dto.note, decidedByUserId: access.userId, decidedAt: new Date() }, 'kept', dto.note);
      await this.tell(companyId, [r.raisedByUserId], 'resource.kept', `${fullName(person)} stays on ${r.project.name}`, `${by}: ${dto.note}`, r.id);
      this.live(saved, [...(await this.actors(r, c)), r.raisedByUserId]);
      return this.detail(companyId, access, id);
    }
    if (!member) throw new NotFoundException('Their assignment no longer exists');

    if (dto.outcome === 'pool') {
      await this.projects.endMember(companyId, r.projectId, member.id, lastDay, access.userId, 'to_pool', { requestId: r.id, note: `Released to the PMO pool${dto.note ? ` — ${dto.note}` : ''}` });
      const saved = await this.update(r, access.userId, { status: ResourceRequestStatus.RELEASED, outcomeNote: dto.note ?? null, decidedByUserId: access.userId, decidedAt: new Date() }, 'released', dto.note ?? null);
      const pmo = await this.notifications.companyWideApprovers(companyId, PMO);
      await this.tell(companyId, [r.raisedByUserId], 'resource.released', `${fullName(person)} goes to the PMO pool after ${fmt(lastDay)}`, dto.note, r.id);
      await this.tell(companyId, [person.userId], 'resource.released', `Your time on ${r.project.name} ends on ${fmt(lastDay)}`, 'You join the PMO pool — the PMO will find your next project.', null);
      await this.tell(companyId, pmo, 'resource.pool', `${fullName(person)} joins the PMO pool after ${fmt(lastDay)}`, `Released from ${r.project.name} by ${by}`, null, 'Open the pool', '/app/pmo-pool');
      this.live(saved, [...(await this.actors(r, c)), r.raisedByUserId, ...pmo]);
      return this.detail(companyId, access, id);
    }

    // Reassign to another project the decider manages or directs
    if (!dto.targetProjectId) throw new BadRequestException('Pick the project they move to');
    if (dto.targetProjectId === r.projectId) throw new BadRequestException('Pick another project');
    const today = await this.projects.todayKey(companyId);
    const mine = await this.myProjects(access, today);
    if (!mine.pm.includes(dto.targetProjectId) && !mine.dd.includes(dto.targetProjectId)) throw new ForbiddenException('You can only move them to a project you manage or direct');
    const target = await this.prisma.project.findFirst({ where: { id: dto.targetProjectId, companyId }, select: { id: true, name: true, endDate: true } });
    if (!target) throw new NotFoundException('Project not found');
    const start = dto.startDate ?? addDays(lastDay, 1);
    if (start <= lastDay) throw new BadRequestException(`Start after their last day here (${fmt(lastDay)})`);
    const allocation = dto.allocation ?? member.allocation;
    await this.projects.endMember(companyId, r.projectId, member.id, lastDay, access.userId, 'reassigned', { requestId: r.id, note: `Moved to ${target.name}` });
    const tc = await this.inCharge(target.id, today);
    const lead = tc.leads[0] ?? null;
    try {
      await this.projects.addMember(companyId, target.id, { employeeId: r.releaseEmployeeId, role: ProjectRole.MEMBER, leadEmployeeId: lead, allocation, startDate: start, endDate: target.endDate ? keyFromDate(target.endDate) : null }, access.userId, { requestId: r.id, action: 'reassigned', note: `Moved from ${r.project.name}` });
    } catch (err) {
      throw new BadRequestException(`Their time on ${r.project.name} now ends ${fmt(lastDay)}, but they couldn’t be added to ${target.name}: ${(err as Error).message}`);
    }
    const saved = await this.update(r, access.userId, { status: ResourceRequestStatus.REASSIGNED, targetProjectId: target.id, filledAllocation: allocation, outcomeNote: dto.note ?? null, decidedByUserId: access.userId, decidedAt: new Date() }, 'reassigned', dto.note ?? null, { project: target.name, allocation, startDate: start });
    await this.tell(companyId, [r.raisedByUserId], 'resource.reassigned', `${fullName(person)} moves to ${target.name} after ${fmt(lastDay)}`, dto.note, r.id);
    await this.tell(companyId, [person.userId], 'project.assigned', `You’re moving to ${target.name}`, `${allocation}% from ${fmt(start)} — your time on ${r.project.name} ends ${fmt(lastDay)}`, null, 'Open', `/app/projects/${target.id}`);
    this.live(saved, [...(await this.actors(r, c)), r.raisedByUserId]);
    return this.detail(companyId, access, id);
  }

  // ─── Lists ────────────────────────────────────────────────

  /** What waits for me (and the tabs: on hold / raised by me / done). */
  async list(companyId: string, access: AccessContext, q: RequestListQueryDto) {
    const today = await this.projects.todayKey(companyId);
    const mine = await this.myProjects(access, today);
    const view = q.view ?? 'waiting';
    const waiting = this.waitingWhere(access, mine);
    const involved: Prisma.ResourceRequestWhereInput = {
      OR: [
        { raisedByUserId: access.userId },
        { projectId: { in: [...mine.pm, ...mine.dd, ...mine.lead] } },
        ...(this.pmo(access) ? [{}] : []),
      ],
    };
    const base: Prisma.ResourceRequestWhereInput = { companyId, ...(q.projectId && { projectId: q.projectId }), ...(q.kind && { kind: q.kind }) };
    const where: Prisma.ResourceRequestWhereInput =
      view === 'waiting' ? { AND: [base, waiting] }
      : view === 'hold' ? { AND: [base, waiting, { status: ResourceRequestStatus.ON_HOLD }] }
      : view === 'mine' ? { AND: [base, { raisedByUserId: access.userId }] }
      : view === 'done' ? { AND: [base, involved, { status: { notIn: OPEN_STATES } }] }
      : { AND: [base, involved] };
    const countOf = (w: Prisma.ResourceRequestWhereInput) => this.prisma.resourceRequest.count({ where: { AND: [{ companyId }, w] } });
    const [rows, counts] = await Promise.all([
      this.prisma.resourceRequest.findMany({ where, orderBy: view === 'done' ? { updatedAt: 'desc' } : { createdAt: 'asc' }, take: q.limit ?? 50, include: { project: { select: PROJECT } } }),
      Promise.all([countOf(waiting), countOf({ AND: [waiting, { status: ResourceRequestStatus.ON_HOLD }] }), countOf({ raisedByUserId: access.userId, status: { in: OPEN_STATES } }), countOf({ AND: [involved, { status: { notIn: OPEN_STATES } }] })]),
    ]);
    return {
      data: await this.present(rows, access, today),
      meta: { view, counts: { waiting: counts[0], hold: counts[1], mine: counts[2], done: counts[3] }, roles: { pmo: this.pmo(access), pm: mine.pm.length, dd: mine.dd.length, lead: mine.lead.length } },
    };
  }

  /** Menu badge: how many wait for me. */
  async waitingCount(companyId: string, access: AccessContext) {
    const mine = await this.myProjects(access, await this.projects.todayKey(companyId));
    return { count: await this.prisma.resourceRequest.count({ where: { AND: [{ companyId }, this.waitingWhere(access, mine)] } }) };
  }

  private waitingWhere(access: AccessContext, mine: { pm: string[]; dd: string[] }): Prisma.ResourceRequestWhereInput {
    const open = { status: { in: [ResourceRequestStatus.OPEN, ResourceRequestStatus.ON_HOLD] } };
    return {
      OR: [
        { ...open, kind: ResourceRequestKind.REQUEST, step: ResourceStep.PM, projectId: { in: mine.pm }, raisedByUserId: { not: access.userId } },
        { ...open, kind: ResourceRequestKind.REQUEST, step: ResourceStep.DD, projectId: { in: mine.dd }, raisedByUserId: { not: access.userId } },
        ...(this.pmo(access) ? [{ ...open, kind: ResourceRequestKind.REQUEST, step: ResourceStep.PMO, raisedByUserId: { not: access.userId } }] : []),
        { ...open, kind: ResourceRequestKind.RELEASE, projectId: { in: [...mine.pm, ...mine.dd] }, raisedByUserId: { not: access.userId } },
        { status: ResourceRequestStatus.AWAITING_CONSENT, pendingFill: { path: ['consentUserId'], equals: access.userId } },
      ],
    };
  }

  /** One request with its full step history, and what I may do now. */
  async detail(companyId: string, access: AccessContext, id: string) {
    const r = await this.load(companyId, id);
    const today = await this.projects.todayKey(companyId);
    const c = await this.inCharge(r.projectId, today);
    const me = access.employee?.id;
    const consentUser = (r.pendingFill as unknown as PendingFill | null)?.consentUserId;
    const sees =
      this.pmo(access) ||
      r.raisedByUserId === access.userId ||
      consentUser === access.userId ||
      Boolean(me && (c.pm?.employeeId === me || c.dd?.employeeId === me || c.leads.includes(me))) ||
      // Anyone who took part (e.g. the PM who agreed to give up time) keeps seeing it
      (await this.prisma.resourceRequestEvent.count({ where: { requestId: id, actorUserId: access.userId } })) > 0;
    if (!sees) throw new NotFoundException('Request not found');
    const [row] = await this.present([r], access, today, c);
    const events = await this.prisma.resourceRequestEvent.findMany({ where: { requestId: id }, orderBy: { createdAt: 'asc' } });
    const users = await this.usersById(events.map((e) => e.actorUserId));
    const act = this.canAct(access, r, c);
    const mineProjects = act && r.kind === ResourceRequestKind.RELEASE ? await this.myProjects(access, today) : null;
    const targets = mineProjects
      ? await this.prisma.project.findMany({ where: { id: { in: [...mineProjects.pm, ...mineProjects.dd].filter((p) => p !== r.projectId) }, status: { not: ProjectStatus.COMPLETED } }, select: { id: true, name: true, code: true, color: true }, orderBy: { name: 'asc' } })
      : [];
    const open = r.status === ResourceRequestStatus.OPEN;
    return {
      ...row,
      handover: r.handover,
      events: events.map((e) => ({ id: e.id, kind: e.kind, note: e.note, data: e.data, at: e.createdAt, actor: e.actorUserId ? (users.get(e.actorUserId) ?? null) : null })),
      can: {
        forward: act && open && r.kind === ResourceRequestKind.REQUEST && r.step !== ResourceStep.PMO,
        fill: act && open && r.kind === ResourceRequestKind.REQUEST,
        fillAnyone: act && this.pmo(access),
        hold: act && open,
        unhold: act && r.status === ResourceRequestStatus.ON_HOLD,
        reject: act && open && r.kind === ResourceRequestKind.REQUEST,
        decideRelease: act && open && r.kind === ResourceRequestKind.RELEASE,
        consent: r.status === ResourceRequestStatus.AWAITING_CONSENT && consentUser === access.userId,
        withdraw: r.raisedByUserId === access.userId && OPEN_STATES.includes(r.status),
        nudge: this.pmo(access) && OPEN_STATES.includes(r.status) && !(r.kind === ResourceRequestKind.REQUEST && r.step === ResourceStep.PMO),
        raiseAgain: r.raisedByUserId === access.userId && (r.status === ResourceRequestStatus.REJECTED || r.status === ResourceRequestStatus.WITHDRAWN),
      },
      releaseTargets: targets,
      pendingFill: r.status === ResourceRequestStatus.AWAITING_CONSENT ? await this.presentPending(r) : null,
    };
  }

  // ─── Candidates, pool, history ────────────────────────────

  /**
   * Best matches for a request: skills (request + project tech stack) vs each
   * person's skills, free % in the window, and whether the viewer may assign them.
   */
  async candidates(companyId: string, access: AccessContext, id: string, q: CandidatesQueryDto) {
    const r = await this.load(companyId, id);
    const today = await this.projects.todayKey(companyId);
    const c = await this.inCharge(r.projectId, today);
    if (!this.canAct(access, r, c) && !this.pmo(access)) throw new ForbiddenException('Only whoever decides this request sees the matches');
    const { from, until } = this.window(r, today);
    const mine = await this.myProjects(access, today);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: r.projectId }, select: { techStack: true } });
    const wanted = new Set([...r.skills, ...project.techStack].map((s) => s.toLowerCase()));
    const words = (q.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const people = await this.prisma.employee.findMany({
      where: {
        companyId,
        employmentStatus: { not: EmploymentStatus.TERMINATED },
        user: { status: UserStatus.ACTIVE },
        ...(words.length && { AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }, { skills: { has: w } }] })) }),
      },
      select: { ...FACE, skills: true, reportsToPmo: true },
      take: 400,
    });
    const ids = people.map((p) => p.id);
    const members = await this.prisma.projectMember.findMany({
      where: { employeeId: { in: ids }, project: { status: { not: ProjectStatus.COMPLETED } }, ...this.overlap(from, until) },
      select: { id: true, employeeId: true, projectId: true, allocation: true, startDate: true, endDate: true, project: { select: { name: true, code: true } } },
    });
    const managed = new Set([...mine.pm, ...mine.dd]);
    const out = people
      .map((p) => {
        const own = members.filter((m) => m.employeeId === p.id);
        if (own.some((m) => m.projectId === r.projectId)) return null; // already here
        const spans = own.map((m) => ({ allocation: m.allocation, start: keyFromDate(m.startDate), end: m.endDate ? keyFromDate(m.endDate) : null }));
        const free = Math.max(0, 100 - peakAllocation(spans, from, until));
        const skillHits = p.skills.filter((s) => wanted.has(s.toLowerCase()));
        const match = wanted.size ? Math.round((skillHits.length / wanted.size) * 100) : null;
        return {
          employee: { id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, designation: p.designation },
          skills: p.skills,
          matchedSkills: skillHits,
          match,
          free,
          fits: free >= (r.allocation ?? 1),
          preferred: p.id === r.preferredEmployeeId,
          inPool: p.reportsToPmo || free === 100,
          underMe: this.pmo(access) || own.some((m) => managed.has(m.projectId)),
          projects: own.map((m) => ({ memberId: m.id, projectId: m.projectId, name: m.project.name, code: m.project.code, allocation: m.allocation })),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    out.sort((a, b) => Number(b.preferred) - Number(a.preferred) || Number(b.underMe) - Number(a.underMe) || (b.match ?? 0) - (a.match ?? 0) || b.free - a.free || a.employee.firstName.localeCompare(b.employee.firstName));
    return { window: { from, until }, wanted: [...wanted], data: out.slice(0, 40) };
  }

  /**
   * Raise a request → "Preferred person": only people with free time in the
   * window (most free first), with their skills (matches marked), experience
   * (before joining + time here) and current projects. Facets list the
   * departments, roles (designations) and skills among them — each counted
   * without its own filter — so the filters only offer what is there.
   */
  async availablePeople(companyId: string, access: AccessContext, q: AvailablePeopleQueryDto) {
    const me = access.employee?.id;
    const today = await this.projects.todayKey(companyId);
    const project = await this.prisma.project.findFirst({ where: { id: q.projectId, companyId }, select: { id: true, techStack: true } });
    if (!project) throw new NotFoundException('Project not found');
    const c = await this.inCharge(project.id, today);
    if (!this.pmo(access) && !(me && (c.leads.includes(me) || c.pm?.employeeId === me))) throw new ForbiddenException('Only the project’s team leads and project manager can request people');
    const from = q.from && q.from > today ? q.from : today;
    const until = q.until && q.until >= from ? q.until : null;
    const list = (s?: string) => (s ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    const wanted = new Set([...list(q.wanted), ...project.techStack.map((s) => s.toLowerCase())]);
    const mustHave = list(q.skills);
    const words = (q.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const people = await this.prisma.employee.findMany({
      where: {
        companyId,
        employmentStatus: { not: EmploymentStatus.TERMINATED },
        user: { status: UserStatus.ACTIVE },
        joiningDate: { lte: dateFromKey(until ?? from) },
        ...(me && { id: { not: me } }),
        ...(words.length && { AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }, { employeeId: { contains: w, mode: 'insensitive' as const } }, { designation: { name: { contains: w, mode: 'insensitive' as const } } }] })) }),
      },
      select: { ...FACE, employeeId: true, skills: true, joiningDate: true, priorExperienceMonths: true, designation: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } },
    });
    const members = await this.prisma.projectMember.findMany({
      where: { employeeId: { in: people.map((p) => p.id) }, project: { status: { not: ProjectStatus.COMPLETED } }, ...this.overlap(from, until) },
      select: { employeeId: true, projectId: true, allocation: true, startDate: true, endDate: true, project: { select: { name: true, code: true } } },
    });
    const byPerson = new Map<string, typeof members>();
    for (const m of members) byPerson.set(m.employeeId, [...(byPerson.get(m.employeeId) ?? []), m]);
    const now = dateFromKey(today).getTime();
    const free = people
      .map((p) => {
        const own = byPerson.get(p.id) ?? [];
        if (own.some((m) => m.projectId === project.id)) return null; // already on this project
        const spans = own.map((m) => ({ allocation: m.allocation, start: keyFromDate(m.startDate), end: m.endDate ? keyFromDate(m.endDate) : null }));
        const freePct = Math.max(0, 100 - peakAllocation(spans, from, until));
        if (freePct <= 0) return null;
        const hereMonths = Math.max(0, (now - p.joiningDate.getTime()) / (30.4375 * 86400_000));
        const years = Math.round(((p.priorExperienceMonths ?? 0) + hereMonths) / 1.2) / 10;
        const lower = p.skills.map((s) => s.toLowerCase());
        return {
          employee: { id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, employeeId: p.employeeId, designation: p.designation, department: p.department },
          free: freePct,
          experienceYears: years,
          /** false = only time here is counted (experience before joining not given) */
          experienceComplete: p.priorExperienceMonths !== null,
          skills: p.skills,
          matchedSkills: p.skills.filter((s) => wanted.has(s.toLowerCase())),
          projects: own.map((m) => ({ name: m.project.name, code: m.project.code, allocation: m.allocation })),
          lower,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    type Row = (typeof free)[number];
    const pass = {
      dept: (r: Row) => !q.departmentId || r.employee.department?.id === q.departmentId,
      role: (r: Row) => !q.designationId || r.employee.designation?.id === q.designationId,
      skills: (r: Row) => mustHave.every((s) => r.lower.includes(s)),
      free: (r: Row) => r.free >= (q.minFree ?? 1),
      exp: (r: Row) => (q.minYears === undefined || r.experienceYears >= q.minYears) && (q.maxYears === undefined || r.experienceYears < q.maxYears),
    };
    const all = Object.values(pass);
    const except = (skip: (r: Row) => boolean) => free.filter((r) => all.every((f) => f === skip || f(r)));
    const tally = <K extends string>(rows: Row[], key: (r: Row) => Array<{ id: K; name: string }>) => {
      const m = new Map<K, { id: K; name: string; count: number }>();
      for (const r of rows) for (const k of key(r)) m.set(k.id, { ...k, count: (m.get(k.id)?.count ?? 0) + 1 });
      return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    };
    const facets = {
      departments: tally(except(pass.dept), (r) => (r.employee.department ? [r.employee.department] : [])),
      roles: tally(except(pass.role), (r) => (r.employee.designation ? [r.employee.designation] : [])),
      // Skills: the ones among them, most common first (wanted ones on top)
      skills: tally(except(pass.skills), (r) => r.skills.map((s) => ({ id: s.toLowerCase(), name: s })))
        .sort((a, b) => Number(wanted.has(b.id)) - Number(wanted.has(a.id)) || b.count - a.count)
        .slice(0, 40),
    };
    const rows = free
      .filter((r) => all.every((f) => f(r)))
      .sort((a, b) => b.free - a.free || b.matchedSkills.length - a.matchedSkills.length || b.experienceYears - a.experienceYears || a.employee.firstName.localeCompare(b.employee.firstName));
    const limit = q.limit ?? 20;
    const totalPages = Math.max(1, Math.ceil(rows.length / limit));
    const page = Math.min(q.page ?? 1, totalPages);
    return {
      window: { from, until },
      rows: rows.slice((page - 1) * limit, page * limit).map(({ lower: _l, ...r }) => r),
      meta: { total: rows.length, page, limit, totalPages, facets },
    };
  }

  /** PMO pool: who is free now or soon (and who reports to the PMO), with their best-fit request. */
  async pool(companyId: string, access: AccessContext, q: PoolQueryDto = {}) {
    if (!this.pmo(access)) throw new ForbiddenException('Only the PMO sees the pool');
    const today = await this.projects.todayKey(companyId);
    const horizon = addDays(today, 27);
    const people = await this.prisma.employee.findMany({
      where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED }, user: { status: UserStatus.ACTIVE } },
      select: { ...FACE, skills: true, reportsToPmo: true, joiningDate: true, department: { select: { name: true } } },
    });
    const members = await this.prisma.projectMember.findMany({
      where: { employeeId: { in: people.map((p) => p.id) }, project: { status: { not: ProjectStatus.COMPLETED } } },
      select: { employeeId: true, allocation: true, startDate: true, endDate: true, project: { select: { name: true } } },
      orderBy: { endDate: 'desc' },
    });
    const waiting = await this.prisma.resourceRequest.findMany({
      where: { companyId, kind: ResourceRequestKind.REQUEST, status: ResourceRequestStatus.OPEN, step: ResourceStep.PMO },
      select: { id: true, title: true, skills: true, allocation: true, project: { select: { name: true, techStack: true } } },
    });
    const memberOf = new Map<string, typeof members>();
    for (const m of members) memberOf.set(m.employeeId, [...(memberOf.get(m.employeeId) ?? []), m]);
    const rows = people
      .map((p) => {
        const own = memberOf.get(p.id) ?? [];
        const spans = own.map((m) => ({ allocation: m.allocation, start: keyFromDate(m.startDate), end: m.endDate ? keyFromDate(m.endDate) : null }));
        const nowBooked = allocationOn(spans, today);
        const free = Math.max(0, 100 - peakAllocation(spans, today, horizon));
        if (!p.reportsToPmo && free === 0) return null;
        const last = own.filter((m) => m.endDate && keyFromDate(m.endDate) < today).sort((a, b) => b.endDate!.getTime() - a.endDate!.getTime())[0];
        const skills = new Set(p.skills.map((s) => s.toLowerCase()));
        const fit = waiting
          .map((w) => {
            const wanted = [...w.skills, ...w.project.techStack].map((s) => s.toLowerCase());
            const hits = wanted.filter((s) => skills.has(s)).length;
            return { id: w.id, title: w.title, project: w.project.name, allocation: w.allocation, match: wanted.length ? Math.round((hits / wanted.length) * 100) : 0 };
          })
          .filter((w) => w.match > 0 && free >= (w.allocation ?? 1))
          .sort((a, b) => b.match - a.match)[0] ?? null;
        return {
          employee: { id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, designation: p.designation, department: p.department },
          skills: p.skills,
          reportsToPmo: p.reportsToPmo,
          nowBooked,
          free,
          freeSince: last?.endDate ? addDays(keyFromDate(last.endDate), 1) : nowBooked === 0 ? keyFromDate(p.joiningDate) : null,
          lastProject: last?.project.name ?? null,
          bestFit: fit,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => Number(b.reportsToPmo) - Number(a.reportsToPmo) || b.free - a.free || a.employee.firstName.localeCompare(b.employee.firstName));
    // Search on name, skill or title; the counts stay for the whole pool
    const words = searchWords(q.search).map((w) => w.toLowerCase());
    const show = q.show ?? 'all';
    const shown = rows.filter(
      (r) =>
        (show === 'free' ? r.free === 100 : show === 'pmo' ? r.reportsToPmo : true) &&
        words.every((w) => `${r.employee.firstName} ${r.employee.lastName} ${r.skills.join(' ')} ${r.employee.designation?.name ?? ''}`.toLowerCase().includes(w)),
    );
    const limit = q.limit ?? 24;
    const totalPages = Math.max(1, Math.ceil(shown.length / limit));
    const page = Math.min(q.page ?? 1, totalPages);
    return {
      today,
      counts: { people: rows.length, fullyFree: rows.filter((r) => r.free === 100).length, reportsToPmo: rows.filter((r) => r.reportsToPmo).length, waitingRequests: waiting.length },
      data: shown.slice((page - 1) * limit, page * limit),
      meta: { total: shown.length, page, limit, totalPages },
    };
  }

  /**
   * Someone's assignment history — themselves, their managers / HR (employee
   * view), PMs and Delivery Directors of their projects, and the PMO.
   */
  async history(companyId: string, access: AccessContext, employeeId: string) {
    await this.assertSeesHistory(companyId, access, employeeId);
    const logs = await this.prisma.assignmentLog.findMany({ where: { companyId, employeeId }, orderBy: { createdAt: 'desc' }, take: 200 });
    const person = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { skills: true, priorExperienceMonths: true, priorExperiencePendingMonths: true, priorExperienceSubmittedAt: true, priorExperienceVerifiedAt: true, joiningDate: true, firstName: true, lastName: true, designation: { select: { name: true } } } });
    const [users, projects] = await Promise.all([
      this.usersById(logs.map((l) => l.actorUserId)),
      this.prisma.project.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.projectId).filter((x): x is string => Boolean(x)))] } }, select: { id: true, name: true, code: true, color: true } }),
    ]);
    const byId = new Map(projects.map((p) => [p.id, p]));
    const today = await this.projects.todayKey(companyId);
    const mine = await this.myProjects(access, today);
    // Leads see "Request back" for people who left their project
    const led = mine.lead.concat(mine.pm);
    return {
      person: person ? { firstName: person.firstName, lastName: person.lastName, designation: person.designation?.name ?? null } : null,
      skills: person?.skills ?? [],
      experience: person
        ? { priorMonths: person.priorExperienceMonths, pendingMonths: person.priorExperiencePendingMonths, submittedAt: person.priorExperienceSubmittedAt, verifiedAt: person.priorExperienceVerifiedAt, joiningDate: keyFromDate(person.joiningDate) }
        : null,
      data: logs.map((l) => ({ id: l.id, action: l.action, allocation: l.allocation, note: l.note, at: l.createdAt, requestId: l.requestId, project: l.projectId ? (byId.get(l.projectId) ?? null) : null, actor: l.actorUserId ? (users.get(l.actorUserId) ?? null) : null })),
      requestBackFrom: projects.filter((p) => led.includes(p.id) && logs.some((l) => l.projectId === p.id && ['to_pool', 'released', 'reassigned', 'removed'].includes(l.action))).map((p) => p.id),
    };
  }

  private async assertSeesHistory(companyId: string, access: AccessContext, employeeId: string) {
    // Company first: the PMO shortcut below must never reach another company's people
    if (!(await this.prisma.employee.count({ where: { id: employeeId, companyId } }))) throw new NotFoundException('Employee not found');
    if (this.pmo(access) || access.employee?.id === employeeId) return;
    const scope = this.access?.employeeScope(access, 'employee.view');
    if (scope && (await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope] } }))) return;
    const me = access.employee?.id;
    if (me) {
      const t = dateFromKey(await this.projects.todayKey(companyId));
      const theirs = await this.prisma.projectMember.findMany({ where: { employeeId }, select: { projectId: true }, distinct: ['projectId'] });
      const ids = theirs.map((x) => x.projectId);
      if (ids.length) {
        const [pm, dd] = await Promise.all([
          this.prisma.projectMember.count({ where: { employeeId: me, projectId: { in: ids }, role: ProjectRole.MANAGER, startDate: { lte: t } } }),
          this.prisma.project.count({ where: { id: { in: ids }, deliveryDirectorId: me } }),
        ]);
        if (pm || dd) return;
      }
    }
    throw new NotFoundException('Employee not found');
  }

  /** Skills and technologies already used in the company (for suggestions). */
  async skillSuggestions(companyId: string) {
    const [people, projects] = await Promise.all([
      this.prisma.employee.findMany({ where: { companyId, NOT: { skills: { isEmpty: true } } }, select: { skills: true } }),
      this.prisma.project.findMany({ where: { companyId, NOT: { techStack: { isEmpty: true } } }, select: { techStack: true } }),
    ]);
    const counts = new Map<string, { name: string; n: number }>();
    for (const s of [...people.flatMap((p) => p.skills), ...projects.flatMap((p) => p.techStack)]) {
      const k = s.toLowerCase();
      counts.set(k, { name: counts.get(k)?.name ?? s, n: (counts.get(k)?.n ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((x) => x.name).slice(0, 200);
  }

  /** My roles on projects (the web shows the right buttons and menu items). */
  async context(companyId: string, access: AccessContext) {
    const today = await this.projects.todayKey(companyId);
    const mine = await this.myProjects(access, today);
    return { pmo: this.pmo(access), leadProjects: mine.lead, pmProjects: mine.pm, ddProjects: mine.dd, involved: this.pmo(access) || Boolean(mine.lead.length + mine.pm.length + mine.dd.length) };
  }

  // ─── Reminders (hourly) ───────────────────────────────────

  /** "Remind me on" days, and a nudge after 7 days on hold. */
  async remindHolds(now = new Date()) {
    const held = await this.prisma.resourceRequest.findMany({ where: { status: ResourceRequestStatus.ON_HOLD }, include: { project: { select: PROJECT } }, take: 200 });
    for (const r of held) {
      const today = await this.projects.todayKey(r.companyId);
      if (r.remindAt && keyFromDate(r.remindAt) <= today && !r.remindedAt && r.heldByUserId) {
        await this.prisma.resourceRequest.update({ where: { id: r.id }, data: { remindedAt: now } });
        await this.tell(r.companyId, [r.heldByUserId], 'resource.reminder', `Reminder: the ${this.what(r)} on ${r.project.name} is on hold`, `You held it: ${r.holdReason}`, r.id, 'Review');
      }
      const since = (r.holdNudgedAt ?? r.heldAt)?.getTime() ?? now.getTime();
      if (r.heldAt && now.getTime() - since >= HOLD_NUDGE_DAYS * DAY) {
        await this.prisma.resourceRequest.update({ where: { id: r.id }, data: { holdNudgedAt: now } });
        const days = Math.round((now.getTime() - r.heldAt.getTime()) / DAY);
        await this.tell(r.companyId, [r.heldByUserId], 'resource.reminder', `The ${this.what(r)} on ${r.project.name} has been on hold for ${days} days`, `Reason: ${r.holdReason}`, r.id, 'Unhold and decide');
        await this.tell(r.companyId, [r.raisedByUserId], 'resource.reminder', `Your ${this.what(r)} on ${r.project.name} is still on hold (${days} days)`, `Reason: ${r.holdReason}`, r.id);
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async load(companyId: string, id: string): Promise<Row> {
    const r = await this.prisma.resourceRequest.findFirst({ where: { id, companyId }, include: { project: { select: PROJECT } } });
    if (!r) throw new NotFoundException('Request not found');
    return r;
  }

  /** Loaded, in one of these states, and mine to act on now. */
  private async actionable(companyId: string, access: AccessContext, id: string, states: ResourceRequestStatus[]) {
    const r = await this.load(companyId, id);
    if (!states.includes(r.status)) {
      throw new ConflictException(
        r.status === ResourceRequestStatus.ON_HOLD ? 'It’s on hold — unhold it first' : OPEN_STATES.includes(r.status) ? 'It isn’t at that point' : 'It has already been decided',
      );
    }
    const c = await this.inCharge(r.projectId, await this.projects.todayKey(companyId));
    if (!this.canAct(access, r, c)) throw new ForbiddenException(r.raisedByUserId === access.userId ? 'You can’t decide your own request' : 'This is waiting for someone else');
    return { r, c };
  }

  /** Change the request and record the step (only if it's still as we saw it). */
  private async update(r: Row, actorUserId: string, data: Prisma.ResourceRequestUpdateInput, kind: string, note: string | null | undefined, extra?: Record<string, unknown>): Promise<Row> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.resourceRequest.updateMany({ where: { id: r.id, status: r.status, step: r.step }, data: data as Prisma.ResourceRequestUpdateManyMutationInput });
      if (!count) throw new ConflictException('Someone else has just acted on this — reload');
      await tx.resourceRequestEvent.create({ data: { companyId: r.companyId, requestId: r.id, actorUserId, kind, note: note ?? null, ...(extra && { data: extra as Prisma.InputJsonValue }) } });
      return tx.resourceRequest.findUniqueOrThrow({ where: { id: r.id }, include: { project: { select: PROJECT } } });
    });
  }

  private what(r: { kind: ResourceRequestKind; title: string | null }) {
    return r.kind === ResourceRequestKind.RELEASE ? 'release' : `request for a ${r.title ?? 'person'}`;
  }

  private async tell(companyId: string, userIds: Array<string | null | undefined>, type: string, title: string, body: string | null | undefined, requestId: string | null, actionLabel?: string, link?: string) {
    const ids = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
    if (!ids.length) return;
    await this.notifications.notify({ companyId, userIds: ids, type, title, body: body ?? null, link: link ?? (requestId ? `/app/resources/${requestId}` : null), ...(actionLabel && { actionLabel }), email: false });
  }

  /** Everyone involved sees the change live (lists, badges, the request page). */
  private live(r: { companyId: string }, userIds: Array<string | null | undefined>) {
    this.realtime.soon([...new Set(userIds.filter((u): u is string => Boolean(u)))].map((u) => room.user(u)).concat(room.area(r.companyId, 'projects')), 'resources');
  }

  private async userName(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    return fullName(u);
  }

  private async usersById(ids: Array<string | null>) {
    const list = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    const users = list.length ? await this.prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, firstName: true, lastName: true, avatarUrl: true, employee: { select: { id: true, avatarUrl: true } } } }) : [];
    return new Map(users.map((u) => [u.id, { id: u.id, employeeId: u.employee?.id ?? null, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.employee?.avatarUrl ?? u.avatarUrl }]));
  }

  private async presentPending(r: Row) {
    const p = r.pendingFill as unknown as PendingFill;
    const [person, users] = await Promise.all([this.prisma.employee.findUnique({ where: { id: p.employeeId }, select: FACE }), this.usersById([p.byUserId, p.consentUserId])]);
    return { employee: person, allocation: p.allocation, note: p.note, takeFrom: p.takeFrom, project: p.consentProject, by: users.get(p.byUserId) ?? null, waitingFor: users.get(p.consentUserId) ?? null };
  }

  /** Cards for lists: people, the path through the steps, and age. */
  private async present(rows: Row[], access: AccessContext, today: string, known?: InCharge) {
    if (!rows.length) return [];
    const empIds = [...new Set(rows.flatMap((r) => [r.preferredEmployeeId, r.releaseEmployeeId, r.filledEmployeeId, r.raisedByEmployeeId]).filter((x): x is string => Boolean(x)))];
    const [people, users, targets] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: empIds } }, select: FACE }),
      this.usersById(rows.flatMap((r) => [r.raisedByUserId, r.heldByUserId, r.decidedByUserId])),
      this.prisma.project.findMany({ where: { id: { in: rows.map((r) => r.targetProjectId).filter((x): x is string => Boolean(x)) } }, select: { id: true, name: true } }),
    ]);
    const face = new Map(people.map((p) => [p.id, p]));
    const charge = new Map<string, InCharge>();
    for (const pid of [...new Set(rows.map((r) => r.projectId))]) charge.set(pid, known && rows.length === 1 ? known : await this.inCharge(pid, today));
    const inChargeFaces = await this.prisma.employee.findMany({ where: { id: { in: [...charge.values()].flatMap((c) => [c.pm?.employeeId, c.dd?.employeeId]).filter((x): x is string => Boolean(x)) } }, select: FACE });
    const cface = new Map(inChargeFaces.map((p) => [p.id, p]));
    return rows.map((r) => {
      const c = charge.get(r.projectId)!;
      const steps: ResourceStep[] = r.kind === ResourceRequestKind.RELEASE ? [] : [ResourceStep.PM, ...(c.dd && c.dd.employeeId !== c.pm?.employeeId ? [ResourceStep.DD] : []), ResourceStep.PMO];
      return {
        id: r.id,
        kind: r.kind,
        status: r.status,
        step: r.step,
        project: { id: r.project.id, name: r.project.name, code: r.project.code, color: r.project.color },
        title: r.title,
        skills: r.skills,
        allocation: r.allocation,
        fromDate: r.fromDate ? keyFromDate(r.fromDate) : null,
        untilDate: r.untilDate ? keyFromDate(r.untilDate) : null,
        reason: r.reason,
        preferred: r.preferredEmployeeId ? (face.get(r.preferredEmployeeId) ?? null) : null,
        releaseEmployee: r.releaseEmployeeId ? (face.get(r.releaseEmployeeId) ?? null) : null,
        lastDate: r.lastDate ? keyFromDate(r.lastDate) : null,
        raisedBy: r.raisedByUserId ? (users.get(r.raisedByUserId) ?? null) : null,
        hold: r.status === ResourceRequestStatus.ON_HOLD ? { reason: r.holdReason, at: r.heldAt, by: r.heldByUserId ? (users.get(r.heldByUserId) ?? null) : null, remindAt: r.remindAt ? keyFromDate(r.remindAt) : null } : null,
        filled: r.filledEmployeeId ? { employee: face.get(r.filledEmployeeId) ?? null, allocation: r.filledAllocation } : null,
        target: r.targetProjectId ? (targets.find((t) => t.id === r.targetProjectId) ?? null) : null,
        outcomeNote: r.outcomeNote,
        decidedBy: r.decidedByUserId ? (users.get(r.decidedByUserId) ?? null) : null,
        decidedAt: r.decidedAt,
        nudgedAt: r.nudgedAt,
        previousRequestId: r.previousRequestId,
        path: steps.map((s) => ({ step: s, label: STEP_LABEL[s], person: s === ResourceStep.PM ? (c.pm ? (cface.get(c.pm.employeeId) ?? null) : null) : s === ResourceStep.DD ? (c.dd ? (cface.get(c.dd.employeeId) ?? null) : null) : null })),
        pm: c.pm ? (cface.get(c.pm.employeeId) ?? null) : null,
        dd: c.dd ? (cface.get(c.dd.employeeId) ?? null) : null,
        mine: r.raisedByUserId === access.userId,
        canAct: this.canAct(access, r, c),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        ageDays: Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.UTC(r.createdAt.getUTCFullYear(), r.createdAt.getUTCMonth(), r.createdAt.getUTCDate())) / DAY)),
      };
    });
  }
}

const PROJECT = { id: true, name: true, code: true, color: true, endDate: true, startDate: true, deliveryDirectorId: true } as const;
