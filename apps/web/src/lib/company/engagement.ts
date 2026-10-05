'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { notificationKeys } from '@/lib/notifications';

// ============================================================
// Announcements (feed, drafts, scheduling, reach) and kudos.
// ============================================================

export type Audience = 'COMPANY' | 'DEPARTMENTS' | 'LOCATIONS' | 'TEAM';
export type Category = 'policy' | 'event' | 'celebrate' | 'update' | 'urgent';
export type Cover = 'indigo' | 'teal' | 'sunset' | 'sky' | 'rose' | 'slate';
export type Rsvp = 'going' | 'maybe' | 'no';
export type CoverMotion = 'off' | 'gentle' | 'lively';
export interface Face {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  departmentIds: string[];
  locationIds: string[];
  teamManagerId: string | null;
  pinned: boolean;
  requiresAck: boolean;
  ackDueAt: string | null;
  sendEmail: boolean;
  expiresAt: string | null;
  publishedAt: string;
  updatedAt: string;
  status: 'draft' | 'scheduled' | 'published';
  notifiedAt: string | null;
  category: Category;
  cover: Cover | null;
  coverEmoji: string | null;
  coverScene: string | null;
  coverArt: string | null;
  coverMotion: CoverMotion;
  coverMediaUrl: string | null;
  coverMediaKind: 'image' | 'video' | 'lottie' | null;
  coverFocusX: number;
  coverFocusY: number;
  coverDim: number;
  allowReactions: boolean;
  eventAt: string | null;
  eventPlace: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  author: { id: string; firstName: string; lastName: string; avatarUrl: string | null; title: string | null } | null;
  reactions: Reaction[];
  rsvp: { going: number; maybe: number; mine: Rsvp | null };
  readAt: string | null;
  acknowledgedAt: string | null;
  expired: boolean;
  isMine: boolean;
  canEdit: boolean;
  canPin: boolean;
  stats?: { audience: number; read: number; acknowledged: number } | null;
  /** Events: first faces of who's going */
  goingFaces?: Face[];
  /** Posts that ask to confirm: share of the audience that did */
  confirmedPct?: number | null;
  /** Detail only */
  seen?: { count: number; faces: Face[] };
  related?: Array<Pick<Announcement, 'id' | 'title' | 'category' | 'cover' | 'coverEmoji' | 'coverArt' | 'coverMediaUrl' | 'coverMediaKind' | 'publishedAt'>>;
}

export interface AnnouncementsMeta {
  unread: number;
  needsAck: number;
  drafts: number;
  canPost: boolean;
  canPostCompany: boolean;
  canPin: boolean;
}

export interface AnnouncementReport {
  id: string;
  requiresAck: boolean;
  ackDueAt: string | null;
  lastNudgedAt: string | null;
  sendEmail: boolean;
  total: number;
  read: number;
  acknowledged: number;
  people: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    employee: { id: string; employeeId: string; avatarUrl: string | null; department: { id: string; name: string } | null } | null;
    readAt: string | null;
    acknowledgedAt: string | null;
    rsvp: Rsvp | null;
  }>;
}

export interface AnnouncementsOverview {
  toConfirm: Array<{ id: string; title: string; category: Category; coverEmoji: string | null; ackDueAt: string | null; publishedAt: string }>;
  events: Array<{ id: string; title: string; category: Category; coverEmoji: string | null; eventAt: string; eventPlace: string | null; going: number; mine: Rsvp | null }>;
  mine: { posts: number; avgReadPct: number | null; avgConfirmPct: number | null; lagging: { id: string; title: string; waiting: number } | null } | null;
  reading: { total: number; read: number; streak: number; allConfirmed: boolean };
  mostLoved: Array<{ id: string; title: string; category: Category; coverEmoji: string | null; reactions: number }>;
  documents: Array<{ id: string; title: string; attachmentName: string; attachmentMime: string | null; publishedAt: string }>;
  featured: Announcement[];
}

