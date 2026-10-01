'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AuditLogEntry,
  AuditLogsQuery,
  CompaniesQuery,
  Company,
  CompanyAdmin,
  CompanyDetail,
  CompanyListItem,
  CompanyStatus,
  CreateCompanyInput,
  Paginated,
  PlatformStats,
  Session,
  SystemStatus,
  UpdateCompanyInput,
  CustomTheme,
  ThemeSettingsResolved,
  ThemeTokens,
} from './types';

// ============================================================
// TanStack Query hooks for the Super Admin portal.
// The API wraps payloads as { data, meta } — unwrap() returns `data`,
// list endpoints return the full { data, meta } via unwrapPage().
// ============================================================

export const adminKeys = {
  all: ['admin'] as const,
  system: () => [...adminKeys.all, 'system'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  companies: (q: CompaniesQuery) => [...adminKeys.all, 'companies', q] as const,
  company: (id: string) => [...adminKeys.all, 'company', id] as const,
  auditLogs: (q: AuditLogsQuery) => [...adminKeys.all, 'audit-logs', q] as const,
  auditActions: () => [...adminKeys.all, 'audit-actions'] as const,
  sessions: () => ['auth', 'sessions'] as const,
};

async function unwrap<T>(request: Promise<{ data: { data: T } }>): Promise<T> {
  return (await request).data.data;
}

async function unwrapPage<T>(request: Promise<{ data: Paginated<T> }>): Promise<Paginated<T>> {
  return (await request).data;
}

/** Drops undefined / empty values so they are not sent as query params. */
function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
  ) as Partial<T>;
}

// ─── Queries ──────────────────────────────────────────────

export function useSystemStatus(options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: adminKeys.system(),
    queryFn: () => unwrap<SystemStatus>(api.get('/admin/system')),
    staleTime: 30_000,
    refetchInterval: options.refetchInterval,
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => unwrap<PlatformStats>(api.get('/admin/stats')),
    staleTime: 30_000,
  });
}

export function useCompanies(query: CompaniesQuery) {
  return useQuery({
    queryKey: adminKeys.companies(query),
    queryFn: () => unwrapPage<CompanyListItem>(api.get('/admin/companies', { params: clean(query) })),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: adminKeys.company(id),
    queryFn: () => unwrap<CompanyDetail>(api.get(`/admin/companies/${id}`)),
    enabled: Boolean(id),
  });
}

export function useAuditLogs(query: AuditLogsQuery, options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: adminKeys.auditLogs(query),
    queryFn: () => unwrapPage<AuditLogEntry>(api.get('/admin/audit-logs', { params: clean(query) })),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchInterval: options.refetchInterval,
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: adminKeys.auditActions(),
    queryFn: () => unwrap<string[]>(api.get('/admin/audit-logs/actions')),
    staleTime: 60_000,
  });
}

export function useSessions() {
  return useQuery({
    queryKey: adminKeys.sessions(),
    queryFn: () => unwrap<Session[]>(api.get('/auth/sessions')),
  });
}

// ─── Mutations ────────────────────────────────────────────
// Every mutation that changes a company refreshes lists, stats, the
// company detail and the audit trail.

function useInvalidateCompany() {
  const qc = useQueryClient();
  return (companyId?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [...adminKeys.all, 'companies'] }),
      qc.invalidateQueries({ queryKey: adminKeys.stats() }),
      qc.invalidateQueries({ queryKey: [...adminKeys.all, 'audit-logs'] }),
      qc.invalidateQueries({ queryKey: adminKeys.auditActions() }),
      companyId && qc.invalidateQueries({ queryKey: adminKeys.company(companyId) }),
    ]);
}

export function useCreateCompany() {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: (input: CreateCompanyInput) =>
      unwrap<{ company: Company; message: string }>(api.post('/admin/companies', input)),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCompany(companyId: string) {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: (input: UpdateCompanyInput) =>
      unwrap<Company>(api.patch(`/admin/companies/${companyId}`, input)),
    onSuccess: () => invalidate(companyId),
  });
}

