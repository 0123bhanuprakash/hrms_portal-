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
export type LeaveAvailability = 'EVERYONE' | 'RULES' | 'GRANT_ONLY';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';

/** Who can use a type (RULES) or ask for a grant (GRANT_ONLY). Empty = anyone; rules combine with AND. */
export interface LeaveRules {
  genders: Gender[];
  departmentIds: string[];
  locationIds: string[];
  designationIds: string[];
  employmentTypes: EmploymentType[];
  minServiceMonths: number | null;
  managerIds: string[];
  /** Everyone below the managers, not only direct reports */
  managerDeep: boolean;
  projectIds: string[];
  /** Named people added to / kept out of the rules */
  members: Array<{ employeeId: string; mode: 'INCLUDE' | 'EXCLUDE' }>;
}

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
  availability: LeaveAvailability;
  /** Grant-only: a grant (and a request for one) needs a document */
  grantNeedsDocument: boolean;
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
  /** Below 0 at year end: take it from next year (true) or forgive it */
  recoverNegative: boolean;
  isActive: boolean;
  sortOrder: number;
}

/** Leave admins also get the rules (everyone else sees only genders). */
export type LeaveTypeAdmin = LeaveType & LeaveRules;

export interface GrantOnBalance {
  id: string;
  days: number;
  /** Pending + approved */
  taken: number;
  used: number;
  /** 0 once the grant has ended */
  left: number;
  validFrom: string;
  validTo: string;
}

/** A grant-only type the person may ask HR for, with their request if one is waiting. */
export interface AskableLeave {
  leaveType: { id: string; name: string; code: string; color: string; description: string | null; annualQuota: number; grantNeedsDocument: boolean };
  request: { id: string; fromDate: string; toDate: string; createdAt: string } | null;
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
  /** If nothing more is taken: left on 31 Dec, carried over, lost, owed to next year */
  yearEnd?: { left: number; carry: number; lapse: number; owe?: number } | null;
  /** Grant-only types: the grants behind this balance */
  grants?: GrantOnBalance[];
  /** HR lent this many days (may go this far below 0, on top of the type's own allowance) */
  lent?: number;
  /** How far below 0 the person may go in all */
  below?: number;
  /** Owed from earlier years, still to be taken back */
  owedLeft?: number;
  /** Their "ask for more days" request waiting for an answer */
  extraRequest?: { id: string; days: number; createdAt: string } | null;
}

export type ExtraStatus = 'PENDING' | 'LENT' | 'GIVEN' | 'DECLINED' | 'CANCELLED';
export interface ExtraLeaveRequest {
  id: string;
  year: number;
  days: number;
  startDate: string | null;
  endDate: string | null;
  reason: string;
  status: ExtraStatus;
  decidedDays: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  decidedBy: string | null;
  createdAt: string;
  mine: boolean;
  employee: { id: string; employeeId: string; firstName: string; lastName: string; avatarUrl: string | null };
  leaveType: { id: string; name: string; code: string; color: string; annualQuota: number };
}

export interface OwedRow {
  balanceId: string;
  employee: { id: string; employeeId: string; firstName: string; lastName: string; avatarUrl: string | null; employmentStatus: string };
  leaving: boolean;
  leaveType: { id: string; name: string; code: string; color: string };
  available: number;
  lent: number;
  owedLeft: number;
  owesAtYearEnd: number;
}

export interface LedgerEntry {
  date: string;
  kind: 'OPENING' | 'CREDIT' | 'CARRIED_IN' | 'CARRY_EXPIRED' | 'GRANT' | 'EXTRA' | 'LEND' | 'CORRECTION' | 'DEDUCTION' | 'TAKEN_BACK' | 'WAIVED' | 'LEAVE' | 'YEAR_END';
  label: string;
  days: number | null;
  balance: number | null;
  note?: string | null;
  by?: string | null;
  pending?: boolean;
}
export interface Ledger {
  year: number;
  leaveType: { id: string; name: string; code: string; color: string; accrual: LeaveAccrual };
  lent: number;
  owedLeft: number;
  closed: boolean;
  entries: LedgerEntry[];
}

interface DocInfo {
  name: string;
  size: number | null;
  mime: string | null;
}
type PersonLite = { id: string; employeeId: string; firstName: string; lastName: string; avatarUrl: string | null };

