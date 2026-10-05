import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma, ProjectRole, ProjectStatus, ProjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dateFromKey, isValidTimeZone, keyFromDate, localDateKey } from '../attendance/time-zone';
import { allocationOn, peakAllocation, type Span } from './allocation';
import type { CapacityQueryDto, ProjectQueryDto, SaveMemberDto, SaveProjectDto } from './dto';

const PERSON = {
  id: true,
  employeeId: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  designation: { select: { name: true } },
} satisfies Prisma.EmployeeSelect;

const MEMBER_SELECT = {
  id: true,
  role: true,
  allocation: true,
  billed: true,
  nightShift: true,
  startDate: true,
  endDate: true,
  employee: { select: PERSON },
  lead: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ProjectMemberSelect;

const ROLE_LABEL: Record<ProjectRole, string> = { MEMBER: 'Member', TEAM_LEAD: 'Team lead', MANAGER: 'Project manager' };
const fmt = (k: string) => new Date(`${k}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * Projects and who works on them. Only the PMO (project.manage) changes
 * assignments; an employee's overlapping allocations never exceed 100%.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async todayKey(companyId: string): Promise<string> {
    const s = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } });
    return localDateKey(new Date(), s?.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Kolkata');
  }

  // ─── Projects ──────────────────────────────────────────────

  async list(companyId: string, query: ProjectQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const today = dateFromKey(await this.todayKey(companyId));
    const where: Prisma.ProjectWhereInput = {
      companyId,
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
          { clientName: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const activeMember: Prisma.ProjectMemberWhereInput = { startDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] };
    const [rows, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          clientName: true,
          status: true,
          startDate: true,
          endDate: true,
          members: { where: { ...activeMember, role: ProjectRole.MANAGER }, select: { employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
          _count: { select: { members: { where: activeMember } } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);
    return {
      data: rows.map(({ members, _count, ...p }) => ({
        ...p,
        startDate: keyFromDate(p.startDate),
        endDate: p.endDate ? keyFromDate(p.endDate) : null,
        managers: members.map((m) => m.employee),
        memberCount: _count.members,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(companyId: string, id: string) {
    const p = await this.prisma.project.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        clientName: true,
        status: true,
        startDate: true,
        endDate: true,
        members: { select: MEMBER_SELECT, orderBy: [{ role: 'desc' }, { startDate: 'asc' }] },
      },
    });
    if (!p) throw new NotFoundException('Project not found');
    const today = await this.todayKey(companyId);
    return {
      ...p,
      startDate: keyFromDate(p.startDate),
      endDate: p.endDate ? keyFromDate(p.endDate) : null,
      today,
      members: p.members.map((m) => this.presentMember(m, today)),
    };
  }

  async create(companyId: string, userId: string, dto: SaveProjectDto) {
    this.assertDates(dto.startDate, dto.endDate ?? null, 'The project');
    try {
      const p = await this.prisma.project.create({
        data: { ...this.projectData(dto), companyId, createdById: userId },
        select: { id: true, type: true },
      });
      await this.event(companyId, p.id, userId, 'created', `created the project (${p.type === ProjectType.CLIENT ? 'client — billable' : 'internal — investment'})`);
      return this.get(companyId, p.id);
    } catch (err) {
      throw this.duplicateCode(err, dto.code);
    }
  }

  async update(companyId: string, id: string, dto: SaveProjectDto, actorUserId: string | null = null) {
    const before = await this.exists(companyId, id);
    this.assertDates(dto.startDate, dto.endDate ?? null, 'The project');
    // Assignments must still fit inside the project's dates
    const outside = await this.prisma.projectMember.count({
      where: {
        projectId: id,
        OR: [
          { startDate: { lt: dateFromKey(dto.startDate) } },
          ...(dto.endDate ? [{ endDate: null }, { endDate: { gt: dateFromKey(dto.endDate) } }] : []),
        ],
      },
    });
    if (outside) throw new BadRequestException(`${outside} assignment${outside === 1 ? '' : 's'} fall outside these dates — adjust them first`);
    try {
      await this.prisma.project.update({ where: { id }, data: this.projectData(dto) });
    } catch (err) {
      throw this.duplicateCode(err, dto.code);
    }
    // Type changes are kept: past months keep the type they had (billable reports)
    if (dto.type && dto.type !== before.type) {
      await this.event(companyId, id, actorUserId, 'type', `changed the project to ${dto.type === ProjectType.CLIENT ? 'client (billable)' : 'internal (investment)'}`, dto.type);
    }
    if (dto.status && dto.status !== before.status) {
      await this.event(companyId, id, actorUserId, 'status', `set the status to ${dto.status.toLowerCase().replace('_', ' ')}`);
    }
    return this.get(companyId, id);
  }

  private projectData(dto: SaveProjectDto) {
    return {
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      clientName: dto.clientName ?? null,
      ...(dto.type && { type: dto.type }),
      ...(dto.color !== undefined && { color: dto.color }),
      status: dto.status ?? ProjectStatus.ACTIVE,
      startDate: dateFromKey(dto.startDate),
      endDate: dto.endDate ? dateFromKey(dto.endDate) : null,
    };
  }

  // ─── Members ───────────────────────────────────────────────

  async addMember(companyId: string, projectId: string, dto: SaveMemberDto, actorUserId: string | null = null) {
    return this.saveMember(companyId, projectId, null, dto, actorUserId);
  }

  async updateMember(companyId: string, projectId: string, memberId: string, dto: SaveMemberDto, actorUserId: string | null = null) {
    return this.saveMember(companyId, projectId, memberId, dto, actorUserId);
  }

  /** PMO: does the client pay for this person on this project? */
  async setBilled(companyId: string, projectId: string, memberId: string, billed: boolean, actorUserId: string | null) {
    await this.exists(companyId, projectId);
    const m = await this.prisma.projectMember.findFirst({ where: { id: memberId, projectId }, select: { id: true, billed: true, employee: { select: { firstName: true, lastName: true } } } });
    if (!m) throw new NotFoundException('Assignment not found');
    if (m.billed !== billed) {
      await this.prisma.projectMember.update({ where: { id: memberId }, data: { billed } });
      await this.event(companyId, projectId, actorUserId, 'member_updated', `marked ${m.employee.firstName} ${m.employee.lastName} as ${billed ? 'billed to the client' : 'not billed (shadow / trainee)'}`);
    }
    return { id: memberId, billed };
  }

  private async saveMember(companyId: string, projectId: string, memberId: string | null, dto: SaveMemberDto, actorUserId: string | null = null) {
    const project = await this.exists(companyId, projectId);
    const existing = memberId ? await this.prisma.projectMember.findFirst({ where: { id: memberId, projectId }, select: { id: true, employeeId: true, role: true } }) : null;
    if (memberId && !existing) throw new NotFoundException('Assignment not found');
    if (existing && existing.employeeId !== dto.employeeId) throw new BadRequestException('Remove this assignment and add the other person instead');

    const end = dto.endDate ?? null;
    this.assertDates(dto.startDate, end, 'The assignment');
    if (dto.startDate < keyFromDate(project.startDate)) throw new BadRequestException(`The assignment can't start before the project (${fmt(keyFromDate(project.startDate))})`);
    if (project.endDate && (!end || end > keyFromDate(project.endDate))) {
      throw new BadRequestException(`The assignment must end by the project's end date (${fmt(keyFromDate(project.endDate))})`);
    }

    const person = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
      select: { id: true, firstName: true, employmentStatus: true },
    });
    if (!person) throw new NotFoundException('Employee not found');
    if (person.employmentStatus === EmploymentStatus.TERMINATED) throw new BadRequestException(`${person.firstName} has left the company`);

    // Team lead: only for members, must lead in this project during these dates
    const lead = dto.role === ProjectRole.MEMBER ? (dto.leadEmployeeId ?? null) : null;
    if (dto.role !== ProjectRole.MEMBER && dto.leadEmployeeId) throw new BadRequestException('Only members have a team lead');
    if (lead) {
      if (lead === dto.employeeId) throw new BadRequestException('Someone can’t be their own team lead');
      const leads = await this.prisma.projectMember.count({
        where: { projectId, employeeId: lead, role: ProjectRole.TEAM_LEAD, ...this.overlapping(dto.startDate, end) },
      });
      if (!leads) throw new BadRequestException('Pick a team lead of this project (assigned for these dates)');
    }

    return this.prisma.$transaction(async (tx) => {
      // One allocation decision per employee at a time (concurrent PMO edits)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.employeeId}))`;

      const same = await tx.projectMember.count({
        where: { projectId, employeeId: dto.employeeId, ...(memberId && { id: { not: memberId } }), ...this.overlapping(dto.startDate, end) },
      });
      if (same) throw new ConflictException(`${person.firstName} is already on this project for part of these dates`);

      const others = await this.spans(tx, dto.employeeId, memberId);
      const peakElsewhere = peakAllocation(others, dto.startDate, end);
      if (peakElsewhere + dto.allocation > 100) {
        throw new BadRequestException(
          `${person.firstName} would be ${peakElsewhere + dto.allocation}% allocated — already ${peakElsewhere}% on other projects at the busiest point. ` +
            `At most ${Math.max(0, 100 - peakElsewhere)}% is free for these dates.`,
        );
      }

      const data = {
        role: dto.role,
        leadEmployeeId: lead,
        allocation: dto.allocation,
        ...(dto.billed !== undefined && { billed: dto.billed }),
        ...(dto.nightShift !== undefined && { nightShift: dto.nightShift }),
        startDate: dateFromKey(dto.startDate),
        endDate: end ? dateFromKey(end) : null,
      };
      const saved = memberId
        ? await tx.projectMember.update({ where: { id: memberId }, data, select: { id: true } })
        : await tx.projectMember.create({ data: { ...data, companyId, projectId, employeeId: dto.employeeId }, select: { id: true } });

      // No longer a team lead → their members now go to the project manager
      let unassigned = 0;
      if (existing?.role === ProjectRole.TEAM_LEAD && dto.role !== ProjectRole.TEAM_LEAD) {
        unassigned = (await tx.projectMember.updateMany({ where: { projectId, leadEmployeeId: dto.employeeId }, data: { leadEmployeeId: null } })).count;
      }
      const row = await tx.projectMember.findUniqueOrThrow({ where: { id: saved.id }, select: MEMBER_SELECT });
      await tx.projectEvent.create({
        data: {
          companyId, projectId, actorUserId,
          kind: memberId ? 'member_updated' : 'member_added',
          text: memberId
            ? `updated ${row.employee.firstName} ${row.employee.lastName}: ${ROLE_LABEL[row.role]} · ${row.allocation}%`
            : `added ${row.employee.firstName} ${row.employee.lastName} as ${ROLE_LABEL[row.role]} · ${row.allocation}%`,
        },
      });
      return { ...this.presentMember(row, await this.todayKey(companyId)), projectId, unassignedMembers: unassigned };
    });
  }

  async removeMember(companyId: string, projectId: string, memberId: string, actorUserId: string | null = null) {
    await this.exists(companyId, projectId);
    const m = await this.prisma.projectMember.findFirst({ where: { id: memberId, projectId }, select: { id: true, employeeId: true, role: true, employee: { select: { firstName: true, lastName: true } } } });
    if (!m) throw new NotFoundException('Assignment not found');
    return this.prisma.$transaction(async (tx) => {
      let unassigned = 0;
      if (m.role === ProjectRole.TEAM_LEAD) {
        const stillLeads = await tx.projectMember.count({ where: { projectId, employeeId: m.employeeId, role: ProjectRole.TEAM_LEAD, id: { not: m.id } } });
        if (!stillLeads) unassigned = (await tx.projectMember.updateMany({ where: { projectId, leadEmployeeId: m.employeeId }, data: { leadEmployeeId: null } })).count;
      }
      await tx.projectMember.delete({ where: { id: m.id } });
      await tx.projectEvent.create({ data: { companyId, projectId, actorUserId, kind: 'member_removed', text: `removed ${m.employee.firstName} ${m.employee.lastName}` } });
      return { id: m.id, projectId, employee: m.employee, unassignedMembers: unassigned };
    });
  }

  // ─── Allocation ────────────────────────────────────────────

  /** Someone's assignments (non-completed projects) and how much is free. */
  async capacity(companyId: string, employeeId: string, query: CapacityQueryDto) {
    const person = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } });
    if (!person) throw new NotFoundException('Employee not found');
    const today = await this.todayKey(companyId);
    const from = query.from ?? today;
    const to = query.to ?? null;
    const rows = await this.prisma.projectMember.findMany({
      where: { employeeId, project: { status: { not: ProjectStatus.COMPLETED } } },
      select: { ...MEMBER_SELECT, project: { select: { id: true, code: true, name: true, status: true } } },
      orderBy: { startDate: 'asc' },
    });
    const spans = rows.filter((r) => r.id !== query.excludeMemberId).map((r) => this.span(r));
    const peak = peakAllocation(spans, from, to);
    return {
      employeeId,
      from,
      to,
      allocatedToday: allocationOn(rows.map((r) => this.span(r)), today),
      peak,
      free: Math.max(0, 100 - peak),
      assignments: rows.map(({ project, ...m }) => ({ ...this.presentMember(m, today), project })),
    };
  }

  /** Projects I'm on right now (for the profile / home page). */
  async mine(companyId: string, employeeId: string | undefined) {
    if (!employeeId) return [];
    return (await this.capacity(companyId, employeeId, {})).assignments.filter((a) => a.active || a.upcoming);
  }

  private async spans(db: Prisma.TransactionClient, employeeId: string, excludeId: string | null): Promise<Span[]> {
    const rows = await db.projectMember.findMany({
      where: { employeeId, ...(excludeId && { id: { not: excludeId } }), project: { status: { not: ProjectStatus.COMPLETED } } },
      select: { allocation: true, startDate: true, endDate: true },
    });
    return rows.map((r) => this.span(r));
  }

  private span(r: { allocation: number; startDate: Date; endDate: Date | null }): Span {
    return { allocation: r.allocation, start: keyFromDate(r.startDate), end: r.endDate ? keyFromDate(r.endDate) : null };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private presentMember(m: Prisma.ProjectMemberGetPayload<{ select: typeof MEMBER_SELECT }>, today: string) {
    const start = keyFromDate(m.startDate);
    const end = m.endDate ? keyFromDate(m.endDate) : null;
    return {
      ...m,
      startDate: start,
      endDate: end,
      roleLabel: ROLE_LABEL[m.role],
      active: start <= today && (!end || end >= today),
      upcoming: start > today,
    };
  }

  private overlapping(start: string, end: string | null): Prisma.ProjectMemberWhereInput {
    return {
      ...(end && { startDate: { lte: dateFromKey(end) } }),
      OR: [{ endDate: null }, { endDate: { gte: dateFromKey(start) } }],
    };
  }

  private assertDates(start: string, end: string | null, what: string) {
    if (end && end < start) throw new BadRequestException(`${what} ends before it starts`);
  }

  private async exists(companyId: string, id: string) {
    const p = await this.prisma.project.findFirst({ where: { id, companyId }, select: { id: true, startDate: true, endDate: true, status: true, type: true } });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  private async event(companyId: string, projectId: string, actorUserId: string | null, kind: string, text: string, value?: string) {
    await this.prisma.projectEvent.create({ data: { companyId, projectId, actorUserId, kind, text, value: value ?? null } });
  }

  private duplicateCode(err: unknown, code: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return new ConflictException(`A project with code ${code} already exists`);
    return err;
  }
}
