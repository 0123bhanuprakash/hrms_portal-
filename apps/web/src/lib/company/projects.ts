'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';

// ============================================================
// Projects, assignments (role, team lead, allocation %) and
// who approves leave / attendance through them.
// ============================================================

export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type ProjectRole = 'MEMBER' | 'TEAM_LEAD' | 'MANAGER';

export interface ProjectPerson {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  designation?: { name: string } | null;
}

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  status: ProjectStatus;
  startDate: string;
  endDate: string | null;
  managers: ProjectPerson[];
  memberCount: number;
}

export interface Assignment {
  id: string;
  role: ProjectRole;
  roleLabel: string;
  allocation: number;
  /** May stay checked in past midnight for this project */
  nightShift?: boolean;
  /** Client projects: does the client pay for this person? */
  billed: boolean;
  startDate: string;
  endDate: string | null;
  active: boolean;
  upcoming: boolean;
  employee: ProjectPerson & { employeeId: string };
  lead: { id: string; firstName: string; lastName: string } | null;
}

export interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  clientName: string | null;
  status: ProjectStatus;
  startDate: string;
  endDate: string | null;
  today: string;
  members: Assignment[];
}

export interface Capacity {
  employeeId: string;
  from: string;
  to: string | null;
  allocatedToday: number;
  peak: number;
  free: number;
  assignments: Array<Assignment & { project: { id: string; code: string; name: string; status: ProjectStatus } }>;
}

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: 'info' | 'success' | 'warning' | 'neutral' }> = {
  PLANNED: { label: 'Planned', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'success' },
  ON_HOLD: { label: 'On hold', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
};
export const ROLE_LABEL: Record<ProjectRole, string> = { MANAGER: 'Project manager', TEAM_LEAD: 'Team lead', MEMBER: 'Member' };

export const projectKeys = {
  all: ['projects'] as const,
  list: (q: object) => ['projects', 'list', q] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
  mine: ['projects', 'mine'] as const,
  capacity: (employeeId: string, q: object) => ['projects', 'capacity', employeeId, q] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

export function useProjects(q: { status?: ProjectStatus; search?: string; page?: number }, enabled = true) {
  return useQuery({
    queryKey: projectKeys.list(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));
      return (await api.get('/projects', { params })).data as { data: ProjectSummary[]; meta: { total: number; page: number; limit: number; totalPages: number } };
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({ queryKey: projectKeys.detail(id ?? ''), queryFn: async () => unwrap<ProjectDetail>(await api.get(`/projects/${id}`)), enabled: Boolean(id), retry: false });
}

export function useMyProjects(enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: projectKeys.mine,
    queryFn: async () => unwrap<Capacity['assignments']>(await api.get('/projects/mine')),
    enabled: enabled && hasFeature('work.projects'),
    staleTime: 60_000,
  });
}

export function useCapacity(employeeId: string | undefined, q: { from?: string; to?: string | null; excludeMemberId?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: projectKeys.capacity(employeeId ?? '', q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '' && v !== null));
      return unwrap<Capacity>(await api.get(`/projects/capacity/${employeeId}`, { params }));
    },
    enabled: Boolean(employeeId) && enabled,
    retry: false,
  });
}

/**
 * Does this person approve anything? Role permission, covering for someone,
 * leading / managing a project, or having direct reports (line manager).
 */
export function useIsApprover(permission: 'leave.approve' | 'attendance.approve') {
  const { can, access } = useAccess();
  const mine = useMyProjects();
  const me = useMyCard();
  return (
    can(permission) ||
    Boolean(access?.delegations.length) ||
    Boolean(mine.data?.some((a) => a.active && (a.role === 'TEAM_LEAD' || a.role === 'MANAGER'))) ||
    (me.data?.employee?.directReportCount ?? 0) > 0
  );
}

function useProjectMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: projectKeys.all }) });
}

export type ProjectInput = { name: string; code: string; description?: string | null; clientName?: string | null; type?: ProjectType; color?: string | null; status: ProjectStatus; startDate: string; endDate?: string | null };
export const useSaveProject = () =>
  useProjectMutation(async ({ id, ...body }: ProjectInput & { id?: string }) => unwrap<ProjectDetail>(id ? await api.patch(`/projects/${id}`, body) : await api.post('/projects', body)));

export type MemberInput = { employeeId: string; role: ProjectRole; leadEmployeeId?: string | null; allocation: number; nightShift?: boolean; billed?: boolean; startDate: string; endDate?: string | null };
export const useSaveMember = (projectId: string) =>
  useProjectMutation(async ({ id, ...body }: MemberInput & { id?: string }) =>
    unwrap<Assignment & { unassignedMembers: number }>(id ? await api.patch(`/projects/${projectId}/members/${id}`, body) : await api.post(`/projects/${projectId}/members`, body)),
  );