export function useUpdateCompanyStatus() {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: CompanyStatus; reason?: string }) =>
      unwrap<Company & { revokedSessions: number }>(
        api.patch(`/admin/companies/${id}/status`, clean({ status, reason })),
      ),
    onSuccess: (_data, vars) => invalidate(vars.id),
  });
}

export function useAddCompanyAdmin(companyId: string) {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: (input: { email: string; firstName: string; lastName: string }) =>
      unwrap<CompanyAdmin>(api.post(`/admin/companies/${companyId}/admins`, input)),
    onSuccess: () => invalidate(companyId),
  });
}

export function useUpdateAdminStatus(companyId: string) {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      unwrap<CompanyAdmin>(api.patch(`/admin/companies/${companyId}/admins/${userId}/status`, { status })),
    onSuccess: () => invalidate(companyId),
  });
}

export function useResendAdminInvite(companyId: string) {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap<{ message: string }>(api.post(`/admin/companies/${companyId}/admins/${userId}/resend-invite`)),
    onSuccess: () => invalidate(companyId),
  });
}

export function useSendAdminPasswordReset(companyId: string) {
  const invalidate = useInvalidateCompany();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap<{ message: string }>(api.post(`/admin/companies/${companyId}/admins/${userId}/reset-password`)),
    onSuccess: () => invalidate(companyId),
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { current_password: string; new_password: string }) =>
      unwrap<{ message: string; revokedSessions: number }>(api.post('/auth/change-password', input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.sessions() }),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => unwrap<{ message: string }>(api.delete(`/auth/sessions/${sessionId}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.sessions() }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap<{ revokedSessions: number }>(api.post('/auth/sessions/revoke-others')),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.sessions() }),
  });
}

export function useOpenQueueDashboard() {
  return useMutation({
    mutationFn: () => api.post('/admin/queues/session'),
  });
}

// ─── Themes ───────────────────────────────────────────────

export const themeKeys = {
  list: ['admin', 'themes'] as const,
  one: (id: string) => ['admin', 'themes', id] as const,
  settings: ['admin', 'theme-settings'] as const,
};

export function useCustomThemes(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: themeKeys.list,
    queryFn: () => unwrap<CustomTheme[]>(api.get('/admin/themes')),
    enabled: options.enabled ?? true,
  });
}

export function useCustomTheme(id: string | null) {
  return useQuery({
    queryKey: themeKeys.one(id ?? ''),
    queryFn: () => unwrap<CustomTheme>(api.get(`/admin/themes/${id}`)),
    enabled: Boolean(id),
  });
}

export function useThemeSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: themeKeys.settings,
    queryFn: () => unwrap<ThemeSettingsResolved>(api.get('/admin/theme-settings')),
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  });
}

function useInvalidateThemes() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: themeKeys.list }),
      qc.invalidateQueries({ queryKey: themeKeys.settings }),
      qc.invalidateQueries({ queryKey: [...adminKeys.all, 'audit-logs'] }),
    ]);
}

export function useSaveTheme() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; description?: string | null; tokens: ThemeTokens }) =>
      id
        ? unwrap<CustomTheme>(api.patch(`/admin/themes/${id}`, body))
        : unwrap<CustomTheme>(api.post('/admin/themes', body)),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTheme() {
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: (id: string) => unwrap<{ id: string; name: string }>(api.delete(`/admin/themes/${id}`)),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateThemeSettings() {
  const qc = useQueryClient();
  const invalidate = useInvalidateThemes();
  return useMutation({
    mutationFn: (body: Partial<Pick<ThemeSettingsResolved, 'superAdminTheme' | 'defaultCompanyTheme'>>) =>
      unwrap<ThemeSettingsResolved>(api.put('/admin/theme-settings', body)),
    onSuccess: (data) => {
      qc.setQueryData(themeKeys.settings, data);
      return invalidate();
    },
  });
}
