import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { EmploymentStatus, LeaveGrantRequestStatus, LeaveGrantStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AccessContext } from '../access/access.types';
import { NotificationsService, dateRange } from '../notifications/notifications.service';
import { PrivateFilesService } from '../employee-profile/private-files.service';
import { detectFileType, DOCUMENT_TYPES } from '../employee-profile/file-types';
import { dateFromKey, keyFromDate } from '../attendance/time-zone';
import { LeaveTypesService, type LeaveTypeRow } from './leave-types.service';
import { activeGrants, loadPeople } from './leave-eligibility';
import { canAskForGrant, matchesRules, toHalf } from './leave-rules';
import type { ApproveGrantRequestDto, CreateGrantDto, CreateGrantRequestDto, EligibilityPreviewDto, GrantListQueryDto, GrantRequestListQueryDto, RejectGrantRequestDto, RevokeGrantDto, UpdateGrantDto } from './dto';

const MANAGE = 'leave.adjust_balance';
const DOC_MAX_BYTES = 10 * 1024 * 1024;
const REMIND_DAYS = 14;
const EVERY_MS = 6 * 60 * 60_000;
const DAY_MS = 86_400_000;

const PERSON = { select: { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true } } as const;
const TYPE = { select: { id: true, name: true, code: true, color: true } } as const;
const GRANT_SELECT = {
  id: true,
  days: true,
  validFrom: true,
  validTo: true,
  reason: true,
  status: true,
  documentName: true,
  documentSize: true,
  documentMime: true,
  grantedById: true,
  requestId: true,
  createdAt: true,
  employee: PERSON,
  leaveType: TYPE,
  events: { orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, days: true, validTo: true, note: true, byId: true, createdAt: true } },
} satisfies Prisma.LeaveGrantSelect;
const REQUEST_SELECT = {
  id: true,
  fromDate: true,
  toDate: true,
  note: true,
  status: true,
  documentName: true,
  documentSize: true,
  documentMime: true,
  decidedById: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  employee: PERSON,
  leaveType: { select: { ...TYPE.select, annualQuota: true, grantNeedsDocument: true } },
  grant: { select: { id: true } },
} satisfies Prisma.LeaveGrantRequestSelect;

type UploadedDoc = { key: string; name: string; mime: string; size: number };

/**
 * Leave grants: HR gives a person days of a "only when granted" type
 * (maternity, sabbatical…) for a window that can cross the year. People who
 * match the type's rules can ask for one, with a document. Leave applied
 * under a grant is linked to it (LeaveRequest.leaveGrantId); what is left is
 * worked out from those requests, so cancellations give days back by themselves.
 */
