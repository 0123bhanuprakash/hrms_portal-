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

export type ProjectInput = { name: string; code: string; description?: string | null; clientName?: string | null; status: ProjectStatus; startDate: string; endDate?: string | null };
export const useSaveProject = () =>
  useProjectMutation(async ({ id, ...body }: ProjectInput & { id?: string }) => unwrap<ProjectDetail>(id ? await api.patch(`/projects/${id}`, body) : await api.post('/projects', body)));

export type MemberInput = { employeeId: string; role: ProjectRole; leadEmployeeId?: string | null; allocation: number; startDate: string; endDate?: string | null };
export const useSaveMember = (projectId: string) =>
  useProjectMutation(async ({ id, ...body }: MemberInput & { id?: string }) =>
    unwrap<Assignment & { unassignedMembers: number }>(id ? await api.patch(`/projects/${projectId}/members/${id}`, body) : await api.post(`/projects/${projectId}/members`, body)),
  );
export const useRemoveMember = (projectId: string) =>
  useProjectMutation(async (memberId: string) => unwrap<{ unassignedMembers: number }>(await api.delete(`/projects/${projectId}/members/${memberId}`)));
