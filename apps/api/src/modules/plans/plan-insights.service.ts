import { Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FEATURE_BY_KEY } from '../access/catalog';
import { PlansService } from './plans.service';

const DAY = 86_400_000;
const NEAR_LIMIT = 0.8;
const TRIAL_SOON_DAYS = 14;

type Counts = Map<string, number>; // companyId → uses
const label = (key: string) => FEATURE_BY_KEY.get(key)?.label ?? key;

/**
 * Super Admin → Plans: who is on each plan, how much they use each feature,
 * custom switches and trials, upgrade candidates, the "who's affected"
 * preview before a plan is saved, and the plan's change history.
 */
@Injectable()
export class PlanInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  /** Uses per company in the last 30 days, for the features we can measure. */
  private async usage(companyIds: string[]): Promise<Map<string, Counts>> {
    const out = new Map<string, Counts>();
    if (!companyIds.length) return out;
    const since = new Date(Date.now() - 30 * DAY);
    const companyId = { in: companyIds };
    const created = { companyId, createdAt: { gte: since } };
    const toMap = (rows: Array<{ companyId: string | null; _count: { _all: number } }>): Counts =>
      new Map(rows.filter((r) => r.companyId).map((r) => [r.companyId!, r._count._all]));
    const all = { _count: { _all: true } } as const;
    const [att, leave, ts, exp, help, kudos, ann, proj, docs, payroll, salary, assets] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({ by: ['companyId'], where: { companyId, date: { gte: since } }, ...all }),
      this.prisma.leaveRequest.groupBy({ by: ['companyId'], where: created, ...all }),
      this.prisma.timesheet.groupBy({ by: ['companyId'], where: created, ...all }),
      this.prisma.expenseClaim.groupBy({ by: ['companyId'], where: created, ...all }),
      this.prisma.ticket.groupBy({ by: ['companyId'], where: created, ...all }),
      this.prisma.kudos.groupBy({ by: ['companyId'], where: created, ...all }),
      this.prisma.announcement.groupBy({ by: ['companyId'], where: { companyId, updatedAt: { gte: since } }, ...all }),
      this.prisma.project.groupBy({ by: ['companyId'], where: { companyId, updatedAt: { gte: since } }, ...all }),
      this.prisma.employeeDocument.groupBy({ by: ['companyId'], where: created, ...all }),
      this.prisma.payrollRun.groupBy({ by: ['companyId'], where: created, ...all }),
      this.prisma.employeeSalary.groupBy({ by: ['companyId'], where: created, ...all }),
      this.prisma.assetAssignment.groupBy({ by: ['companyId'], where: { companyId, assignedAt: { gte: since } }, ...all }),
    ]);
    const pairs: Array<[string, Counts]> = [
      ['time.attendance', toMap(att)],
      ['time.leave', toMap(leave)],
      ['work.timesheets', toMap(ts)],
      ['ops.expenses', toMap(exp)],
      ['ops.helpdesk', toMap(help)],
      ['engage.kudos', toMap(kudos)],
      ['engage.announcements', toMap(ann)],
      ['work.projects', toMap(proj)],
      ['people.documents', toMap(docs)],
      ['pay.payroll', toMap(payroll)],
      ['pay.salary', toMap(salary)],
      ['ops.assets', toMap(assets)],
    ];
    for (const [k, m] of pairs) out.set(k, m);
    return out;
  }

  private async employeesBy(companyIds: string[]): Promise<Counts> {
    if (!companyIds.length) return new Map();
    const rows = await this.prisma.employee.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds }, employmentStatus: { not: EmploymentStatus.TERMINATED } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.companyId, r._count._all]));
  }

  /** Active custom switches (not lapsed). */
  private activeSwitches(companyIds?: string[]) {
    return this.prisma.companyFeature.findMany({
      where: { ...(companyIds && { companyId: { in: companyIds } }), OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { companyId: true, featureKey: true, mode: true, reason: true, expiresAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async overview() {
    const [plans, companies] = await Promise.all([
      this.plans.list(),
      this.prisma.company.findMany({
        select: { id: true, name: true, planId: true, limits: true, createdAt: true, branding: { select: { logoUrl: true, primaryColor: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const ids = companies.map((c) => c.id);
    const [employees, usage, switches] = await Promise.all([this.employeesBy(ids), this.usage(ids), this.activeSwitches()]);
    const byId = new Map(companies.map((c) => [c.id, c]));
    const brief = (c: (typeof companies)[number]) => ({ id: c.id, name: c.name, logoUrl: c.branding?.logoUrl ?? null, color: c.branding?.primaryColor ?? null });
    const limitOf = (c: (typeof companies)[number]) => {
      const own = (c.limits ?? {}) as Record<string, number | null>;
      if ('maxEmployees' in own) return own.maxEmployees;
      return plans.find((p) => p.id === c.planId)?.limits.maxEmployees ?? null;
    };

    const perPlan = plans.map((p) => {
      const on = companies.filter((c) => c.planId === p.id);
      const featureUse: Record<string, number | null> = {};
      for (const f of p.features) {
        const m = usage.get(f);
        featureUse[f] = m && on.length ? Math.round((on.filter((c) => (m.get(c.id) ?? 0) > 0).length / on.length) * 100) : null;
      }
      return {
        id: p.id,
        employees: on.reduce((s, c) => s + (employees.get(c.id) ?? 0), 0),
        nearLimit: on.filter((c) => {
          const lim = limitOf(c);
          return lim !== null && lim !== undefined && (employees.get(c.id) ?? 0) >= lim * NEAR_LIMIT;
        }).length,
        companies: on.slice(0, 6).map(brief),
        featureUse,
      };
    });

    const soon = Date.now() + TRIAL_SOON_DAYS * DAY;
    const switchRows = switches
      .filter((s) => byId.has(s.companyId))
      .map((s) => ({
        company: brief(byId.get(s.companyId)!),
        featureKey: s.featureKey,
        featureLabel: label(s.featureKey),
        mode: s.mode,
        reason: s.reason,
        expiresAt: s.expiresAt,
      }))
      .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));

    // Companies outgrowing their plan: near the employee limit, or using features from outside it
    const ordered = [...plans].filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    const candidates = companies.flatMap((c) => {
      const plan = plans.find((p) => p.id === c.planId);
      if (!plan) return [];
      const count = employees.get(c.id) ?? 0;
      const lim = limitOf(c);
      const extras = switches.filter((s) => s.companyId === c.id && s.mode === 'ON' && !plan.features.includes(s.featureKey)).map((s) => s.featureKey);
      const near = lim !== null && lim !== undefined && count >= lim * NEAR_LIMIT;
      if (!near && !extras.length) return [];
      const next = ordered.find(
        (p) => p.sortOrder > plan.sortOrder && extras.every((f) => p.features.includes(f)) && (p.limits.maxEmployees === null || p.limits.maxEmployees === undefined || p.limits.maxEmployees > count),
      );
      return [
        {
          company: brief(c),
          plan: { id: plan.id, name: plan.name },
          employees: count,
          limit: lim ?? null,
          extras: extras.map((k) => ({ key: k, label: label(k) })),
          suggested: next ? { id: next.id, name: next.name } : null,
        },
      ];
    });

    return {
      plans: perPlan,
      totals: {
        companies: companies.length,
        withSwitches: new Set(switchRows.map((s) => s.company.id)).size,
        trialsEndingSoon: switchRows.filter((s) => s.mode === 'ON' && s.expiresAt && s.expiresAt.getTime() <= soon).length,
      },
      switches: switchRows.slice(0, 30),
      candidates: candidates.sort((a, b) => (b.limit ? b.employees / b.limit : 0) - (a.limit ? a.employees / a.limit : 0)).slice(0, 10),
    };
  }

  /** Before saving: which companies lose what (with how much they used it), and who'd be over a lower limit. */
  async impact(planId: string, features: string[], limits?: Record<string, number | null>) {
    const plan = await this.plans.get(planId);
    const next = this.plans.normalizeFeatures(features);
    const removed = plan.features.filter((f) => !next.includes(f));
    const added = next.filter((f) => !plan.features.includes(f));
    const companies = await this.prisma.company.findMany({
      where: { planId },
      select: { id: true, name: true, limits: true, branding: { select: { logoUrl: true, primaryColor: true } } },
      orderBy: { name: 'asc' },
    });
    const ids = companies.map((c) => c.id);
    const [usage, switches, employees] = await Promise.all([
      removed.length ? this.usage(ids) : Promise.resolve(new Map<string, Counts>()),
      removed.length ? this.activeSwitches(ids) : Promise.resolve([]),
      this.employeesBy(ids),
    ]);
    const newLimit = limits && 'maxEmployees' in limits ? limits.maxEmployees : plan.limits.maxEmployees ?? null;

    const rows = companies
      .map((c) => {
        const keeps = removed.filter((f) => switches.some((s) => s.companyId === c.id && s.featureKey === f && s.mode === 'ON'));
        const loses = removed.filter((f) => !keeps.includes(f)).map((f) => ({ key: f, label: label(f), uses: usage.has(f) ? (usage.get(f)!.get(c.id) ?? 0) : null }));
        const own = (c.limits ?? {}) as Record<string, number | null>;
        const count = employees.get(c.id) ?? 0;
        const overLimit = !('maxEmployees' in own) && newLimit !== null && newLimit !== undefined && count > newLimit;
        return {
          company: { id: c.id, name: c.name, logoUrl: c.branding?.logoUrl ?? null, color: c.branding?.primaryColor ?? null },
          loses,
          keeps: keeps.map((k) => ({ key: k, label: label(k) })),
          employees: count,
          overLimit,
        };
      })
      .filter((r) => r.loses.length || r.keeps.length || r.overLimit);

    return {
      added: added.map((k) => ({ key: k, label: label(k) })),
      removed: removed.map((k) => ({ key: k, label: label(k) })),
      companiesOnPlan: companies.length,
      companies: rows,
    };
  }

  /** What changed on this plan, newest first (from the audit log). */
  async history(planId: string) {
    const exists = await this.prisma.plan.findUnique({ where: { id: planId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Plan not found');
    const rows = await this.prisma.auditLog.findMany({
      where: { resourceType: 'plan', resourceId: planId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, action: true, createdAt: true, afterState: true, user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return rows.map((r) => {
      const state = (r.afterState ?? {}) as { changes?: { added?: string[]; removed?: string[]; limits?: Record<string, [number | null, number | null]>; archived?: boolean | null; affectedCompanies?: number } };
      const ch = state.changes;
      return {
        id: r.id,
        action: r.action,
        createdAt: r.createdAt,
        by: r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() || r.user.email : 'System',
        added: (ch?.added ?? []).map(label),
        removed: (ch?.removed ?? []).map(label),
        limits: ch?.limits ?? {},
        archived: ch?.archived ?? null,
        affectedCompanies: ch?.affectedCompanies ?? null,
      };
    });
  }
}
