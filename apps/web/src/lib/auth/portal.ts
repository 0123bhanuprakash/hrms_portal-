'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ThemeTokens } from '@hrms/types';
import { api } from '@/lib/api';
import { companyThemeTokens, type CompanyThemeResponse } from '@/lib/company/queries';
import { useAuthStore, type AuthUser } from '@/store/useAuthStore';
import { rememberWorkspace } from './workspace';

export { loginPathFor, normalizeSlug, rememberedWorkspace, rememberWorkspace } from './workspace';

// ============================================================
// Two sign-in portals:
//   /platform/login  → Super Admins (platform operators)
//   /login           → company users, branded per workspace (?company=slug)
// ============================================================

export type Portal = 'platform' | 'company';

/**
 * Wait for zustand to restore the session from localStorage before guarding.
 * `persist` is undefined during server rendering (no localStorage), so it is
 * only touched inside the effect.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const persist = useAuthStore.persist;
    if (!persist || persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

/** Adds ?next= (or &next=) so sign-in returns to the page that was open. */
export function withNext(path: string, next: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`;
}

/** Only same-site paths, never protocol-relative or absolute URLs. */
export function safeNext(next: string | null, fallback: string): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next;
  return fallback;
}

/** Signs in through the given portal and stores the session. */
export async function signIn(input: {
  email: string;
  password: string;
  portal: Portal;
  companySlug?: string | null;
}): Promise<AuthUser> {
  const res = await api.post('/auth/login', {
    email: input.email,
    password: input.password,
    portal: input.portal,
    ...(input.companySlug ? { companySlug: input.companySlug } : {}),
  });
  const payload = res.data.data;
  const user = payload.user;
  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isSuperAdmin: user.isSuperAdmin,
    companyId: user.companyId,
    status: user.status || 'ACTIVE',
  };
  useAuthStore.getState().setAuth({
    user: authUser,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    companyId: user.companyId,
    permissions: user.permissions || payload.permissions || [],
  });
  if (input.portal === 'company' && input.companySlug) rememberWorkspace(input.companySlug);
  return authUser;
}

// ─── Public workspace lookup ─────────────────────────────────

export interface Workspace {
  companyName: string;
  slug: string;
  branding: {
    displayName: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  } | null;
  theme: CompanyThemeResponse;
}

export function workspaceName(w: Workspace): string {
  return w.branding?.displayName || w.companyName;
}

export function workspaceTokens(w: Workspace | undefined): ThemeTokens | null {
  return w ? companyThemeTokens(w.theme) : null;
}

export function useWorkspace(slug: string | null) {
  return useQuery({
    queryKey: ['workspace', slug],
    queryFn: async () => (await api.get(`/companies/branding/by-slug/${slug}`)).data.data as Workspace,
    enabled: Boolean(slug),
    retry: false,
    staleTime: 5 * 60_000,
  });
}
