'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { isLive } from '@/lib/live/socket';
import { useMayApprove } from '@/lib/company/projects';
import { attendanceKeys } from '@/lib/company/attendance';

// ============================================================
// Leave (Phase 4): types, balances, requests, approvals, who's off.
// ============================================================

export type LeaveAccrual = 'UPFRONT' | 'MONTHLY' | 'NONE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
export type HalfDay = 'FIRST_HALF' | 'SECOND_HALF';

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string | null;
  color: string;
  accrual: LeaveAccrual;
  annualQuota: number;
  carryForward: boolean;
  maxCarryForward: number;
  isPaid: boolean;
  allowHalfDay: boolean;
  approvalLevels: number;
  minNoticeDays: number;
  maxConsecutiveDays: number | null;
  includeNonWorkingDays: boolean;
  countsAsPresent: boolean;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null;
  /** Not usable while on probation */
  blockDuringProbation: boolean;
  /** Ask for a document when longer than this many days (null = never) */
  documentAfterDays: number | null;
  /** Weekly offs / holidays between leave days count as leave */
  sandwichRule: boolean;
  /** Days that may be taken in advance */
  negativeBalance: number;
  /** "MM-DD" — carried days not used by then lapse */
  carryExpiry: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface LeaveBalance {
  leaveType: LeaveType;
  balanceId: string;
  allocated: number;
  accrued: number;
  carriedForward: number;
  adjusted: number;
  used: number;
  pending: number;
  /** null = unlimited */
  available: number | null;
  /** Carried days that already expired this year */
  carryExpired?: number;
  /** If nothing more is taken: left on 31 Dec, carried over, lost */
  yearEnd?: { left: number; carry: number; lapse: number } | null;
}

export interface TeamClash {
  teamSize: number;
  overlaps: Array<{ employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null }; startDate: string; endDate: string; leaveType: string; color: string; status: LeaveStatus }>;
}

interface Named {
  id: string;
  firstName: string;
  lastName: string;
}

export interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  halfDay: HalfDay | null;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  currentLevel: number;
  requiredLevels: number;
  createdAt: string;
  decidedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  employee: { id: string; employeeId: string; firstName: string; lastName: string; avatarUrl: string | null; designation: { name: string } | null; department: { id: string; name: string } | null };
  leaveType: { id: string; name: string; code: string; color: string; countsAsPresent: boolean; isPaid: boolean; documentAfterDays?: number | null };
  document?: { name: string; size: number | null; mime: string | null } | null;
  /** The type asks for a document and none is attached yet */
  needsDocument?: boolean;
  /** Approvers: teammates off at the same time */
  team?: TeamClash;
  approvals: Array<{
    level: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
    label: string | null;
    /** Everyone who may decide this level */
    approvers: Named[];
    comments: string | null;
    actedAt: string | null;
    approver: Named | null;
    actedBy: Named | null;
    onBehalfOf: Named | null;
  }>;
  canDecide: boolean;
  decideAs: 'approver' | 'delegate' | 'override' | null;
  canCancel: boolean;
}

export interface LeavePreview {
  days: number;
  dates: string[];
  available: number | null;
  after: number | null;
  errors: string[];
  warnings: string[];
  needsDocument?: boolean;
  leaveType: { id: string; name: string; accrual: LeaveAccrual; approvalLevels: number };
  /** Who will approve: per level, why and who */
  route?: { mode: 'project' | 'reporting_line'; levels: Array<{ label: string; approvers: Named[] }> };
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const LEAVE_STATUS_TONE: Record<LeaveStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  WITHDRAWN: 'neutral',
};

export const ACCRUAL_LABEL: Record<LeaveAccrual, string> = {
  UPFRONT: 'Credited for the year',
  MONTHLY: 'Builds up monthly',
  NONE: 'Unlimited',
};

export const LEAVE_CATEGORIES = ['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMPENSATORY', 'WORK_FROM_HOME', 'OTHER'];

