import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { AdminService } from './admin.service';
import { attentionFor, healthOf, setupOf, stageOf, type CompanyStatusName, type HealthLabel } from './company-health';
import type { BulkCompaniesDto, CompanyInsightsQueryDto } from './dto/company-insights.dto';

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const startOfUtcDay = (d = new Date()) => new Date(dayKey(d));

/**
 * Super Admin view of every company: usage, setup, health, attention,
 * tags and notes. Platform-level only — no employee personal data.
 */
@Injectable()
export class CompanyInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
    private readonly plans: PlansService,
  ) {}

  /** Usage numbers for a set of companies, in a handful of grouped queries. */
  private async metrics(ids: string[]) {
    if (!ids.length) return new Map<string, ReturnType<typeof build>>();
    const today = startOfUtcDay();
    const weekAgo = new Date(today.getTime() - 6 * DAY);
    const [companies, holidays, leaveTypes, policies, pairs, perDay, everActive, last, tags] = await Promise.all([
      this.prisma.company.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, status: true, updatedAt: true, createdAt: true,
          plan: { select: { key: true, name: true, limits: true } },
          branding: { select: { logoUrl: true } },
          _count: { select: { users: true, employees: true, departments: true } },
        },
      }),
      this.prisma.publicHoliday.groupBy({ by: ['companyId'], where: { companyId: { in: ids } }, _count: { _all: true } }),
      this.prisma.leaveType.groupBy({ by: ['companyId'], where: { companyId: { in: ids } }, _count: { _all: true } }),
      this.prisma.attendancePolicy.findMany({ where: { companyId: { in: ids } }, select: { companyId: true } }),
      // distinct people active in the last 7 days
      this.prisma.userActivityDay.groupBy({ by: ['companyId', 'userId'], where: { companyId: { in: ids }, day: { gte: weekAgo } } }),
      this.prisma.userActivityDay.groupBy({ by: ['companyId', 'day'], where: { companyId: { in: ids }, day: { gte: weekAgo } }, _count: { _all: true } }),
      this.prisma.userActivityDay.groupBy({ by: ['companyId'], where: { companyId: { in: ids } }, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['companyId'], where: { companyId: { in: ids } }, _max: { lastLoginAt: true } }),
      this.prisma.companyTag.findMany({ where: { companyId: { in: ids } }, select: { companyId: true, label: true }, orderBy: { label: 'asc' } }),
    ]);
    const count = <T extends { companyId: string | null; _count: { _all: number } }>(rows: T[]) => new Map(rows.map((r) => [r.companyId, r._count._all]));
    const hol = count(holidays);
    const lt = count(leaveTypes);
    const ever = count(everActive);
    const pol = new Set(policies.map((p) => p.companyId));
    const active = new Map<string, number>();
    for (const p of pairs) if (p.companyId) active.set(p.companyId, (active.get(p.companyId) ?? 0) + 1);
    const lastMap = new Map(last.map((l) => [l.companyId, l._max.lastLoginAt]));
    const tagMap = new Map<string, string[]>();
    for (const t of tags) tagMap.set(t.companyId, [...(tagMap.get(t.companyId) ?? []), t.label]);

    function build(c: (typeof companies)[number]) {
      const trend = Array.from({ length: 7 }, (_, i) => {
        const d = dayKey(new Date(weekAgo.getTime() + i * DAY));
        return perDay.find((r) => r.companyId === c.id && dayKey(r.day) === d)?._count._all ?? 0;
      });
      const setup = setupOf({
        departments: c._count.departments,
        employees: c._count.employees,
        hasAttendancePolicy: pol.has(c.id),
        leaveTypes: lt.get(c.id) ?? 0,
        holidays: hol.get(c.id) ?? 0,
        hasLogo: Boolean(c.branding?.logoUrl),
      });
      const activeUsers7d = active.get(c.id) ?? 0;
      const status = c.status as CompanyStatusName;
      const limits = (c.plan?.limits ?? {}) as { maxEmployees?: number | null };
      const lastActivity = lastMap.get(c.id) ?? null;
      return {
        employees: c._count.employees,
        users: c._count.users,
        maxEmployees: limits.maxEmployees ?? null,
        activeUsers7d,
        trend,
        lastActivity,
        holidays: hol.get(c.id) ?? 0,
        setup,
        health: healthOf({ status, users: c._count.users, activeUsers7d, setupPercent: setup.percent }),
        stage: stageOf({ status, everActive: (ever.get(c.id) ?? 0) > 0, setupPercent: setup.percent }),
        statusSince: c.updatedAt,
        tags: tagMap.get(c.id) ?? [],
      };
    }
    return new Map(companies.map((c) => [c.id, build(c)]));
  }

  /** The Companies list with usage, health and tags; filter / sort by any of them. */
  async list(query: CompanyInsightsQueryDto) {
    const where: Prisma.CompanyWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.plan && { plan: { key: query.plan } }),
      ...(query.tag && { tags: { some: { label: query.tag } } }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const include = {
      branding: { select: { logoUrl: true, primaryColor: true, displayName: true } },
      settings: { select: { employeeIdPrefix: true } },
      plan: { select: { key: true, name: true, limits: true } },
      _count: { select: { users: true, employees: true } },
    } satisfies Prisma.CompanyInclude;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const dir = query.sortOrder === 'asc' ? 1 : -1;
    const key = query.sortBy ?? 'createdAt';
    // Sorting by a plain column with no health filter: page in the database and work out health for that page only
    if (!query.health && (key === 'createdAt' || key === 'name' || key === 'status')) {
      const order: Prisma.SortOrder = dir === 1 ? 'asc' : 'desc';
      const [total, pageRows] = await Promise.all([
        this.prisma.company.count({ where }),
        this.prisma.company.findMany({ where, include, orderBy: [{ [key]: order }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      ]);
      const pm = await this.metrics(pageRows.map((r) => r.id));
      return { data: pageRows.map((r) => ({ ...r, insights: pm.get(r.id)! })), meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
    }
    // Sorting / filtering by health, people or last activity needs every company's numbers (tenants are few)
    const rows = await this.prisma.company.findMany({ where, include });
    const m = await this.metrics(rows.map((r) => r.id));
    let items = rows.map((r) => ({ ...r, insights: m.get(r.id)! }));
    if (query.health) items = items.filter((i) => i.insights.health.label === (query.health as HealthLabel));

    const value = (i: (typeof items)[number]): number | string => {
      switch (key) {
        case 'name': return i.name.toLowerCase();
        case 'status': return i.status;
        case 'health': return i.insights.health.score;
        case 'employees': return i.insights.employees;
        case 'lastActivity': return i.insights.lastActivity?.getTime() ?? 0;
        default: return i.createdAt.getTime();
      }
    };
    items.sort((a, b) => (value(a) > value(b) ? dir : value(a) < value(b) ? -dir : 0));

    return { data: items.slice((page - 1) * limit, page * limit), meta: { total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) } };
  }

  /** Headline numbers, onboarding pipeline and what needs attention. */
  async summary() {
    const companies = await this.prisma.company.findMany({ select: { id: true, name: true, status: true, createdAt: true } });
    const m = await this.metrics(companies.map((c) => c.id));
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const weekAgo = new Date(startOfUtcDay().getTime() - 6 * DAY);
    const [usersTotal, activeUsers] = await Promise.all([
      this.prisma.user.count({ where: { companyId: { not: null } } }),
      this.prisma.userActivityDay.groupBy({ by: ['userId'], where: { companyId: { not: null }, day: { gte: weekAgo } } }),
    ]);
    // Companies on the platform at the end of each of the last 6 months
    const growth = Array.from({ length: 6 }, (_, i) => {
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4 + i, 1));
      return companies.filter((c) => c.createdAt < end).length;
    });
    type StageItem = { id: string; name: string; setupPercent: number; status: string };
    const stages = { invited: [] as StageItem[], setting_up: [] as StageItem[], live: [] as StageItem[], paused: [] as StageItem[] };
    for (const c of companies) {
      const i = m.get(c.id)!;
      stages[i.stage].push({ id: c.id, name: c.name, setupPercent: i.setup.percent, status: c.status });
    }
    const attention = attentionFor(
      companies.map((c) => {
        const i = m.get(c.id)!;
        return { id: c.id, name: c.name, status: c.status as CompanyStatusName, statusSince: i.statusSince, users: i.users, employees: i.employees, maxEmployees: i.maxEmployees, setupPercent: i.setup.percent, holidays: i.holidays, lastActivity: i.lastActivity };
      }),
      now,
    );
    const byStatus = (s: CompanyStatus) => companies.filter((c) => c.status === s).length;
    return {
      companies: { total: companies.length, active: byStatus('ACTIVE'), inactive: byStatus('INACTIVE'), suspended: byStatus('SUSPENDED'), newThisMonth: companies.filter((c) => c.createdAt >= monthStart).length, growth },
      employees: [...m.values()].reduce((n, i) => n + i.employees, 0),
      users: { total: usersTotal, activeThisWeek: activeUsers.length },
      stages,
      attention: attention.slice(0, 8),
      attentionTotal: attention.length,
    };
  }

  /** The side panel: daily active users, module use, setup, recent activity, tags and notes. */
  async insights(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, _count: { select: { employees: true, users: true } } } });
    if (!company) throw new NotFoundException('Company not found');
    const m = (await this.metrics([companyId])).get(companyId)!;
    const today = startOfUtcDay();
    const since = new Date(today.getTime() - 29 * DAY);
    const where = { companyId, createdAt: { gte: since } };
    const [dau, attendance, leave, timesheets, expenses, tickets, kudos, storage, audit, notes] = await Promise.all([
      this.prisma.userActivityDay.groupBy({ by: ['day'], where: { companyId, day: { gte: since } }, _count: { _all: true } }),
      this.prisma.attendanceRecord.groupBy({ by: ['employeeId'], where: { companyId, date: { gte: since } } }).then((r) => r.length),
      this.prisma.leaveRequest.groupBy({ by: ['employeeId'], where }).then((r) => r.length),
      this.prisma.timesheet.groupBy({ by: ['employeeId'], where }).then((r) => r.length),
      this.prisma.expenseClaim.groupBy({ by: ['employeeId'], where }).then((r) => r.length),
      this.prisma.ticket.groupBy({ by: ['employeeId'], where }).then((r) => r.length),
      this.prisma.kudos.groupBy({ by: ['fromUserId'], where }).then((r) => r.length),
      this.prisma.employeeDocument.aggregate({ where: { companyId }, _sum: { sizeBytes: true } }),
      this.prisma.auditLog.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, action: true, createdAt: true, user: { select: { email: true, isSuperAdmin: true } } } }),
      this.prisma.companyNote.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, body: true, createdAt: true, author: { select: { id: true, firstName: true, lastName: true } } } }),
    ]);
    const employees = Math.max(1, company._count.employees);
    const pct = (n: number, of = employees) => Math.min(100, Math.round((n / of) * 100));
    return {
      ...m,
      dailyActive: Array.from({ length: 30 }, (_, i) => {
        const d = dayKey(new Date(since.getTime() + i * DAY));
        return { day: d, users: dau.find((r) => dayKey(r.day) === d)?._count._all ?? 0 };
      }),
      modules: [
        { key: 'attendance', label: 'Attendance', percent: pct(attendance) },
        { key: 'leave', label: 'Leave', percent: pct(leave) },
        { key: 'timesheets', label: 'Timesheets', percent: pct(timesheets) },
        { key: 'expenses', label: 'Expenses', percent: pct(expenses) },
        { key: 'helpdesk', label: 'Helpdesk', percent: pct(tickets) },
        { key: 'kudos', label: 'Shout-outs', percent: pct(kudos, Math.max(1, company._count.users)) },
      ],
      storageBytes: storage._sum.sizeBytes ?? 0,
      recentActivity: audit,
      notes,
    };
  }

  // ─── Tags and notes (Super Admin only; never shown to the company) ───

  async allTags() {
    const rows = await this.prisma.companyTag.groupBy({ by: ['label'], _count: { _all: true }, orderBy: { label: 'asc' } });
    return rows.map((r) => ({ label: r.label, count: r._count._all }));
  }

  async setTags(companyId: string, tags: string[]) {
    await this.assertCompany(companyId);
    const labels = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    await this.prisma.$transaction([
      this.prisma.companyTag.deleteMany({ where: { companyId, label: { notIn: labels } } }),
      this.prisma.companyTag.createMany({ data: labels.map((label) => ({ companyId, label })), skipDuplicates: true }),
    ]);
    return { tags: labels.sort() };
  }

  async addNote(companyId: string, authorId: string, body: string) {
    await this.assertCompany(companyId);
    return this.prisma.companyNote.create({ data: { companyId, authorId, body: body.trim() }, select: { id: true, body: true, createdAt: true, author: { select: { id: true, firstName: true, lastName: true } } } });
  }

  async removeNote(companyId: string, noteId: string) {
    const n = await this.prisma.companyNote.deleteMany({ where: { id: noteId, companyId } });
    if (!n.count) throw new NotFoundException('Note not found');
    return { removed: true };
  }

  // ─── Bulk actions ─────────────────────────────────────────

  async bulk(dto: BulkCompaniesDto) {
    const ids = [...new Set(dto.ids)];
    const found = await this.prisma.company.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Some companies were not found');
    if (dto.action === 'status') {
      if (!dto.status) throw new BadRequestException('Choose a status');
      for (const id of ids) await this.admin.updateCompanyStatus(id, { status: dto.status, reason: dto.reason });
    } else if (dto.action === 'plan') {
      if (!dto.planId) throw new BadRequestException('Choose a plan');
      for (const id of ids) await this.plans.setCompanyPlan(id, dto.planId);
    } else {
      const label = dto.tag?.trim();
      if (!label) throw new BadRequestException('Enter a tag');
      if (dto.action === 'addTag') await this.prisma.companyTag.createMany({ data: ids.map((companyId) => ({ companyId, label })), skipDuplicates: true });
      else await this.prisma.companyTag.deleteMany({ where: { companyId: { in: ids }, label } });
    }
    return { updated: ids.length };
  }

  private async assertCompany(id: string) {
    if (!(await this.prisma.company.count({ where: { id } }))) throw new NotFoundException('Company not found');
  }
}
