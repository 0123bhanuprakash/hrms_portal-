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
  /** Changes whenever features, roles or the hierarchy change (X-Access-Version) */
  version: string;
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