export const useRemoveMember = (projectId: string) =>
  useProjectMutation(async (memberId: string) => unwrap<{ unassignedMembers: number }>(await api.delete(`/projects/${projectId}/members/${memberId}`)));

// ─── Planning: health, milestones, updates, roles, billing (no hours) ───

export type ProjectType = 'CLIENT' | 'INTERNAL';
export type Health = 'on_track' | 'at_risk' | 'off_track';
export type HealthLevel = Health | 'planned' | 'on_hold' | 'done';

export interface ProjectHealth {
  level: HealthLevel;
  computed: Health | null;
  reasons: string[];
  override: { health: Health; note: string; at: string } | null;
  updateOverdue: boolean;
}

/** A project you're not on: only that it exists */
export interface LimitedProject {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  type: ProjectType;
  color: string | null;
  description?: string | null;
  limited: true;
}

export interface PortfolioProject extends ProjectSummary {
  limited: false;
  type: ProjectType;
  color: string | null;
  team: ProjectPerson[];
  billedCount: number;
  health: ProjectHealth;
  milestones: { done: number; total: number; next: { title: string; dueDate: string } | null };
  openRoles: number;
  timePct: number | null;
  lastUpdate: { health: Health; at: string } | null;
}

export interface BillingSplit {
  date: string;
  headcount: number;
  onProjects: number;
  bench: number;
  billablePct: number;
  investmentPct: number;
  benchPct: number;
}

export interface PortfolioSummary {
  today: string;
  active: number;
  startingThisMonth: number;
  attention: { total: number; offTrack: number; atRisk: number; updatesOverdue: number };
  milestonesThisMonth: { total: number; done: number; overdue: number };
  endingSoon: Array<{ id: string; name: string; endDate: string }>;
  billing: BillingSplit;
  billingLastMonth: BillingSplit;
}

export interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  doneAt: string | null;
  owner: ProjectPerson | null;
}
export interface ProjectUpdate {
  id: string;
  health: Health;
  note: string;
  createdAt: string;
  author: ProjectPerson | null;
}
export interface OpenRole {
  id: string;
  title: string;
  allocation: number;
  fromDate: string;
  filledAt: string | null;
}
export interface ProjectActivity {
  id: string;
  kind: string;
  text: string;
  at: string;
  actor: ProjectPerson | null;
}

export interface ProjectPlan extends ProjectDetail {
  limited: false;
  type: ProjectType;
  color: string | null;
  health: ProjectHealth;
  milestones: Milestone[];
  updates: ProjectUpdate[];
  openRoles: OpenRole[];
  activity: ProjectActivity[];
  awayToday: string[];
  billedCount: number;
  timePct: number | null;
  canManage: boolean;
  canPlan: boolean;
}

export interface Timeline {
  from: string;
  to: string;
  today: string;
  projects: Array<PortfolioProject & { milestoneList: Array<{ id: string; title: string; dueDate: string; done: boolean }> }>;
  milestonesThisMonth: Array<{ id: string; title: string; dueDate: string; done: boolean; project: string }>;
  overlaps: Array<{ employee: ProjectPerson; projects: Array<{ code: string; name: string; allocation: number }>; total: number; from: string }>;
}

export interface PlannerCell {
  week: string;
  total: number;
  billable: number;
  investment: number;
  projects: Array<{ memberId: string; id: string; code: string; name: string; color: string | null; type: ProjectType; allocation: number; billed: boolean }>;
}
export interface Planner {
  from: string;
  to: string;
  today: string;
  weeks: string[];
  people: Array<{ employee: ProjectPerson & { department: { name: string } | null }; cells: PlannerCell[]; freeNextMonth: number; nowAllocated: number; rollingOff: { project: string; endDate: string } | null }>;
  counts: { full: number; partly: number; free: number; benchNextMonth: number };
  rollingOff: Array<{ employee: ProjectPerson; project: string; endDate: string }>;
  suggestions: Array<{ role: OpenRole & { project: { id: string; name: string; code: string } }; candidates: Array<{ employee: ProjectPerson; free: number }> }>;
}

export interface MyOverview {
  today: string;
  assignments: Array<{
    memberId: string;
    role: ProjectRole;
    allocation: number;
    billed: boolean;
    startDate: string;
    endDate: string | null;
    upcoming: boolean;
    project: { id: string; code: string; name: string; clientName: string | null; type: ProjectType; color: string | null; status: ProjectStatus; startDate: string; endDate: string | null };
    health: ProjectHealth;
    approver: (ProjectPerson & { as: string }) | null;
    nextMilestone: { title: string; dueDate: string } | null;
    lastUpdate: { health: Health; note: string; at: string; author: string | null } | null;
    team: ProjectPerson[];
    teamCount: number;
  }>;
  billing: { billable: number; investment: number; bench: number };
  freeFrom: { date: string; free: number } | null;
  milestones: Array<{ id: string; title: string; dueDate: string; project: string }>;
  away: Array<{ employee: ProjectPerson; startDate: string; endDate: string; projects: string[] }>;
}

