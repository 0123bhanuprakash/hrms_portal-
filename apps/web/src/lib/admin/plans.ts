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

// ─── Insights: usage, switches & trials, upgrade candidates, impact, history ───

export interface CompanyBrief {
  id: string;
  name: string;
  logoUrl: string | null;
  color: string | null;
}

export interface PlansOverview {
  plans: Array<{ id: string; employees: number; nearLimit: number; companies: CompanyBrief[]; featureUse: Record<string, number | null> }>;
  totals: { companies: number; withSwitches: number; trialsEndingSoon: number };
  switches: Array<{ company: CompanyBrief; featureKey: string; featureLabel: string; mode: 'ON' | 'OFF'; reason: string | null; expiresAt: string | null }>;
  candidates: Array<{
    company: CompanyBrief;
    plan: { id: string; name: string };
    employees: number;
    limit: number | null;
    extras: Array<{ key: string; label: string }>;
    suggested: { id: string; name: string } | null;
  }>;
}

export interface PlanImpact {
  added: Array<{ key: string; label: string }>;
  removed: Array<{ key: string; label: string }>;
  companiesOnPlan: number;
  companies: Array<{
    company: CompanyBrief;
    loses: Array<{ key: string; label: string; uses: number | null }>;
    keeps: Array<{ key: string; label: string }>;
    employees: number;
    overLimit: boolean;
  }>;
}

export interface PlanHistoryItem {
  id: string;
  action: string;
  createdAt: string;
  by: string;
  added: string[];
  removed: string[];
  limits: Record<string, [number | null, number | null]>;
  archived: boolean | null;
  affectedCompanies: number | null;
}

export function usePlansOverview() {
  return useQuery({ queryKey: [...planKeys.all, 'overview'], queryFn: async () => unwrap<PlansOverview>(await api.get('/admin/plans/overview')), staleTime: 30_000 });
}

export function usePlanHistory(id: string | null) {
  return useQuery({ queryKey: [...planKeys.plan(id ?? ''), 'history'], queryFn: async () => unwrap<PlanHistoryItem[]>(await api.get(`/admin/plans/${id}/history`)), enabled: Boolean(id) });
}

/** "Who's affected" for an unsaved plan; refetches as the draft changes. */
export function usePlanImpact(id: string | null, draft: { features: string[]; limits?: Record<string, number | null> } | null) {
  const features = draft ? [...draft.features].sort() : [];
  return useQuery({
    queryKey: [...planKeys.plan(id ?? ''), 'impact', features.join(','), JSON.stringify(draft?.limits ?? null)],
    queryFn: async () => unwrap<PlanImpact>(await api.post(`/admin/plans/${id}/impact`, { features, limits: draft?.limits })),
    enabled: Boolean(id && draft),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

/** Fixed colour per plan position, so a plan looks the same everywhere. */
export const PLAN_COLORS = ['#0F766E', '#1D4ED8', '#B7791F', '#7C3AED', '#BE185D', '#0369A1'];
export const planColor = (index: number): string => PLAN_COLORS[index % PLAN_COLORS.length] ?? '#B7791F';
