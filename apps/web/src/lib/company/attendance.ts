'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';

// ============================================================
// Attendance (Phase 3): today, calendar, team, corrections,
// holidays and policy. Times are shown in the company time zone.
// ============================================================

export type DayStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'WEEKEND'
  | 'WORK_FROM_HOME'
  | 'WORKING'
  | 'MISSING_CHECKOUT'
  | 'NOT_CHECKED_IN'
  | 'UPCOMING'
  | 'NOT_JOINED';

export interface AttendancePolicy {
  workDays: number[];
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  halfDayMinutes: number;
  fullDayMinutes: number;
  regularisationWindowDays: number;
  webCheckInEnabled: boolean;
  timeZone: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workingMinutes: number | null;
  lateMinutes: number | null;
  status: DayStatus;
  isManualEntry: boolean;
  notes: string | null;
}

export interface TodayAttendance {
  hasProfile: boolean;
  date: string;
  serverTime: string;
  policy: AttendancePolicy;
  record: AttendanceRecord | null;
  status: DayStatus | null;
  holiday: { name: string } | null;
  leave: DayLeave | null;
}

export interface CalendarDay {
  date: string;
  status: DayStatus;
  checkIn: string | null;
  checkOut: string | null;
  workingMinutes: number | null;
  lateMinutes: number | null;
  isManualEntry: boolean;
  notes: string | null;
  holiday: { name: string; isOptional: boolean } | null;
  correction: { id: string; status: CorrectionStatus } | null;
  leave: DayLeave | null;
}

/** Leave touching a day (approved changes the status; pending is shown as a hint). */
export interface DayLeave {
  name: string;
  code: string;
  color: string;
  status: 'APPROVED' | 'PENDING';
  countsAsPresent: boolean;
  halfDay: boolean;
}

export interface AttendanceSummary {
  present: number;
  halfDay: number;
  absent: number;
  missingCheckout: number;
  onLeave: number;
  workFromHome: number;
  holidays: number;
  late: number;
  averageMinutes: number;
}

export interface PersonLite {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  designation: { name: string } | null;
  department?: { id: string; name: string } | null;
}

export interface CalendarMonth {
  employee: PersonLite & { joiningDate: string };
  month: string;
  today: string;
  policy: AttendancePolicy;
  days: CalendarDay[];
  summary: AttendanceSummary;
}

