'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { isLive } from '@/lib/live/socket';

// ============================================================
// Resource requests (Lead → Project manager → Delivery Director → PMO)
// and releases (Lead → PM / Delivery Director). See the API's
// projects/resources.service.ts for the rules.
// ============================================================

export type RequestKind = 'REQUEST' | 'RELEASE';
export type RequestStatus = 'OPEN' | 'ON_HOLD' | 'AWAITING_CONSENT' | 'FILLED' | 'REJECTED' | 'WITHDRAWN' | 'RELEASED' | 'REASSIGNED' | 'KEPT';
export type Step = 'PM' | 'DD' | 'PMO';

export interface ResFace {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  designation?: { name: string } | null;
}
export interface ResUser {
  id: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ResourceRequest {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  step: Step;
  project: { id: string; name: string; code: string; color: string | null };
  title: string | null;
  skills: string[];
  allocation: number | null;
  fromDate: string | null;
  untilDate: string | null;
  reason: string;
  preferred: ResFace | null;
  releaseEmployee: ResFace | null;
  lastDate: string | null;
  raisedBy: ResUser | null;
  hold: { reason: string | null; at: string; by: ResUser | null; remindAt: string | null } | null;
  filled: { employee: ResFace | null; allocation: number | null } | null;
  target: { id: string; name: string } | null;
  outcomeNote: string | null;
  decidedBy: ResUser | null;
  decidedAt: string | null;
  nudgedAt: string | null;
  previousRequestId: string | null;
  path: Array<{ step: Step; label: string; person: ResFace | null }>;
  pm: ResFace | null;
  dd: ResFace | null;
  mine: boolean;
  canAct: boolean;
  createdAt: string;
  updatedAt: string;
  ageDays: number;
}

export interface RequestEvent {
  id: string;
  kind: string;
  note: string | null;
  data: Record<string, unknown> | null;
  at: string;
  actor: ResUser | null;
}

export interface RequestDetail extends ResourceRequest {
  handover: string | null;
  events: RequestEvent[];
  can: { forward: boolean; fill: boolean; fillAnyone: boolean; hold: boolean; unhold: boolean; reject: boolean; decideRelease: boolean; consent: boolean; withdraw: boolean; nudge: boolean; raiseAgain: boolean };
  releaseTargets: Array<{ id: string; name: string; code: string; color: string | null }>;
  pendingFill: { employee: ResFace | null; allocation: number; note: string | null; takeFrom: { memberId: string; allocation: number } | null; project: string; by: ResUser | null; waitingFor: ResUser | null } | null;
}

export interface Candidate {
  employee: ResFace;
  skills: string[];
  matchedSkills: string[];
  match: number | null;
  free: number;
  fits: boolean;
  preferred: boolean;
  inPool: boolean;
  underMe: boolean;
  projects: Array<{ memberId: string; projectId: string; name: string; code: string; allocation: number }>;
}

export interface PoolPerson {
  employee: ResFace & { department: { name: string } | null };
  skills: string[];
  reportsToPmo: boolean;
  nowBooked: number;
  free: number;
  freeSince: string | null;
  lastProject: string | null;
  bestFit: { id: string; title: string | null; project: string; allocation: number | null; match: number } | null;
}

export interface HistoryEntry {
  id: string;
  action: string;
  allocation: number | null;
  note: string | null;
  at: string;
  requestId: string | null;
  project: { id: string; name: string; code: string; color: string | null } | null;
  actor: ResUser | null;
}

export type InboxView = 'waiting' | 'hold' | 'mine' | 'done' | 'all';
export interface InboxPage {
  data: ResourceRequest[];
  meta: { view: InboxView; counts: Record<'waiting' | 'hold' | 'mine' | 'done', number>; roles: { pmo: boolean; pm: number; dd: number; lead: number } };
}

export interface ResContext {
  pmo: boolean;
  leadProjects: string[];
  pmProjects: string[];
  ddProjects: string[];
  involved: boolean;
}

export const resKeys = {
  all: ['resources'] as const,
  context: ['resources', 'context'] as const,
  list: (q: object) => ['resources', 'list', q] as const,
  count: ['resources', 'count'] as const,
  detail: (id: string) => ['resources', 'detail', id] as const,
  candidates: (id: string, search: string) => ['resources', 'candidates', id, search] as const,
  pool: ['resources', 'pool'] as const,
  history: (employeeId: string) => ['resources', 'history', employeeId] as const,
  skills: ['resources', 'skills'] as const,
  available: (q: object) => ['resources', 'available', q] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

/** My roles on projects — which menu items and buttons to show. */
export function useResourceContext(enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({ queryKey: resKeys.context, queryFn: async () => unwrap<ResContext>(await api.get('/resources/context')), enabled: enabled && hasFeature('work.projects'), staleTime: 60_000 });
}

export function useResourceRequests(q: { view: InboxView; projectId?: string; kind?: RequestKind }, enabled = true) {
  return useQuery({
    queryKey: resKeys.list(q),
    queryFn: async () => (await api.get('/resources/requests', { params: Object.fromEntries(Object.entries(q).filter(([, v]) => v)) })).data as InboxPage,
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Menu badge: requests and releases waiting for me (only for people who decide them). */
export function usePendingResourceRequests() {
  const ctx = useResourceContext();
  const decides = Boolean(ctx.data && (ctx.data.pmo || ctx.data.pmProjects.length || ctx.data.ddProjects.length));
  return useQuery({
    queryKey: resKeys.count,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/resources/requests/count')).count,
    enabled: decides,
    refetchInterval: () => (isLive() ? false : 2 * 60_000),
  });
}

export function useResourceRequest(id: string | null) {
  return useQuery({ queryKey: resKeys.detail(id ?? ''), queryFn: async () => unwrap<RequestDetail>(await api.get(`/resources/requests/${id}`)), enabled: Boolean(id) });
}

export function useCandidates(id: string | null, search: string, enabled = true) {
  return useQuery({
    queryKey: resKeys.candidates(id ?? '', search),
    queryFn: async () => unwrap<{ window: { from: string; until: string | null }; wanted: string[]; data: Candidate[] }>(await api.get(`/resources/requests/${id}/candidates`, { params: search ? { search } : {} })),
    enabled: Boolean(id) && enabled,
    placeholderData: keepPreviousData,
  });
}

export type PoolShow = 'all' | 'free' | 'pmo';
/** The pool a page at a time; `counts` always cover the whole pool. */
export function usePmoPool(q: { search?: string; show?: PoolShow; page?: number }, enabled = true) {
  return useQuery({
    queryKey: [...resKeys.pool, q],
    queryFn: async () =>
      unwrap<{ today: string; counts: { people: number; fullyFree: number; reportsToPmo: number; waitingRequests: number }; data: PoolPerson[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(
        await api.get('/resources/pool', { params: Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '')) }),
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useAssignmentHistory(employeeId: string | null, enabled = true) {
  return useQuery({ queryKey: resKeys.history(employeeId ?? ''), queryFn: async () => unwrap<{ person: { firstName: string; lastName: string; designation: string | null } | null; skills: string[]; experience: ExperienceState | null; data: HistoryEntry[]; requestBackFrom: string[] }>(await api.get(`/resources/history/${employeeId}`)), enabled: Boolean(employeeId) && enabled, retry: false });
}

/** Experience before joining: the approved value (counts everywhere) and what waits for HR. */
export interface ExperienceState {
  priorMonths: number | null;
  /** Entered by the person, not verified yet */
  pendingMonths: number | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  joiningDate: string;
}
const useExperienceMutation = <V,>(fn: (v: V) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resources', 'history'] });
      void qc.invalidateQueries({ queryKey: ['experience-reviews'] });
      void qc.invalidateQueries({ queryKey: ['resources', 'available'] });
    },
  });
};
export const useApproveExperience = () => useExperienceMutation((employeeId: string) => api.post(`/employees/${employeeId}/experience/approve`));
export const useRejectExperience = () => useExperienceMutation(({ employeeId, reason }: { employeeId: string; reason: string }) => api.post(`/employees/${employeeId}/experience/reject`, { reason }));
/** HR: experience people entered that waits for verification (Home → Needs your action). */
export function useExperienceReviews(enabled = true) {
  return useQuery({
    queryKey: ['experience-reviews'],
    queryFn: async () => unwrap<{ total: number; rows: Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null; priorExperienceMonths: number | null; priorExperiencePendingMonths: number; priorExperienceSubmittedAt: string }> }>(await api.get('/experience-reviews')),
    enabled,
    staleTime: 60_000,
  });
}

/** Someone free for a request (Raise a request → Preferred person). */
export interface AvailablePerson {
  employee: ResFace & { employeeId: string; designation: { id: string; name: string } | null; department: { id: string; name: string } | null };
  /** % of their week free in the window */
  free: number;
  /** Before joining + time here, in years (one decimal) */
  experienceYears: number;
  /** false = experience before joining not given (only time here counted) */
  experienceComplete: boolean;
  skills: string[];
  /** Skills that match the request / the project's tech stack */
  matchedSkills: string[];
  projects: Array<{ name: string; code: string; allocation: number }>;
}
export interface AvailableQuery {
  projectId: string;
  from?: string;
  until?: string | null;
  search?: string;
  departmentId?: string;
  designationId?: string;
  /** Must have all of these (comma list) */
  skills?: string;
  /** The request's skills, to mark matches */
  wanted?: string;
  minFree?: number;
  minYears?: number;
  maxYears?: number;
  page?: number;
  limit?: number;
}
type Facet = { id: string; name: string; count: number };
export function useAvailablePeople(q: AvailableQuery, enabled = true) {
  return useQuery({
    queryKey: resKeys.available(q),
    queryFn: async () =>
      unwrap<{ window: { from: string; until: string | null }; rows: AvailablePerson[]; meta: { total: number; page: number; limit: number; totalPages: number; facets: { departments: Facet[]; roles: Facet[]; skills: Facet[] } } }>(
        await api.get('/resources/available-people', { params: Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '')) }),
      ),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSkillSuggestions(enabled = true) {
  return useQuery({ queryKey: resKeys.skills, queryFn: async () => unwrap<string[]>(await api.get('/resources/skills')), enabled, staleTime: 5 * 60_000 });
}

/** Every action refreshes the request, the inbox, badges and projects (assignments change). */
function useResMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: resKeys.all });
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export interface RaiseInput {
  projectId: string;
  title: string;
  skills: string[];
  allocation: number;
  fromDate: string;
  untilDate?: string | null;
  reason: string;
  preferredEmployeeId?: string | null;
  previousRequestId?: string | null;
}

export const useRaiseRequest = () => useResMutation((b: RaiseInput) => api.post('/resources/requests', b).then(unwrap<RequestDetail>));
export const useRaiseRelease = () => useResMutation((b: { memberId: string; reason: string; lastDate: string; handover?: string | null }) => api.post('/resources/releases', b).then(unwrap<RequestDetail>));
export const useForward = () => useResMutation(({ id, note }: { id: string; note?: string | null }) => api.post(`/resources/requests/${id}/forward`, { note }).then(unwrap<RequestDetail>));
export const useFill = () =>
  useResMutation(({ id, ...b }: { id: string; employeeId: string; allocation: number; note?: string | null; takeFrom?: { memberId: string; allocation: number } | null }) => api.post(`/resources/requests/${id}/fill`, b).then(unwrap<RequestDetail>));
export const useHold = () => useResMutation(({ id, ...b }: { id: string; reason: string; remindAt?: string | null }) => api.post(`/resources/requests/${id}/hold`, b).then(unwrap<RequestDetail>));
export const useUnhold = () => useResMutation(({ id, note }: { id: string; note?: string | null }) => api.post(`/resources/requests/${id}/unhold`, { note }).then(unwrap<RequestDetail>));
export const useReject = () => useResMutation(({ id, reason }: { id: string; reason: string }) => api.post(`/resources/requests/${id}/reject`, { reason }).then(unwrap<RequestDetail>));
export const useWithdraw = () => useResMutation(({ id, note }: { id: string; note?: string | null }) => api.post(`/resources/requests/${id}/withdraw`, { note }).then(unwrap<RequestDetail>));
export const useConsent = () => useResMutation(({ id, ...b }: { id: string; agree: boolean; note?: string | null }) => api.post(`/resources/requests/${id}/consent`, b).then(unwrap<RequestDetail>));
export const useNudge = () => useResMutation((id: string) => api.post(`/resources/requests/${id}/nudge`).then(unwrap<RequestDetail>));
export const useDecideRelease = () =>
  useResMutation(({ id, ...b }: { id: string; outcome: 'pool' | 'reassign' | 'keep'; targetProjectId?: string | null; allocation?: number | null; startDate?: string | null; note?: string | null }) =>
    api.post(`/resources/requests/${id}/release-decision`, b).then(unwrap<RequestDetail>),
  );
export const useSetTechStack = () => useResMutation(({ projectId, techStack }: { projectId: string; techStack: string[] }) => api.put(`/projects/${projectId}/tech-stack`, { techStack }).then(unwrap<{ techStack: string[] }>));

export function useSetSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, ...body }: { employeeId: string; skills: string[]; priorExperienceMonths?: number | null }) => api.put(`/employees/${employeeId}/skills`, body).then(unwrap<{ skills: string[]; experience?: unknown }>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employee'] });
      void qc.invalidateQueries({ queryKey: ['people'] });
      void qc.invalidateQueries({ queryKey: resKeys.skills });
      // The profile's skills card and the request matches read them from here
      void qc.invalidateQueries({ queryKey: ['resources', 'history'] });
      void qc.invalidateQueries({ queryKey: ['resources', 'available'] });
      void qc.invalidateQueries({ queryKey: ['experience-reviews'] });
    },
  });
}

