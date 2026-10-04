'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { adminKeys } from '@/lib/admin/queries';
import type { CompanyStatus } from '@/lib/admin/types';

// ============================================================
// Super Admin → Companies: usage, setup, health, attention,
// tags and notes (tags and notes are never shown to companies).
// ============================================================

export type HealthLabel = 'healthy' | 'watch' | 'at_risk';
export type Stage = 'invited' | 'setting_up' | 'live' | 'paused';

export interface CompanyInsights {
  employees: number;
  users: number;
  maxEmployees: number | null;
  activeUsers7d: number;
  /** People active on each of the last 7 days (oldest first) */
  trend: number[];
  lastActivity: string | null;
  holidays: number;
  setup: { percent: number; items: Array<{ key: string; label: string; done: boolean }> };
  health: { score: number; label: HealthLabel };
  stage: Stage;
  statusSince: string;
  tags: string[];
}

export interface Attention {
  companyId: string;
  kind: 'suspended' | 'inactive' | 'near_limit' | 'no_activity' | 'setup' | 'no_holidays';
  severity: number;
  title: string;
  detail: string;
}

export interface CompaniesSummary {
  companies: { total: number; active: number; inactive: number; suspended: number; newThisMonth: number; growth: number[] };
  employees: number;
  users: { total: number; activeThisWeek: number };
  stages: Record<Stage, Array<{ id: string; name: string; setupPercent: number; status: CompanyStatus }>>;
  attention: Attention[];
  attentionTotal: number;
}

export interface CompanyNote {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string } | null;
}

export interface CompanyPanel extends CompanyInsights {
  dailyActive: Array<{ day: string; users: number }>;
  modules: Array<{ key: string; label: string; percent: number }>;
  storageBytes: number;
  recentActivity: Array<{ id: string; action: string; createdAt: string; user: { email: string; isSuperAdmin: boolean } | null }>;
  notes: CompanyNote[];
}

export const HEALTH_META: Record<HealthLabel, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  watch: { label: 'Watch', tone: 'warning' },
  at_risk: { label: 'At risk', tone: 'danger' },
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
const keys = {
  summary: [...adminKeys.all, 'companies-summary'] as const,
  tags: [...adminKeys.all, 'company-tags'] as const,
  panel: (id: string) => [...adminKeys.all, 'company-panel', id] as const,
};

export function useCompaniesSummary() {
  return useQuery({ queryKey: keys.summary, queryFn: async () => unwrap<CompaniesSummary>(await api.get('/admin/companies/summary')), staleTime: 30_000 });
}

export function useCompanyTagList() {
  return useQuery({ queryKey: keys.tags, queryFn: async () => unwrap<Array<{ label: string; count: number }>>(await api.get('/admin/companies/tags')), staleTime: 60_000 });
}

export function useCompanyPanel(id: string | null) {
  return useQuery({ queryKey: keys.panel(id ?? ''), queryFn: async () => unwrap<CompanyPanel>(await api.get(`/admin/companies/${id}/insights`)), enabled: Boolean(id) });
}

function useRefresh() {
  const qc = useQueryClient();
  return (id?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: [...adminKeys.all, 'companies'] }),
      qc.invalidateQueries({ queryKey: keys.summary }),
      qc.invalidateQueries({ queryKey: keys.tags }),
      qc.invalidateQueries({ queryKey: adminKeys.stats() }),
      id && qc.invalidateQueries({ queryKey: keys.panel(id) }),
    ]);
}

export function useSetCompanyTags() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => unwrap<{ tags: string[] }>(await api.put(`/admin/companies/${id}/tags`, { tags })),
    onSuccess: (_d, v) => refresh(v.id),
  });
}

export function useAddCompanyNote(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: string) => unwrap<CompanyNote>(await api.post(`/admin/companies/${id}/notes`, { body })),
    onSuccess: () => refresh(id),
  });
}

export function useRemoveCompanyNote(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (noteId: string) => unwrap<{ removed: boolean }>(await api.delete(`/admin/companies/${id}/notes/${noteId}`)),
    onSuccess: () => refresh(id),
  });
}

export type BulkAction =
  | { action: 'status'; status: CompanyStatus; reason?: string }
  | { action: 'plan'; planId: string }
  | { action: 'addTag' | 'removeTag'; tag: string };

export function useBulkCompanies() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ ids, ...rest }: { ids: string[] } & BulkAction) => unwrap<{ updated: number }>(await api.post('/admin/companies/bulk', { ids, ...rest })),
    onSuccess: () => refresh(),
  });
}

/** "1.2 GB" */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