export interface TeamDay {
  date: string;
  today: string;
  holiday: { name: string } | null;
  counts: AttendanceSummary & { total: number; working: number; notCheckedIn: number };
  data: Array<{
    employee: PersonLite;
    status: DayStatus;
    checkIn: string | null;
    checkOut: string | null;
    workingMinutes: number | null;
    lateMinutes: number | null;
    isManualEntry: boolean;
    leave: DayLeave | null;
  }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Correction {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  reason: string;
  status: CorrectionStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  employee: PersonLite;
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
  onBehalfOf: { id: string; firstName: string; lastName: string } | null;
  current: { checkIn: string | null; checkOut: string | null; status: DayStatus } | null;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  isOptional: boolean;
}

// ─── Presentation ───────────────────────────────────────────

export const STATUS_META: Record<DayStatus, { label: string; short: string; cell: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral' | 'outline' }> = {
  PRESENT: { label: 'Present', short: 'P', cell: 'bg-success-soft text-success', tone: 'success' },
  HALF_DAY: { label: 'Half day', short: 'HD', cell: 'bg-warning-soft text-warning', tone: 'warning' },
  ABSENT: { label: 'Absent', short: 'A', cell: 'bg-destructive-soft text-destructive', tone: 'danger' },
  MISSING_CHECKOUT: { label: 'Missing check-out', short: '!', cell: 'bg-destructive-soft/60 text-destructive ring-1 ring-inset ring-destructive/40', tone: 'danger' },
  ON_LEAVE: { label: 'On leave', short: 'L', cell: 'bg-info-soft text-info', tone: 'info' },
  WORK_FROM_HOME: { label: 'Work from home', short: 'WFH', cell: 'bg-info-soft text-info', tone: 'info' },
  HOLIDAY: { label: 'Holiday', short: 'H', cell: 'bg-primary-soft text-primary-soft-foreground', tone: 'primary' },
  WEEKEND: { label: 'Weekly off', short: 'W', cell: 'bg-muted text-muted-foreground', tone: 'neutral' },
  WORKING: { label: 'Checked in', short: '●', cell: 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/40', tone: 'primary' },
  NOT_CHECKED_IN: { label: 'Not checked in', short: '–', cell: 'ring-1 ring-inset ring-border text-muted-foreground', tone: 'outline' },
  UPCOMING: { label: 'Upcoming', short: '', cell: 'text-muted-foreground', tone: 'neutral' },
  NOT_JOINED: { label: 'Before joining', short: '', cell: 'text-muted-foreground/50', tone: 'neutral' },
};

export const CORRECTION_TONE: Record<CorrectionStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

/** "09:42" in the company time zone. */
export function clock(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** HH:mm (24h) in the company time zone — for form inputs. */
export function hhmm(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function hours(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** "2026-10-02" → "Fri, 2 Oct" */
export function dayLabel(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Keys ───────────────────────────────────────────────────

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: ['attendance', 'today'] as const,
  calendar: (month: string, employeeId?: string) => ['attendance', 'calendar', month, employeeId ?? 'me'] as const,
  team: (q: object) => ['attendance', 'team', q] as const,
  corrections: (q: object) => ['attendance', 'corrections', q] as const,
  pendingCount: ['attendance', 'corrections', 'pending-count'] as const,
  policy: ['attendance', 'policy'] as const,
  holidays: (year: number) => ['holidays', year] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

// ─── Queries ────────────────────────────────────────────────

export function useToday(enabled = true) {
  return useQuery({ queryKey: attendanceKeys.today, queryFn: async () => unwrap<TodayAttendance>(await api.get('/attendance/today')), enabled, refetchInterval: 5 * 60_000 });
}

export function useCalendar(month: string, employeeId?: string) {
  return useQuery({
    queryKey: attendanceKeys.calendar(month, employeeId),
    queryFn: async () => unwrap<CalendarMonth>(await api.get('/attendance/calendar', { params: { month, ...(employeeId && { employeeId }) } })),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useTeamAttendance(q: { date?: string; search?: string; departmentId?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: attendanceKeys.team(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));
      return unwrap<TeamDay>(await api.get('/attendance/team', { params }));
    },
    placeholderData: keepPreviousData,
  });
}

export function useCorrections(q: { view: 'mine' | 'review'; status?: CorrectionStatus; page?: number }, enabled = true) {
  return useQuery({
    queryKey: attendanceKeys.corrections(q),
    queryFn: async () => (await api.get('/attendance/regularisations', { params: q })).data as { data: Correction[]; meta: { total: number; page: number; limit: number; totalPages: number; timeZone: string } },
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Corrections waiting for me — for the nav badge. Covers delegated approvals too. */
export function usePendingCorrections() {
  const { hasFeature } = useAccess();
  // Project leads and line managers approve without a role permission — ask the API
  return useQuery({
    queryKey: attendanceKeys.pendingCount,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/attendance/regularisations/pending-count')).count,
    enabled: hasFeature('time.attendance'),
    refetchInterval: 2 * 60_000,
  });
}

export function usePolicy(enabled = true) {
  return useQuery({ queryKey: attendanceKeys.policy, queryFn: async () => unwrap<AttendancePolicy>(await api.get('/attendance/policy')), enabled });
}

export function useHolidays(year: number, enabled = true) {
  return useQuery({ queryKey: attendanceKeys.holidays(year), queryFn: async () => unwrap<Holiday[]>(await api.get('/holidays', { params: { year } })), enabled });
}

// ─── Mutations ──────────────────────────────────────────────

function useAttendanceMutation<V, R>(fn: (v: V) => Promise<R>, extra: ReadonlyArray<readonly unknown[]> = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: attendanceKeys.all });
      for (const key of extra) void qc.invalidateQueries({ queryKey: key });
    },
  });
}

export const useCheckIn = () => useAttendanceMutation(async () => unwrap<AttendanceRecord>(await api.post('/attendance/check-in')));
export const useCheckOut = () => useAttendanceMutation(async () => unwrap<AttendanceRecord>(await api.post('/attendance/check-out')));

export const useRequestCorrection = () =>
  useAttendanceMutation(async (body: { date: string; checkIn: string; checkOut?: string | null; reason: string }) => unwrap<Correction>(await api.post('/attendance/regularisations', body)));

export const useReviewCorrection = () =>
  useAttendanceMutation(async ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
    unwrap<Correction>(await api.post(`/attendance/regularisations/${id}/${action}`, { note: note || null })),
  );

export const useCancelCorrection = () => useAttendanceMutation(async (id: string) => unwrap<Correction>(await api.post(`/attendance/regularisations/${id}/cancel`)));

export const useUpsertRecord = () =>
  useAttendanceMutation(async (body: { employeeId: string; date: string; checkIn?: string | null; checkOut?: string | null; status?: DayStatus; notes?: string | null }) =>
    unwrap<AttendanceRecord>(await api.put('/attendance/records', body)),
  );

export const useSavePolicy = () =>
  useAttendanceMutation(async (body: Partial<Omit<AttendancePolicy, 'timeZone'>>) => unwrap<AttendancePolicy>(await api.put('/attendance/policy', body)));

export function useSaveHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id?: string; name: string; date: string; isOptional: boolean }) =>
      unwrap<Holiday>(id ? await api.patch(`/holidays/${id}`, body) : await api.post('/holidays', body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['holidays'] });
      void qc.invalidateQueries({ queryKey: attendanceKeys.all });
      void qc.invalidateQueries({ queryKey: ['people', 'spotlight'] });
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap<Holiday>(await api.delete(`/holidays/${id}`)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['holidays'] });
      void qc.invalidateQueries({ queryKey: attendanceKeys.all });
      void qc.invalidateQueries({ queryKey: ['people', 'spotlight'] });
    },
  });
}

/** Month CSV through the API (authorised + audited), saved via a blob link. */
export async function downloadAttendanceCsv(month: string, departmentId?: string): Promise<void> {
  const res = await api.get('/attendance/export', { params: { month, ...(departmentId && { departmentId }) }, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-${month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
