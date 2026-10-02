import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AccessScope, MyAccess } from '@hrms/types';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from './entitlement.service';
import { broader, CATALOG, DELEGABLE_PERMISSIONS, featureOf, isApproval } from './catalog';
import { ACCESS_USER_SELECT, holds, type AccessContext, type AccessUserRow, type ActiveDelegation } from './access.types';

export type RoleGrants = Array<[key: string, scope: AccessScope | null]>;

/**
 * Layers 2 + 3 — what a user may do (roles) and over whom (scopes).
 *
 *   allowed = feature enabled for company
 *           AND some active role grants the permission
 *           AND the record lies within the grant's scope
 *
 * Role grants are cached per role@version, features per company@version,
 * so building a request's AccessContext normally costs no extra queries.
 */
@Injectable()
export class AccessService {
  private readonly roleCache = new Map<string, RoleGrants>();
  /** Active delegations per delegate (short-lived; dropped on every create / revoke). */
  private readonly delegationCache = new Map<string, { expires: number; list: ActiveDelegation[] }>();
  private static readonly DELEGATION_TTL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  // ─── Building the context ─────────────────────────────────

  async resolve(user: AccessUserRow, opts: { withDelegations?: boolean } = {}): Promise<AccessContext> {
    const activeRoles = user.userRoles
      .map((ur) => ur.role)
      .filter((r) => r.status === 'ACTIVE' && (r.companyId === null || r.companyId === user.companyId));

    if (user.isSuperAdmin || !user.companyId || !user.company) {
      return {
        userId: user.id,
        companyId: user.companyId,
        isSuperAdmin: user.isSuperAdmin,
        isOwner: false,
        employee: user.employee,
        features: new Set(),
        grants: new Map(),
        roles: activeRoles.map(({ id, key, name }) => ({ id, key, name })),
        delegations: [],
        version: user.isSuperAdmin ? 'super-admin' : 'none',
      };
    }

    const { features } = await this.entitlements.forCompany(user.companyId, user.company.featuresVersion);
    const isOwner = activeRoles.some((r) => r.isOwner);
    const grants = new Map<string, AccessScope | null>();
    const add = (key: string, scope: AccessScope | null) => {
      const feature = featureOf(key);
      if (!feature || !features.has(feature)) return; // feature off → grant dormant
      grants.set(key, grants.has(key) ? broader(grants.get(key)!, scope) : scope);
    };

    if (isOwner) {
      // Owner: everything the company has, at the broadest scope
      for (const m of CATALOG) {
        for (const f of m.features) {
          for (const perm of f.permissions) add(perm.key, perm.scopes.length ? 'company' : null);
        }
      }
    }
    for (const role of activeRoles) {
      if (role.isOwner) continue;
      for (const [key, scope] of await this.roleGrants(role.id, role.version)) add(key, scope);
    }

    // Covering for someone: their approval grants, only for features this company has
    const delegations =
      opts.withDelegations === false
        ? []
        : (await this.delegationsFor(user.id, user.companyId))
            .map((d) => ({ ...d, grants: new Map([...d.grants].filter(([k]) => features.has(featureOf(k) ?? ''))) }))
            .filter((d) => d.grants.size > 0);

    const versionSource = [
      user.company.featuresVersion,
      user.company.hierarchyVersion,
      ...activeRoles.map((r) => `${r.id}:${r.version}`).sort(),
      ...delegations.map((d) => d.id).sort(),
    ].join('|');

    return {
      userId: user.id,
      companyId: user.companyId,
      isSuperAdmin: false,
      isOwner,
      employee: user.employee,
      features,
      grants,
      roles: activeRoles.map(({ id, key, name }) => ({ id, key, name })),
      delegations,
      version: crypto.createHash('sha1').update(versionSource).digest('hex').slice(0, 12),
    };
  }

