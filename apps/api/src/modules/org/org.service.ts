import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import type { AccessScope } from '@hrms/types';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { HierarchyService } from '../access/hierarchy.service';
import type { ReportingLineDto, SaveOrgLevelDto, PeopleQueryDto } from './dto';
import { holds, type AccessContext } from '../access/access.types';
import { EmployeeLifecycleService, WIDE_SPAN } from '../employees/lifecycle.service';
import { wordsWhere } from '../../common/word-search';

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
/** People named per org-health problem (the rest are counted) */
const HEALTH_PEOPLE = 12;

@Injectable()
export class OrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly hierarchy: HierarchyService,
    private readonly lifecycle: EmployeeLifecycleService,
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

  /**
   * Flat list of current employees with their manager; the web builds the tree.
   * People who haven't joined yet only show for org managers (flagged joinsOn);
   * a notice period shows as Active unless the viewer handles exits.
   */
  /** What people pickers need — much lighter than the chart (no levels, emails or statuses). */
  async people(companyId: string, access: AccessContext, q: PeopleQueryDto = {}) {
    const today = (await this.lifecycle.today(companyId)).date;
    const planners = holds(access, 'org.manage');
    const current = { subordinates: { some: { employmentStatus: { not: EmploymentStatus.TERMINATED } } } };
    const search = wordsWhere(q.search, (w): Prisma.EmployeeWhereInput[] => [
      { firstName: { contains: w, mode: 'insensitive' } },
      { lastName: { contains: w, mode: 'insensitive' } },
      { employeeId: { contains: w, mode: 'insensitive' } },
      { designation: { name: { contains: w, mode: 'insensitive' } } },
    ]);
    const byId = Boolean(q.ids?.length || q.userIds?.length);
    const rows = await this.prisma.employee.findMany({
      where: {
        companyId,
        employmentStatus: { not: EmploymentStatus.TERMINATED },
        ...(planners ? {} : { joiningDate: { lte: today } }),
        ...(q.ids?.length && { id: { in: q.ids } }),
        ...(q.userIds?.length && { userId: { in: q.userIds } }),
        ...(q.exclude && !byId && { NOT: { id: q.exclude } }),
        ...(q.departmentId && !byId && { departmentId: q.departmentId }),
        ...(q.managers && !byId && current),
        ...(!byId && search),
      },
      orderBy: q.managers && !byId ? [{ subordinates: { _count: 'desc' } }, { firstName: 'asc' }] : [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: byId ? 50 : q.limit ?? 20,
      select: {
        id: true,
        userId: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        reportingManagerId: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        _count: { select: { subordinates: { where: { employmentStatus: { not: EmploymentStatus.TERMINATED } } } } },
      },
    });
    return rows.map(({ _count, ...e }) => ({ ...e, directReports: _count.subordinates }));
  }

  async chart(companyId: string, access: AccessContext) {
    const today = (await this.lifecycle.today(companyId)).date;
    const planners = holds(access, 'org.manage');
    const [employees, levels] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED }, ...(planners ? {} : { joiningDate: { lte: today } }) },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          userId: true,
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
          joiningDate: true,
          _count: { select: { subordinates: { where: { employmentStatus: { not: EmploymentStatus.TERMINATED } } } } },
        },
      }),
      this.listLevels(companyId),
    ]);
    return {
      employees: employees.map(({ _count, joiningDate, ...e }) => ({
        ...this.lifecycle.mask(e, access),
        directReports: _count.subordinates,
        joinsOn: joiningDate > today ? joiningDate.toISOString().slice(0, 10) : null,
      })),
      levels,
    };
  }

  /** Things worth fixing in the structure: wide spans, missing managers, departments without a head. */
  async health(companyId: string) {
    const today = (await this.lifecycle.today(companyId)).date;
    const current = { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED }, joiningDate: { lte: today } };
    const PERSON = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
    const [people, departments, depth] = await Promise.all([
      this.prisma.employee.findMany({
        where: current,
        select: { ...PERSON, departmentId: true, reportingManagerId: true, reportingManager: { select: { employmentStatus: true, firstName: true, lastName: true } } },
      }),
      this.prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, headEmployeeId: true }, orderBy: { name: 'asc' } }),
      this.prisma.employeeHierarchy.aggregate({ where: { ancestor: { companyId } }, _max: { depth: true } }),
    ]);
    const person = (p: { id: string; firstName: string; lastName: string; avatarUrl: string | null }) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, name: `${p.firstName} ${p.lastName}`, avatarUrl: p.avatarUrl });
    const reports = new Map<string, number>();
    for (const p of people) if (p.reportingManagerId) reports.set(p.reportingManagerId, (reports.get(p.reportingManagerId) ?? 0) + 1);
    const byId = new Map(people.map((p) => [p.id, p]));
    const items: Array<{ key: string; tone: 'warning' | 'info' | 'neutral' | 'danger'; title: string; detail: string; people?: ReturnType<typeof person>[]; departments?: Array<{ id: string; name: string }>; fix: 'reporting' | 'departments' | 'employees' }> = [];

    const wide = [...reports.entries()].filter(([, n]) => n > WIDE_SPAN).sort((a, b) => b[1] - a[1]);
    for (const [id, n] of wide) {
      const m = byId.get(id);
      if (m) items.push({ key: `wide:${id}`, tone: 'warning', title: `${m.firstName} has ${n} direct reports`, detail: `More than ${WIDE_SPAN} can be hard to manage well — consider a team lead in between`, people: [person(m)], fix: 'reporting' });
    }
    const leftManager = people.filter((p) => p.reportingManager && p.reportingManager.employmentStatus === EmploymentStatus.TERMINATED);
    if (leftManager.length) {
      items.push({ key: 'manager-left', tone: 'danger', title: `${leftManager.length} ${leftManager.length === 1 ? 'person reports' : 'people report'} to someone who has left`, detail: leftManager.slice(0, 3).map((p) => p.firstName).join(', ') + ' — pick a new manager so approvals keep working', people: leftManager.map(person), fix: 'reporting' });
    }
    const alone = people.filter((p) => !p.reportingManagerId && !reports.has(p.id));
    if (alone.length && people.length > 1) {
      items.push({ key: 'no-manager', tone: 'info', title: `${alone.length} ${alone.length === 1 ? 'person has' : 'people have'} no manager`, detail: alone.slice(0, 3).map((p) => p.firstName).join(', ') + ' — their leave and timesheets have nowhere to go', people: alone.map(person), fix: 'reporting' });
    }
    const roots = people.filter((p) => !p.reportingManagerId && reports.has(p.id));
    if (roots.length > 1) {
      items.push({ key: 'many-tops', tone: 'neutral', title: `${roots.length} people are at the top of the chart`, detail: `${roots.map((p) => p.firstName).join(', ')} — usually one person (the CEO or founder) is at the top`, people: roots.map(person), fix: 'reporting' });
    }
    const counts = new Map<string, number>();
    for (const p of people) if (p.departmentId) counts.set(p.departmentId, (counts.get(p.departmentId) ?? 0) + 1);
    const headless = departments.filter((d) => counts.get(d.id) && (!d.headEmployeeId || !byId.has(d.headEmployeeId)));
    if (headless.length) {
      items.push({ key: 'no-head', tone: 'neutral', title: `${headless.length} ${headless.length === 1 ? 'department has' : 'departments have'} no head`, detail: headless.slice(0, 3).map((d) => d.name).join(', ') + ' — set one in Departments', departments: headless.map((d) => ({ id: d.id, name: d.name })), fix: 'departments' });
    }
    const noDept = people.filter((p) => !p.departmentId);
    if (noDept.length && departments.length) {
      items.push({ key: 'no-department', tone: 'neutral', title: `${noDept.length} ${noDept.length === 1 ? 'person isn’t' : 'people aren’t'} in a department`, detail: noDept.slice(0, 3).map((p) => p.firstName).join(', '), people: noDept.map(person), fix: 'employees' });
    }
    const managers = reports.size;
    const spans = [...reports.values()];
    return {
      // Each problem names at most 12 people; `count` says how many there are in all
      items: items.map((i) => ({ ...i, count: i.people?.length ?? i.departments?.length ?? 0, people: i.people?.slice(0, HEALTH_PEOPLE), departments: i.departments?.slice(0, HEALTH_PEOPLE) })),
      stats: {
        headcount: people.length,
        managers,
        avgSpan: managers ? Math.round((people.filter((p) => p.reportingManagerId && byId.has(p.reportingManagerId)).length / managers) * 10) / 10 : 0,
        widestSpan: Math.max(0, ...reports.values()),
        levels: (depth._max.depth ?? 0) + 1,
        departments: departments.length,
        /** Managers by number of direct reports */
        spans: { '1–2': spans.filter((n) => n <= 2).length, '3–5': spans.filter((n) => n >= 3 && n <= 5).length, '6–8': spans.filter((n) => n >= 6 && n <= 8).length, '9+': spans.filter((n) => n >= 9).length },
      },
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
  async setReportingLine(companyId: string, dto: ReportingLineDto, access: AccessContext) {
    const employee = await this.findEmployee(companyId, dto.employeeId);
    if ((employee.reportingManagerId ?? null) === (dto.managerId ?? null)) return this.chart(companyId, access);
    const [from, to] = await Promise.all([
      employee.reportingManagerId ? this.nameOf(employee.reportingManagerId) : Promise.resolve('None'),
      dto.managerId ? this.nameOf(dto.managerId) : Promise.resolve('None'),
    ]);
    await this.prisma.$transaction(async (tx) => {
      await this.hierarchy.setManager(tx, companyId, dto.employeeId, dto.managerId ?? null);
      await tx.employee.update({ where: { id: dto.employeeId }, data: { reportingManagerId: dto.managerId ?? null } });
      await this.lifecycle.record(tx, { companyId, employeeId: dto.employeeId, actor: access.userId, kind: 'manager', from, to });
    });
    return {
      employeeId: dto.employeeId,
      from: employee.reportingManagerId,
      to: dto.managerId ?? null,
      ...(await this.chart(companyId, access)),
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