export interface LeaveGrant {
  id: string;
  days: number;
  validFrom: string;
  validTo: string;
  reason: string;
  status: 'ACTIVE' | 'REVOKED';
  requestId: string | null;
  createdAt: string;
  employee: PersonLite;
  leaveType: { id: string; name: string; code: string; color: string };
  taken: number;
  used: number;
  left: number;
  ended: boolean;
  grantedBy: { firstName: string; lastName: string } | null;
  document: DocInfo | null;
  history: Array<{ id: string; kind: 'CREATED' | 'CHANGED' | 'REVOKED'; days: number | null; validTo: string | null; note: string | null; createdAt: string; by: { firstName: string; lastName: string } | null }>;
}

export type GrantRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export interface LeaveGrantRequest {
  id: string;
  fromDate: string;
  toDate: string;
  note: string;
  status: GrantRequestStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  employee: PersonLite;
  leaveType: { id: string; name: string; code: string; color: string; annualQuota: number; grantNeedsDocument: boolean };
  decidedBy: { firstName: string; lastName: string } | null;
  grantId: string | null;
  document: DocInfo | null;
}

export interface EligibilityPreview {
  total: number;
  count: number;
  people: Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null; employeeId: string }>;
  projects: Array<{ id: string; name: string; code: string | null }>;
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
  /** Questions from approvers and the person's replies, oldest first */
  comments: LeaveComment[];
  /** An approver asked and the person hasn't answered yet */
  questionOpen: boolean;
  /** The person can answer (their own pending request with a question on it) */
  canReply: boolean;
  /** Asked to cancel this approved leave (lastDay = came back early; null = all of it) */
  cancelRequest: { requestedAt: string; reason: string | null; lastDay: string | null } | null;
  /** Approved and already started: cancelling needs a request */
  canRequestCancel: boolean;
  /** I decide the cancellation request */
  canDecideCancel: boolean;
}
export interface LeaveComment {
  id: string;
  kind: 'QUESTION' | 'REPLY';
  body: string;
  createdAt: string;
  author: Named | null;
  /** Written by me */
  mine: boolean;
}

