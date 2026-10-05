'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

// ============================================================
// Profile & security for the signed-in person (Super Admin console),
// plus the list of platform admins.
// ============================================================

export interface AccountOverview {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    isSuperAdmin: boolean;
    emailVerifiedAt: string | null;
    createdAt: string;
    lastLoginAt: string | null;
    passwordChangedAt: string | null;
  };
  lastSignIn: { at: string; device: string; ipAddress: string | null } | null;
  actions30d: number;
  companiesTouched30d: number;
  activeDevices: number;
  pendingEmail: { email: string; expiresAt: string } | null;
  protection: { notifyNewDevice: boolean; idleTimeoutMinutes: number | null; reauthForRisky: boolean };
}

export interface RecentAction {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string;
  company: { id: string; name: string } | null;
}

export interface SignInRow {
  id: string;
  at: string;
  success: boolean;
  ipAddress: string | null;
  device: string;
  newNetwork: boolean;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  invited: boolean;
}

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
export const accountKeys = {
  all: ['account'] as const,
  overview: ['account', 'overview'] as const,
  actions: ['account', 'actions'] as const,
  signIns: (status?: string) => ['account', 'sign-ins', status ?? 'all'] as const,
  admins: ['admin', 'platform-admins'] as const,
};

export const useAccountOverview = () => useQuery({ queryKey: accountKeys.overview, queryFn: async () => unwrap<AccountOverview>(await api.get('/account/overview')) });
export const useRecentActions = () => useQuery({ queryKey: accountKeys.actions, queryFn: async () => unwrap<RecentAction[]>(await api.get('/account/actions')) });
export const useMySignIns = (status?: 'success' | 'failed') =>
  useQuery({
    queryKey: accountKeys.signIns(status),
    queryFn: async () => unwrap<{ failedFromNewPlaces: number; data: SignInRow[] }>(await api.get('/account/sign-ins', { params: { status, limit: 40 } })),
  });
export const usePlatformAdmins = () => useQuery({ queryKey: accountKeys.admins, queryFn: async () => unwrap<PlatformAdmin[]>(await api.get('/admin/platform-admins')) });

function useAccountMutation<V, R>(fn: (v: V) => Promise<R>, after?: (r: R) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      after?.(r);
      void qc.invalidateQueries({ queryKey: accountKeys.all });
      void qc.invalidateQueries({ queryKey: accountKeys.admins });
      void qc.invalidateQueries({ queryKey: ['me', 'preferences'] });
    },
  });
}

export function useUpdateName() {
  const update = useAuthStore((s) => s.updateUser);
  return useAccountMutation(
    async (body: { firstName: string; lastName: string }) => unwrap<{ firstName: string; lastName: string }>(await api.patch('/users/me', body)),
    (r) => update({ firstName: r.firstName, lastName: r.lastName }),
  );
}

export function useUploadAvatar() {
  const update = useAuthStore((s) => s.updateUser);
  return useAccountMutation(
    async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return unwrap<{ avatarUrl: string | null }>(await api.post('/account/avatar', form));
    },
    (r) => update({ avatarUrl: r.avatarUrl }),
  );
}

export function useRemoveAvatar() {
  const update = useAuthStore((s) => s.updateUser);
  return useAccountMutation(async () => unwrap<{ avatarUrl: null }>(await api.delete('/account/avatar')), () => update({ avatarUrl: null }));
}

export const useRequestEmailChange = () => useAccountMutation(async (body: { email: string; password: string }) => unwrap<{ pendingEmail: string }>(await api.post('/account/email', body)));
export const useCancelEmailChange = () => useAccountMutation(async () => unwrap<{ cancelled: boolean }>(await api.delete('/account/email')));
export const useInviteAdmin = () => useAccountMutation(async (body: { email: string; firstName: string; lastName: string }) => unwrap<{ email: string }>(await api.post('/admin/platform-admins', body)));
export const useRemoveAdmin = () => useAccountMutation(async (id: string) => unwrap<{ email: string }>(await api.delete(`/admin/platform-admins/${id}`)));

/** Confirm the password → a short-lived token the API accepts for risky changes. */
export async function confirmPassword(password: string) {
  return unwrap<{ token: string; expiresAt: string }>(await api.post('/account/reauth', { password }));
}
