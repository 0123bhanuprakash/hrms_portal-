'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { notificationKeys } from '@/lib/notifications';

// ============================================================
// Announcements (read / acknowledge) and kudos.
// ============================================================

export type Audience = 'COMPANY' | 'DEPARTMENTS' | 'LOCATIONS';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  departmentIds: string[];
  locationIds: string[];
  pinned: boolean;
  requiresAck: boolean;
  sendEmail: boolean;
  expiresAt: string | null;
  publishedAt: string;
  updatedAt: string;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  author: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
  readAt: string | null;
  acknowledgedAt: string | null;
  expired: boolean;
  canEdit: boolean;
  stats?: { audience: number; read: number; acknowledged: number } | null;
}

export interface AnnouncementReport {
  id: string;
  requiresAck: boolean;
  total: number;
  read: number;
  acknowledged: number;
  people: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    employee: { id: string; employeeId: string; avatarUrl: string | null; department: { name: string } | null } | null;
    readAt: string | null;
    acknowledgedAt: string | null;
  }>;
}

export interface KudosValue {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

interface Person {
  id: string | null;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  designation: { name: string } | null;
}

export interface KudosItem {
  id: string;
  message: string;
  createdAt: string;
  from: Person;
  value: { id: string; name: string; emoji: string; color: string } | null;
  recipients: Array<Person & { id: string }>;
  reactions: Array<{ emoji: string; count: number; mine: boolean }>;
  canRemove: boolean;
}

export const KUDOS_REACTIONS = ['👏', '🎉', '❤️', '🔥', '🙌'];

export const engageKeys = {
  announcements: ['announcements'] as const,
  announcementList: (q: object) => ['announcements', 'list', q] as const,
  announcement: (id: string) => ['announcements', 'detail', id] as const,
  report: (id: string) => ['announcements', 'report', id] as const,
  kudos: ['kudos'] as const,
  feed: (q: object) => ['kudos', 'feed', q] as const,
  values: (all: boolean) => ['kudos', 'values', all] as const,
  stats: (employeeId: string) => ['kudos', 'stats', employeeId] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
type Page<T, M = object> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } & M };

// ─── Announcements ──────────────────────────────────────────

export function useAnnouncements(q: { filter?: 'all' | 'unread' | 'ack'; includeExpired?: boolean; page?: number; limit?: number }, enabled = true) {
  const { hasFeature, can } = useAccess();
  return useQuery({
    queryKey: engageKeys.announcementList(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== false && v !== 'all'));
      return (await api.get('/announcements', { params })).data as Page<Announcement, { unread: number; needsAck: number }>;
    },
    placeholderData: keepPreviousData,
    enabled: enabled && hasFeature('engage.announcements') && can('announcement.view'),
  });
}

export function useAnnouncement(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: engageKeys.announcement(id ?? ''),
    queryFn: async () => {
      const a = unwrap<Announcement>(await api.get(`/announcements/${id}`));
      // Opening marks it read → refresh counts
      void qc.invalidateQueries({ queryKey: ['announcements', 'list'] });
      return a;
    },
    enabled: Boolean(id),
    retry: false,
  });
}

export function useAnnouncementReport(id: string | undefined, enabled = true) {
  return useQuery({ queryKey: engageKeys.report(id ?? ''), queryFn: async () => unwrap<AnnouncementReport>(await api.get(`/announcements/${id}/report`)), enabled: Boolean(id) && enabled });
}

function useEngageMutation<V, R>(fn: (v: V) => Promise<R>, keys: ReadonlyArray<readonly unknown[]>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of keys) void qc.invalidateQueries({ queryKey: k });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export type AnnouncementInput = {
  title: string;
  body: string;
  audience: Audience;
  departmentIds: string[];
  locationIds: string[];
  pinned: boolean;
  requiresAck: boolean;
  sendEmail: boolean;
  expiresAt: string | null;
};

export const useSaveAnnouncement = () =>
  useEngageMutation(
    async ({ id, file, ...body }: AnnouncementInput & { id?: string; file?: File | null }) => {
      const a = unwrap<Announcement>(id ? await api.patch(`/announcements/${id}`, body) : await api.post('/announcements', body));
      if (file) {
        const form = new FormData();
        form.append('file', file);
        await api.post(`/announcements/${a.id}/attachment`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return a;
    },
    [engageKeys.announcements],
  );

export const useDeleteAnnouncement = () => useEngageMutation(async (id: string) => unwrap(await api.delete(`/announcements/${id}`)), [engageKeys.announcements]);
export const useRemoveAttachment = () => useEngageMutation(async (id: string) => unwrap(await api.delete(`/announcements/${id}/attachment`)), [engageKeys.announcements]);
export const useAcknowledge = () => useEngageMutation(async (id: string) => unwrap<Announcement>(await api.post(`/announcements/${id}/acknowledge`)), [engageKeys.announcements]);

export async function downloadAnnouncementAttachment(a: Pick<Announcement, 'id' | 'attachmentName'>): Promise<void> {
  const res = await api.get(`/announcements/${a.id}/attachment`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = a.attachmentName ?? 'attachment';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Kudos ──────────────────────────────────────────────────

export function useKudosFeed(q: { employeeId?: string; page?: number; limit?: number }, enabled = true) {
  const { hasFeature, can } = useAccess();
  return useQuery({
    queryKey: engageKeys.feed(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined));
      return (await api.get('/kudos', { params })).data as Page<KudosItem>;
    },
    placeholderData: keepPreviousData,
    enabled: enabled && hasFeature('engage.kudos') && can('kudos.view'),
  });
}

export function useKudosValues(all = false, enabled = true) {
  return useQuery({ queryKey: engageKeys.values(all), queryFn: async () => unwrap<KudosValue[]>(await api.get('/kudos/values', { params: all ? { all: true } : {} })), enabled, staleTime: 5 * 60_000 });
}

export function useKudosStats(employeeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: engageKeys.stats(employeeId ?? ''),
    queryFn: async () => unwrap<{ received: number; given: number; values: Array<{ value: { id: string; name: string; emoji: string; color: string }; count: number }> }>(await api.get(`/kudos/stats/${employeeId}`)),
    enabled: Boolean(employeeId) && enabled,
  });
}

export const useGiveKudos = () =>
  useEngageMutation(async (body: { recipientIds: string[]; message: string; valueId?: string | null }) => unwrap<KudosItem>(await api.post('/kudos', body)), [engageKeys.kudos]);

export const useReact = () =>
  useEngageMutation(async ({ id, emoji }: { id: string; emoji: string }) => unwrap<KudosItem>(await api.post(`/kudos/${id}/reactions`, { emoji })), [engageKeys.kudos]);

export const useRemoveKudos = () => useEngageMutation(async (id: string) => unwrap(await api.delete(`/kudos/${id}`)), [engageKeys.kudos]);

export const useSaveKudosValue = () =>
  useEngageMutation(
    async ({ id, ...body }: Omit<KudosValue, 'id'> & { id?: string }) => unwrap<KudosValue>(id ? await api.patch(`/kudos/values/${id}`, body) : await api.post('/kudos/values', body)),
    [engageKeys.kudos],
  );