// ─── Words ────────────────────────────────────────────────────

export const STEP_LABEL: Record<Step, string> = { PM: 'Project manager', DD: 'Delivery Director', PMO: 'PMO' };

/** Plain-word status for a card ("Waiting for PM", "On hold", "Filled"…). */
export function statusLabel(r: Pick<ResourceRequest, 'status' | 'step' | 'kind'>): { label: string; tone: 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'primary' } {
  switch (r.status) {
    case 'OPEN':
      return r.kind === 'RELEASE' ? { label: 'Waiting for PM / DD', tone: 'info' } : { label: `Waiting for ${r.step === 'PM' ? 'PM' : r.step === 'DD' ? 'Delivery Director' : 'PMO'}`, tone: 'info' };
    case 'ON_HOLD':
      return { label: 'On hold', tone: 'warning' };
    case 'AWAITING_CONSENT':
      return { label: 'Waiting for the other PM', tone: 'warning' };
    case 'FILLED':
      return { label: 'Filled', tone: 'success' };
    case 'REJECTED':
      return { label: 'Rejected', tone: 'danger' };
    case 'WITHDRAWN':
      return { label: 'Withdrawn', tone: 'neutral' };
    case 'RELEASED':
      return { label: 'To the PMO pool', tone: 'primary' };
    case 'REASSIGNED':
      return { label: 'Moved to another project', tone: 'primary' };
    case 'KEPT':
      return { label: 'Kept', tone: 'neutral' };
  }
}

/** Short reference shown on cards: RR-0148 / RL-0032 style. */
export const refOf = (r: Pick<ResourceRequest, 'id' | 'kind'>) => `${r.kind === 'RELEASE' ? 'RL' : 'RR'}-${r.id.slice(0, 4).toUpperCase()}`;

export const EVENT_TEXT: Record<string, string> = {
  raised: 'raised it',
  forwarded: 'approved it and passed it on',
  held: 'put it on hold',
  unheld: 'took it off hold',
  rejected: 'rejected it',
  withdrawn: 'withdrew it',
  filled: 'filled it',
  consent_asked: 'asked another PM to free up time',
  consent_given: 'agreed to free up time',
  consent_declined: 'didn’t agree to free up time',
  released: 'sent them to the PMO pool',
  reassigned: 'moved them to another project',
  kept: 'kept them on the project',
  nudged: 'nudged the PM and Delivery Director',
};

export const HISTORY_TEXT: Record<string, string> = {
  assigned: 'Assigned',
  changed: 'Allocation changed',
  removed: 'Removed',
  released: 'Released',
  to_pool: 'Sent to the PMO pool',
  reassigned: 'Reassigned',
  requested: 'Requested',
};
