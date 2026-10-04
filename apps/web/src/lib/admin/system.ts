'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { adminKeys } from '@/lib/admin/queries';

// ============================================================
// Super Admin → System: health history, traffic, data & delivery,
// readiness, sign-in safety, maintenance mode and tools.
// ============================================================

export type ServiceKey = 'database' | 'email' | 'redis' | 'elasticsearch';

export interface HealthHistory {
  days: Array<{ day: string; checks: number; uptime: number | null }>;
  uptime: number | null;
  checks: number;
  firstCheck: string | null;
  lastProblem: string | null;
  incidents: Array<{ service: ServiceKey; label: string; from: string; to: string | null; minutes: number }>;
  latency: Record<ServiceKey, number[]>;
}

export interface Traffic {
  since: string;
  minutes: Array<{ at: string; requests: number; p95: number; errors: number }>;
  lastHour: { requests: number; perMinute: number; p95: number; p50: number; serverErrors: number; clientErrors: number; errorRate: number };
  activeUsers: number;
  activeCompanies: number;
  slowest: Array<{ method: string; route: string; calls: number; p95: number; p50: number; serverErrors: number }>;
  recentErrors: Array<{ at: string; method: string; route: string; status: number; ms: number }>;
}

export interface TimelineItem {
  at: string;
  kind: 'started' | 'updated' | 'maintenance_on' | 'maintenance_off' | 'caches_cleared' | 'incident' | 'incident_open' | string;
  title: string;
  detail: string | null;
}

export interface DatabaseInfo {
  version: string | null;
  sizeBytes: number;
  connections: { used: number; max: number };
  latestMigration: { name: string; appliedAt: string } | null;
  tables: Array<{ name: string; rows: number; bytes: number }>;
}

export interface StorageInfo {
  driver: string;
  files: number | null;
  bytes: number | null;
  disk: { freeBytes: number; totalBytes: number } | null;
  addedThisWeekBytes: number;
  byCompany: Array<{ id: string; name: string; bytes: number; files: number }>;
}

export interface QueueInfo {
  enabled: boolean;
  counts: { waiting: number; active: number; failed: number; completed: number } | null;
}

export interface EmailLogRow {
  id: string;
  to: string;
  subject: string;
  status: 'SENT' | 'FAILED';
  error: string | null;
  provider: string;
  durationMs: number | null;
  createdAt: string;
  retriedAt: string | null;
  company: { id: string; name: string | null } | null;
  canRetry: boolean;
}

export interface EmailLog {
  stats: { sentToday: number; failedToday: number; failedWeek: number; avgMs: number };
  data: EmailLogRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface Readiness {
  done: number;
  total: number;
  checks: Array<{ key: string; ok: boolean; level: 'bad' | 'warn'; title: string; detail: string }>;
}

export interface SignIns {
  successful: number;
  failed: number;
  locked: Array<{ id: string; email: string; firstName: string; lastName: string; lockedUntil: string; loginAttempts: number; company: { id: string; name: string } | null }>;
}

export interface Maintenance {
  enabled: boolean;
  title: string;
  message: string;
  startsAt: string | null;
  endsAt: string | null;
  announce: boolean;
}

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
const k = (...parts: string[]) => [...adminKeys.all, 'system-x', ...parts] as const;

const q = <T,>(path: string, key: string[], refetchInterval?: number) => ({
  queryKey: k(...key),
  queryFn: async () => unwrap<T>(await api.get(path)),
  refetchInterval,
});

export const useHealthHistory = () => useQuery(q<HealthHistory>('/admin/system/health-history', ['history'], 60_000));
export const useTraffic = () => useQuery(q<Traffic>('/admin/system/traffic', ['traffic'], 15_000));
export const useTimeline = () => useQuery(q<TimelineItem[]>('/admin/system/timeline', ['timeline'], 60_000));
export const useDatabaseInfo = () => useQuery(q<DatabaseInfo>('/admin/system/database', ['database'], 60_000));
export const useStorageInfo = () => useQuery(q<StorageInfo>('/admin/system/storage', ['storage'], 5 * 60_000));
export const useQueueInfo = () => useQuery(q<QueueInfo>('/admin/system/queue', ['queue'], 15_000));
export const useReadiness = () => useQuery(q<Readiness>('/admin/system/readiness', ['readiness']));
export const useSignIns = () => useQuery(q<SignIns>('/admin/system/sign-ins', ['sign-ins'], 60_000));
export const useMaintenance = () => useQuery(q<Maintenance>('/admin/system/maintenance', ['maintenance']));

export function useEmailLog(query: { status?: 'SENT' | 'FAILED'; page: number }) {
  return useQuery({
    queryKey: k('emails', query.status ?? 'all', String(query.page)),
    queryFn: async () => {
      // The list is { stats, data, meta } inside the usual envelope
      const r = await api.get('/admin/system/emails', { params: { ...query, limit: 8 } });
      return r.data.data as EmailLog;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

function useSystemMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: k() });
      void qc.invalidateQueries({ queryKey: adminKeys.system() });
    },
  });
}

export const useCheckNow = () => useSystemMutation(async () => unwrap<{ ok: boolean }>(await api.post('/admin/system/check')));
export const useRetryEmail = () => useSystemMutation(async (id: string) => unwrap<{ to: string }>(await api.post(`/admin/system/emails/${id}/retry`)));
export const useUnlockUser = () => useSystemMutation(async (id: string) => unwrap<{ email: string }>(await api.post(`/admin/system/users/${id}/unlock`)));
export const useSaveMaintenance = () => useSystemMutation(async (body: Partial<Maintenance>) => unwrap<Maintenance>(await api.put('/admin/system/maintenance', body)));
export const useClearCaches = () => useSystemMutation(async () => unwrap<{ cleared: boolean }>(await api.post('/admin/system/caches/clear')));

/** Saves the diagnostics bundle as a JSON file. */
export async function downloadDiagnostics() {
  const data = unwrap<unknown>(await api.get('/admin/system/diagnostics'));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hrms-diagnostics-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** "1.2 GB" */
export function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
