'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

// ============================================================
// The signed-in user's notification inbox.
// ============================================================

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  data: AppNotification[];
  meta: { total: number; page: number; limit: number; totalPages: number; unread: number };
}

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  list: (q: object) => ['notifications', 'list', q] as const,
};

/** Unread count for the bell; polls every minute and on window focus. */
export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: async () => ((await api.get('/notifications/unread-count')).data.data as { count: number }).count,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications(q: { unreadOnly?: boolean; page?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(q),
    queryFn: async () => (await api.get('/notifications', { params: q })).data as NotificationPage,
    placeholderData: keepPreviousData,
    enabled,
  });
}

function useInboxMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export const useMarkRead = () => useInboxMutation(async (id: string) => api.post(`/notifications/${id}/read`));
export const useMarkAllRead = () => useInboxMutation(async () => api.post('/notifications/read-all'));

/** Icon + colour per notification family. */
export function notificationKind(type: string): 'leave' | 'attendance' | 'delegation' | 'announcement' | 'kudos' | 'other' {
  if (type.startsWith('announcement.')) return 'announcement';
  if (type.startsWith('kudos.')) return 'kudos';
  if (type.startsWith('leave.')) return 'leave';
  if (type.startsWith('attendance.')) return 'attendance';
  if (type.startsWith('delegation.')) return 'delegation';
  return 'other';
}
