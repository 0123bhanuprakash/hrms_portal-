import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import type { AccessScope } from '@hrms/types';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { HierarchyService } from '../access/hierarchy.service';
import type { ReportingLineDto, SaveOrgLevelDto } from './dto';

const SUGGESTED_LEVELS: Array<{ name: string; color: string }> = [
  { name: 'Executive', color: '#7C3AED' },
  { name: 'Director', color: '#2563EB' },
  { name: 'Manager', color: '#0891B2' },
  { name: 'Team Lead', color: '#059669' },
  { name: 'Member', color: '#64748B' },
];

const LEVEL_SELECT = { id: true, name: true, rank: true, color: true } as const;

/** Hierarchy scopes on these permissions decide who "sees" someone through the reporting line. */
const REPORTING_PERMISSIONS = ['employee.view', 'attendance.view', 'leave.view', 'leave.approve', 'attendance.approve'];

/**
 * Organisation structure: company-defined org levels, the org chart,
 * and reporting-line changes with an access-impact preview
 * ("who gains / loses visibility of these people").
 */
@Injectable()
export class OrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly hierarchy: HierarchyService,
  ) {}

  // ─── Org levels ───────────────────────────────────────────

  async listLevels(companyId: string) {
    const levels = await this.prisma.orgLevel.findMany({
      where: { companyId },
      orderBy: { rank: 'desc' },
      select: { ...LEVEL_SELECT, _count: { select: { designations: true } } },
    });
    return levels.map(({ _count, ...l }) => ({ ...l, designationCount: _count.designations }));
  }

  /** New levels go to the bottom (least senior); reorder afterwards. */
  async createLevel(companyId: string, dto: SaveOrgLevelDto) {
    await this.assertLevelNameFree(companyId, dto.name);
    const lowest = await this.prisma.orgLevel.findFirst({ where: { companyId }, orderBy: { rank: 'asc' }, select: { rank: true } });
    const rank = lowest ? lowest.rank - 1 : 100;
    await this.prisma.orgLevel.create({ data: { companyId, name: dto.name.trim(), color: dto.color ?? null, rank } });
    return this.listLevels(companyId);
  }

  async updateLevel(companyId: string, id: string, dto: SaveOrgLevelDto) {
    const level = await this.findLevel(companyId, id);
    if (dto.name.trim() !== level.name) await this.assertLevelNameFree(companyId, dto.name, id);
    await this.prisma.orgLevel.update({ where: { id }, data: { name: dto.name.trim(), ...(dto.color && { color: dto.color }) } });
    return this.listLevels(companyId);
  }

  async deleteLevel(companyId: string, id: string) {
    await this.findLevel(companyId, id);
    // Designations at this level keep their title, just lose the level (FK: SET NULL)
    await this.prisma.orgLevel.delete({ where: { id } });
    return this.listLevels(companyId);
  }

  /** ids from most senior → least senior. */
  async reorderLevels(companyId: string, ids: string[]) {
    const levels = await this.prisma.orgLevel.findMany({ where: { companyId }, select: { id: true } });
    const known = new Set(levels.map((l) => l.id));
    if (ids.length !== levels.length || ids.some((id) => !known.has(id)) || new Set(ids).size !== ids.length) {
      throw new BadRequestException('Send every level of the company exactly once');
    }
    await this.prisma.$transaction([
      // Park ranks out of the way first (ranks are unique per company)
      ...ids.map((id, i) => this.prisma.orgLevel.update({ where: { id }, data: { rank: -1000 - i } })),
      ...ids.map((id, i) => this.prisma.orgLevel.update({ where: { id }, data: { rank: (ids.length - i) * 10 } })),
    ]);
    return this.listLevels(companyId);
  }

  /** One-click starter set for companies that haven't defined levels yet. */
  async createSuggestedLevels(companyId: string) {
    const existing = await this.prisma.orgLevel.count({ where: { companyId } });
    if (existing) throw new BadRequestException('This company already has org levels');
    await this.prisma.orgLevel.createMany({
      data: SUGGESTED_LEVELS.map((l, i) => ({ companyId, name: l.name, color: l.color, rank: (SUGGESTED_LEVELS.length - i) * 10 })),
    });
    return this.listLevels(companyId);
  }

  // ─── Org chart ────────────────────────────────────────────

  /** Flat list of current employees with their manager; the web builds the tree. */
  async chart(companyId: string) {
    const [employees, levels] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          employmentStatus: true,
          reportingManagerId: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true, orgLevel: { select: LEVEL_SELECT } } },
          location: { select: { id: true, name: true } },
          _count: { select: { subordinates: true } },
        },
      }),
      this.listLevels(companyId),
    ]);
    return {
      employees: employees.map(({ _count, ...e }) => ({ ...e, directReports: _count.subordinates })),
      levels,
    };
  }

  // ─── Reporting lines ──────────────────────────────────────

  /**
   * What moving `employeeId` (and everyone under them) to `managerId` does:
   * validity (loops), the people moving, and who gains / loses visibility
   * through reporting-line scopes (direct reports / all reports).
   * Company- and department-wide access is unaffected and not listed.
   */
  async preview(companyId: string, dto: ReportingLineDto) {
    const employee = await this.findEmployee(companyId, dto.employeeId);
    if (dto.managerId) await this.findEmployee(companyId, dto.managerId);

    if (dto.managerId === dto.employeeId) {
      return { valid: false, reason: 'An employee cannot report to themselves', moving: [], changes: [] };
    }
    if (dto.managerId) {
      const loop = await this.prisma.employeeHierarchy.findUnique({
        where: { ancestorId_descendantId: { ancestorId: dto.employeeId, descendantId: dto.managerId } },
      });
      if (loop) {
        return {
          valid: false,
          reason: `That would create a loop: ${await this.nameOf(dto.managerId)} reports (directly or indirectly) to ${employee.firstName}`,
          moving: [],
          changes: [],
        };
      }
    }
    if ((employee.reportingManagerId ?? null) === (dto.managerId ?? null)) {
      return { valid: true, unchanged: true, moving: [], changes: [] };
    }

    const subtree = await this.prisma.employeeHierarchy.findMany({
      where: { ancestorId: dto.employeeId },
      orderBy: { depth: 'asc' },
      select: { depth: true, descendant: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Distance from each manager above to the moved employee: before and after
    const oldAbove = await this.prisma.employeeHierarchy.findMany({
      where: { descendantId: dto.employeeId, depth: { gt: 0 } },
      select: { depth: true, ancestorId: true },
    });
    const newAbove = dto.managerId
      ? (
          await this.prisma.employeeHierarchy.findMany({
            where: { descendantId: dto.managerId },
            select: { depth: true, ancestorId: true },
          })
        ).map((r) => ({ ancestorId: r.ancestorId, depth: r.depth + 1 }))
      : [];
    const before = new Map(oldAbove.map((r) => [r.ancestorId, r.depth]));
    const after = new Map(newAbove.map((r) => [r.ancestorId, r.depth]));
    const people = await this.prisma.employee.findMany({
      where: { id: { in: [...new Set([...before.keys(), ...after.keys()])] } },
      select: { id: true, userId: true, firstName: true, lastName: true },
    });

    const changes: Array<{ employeeId: string; name: string; effect: 'gains' | 'loses' | 'keeps'; relation: string; via: string | null }> = [];
    for (const person of people) {
      const ctx = await this.access.forUser(person.userId);
      const scopes = new Set(REPORTING_PERMISSIONS.map((p) => ctx.grants.get(p)).filter(Boolean) as AccessScope[]);
      const seesAll = scopes.has('all_reports');
      const seesDirect = scopes.has('direct_reports');
      const sees = (depth: number | undefined) => depth !== undefined && (seesAll || (seesDirect && depth === 1));
      const b = sees(before.get(person.id));
      const a = sees(after.get(person.id));
      const newDepth = after.get(person.id);
      const relation =
        newDepth === 1 ? 'New direct manager' : newDepth ? 'New manager above' : before.get(person.id) === 1 ? 'Former direct manager' : 'Former manager above';
      if (a && !b) changes.push({ employeeId: person.id, name: `${person.firstName} ${person.lastName}`, effect: 'gains', relation, via: seesAll ? 'all reports' : 'direct reports' });
      else if (b && !a) changes.push({ employeeId: person.id, name: `${person.firstName} ${person.lastName}`, effect: 'loses', relation, via: null });
      else if (a && b) changes.push({ employeeId: person.id, name: `${person.firstName} ${person.lastName}`, effect: 'keeps', relation, via: seesAll ? 'all reports' : 'direct reports' });
    }
    const order = { gains: 0, loses: 1, keeps: 2 } as const;
    changes.sort((x, y) => order[x.effect] - order[y.effect] || x.name.localeCompare(y.name));

    return {
      valid: true,
      unchanged: false,
      moving: subtree.map((s) => ({ id: s.descendant.id, name: `${s.descendant.firstName} ${s.descendant.lastName}`, depth: s.depth })),
      from: employee.reportingManagerId ? await this.nameOf(employee.reportingManagerId) : null,
      to: dto.managerId ? await this.nameOf(dto.managerId) : null,
      changes,
    };
  }

  /** Change a reporting line (closure table + employee row together; loops rejected). */
  async setReportingLine(companyId: string, dto: ReportingLineDto) {
    const employee = await this.findEmployee(companyId, dto.employeeId);
    if ((employee.reportingManagerId ?? null) === (dto.managerId ?? null)) return this.chart(companyId);
    await this.prisma.$transaction(async (tx) => {
      await this.hierarchy.setManager(tx, companyId, dto.employeeId, dto.managerId ?? null);
      await tx.employee.update({ where: { id: dto.employeeId }, data: { reportingManagerId: dto.managerId ?? null } });
    });
    return {
      employeeId: dto.employeeId,
      from: employee.reportingManagerId,
      to: dto.managerId ?? null,
      ...(await this.chart(companyId)),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async findEmployee(companyId: string, id: string) {
    const e = await this.prisma.employee.findFirst({
      where: { id, companyId },
      select: { id: true, firstName: true, lastName: true, reportingManagerId: true },
    });
    if (!e) throw new NotFoundException('Employee not found');
    return e;
  }

  private async nameOf(id: string) {
    const e = await this.prisma.employee.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
    return e ? `${e.firstName} ${e.lastName}` : 'Unknown';
  }

  private async findLevel(companyId: string, id: string) {
    const level = await this.prisma.orgLevel.findFirst({ where: { id, companyId } });
    if (!level) throw new NotFoundException('Org level not found');
    return level;
  }

  private async assertLevelNameFree(companyId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.orgLevel.findFirst({
      where: { companyId, name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId && { NOT: { id: exceptId } }) },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`A level named '${name.trim()}' already exists`);
  }
}