export interface AudiencePreview {
  count: number;
  emailable: number;
  sample: Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null }>;
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
  reactions: Reaction[];
  thanks: { count: number; mine: boolean; names: string[] };
  canThank: boolean;
  canRemove: boolean;
}

export interface KudosInsights {
  months: number;
  from: string;
  sent: number;
  previous: number;
  headcount: number;
  peopleThanked: number;
  givers: number;
  monthly: Array<{ month: string; count: number }>;
  values: Array<{ value: { id: string; name: string; emoji: string; color: string } | null; count: number }>;
  matrix: { departments: Array<{ id: string; name: string }>; counts: number[][] };
  notThanked: Array<{
    employee: { id: string; employeeId: string; firstName: string; lastName: string; avatarUrl: string | null; designation: { name: string } | null };
    department: string | null;
    joiningDate: string;
    lastKudosAt: string | null;
    manager: { id: string; name: string } | null;
  }>;
}

export const KUDOS_REACTIONS = ['👏', '🎉', '❤️', '🔥', '🙌'];
export const ANNOUNCEMENT_REACTIONS = ['👍', '❤️', '🎉', '🙏', '👏', '👋'];

export const engageKeys = {
  announcements: ['announcements'] as const,
  announcementList: (q: object) => ['announcements', 'list', q] as const,
  announcement: (id: string) => ['announcements', 'detail', id] as const,
  report: (id: string) => ['announcements', 'report', id] as const,
  overview: ['announcements', 'overview'] as const,
  audience: (q: object) => ['announcements', 'audience', q] as const,
  kudos: ['kudos'] as const,
  feed: (q: object) => ['kudos', 'feed', q] as const,
  values: (all: boolean) => ['kudos', 'values', all] as const,
  stats: (employeeId: string) => ['kudos', 'stats', employeeId] as const,
  leaderboard: ['kudos', 'leaderboard'] as const,
  mine: ['kudos', 'me'] as const,
  suggestions: ['kudos', 'suggestions'] as const,
  insights: (months: number) => ['kudos', 'insights', months] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
type Page<T, M = object> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } & M };

// ─── Announcements ──────────────────────────────────────────

export interface AnnouncementsQuery {
  filter?: 'all' | 'unread' | 'ack';
  view?: 'feed' | 'drafts';
  category?: Category;
  search?: string;
  includeExpired?: boolean;
  page?: number;
  limit?: number;
}

export function useAnnouncements(q: AnnouncementsQuery, enabled = true) {
  const { hasFeature, can } = useAccess();
  return useQuery({
    queryKey: engageKeys.announcementList(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== false && v !== '' && v !== 'all' && v !== 'feed'));
      return (await api.get('/announcements', { params })).data as Page<Announcement, AnnouncementsMeta>;
    },
    placeholderData: keepPreviousData,
    enabled: enabled && hasFeature('engage.announcements') && can('announcement.view'),
  });
}

export function useAnnouncementsOverview(enabled = true) {
  return useQuery({ queryKey: engageKeys.overview, queryFn: async () => unwrap<AnnouncementsOverview>(await api.get('/announcements/overview')), enabled });
}

export function useAnnouncement(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: engageKeys.announcement(id ?? ''),
    queryFn: async () => {
      const a = unwrap<Announcement>(await api.get(`/announcements/${id}`));
      // Opening marks it read → refresh counts
      void qc.invalidateQueries({ queryKey: ['announcements', 'list'] });
      void qc.invalidateQueries({ queryKey: engageKeys.overview });
      return a;
    },
    enabled: Boolean(id),
    retry: false,
  });
}

export function useAnnouncementReport(id: string | undefined, enabled = true) {
  return useQuery({ queryKey: engageKeys.report(id ?? ''), queryFn: async () => unwrap<AnnouncementReport>(await api.get(`/announcements/${id}/report`)), enabled: Boolean(id) && enabled });
}

