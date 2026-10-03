'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { notificationKeys } from '@/lib/notifications';

// ============================================================
// Weekly timesheets (Monday–Sunday). Minutes in the API, hours in the UI.
// ============================================================

export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type Tone = 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'primary';

export const TS_STATUS: Record<TimesheetStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED: { label: 'Waiting for approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Sent back', tone: 'danger' },
};

interface Named {
  id: string;
  firstName: string;
  lastName: string;
}
interface Person {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  designation: { name: string } | null;
}

export interface WeekLine {
  projectId: string | null;
  project?: { id: string; code: string; name: string } | null;
  task: string;
  billable: boolean;
  /** Monday → Sunday */
  minutes: number[];
}

export interface WeekProject {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  role: string;
  allocation: number;
  from: string;
  to: string | null;
}

export interface Week {
  weekStart: string;
  weekEnd: string;
  today: string;
  id: string | null;
  status: TimesheetStatus | null;
  totalMinutes: number;
  employee: Person;
  days: Array<{ date: string; attendedMinutes: number | null; attendance: string | null; future: boolean }>;
  lines: WeekLine[];
  projects: WeekProject[];
  approval: { label: string | null; approvers: Named[]; submittedAt: string | null; decidedBy: Named | null; onBehalfOf: Named | null; decidedAt: string | null; note: string | null } | null;
  isOwn: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canRecall: boolean;
  canDecide: boolean;
  locked: boolean;
}

export interface SheetSummary {
  id: string;
  weekStart: string;
  status: TimesheetStatus;
  totalMinutes: number;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  approverLabel: string | null;
  approvers: Named[];
  decidedBy: Named | null;
  employee: Person;
  canDecide: boolean;
}

export interface ComplianceRow {
  employee: Person & { department: { name: string } | null };
  timesheet: { id: string; status: TimesheetStatus; totalMinutes: number; submittedAt: string | null } | null;
}

export interface HoursReport {
  from: string;
  to: string;
  totalMinutes: number;
  billableMinutes: number;
  byProject: Array<{ project: { id: string; code: string; name: string; clientName: string | null } | null; minutes: number; billableMinutes: number }>;
  byEmployee: Array<{ employee: { id: string; employeeId: string; firstName: string; lastName: string; avatarUrl: string | null }; minutes: number; billableMinutes: number }>;
}

export const timesheetKeys = {
  all: ['timesheets'] as const,
  week: (weekStart: string, employeeId?: string) => ['timesheets', 'week', weekStart, employeeId ?? 'me'] as const,
  list: (q: object) => ['timesheets', 'list', q] as const,
  pending: ['timesheets', 'pending'] as const,
  compliance: (q: object) => ['timesheets', 'compliance', q] as const,
  report: (q: object) => ['timesheets', 'report', q] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
type Page<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } };
const clean = (q: object) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));

export function useWeek(weekStart: string, employeeId?: string, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: timesheetKeys.week(weekStart, employeeId),
    queryFn: async () => unwrap<Week>(await api.get(`/timesheets/weeks/${weekStart}`, { params: employeeId ? { employeeId } : {} })),
    enabled: enabled && hasFeature('work.timesheets'),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export type SheetQuery = { view: 'mine' | 'review' | 'team'; status?: TimesheetStatus; employeeId?: string; from?: string; to?: string; page?: number; limit?: number };
export function useTimesheets(q: SheetQuery, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: timesheetKeys.list(q),
    queryFn: async () => (await api.get('/timesheets', { params: clean(q) })).data as Page<SheetSummary>,
    enabled: enabled && hasFeature('work.timesheets'),
    placeholderData: keepPreviousData,
  });
}

export function usePendingTimesheets() {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: timesheetKeys.pending,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/timesheets/pending-count')).count,
    enabled: hasFeature('work.timesheets'),
    refetchInterval: 2 * 60_000,
  });
}

export function useCompliance(q: { weekStart: string; status?: string; search?: string; page?: number }, enabled = true) {
  return useQuery({
    queryKey: timesheetKeys.compliance(q),
    queryFn: async () => (await api.get('/timesheets/compliance', { params: clean(q) })).data as Page<ComplianceRow>,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useHoursReport(q: { from: string; to: string; projectId?: string; approvedOnly?: 'true' }, enabled = true) {
  return useQuery({
    queryKey: timesheetKeys.report(q),
    queryFn: async () => unwrap<HoursReport>(await api.get('/timesheets/report', { params: clean(q) })),
    enabled,
    placeholderData: keepPreviousData,
  });
}

function useTimesheetMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timesheetKeys.all });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export const useSaveWeek = (weekStart: string) =>
  useTimesheetMutation(async (lines: Array<{ projectId: string | null; task: string; billable: boolean; minutes: number[] }>) => unwrap<Week>(await api.put(`/timesheets/weeks/${weekStart}`, { lines })));
export const useSubmitWeek = (weekStart: string) => useTimesheetMutation(async () => unwrap<Week>(await api.post(`/timesheets/weeks/${weekStart}/submit`)));
export const useRecallWeek = (weekStart: string) => useTimesheetMutation(async () => unwrap<Week>(await api.post(`/timesheets/weeks/${weekStart}/recall`)));
export const useApproveTimesheet = () => useTimesheetMutation(async ({ id, note }: { id: string; note?: string }) => unwrap<unknown>(await api.post(`/timesheets/${id}/approve`, { note: note || null })));
export const useRejectTimesheet = () => useTimesheetMutation(async ({ id, reason }: { id: string; reason: string }) => unwrap<unknown>(await api.post(`/timesheets/${id}/reject`, { reason })));

// ─── Dates & hours ──────────────────────────────────────────

export const addDays = (k: string, n: number) => {
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const mondayOf = (k: string) => addDays(k, -((new Date(`${k}T00:00:00Z`).getUTCDay() + 6) % 7));
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const dayLabel = (k: string) => dayFmt.format(new Date(`${k}T00:00:00Z`));
export const weekLabel = (start: string) => `${shortFmt.format(new Date(`${start}T00:00:00Z`))} – ${shortFmt.format(new Date(`${addDays(start, 6)}T00:00:00Z`))}`;

/** 450 → "7.5" (blank for 0) */
export const toHours = (m: number) => (m ? String(Math.round((m / 60) * 100) / 100) : '');
/** "7.5" / "7:30" → 450; null when invalid */
export function parseHours(v: string): number | null {
  const s = v.trim();
  if (!s) return 0;
  const hm = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 24) return null;
  return Math.round(n * 60);
}
/** 450 → "7h 30m" */
export const fmtHours = (m: number) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};
