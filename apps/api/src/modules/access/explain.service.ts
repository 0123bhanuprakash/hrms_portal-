import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, UserStatus } from '@prisma/client';
import type { AccessScope } from '@hrms/types';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from './access.service';
import { ACCESS_USER_SELECT, type AccessContext, type AccessUserRow } from './access.types';
import { CATALOG, isApproval, PERMISSION_BY_KEY, SCOPE_ORDER } from './catalog';

type Source = { kind: 'role' | 'owner' | 'delegation'; id: string; name: string; scope: AccessScope | null };

/**
 * Access Explorer — explains access instead of just enforcing it.
 *   • explainUser:   "What can Priya do?" — every effective permission, its
 *                    scope, which role(s) grant it, and how many people it reaches
 *   • whoCanAccess:  "Who can see Amit's salary?" — everyone whose grants
 *                    reach that person for a permission, and why
 * Built from the same AccessService the guards use, so it can't drift.
 */
@Injectable()
export class ExplainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // ─── What can someone do? ─────────────────────────────────

  async explainUser(companyId: string, userId: string) {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { ...ACCESS_USER_SELECT, firstName: true, lastName: true, email: true, status: true },
    });
    if (!row) throw new NotFoundException('User not found');
    const ctx = await this.access.resolve(row);
    const sources = await this.sourcesFor(row, ctx);

    // People reached per distinct scope (one count per scope value)
    const reachByScope = new Map<string, number>();
    const reach = async (key: string): Promise<number | null> => {
      if (!PERMISSION_BY_KEY.get(key)?.scopes.length) return null;
      const scope = ctx.grants.get(key) ?? 'company';
      if (reachByScope.has(scope)) return reachByScope.get(scope)!;
      const filter = this.access.employeeScope(ctx, key);
      const n = filter ? await this.prisma.employee.count({ where: { AND: [{ companyId }, filter] } }) : 0;
      reachByScope.set(scope, n);
      return n;
    };

    const modules = [];
    for (const m of CATALOG) {
      const features = [];
      for (const f of m.features) {
        const permissions = [];
        for (const p of f.permissions) {
          if (!ctx.grants.has(p.key)) continue;
          permissions.push({
            key: p.key,
            label: p.label,
            sensitive: Boolean(p.sensitive),
            scope: ctx.grants.get(p.key) ?? null,
            reach: await reach(p.key),
            sources: sources.get(p.key) ?? [],
          });
        }
        if (permissions.length) features.push({ key: f.key, label: f.label, permissions });
      }
      if (features.length) modules.push({ key: m.key, label: m.label, features });
    }

    // Grants held by roles but dormant because the feature is off for the company
    const dormant: Array<{ key: string; label: string; feature: string }> = [];
    for (const [key] of sources) {
      if (!ctx.grants.has(key) && PERMISSION_BY_KEY.has(key)) {
        dormant.push({ key, label: PERMISSION_BY_KEY.get(key)!.label, feature: PERMISSION_BY_KEY.get(key)!.feature });
      }
    }

    const team = row.employee
      ? await Promise.all([
          this.prisma.employee.count({ where: { reportingManagerId: row.employee.id } }),
          this.prisma.employeeHierarchy.count({ where: { ancestorId: row.employee.id, depth: { gt: 0 } } }),
        ])
      : null;

    // Reach rings: how many people sit at each distance from them
    const working = { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } };
    const [department, company] = await Promise.all([
      ctx.employee?.departmentId ? this.prisma.employee.count({ where: { ...working, departmentId: ctx.employee.departmentId } }) : Promise.resolve(0),
      this.prisma.employee.count({ where: working }),
    ]);
    const widest = ctx.isOwner
      ? 'company'
      : [...ctx.grants.values()].reduce<AccessScope | null>((w, s) => (s && (!w || SCOPE_ORDER.indexOf(s) > SCOPE_ORDER.indexOf(w)) ? s : w), null);

    return {
      user: { id: row.id, name: `${row.firstName} ${row.lastName}`, email: row.email, status: row.status },
      reach: { self: row.employee ? 1 : 0, direct: team?.[0] ?? 0, team: team?.[1] ?? 0, department, company, widest },
      isOwner: ctx.isOwner,
      roles: ctx.roles,
      employee: row.employee ? { id: row.employee.id, directReports: team![0], allReports: team![1] } : null,
      permissionCount: ctx.grants.size,
      sensitiveCount: [...ctx.grants.keys()].filter((k) => PERMISSION_BY_KEY.get(k)?.sensitive).length,
      modules,
      dormant,
      delegations: ctx.delegations.map((d) => ({
        id: d.id,
        fromName: d.fromName,
        until: d.until,
        permissions: [...d.grants.entries()].map(([key, scope]) => ({ key, label: PERMISSION_BY_KEY.get(key)?.label ?? key, scope })),
      })),
    };
  }

  // ─── Who can access someone? ──────────────────────────────

  async whoCanAccess(companyId: string, employeeId: string, permission: string) {
    const perm = PERMISSION_BY_KEY.get(permission);
    if (!perm) throw new BadRequestException(`Unknown permission '${permission}'`);
    const target = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, userId: true, firstName: true, lastName: true, departmentId: true, locationId: true, reportingManagerId: true },
    });
    if (!target) throw new NotFoundException('Employee not found');

    const [managers, deptAncestors] = await Promise.all([
      this.prisma.employeeHierarchy.findMany({ where: { descendantId: target.id, depth: { gt: 0 } }, select: { ancestorId: true } }),
      target.departmentId
        ? this.prisma.departmentHierarchy.findMany({ where: { descendantId: target.departmentId }, select: { ancestorId: true } })
        : Promise.resolve([]),
    ]);
    const above = new Set(managers.map((m) => m.ancestorId));
    const deptTree = new Set(deptAncestors.map((d) => d.ancestorId));

    const users = await this.prisma.user.findMany({
      where: { companyId, status: UserStatus.ACTIVE },
      select: { ...ACCESS_USER_SELECT, firstName: true, lastName: true, email: true },
    });

    const people = [];
    let featureEnabled = true;
    for (const u of users) {
      const ctx = await this.access.resolve(u);
      if (!ctx.features.has(perm.feature)) {
        featureEnabled = false;
        continue;
      }
      // Approvals never include the person's own requests (self-approval is blocked)
      if (isApproval(permission) && u.id === target.userId) continue;
      const reaches = (scope: AccessScope, personUserId: string, me: AccessContext['employee']) =>
        personUserId === target.userId ||
        scope === 'company' ||
        (scope === 'direct_reports' && Boolean(me) && target.reportingManagerId === me!.id) ||
        (scope === 'all_reports' && Boolean(me) && above.has(me!.id)) ||
        (scope === 'department' && Boolean(me?.departmentId) && me!.departmentId === target.departmentId) ||
        (scope === 'department_tree' && Boolean(me?.departmentId) && deptTree.has(me!.departmentId!)) ||
        (scope === 'location' && Boolean(me?.locationId) && me!.locationId === target.locationId);

      if (ctx.grants.has(permission)) {
        const scope: AccessScope = ctx.grants.get(permission) ?? 'company';
        if (reaches(scope, u.id, ctx.employee)) {
          const isSelf = u.id === target.userId;
          people.push({
            userId: u.id,
            name: `${u.firstName} ${u.lastName}`,
            email: u.email,
            scope,
            reason: isSelf ? 'This is them' : REASON[scope],
            sources: (await this.sourcesFor(u, ctx)).get(permission) ?? [],
          });
          continue;
        }
      }
      // Covering for someone whose reach includes this employee
      const cover = ctx.delegations.find((d) => d.grants.has(permission) && reaches(d.grants.get(permission) ?? 'company', d.fromUserId, d.employee));
      if (cover) {
        const scope: AccessScope = cover.grants.get(permission) ?? 'company';
        people.push({
          userId: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          scope,
          reason: `Covering for ${cover.fromName} until ${cover.until.toISOString().slice(0, 10)}`,
          sources: [{ kind: 'delegation' as const, id: cover.id, name: `Delegated by ${cover.fromName}`, scope }],
        });
      }
    }
    people.sort((a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope) || a.name.localeCompare(b.name));

    return {
      employee: { id: target.id, name: `${target.firstName} ${target.lastName}` },
      permission: { key: perm.key, label: perm.label, sensitive: Boolean(perm.sensitive), scoped: perm.scopes.length > 0 },
      featureEnabled,
      people,
    };
  }

  // ─── Sensitive data check ─────────────────────────────────

  /**
   * "Who can see private data?" — for every sensitive permission (features the
   * company has), the people who hold it for someone other than themselves.
   */
  async sensitiveCheck(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: { companyId, status: UserStatus.ACTIVE },
      select: { ...ACCESS_USER_SELECT, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    const perms = CATALOG.flatMap((m) =>
      m.features.filter((f) => f.stage !== 'coming_soon').flatMap((f) => f.permissions.filter((p) => p.sensitive).map((p) => ({ ...p, feature: f.key, featureLabel: f.label }))),
    );
    const holders = new Map<string, Array<{ userId: string; name: string; email: string; scope: AccessScope | null; sources: Source[] }>>();
    let features: Set<string> | null = null;
    for (const u of users) {
      const ctx = await this.access.resolve(u);
      features ??= ctx.features;
      let sources: Map<string, Source[]> | null = null;
      for (const p of perms) {
        if (!ctx.grants.has(p.key)) continue;
        const scope = ctx.grants.get(p.key) ?? null;
        if (scope === 'own') continue; // everyone sees their own salary / payslip
        sources ??= await this.sourcesFor(u, ctx);
        holders.set(p.key, [
          ...(holders.get(p.key) ?? []),
          { userId: u.id, name: `${u.firstName} ${u.lastName}`.trim(), email: u.email, scope, sources: sources.get(p.key) ?? [] },
        ]);
      }
    }
    return perms
      .filter((p) => !features || features.has(p.feature))
      .map((p) => ({ key: p.key, label: p.label, feature: p.featureLabel, holders: holders.get(p.key) ?? [] }));
  }

  // ─── Helpers ──────────────────────────────────────────────

  /** permission → the roles (and owner role) that grant it, with their scopes. */
  private async sourcesFor(row: AccessUserRow, ctx: AccessContext): Promise<Map<string, Source[]>> {
    const out = new Map<string, Source[]>();
    const add = (key: string, s: Source) => out.set(key, [...(out.get(key) ?? []), s]);
    for (const { role } of row.userRoles) {
      if (role.status !== 'ACTIVE' || (role.companyId && role.companyId !== row.companyId)) continue;
      if (role.isOwner) {
        for (const key of ctx.grants.keys()) add(key, { kind: 'owner', id: role.id, name: role.name, scope: ctx.grants.get(key) ?? null });
        continue;
      }
      for (const [key, scope] of await this.access.roleGrants(role.id, role.version)) add(key, { kind: 'role', id: role.id, name: role.name, scope });
    }
    return out;
  }
}

const REASON: Record<AccessScope, string> = {
  own: 'Their own record',
  direct_reports: 'Direct manager',
  all_reports: 'Manager above them',
  department: 'Same department',
  department_tree: 'Department or a parent department',
  location: 'Same location',
  company: 'Company-wide access',
};
