'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────

export interface Plan {
  id: string;
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  limits: Record<string, number | null>;
  features: string[];
  companyCount: number;
  updatedAt: string;
}

export interface CompanyFeatureState {
  key: string;
  label: string;
  description: string;
  stage: 'ga' | 'beta' | 'coming_soon';
  core: boolean;
  dependsOn: string[];
  inPlan: boolean;
  override: { mode: 'ON' | 'OFF'; reason: string | null; expiresAt: string | null; expired: boolean; updatedAt: string } | null;
  enabled: boolean;
  blockedBy: string[];
}

export interface CompanyLimitState {
  key: string;
  label: string;
  description: string;
  plan: number | null;
  /** undefined = no override (follows the plan) */
  override?: number | null;
  effective: number | null;
  usage?: number;
}

export interface CompanyEntitlements {
  company: { id: string; name: string };
  plan: Plan | null;
  modules: Array<{ key: string; label: string; features: CompanyFeatureState[] }>;
  limits: CompanyLimitState[];
  usage: { employees: number; users: number };
}

export interface SavePlanInput {
  name: string;
  key?: string;
  description?: string;
  features: string[];
  limits?: Record<string, number | null>;
  isActive?: boolean;
}

// ─── Keys ───────────────────────────────────────────────────

export const planKeys = {
  all: ['admin', 'plans'] as const,
  plan: (id: string) => ['admin', 'plans', id] as const,
  company: (id: string) => ['admin', 'company-features', id] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

// ─── Plans ──────────────────────────────────────────────────

export function usePlans() {
  return useQuery({ queryKey: planKeys.all, queryFn: async () => unwrap<Plan[]>(await api.get('/admin/plans')) });
}

export function usePlan(id: string | null) {
  return useQuery({ queryKey: planKeys.plan(id ?? ''), queryFn: async () => unwrap<Plan>(await api.get(`/admin/plans/${id}`)), enabled: Boolean(id) });
}

function usePlanMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.all });
      void qc.invalidateQueries({ queryKey: ['admin', 'company-features'] });
    },
  });
}

export const useCreatePlan = () => usePlanMutation(async (body: SavePlanInput) => unwrap<Plan>(await api.post('/admin/plans', body)));
export const useUpdatePlan = (id: string) =>
  usePlanMutation(async (body: SavePlanInput) =>
    unwrap<Plan & { changes: { added: string[]; removed: string[]; affectedCompanies: number } }>(await api.put(`/admin/plans/${id}`, body)),
  );
export const useDeletePlan = () => usePlanMutation(async (id: string) => unwrap<{ id: string; name: string }>(await api.delete(`/admin/plans/${id}`)));

// ─── Company entitlements ───────────────────────────────────

export function useCompanyEntitlements(companyId: string) {
  return useQuery({
    queryKey: planKeys.company(companyId),
    queryFn: async () => unwrap<CompanyEntitlements>(await api.get(`/admin/companies/${companyId}/features`)),
  });
}

function useEntitlementMutation<V>(companyId: string, fn: (v: V) => Promise<CompanyEntitlements>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(planKeys.company(companyId), data);
      void qc.invalidateQueries({ queryKey: planKeys.all });
    },
  });
}

export const useSetCompanyPlan = (companyId: string) =>
  useEntitlementMutation(companyId, async (planId: string) => unwrap<CompanyEntitlements>(await api.put(`/admin/companies/${companyId}/plan`, { planId })));

export const useSetFeatureOverride = (companyId: string) =>
  useEntitlementMutation(companyId, async ({ feature, ...body }: { feature: string; mode: 'ON' | 'OFF'; reason?: string; expiresAt?: string }) =>
    unwrap<CompanyEntitlements>(await api.put(`/admin/companies/${companyId}/features/${feature}`, body)),
  );

export const useClearFeatureOverride = (companyId: string) =>
  useEntitlementMutation(companyId, async (feature: string) => unwrap<CompanyEntitlements>(await api.delete(`/admin/companies/${companyId}/features/${feature}`)));

export const useSetCompanyLimits = (companyId: string) =>
  useEntitlementMutation(companyId, async (limits: Record<string, number | null>) =>
    unwrap<CompanyEntitlements>(await api.put(`/admin/companies/${companyId}/limits`, { limits })),
  );

/** "Unlimited" / "50" */
export const formatLimit = (value: number | null | undefined) => (value === null || value === undefined ? 'Unlimited' : value.toLocaleString());