/** "Mon, 12 Oct" / "12–14 Oct" style range. */
export function leaveRange(r: Pick<LeaveRequest, 'startDate' | 'endDate' | 'halfDay'>): string {
  const fmt = (k: string, o: Intl.DateTimeFormatOptions) => new Date(`${k}T00:00:00Z`).toLocaleDateString(undefined, { ...o, timeZone: 'UTC' });
  if (r.startDate === r.endDate) {
    const half = r.halfDay === 'FIRST_HALF' ? ' (first half)' : r.halfDay === 'SECOND_HALF' ? ' (second half)' : '';
    return fmt(r.startDate, { weekday: 'short', day: 'numeric', month: 'short' }) + half;
  }
  return `${fmt(r.startDate, { day: 'numeric', month: 'short' })} – ${fmt(r.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

// ─── Keys ───────────────────────────────────────────────────

export const leaveKeys = {
  all: ['leave'] as const,
  types: (all: boolean) => ['leave', 'types', all] as const,
  balances: (employeeId: string | undefined, year: number) => ['leave', 'balances', employeeId ?? 'me', year] as const,
  requests: (q: object) => ['leave', 'requests', q] as const,
  pendingCount: ['leave', 'pending-count'] as const,
  calendar: (q: object) => ['leave', 'calendar', q] as const,
  history: (balanceId: string) => ['leave', 'history', balanceId] as const,
  usage: (year: number) => ['leave', 'usage', year] as const,
  yearEnd: (id: string, year: number) => ['leave', 'year-end', id, year] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

// ─── Queries ────────────────────────────────────────────────

export function useLeaveTypes(all = false, enabled = true) {
  return useQuery({ queryKey: leaveKeys.types(all), queryFn: async () => unwrap<LeaveType[]>(await api.get('/leave/types', { params: all ? { all: true } : {} })), enabled, staleTime: 60_000 });
}

export function useLeaveBalances(employeeId?: string, year = new Date().getFullYear(), enabled = true) {
  return useQuery({
    queryKey: leaveKeys.balances(employeeId, year),
    queryFn: async () => unwrap<{ employeeId: string; year: number; balances: LeaveBalance[] }>(await api.get('/leave/balances', { params: { year, ...(employeeId && { employeeId }) } })),
    enabled,
    retry: false,
  });
}

export function useLeaveRequests(q: { view: 'mine' | 'review' | 'all'; status?: LeaveStatus; employeeId?: string; page?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: leaveKeys.requests(q),
    queryFn: async () => (await api.get('/leave/requests', { params: q })).data as Paged<LeaveRequest>,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Leave requests waiting for me — nav badge (delegated approvals included). */
export function usePendingLeave() {
  const { hasFeature } = useAccess();
  // Only people who can approve here ask; the API would answer 0 for everyone else
  const mayApprove = useMayApprove('leave.approve');
  // Project leads and line managers approve without a role permission — ask the API
  return useQuery({
    queryKey: leaveKeys.pendingCount,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/leave/requests/pending-count')).count,
    enabled: hasFeature('time.leave') && mayApprove,
    // Live updates refresh it while connected; poll only when the connection is down
    refetchInterval: () => (isLive() ? false : 2 * 60_000),
  });
}

export function useWhosOff(q: { month: string; departmentId?: string }, enabled = true) {
  return useQuery({
    queryKey: leaveKeys.calendar(q),
    queryFn: async () => unwrap<{ month: string; holidays: Array<{ id: string; name: string; date: string; isOptional: boolean }>; leaves: LeaveRequest[] }>(await api.get('/leave/calendar', { params: q })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLeaveUsage(year: number, enabled = true) {
  return useQuery({ queryKey: leaveKeys.usage(year), queryFn: async () => unwrap<Array<{ leaveTypeId: string; used: number; given: number; percent: number | null }>>(await api.get('/leave/types/usage', { params: { year } })), enabled });
}

export interface YearEndPreview {
  leaveType: { id: string; name: string; carryForward?: boolean; maxCarryForward?: number };
  year: number;
  carry: number;
  lapse: number;
  people: number;
  losing: Array<{ employee: { id: string; firstName: string; lastName: string; avatarUrl: string | null; employeeId: string }; left: number; lapse: number }>;
}

export function useYearEnd(id: string | null, year: number) {
  return useQuery({ queryKey: leaveKeys.yearEnd(id ?? '', year), queryFn: async () => unwrap<YearEndPreview>(await api.get(`/leave/types/${id}/year-end`, { params: { year } })), enabled: Boolean(id) });
}

export function useBalanceHistory(balanceId: string | null) {
  return useQuery({
    queryKey: leaveKeys.history(balanceId ?? ''),
    queryFn: async () => unwrap<Array<{ id: string; days: number; reason: string; createdAt: string; adjustedBy: { firstName: string; lastName: string } | null }>>(await api.get(`/leave/balances/${balanceId}/history`)),
    enabled: Boolean(balanceId),
  });
}

export async function previewLeave(body: { leaveTypeId: string; startDate: string; endDate: string; halfDay?: HalfDay | null }): Promise<LeavePreview> {
  return unwrap(await api.post('/leave/requests/preview', body));
}

// ─── Mutations ──────────────────────────────────────────────

/** Leave changes balances, approvals and what attendance shows. */
function useLeaveMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: leaveKeys.all });
      void qc.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export const useApplyLeave = () =>
  useLeaveMutation(async (body: { leaveTypeId: string; startDate: string; endDate: string; halfDay?: HalfDay | null; reason: string }) => unwrap<LeaveRequest>(await api.post('/leave/requests', body)));

export const useDecideLeave = () =>
  useLeaveMutation(async ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note?: string }) =>
    unwrap<LeaveRequest>(await api.post(`/leave/requests/${id}/${action}`, { note: note || null })),
  );

export const useCancelLeave = () =>
  useLeaveMutation(async ({ id, reason }: { id: string; reason?: string }) => unwrap<LeaveRequest>(await api.post(`/leave/requests/${id}/cancel`, { reason: reason || null })));

export const useAdjustBalance = () =>
  useLeaveMutation(async (body: { employeeId: string; leaveTypeId: string; year: number; days: number; reason: string }) => unwrap(await api.post('/leave/balances/adjust', body)));

export const useAskQuestion = () =>
  useMutation({ mutationFn: async ({ id, question }: { id: string; question: string }) => unwrap<{ sent: boolean }>(await api.post(`/leave/requests/${id}/question`, { question })) });

export const useRemindLapse = () =>
  useMutation({ mutationFn: async ({ id, year }: { id: string; year: number }) => unwrap<{ sent: number }>(await api.post(`/leave/types/${id}/year-end/remind`, null, { params: { year } })) });

export const useAttachDocument = () =>
  useLeaveMutation(async ({ id, file }: { id: string; file: File }) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<LeaveRequest>(await api.post(`/leave/requests/${id}/document`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  });

/** Opens a request's document in a new tab (authorised fetch → blob). */
export async function openLeaveDocument(id: string): Promise<void> {
  const res = await api.get(`/leave/requests/${id}/document`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type LeaveTypeInput = Omit<LeaveType, 'id'>;
export const useSaveLeaveType = () =>
  useLeaveMutation(async ({ id, ...body }: LeaveTypeInput & { id?: string }) =>
    unwrap<LeaveType>(id ? await api.patch(`/leave/types/${id}`, body) : await api.post('/leave/types', body)),
  );
