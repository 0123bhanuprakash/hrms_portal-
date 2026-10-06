'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { isLive } from '@/lib/live/socket';
import { useMayApprove } from '@/lib/company/projects';
import { notificationKeys } from '@/lib/notifications';
import type { ProjectType } from '@/lib/company/projects';

// ============================================================
// Timesheets as time blocks (10:00–12:00 on a project + what was done).
// Times are minutes from midnight of the block's day (may pass 1440 at night).
// ============================================================

export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
type Tone = 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'primary';

export const TS_STATUS: Record<TimesheetStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Not sent', tone: 'neutral' },
  SUBMITTED: { label: 'Waiting for approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Sent back', tone: 'danger' },
};

export type DayStatus = 'empty' | 'draft' | 'submitted' | 'approved' | 'back' | 'partial';
export const DAY_STATUS: Record<Exclude<DayStatus, 'empty'>, { label: string; tone: Tone }> = {
  draft: { label: 'Not sent', tone: 'neutral' },
  submitted: { label: 'Waiting', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  back: { label: 'Sent back', tone: 'danger' },
  partial: { label: 'Partly approved', tone: 'warning' },
};

export const WORK_TYPES = ['Development', 'Meeting', 'Review', 'Testing', 'Design', 'Support', 'Learning', 'Admin'] as const;

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

export interface BlockProject {
  id: string;
  code: string;
  name: string;
  color: string | null;
  type: ProjectType;
}

export interface Block {
  id: string;
  date: string;
  /** null on old grid entries (no times) */
  startMin: number | null;
  endMin: number | null;
  minutes: number;
  project: BlockProject | null;
  description: string;
  workType: string | null;
  billable: boolean;
  status: TimesheetStatus;
  approverLabel: string | null;
  approvers: Named[];
  submittedAt: string | null;
  submitNote: string | null;
  decidedBy: Named | null;
  decidedAt: string | null;
  decisionNote: string | null;
  canEdit: boolean;
  canDecide: boolean;
}

export interface WeekDay {
  date: string;
  weekend: boolean;
  holiday: string | null;
  leave: { type: string; halfDay: string | null } | null;
  future: boolean;
  locked: boolean;
  attendance: { checkIn: number | null; checkOut: number | null; open: boolean; workingMinutes: number | null } | null;
  minutes: number;
  status: DayStatus;
  expectedMinutes: number;
}

export interface MyProject {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  color: string | null;
  type: ProjectType;
  billable: boolean;
  role: string;
  allocation: number;
  lead: string | null;
  from: string;
  to: string | null;
  loggedMinutes: number;
  expectedMinutes: number;
}

export interface Week {
  weekStart: string;
  weekEnd: string;
  today: string;
  nowMin: number;
  isOwn: boolean;
  employee: Person;
  days: WeekDay[];
  blocks: Block[];
  totalMinutes: number;
  expectedMinutes: number;
  projects: MyProject[];
  generalMinutes: number;
  unsentDays: number;
}

export interface SubmitPreview {
  scope: 'today' | 'all';
  today: string;
  dates: string[];
  totalMinutes: number;
  blocks: number;
  days: Array<{ date: string; minutes: number; attendedMinutes: number | null; stillIn: boolean; leave: string | null; holiday: string | null; check: 'ok' | 'short' | 'empty' | 'leave' | 'off' | 'sent' }>;
  projects: Array<{ project: BlockProject | null; minutes: number; goesTo: Array<{ label: string; people: Named[] }> }>;
}

export type CellState = 'waiting' | 'back' | 'approved' | 'draft' | 'other' | 'leave' | 'off' | 'future' | 'none';
export interface TeamWeek {
  weekStart: string;
  weekEnd: string;
  today: string;
  people: Array<{
    employee: Person;
    cells: Array<{ date: string; state: CellState; minutes: number; myMinutes: number; waitingBlocks: number }>;
    totalMinutes: number;
    expectedMinutes: number;
    waitingDays: number;
    missingDays: number;
  }>;
  summary: { waitingDays: number; waitingPeople: number; notLogged: number; sentBack: number; totalMinutes: number; billableMinutes: number };
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
  employee: Person;
}

export interface ComplianceRow {
  employee: Person & { department: { name: string } | null };
  timesheet: { id: string; status: TimesheetStatus; totalMinutes: number; submittedAt: string | null } | null;
}

export const timesheetKeys = {
  all: ['timesheets'] as const,
  week: (weekStart: string, employeeId?: string) => ['timesheets', 'week', weekStart, employeeId ?? 'me'] as const,
  preview: (scope: string) => ['timesheets', 'preview', scope] as const,
  team: (weekStart: string) => ['timesheets', 'team', weekStart] as const,
  list: (q: object) => ['timesheets', 'list', q] as const,
  pending: ['timesheets', 'pending'] as const,
  compliance: (q: object) => ['timesheets', 'compliance', q] as const,
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

export function useSubmitPreview(scope: 'today' | 'all', enabled = true) {
  return useQuery({
    queryKey: timesheetKeys.preview(scope),
    queryFn: async () => unwrap<SubmitPreview>(await api.get('/timesheets/submit-preview', { params: { scope } })),
    enabled,
    staleTime: 0,
  });
}

export function useTeamWeek(weekStart: string, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: timesheetKeys.team(weekStart),
    queryFn: async () => unwrap<TeamWeek>(await api.get('/timesheets/team', { params: { weekStart } })),
    enabled: enabled && hasFeature('work.timesheets'),
    placeholderData: keepPreviousData,
  });
}

