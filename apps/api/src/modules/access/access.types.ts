import type { AccessScope } from '@hrms/types';

/**
 * Everything the API knows about what the current user may do.
 * Built once per request (from version-keyed caches) and attached to
 * `req.user.access` by JwtStrategy.
 */
export interface AccessContext {
  userId: string;
  companyId: string | null;
  isSuperAdmin: boolean;
  /** Holds the company's owner role (Company Admin) */
  isOwner: boolean;
  /** The user's employee record — needed for hierarchy scopes */
  employee: { id: string; departmentId: string | null; locationId: string | null } | null;
  /** Enabled feature keys for the company */
  features: Set<string>;
  /** permission key → broadest scope across all roles (null = unscoped) */
  grants: Map<string, AccessScope | null>;
  roles: Array<{ id: string; key: string | null; name: string }>;
  /** Approvals this user is covering for someone else right now (reach = the delegator's) */
  delegations: ActiveDelegation[];
  /** Changes whenever features, roles or the hierarchy change (X-Access-Version) */
  version: string;
}

export interface ActiveDelegation {
  id: string;
  fromUserId: string;
  fromName: string;
  until: Date;
  /** The delegator's employee record — scopes are evaluated from their position */
  employee: { id: string; departmentId: string | null; locationId: string | null } | null;
  /** Delegated permission → the delegator's scope */
  grants: Map<string, AccessScope | null>;
  /** The approvals handed over (null = all of them) */
  only: Set<string> | null;
}

/**
 * Delegations that cover `permission` (an approval kind). Use this instead of
 * `access.delegations` wherever a delegate acts for someone in an approver pool.
 */
export function covering(access: Pick<AccessContext, 'delegations'>, permission: string): ActiveDelegation[] {
  return access.delegations.filter((d) => !d.only || d.only.has(permission));
}

/** Holds a permission directly or by covering for someone. */
export function holds(access: AccessContext, permission: string): boolean {
  return access.isSuperAdmin || access.grants.has(permission) || access.delegations.some((d) => d.grants.has(permission));
}

/** The user row JwtStrategy loads on every request (one query). */
export interface AccessUserRow {
  id: string;
  isSuperAdmin: boolean;
  companyId: string | null;
  company: { featuresVersion: number; hierarchyVersion: number } | null;
  employee: { id: string; departmentId: string | null; locationId: string | null } | null;
  userRoles: Array<{
    role: { id: string; key: string | null; name: string; version: number; status: string; isOwner: boolean; companyId: string | null };
  }>;
}

/** Prisma select producing an AccessUserRow (shared by JwtStrategy and AuthService). */
export const ACCESS_USER_SELECT = {
  id: true,
  isSuperAdmin: true,
  companyId: true,
  company: { select: { featuresVersion: true, hierarchyVersion: true } },
  employee: { select: { id: true, departmentId: true, locationId: true } },
  userRoles: {
    select: {
      role: { select: { id: true, key: true, name: true, version: true, status: true, isOwner: true, companyId: true } },
    },
  },
} as const;
