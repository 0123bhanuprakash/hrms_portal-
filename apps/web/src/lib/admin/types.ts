// ============================================================
// Super Admin API types — mirror /api/v1/admin/* and /auth/* responses
// ============================================================

export type CompanyStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING_VERIFICATION';

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CompanyBranding {
  logoUrl: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  secondaryColor?: string;
  displayName: string;
  themeTokens?: import('@hrms/types').ThemeTokens | null;
  themeSource?: import('@hrms/types').ThemeRef | null;
}

export interface CompanySettings {
  employeeIdPrefix: string;
  employeeIdSequence?: number;
  timezone?: string;
}

export interface CompanyListItem {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
  branding: Pick<CompanyBranding, 'logoUrl' | 'primaryColor' | 'displayName'> | null;
  settings: Pick<CompanySettings, 'employeeIdPrefix'> | null;
  /** Plan and its limits (null limit = unlimited) */
  plan?: { key: string; name: string; limits: { maxEmployees?: number | null } | null } | null;
  _count: { users: number; employees: number };
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
  branding: CompanyBranding | null;
  settings: CompanySettings | null;
}

export interface CompanyAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CompanyDetail {
  company: Company & { _count: { users: number; employees: number; departments: number } };
  admins: CompanyAdmin[];
  stats: { totalUsers: number; totalEmployees: number; totalDepartments: number };
}

export interface PlatformStats {
  companies: { total: number; active: number; inactive: number; suspended: number; newLast30Days: number };
  users: { total: number };
  auditLogs: { total: number };
  recentCompanies: Array<{
    id: string;
    name: string;
    slug: string;
    status: CompanyStatus;
    createdAt: string;
    _count: { users: number };
    branding: { logoUrl: string | null; primaryColor: string } | null;
  }>;
}

export type ServiceState = 'ok' | 'error' | 'disabled';
export type ServiceName = 'database' | 'redis' | 'elasticsearch';

export interface SystemStatus {
  health: {
    status: 'ok' | 'error';
    services: Record<ServiceName, ServiceState>;
    latencyMs: Partial<Record<ServiceName, number>>;
    checkedAt: string;
  };
  api: { version: string; nodeVersion: string; environment: string; uptimeSeconds: number };
  queue: { enabled: boolean };
  storage: { driver: 'local' | 's3' | string };
  email: {
    provider: string;
    state: 'ok' | 'error' | 'unverified' | 'disabled';
    detail: string;
    from: string;
    checkedAt?: string;
  };
  search: { enabled: boolean };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  afterState: unknown;
  beforeState: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
  company: { id: string; name: string; slug: string } | null;
  user: { id: string; email: string; firstName: string; lastName: string } | null;
}

export interface CompaniesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: CompanyStatus;
  sortBy?: 'createdAt' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogsQuery {
  page?: number;
  limit?: number;
  companyId?: string;
  action?: string;
  userEmail?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateCompanyInput {
  /** Subscription plan (server default when omitted) */
  planId?: string;
  name: string;
  slug: string;
  email: string;
  employeeIdPrefix?: string;
  primaryColor?: string;
  secondaryColor?: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  themeTokens?: import('@hrms/types').ThemeTokens;
  themeSource?: import('@hrms/types').ThemeRef;
}

export interface UpdateCompanyInput {
  name?: string;
  email?: string;
  employeeIdPrefix?: string;
  primaryColor?: string;
  secondaryColor?: string;
  themeTokens?: import('@hrms/types').ThemeTokens;
  themeSource?: import('@hrms/types').ThemeRef;
}

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  signedInAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

// ─── Themes ───────────────────────────────────────────────
export type { CustomTheme, PlatformThemeSettings, ThemeRef, ThemeTokens } from '@hrms/types';

export interface ThemeSettingsResolved {
  superAdminTheme: import('@hrms/types').ThemeRef;
  defaultCompanyTheme: import('@hrms/types').ThemeRef;
  /** Tokens of custom themes referenced by the settings, keyed by id */
  customTokens: Record<string, import('@hrms/types').ThemeTokens>;
}
