'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { accessKeys } from '@/lib/access/use-access';
import type { Employee, EmployeeStage, EmployeesQuery } from '@/lib/company/org';

// ─── Employee lifecycle: stages, attention, history, checklists, bulk, org health ───

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

export const lifecycleKeys = {
  summary: ['org', 'lifecycle'] as const,
  board: ['org', 'board'] as const,
  health: ['org', 'health'] as const,
  nextId: ['org', 'next-id'] as const,
  history: (id: string) => ['employee', id, 'history'] as const,
  glance: (id: string) => ['employee', id, 'glance'] as const,
  checklist: (id: string, kind: ChecklistKind) => ['employee', id, 'checklist', kind] as const,
};

export type ChecklistKind = 'joining' | 'exit';
export const EXIT_REASONS = [
  { id: 'resigned', label: 'Resigned' },
  { id: 'let_go', label: 'Let go' },
  { id: 'contract_end', label: 'Contract ended' },
  { id: 'retired', label: 'Retired' },
  { id: 'other', label: 'Other' },
] as const;
export type ExitReason = (typeof EXIT_REASONS)[number]['id'];
export const exitReasonLabel = (r: string | null | undefined) => EXIT_REASONS.find((x) => x.id === r)?.label ?? null;

export interface AttentionItem {
  key: 'probation' | 'internships' | 'exits' | 'no-manager' | 'profiles';
  tone: 'warning' | 'danger' | 'info' | 'primary';
  title: string;
  detail: string;
  people: Array<{ id: string; name: string; avatarUrl: string | null; date?: string | null }>;
  action: string;
}

export interface LifecycleSummary {
  seesExits: boolean;
  counts: { all: number; joining: number; probation: number; active: number; notice: number | null; left: number | null };
  attention: AttentionItem[];
  /** When an internship ends: remind HR, or convert to Full-time automatically */
  internshipEndAction: InternshipEndAction;
  /** May change internshipEndAction (HR / Company Admin) */
  managesInternships: boolean;
}

export type InternshipEndAction = 'remind' | 'convert';
export const CONVERT_TYPES = [
  { id: 'FULL_TIME', label: 'Full-time' },
  { id: 'PART_TIME', label: 'Part-time' },
  { id: 'CONTRACT', label: 'Contract' },
] as const;
export type ConvertType = (typeof CONVERT_TYPES)[number]['id'];

export interface BoardPerson extends Pick<Employee, 'id' | 'firstName' | 'lastName' | 'avatarUrl' | 'employeeId' | 'employmentStatus' | 'employmentType' | 'joiningDate' | 'confirmationDate' | 'internshipEndDate' | 'terminationDate' | 'exitReason' | 'stage' | 'profilePercent' | 'checklist'> {
  userId: string;
  designation: { name: string } | null;
  department: { name: string } | null;
}

export interface EmployeeBoard {
  seesExits: boolean;
  today: string;
  lanes: Array<{ stage: EmployeeStage; total: number; people: BoardPerson[] }>;
}

export interface HistoryItem {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  at: string;
  effectiveOn: string | null;
  by: string | null;
  note?: string | null;
  upcoming?: boolean;
}

export interface Glance {
  leave: { days: number; items: Array<{ name: string; days: number }> } | null;
  attendance: { pct: number | null; present: number; workdays: number; late: number } | null;
  projects: { count: number; items: Array<{ name: string; allocation: number }> } | null;
  assets: { count: number; items: string[] } | null;
  completion: { percent: number; items: Array<{ key: string; label: string; done: boolean }> } | null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  doneAt: string | null;
  doneBy: string | null;
}

export interface OrgHealth {
  items: Array<{
    key: string;
    tone: 'warning' | 'info' | 'neutral' | 'danger';
    title: string;
    detail: string;
    /** The first 12 people (see `count`) */
    people?: Array<{ id: string; firstName: string; lastName: string; name: string; avatarUrl: string | null }>;
    departments?: Array<{ id: string; name: string }>;
    /** Everyone affected */
    count: number;
    fix: 'reporting' | 'departments' | 'employees';
  }>;
  stats: { headcount: number; managers: number; avgSpan: number; widestSpan: number; levels: number; departments: number; spans: Record<'1–2' | '3–5' | '6–8' | '9+', number> };
}

export interface BulkResult {
  action: string;
  updated: number;
  skipped: Array<{ id: string; name: string | null; reason: string }>;
}

// ─── Queries ────────────────────────────────────────────────

export const useLifecycleSummary = (enabled = true) =>
  useQuery({ queryKey: lifecycleKeys.summary, queryFn: async () => unwrap<LifecycleSummary>(await api.get('/employees/lifecycle')), enabled });

export const useEmployeeBoard = (enabled = true) =>
  useQuery({ queryKey: lifecycleKeys.board, queryFn: async () => unwrap<EmployeeBoard>(await api.get('/employees/board')), enabled });

export const useEmployeeHistory = (id: string, enabled = true) =>
  useQuery({ queryKey: lifecycleKeys.history(id), queryFn: async () => unwrap<HistoryItem[]>(await api.get(`/employees/${id}/history`)), enabled: Boolean(id) && enabled, retry: false });

export const useEmployeeGlance = (id: string, enabled = true) =>
  useQuery({ queryKey: lifecycleKeys.glance(id), queryFn: async () => unwrap<Glance>(await api.get(`/employees/${id}/glance`)), enabled: Boolean(id) && enabled, retry: false });

export const useChecklist = (id: string | null, kind: ChecklistKind) =>
  useQuery({ queryKey: lifecycleKeys.checklist(id ?? '', kind), queryFn: async () => unwrap<ChecklistItem[]>(await api.get(`/employees/${id}/checklist`, { params: { kind } })), enabled: Boolean(id), retry: false });

