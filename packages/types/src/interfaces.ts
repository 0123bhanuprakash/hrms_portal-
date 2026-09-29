// ============================================================
// Interfaces — Fully implemented in Chunk 3
// Placeholder stubs so the package compiles now
// ============================================================

import type { UserStatus, CompanyStatus, Theme, DefaultRole } from './enums';

// ---- API Response Envelope ----

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: Required<ApiMeta>;
}

// RFC 7807 Problem Details
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

// ---- Auth & Identity ----

export interface JwtPayload {
  sub: string;           // user UUID
  company_id: string | null; // null for super admin
  is_super_admin: boolean;
  roles: DefaultRole[];
  permissions: string[]; // e.g. ['employee:create', 'leave:approve']
  iat: number;
  exp: number;
}

export interface TenantContext {
  company_id: string;
  is_super_admin: boolean;
}

// ---- Users ----

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  companyId: string | null;
  roles: DefaultRole[];
  permissions: string[];
  preferences: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  theme: Theme;
  timezone: string;
  dateFormat: string;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
}

// ---- Company ----

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyBranding {
  companyId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  displayName: string;
}

// ---- Pagination Query ----

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}
