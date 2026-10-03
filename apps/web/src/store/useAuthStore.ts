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
}

export interface TenantBranding {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyNameDisplay?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  companyId: string | null;
  permissions: string[];
  branding: TenantBranding | null;
  isAuthenticated: boolean;

  setAuth: (payload: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    companyId?: string | null;
    permissions?: string[];
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setBranding: (branding: TenantBranding | null) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      companyId: null,
      permissions: [],
      branding: null,
      isAuthenticated: false,

      setAuth: ({ user, accessToken, refreshToken, companyId = null, permissions = [] }) => {
        set({
          user,
          accessToken,
          refreshToken,
          companyId: companyId ?? user.companyId,
          permissions,
          isAuthenticated: true,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
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
        // Revoke the refresh token server-side (best effort, fire-and-forget).
        // Plain fetch — importing lib/api here would create a circular import.
        const { accessToken, refreshToken } = get();
        if (typeof window !== 'undefined' && accessToken && refreshToken) {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';
          fetch(`${apiUrl}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
            keepalive: true,
          }).catch(() => undefined);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          companyId: null,
          permissions: [],
          branding: null,
          isAuthenticated: false,
        });

        if (typeof window !== 'undefined') {
          // Clear cookies or storage if needed
          document.cookie = 'hrms_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }
      },

      hasPermission: (permission: string) => {
        const { user, permissions } = get();
        if (user?.isSuperAdmin) return true;
        return permissions.includes(permission);
      },
    }),
    {
      name: 'hrms-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        companyId: state.companyId,
        permissions: state.permissions,
        branding: state.branding,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