@Injectable()
export class LeaveGrantsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LeaveGrantsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly types: LeaveTypesService,
    private readonly notifications: NotificationsService,
    private readonly files: PrivateFilesService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (this.config.get<string>('REMINDERS_ENABLED') === 'false') return;
    this.timer = setInterval(() => void this.remindEnding(), EVERY_MS);
    this.timer.unref();
    setTimeout(() => void this.remindEnding(), 150_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Grants are HR's: leave.adjust_balance across the whole company (not team-scoped, not delegated). */
  isHr(access: AccessContext) {
    if (access.isSuperAdmin || access.isOwner) return true;
    if (!access.grants.has(MANAGE)) return false;
    const scope = access.grants.get(MANAGE);
    return scope === null || scope === 'company';
  }

  private assertHr(access: AccessContext) {
    if (!this.isHr(access)) throw new ForbiddenException('Only HR can give or change leave grants');
  }

  // ─── Who the rules cover (leave type form) ──────────────────

  async preview(companyId: string, dto: EligibilityPreviewDto) {
    const rules = {
      availability: dto.availability,
      genders: dto.genders ?? [],
      departmentIds: dto.departmentIds ?? [],
      locationIds: dto.locationIds ?? [],
      designationIds: dto.designationIds ?? [],
      employmentTypes: dto.employmentTypes ?? [],
      minServiceMonths: dto.minServiceMonths ?? null,
      managerIds: dto.managerIds ?? [],
      managerDeep: Boolean(dto.managerDeep),
      projectIds: dto.projectIds ?? [],
      members: dto.members ?? [],
    };
    const today = new Date();
    const people = await loadPeople(this.prisma, companyId, { employmentStatus: { not: EmploymentStatus.TERMINATED } }, { firstName: true, lastName: true, avatarUrl: true, employeeId: true });
    const match = dto.availability === 'EVERYONE' ? people : people.filter((p) => matchesRules(rules, p, today));
    match.sort((a, b) => a.firstName.localeCompare(b.firstName));
    // Names for the chosen projects (the form only has their ids)
    const projects = rules.projectIds.length ? await this.prisma.project.findMany({ where: { companyId, id: { in: rules.projectIds } }, select: { id: true, name: true, code: true } }) : [];
    return {
      projects,
      total: people.length,
      count: match.length,
      people: match.slice(0, 500).map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, avatarUrl: p.avatarUrl, employeeId: p.employeeId })),
    };
  }

  // ─── Grants ────────────────────────────────────────────────

  async list(companyId: string, access: AccessContext, query: GrantListQueryDto) {
    if (query.employeeId) await this.access.assertEmployeeInScope(access, 'leave.view', companyId, query.employeeId);
    else this.assertHr(access);
    const rows = await this.prisma.leaveGrant.findMany({
      where: { companyId, employeeId: query.employeeId, leaveTypeId: query.leaveTypeId, status: query.status },
      orderBy: [{ status: 'asc' }, { validTo: 'desc' }],
      select: GRANT_SELECT,
      take: 500,
    });
    return this.shapeGrants(companyId, rows);
  }

  async create(companyId: string, access: AccessContext, dto: CreateGrantDto, file?: Express.Multer.File) {
    this.assertHr(access);
    const type = await this.grantType(companyId, dto.leaveTypeId);
    this.checkWindow(dto.validFrom, dto.validTo, dto.days);
    const ids = [...new Set(dto.employeeIds)];
    if (!ids.length) throw new BadRequestException('Choose at least one person');
    const people = await this.prisma.employee.findMany({ where: { companyId, id: { in: ids }, employmentStatus: { not: EmploymentStatus.TERMINATED } }, select: { id: true, userId: true } });
    if (people.length !== ids.length) throw new BadRequestException('Some of the chosen people are not active employees');
    if (type.grantNeedsDocument && !file) throw new BadRequestException(`${type.name} needs a supporting document — attach one`);
    await this.assertNoOverlap(companyId, type, ids, dto.validFrom, dto.validTo);

    const doc = file ? this.checkFile(file) : null;
    const created: string[] = [];
    for (const p of people) {
      const id = randomUUID();
      const saved = doc ? await this.saveFile(companyId, `grant/${id}`, file!, doc) : null;
      await this.prisma.leaveGrant.create({
        data: {
          id,
          companyId,
          employeeId: p.id,
          leaveTypeId: type.id,
          days: dto.days,
          validFrom: dateFromKey(dto.validFrom),
          validTo: dateFromKey(dto.validTo),
          reason: dto.reason,
          grantedById: access.userId,
          ...this.docFields(saved),
          events: { create: { kind: 'CREATED', days: dto.days, validTo: dateFromKey(dto.validTo), note: dto.reason, byId: access.userId } },
        },
      });
      created.push(id);
      void this.notifyGranted(companyId, p.userId, type, dto.days, dto.validFrom, dto.validTo);
    }
    const rows = await this.prisma.leaveGrant.findMany({ where: { id: { in: created } }, select: GRANT_SELECT });
    return this.shapeGrants(companyId, rows);
  }

  /** Extend / shorten / change days — never below what is already taken. */
  async update(companyId: string, access: AccessContext, id: string, dto: UpdateGrantDto) {
    this.assertHr(access);
    const g = await this.prisma.leaveGrant.findFirst({ where: { id, companyId }, select: { id: true, status: true, days: true, validFrom: true, validTo: true, employee: PERSON, leaveType: TYPE } });
    if (!g) throw new NotFoundException('Grant not found');
    if (g.status !== LeaveGrantStatus.ACTIVE) throw new BadRequestException('This grant was revoked');
    if (dto.days === undefined && dto.validTo === undefined) throw new BadRequestException('Change the days or the end date');
    const days = dto.days ?? g.days;
    const validTo = dto.validTo ?? keyFromDate(g.validTo);
    this.checkWindow(keyFromDate(g.validFrom), validTo, days);
    const [use] = await activeGrants(this.prisma, companyId, { ids: [id] });
    if (days < use.taken) throw new BadRequestException(`${use.taken} day${use.taken === 1 ? ' is' : 's are'} already taken from this grant — it can’t go below that`);
    const last = await this.prisma.leaveRequest.findFirst({ where: { leaveGrantId: id, status: { in: ['PENDING', 'APPROVED'] } }, orderBy: { endDate: 'desc' }, select: { endDate: true } });
    if (last && validTo < keyFromDate(last.endDate)) throw new BadRequestException(`Leave on this grant runs until ${keyFromDate(last.endDate)} — the grant can’t end before that`);
    const moved = validTo !== keyFromDate(g.validTo);
    await this.prisma.leaveGrant.update({
      where: { id },
      data: {
        days,
        validTo: dateFromKey(validTo),
        ...(moved && { remindedFor: null }),
        events: { create: { kind: 'CHANGED', days, validTo: dateFromKey(validTo), note: dto.note, byId: access.userId } },
      },
    });
    void this.notifications.notify({
      companyId,
      userIds: [g.employee.userId],
      type: 'leave.grant_changed',
      title: `Your ${g.leaveType.name.toLowerCase()} grant changed`,
      body: `${days} day${days === 1 ? '' : 's'} · use by ${dateRange(validTo, validTo)}\n${dto.note}`,
      link: '/app/leave',
      actionLabel: 'View leave',
    });
    return this.one(companyId, id);
  }

  /** Only while nothing has been taken from it; otherwise shorten it. */
  async revoke(companyId: string, access: AccessContext, id: string, dto: RevokeGrantDto) {
    this.assertHr(access);
    const g = await this.prisma.leaveGrant.findFirst({ where: { id, companyId }, select: { id: true, status: true, employee: PERSON, leaveType: TYPE } });
    if (!g) throw new NotFoundException('Grant not found');
    if (g.status !== LeaveGrantStatus.ACTIVE) throw new BadRequestException('This grant was already revoked');
    const [use] = await activeGrants(this.prisma, companyId, { ids: [id] });
    if (use.taken > 0) throw new ConflictException('Leave has been applied on this grant — shorten it instead of revoking');
    await this.prisma.leaveGrant.update({ where: { id }, data: { status: LeaveGrantStatus.REVOKED, events: { create: { kind: 'REVOKED', note: dto.note, byId: access.userId } } } });
    void this.notifications.notify({
      companyId,
      userIds: [g.employee.userId],
      type: 'leave.grant_revoked',
      title: `Your ${g.leaveType.name.toLowerCase()} grant was withdrawn`,
      body: dto.note,
      link: '/app/leave',
    });
    return this.one(companyId, id);
  }

  async openGrantDocument(companyId: string, access: AccessContext, id: string) {
    const g = await this.prisma.leaveGrant.findFirst({ where: { id, companyId }, select: { employeeId: true, documentKey: true, documentName: true, documentMime: true, documentSize: true } });
    if (!g) throw new NotFoundException('Grant not found');
    await this.canSeePerson(companyId, access, g.employeeId);
    return this.open(g);
  }

  // ─── Requests for a grant ──────────────────────────────────

  async listRequests(companyId: string, access: AccessContext, query: GrantRequestListQueryDto) {
    let where: Prisma.LeaveGrantRequestWhereInput;
    if (query.view === 'review') {
      this.assertHr(access);
      where = { companyId, status: query.status ?? LeaveGrantRequestStatus.PENDING };
    } else {
      if (!access.employee) return [];
      where = { companyId, employeeId: access.employee.id, ...(query.status && { status: query.status }) };
    }
    const rows = await this.prisma.leaveGrantRequest.findMany({ where, orderBy: { createdAt: 'desc' }, select: REQUEST_SELECT, take: 300 });
    return this.shapeRequests(rows);
  }

  async createRequest(companyId: string, access: AccessContext, dto: CreateGrantRequestDto, file?: Express.Multer.File) {
    if (!access.employee) throw new BadRequestException('Your account has no employee profile');
    const type = await this.grantType(companyId, dto.leaveTypeId);
    const [me] = await loadPeople(this.prisma, companyId, { id: access.employee.id }, { userId: true, firstName: true, lastName: true });
    if (!canAskForGrant(type, me, new Date())) throw new ForbiddenException(`${type.name} isn’t available to you`);
    if (dto.toDate < dto.fromDate) throw new BadRequestException('The end date is before the start date');
    if (type.grantNeedsDocument && !file) throw new BadRequestException(`${type.name} needs a supporting document — attach one`);
    const waiting = await this.prisma.leaveGrantRequest.count({ where: { companyId, employeeId: me.id, leaveTypeId: type.id, status: LeaveGrantRequestStatus.PENDING } });
    if (waiting) throw new ConflictException(`You already asked for ${type.name.toLowerCase()} — HR hasn’t answered yet`);

    const id = randomUUID();
    const saved = file ? await this.saveFile(companyId, `grant-request/${id}`, file, this.checkFile(file)) : null;
    await this.prisma.leaveGrantRequest.create({
      data: { id, companyId, employeeId: me.id, leaveTypeId: type.id, fromDate: dateFromKey(dto.fromDate), toDate: dateFromKey(dto.toDate), note: dto.note, ...this.docFields(saved) },
    });
    const hr = (await this.notifications.companyWideApprovers(companyId, MANAGE)).filter((u) => u !== me.userId);
    void this.notifications.notify({
      companyId,
      userIds: hr,
      type: 'leave.grant_requested',
      title: `${me.firstName} ${me.lastName} asked for ${type.name.toLowerCase()}`,
      body: `${dateRange(dto.fromDate, dto.toDate)}\n${dto.note}`,
      link: '/app/leave/types?tab=grants',
      actionLabel: 'Review',
    });
    return this.oneRequest(companyId, id);
  }

  async approveRequest(companyId: string, access: AccessContext, id: string, dto: ApproveGrantRequestDto) {
    this.assertHr(access);
    const r = await this.pendingRequest(companyId, id);
    const type = await this.grantType(companyId, r.leaveTypeId);
    this.checkWindow(dto.validFrom, dto.validTo, dto.days);
    if (type.grantNeedsDocument && !r.documentKey) throw new BadRequestException(`${type.name} needs a supporting document — ask the person to send one again`);
    await this.assertNoOverlap(companyId, type, [r.employeeId], dto.validFrom, dto.validTo);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leaveGrantRequest.updateMany({
        where: { id, status: LeaveGrantRequestStatus.PENDING },
        data: { status: LeaveGrantRequestStatus.APPROVED, decidedById: access.userId, decidedAt: new Date(), decisionNote: dto.note ?? null },
      });
      if (!count) throw new ConflictException('This request has already been answered');
      await tx.leaveGrant.create({
        data: {
          companyId,
          employeeId: r.employeeId,
          leaveTypeId: type.id,
          days: dto.days,
          validFrom: dateFromKey(dto.validFrom),
          validTo: dateFromKey(dto.validTo),
          reason: dto.note || r.note,
          grantedById: access.userId,
          requestId: id,
          // The request's document travels with the grant (same stored file)
          documentKey: r.documentKey,
          documentName: r.documentName,
          documentMime: r.documentMime,
          documentSize: r.documentSize,
          events: { create: { kind: 'CREATED', days: dto.days, validTo: dateFromKey(dto.validTo), note: dto.note || 'Asked for by the employee', byId: access.userId } },
        },
      });
    });
    void this.notifyGranted(companyId, r.employee.userId, type, dto.days, dto.validFrom, dto.validTo);
    return this.oneRequest(companyId, id);
  }

  async rejectRequest(companyId: string, access: AccessContext, id: string, dto: RejectGrantRequestDto) {
    this.assertHr(access);
    const r = await this.pendingRequest(companyId, id);
    const { count } = await this.prisma.leaveGrantRequest.updateMany({
      where: { id, status: LeaveGrantRequestStatus.PENDING },
      data: { status: LeaveGrantRequestStatus.REJECTED, decidedById: access.userId, decidedAt: new Date(), decisionNote: dto.note },
    });
    if (!count) throw new ConflictException('This request has already been answered');
    void this.notifications.notify({
      companyId,
      userIds: [r.employee.userId],
      type: 'leave.grant_rejected',
      title: `Your request for ${r.leaveType.name.toLowerCase()} was declined`,
      body: dto.note,
      link: '/app/leave',
    });
    return this.oneRequest(companyId, id);
  }

  /** The person takes their own waiting request back. */
  async cancelRequest(companyId: string, access: AccessContext, id: string) {
    const r = await this.pendingRequest(companyId, id);
    if (r.employeeId !== access.employee?.id) throw new NotFoundException('Request not found');
    await this.prisma.leaveGrantRequest.update({ where: { id }, data: { status: LeaveGrantRequestStatus.CANCELLED } });
    return this.oneRequest(companyId, id);
  }

  async openRequestDocument(companyId: string, access: AccessContext, id: string) {
    const r = await this.prisma.leaveGrantRequest.findFirst({ where: { id, companyId }, select: { employeeId: true, documentKey: true, documentName: true, documentMime: true, documentSize: true } });
    if (!r) throw new NotFoundException('Request not found');
    if (r.employeeId !== access.employee?.id) this.assertHr(access);
    return this.open(r);
  }

  // ─── Ending soon ───────────────────────────────────────────

  /** Days left on a grant that ends within two weeks → tell the person once per end date. */
  async remindEnding(now = new Date()): Promise<number> {
    let sent = 0;
    try {
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const soon = await this.prisma.leaveGrant.findMany({
        where: { status: LeaveGrantStatus.ACTIVE, validTo: { gte: today, lte: new Date(today.getTime() + REMIND_DAYS * DAY_MS) } },
        select: { id: true, companyId: true, validTo: true, remindedFor: true, employee: { select: { userId: true } }, leaveType: { select: { name: true } } },
        take: 500,
      });
      const due = soon.filter((g) => !g.remindedFor || g.remindedFor.getTime() !== g.validTo.getTime());
      for (const g of due) {
        const [use] = await activeGrants(this.prisma, g.companyId, { ids: [g.id] });
        const left = toHalf(use.days - use.taken);
        if (left > 0) {
          const end = keyFromDate(g.validTo);
          sent += await this.notifications.notify({
            companyId: g.companyId,
            userIds: [g.employee.userId],
            type: 'leave.grant_ending',
            title: `${left} day${left === 1 ? '' : 's'} of ${g.leaveType.name.toLowerCase()} left — use by ${dateRange(end, end)}`,
            body: 'Unused days on this grant lapse when it ends. Talk to HR if you need more time.',
            link: '/app/leave',
            actionLabel: 'Plan leave',
            email: false,
            dedupeKey: `grant-ending:${g.id}:${end}`,
          });
        }
        await this.prisma.leaveGrant.update({ where: { id: g.id }, data: { remindedFor: g.validTo } });
      }
    } catch (err) {
      this.logger.error(`Grant reminders failed: ${(err as Error).message}`);
    }
    return sent;
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async grantType(companyId: string, id: string): Promise<LeaveTypeRow> {
    const type = await this.types.get(companyId, id);
    if (type.availability !== 'GRANT_ONLY') throw new BadRequestException(`${type.name} isn’t given by grant — change its "Who can use it" to "Only when granted" first`);
    if (!type.isActive) throw new BadRequestException(`${type.name} is switched off`);
    return type;
  }

  private checkWindow(from: string, to: string, days: number) {
    if (to < from) throw new BadRequestException('The end date is before the start date');
    if (days * 2 !== Math.round(days * 2)) throw new BadRequestException('Days must be in half-day steps');
  }

  /** One open grant of a type per person at a time (windows may not overlap). */
  private async assertNoOverlap(companyId: string, type: LeaveTypeRow, employeeIds: string[], from: string, to: string) {
    const clash = await this.prisma.leaveGrant.findFirst({
      where: { companyId, leaveTypeId: type.id, employeeId: { in: employeeIds }, status: LeaveGrantStatus.ACTIVE, validFrom: { lte: dateFromKey(to) }, validTo: { gte: dateFromKey(from) } },
      select: { employee: { select: { firstName: true, lastName: true } } },
    });
    if (clash) throw new ConflictException(`${clash.employee.firstName} ${clash.employee.lastName} already has ${type.name.toLowerCase()} granted for these dates — change that grant instead`);
  }

  private async pendingRequest(companyId: string, id: string) {
    const r = await this.prisma.leaveGrantRequest.findFirst({
      where: { id, companyId },
      select: { id: true, status: true, employeeId: true, leaveTypeId: true, note: true, documentKey: true, documentName: true, documentMime: true, documentSize: true, employee: PERSON, leaveType: TYPE },
    });
    if (!r) throw new NotFoundException('Request not found');
    if (r.status !== LeaveGrantRequestStatus.PENDING) throw new ConflictException('This request has already been answered');
    return r;
  }

  private async canSeePerson(companyId: string, access: AccessContext, employeeId: string) {
    if (employeeId === access.employee?.id || this.isHr(access)) return;
    await this.access.assertEmployeeInScope(access, 'leave.view', companyId, employeeId);
  }

  private checkFile(file: Express.Multer.File) {
    if (file.size > DOC_MAX_BYTES) throw new BadRequestException('Files must be 10 MB or smaller');
    const kind = detectFileType(file.buffer, file.mimetype);
    if (!kind || !DOCUMENT_TYPES.has(kind.ext)) throw new BadRequestException('Documents can be PDF, JPG, PNG, WebP or Word (.docx)');
    return kind;
  }

  private async saveFile(companyId: string, folder: string, file: Express.Multer.File, kind: { ext: string; mime: string }): Promise<UploadedDoc> {
    const key = `${companyId}/leave/${folder}/${randomUUID()}.${kind.ext}`;
    await this.files.save(key, file.buffer);
    const base = (file.originalname ?? 'document').split(/[\\/]/).pop()!.replace(/\.[^.]*$/, '').replace(/[^\w\- ().]+/g, '').slice(0, 80) || 'document';
    return { key, name: `${base}.${kind.ext}`, mime: kind.mime, size: file.size };
  }

  private docFields(doc: UploadedDoc | null) {
    return doc ? { documentKey: doc.key, documentName: doc.name, documentMime: doc.mime, documentSize: doc.size } : {};
  }

  private async open(r: { documentKey: string | null; documentName: string | null; documentMime: string | null; documentSize: number | null }) {
    if (!r.documentKey) throw new NotFoundException('No document attached');
    const stream = await this.files.open(r.documentKey).catch(() => {
      throw new NotFoundException('The file is no longer available');
    });
    return { stream, name: r.documentName ?? 'document', mime: r.documentMime ?? 'application/octet-stream', size: r.documentSize ?? undefined };
  }

  private async notifyGranted(companyId: string, userId: string, type: { name: string }, days: number, from: string, to: string) {
    await this.notifications.notify({
      companyId,
      userIds: [userId],
      type: 'leave.granted',
      title: `${days} day${days === 1 ? '' : 's'} of ${type.name.toLowerCase()} granted to you`,
      body: `Use between ${dateRange(from, to)}. Apply for it like any other leave.`,
      link: '/app/leave',
      actionLabel: 'Apply',
    });
  }

  private async names(ids: Array<string | null>) {
    const list = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    if (!list.length) return new Map<string, { firstName: string; lastName: string }>();
    const users = await this.prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, { firstName: u.firstName, lastName: u.lastName }]));
  }

  private async one(companyId: string, id: string) {
    const rows = await this.prisma.leaveGrant.findMany({ where: { id, companyId }, select: GRANT_SELECT });
    return (await this.shapeGrants(companyId, rows))[0];
  }

  private async oneRequest(companyId: string, id: string) {
    const rows = await this.prisma.leaveGrantRequest.findMany({ where: { id, companyId }, select: REQUEST_SELECT });
    return (await this.shapeRequests(rows))[0];
  }

  private async shapeGrants(companyId: string, rows: Array<Prisma.LeaveGrantGetPayload<{ select: typeof GRANT_SELECT }>>) {
    const uses = new Map((await activeGrants(this.prisma, companyId, { ids: rows.map((r) => r.id) })).map((u) => [u.id, u]));
    const who = await this.names(rows.flatMap((r) => [r.grantedById, ...r.events.map((e) => e.byId)]));
    const today = keyFromDate(new Date());
    return rows.map(({ employee, events, grantedById, documentName, documentSize, documentMime, ...g }) => {
      const use = uses.get(g.id);
      const validTo = keyFromDate(g.validTo);
      const taken = use?.taken ?? 0;
      return {
        ...g,
        validFrom: keyFromDate(g.validFrom),
        validTo,
        employee: { id: employee.id, employeeId: employee.employeeId, firstName: employee.firstName, lastName: employee.lastName, avatarUrl: employee.avatarUrl },
        taken,
        used: use?.used ?? 0,
        left: g.status === 'ACTIVE' && validTo >= today ? toHalf(Math.max(0, g.days - taken)) : 0,
        ended: validTo < today,
        grantedBy: grantedById ? (who.get(grantedById) ?? null) : null,
        document: documentName ? { name: documentName, size: documentSize, mime: documentMime } : null,
        history: events.map((e) => ({ id: e.id, kind: e.kind, days: e.days, validTo: e.validTo ? keyFromDate(e.validTo) : null, note: e.note, createdAt: e.createdAt, by: e.byId ? (who.get(e.byId) ?? null) : null })),
      };
    });
  }

  private async shapeRequests(rows: Array<Prisma.LeaveGrantRequestGetPayload<{ select: typeof REQUEST_SELECT }>>) {
    const who = await this.names(rows.map((r) => r.decidedById));
    return rows.map(({ employee, decidedById, documentName, documentSize, documentMime, grant, ...r }) => ({
      ...r,
      fromDate: keyFromDate(r.fromDate),
      toDate: keyFromDate(r.toDate),
      employee: { id: employee.id, employeeId: employee.employeeId, firstName: employee.firstName, lastName: employee.lastName, avatarUrl: employee.avatarUrl },
      decidedBy: decidedById ? (who.get(decidedById) ?? null) : null,
      grantId: grant?.id ?? null,
      document: documentName ? { name: documentName, size: documentSize, mime: documentMime } : null,
    }));
  }
}