/** How many people a post would reach (live, while writing). */
export function useAudiencePreview(q: { audience: Audience; departmentIds: string[]; locationIds: string[] }, enabled = true) {
  return useQuery({
    queryKey: engageKeys.audience(q),
    queryFn: async () => unwrap<AudiencePreview>(await api.post('/announcements/audience', q)),
    enabled: enabled && (q.audience !== 'DEPARTMENTS' || q.departmentIds.length > 0) && (q.audience !== 'LOCATIONS' || q.locationIds.length > 0),
    placeholderData: keepPreviousData,
    retry: false,
  });
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
  category: Category;
  cover: Cover | null;
  coverEmoji: string | null;
  coverScene: string | null;
  coverArt: string | null;
  coverMotion: CoverMotion;
  coverFocusX: number;
  coverFocusY: number;
  coverDim: number;
  pinned: boolean;
  requiresAck: boolean;
  ackDueAt: string | null;
  sendEmail: boolean;
  allowReactions: boolean;
  eventAt: string | null;
  eventPlace: string | null;
  expiresAt: string | null;
  action: 'publish' | 'draft' | 'schedule';
  publishAt: string | null;
};

export const useSaveAnnouncement = () =>
  useEngageMutation(
    async ({ id, file, coverFile, removeCover, ...body }: AnnouncementInput & { id?: string; file?: File | null; coverFile?: File | null; removeCover?: boolean }) => {
      const a = unwrap<Announcement>(id ? await api.patch(`/announcements/${id}`, body) : await api.post('/announcements', body));
      if (coverFile) {
        const form = new FormData();
        form.append('file', coverFile);
        await api.post(`/announcements/${a.id}/cover`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else if (removeCover) {
        await api.delete(`/announcements/${a.id}/cover`);
      }
      if (file) {
        const form = new FormData();
        form.append('file', file);
        await api.post(`/announcements/${a.id}/attachment`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return a;
    },
    [engageKeys.announcements],
  );

/** Posts scrolled into view count as read — batched, quietly. */
export function useMarkSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => unwrap<{ seen: number }>(await api.post('/announcements/seen', { ids })),
    onSuccess: (r, ids) => {
      if (!r.seen) return;
      const now = new Date().toISOString();
      qc.setQueriesData<Page<Announcement, AnnouncementsMeta>>({ queryKey: ['announcements', 'list'] }, (old) =>
        old ? { ...old, data: old.data.map((a) => (ids.includes(a.id) && !a.readAt ? { ...a, readAt: now } : a)), meta: { ...old.meta, unread: Math.max(0, old.meta.unread - r.seen) } } : old,
      );
      void qc.invalidateQueries({ queryKey: engageKeys.overview });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
export const useReadAll = () => useEngageMutation(async () => unwrap<{ read: number }>(await api.post('/announcements/read-all')), [engageKeys.announcements]);

export const useDeleteAnnouncement = () => useEngageMutation(async (id: string) => unwrap(await api.delete(`/announcements/${id}`)), [engageKeys.announcements]);
export const useRemoveAttachment = () => useEngageMutation(async (id: string) => unwrap(await api.delete(`/announcements/${id}/attachment`)), [engageKeys.announcements]);
export const useAcknowledge = () => useEngageMutation(async (id: string) => unwrap<Announcement>(await api.post(`/announcements/${id}/acknowledge`)), [engageKeys.announcements]);
export const usePinAnnouncement = () =>
  useEngageMutation(async ({ id, pinned }: { id: string; pinned: boolean }) => unwrap(await api.put(`/announcements/${id}/pin`, { pinned })), [engageKeys.announcements]);
export const useNudge = () =>
  useEngageMutation(async (id: string) => unwrap<{ id: string; nudged: number }>(await api.post(`/announcements/${id}/nudge`)), [engageKeys.announcements]);

/** Reactions / RSVP: update the cached post in place. */
function useSocial<V>(fn: (v: V) => Promise<{ id: string; reactions: Reaction[]; rsvp: Announcement['rsvp'] }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (s) => {
      const patch = (a: Announcement) => (a.id === s.id ? { ...a, reactions: s.reactions, rsvp: s.rsvp } : a);
      qc.setQueriesData<Page<Announcement, AnnouncementsMeta>>({ queryKey: ['announcements', 'list'] }, (old) => (old ? { ...old, data: old.data.map(patch) } : old));
      qc.setQueryData<Announcement>(engageKeys.announcement(s.id), (old) => (old ? patch(old) : old));
      void qc.invalidateQueries({ queryKey: engageKeys.overview });
    },
  });
}
export const useReactAnnouncement = () =>
  useSocial(async ({ id, emoji }: { id: string; emoji: string }) => unwrap<{ id: string; reactions: Reaction[]; rsvp: Announcement['rsvp'] }>(await api.post(`/announcements/${id}/reactions`, { emoji })));
export const useRsvp = () =>
  useSocial(async ({ id, response }: { id: string; response: Rsvp | null }) => unwrap<{ id: string; reactions: Reaction[]; rsvp: Announcement['rsvp'] }>(await api.put(`/announcements/${id}/rsvp`, { response })));

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

export type KudosFilter = 'all' | 'for-me' | 'from-me' | 'team';

export function useKudosFeed(q: { employeeId?: string; filter?: KudosFilter; valueId?: string; page?: number; limit?: number }, enabled = true) {
  const { hasFeature, can } = useAccess();
  return useQuery({
    queryKey: engageKeys.feed(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'));
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

export const useKudosLeaderboard = (enabled = true) =>
  useQuery({
    queryKey: engageKeys.leaderboard,
    queryFn: async () => unwrap<{ month: string; people: Array<{ employee: Person & { id: string }; count: number; topValue: { emoji: string; name: string; color: string } | null }> }>(await api.get('/kudos/leaderboard')),
    enabled,
  });

export const useMyKudos = (enabled = true) =>
  useQuery({
    queryKey: engageKeys.mine,
    queryFn: async () => unwrap<{ received: number; given: number; thisMonth: number; values: Array<{ value: { id: string; name: string; emoji: string; color: string }; count: number }> }>(await api.get('/kudos/me')),
    enabled,
  });

export const useKudosSuggestions = (enabled = true) =>
  useQuery({
    queryKey: engageKeys.suggestions,
    queryFn: async () => unwrap<Array<{ employee: Person & { id: string }; reason: string }>>(await api.get('/kudos/suggestions')),
    enabled,
  });

export const useKudosInsights = (months: number, enabled = true) =>
  useQuery({ queryKey: engageKeys.insights(months), queryFn: async () => unwrap<KudosInsights>(await api.get('/kudos/insights', { params: { months } })), enabled, placeholderData: keepPreviousData });

export const useHintManagers = () =>
  useEngageMutation(async (employeeIds: string[]) => unwrap<{ hinted: number; skipped: string[] }>(await api.post('/kudos/insights/hint', { employeeIds })), []);

export const useGiveKudos = () =>
  useEngageMutation(async (body: { recipientIds: string[]; message: string; valueId?: string | null }) => unwrap<KudosItem>(await api.post('/kudos', body)), [engageKeys.kudos]);

export const useReact = () =>
  useEngageMutation(async ({ id, emoji }: { id: string; emoji: string }) => unwrap<KudosItem>(await api.post(`/kudos/${id}/reactions`, { emoji })), [engageKeys.kudos]);

export const useThankKudos = () => useEngageMutation(async (id: string) => unwrap<KudosItem>(await api.post(`/kudos/${id}/thanks`)), [engageKeys.kudos]);

export const useRemoveKudos = () => useEngageMutation(async (id: string) => unwrap(await api.delete(`/kudos/${id}`)), [engageKeys.kudos]);

export const useSaveKudosValue = () =>
  useEngageMutation(
    async ({ id, ...body }: Omit<KudosValue, 'id'> & { id?: string }) => unwrap<KudosValue>(id ? await api.patch(`/kudos/values/${id}`, body) : await api.post('/kudos/values', body)),
    [engageKeys.kudos],
  );
