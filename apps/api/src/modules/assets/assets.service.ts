import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AssetCondition, AssetRequestStatus, AssetStatus, EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { holds, type AccessContext } from '../access/access.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrivateFilesService } from '../employee-profile/private-files.service';
import { detectFileType, DOCUMENT_TYPES } from '../employee-profile/file-types';
import { TicketsService } from '../helpdesk/tickets.service';
import { addDays, dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import { AssetTypesService } from './asset-types.service';
import type { AssetQueryDto, AssignAssetDto, BulkMoveDto, ImportAssetsDto, PeopleQueryDto, ReportProblemDto, ReturnAssetDto, ReturnRequestDto, SaveAssetDto, SetStatusDto } from './dto';

const DOC_MAX_BYTES = 10 * 1024 * 1024;
const REPAIR_LONG_DAYS = 7;
const PERSON = { id: true, userId: true, employeeId: true, firstName: true, lastName: true, avatarUrl: true, designation: { select: { name: true } } } satisfies Prisma.EmployeeSelect;
const ASSIGNMENT = {
  id: true,
  assignedAt: true,
  conditionOut: true,
  notes: true,
  acknowledgedAt: true,
  returnedAt: true,
  conditionIn: true,
  returnNotes: true,
  requestId: true,
  dueBack: true,
  employee: { select: PERSON },
} satisfies Prisma.AssetAssignmentSelect;
const TYPE = { select: { id: true, name: true, prefix: true, icon: true, fields: true, checklist: true, replaceAfterYears: true, loanable: true, maxLoanDays: true } } as const;
const SELECT = {
  id: true,
  tag: true,
  name: true,
  brand: true,
  model: true,
  serialNumber: true,
  purchaseDate: true,
  purchaseCostPaise: true,
  vendor: true,
  warrantyUntil: true,
  condition: true,
  status: true,
  locationId: true,
  notes: true,
  specs: true,
  createdAt: true,
  updatedAt: true,
  type: TYPE,
  assignments: { where: { returnedAt: null }, select: ASSIGNMENT, take: 1 },
  repairs: { where: { endedAt: null }, select: { id: true, issue: true, vendor: true, startedAt: true }, take: 1 },
} satisfies Prisma.AssetSelect;
type Row = Prisma.AssetGetPayload<{ select: typeof SELECT }>;

/**
 * The asset register (IT) and who holds what. An asset has at most one
 * open assignment; the holder confirms receipt in the app. Repairs, documents,
 * loans (due back) and "report a problem" (an IT ticket) hang off an asset.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly types: AssetTypesService,
    private readonly files: PrivateFilesService,
    @Optional() private readonly tickets?: TicketsService,
  ) {}

  /** IT (asset.manage) or company-wide viewers (HR) see the whole register. */
  seesRegister(access: AccessContext) {
    return holds(access, 'asset.manage') || (access.grants.has('asset.view') && (access.grants.get('asset.view') ?? 'company') === 'company');
  }

  // ─── Register ──────────────────────────────────────────────

  async list(companyId: string, access: AccessContext, q: AssetQueryDto) {
    if (!this.seesRegister(access)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const today = await this.todayKey(companyId);
    const where: Prisma.AssetWhereInput = {
      companyId,
      ...(q.status && { status: q.status }),
      ...(q.typeId && { typeId: q.typeId }),
      ...(q.locationId && { locationId: q.locationId }),
      ...(q.employeeId && { assignments: { some: { employeeId: q.employeeId, returnedAt: null } } }),
      ...(q.warrantyWithinDays !== undefined && { warrantyUntil: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, q.warrantyWithinDays)) }, status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] } }),
      ...(q.search && {
        OR: [
          ...['tag', 'name', 'brand', 'model', 'serialNumber'].map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } })),
          { assignments: { some: { returnedAt: null, employee: { OR: [{ firstName: { contains: q.search, mode: 'insensitive' } }, { lastName: { contains: q.search, mode: 'insensitive' } }] } } } },
        ] as Prisma.AssetWhereInput[],
      }),
      ...(q.attention && (await this.attentionWhere(companyId, q.attention, today))),
    };
    const [rows, total] = await Promise.all([
      this.prisma.asset.findMany({ where, select: SELECT, orderBy: [{ tag: 'asc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.asset.count({ where }),
    ]);
    return { data: rows.map((r) => this.present(r, access, today)), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Who holds what — one row per person (register "By person"). */
  async byPerson(companyId: string, access: AccessContext, q: PeopleQueryDto) {
    if (!this.seesRegister(access)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      assetAssignments: { some: { returnedAt: null } },
      ...(q.search && { OR: [{ firstName: { contains: q.search, mode: 'insensitive' } }, { lastName: { contains: q.search, mode: 'insensitive' } }, { employeeId: { contains: q.search, mode: 'insensitive' } }] }),
    };
    const [people, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: { ...PERSON, employmentStatus: true, terminationDate: true, department: { select: { name: true } }, assetAssignments: { where: { returnedAt: null }, select: { id: true, assignedAt: true, acknowledgedAt: true, dueBack: true, asset: { select: { id: true, tag: true, name: true, type: { select: { name: true, icon: true } } } } } } },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      data: people.map(({ userId: _u, assetAssignments, terminationDate, ...p }) => ({
        employee: { ...p, terminationDate: terminationDate ? keyFromDate(terminationDate) : null },
        assets: assetAssignments.map((a) => ({ ...a, dueBack: a.dueBack ? keyFromDate(a.dueBack) : null })),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(companyId: string, access: AccessContext, id: string) {
    const row = await this.prisma.asset.findFirst({ where: { id, companyId }, select: SELECT });
    if (!row) throw new NotFoundException('Asset not found');
    const holder = row.assignments[0]?.employee;
    const register = this.seesRegister(access);
    if (!register && holder?.userId !== access.userId) throw new NotFoundException('Asset not found');
    const today = await this.todayKey(companyId);
    const [history, repairs, documents] = register
      ? await Promise.all([
          this.prisma.assetAssignment.findMany({ where: { assetId: id }, select: ASSIGNMENT, orderBy: { assignedAt: 'desc' } }),
          this.prisma.assetRepair.findMany({ where: { assetId: id }, select: { id: true, issue: true, vendor: true, costPaise: true, startedAt: true, endedAt: true, notes: true }, orderBy: { startedAt: 'desc' } }),
          this.prisma.assetDocument.findMany({ where: { assetId: id }, select: { id: true, name: true, mime: true, size: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
        ])
      : [[], [], []];
    return {
      ...this.present(row, access, today),
      history: history.map((h) => this.presentAssignment(h)),
      repairs,
      documents,
    };
  }

  async create(companyId: string, access: AccessContext, dto: SaveAssetDto) {
    const type = await this.types.get(companyId, dto.typeId);
    await this.assertLocation(companyId, dto.locationId);
    for (let attempt = 0; attempt < 3; attempt++) {
      const tag = dto.tag ? dto.tag.toUpperCase() : await this.nextTag(companyId, type.prefix);
      try {
        const a = await this.prisma.asset.create({ data: { ...this.data(dto, type.warrantyMonths), companyId, tag }, select: { id: true } });
        return this.get(companyId, access, a.id);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          if (dto.tag) throw new ConflictException(`Tag ${tag} is already used`);
          continue; // someone took the generated tag — try the next one
        }
        throw err;
      }
    }
    throw new ConflictException('Could not generate a tag — enter one');
  }

  async update(companyId: string, access: AccessContext, id: string, dto: SaveAssetDto) {
    await this.exists(companyId, id);
    const type = await this.types.get(companyId, dto.typeId);
    await this.assertLocation(companyId, dto.locationId);
    try {
      await this.prisma.asset.update({ where: { id }, data: { ...this.data(dto, type.warrantyMonths), ...(dto.tag && { tag: dto.tag.toUpperCase() }) } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new ConflictException(`Tag ${dto.tag} is already used`);
      throw err;
    }
    return this.get(companyId, access, id);
  }

  /** Move several assets to a location at once. */
  async bulkMove(companyId: string, dto: BulkMoveDto) {
    await this.assertLocation(companyId, dto.locationId);
    const { count } = await this.prisma.asset.updateMany({ where: { companyId, id: { in: dto.ids } }, data: { locationId: dto.locationId ?? null } });
    return { moved: count };
  }

  /** CSV import: type,name,tag,brand,model,serial,purchase date,cost,vendor,warranty until. All rows or none. */
  async importCsv(companyId: string, access: AccessContext, dto: ImportAssetsDto) {
    const types = await this.types.list(companyId, true);
    const rows = parseCsv(dto.csv);
    if (rows.length && /^type$/i.test(rows[0]![0]?.trim() ?? '')) rows.shift();
    if (!rows.length) throw new BadRequestException('The file has no rows');
    if (rows.length > 500) throw new BadRequestException('At most 500 assets at a time');
    const existing = new Set((await this.prisma.asset.findMany({ where: { companyId }, select: { tag: true } })).map((a) => a.tag));
    const seen = new Set<string>();
    const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
    const checked = rows.map((cells, i) => {
      const [typeName = '', name = '', tag = '', brand = '', model = '', serial = '', bought = '', cost = '', vendor = '', warranty = ''] = cells.map((c) => c.trim());
      const errors: string[] = [];
      const type = types.find((t) => t.name.toLowerCase() === typeName.toLowerCase() || t.prefix.toLowerCase() === typeName.toLowerCase());
      if (!type) errors.push(`unknown type “${typeName}”`);
      if (name.length < 2) errors.push('name missing');
      const t = tag.toUpperCase();
      if (t && !/^[A-Z0-9-]{2,30}$/.test(t)) errors.push('bad tag');
      if (t && (existing.has(t) || seen.has(t))) errors.push(`tag ${t} already used`);
      if (t) seen.add(t);
      if (bought && !isDate(bought)) errors.push('purchase date must be YYYY-MM-DD');
      if (warranty && !isDate(warranty)) errors.push('warranty date must be YYYY-MM-DD');
      if (cost && !(Number(cost) >= 0)) errors.push('cost must be a number');
      return { line: i + 1, type, name, tag: t, brand, model, serial, bought, cost, vendor, warranty, errors };
    });
    const bad = checked.filter((c) => c.errors.length);
    const result = { rows: checked.length, valid: checked.length - bad.length, errors: bad.map((b) => ({ line: b.line, errors: b.errors })) };
    if (dto.dryRun || bad.length) return { ...result, created: 0 };
    let created = 0;
    for (const c of checked) {
      await this.create(companyId, access, {
        typeId: c.type!.id,
        name: c.name,
        tag: c.tag || null,
        brand: c.brand || null,
        model: c.model || null,
        serialNumber: c.serial || null,
        purchaseDate: c.bought || null,
        purchaseCost: c.cost ? Number(c.cost) : null,
        vendor: c.vendor || null,
        warrantyUntil: c.warranty || null,
      });
      created++;
    }
    return { ...result, created };
  }

  // ─── Hand over / take back ─────────────────────────────────

  async assign(companyId: string, access: AccessContext, id: string, dto: AssignAssetDto) {
    const asset = await this.exists(companyId, id);
    if (asset.status !== AssetStatus.AVAILABLE) throw new BadRequestException(`This asset is ${asset.status.toLowerCase().replace('_', ' ')} — only available assets can be assigned`);
    const person = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId }, select: { id: true, userId: true, firstName: true, employmentStatus: true } });
    if (!person) throw new NotFoundException('Employee not found');
    if (person.employmentStatus === EmploymentStatus.TERMINATED) throw new BadRequestException(`${person.firstName} has left the company`);
    let dueBack = dto.dueBack ?? null;
    if (dto.requestId) {
      const req = await this.prisma.assetRequest.findFirst({ where: { id: dto.requestId, companyId }, select: { status: true, employeeId: true, typeId: true, kind: true, loanUntil: true } });
      if (!req) throw new NotFoundException('Request not found');
      if (req.status !== AssetRequestStatus.APPROVED) throw new BadRequestException('That request isn’t approved (or was already fulfilled)');
      if (req.employeeId !== person.id) throw new BadRequestException('That request is from someone else');
      if (req.typeId !== asset.typeId) throw new BadRequestException('This asset is a different type from the one requested');
      if (req.kind === 'LOAN' && req.loanUntil) dueBack = keyFromDate(req.loanUntil);
    }
    const today = await this.todayKey(companyId);
    if (dueBack && dueBack <= today) throw new BadRequestException('The return date must be in the future');
    const notes = [dto.notes, dto.checklist?.length ? `Checklist: ${dto.checklist.map((c) => `✓ ${c}`).join(', ')}` : null].filter(Boolean).join('\n') || null;

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.asset.updateMany({ where: { id, status: AssetStatus.AVAILABLE }, data: { status: AssetStatus.ASSIGNED } });
      if (!count) throw new ConflictException('Someone else just assigned this asset');
      await tx.assetAssignment.create({
        data: { companyId, assetId: id, employeeId: person.id, requestId: dto.requestId ?? null, assignedById: access.userId, conditionOut: dto.condition ?? asset.condition, notes, dueBack: dueBack ? dateFromKey(dueBack) : null },
      });
      if (dto.requestId) {
        const done = await tx.assetRequest.updateMany({ where: { id: dto.requestId, status: AssetRequestStatus.APPROVED }, data: { status: AssetRequestStatus.FULFILLED, assetId: id } });
        if (!done.count) throw new ConflictException('That request was just fulfilled by someone else');
      }
    });
    void this.notifications.notify({
      companyId,
      userIds: [person.userId],
      type: 'asset.assigned',
      title: `${asset.name} (${asset.tag}) was handed to you${dueBack ? ` — on loan until ${dueBack}` : ''}`,
      body: 'Please confirm in the portal once you have received it.',
      link: '/app/assets/mine',
      actionLabel: 'Confirm receipt',
    });
    return this.get(companyId, access, id);
  }

  async returnAsset(companyId: string, access: AccessContext, id: string, dto: ReturnAssetDto) {
    const asset = await this.exists(companyId, id);
    const open = await this.prisma.assetAssignment.findFirst({ where: { assetId: id, returnedAt: null }, select: { id: true } });
    if (!open) throw new BadRequestException('This asset isn’t assigned to anyone');
    const damaged = dto.condition === AssetCondition.DAMAGED;
    await this.prisma.$transaction(async (tx) => {
      await tx.assetAssignment.update({ where: { id: open.id }, data: { returnedAt: new Date(), returnedToId: access.userId, conditionIn: dto.condition, returnNotes: dto.notes ?? null } });
      await tx.asset.update({ where: { id }, data: { status: damaged ? AssetStatus.IN_REPAIR : AssetStatus.AVAILABLE, condition: dto.condition } });
      if (damaged) await tx.assetRepair.create({ data: { companyId, assetId: asset.id, issue: dto.notes ?? 'Returned damaged', createdById: access.userId } });
    });
    return this.get(companyId, access, id);
  }

  async setStatus(companyId: string, access: AccessContext, id: string, dto: SetStatusDto) {
    const asset = await this.exists(companyId, id);
    const open = await this.prisma.assetAssignment.findFirst({ where: { assetId: id, returnedAt: null }, select: { id: true } });
    if (open && dto.status !== 'LOST') throw new BadRequestException('Take the asset back first');
    if (asset.status === dto.status) return this.get(companyId, access, id);
    await this.prisma.$transaction(async (tx) => {
      // Lost while someone had it: close their assignment
      if (open) await tx.assetAssignment.update({ where: { id: open.id }, data: { returnedAt: new Date(), returnedToId: access.userId, returnNotes: `Reported lost${dto.notes ? `: ${dto.notes}` : ''}` } });
      if (dto.status === 'IN_REPAIR') {
        await tx.assetRepair.create({ data: { companyId, assetId: id, issue: dto.issue ?? dto.notes ?? 'Repair', vendor: dto.vendor ?? null, createdById: access.userId } });
      } else if (asset.status === AssetStatus.IN_REPAIR) {
        await tx.assetRepair.updateMany({
          where: { assetId: id, endedAt: null },
          data: { endedAt: new Date(), ...(dto.repairCost != null && { costPaise: Math.round(dto.repairCost * 100) }), ...(dto.notes && { notes: dto.notes }) },
        });
      }
      await tx.asset.update({ where: { id }, data: { status: dto.status, ...(dto.notes && dto.status !== 'AVAILABLE' && { notes: dto.notes }) } });
    });
    return this.get(companyId, access, id);
  }

  /** The holder confirms they received it. */
  async acknowledge(companyId: string, access: AccessContext, assignmentId: string) {
    const a = await this.prisma.assetAssignment.findFirst({ where: { id: assignmentId, companyId }, select: { employeeId: true, returnedAt: true, acknowledgedAt: true } });
    if (!a || a.employeeId !== access.employee?.id) throw new NotFoundException('Assignment not found');
    if (a.returnedAt) throw new BadRequestException('This asset was already returned');
    if (!a.acknowledgedAt) await this.prisma.assetAssignment.update({ where: { id: assignmentId }, data: { acknowledgedAt: new Date() } });
    return this.mine(companyId, access);
  }

  /** Something's wrong with an asset I hold → an IT helpdesk ticket (or a note to IT without helpdesk). */
  async reportProblem(companyId: string, access: AccessContext, assignmentId: string, dto: ReportProblemDto) {
    const a = await this.myOpenAssignment(companyId, access, assignmentId);
    const subject = `Problem with ${a.asset.tag} — ${a.asset.name}`.slice(0, 150);
    if (this.tickets && access.features.has('ops.helpdesk')) {
      const t = await this.tickets.create(companyId, access, { queue: 'IT', subject, description: dto.description });
      await this.prisma.ticket.update({ where: { id: t.id }, data: { assetId: a.asset.id } });
      return { ticket: { id: t.id, number: t.number } };
    }
    const it = await this.notifications.companyWideApprovers(companyId, 'asset.manage');
    void this.notifications.notify({ companyId, userIds: it.filter((u) => u !== access.userId), type: 'asset.problem', title: subject, body: dto.description, link: `/app/assets/${a.asset.id}`, email: false });
    return { ticket: null };
  }

  /** I want to give it back — IT is told to collect it. */
  async requestReturn(companyId: string, access: AccessContext, assignmentId: string, dto: ReturnRequestDto) {
    const a = await this.myOpenAssignment(companyId, access, assignmentId);
    const it = await this.notifications.companyWideApprovers(companyId, 'asset.manage');
    const me = await this.prisma.employee.findUnique({ where: { id: access.employee!.id }, select: { firstName: true, lastName: true } });
    await this.notifications.notify({
      companyId,
      userIds: it.filter((u) => u !== access.userId),
      type: 'asset.return_requested',
      title: `${me?.firstName} ${me?.lastName} wants to return ${a.asset.tag} (${a.asset.name})`,
      body: dto.note ?? null,
      link: `/app/assets/${a.asset.id}`,
      email: false,
      dedupeKey: `asset-return:${assignmentId}`,
    });
    return { sent: true };
  }

  // ─── Documents ─────────────────────────────────────────────

  async addDocument(companyId: string, access: AccessContext, id: string, file?: Express.Multer.File) {
    await this.exists(companyId, id);
    if (!file) throw new BadRequestException('Choose a file');
    if (file.size > DOC_MAX_BYTES) throw new BadRequestException('Files must be 10 MB or smaller');
    const type = detectFileType(file.buffer, file.mimetype);
    if (!type || !DOCUMENT_TYPES.has(type.ext)) throw new BadRequestException('Documents can be PDF, JPG, PNG, WebP or Word (.docx)');
    const key = `${companyId}/assets/${id}/${randomUUID()}.${type.ext}`;
    await this.files.save(key, file.buffer);
    const base = (file.originalname ?? 'document').split(/[\\/]/).pop()!.replace(/\.[^.]*$/, '').replace(/[^\w\- ().]+/g, '').slice(0, 80) || 'document';
    await this.prisma.assetDocument.create({ data: { companyId, assetId: id, name: `${base}.${type.ext}`, fileKey: key, mime: type.mime, size: file.size, uploadedById: access.userId } });
    return this.get(companyId, access, id);
  }

  async openDocument(companyId: string, access: AccessContext, id: string, docId: string) {
    if (!this.seesRegister(access)) throw new NotFoundException('Document not found');
    const d = await this.prisma.assetDocument.findFirst({ where: { id: docId, assetId: id, companyId }, select: { fileKey: true, name: true, mime: true, size: true } });
    if (!d) throw new NotFoundException('Document not found');
    const stream = await this.files.open(d.fileKey).catch(() => {
      throw new NotFoundException('The file is no longer available');
    });
    return { stream, name: d.name, mime: d.mime, size: d.size };
  }

  async removeDocument(companyId: string, access: AccessContext, id: string, docId: string) {
    const d = await this.prisma.assetDocument.findFirst({ where: { id: docId, assetId: id, companyId }, select: { id: true, fileKey: true } });
    if (!d) throw new NotFoundException('Document not found');
    await this.prisma.assetDocument.delete({ where: { id: d.id } });
    await this.files.remove(d.fileKey).catch(() => undefined);
    return this.get(companyId, access, id);
  }

  // ─── Per person ────────────────────────────────────────────

  async mine(companyId: string, access: AccessContext) {
    if (!access.employee) return { current: [], past: [] };
    return this.forEmployeeRows(companyId, access.employee.id);
  }

  async forEmployee(companyId: string, access: AccessContext, employeeId: string) {
    await this.access.assertEmployeeInScope(access, 'asset.view', companyId, employeeId);
    return this.forEmployeeRows(companyId, employeeId);
  }

  private async forEmployeeRows(companyId: string, employeeId: string) {
    const rows = await this.prisma.assetAssignment.findMany({
      where: { companyId, employeeId },
      orderBy: { assignedAt: 'desc' },
      select: { ...ASSIGNMENT, asset: { select: { id: true, tag: true, name: true, brand: true, model: true, serialNumber: true, warrantyUntil: true, condition: true, type: { select: { name: true, icon: true } } } } },
    });
    const tickets = await this.prisma.ticket.findMany({
      where: { companyId, employeeId, assetId: { in: rows.filter((r) => !r.returnedAt).map((r) => r.asset.id) }, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      select: { id: true, number: true, status: true, assetId: true, subject: true },
    });
    const present = (r: (typeof rows)[number]) => ({
      ...this.presentAssignment(r),
      asset: { ...r.asset, warrantyUntil: r.asset.warrantyUntil ? keyFromDate(r.asset.warrantyUntil) : null },
      openTickets: tickets.filter((t) => t.assetId === r.asset.id).map(({ assetId: _a, ...t }) => t),
    });
    return { current: rows.filter((r) => !r.returnedAt).map(present), past: rows.filter((r) => r.returnedAt).map(present) };
  }

  /** IT dashboard numbers and what needs attention. */
  async summary(companyId: string, access: AccessContext) {
    if (!this.seesRegister(access)) throw new ForbiddenException('You do not have permission to perform this action. Required: asset.manage');
    const today = await this.todayKey(companyId);
    const [byStatus, byType, types, warranty, unconfirmed, toFulfil, totals, repairsLong, loansDue, loansOverdue, old, joiners] = await Promise.all([
      this.prisma.asset.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
      this.prisma.asset.groupBy({ by: ['typeId', 'status'], where: { companyId }, _count: { _all: true } }),
      this.types.list(companyId, true),
      this.prisma.asset.count({ where: { companyId, status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] }, warrantyUntil: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, 30)) } } }),
      this.prisma.assetAssignment.count({ where: { companyId, returnedAt: null, acknowledgedAt: null } }),
      this.prisma.assetRequest.count({ where: { companyId, status: AssetRequestStatus.APPROVED } }),
      this.prisma.asset.aggregate({ where: { companyId, status: { notIn: [AssetStatus.RETIRED] } }, _sum: { purchaseCostPaise: true }, _count: { _all: true } }),
      this.prisma.assetRepair.count({ where: { companyId, endedAt: null, startedAt: { lt: new Date(Date.now() - REPAIR_LONG_DAYS * 86_400_000) } } }),
      this.prisma.assetAssignment.count({ where: { companyId, returnedAt: null, dueBack: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, 7)) } } }),
      this.prisma.assetAssignment.count({ where: { companyId, returnedAt: null, dueBack: { lt: dateFromKey(today) } } }),
      this.prisma.asset.count({ where: { companyId, ...(await this.attentionWhere(companyId, 'old', today)) } }),
      this.prisma.assetRequest.count({ where: { companyId, status: AssetRequestStatus.APPROVED, source: 'KIT' } }),
    ]);
    const lostThisYear = await this.prisma.asset.aggregate({ where: { companyId, status: AssetStatus.LOST, updatedAt: { gte: new Date(`${today.slice(0, 4)}-01-01T00:00:00Z`) } }, _count: { _all: true }, _sum: { purchaseCostPaise: true } });
    const stock = types.map((t) => ({
      type: { id: t.id, name: t.name, icon: t.icon, minStock: t.minStock, requestable: t.requestable },
      total: byType.filter((b) => b.typeId === t.id).reduce((s, b) => s + b._count._all, 0),
      available: byType.find((b) => b.typeId === t.id && b.status === AssetStatus.AVAILABLE)?._count._all ?? 0,
    }));
    return {
      total: totals._count._all,
      boughtPaise: totals._sum.purchaseCostPaise ?? 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byType: stock,
      warrantyEndingSoon: warranty,
      unconfirmed,
      requestsToFulfil: toFulfil,
      joinersToPrepare: joiners,
      attention: {
        warranty,
        repairLong: repairsLong,
        old,
        unconfirmed,
        loansDue,
        loansOverdue,
        outOfStock: stock.filter((s) => s.type.minStock > 0 && s.available < s.type.minStock).map((s) => ({ name: s.type.name, available: s.available, minStock: s.type.minStock })),
      },
      lostThisYear: { count: lostThisYear._count._all, paise: lostThisYear._sum.purchaseCostPaise ?? 0 },
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async attentionWhere(companyId: string, kind: NonNullable<AssetQueryDto['attention']>, today: string): Promise<Prisma.AssetWhereInput> {
    const live = { status: { notIn: [AssetStatus.RETIRED, AssetStatus.LOST] } };
    if (kind === 'warranty') return { ...live, warrantyUntil: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, 30)) } };
    if (kind === 'repair') return { status: AssetStatus.IN_REPAIR, repairs: { some: { endedAt: null, startedAt: { lt: new Date(Date.now() - REPAIR_LONG_DAYS * 86_400_000) } } } };
    if (kind === 'unconfirmed') return { assignments: { some: { returnedAt: null, acknowledgedAt: null } } };
    if (kind === 'loans') return { assignments: { some: { returnedAt: null, dueBack: { lte: dateFromKey(addDays(today, 7)) } } } };
    // old: bought longer ago than the type's "replace after"
    const types = (await this.types.list(companyId, true)).filter((t) => t.replaceAfterYears);
    if (!types.length) return { id: { in: [] } };
    return {
      ...live,
      OR: types.map((t) => ({ typeId: t.id, purchaseDate: { lt: dateFromKey(`${Number(today.slice(0, 4)) - t.replaceAfterYears!}${today.slice(4)}`) } })),
    };
  }

  private async myOpenAssignment(companyId: string, access: AccessContext, assignmentId: string) {
    const a = await this.prisma.assetAssignment.findFirst({ where: { id: assignmentId, companyId }, select: { employeeId: true, returnedAt: true, asset: { select: { id: true, tag: true, name: true } } } });
    if (!a || a.employeeId !== access.employee?.id) throw new NotFoundException('Assignment not found');
    if (a.returnedAt) throw new BadRequestException('This asset was already returned');
    return a;
  }

  private async nextTag(companyId: string, prefix: string): Promise<string> {
    const rows = await this.prisma.asset.findMany({ where: { companyId, tag: { startsWith: `${prefix}-` } }, select: { tag: true } });
    const max = rows.reduce((m, r) => Math.max(m, Number(r.tag.slice(prefix.length + 1)) || 0), 0);
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  }

  private data(dto: SaveAssetDto, warrantyMonths: number | null) {
    let warranty = dto.warrantyUntil ?? null;
    if (!warranty && dto.purchaseDate && warrantyMonths) {
      const d = new Date(`${dto.purchaseDate}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + warrantyMonths);
      warranty = d.toISOString().slice(0, 10);
    }
    const specs = dto.specs ? Object.fromEntries(Object.entries(dto.specs).filter(([k, v]) => k && typeof v === 'string' && v.trim()).map(([k, v]) => [k.slice(0, 40), v.trim().slice(0, 120)])) : undefined;
    return {
      typeId: dto.typeId,
      name: dto.name,
      brand: dto.brand ?? null,
      model: dto.model ?? null,
      serialNumber: dto.serialNumber ?? null,
      purchaseDate: dto.purchaseDate ? dateFromKey(dto.purchaseDate) : null,
      purchaseCostPaise: dto.purchaseCost == null ? null : Math.round(dto.purchaseCost * 100),
      vendor: dto.vendor ?? null,
      warrantyUntil: warranty ? dateFromKey(warranty) : null,
      ...(dto.condition && { condition: dto.condition }),
      locationId: dto.locationId ?? null,
      notes: dto.notes ?? null,
      ...(specs !== undefined && { specs }),
    };
  }

  private async exists(companyId: string, id: string) {
    const a = await this.prisma.asset.findFirst({ where: { id, companyId }, select: { id: true, tag: true, name: true, status: true, typeId: true, condition: true } });
    if (!a) throw new NotFoundException('Asset not found');
    return a;
  }

  private async assertLocation(companyId: string, locationId?: string | null) {
    if (locationId && !(await this.prisma.officeLocation.count({ where: { id: locationId, companyId } }))) throw new NotFoundException('Location not found');
  }

  private presentAssignment(a: Prisma.AssetAssignmentGetPayload<{ select: typeof ASSIGNMENT }>) {
    const { userId: _u, ...employee } = a.employee;
    return { ...a, dueBack: a.dueBack ? keyFromDate(a.dueBack) : null, employee };
  }

  private present(r: Row, access: AccessContext, today: string) {
    const open = r.assignments[0];
    const { assignments: _a, repairs, ...rest } = r;
    const bought = r.purchaseDate ? keyFromDate(r.purchaseDate) : null;
    const ageYears = bought ? (Date.parse(today) - Date.parse(bought)) / (365.25 * 86_400_000) : null;
    return {
      ...rest,
      purchaseDate: bought,
      warrantyUntil: r.warrantyUntil ? keyFromDate(r.warrantyUntil) : null,
      holder: open ? this.presentAssignment(open) : null,
      openRepair: repairs[0] ?? null,
      dueSoon: Boolean(open?.dueBack && keyFromDate(open.dueBack) <= addDays(today, 7)),
      overdue: Boolean(open?.dueBack && keyFromDate(open.dueBack) < today),
      replaceDue: Boolean(ageYears !== null && r.type.replaceAfterYears && ageYears >= r.type.replaceAfterYears),
      canManage: holds(access, 'asset.manage'),
    };
  }

  async todayKey(companyId: string): Promise<string> {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }
}

/** A small CSV parser: commas, quotes ("a, b"), doubled quotes and CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}
