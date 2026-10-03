'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccessScope, CatalogFeature, CatalogModule, MyAccess } from '@hrms/types';
import { ACCESS_CHANGED_EVENT, api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

// ============================================================
// The signed-in user's effective access (GET /access/me) — the web's
// single source for menus and buttons. The API enforces everything
// again; this only decides what to show.
// Refreshes automatically when the API reports a new X-Access-Version.
// ============================================================

export const accessKeys = {
  me: ['access', 'me'] as const,
  catalog: ['access', 'catalog'] as const,
};

export function useAccess() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: accessKeys.me,
    queryFn: async () => (await api.get('/access/me')).data.data as MyAccess,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: accessKeys.me });
      void queryClient.invalidateQueries({ queryKey: accessKeys.catalog });
    };
    window.addEventListener(ACCESS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ACCESS_CHANGED_EVENT, refresh);
  }, [queryClient]);

  const access = query.data;
  const can = useCallback(
    (permission?: string) => !permission || Boolean(access && (access.isSuperAdmin || permission in access.grants)),
    [access],
  );
  const scopeOf = useCallback((permission: string): AccessScope | null | undefined => access?.grants[permission], [access]);
  const hasFeature = useCallback((feature: string) => Boolean(access?.isSuperAdmin || access?.features.includes(feature)), [access]);

  return { access, isLoading: query.isLoading, can, scopeOf, hasFeature, isOwner: Boolean(access?.isOwner) };
}

export type CatalogFeatureWithFlag = CatalogFeature & { enabled?: boolean };
export type CatalogModuleWithFlags = Omit<CatalogModule, 'features'> & { features: CatalogFeatureWithFlag[] };

/** Modules → features → permissions, with `enabled` for the caller's company. */
export function useAccessCatalog() {
  const query = useQuery({
    queryKey: accessKeys.catalog,
    queryFn: async () => (await api.get('/access/catalog')).data.data as CatalogModuleWithFlags[],
    staleTime: 5 * 60_000,
  });
  const index = useMemo(() => {
    const permissions = new Map<string, CatalogFeature['permissions'][number] & { feature: string; featureLabel: string; module: string }>();
    for (const m of query.data ?? []) {
      for (const f of m.features) for (const p of f.permissions) permissions.set(p.key, { ...p, feature: f.key, featureLabel: f.label, module: m.label });
    }
    return permissions;
  }, [query.data]);
  return { ...query, permissionIndex: index };
}

export const SCOPE_LABELS: Record<AccessScope, { label: string; hint: string }> = {
  own: { label: 'Own', hint: 'Only their own records' },
  direct_reports: { label: 'Direct reports', hint: 'Themselves + people who report directly to them' },
  all_reports: { label: 'All reports', hint: 'Themselves + everyone below them in the reporting tree' },
  department: { label: 'Department', hint: 'Everyone in their department' },
  department_tree: { label: 'Department + sub-departments', hint: 'Their department and every department under it' },
  location: { label: 'Location', hint: 'Everyone at their office location' },
  company: { label: 'Whole company', hint: 'Everyone in the company' },
};