export const useNextEmployeeId = (enabled = true) =>
  useQuery({ queryKey: lifecycleKeys.nextId, queryFn: async () => unwrap<{ employeeId: string }>(await api.get('/employees/next-id')), enabled, staleTime: 0 });

export const useOrgHealth = (enabled = true) =>
  useQuery({ queryKey: lifecycleKeys.health, queryFn: async () => unwrap<OrgHealth>(await api.get('/org/health')), enabled });

// ─── Mutations ──────────────────────────────────────────────

function useLifecycleMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org'] });
      void qc.invalidateQueries({ queryKey: ['employee'] });
      void qc.invalidateQueries({ queryKey: ['reports'] });
      void qc.invalidateQueries({ queryKey: accessKeys.me });
    },
  });
}

export const useConfirmProbation = () =>
  useLifecycleMutation(async ({ id, note }: { id: string; note?: string }) => unwrap(await api.post(`/employees/${id}/confirm`, { note })));
export const useExtendProbation = () =>
  useLifecycleMutation(async ({ id, until, note }: { id: string; until: string; note?: string }) => unwrap(await api.post(`/employees/${id}/extend-probation`, { until, note })));
export const useConvertIntern = () =>
  useLifecycleMutation(async ({ id, ...body }: { id: string; employmentType: ConvertType; startDate?: string; probationEnd?: string; designationId?: string; note?: string }) => unwrap(await api.post(`/employees/${id}/convert`, body)));
export const useExtendInternship = () =>
  useLifecycleMutation(async ({ id, until, note }: { id: string; until: string; note?: string }) => unwrap(await api.post(`/employees/${id}/extend-internship`, { until, note })));
export const useInternshipSettings = () =>
  useLifecycleMutation(async (internshipEndAction: InternshipEndAction) => unwrap<{ internshipEndAction: InternshipEndAction }>(await api.put('/employees/internship-settings', { internshipEndAction })));
export const useStartNotice = () =>
  useLifecycleMutation(async ({ id, ...body }: { id: string; lastDay: string; reason: ExitReason; note?: string }) => unwrap(await api.post(`/employees/${id}/notice`, body)));
export const useWithdrawNotice = () =>
  useLifecycleMutation(async ({ id, note }: { id: string; note?: string }) => unwrap(await api.post(`/employees/${id}/withdraw-notice`, { note })));
export const useMarkLeft = () =>
  useLifecycleMutation(async ({ id, ...body }: { id: string; lastDay?: string; reason?: ExitReason; note?: string }) => unwrap(await api.post(`/employees/${id}/left`, body)));
export const useBulkEmployees = () =>
  useLifecycleMutation(async (body: { ids: string[]; action: 'manager' | 'department' | 'location' | 'remind'; value?: string | null }) => unwrap<BulkResult>(await api.post('/employees/bulk', body)));

export function useTickChecklist(id: string, kind: ChecklistKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, done }: { itemId: string; done: boolean }) => unwrap<ChecklistItem[]>(await api.patch(`/employees/${id}/checklist/${itemId}`, { done })),
    onSuccess: (items) => {
      qc.setQueryData(lifecycleKeys.checklist(id, kind), items);
      void qc.invalidateQueries({ queryKey: ['org'] });
    },
  });
}

export function useAddChecklistItem(id: string, kind: ChecklistKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) => unwrap<ChecklistItem[]>(await api.post(`/employees/${id}/checklist`, { kind, label })),
    onSuccess: (items) => {
      qc.setQueryData(lifecycleKeys.checklist(id, kind), items);
      void qc.invalidateQueries({ queryKey: ['org'] });
    },
  });
}

/** Downloads the filtered list as CSV. */
export async function downloadEmployeesCsv(q: EmployeesQuery) {
  const params = Object.fromEntries(Object.entries(q).filter(([k, v]) => v !== undefined && v !== '' && k !== 'page' && k !== 'limit'));
  const res = await api.get('/employees/export', { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Small shared helpers ───────────────────────────────────

const DAY = 86_400_000;
/** "2.9 yrs", "5 mo", "3 wks", "—" (not joined yet) */
export function tenure(joiningDate: string, until?: string | null): string {
  const end = until ? new Date(until).getTime() : Date.now();
  const days = Math.floor((end - new Date(joiningDate).getTime()) / DAY);
  if (days < 0) return '—';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) return `${Math.round(days / 7)} wks`;
  if (days < 365) return `${Math.round(days / 30.44)} mo`;
  const y = days / 365.25;
  return `${y < 10 ? y.toFixed(1).replace(/\.0$/, '') : Math.round(y)} yr${y >= 1.05 ? 's' : ''}`;
}

/** Whole days from today to a YYYY-MM-DD date (negative = past). */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = new Date();
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime() - t) / DAY);
}

export const STAGES: Array<{ id: EmployeeStage; label: string; dot: string; tone: 'primary' | 'warning' | 'success' | 'danger' | 'neutral' }> = [
  { id: 'joining', label: 'Joining soon', dot: 'bg-primary', tone: 'primary' },
  { id: 'probation', label: 'Probation', dot: 'bg-warning', tone: 'warning' },
  { id: 'active', label: 'Active', dot: 'bg-success', tone: 'success' },
  { id: 'notice', label: 'Notice period', dot: 'bg-destructive', tone: 'danger' },
  { id: 'left', label: 'Left', dot: 'bg-muted-foreground', tone: 'neutral' },
];
export const stageMeta = (s: EmployeeStage | undefined) => STAGES.find((x) => x.id === s) ?? STAGES[2]!;
