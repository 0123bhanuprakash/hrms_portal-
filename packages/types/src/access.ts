// ============================================================
// Access control — shared TYPES only (no runtime values).
// The catalog itself lives in the API (modules/access/catalog.ts)
// and is served to the web by GET /access/catalog.
// ============================================================

/**
 * How far a grant reaches, narrowest → broadest.
 * Hierarchy scopes follow the company's reporting lines.
 */
export type AccessScope =
  | 'own'
  | 'direct_reports'
  | 'all_reports'
  | 'department'
  | 'department_tree'
  | 'location'
  | 'company';

export interface CatalogPermission {
  key: string; // "leave.approve"
  action: string; // "approve"
  label: string;
  description?: string;
  /** Scopes this permission supports; empty = not scoped (company-wide setting/action) */
  scopes: AccessScope[];
  sensitive?: boolean;
  /** Other permissions auto-granted with this one (e.g. edit ⇒ view) */
  requires?: string[];
}

export interface CatalogFeature {
  key: string; // "time.leave"
  label: string;
  description: string;
  /** Always on for every company; can't be switched off (e.g. users & roles) */
  core?: boolean;
  stage: 'ga' | 'beta' | 'coming_soon';
  /** Features that must be enabled for this one to work */
  dependsOn?: string[];
  permissions: CatalogPermission[];
}

export interface CatalogModule {
  key: string; // "time"
  label: string;
  icon: string; // lucide icon name
  features: CatalogFeature[];
}

/** One permission held by the current user, with every scope that applies. */
export interface AccessGrant {
  key: string;
  scope: AccessScope | null;
}

/** GET /auth/me/access */
export interface MyAccess {
  version: string;
  isSuperAdmin: boolean;
  isOwner: boolean;
  features: string[];
  roles: Array<{ id: string; key: string | null; name: string }>;
  /** permission key → broadest scope (null = unscoped) */
  grants: Record<string, AccessScope | null>;
  /** Approvals being covered for someone else right now */
  delegations: Array<{ id: string; fromUserId: string; fromName: string; until: string; permissions: string[] }>;
}