export interface PortfolioQuery {
  status?: ProjectStatus;
  type?: ProjectType;
  health?: Health;
  managerId?: string;
  sort?: 'attention' | 'name' | 'end' | 'start';
  search?: string;
  page?: number;
}

const clean = (q: object) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));

export function usePortfolio(q: PortfolioQuery, enabled = true) {
  return useQuery({
    queryKey: projectKeys.list(q),
    queryFn: async () => (await api.get('/projects', { params: { limit: 100, ...clean(q) } })).data as { data: Array<PortfolioProject | LimitedProject>; meta: { total: number; page: number; limit: number; totalPages: number; today: string; seesAll: boolean } },
    placeholderData: keepPreviousData,
    enabled,
  });
}
export const usePortfolioSummary = (enabled = true) => useQuery({ queryKey: ['projects', 'summary'], queryFn: async () => unwrap<PortfolioSummary>(await api.get('/projects/summary')), enabled });
export const useProjectPlan = (id: string | undefined) =>
  useQuery({ queryKey: projectKeys.detail(id ?? ''), queryFn: async () => unwrap<ProjectPlan | LimitedProject>(await api.get(`/projects/${id}`)), enabled: Boolean(id), retry: false });
export const useTimeline = (q: { from?: string; months?: number }, enabled = true) =>
  useQuery({ queryKey: ['projects', 'timeline', q], queryFn: async () => unwrap<Timeline>(await api.get('/projects/timeline', { params: clean(q) })), enabled, placeholderData: keepPreviousData });
export const usePlanner = (q: { from?: string; weeks?: number; departmentId?: string; search?: string }, enabled = true) =>
  useQuery({ queryKey: ['projects', 'planner', q], queryFn: async () => unwrap<Planner>(await api.get('/projects/planner', { params: clean(q) })), enabled, placeholderData: keepPreviousData });
export const useAvailable = (q: { from: string; to: string; min: number; departmentId?: string } | null) =>
  useQuery({
    queryKey: ['projects', 'available', q],
    queryFn: async () => unwrap<Array<{ employee: ProjectPerson & { department: { name: string } | null }; free: number }>>(await api.get('/projects/available', { params: clean(q ?? {}) })),
    enabled: Boolean(q),
  });
export const useMyOverview = (enabled = true) => useQuery({ queryKey: ['projects', 'my-overview'], queryFn: async () => unwrap<MyOverview>(await api.get('/projects/my-overview')), enabled });
export const useBilling = (employeeId: string | undefined, enabled = true) =>
  useQuery({ queryKey: ['projects', 'billing', employeeId], queryFn: async () => unwrap<{ billable: number; investment: number; bench: number }>(await api.get(`/projects/billing/${employeeId}`)), enabled: Boolean(employeeId) && enabled });

export const useAddMilestone = (projectId: string) =>
  useProjectMutation(async (body: { title: string; dueDate: string; ownerEmployeeId?: string | null }) => unwrap(await api.post(`/projects/${projectId}/milestones`, body)));
export const useUpdateMilestone = (projectId: string) =>
  useProjectMutation(async ({ id, ...body }: { id: string; title?: string; dueDate?: string; ownerEmployeeId?: string | null; done?: boolean }) => unwrap(await api.patch(`/projects/${projectId}/milestones/${id}`, body)));
export const useRemoveMilestone = (projectId: string) => useProjectMutation(async (id: string) => unwrap(await api.delete(`/projects/${projectId}/milestones/${id}`)));
export const usePostUpdate = (projectId: string) => useProjectMutation(async (body: { health: Health; note: string }) => unwrap(await api.post(`/projects/${projectId}/updates`, body)));
export const useOpenRole = (projectId: string) =>
  useProjectMutation(async (body: { title: string; allocation: number; fromDate: string }) => unwrap(await api.post(`/projects/${projectId}/roles`, body)));
export const useCloseRole = (projectId: string) =>
  useProjectMutation(async ({ id, filled }: { id: string; filled: boolean }) => unwrap(await api.put(`/projects/${projectId}/roles/${id}`, undefined, { params: { filled } })));
export const useSetBilled = (projectId: string) =>
  useProjectMutation(async ({ memberId, billed }: { memberId: string; billed: boolean }) => unwrap(await api.put(`/projects/${projectId}/members/${memberId}/billed`, { billed })));
