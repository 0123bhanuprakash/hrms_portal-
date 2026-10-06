'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccessScope } from '@hrms/types';
import { api } from '@/lib/api';
import { accessKeys } from '@/lib/access/use-access';

// ─── Types ──────────────────────────────────────────────────

export interface RoleSummary {
  id: string;
  key: string | null;
  name: string;
  description: string;
  isOwner: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  permissionCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
  /** Permissions per catalog module (people, time, work…) */
  modules?: Record<string, number>;
  sensitiveCount?: number;
  /** First few active people holding it */
  holders?: Array<{ id: string; firstName: string; lastName: string }>;
}

export interface RoleDetail extends RoleSummary {
  grants: Record<string, AccessScope | null>;
  holders: Array<{ id: string; firstName: string; lastName: string }>;
}

export interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  grants: Array<{ key: string; scope: AccessScope | null }>;
}

export interface RoleChanges {
  added: string[];
  removed: string[];
  rescoped: string[];
}

export interface CompanyUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  invited: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isSelf: boolean;
  isAdmin: boolean;
  roles: Array<{ id: string; key: string | null; name: string; isOwner: boolean; status: string }>;
  employee: { id: string; employeeId: string; department: { name: string } | null; designation: { name: string } | null } | null;
  activeSessions?: number;
}

export interface UsersPage {
  data: CompanyUser[];
  meta: { total: number; page: number; limit: number; totalPages: number; counts: { all: number; active: number; inactive: number; invited: number } };
}

export interface UsersQuery {
  search?: string;
  roleId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'INVITED';
  page?: number;
  limit?: number;
}

export type GrantInput = { key: string; scope?: AccessScope | null };

// ─── Keys ───────────────────────────────────────────────────

export const umKeys = {
  roles: ['company', 'roles'] as const,
  role: (id: string) => ['company', 'roles', id] as const,
  users: (q: UsersQuery) => ['company', 'users', q] as const,
  usersAll: ['company', 'users'] as const,
  insights: ['company', 'users', 'insights'] as const,
  templates: ['company', 'roles', 'templates'] as const,
  user: (id: string) => ['company', 'user', id] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

// ─── Roles ──────────────────────────────────────────────────

export function useRoles() {
  return useQuery({ queryKey: umKeys.roles, queryFn: async () => unwrap<RoleSummary[]>(await api.get('/company/roles')) });
}

export function useRole(id: string | null) {
  return useQuery({
    queryKey: umKeys.role(id ?? ''),
    queryFn: async () => unwrap<RoleDetail>(await api.get(`/company/roles/${id}`)),
    enabled: Boolean(id),
  });
}

function useRoleMutation<TVars, TResult = RoleDetail & { changes?: RoleChanges }>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: umKeys.roles });
      void qc.invalidateQueries({ queryKey: umKeys.usersAll });
      void qc.invalidateQueries({ queryKey: accessKeys.me });
    },
  });
}

export const useCreateRole = () =>
  useRoleMutation(async (body: { name: string; description?: string; grants: GrantInput[] }) => unwrap<RoleDetail & { changes: RoleChanges }>(await api.post('/company/roles', body)));

export const useUpdateRole = (id: string) =>
  useRoleMutation(async (body: { name: string; description?: string; grants: GrantInput[] }) =>
    unwrap<RoleDetail & { changes: RoleChanges }>(await api.put(`/company/roles/${id}`, body)),
  );

export const useDuplicateRole = () =>
  useRoleMutation(async ({ id, name }: { id: string; name?: string }) => unwrap<RoleDetail>(await api.post(`/company/roles/${id}/duplicate`, name ? { name } : {})));

export const useSetRoleStatus = () =>
  useRoleMutation(async ({ id, status, reassignToRoleId }: { id: string; status: 'ACTIVE' | 'INACTIVE'; reassignToRoleId?: string }) =>
    unwrap<RoleDetail>(await api.patch(`/company/roles/${id}/status`, { status, ...(reassignToRoleId && { reassignToRoleId }) })),
  );

export const useDeleteRole = () =>
  useRoleMutation(async (id: string) => unwrap<{ id: string; name: string }>(await api.delete(`/company/roles/${id}`)));

// ─── Users ──────────────────────────────────────────────────

export function useCompanyUsers(query: UsersQuery) {
  return useQuery({
    queryKey: umKeys.users(query),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''));
      return (await api.get('/company/users', { params })).data as UsersPage;
    },
    placeholderData: keepPreviousData,
  });
}

export function useCompanyUser(id: string | null) {
  return useQuery({
    queryKey: umKeys.user(id ?? ''),
    queryFn: async () => unwrap<CompanyUser>(await api.get(`/company/users/${id}`)),
    enabled: Boolean(id),
  });
}

function useUserMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: umKeys.usersAll });
      void qc.invalidateQueries({ queryKey: ['company', 'user'] });
      void qc.invalidateQueries({ queryKey: umKeys.roles });
    },
  });
}

