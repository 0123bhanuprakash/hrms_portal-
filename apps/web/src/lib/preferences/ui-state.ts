'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { companyKeys, useCompanyTheme, usePreferences, type CompanyThemeResponse, type UserPreferences } from '@/lib/company/queries';
import { useAuthStore } from '@/store/useAuthStore';

// ============================================================
// View settings that follow the person to any device: chart styles,
// open menu sections, calendar views… Saved on their account a moment
// after each change (changes are batched). Order of precedence:
//   your choice → your company's default → the built-in default.
// What is NOT saved here (on purpose): search text, filters, page
// numbers, open dialogs, scroll and carousel positions.
// ============================================================

let pending: Record<string, unknown> = {};
let timer: ReturnType<typeof setTimeout> | null = null;

function flushSoon(qc: QueryClient) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const changes = pending;
    pending = {};
    timer = null;
    try {
      await api.patch('/users/me/ui-state', { changes });
    } catch {
      // Keep working locally; the next change retries with everything still pending
      pending = { ...changes, ...pending };
      void qc; // the cached value stays as the person chose it
    }
  }, 600);
}

/** One saved view setting. `isValid` guards against stale or unknown values. */
export function useUiState<T>(key: string, fallback: T, isValid?: (v: unknown) => v is T): [T, (v: T) => void] {
  const qc = useQueryClient();
  const companyId = useAuthStore((s) => s.companyId);
  const prefs = usePreferences();
  const theme = useCompanyTheme(companyId);
  const ok = (v: unknown): v is T => v !== undefined && v !== null && (!isValid || isValid(v));
  const mine = prefs.data?.uiState?.[key];
  const company = theme.data?.uiDefaults?.[key];
  const value = ok(mine) ? mine : ok(company) ? company : fallback;

  const set = useCallback(
    (v: T) => {
      qc.setQueryData<UserPreferences>(companyKeys.preferences, (old) => (old ? { ...old, uiState: { ...(old.uiState ?? {}), [key]: v } } : old));
      pending[key] = v;
      flushSoon(qc);
    },
    [qc, key],
  );
  return [value, set];
}

/** True once the person's saved settings have loaded (to avoid moving things after first paint). */
export function useUiStateReady(): boolean {
  return Boolean(usePreferences().data);
}

/** Forget every saved view setting (Preferences → Reset). */
export function useResetUiState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      pending = {};
      await api.delete('/users/me/ui-state');
    },
    onSuccess: () => qc.setQueryData<UserPreferences>(companyKeys.preferences, (old) => (old ? { ...old, uiState: {} } : old)),
  });
}

/** Company Admins: make a set of view settings the company default. */
export function useUpdateUiDefaults(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => (await api.put(`/companies/${companyId}/ui-defaults`, { values })).data.data as Record<string, unknown>,
    onSuccess: (uiDefaults) => qc.setQueryData<CompanyThemeResponse>(companyKeys.theme(companyId), (old) => (old ? { ...old, uiDefaults } : old)),
  });
}
