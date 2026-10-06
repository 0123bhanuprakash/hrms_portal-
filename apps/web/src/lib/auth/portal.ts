'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { BackdropLevel, BackdropPack, ThemeTokens } from '@hrms/types';
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

let pendingTemporaryPassword: string | null = null;

/** The temporary password just used to sign in (memory only; lost on reload). */
export function getPendingTemporaryPassword(): string | null {
  return pendingTemporaryPassword;
}

export function clearPendingTemporaryPassword(): void {
  pendingTemporaryPassword = null;
}

/** Where a user with a temporary password chooses their own. */
export function changePasswordPath(user: Pick<AuthUser, 'isSuperAdmin'>, next?: string | null): string {
  const base = user.isSuperAdmin ? '/platform/change-password' : '/change-password';
  return next ? withNext(base, next) : base;
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
    mustChangePassword: Boolean(user.mustChangePassword),
  };
  useAuthStore.getState().setAuth({
    user: authUser,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    companyId: user.companyId,
    permissions: user.permissions || payload.permissions || [],
  });
  if (input.portal === 'company' && input.companySlug) rememberWorkspace(input.companySlug);
  // Kept in memory only (never stored) so the change-password screen needn't ask again
  pendingTemporaryPassword = authUser.mustChangePassword ? input.password : null;
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
    tagline?: string | null;
    logoDarkUrl?: string | null;
    signInMessage?: string | null;
    signInBackground?: 'pack' | 'photo' | 'plain';
    signInPhotoUrl?: string | null;
  } | null;
  theme: CompanyThemeResponse;
  /** A seasonal theme that is on today (and shown on the sign-in page) */
  season?: { name: string; emoji: string; colors: { main: string; accent: string; deep: string }; decoration: import('@/lib/company/seasons').Decoration; greeting: string | null } | null;
  /** The company's default page background (older APIs: absent → Signature) */
  backdrop?: { pack: BackdropPack; level: BackdropLevel };
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
    // A missing workspace is final; network blips / API restarts are retried
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 3,
    staleTime: 5 * 60_000,
  });
}
