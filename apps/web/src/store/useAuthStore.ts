import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  companyId: string | null;
  status: string;
  /** Signed in with a temporary password: must choose a new one before using the portal */
  mustChangePassword?: boolean;
  avatarUrl?: string | null;
}

export interface TenantBranding {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyNameDisplay?: string;
}

/**
 * The only thing kept in localStorage: who was signed in on this browser, for
 * display (pre-paint settings, "welcome back"). Never used to decide access —
 * editing it changes nothing.
 */
export interface SavedProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

interface AuthState {
  /**
   * The signed-in person as the SERVER reports it (sign-in or /auth/me on page
   * load). Held in memory only, so it can't be edited in DevTools storage.
   */
  user: AuthUser | null;
  /** Access token (15 min) — memory only. The refresh token is an httpOnly cookie the page never sees. */
  accessToken: string | null;
  companyId: string | null;
  permissions: string[];
  branding: TenantBranding | null;
  /** True once the server has confirmed the session (this page load) */
  isAuthenticated: boolean;

  /** Saved hints (localStorage) */
  profile: SavedProfile | null;
  /** This browser had a session last time — worth trying the refresh cookie on load */
  signedIn: boolean;

  setAuth: (payload: { user: AuthUser; accessToken: string; companyId?: string | null; permissions?: string[] }) => void;
  setAccessToken: (accessToken: string) => void;
  /** Merge changes into the signed-in person (name, photo) */
  updateUser: (patch: Partial<AuthUser>) => void;
  setBranding: (branding: TenantBranding | null) => void;
  /** Ends the session here and on the server (revokes the refresh cookie). */
  logout: () => void;
  /** Forgets the session in this tab only (the server already ended it). */
  clearSession: () => void;
  hasPermission: (permission: string) => boolean;
}

const profileOf = (u: AuthUser): SavedProfile => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl ?? null });

const SIGNED_OUT = {
  user: null,
  accessToken: null,
  companyId: null,
  permissions: [],
  branding: null,
  isAuthenticated: false,
  profile: null,
  signedIn: false,
} satisfies Partial<AuthState>;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...SIGNED_OUT,

      setAuth: ({ user, accessToken, companyId = null, permissions = [] }) => {
        set({
          user,
          accessToken,
          companyId: companyId ?? user.companyId,
          permissions,
          isAuthenticated: true,
          profile: profileOf(user),
          signedIn: true,
        });
      },

      setAccessToken: (accessToken) => set({ accessToken }),

      updateUser: (patch) => {
        const user = get().user;
        if (!user) return;
        const next = { ...user, ...patch };
        set({ user: next, profile: profileOf(next) });
      },

      setBranding: (branding) => {
        set({ branding });

        // Apply CSS custom property dynamically if primaryColor provided
        if (typeof document !== 'undefined' && branding?.primaryColor) {
          document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
        }
        if (typeof document !== 'undefined' && branding?.secondaryColor) {
          document.documentElement.style.setProperty('--brand-secondary', branding.secondaryColor);
        }
      },

      logout: () => {
        // Revoke the session server-side (best effort, fire-and-forget). The
        // cookie goes along by itself. Plain fetch — importing lib/api here
        // would create a circular import.
        if (typeof window !== 'undefined' && get().signedIn) {
          fetch(`${authApiBase()}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-HRMS-CSRF': '1' },
            keepalive: true,
          }).catch(() => undefined);
        }
        set(SIGNED_OUT);
      },

      clearSession: () => set(SIGNED_OUT),

      hasPermission: (permission: string) => {
        const { user, permissions } = get();
        if (user?.isSuperAdmin) return true;
        return permissions.includes(permission);
      },
    }),
    {
      name: 'hrms-auth-storage',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Nothing that decides access is saved — no tokens, roles, flags or company
      partialize: (state) => ({ profile: state.profile, signedIn: state.signedIn }),
      // Older versions saved the whole session (tokens included): keep only the display hints
      migrate: (old) => {
        const o = (old ?? {}) as { user?: AuthUser | null; isAuthenticated?: boolean; profile?: SavedProfile | null; signedIn?: boolean };
        const u = o.profile ?? o.user ?? null;
        return {
          profile: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl ?? null } : null,
          signedIn: Boolean(o.signedIn ?? o.isAuthenticated),
        };
      },
      // Saved values may only fill the hints, never the session itself
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { profile?: SavedProfile | null; signedIn?: boolean };
        const profile = p.profile && typeof p.profile.id === 'string' ? p.profile : null;
        return { ...current, profile, signedIn: p.signedIn === true };
      },
    },
  ),
);

/** API base for the store's own fetch (same rule as lib/api — see apiBaseUrl there). */
function authApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';
  return sameLoopbackHost(base);
}

/**
 * In development the web app and API both run on this machine. "localhost" and
 * "127.0.0.1" are different sites to the browser, so the refresh cookie would
 * not be sent if they were mixed — use whichever name the page was opened with.
 */
export function sameLoopbackHost(url: string): string {
  if (typeof window === 'undefined') return url;
  const loopback = ['localhost', '127.0.0.1'];
  try {
    const u = new URL(url);
    const here = window.location.hostname;
    if (loopback.includes(u.hostname) && loopback.includes(here) && u.hostname !== here) {
      u.hostname = here;
      return u.toString().replace(/\/$/, '');
    }
  } catch {
    /* not a URL — leave it */
  }
  return url;
}
