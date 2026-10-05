import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { loginPathFor } from '@/lib/auth/workspace';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
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

// ─── Response Interceptor (Token Refresh & Error Handling) ───
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });

  failedQueue = [];
};

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

    // Only attempt refresh on 401 Unauthorized errors for non-auth endpoints
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { refreshToken, setTokens, logout, user } = useAuthStore.getState();
      // Decided before logout() clears the user
      const signInPath = loginPathFor(user);

      if (!refreshToken) {
        isRefreshing = false;
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = signInPath;
        }
        return Promise.reject(error);
      }

      try {
        // API contract (snake_case): body { refresh_token } → { data: { access_token, refresh_token } }
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccessToken: string = data.data.access_token;
        const newRefreshToken: string = data.data.refresh_token;

        setTokens(newAccessToken, newRefreshToken);
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = signInPath;
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
