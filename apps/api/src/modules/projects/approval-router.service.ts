import { Injectable } from '@nestjs/common';
import { EmploymentStatus, ProjectRole, ProjectStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../access/entitlement.service';
import { dateFromKey } from '../attendance/time-zone';
import { pmoLeadUserIds, reportsToPmo } from './pmo-pool';

/** Everyone who may decide one approval level, and why. */
export interface ApprovalLevel {
  approverIds: string[];
  /** e.g. "Team lead · Apollo, Project manager · Apollo, Line manager" */
  label: string;
}

export interface Route {
  mode: 'project' | 'reporting_line';
  levels: ApprovalLevel[];
}

interface Candidate {
  userId: string;
  label: string;
}

/**
 * Who approves a person's leave / attendance correction.
 *
 * Projects feature on and the person is on a live project during the dates:
 *   member     → their team lead, then the project manager
 *   team lead  → the project manager
 *   PM         → (no project step) → reporting line
 *   On several projects: anyone from any of them can act (pools are merged).
 *   1 level:  team lead OR PM (whoever acts first). 2 levels: lead, then PM.
 *   The line manager can also act at every level.
 * Otherwise: the reporting line (manager, their manager, …).
 * Missing levels are filled from the reporting line; nobody approves themselves.
 */
@Injectable()
export class ApprovalRouterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async route(companyId: string, employeeId: string, fromKey: string, toKey: string, levels: number): Promise<Route> {
    if (levels <= 0) return { mode: 'reporting_line', levels: [] };
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { userId: true } });
    if (!employee) return { mode: 'reporting_line', levels: [] };
    const self = employee.userId;

    // Reporting line above the person (live people only)
    const above = await this.prisma.employeeHierarchy.findMany({
      where: { companyId, descendantId: employeeId, depth: { gte: 1 } },
      orderBy: { depth: 'asc' },
      select: { depth: true, ancestor: { select: { userId: true, employmentStatus: true, user: { select: { status: true } } } } },
    });
    const line = above
      .filter((a) => a.ancestor.employmentStatus !== EmploymentStatus.TERMINATED && a.ancestor.user.status === UserStatus.ACTIVE)
      .map((a) => ({ userId: a.ancestor.userId, label: a.depth === 1 ? 'Line manager' : 'Manager’s manager' }));

    const steps = (await this.projectsEnabled(companyId)) ? await this.projectSteps(companyId, employeeId, fromKey, toKey) : [];

    if (!steps.length) {
      // Reporting line: one manager per level
      const chain = line.slice(0, levels).filter((c) => c.userId !== self);
      if (chain.length) return { mode: 'reporting_line', levels: chain.map((c) => ({ approverIds: [c.userId], label: c.label })) };
      // Reports to the PMO instead of a person → the PMO lead(s); nobody → HR
      const pmo = (await reportsToPmo(this.prisma, employeeId)) ? (await pmoLeadUserIds(this.prisma, companyId)).filter((u) => u !== self) : [];
      return { mode: 'reporting_line', levels: [pmo.length ? { approverIds: pmo, label: 'PMO lead' } : { approverIds: [], label: 'HR' }] };
    }

    // Project route: level k = everyone's step k (the last level also takes any later steps)
    const depth = Math.max(...steps.map((s) => s.length));
    const result: Candidate[][] = [];
    for (let k = 0; k < levels; k++) {
      const pool = k < levels - 1 ? steps.flatMap((s) => s[k] ?? []) : steps.flatMap((s) => s.slice(k).flat());
      result.push(pool);
    }
    // Levels the project can't fill come from further up the reporting line
    // (the line manager is already in every pool, so start one level above)
    const used = new Set(result.flat().map((c) => c.userId));
    const spare = line.slice(1).filter((c) => !used.has(c.userId));
    for (let k = 0; k < levels; k++) {
      if (!result[k]!.length && k >= Math.min(depth, levels)) {
        const next = spare.shift();
        if (next) result[k] = [next];
      }
    }
    // The line manager can also act at every level
    const lineManager = line[0];
    const levelsOut = result
      .map((pool) => (lineManager ? [...pool, lineManager] : pool))
      .map((pool) => this.level(pool.filter((c) => c.userId !== self)))
      .filter((l) => l.approverIds.length);
    return { mode: 'project', levels: levelsOut.length ? levelsOut : [{ approverIds: [], label: 'HR' }] };
  }

  /** Per project the person is on: ordered approval steps (team lead, then PMs). */
  private async projectSteps(companyId: string, employeeId: string, fromKey: string, toKey: string): Promise<Candidate[][][]> {
    const during = {
      startDate: { lte: dateFromKey(toKey) },
      OR: [{ endDate: null }, { endDate: { gte: dateFromKey(fromKey) } }],
    };
    const live = { status: { in: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD] } };
    const mine = await this.prisma.projectMember.findMany({
      where: { companyId, employeeId, ...during, project: live },
      select: {
        role: true,
        project: { select: { id: true, name: true } },
        lead: { select: { userId: true, employmentStatus: true, user: { select: { status: true } } } },
      },
    });
    const out: Candidate[][][] = [];
    for (const m of mine) {
      if (m.role === ProjectRole.MANAGER) continue; // PMs go to their reporting manager
      const managers = await this.prisma.projectMember.findMany({
        where: { projectId: m.project.id, role: ProjectRole.MANAGER, employeeId: { not: employeeId }, ...during, employee: { employmentStatus: { not: EmploymentStatus.TERMINATED }, user: { status: UserStatus.ACTIVE } } },
        select: { employee: { select: { userId: true } } },
      });
      const pms = managers.map((x) => ({ userId: x.employee.userId, label: `Project manager · ${m.project.name}` }));
      const leadOk = m.role === ProjectRole.MEMBER && m.lead && m.lead.employmentStatus !== EmploymentStatus.TERMINATED && m.lead.user.status === UserStatus.ACTIVE;
      const steps: Candidate[][] = [];
      if (leadOk) steps.push([{ userId: m.lead!.userId, label: `Team lead · ${m.project.name}` }]);
      if (pms.length) steps.push(pms);
      if (steps.length) out.push(steps);
    }
    return out;
  }

  private level(pool: Candidate[]): ApprovalLevel {
    const ids = [...new Set(pool.map((c) => c.userId))];
    const labels = [...new Set(pool.map((c) => c.label))];
    return { approverIds: ids, label: labels.join(', ') };
  }

  private async projectsEnabled(companyId: string): Promise<boolean> {
    const c = await this.prisma.company.findUnique({ where: { id: companyId }, select: { featuresVersion: true } });
    if (!c) return false;
    return (await this.entitlements.forCompany(companyId, c.featuresVersion)).features.has('work.projects');
  }

  /** Names for a route (apply-form preview, request cards). */
  async names(userIds: string[]): Promise<Map<string, { id: string; firstName: string; lastName: string }>> {
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, u]));
  }
}
