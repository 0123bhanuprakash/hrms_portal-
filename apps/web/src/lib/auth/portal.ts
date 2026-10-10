'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { BackdropLevel, BackdropPack, ThemeTokens } from '@hrms/types';
import { api, refreshAccessToken } from '@/lib/api';
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

let verifying: Promise<void> | null = null;

/** Who the server says is signed in — the only source the portals trust. */
function applyServerUser(me: { id: string; email: string; firstName: string; lastName: string; isSuperAdmin: boolean; companyId: string | null; mustChangePassword?: boolean; permissions?: string[] }) {
  const store = useAuthStore.getState();
  store.setAuth({
    user: {
      id: me.id,
      email: me.email,
      firstName: me.firstName,
      lastName: me.lastName,
      isSuperAdmin: me.isSuperAdmin,
      companyId: me.companyId,
      status: 'ACTIVE',
      mustChangePassword: Boolean(me.mustChangePassword),
      avatarUrl: store.profile?.id === me.id ? store.profile.avatarUrl : null,
    },
    accessToken: store.accessToken!,
    companyId: me.companyId,
    permissions: me.permissions ?? [],
  });
}

/** Signed claims of the access token the server just gave us (memory, not storage). */
function tokenClaims(token: string): { sub: string; email: string; is_super_admin: boolean; company_id: string | null } | null {
  try {
    const part = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
}

/**
 * Once per page load: turn the refresh cookie into an access token and ask the
 * server who this is (/auth/me). Nothing from localStorage decides access, so
 * editing it in DevTools changes nothing — the server's answer replaces it.
 */
export function verifySession(): Promise<void> {
  verifying ??= (async () => {
    for (let attempt = 0; ; attempt++) {
      const store = useAuthStore.getState();
      // Signed in during this page load, or no session to restore
      if (store.isAuthenticated || !store.signedIn) return;
      try {
        if (!store.accessToken) await refreshAccessToken();
        const { data } = await api.get('/auth/me');
        applyServerUser(data.data);
        return;
      } catch (err) {
        if (isAxiosError(err) && err.response) {
          const token = useAuthStore.getState().accessToken;
          const claims = token ? tokenClaims(token) : null;
          if (err.response.status === 503) {
            // Maintenance: the session is real (the server just issued the token) — the portal shows the maintenance screen
            if (claims) {
              const p = useAuthStore.getState().profile;
              applyServerUser({ id: claims.sub, email: claims.email, firstName: p?.firstName ?? '', lastName: p?.lastName ?? '', isSuperAdmin: claims.is_super_admin, companyId: claims.company_id });
            }
            return;
          }
          // Refused (signed out elsewhere, expired, account paused) — this tab forgets it
          useAuthStore.getState().clearSession();
          return;
        }
        // API unreachable: keep waiting rather than signing the person out
        await new Promise((r) => setTimeout(r, Math.min(15_000, 1_000 * 2 ** attempt)));
      }
    }
  })();
  return verifying;
}

/**
 * Ready to guard a page: saved hints restored AND the session confirmed with
 * the server. Until then the portals show a spinner — never the saved copy.
 */
export function useAuthHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const go = () => void verifySession().finally(() => live && setReady(true));
    const persist = useAuthStore.persist;
    if (!persist || persist.hasHydrated()) go();
    else {
      const stop = persist.onFinishHydration(go);
      return () => {
        live = false;
        stop();
      };
    }
    return () => {
      live = false;
    };
  }, []);
  return ready;
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
    companyId: user.companyId,
    permissions: user.permissions || payload.permissions || [],
  });
  // This page load's session is the one just confirmed by the server
  verifying = Promise.resolve();
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