  /** Context for a user id (login response, /access/me). */
  async forUser(userId: string): Promise<AccessContext> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ACCESS_USER_SELECT });
    return this.resolve(user);
  }

  /** Delegations this user currently covers (cached ~30 s; invalidated on create / revoke). */
  async delegationsFor(userId: string, companyId: string): Promise<ActiveDelegation[]> {
    const hit = this.delegationCache.get(userId);
    if (hit && hit.expires > Date.now()) return hit.list;
    const now = new Date();
    const rows = await this.prisma.approvalDelegation.findMany({
      where: { delegateId: userId, companyId, revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now }, delegator: { status: 'ACTIVE' } },
      select: { id: true, endsAt: true, delegatorId: true, delegator: { select: { firstName: true, lastName: true } } },
    });
    const list: ActiveDelegation[] = [];
    for (const r of rows) {
      // The delegator's OWN grants (no chained delegations)
      const user = await this.prisma.user.findUnique({ where: { id: r.delegatorId }, select: ACCESS_USER_SELECT });
      if (!user) continue;
      const theirs = await this.resolve(user, { withDelegations: false });
      const grants = new Map(DELEGABLE_PERMISSIONS.filter((k) => theirs.grants.has(k)).map((k) => [k, theirs.grants.get(k)!] as const));
      list.push({ id: r.id, fromUserId: r.delegatorId, fromName: `${r.delegator.firstName} ${r.delegator.lastName}`, until: r.endsAt, employee: theirs.employee, grants });
    }
    // Expire the cache no later than the first delegation ends
    const soonest = Math.min(...list.map((d) => d.until.getTime()), Date.now() + AccessService.DELEGATION_TTL_MS);
    this.delegationCache.set(userId, { expires: soonest, list });
    return list;
  }

  invalidateDelegations(...userIds: string[]): void {
    userIds.forEach((id) => this.delegationCache.delete(id));
  }

  toMyAccess(access: AccessContext): MyAccess {
    return {
      version: access.version,
      isSuperAdmin: access.isSuperAdmin,
      isOwner: access.isOwner,
      features: [...access.features].sort(),
      roles: access.roles,
      grants: Object.fromEntries([...access.grants.entries()].sort(([a], [b]) => a.localeCompare(b))),
      delegations: access.delegations.map((d) => ({ id: d.id, fromUserId: d.fromUserId, fromName: d.fromName, until: d.until.toISOString(), permissions: [...d.grants.keys()] })),
    };
  }

  /** A role's stored grants (cached per role@version). */
  async roleGrants(roleId: string, version: number): Promise<RoleGrants> {
    const cacheKey = `${roleId}@${version}`;
    const hit = this.roleCache.get(cacheKey);
    if (hit) return hit;
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { scope: true, permission: { select: { key: true } } },
    });
    const grants: RoleGrants = rows.map((r) => [r.permission.key, (r.scope as AccessScope | null) ?? null]);
    for (const key of this.roleCache.keys()) if (key.startsWith(`${roleId}@`)) this.roleCache.delete(key);
    this.roleCache.set(cacheKey, grants);
    return grants;
  }

  // ─── Checks ───────────────────────────────────────────────

  can(access: AccessContext, permission: string): boolean {
    return holds(access, permission);
  }

  /**
   * Prisma filter on `Employee` for the records a permission reaches.
   * Always combine with the company filter. Returns null = no access at all.
   * Managers always see themselves too ("own" is implied by wider scopes).
   */
  employeeScope(access: AccessContext, permission: string): Prisma.EmployeeWhereInput | null {
    if (access.isSuperAdmin) return {};
    const filters: Prisma.EmployeeWhereInput[] = [];
    if (access.grants.has(permission)) {
      filters.push(this.scopeFilter(access.grants.get(permission) ?? 'company', access.userId, access.employee));
    }
    // Covering for someone: their reach, evaluated from THEIR position
    for (const d of access.delegations) {
      if (d.grants.has(permission)) filters.push(this.scopeFilter(d.grants.get(permission) ?? 'company', d.fromUserId, d.employee));
    }
    if (!filters.length) return null;
    const combined: Prisma.EmployeeWhereInput = filters.some((f) => Object.keys(f).length === 0)
      ? {} // company-wide
      : filters.length === 1
        ? filters[0]!
        : { OR: filters };
    // Nobody approves their own requests — not via their roles, not while covering for someone
    if (isApproval(permission)) return { AND: [combined, { NOT: { userId: access.userId } }] };
    return combined;
  }

  /** One scope → Prisma filter, relative to a person (userId + employee record). */
  private scopeFilter(
    scope: AccessScope,
    userId: string,
    me: { id: string; departmentId: string | null; locationId: string | null } | null,
  ): Prisma.EmployeeWhereInput {
    const own: Prisma.EmployeeWhereInput = { userId };
    switch (scope) {
      case 'company':
        return {};
      case 'own':
        return own;
      case 'direct_reports':
        return me ? { OR: [own, { reportingManagerId: me.id }] } : own;
      case 'all_reports':
        return me ? { OR: [own, { ancestors: { some: { ancestorId: me.id } } }] } : own;
      case 'department':
        return me?.departmentId ? { OR: [own, { departmentId: me.departmentId }] } : own;
      case 'department_tree':
        return me?.departmentId
          ? { OR: [own, { department: { ancestors: { some: { ancestorId: me.departmentId } } } }] }
          : own;
      case 'location':
        return me?.locationId ? { OR: [own, { locationId: me.locationId }] } : own;
      default:
        return own;
    }
  }

  /** Filter for queries; throws 403 when the user has no access at all. */
  requireEmployeeScope(access: AccessContext, permission: string): Prisma.EmployeeWhereInput {
    const scope = this.employeeScope(access, permission);
    if (!scope) throw new ForbiddenException(`You do not have permission to perform this action. Required: ${permission}`);
    return scope;
  }

  /** 404 (not 403) when the record exists but is outside the user's reach. */
  async assertEmployeeInScope(access: AccessContext, permission: string, companyId: string, employeeId: string): Promise<void> {
    const scope = this.requireEmployeeScope(access, permission);
    const found = await this.prisma.employee.count({ where: { AND: [{ id: employeeId, companyId }, scope] } });
    if (!found) throw new NotFoundException('Employee not found');
  }
}