export type EmployeeProfileBody = {
  joiningDate: string;
  departmentId?: string;
  designationId?: string;
  locationId?: string;
  reportingManagerId?: string;
};

export const useInviteUser = () =>
  useUserMutation(async (body: { firstName: string; lastName: string; email: string; roleIds?: string[]; employee?: EmployeeProfileBody }) =>
    unwrap<CompanyUser & { emailSent: boolean; employeeError: string | null }>(await api.post('/company/users', body)),
  );

/** Employee profile for an existing sign-in account (no new account, no email). */
export function useCreateEmployeeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ...body }: EmployeeProfileBody & { userId: string }) =>
      unwrap<{ employeeId: string }>(await api.post(`/employees/for-user/${userId}`, body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: umKeys.usersAll });
      void qc.invalidateQueries({ queryKey: ['org'] });
    },
  });
}

export const useUpdateCompanyUser = () =>
  useUserMutation(async ({ id, ...body }: { id: string; firstName?: string; lastName?: string }) => unwrap<CompanyUser>(await api.patch(`/company/users/${id}`, body)));

export const useSetUserRoles = () =>
  useUserMutation(async ({ id, roleIds }: { id: string; roleIds: string[] }) =>
    unwrap<CompanyUser & { changes: { added: string[]; removed: string[] } }>(await api.put(`/company/users/${id}/roles`, { roleIds })),
  );

export const useSetUserStatus = () =>
  useUserMutation(async ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
    unwrap<CompanyUser & { revokedSessions: number }>(await api.patch(`/company/users/${id}/status`, { status })),
  );

export const useResendInvite = () =>
  useUserMutation(async (id: string) => unwrap<CompanyUser & { emailSent: boolean }>(await api.post(`/company/users/${id}/resend-invite`)));

export const useSendPasswordReset = () =>
  useUserMutation(async (id: string) => unwrap<{ email: string }>(await api.post(`/company/users/${id}/reset-password`)));

// ─── Users: insights, bulk, invite many, preview, history ───

export interface UsersInsights {
  counts: { active: number; activeThisMonth: number; invited: number; oldInvites: number; inactive: number; admins: number };
  oldInvites: Array<{ id: string; name: string; days: number }>;
  dormant: Array<{ id: string; name: string; days: number; roles: string[] }>;
  dormantCount: number;
  privateData: { people: number; roles: string[] };
}

export const useUsersInsights = (enabled = true) =>
  useQuery({ queryKey: umKeys.insights, queryFn: async () => unwrap<UsersInsights>(await api.get('/company/users/insights')), enabled });

export type BulkAction = 'add_role' | 'remove_role' | 'resend_invite' | 'deactivate' | 'activate';
export const useBulkUsers = () =>
  useUserMutation(async (body: { ids: string[]; action: BulkAction; roleId?: string }) =>
    unwrap<{ done: number; failed: Array<{ id: string; name: string; error: string }> }>(await api.post('/company/users/bulk', body)),
  );

export const useInviteMany = () =>
  useUserMutation(async (body: { emails: string[]; roleIds?: string[] }) =>
    unwrap<{ invited: number; results: Array<{ email: string; ok: boolean; id?: string; emailSent?: boolean; error?: string }> }>(await api.post('/company/users/invite-many', body)),
  );

export interface PermissionChange {
  key: string;
  label: string;
  sensitive: boolean;
  scope: AccessScope | null;
  from?: AccessScope;
}
export interface RolesPreview {
  becomesOwner: boolean;
  losesOwner: boolean;
  added: PermissionChange[];
  removed: PermissionChange[];
  widened: PermissionChange[];
  narrowed: PermissionChange[];
  sensitiveAdded: number;
  permissionCount: { before: number; after: number };
}

/** What changes for a person if their roles become `roleIds` (only asked when they differ). */
export const useRolesPreview = (userId: string | null, roleIds: string[], enabled: boolean) =>
  useQuery({
    queryKey: ['company', 'user', userId, 'preview', [...roleIds].sort()],
    queryFn: async () => unwrap<RolesPreview>(await api.post(`/company/users/${userId}/roles/preview`, { roleIds })),
    enabled: Boolean(userId) && enabled,
    placeholderData: keepPreviousData,
  });

export interface UserHistoryItem {
  id: string;
  action: string;
  at: string;
  by: string | null;
  added: string[];
  removed: string[];
  status: string | null;
}
export const useUserHistory = (userId: string | null, enabled = true) =>
  useQuery({
    queryKey: ['company', 'user', userId, 'history'],
    queryFn: async () => unwrap<UserHistoryItem[]>(await api.get(`/company/users/${userId}/history`)),
    enabled: Boolean(userId) && enabled,
  });

export const useRoleTemplates = () =>
  useQuery({ queryKey: umKeys.templates, queryFn: async () => unwrap<RoleTemplate[]>(await api.get('/company/roles/templates')), staleTime: Infinity });