export interface LeavePreview {
  days: number;
  dates: string[];
  available: number | null;
  after: number | null;
  errors: string[];
  warnings: string[];
  needsDocument?: boolean;
  /** Days missing from the balance; > 0 = the person can ask for more */
  short?: number;
  canAskMore?: boolean;
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
  grants: (q: object) => ['leave', 'grants', q] as const,
  grantRequests: (q: object) => ['leave', 'grant-requests', q] as const,
  extra: (q: object) => ['leave', 'extra', q] as const,
  owed: (year: number) => ['leave', 'owed', year] as const,
  ledger: (q: object) => ['leave', 'ledger', q] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

// ─── Queries ────────────────────────────────────────────────

export function useLeaveTypes(all = false, enabled = true) {
  return useQuery({ queryKey: leaveKeys.types(all), queryFn: async () => unwrap<LeaveTypeAdmin[]>(await api.get('/leave/types', { params: all ? { all: true } : {} })), enabled, staleTime: 60_000 });
}

export function useLeaveBalances(employeeId?: string, year = new Date().getFullYear(), enabled = true) {
  return useQuery({
    queryKey: leaveKeys.balances(employeeId, year),
    queryFn: async () => unwrap<{ employeeId: string; year: number; balances: LeaveBalance[]; askable?: AskableLeave[] }>(await api.get('/leave/balances', { params: { year, ...(employeeId && { employeeId }) } })),
    enabled,
    retry: false,
  });
}

/** Filter chips for the approvals list: what is in it, counted without the chip's own filter. */
export interface LeaveFacets {
  leaveTypes: Array<{ id: string; name: string; color: string | null; count: number }>;
  departments: Array<{ id: string; name: string; count: number }>;
}
export interface LeaveListQuery {
  view: 'mine' | 'review' | 'all';
  status?: LeaveStatus;
  employeeId?: string;
  /** Name or employee id */
  search?: string;
  leaveTypeId?: string;
  departmentId?: string;
  /** Overlapping these dates (YYYY-MM-DD) */
  from?: string;
  to?: string;
  sort?: 'soonest' | 'newest' | 'latest';
  page?: number;
  limit?: number;
}
export function useLeaveRequests(q: LeaveListQuery, enabled = true) {
  return useQuery({
    queryKey: leaveKeys.requests(q),
    queryFn: async () => (await api.get('/leave/requests', { params: Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) })).data as Omit<Paged<LeaveRequest>, 'meta'> & { meta: Paged<LeaveRequest>['meta'] & { facets?: LeaveFacets } },
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

/** How many people draft rules cover (the leave type form). */
export function useEligibilityPreview(body: (LeaveRules & { availability: LeaveAvailability }) | null) {
  return useQuery({
    queryKey: ['leave', 'eligible-preview', body],
    queryFn: async () => unwrap<EligibilityPreview>(await api.post('/leave/types/eligible-preview', body)),
    enabled: Boolean(body),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useLeaveGrants(q: { employeeId?: string; leaveTypeId?: string; status?: 'ACTIVE' | 'REVOKED' }, enabled = true) {
  return useQuery({ queryKey: leaveKeys.grants(q), queryFn: async () => unwrap<LeaveGrant[]>(await api.get('/leave/grants', { params: q })), enabled, placeholderData: keepPreviousData });
}

export function useGrantRequests(q: { view: 'mine' | 'review'; status?: GrantRequestStatus }, enabled = true) {
  return useQuery({ queryKey: leaveKeys.grantRequests(q), queryFn: async () => unwrap<LeaveGrantRequest[]>(await api.get('/leave/grant-requests', { params: q })), enabled, placeholderData: keepPreviousData });
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

export type AdjustKind = 'EXTRA' | 'LEND' | 'CORRECTION' | 'DEDUCTION';
export const useAdjustBalance = () =>
  useLeaveMutation(async (body: { employeeId: string; leaveTypeId: string; year: number; kind: AdjustKind; days: number; reason: string }) => unwrap(await api.post('/leave/balances/adjust', body)));

// ─── Asking for more days, lending / giving, owed, ledger ───

export function useExtraRequests(q: { view: 'mine' | 'decide'; status?: ExtraStatus }, enabled = true) {
  return useQuery({ queryKey: leaveKeys.extra(q), queryFn: async () => unwrap<ExtraLeaveRequest[]>(await api.get('/leave/extra-requests', { params: q })), enabled, placeholderData: keepPreviousData });
}
export function useOwed(year: number, enabled = true) {
  return useQuery({ queryKey: leaveKeys.owed(year), queryFn: async () => unwrap<{ year: number; rows: OwedRow[] }>(await api.get('/leave/owed', { params: { year } })), enabled, retry: false });
}
export function useLedger(q: { employeeId?: string; leaveTypeId: string; year: number } | null) {
  return useQuery({ queryKey: leaveKeys.ledger(q ?? {}), queryFn: async () => unwrap<Ledger>(await api.get('/leave/ledger', { params: q })), enabled: Boolean(q) });
}
export const useAskExtra = () =>
  useLeaveMutation(async (body: { leaveTypeId: string; year: number; days: number; startDate?: string; endDate?: string; reason: string }) => unwrap<ExtraLeaveRequest>(await api.post('/leave/extra-requests', body)));
export const useDecideExtra = () =>
  useLeaveMutation(async ({ id, ...body }: { id: string; action: 'lend' | 'give' | 'decline'; days?: number; note?: string }) => unwrap<ExtraLeaveRequest>(await api.post(`/leave/extra-requests/${id}/decide`, body)));
export const useCancelExtra = () => useLeaveMutation(async (id: string) => unwrap<ExtraLeaveRequest>(await api.post(`/leave/extra-requests/${id}/cancel`)));
export const useLendGive = () =>
  useLeaveMutation(async (body: { employeeId: string; leaveTypeId: string; year: number; action: 'lend' | 'give'; days: number; reason: string }) => unwrap(await api.post('/leave/extra/lend-give', body)));
export const useWaive = () => useLeaveMutation(async ({ balanceId, note }: { balanceId: string; note: string }) => unwrap<{ waived: number }>(await api.post(`/leave/balances/${balanceId}/waive`, { note })));

export const useAskQuestion = () =>
  useLeaveMutation(async ({ id, question }: { id: string; question: string }) => unwrap<LeaveRequest>(await api.post(`/leave/requests/${id}/question`, { question })));

/** Approved leave that has started: ask to cancel all of it, or to end it early (last day taken). */
export const useRequestCancel = () =>
  useLeaveMutation(async ({ id, ...body }: { id: string; mode: 'all' | 'early'; lastDay?: string; reason: string }) => unwrap<LeaveRequest>(await api.post(`/leave/requests/${id}/cancel-request`, body)));
export const useWithdrawCancel = () =>
  useLeaveMutation(async (id: string) => unwrap<LeaveRequest>(await api.post(`/leave/requests/${id}/cancel-request/withdraw`)));
/** Whoever approved the leave (or HR) agrees to the cancellation, or keeps the leave. */
export const useDecideCancel = () =>
  useLeaveMutation(async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => unwrap<LeaveRequest>(await api.post(`/leave/requests/${id}/cancel-request/${approve ? 'approve' : 'reject'}`, note ? { note } : {})));

/** The person answers an approver's question on their own pending request. */
export const useReplyLeave = () =>
  useLeaveMutation(async ({ id, body }: { id: string; body: string }) => unwrap<LeaveRequest>(await api.post(`/leave/requests/${id}/reply`, { body })));

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

// ─── Grants ─────────────────────────────────────────────────

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

/** HR gives a grant-only type to one or more people (document optional unless the type needs one). */
export const useCreateGrant = () =>
  useLeaveMutation(async (v: { employeeIds: string[]; leaveTypeId: string; days: number; validFrom: string; validTo: string; reason: string; file?: File | null }) => {
    const form = new FormData();
    form.append('employeeIds', JSON.stringify(v.employeeIds));
    form.append('leaveTypeId', v.leaveTypeId);
    form.append('days', String(v.days));
    form.append('validFrom', v.validFrom);
    form.append('validTo', v.validTo);
    form.append('reason', v.reason);
    if (v.file) form.append('file', v.file);
    return unwrap<LeaveGrant[]>(await api.post('/leave/grants', form, multipart));
  });

/** Extend / shorten / change days — with a reason. */
export const useUpdateGrant = () =>
  useLeaveMutation(async ({ id, ...body }: { id: string; days?: number; validTo?: string; note: string }) => unwrap<LeaveGrant>(await api.patch(`/leave/grants/${id}`, body)));

export const useRevokeGrant = () => useLeaveMutation(async ({ id, note }: { id: string; note: string }) => unwrap<LeaveGrant>(await api.post(`/leave/grants/${id}/revoke`, { note })));

/** The employee asks HR for a grant-only type. */
export const useAskForGrant = () =>
  useLeaveMutation(async (v: { leaveTypeId: string; fromDate: string; toDate: string; note: string; file?: File | null }) => {
    const form = new FormData();
    form.append('leaveTypeId', v.leaveTypeId);
    form.append('fromDate', v.fromDate);
    form.append('toDate', v.toDate);
    form.append('note', v.note);
    if (v.file) form.append('file', v.file);
    return unwrap<LeaveGrantRequest>(await api.post('/leave/grant-requests', form, multipart));
  });

export const useDecideGrantRequest = () =>
  useLeaveMutation(async ({ id, ...v }: { id: string } & ({ approve: true; days: number; validFrom: string; validTo: string; note?: string } | { approve: false; note: string })) =>
    v.approve
      ? unwrap<LeaveGrantRequest>(await api.post(`/leave/grant-requests/${id}/approve`, { days: v.days, validFrom: v.validFrom, validTo: v.validTo, note: v.note || null }))
      : unwrap<LeaveGrantRequest>(await api.post(`/leave/grant-requests/${id}/reject`, { note: v.note })),
  );

export const useCancelGrantRequest = () => useLeaveMutation(async (id: string) => unwrap<LeaveGrantRequest>(await api.post(`/leave/grant-requests/${id}/cancel`)));

/** Opens a grant's or a grant request's document in a new tab. */
export async function openGrantDocument(kind: 'grants' | 'grant-requests', id: string): Promise<void> {
  const res = await api.get(`/leave/${kind}/${id}/document`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Date key a number of months later, minus a day (12 months from 1 Nov → 31 Oct). */
export function monthsLater(key: string, months: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type LeaveTypeInput = Omit<LeaveTypeAdmin, 'id'>;
export const useSaveLeaveType = () =>
  useLeaveMutation(async ({ id, ...body }: LeaveTypeInput & { id?: string }) =>
    unwrap<LeaveType>(id ? await api.patch(`/leave/types/${id}`, body) : await api.post('/leave/types', body)),
  );
