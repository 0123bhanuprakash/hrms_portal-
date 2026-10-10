import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { sameLoopbackHost, useAuthStore } from '@/store/useAuthStore';
import { loginPathFor } from '@/lib/auth/workspace';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';

/** Where auth calls go — the refresh cookie needs the same site name as the page (dev: localhost vs 127.0.0.1). */
const AUTH_BASE_URL = sameLoopbackHost(API_BASE_URL);

export const api = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Helper to generate a random request ID for tracing
function generateRequestId(): string {
  return 'req_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

// ─── Request Interceptor ──────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();

    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (config.headers && !config.headers['X-Request-ID']) {
      config.headers['X-Request-ID'] = generateRequestId();
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Token refresh ────────────────────────────────────────────
// The refresh token is an httpOnly cookie: this code never sees it, it just
// asks the API for a new access token and the browser sends the cookie along.
let refreshing: Promise<string> | null = null;

/**
 * A new access token from the refresh cookie. One request at a time — in this
 * tab (shared promise) and across tabs (Web Locks): each refresh rotates the
 * cookie, and sending an already-rotated one would look like token theft and
 * end the session everywhere.
 */
export function refreshAccessToken(): Promise<string> {
  refreshing ??= (async () => {
    const run = async () => {
      const { data } = await axios.post(`${AUTH_BASE_URL}/auth/refresh`, null, {
        withCredentials: true,
        headers: { 'X-HRMS-CSRF': '1' },
      });
      const token: string = data.data.access_token;
      useAuthStore.getState().setAccessToken(token);
      return token;
    };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    return locks ? locks.request('hrms-auth-refresh', run) : run();
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Fired when the server reports different access (role edit, feature toggle, reporting change). */
export const ACCESS_CHANGED_EVENT = 'hrms:access-changed';
let lastAccessVersion: string | null = null;

api.interceptors.response.use((response) => {
  const version = response.headers?.['x-access-version'];
  if (typeof version === 'string' && version !== lastAccessVersion) {
    if (lastAccessVersion !== null && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ACCESS_CHANGED_EVENT));
    }
    lastAccessVersion = version;
  }
  return response;
});

/** Asks the person for their password (dialog) and returns a confirm-password token, or null if they cancel. */
type ReauthHandler = () => Promise<{ token: string; expiresAt: string } | null>;
let reauthHandler: ReauthHandler | null = null;
let reauth: { token: string; expires: number } | null = null;
export function setReauthHandler(fn: ReauthHandler | null) {
  reauthHandler = fn;
}

api.interceptors.request.use((config) => {
  if (reauth && reauth.expires > Date.now() + 5_000) config.headers.set('x-reauth', reauth.token);
  return config;
});

/** Fired when the platform is paused for maintenance (company users). */
export const MAINTENANCE_EVENT = 'hrms:maintenance';

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const problem = error.response?.data as { code?: string; detail?: string } | undefined;
    const retryConfig = error.config as (InternalAxiosRequestConfig & { _reauth?: boolean }) | undefined;
    if (error.response?.status === 403 && problem?.code === 'reauth_required' && reauthHandler && retryConfig && !retryConfig._reauth) {
      const result = await reauthHandler();
      if (result) {
        reauth = { token: result.token, expires: new Date(result.expiresAt).getTime() };
        retryConfig._reauth = true;
        retryConfig.headers.set('x-reauth', result.token);
        return api(retryConfig);
      }
    }
    if (error.response?.status === 503 && problem?.code === 'maintenance' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MAINTENANCE_EVENT, { detail: problem.detail ?? '' }));
    }
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // 401 → get a new access token from the refresh cookie and try once more
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      // Nobody signed in on this browser — nothing to refresh, no sign-in page to send them to
      useAuthStore.getState().signedIn
    ) {
      originalRequest._retry = true;
      try {
        const token = await refreshAccessToken();
        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // API unreachable — not a reason to sign anyone out
        if (axios.isAxiosError(refreshError) && !refreshError.response) return Promise.reject(error);
        const { user, clearSession } = useAuthStore.getState();
        // Decided before the session is cleared
        const signInPath = loginPathFor(user);
        // The server already ended the session (and cleared the cookie)
        clearSession();
        if (typeof window !== 'undefined') window.location.href = signInPath;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
