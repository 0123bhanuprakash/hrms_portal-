import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AccessScope, MyAccess } from '@hrms/types';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from './entitlement.service';
import { broader, CATALOG, featureOf } from './catalog';
import { ACCESS_USER_SELECT, type AccessContext, type AccessUserRow } from './access.types';

type RoleGrants = Array<[key: string, scope: AccessScope | null]>;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  // ─── Building the context ─────────────────────────────────

  async resolve(user: AccessUserRow): Promise<AccessContext> {
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

    const versionSource = [
      user.company.featuresVersion,
      user.company.hierarchyVersion,
      ...activeRoles.map((r) => `${r.id}:${r.version}`).sort(),
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
      version: crypto.createHash('sha1').update(versionSource).digest('hex').slice(0, 12),
    };
  }

  /** Context for a user id (login response, /access/me). */
  async forUser(userId: string): Promise<AccessContext> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ACCESS_USER_SELECT });
    return this.resolve(user);
  }

  toMyAccess(access: AccessContext): MyAccess {
    return {
      version: access.version,
      isSuperAdmin: access.isSuperAdmin,
      isOwner: access.isOwner,
      features: [...access.features].sort(),
      roles: access.roles,
      grants: Object.fromEntries([...access.grants.entries()].sort(([a], [b]) => a.localeCompare(b))),
    };
  }

  private async roleGrants(roleId: string, version: number): Promise<RoleGrants> {
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
    return access.isSuperAdmin || access.grants.has(permission);
  }

  /**
   * Prisma filter on `Employee` for the records a permission reaches.
   * Always combine with the company filter. Returns null = no access at all.
   * Managers always see themselves too ("own" is implied by wider scopes).
   */
  employeeScope(access: AccessContext, permission: string): Prisma.EmployeeWhereInput | null {
    if (access.isSuperAdmin) return {};
    if (!access.grants.has(permission)) return null;
    const scope = access.grants.get(permission) ?? 'company';
    const own: Prisma.EmployeeWhereInput = { userId: access.userId };
    const me = access.employee;

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