export type SheetQuery = { view: 'mine' | 'team'; status?: TimesheetStatus; employeeId?: string; from?: string; to?: string; page?: number; limit?: number };
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
  // Only people who can approve here ask; the API would answer 0 for everyone else
  const mayApprove = useMayApprove('timesheet.approve');
  return useQuery({
    queryKey: timesheetKeys.pending,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/timesheets/pending-count')).count,
    enabled: hasFeature('work.timesheets') && mayApprove,
    // Live updates refresh it while connected; poll only when the connection is down
    refetchInterval: () => (isLive() ? false : 2 * 60_000),
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

export interface BlockInput {
  date: string;
  startMin: number;
  endMin: number;
  projectId: string | null;
  description: string;
  workType?: string | null;
}

export const useSaveBlock = () =>
  useTimesheetMutation(async ({ id, ...b }: BlockInput & { id?: string }) => unwrap<Block>(id ? await api.put(`/timesheets/blocks/${id}`, b) : await api.post('/timesheets/blocks', b)));
export const useDeleteBlock = () => useTimesheetMutation(async (id: string) => unwrap<unknown>(await api.delete(`/timesheets/blocks/${id}`)));
export const useCopyDay = () => useTimesheetMutation(async (v: { from: string; to: string }) => unwrap<{ copied: number; skipped: string[] }>(await api.post('/timesheets/copy-day', v)));
export const useSubmitTime = () =>
  useTimesheetMutation(async (v: { scope: 'today' | 'all'; note?: string }) => unwrap<{ sent: number; days: number; dates: string[]; minutes: number }>(await api.post('/timesheets/submit', { scope: v.scope, note: v.note || null })));
export const useRecallTime = () => useTimesheetMutation(async (dates?: string[]) => unwrap<{ recalled: number }>(await api.post('/timesheets/recall', dates ? { dates } : {})));

export interface PickBlocks {
  ids?: string[];
  employeeId?: string;
  employeeIds?: string[];
  dates?: string[];
}
export const useApproveTime = () => useTimesheetMutation(async (v: PickBlocks & { note?: string }) => unwrap<{ decided: number }>(await api.post('/timesheets/approve', v)));
export const useSendBackTime = () => useTimesheetMutation(async (v: PickBlocks & { note: string }) => unwrap<{ decided: number }>(await api.post('/timesheets/send-back', v)));
export const useNudge = () => useTimesheetMutation(async (employeeId: string) => unwrap<{ sent: boolean }>(await api.post(`/timesheets/nudge/${employeeId}`)));

// ─── Dates, times & hours ───────────────────────────────────

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
const longFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const dayLabel = (k: string) => dayFmt.format(new Date(`${k}T00:00:00Z`));
export const longDayLabel = (k: string) => longFmt.format(new Date(`${k}T00:00:00Z`));
export const weekLabel = (start: string) => `${shortFmt.format(new Date(`${start}T00:00:00Z`))} – ${shortFmt.format(new Date(`${addDays(start, 6)}T00:00:00Z`))}`;

/** 630 → "10:30 am"; 1500 → "1:00 am" (next day) */
export function clock(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
/** 630 → "10:30" (for <input type="time">) */
export const toTimeInput = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const fromTimeInput = (v: string): number | null => {
  const r = /^(\d{1,2}):(\d{2})$/.exec(v);
  return r ? Number(r[1]) * 60 + Number(r[2]) : null;
};
/** "2h", "1.5", "1:30", "90m", "45 min" → minutes; null when invalid */
export function parseDuration(v: string): number | null {
  const s = v.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  let r = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  if (r) return Number(r[1]) * 60 + Number(r[2]);
  r = /^(\d+(?:[.,]\d+)?)h(?:(\d{1,2})m?)?$/.exec(s);
  if (r) return Math.round(Number(r[1]!.replace(',', '.')) * 60) + Number(r[2] ?? 0);
  r = /^(\d{1,3})(?:m|min|mins)$/.exec(s);
  if (r) return Number(r[1]);
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 16 ? Math.round(n * 60) : null;
}
/** 450 → "7h 30m" */
export const fmtHours = (m: number) => {
  if (!m) return '0h';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
};
