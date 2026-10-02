'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
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
  leaveType: { id: string; name: string; code: string; color: string; countsAsPresent: boolean; isPaid: boolean };
  approvals: Array<{
    level: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
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
  leaveType: { id: string; name: string; accrual: LeaveAccrual; approvalLevels: number };
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
  const { can, access, hasFeature } = useAccess();
  const approver = can('leave.approve') || Boolean(access?.delegations.some((d) => d.permissions.includes('leave.approve')));
  return useQuery({
    queryKey: leaveKeys.pendingCount,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/leave/requests/pending-count')).count,
    enabled: approver && hasFeature('time.leave'),
    refetchInterval: 2 * 60_000,
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

export type LeaveTypeInput = Omit<LeaveType, 'id'>;
export const useSaveLeaveType = () =>
  useLeaveMutation(async ({ id, ...body }: LeaveTypeInput & { id?: string }) =>
    unwrap<LeaveType>(id ? await api.patch(`/leave/types/${id}`, body) : await api.post('/leave/types', body)),
  );
