'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { accessKeys } from '@/lib/access/use-access';

// ─── Types ──────────────────────────────────────────────────

export interface OrgLevel {
  id: string;
  name: string;
  rank: number;
  color: string | null;
  designationCount?: number;
}

export interface ChartEmployee {
  id: string;
  /** Sign-in account (for pickers such as delegation) */
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  employmentStatus: string;
  reportingManagerId: string | null;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string; orgLevel: OrgLevel | null } | null;
  location: { id: string; name: string } | null;
  directReports: number;
  /** Not joined yet (only shown to org managers) */
  joinsOn?: string | null;
}

export interface OrgChart {
  employees: ChartEmployee[];
  levels: OrgLevel[];
}

export interface ReportingPreview {
  valid: boolean;
  unchanged?: boolean;
  reason?: string;
  moving: Array<{ id: string; name: string; depth: number }>;
  from?: string | null;
  to?: string | null;
  changes: Array<{ employeeId: string; name: string; effect: 'gains' | 'loses' | 'keeps'; relation: string; via: string | null }>;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  headEmployeeId: string | null;
  _count?: { employees: number };
}

export interface Designation {
  id: string;
  name: string;
  level: number;
  orgLevelId: string | null;
  orgLevel: OrgLevel | null;
  _count?: { employees: number };
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  isDefault: boolean;
  _count?: { employees: number };
}

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl?: string | null;
  employmentType: string;
  employmentStatus: string;
  joiningDate: string;
  departmentId: string | null;
  designationId: string | null;
  locationId: string | null;
  reportingManagerId: string | null;
  department: Department | null;
  designation: Designation | null;
  location: OfficeLocation | null;
  reportingManager: { id: string; firstName: string; lastName: string; email: string } | null;
  userId?: string;
  confirmationDate?: string | null;
  terminationDate?: string | null;
  exitReason?: string | null;
  /** Lifecycle stage as this viewer may see it */
  stage?: EmployeeStage;
  /** Profile completeness — null when the viewer may not see private details */
  profilePercent?: number | null;
  checklist?: { kind: 'joining' | 'exit'; done: number; total: number } | null;
}

export type EmployeeStage = 'joining' | 'probation' | 'active' | 'notice' | 'left';

export interface EmployeesPage {
  data: Employee[];
  meta: { total: number; page: number; limit: number; totalPages: number; seesExits?: boolean };
}

// ─── Keys ───────────────────────────────────────────────────

export const orgKeys = {
  chart: ['org', 'chart'] as const,
  levels: ['org', 'levels'] as const,
  departments: ['org', 'departments'] as const,
  designations: ['org', 'designations'] as const,
  locations: ['org', 'locations'] as const,
  employees: (q: object) => ['org', 'employees', q] as const,
  employeesAll: ['org', 'employees'] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

/** Any org change can affect the chart, lists and the caller's own access. */
function useOrgMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org'] });
      void qc.invalidateQueries({ queryKey: accessKeys.me });
    },
  });
}

// ─── Chart & reporting lines ────────────────────────────────

export const useOrgChart = () => useQuery({ queryKey: orgKeys.chart, queryFn: async () => unwrap<OrgChart>(await api.get('/org/chart')) });

export const useReportingPreview = () =>
  useMutation({
    mutationFn: async (body: { employeeId: string; managerId: string | null }) => unwrap<ReportingPreview>(await api.post('/org/reporting-line/preview', body)),
  });

export const useSetReportingLine = () =>
  useOrgMutation(async (body: { employeeId: string; managerId: string | null }) => unwrap<OrgChart>(await api.put('/org/reporting-line', body)));

// ─── Levels ─────────────────────────────────────────────────

export const useOrgLevels = () => useQuery({ queryKey: orgKeys.levels, queryFn: async () => unwrap<OrgLevel[]>(await api.get('/org/levels')) });
export const useCreateLevel = () => useOrgMutation(async (body: { name: string; color?: string }) => unwrap<OrgLevel[]>(await api.post('/org/levels', body)));
export const useSuggestedLevels = () => useOrgMutation(async () => unwrap<OrgLevel[]>(await api.post('/org/levels/suggested')));
export const useUpdateLevel = () =>
  useOrgMutation(async ({ id, ...body }: { id: string; name: string; color?: string }) => unwrap<OrgLevel[]>(await api.put(`/org/levels/${id}`, body)));
export const useDeleteLevel = () => useOrgMutation(async (id: string) => unwrap<OrgLevel[]>(await api.delete(`/org/levels/${id}`)));
export const useReorderLevels = () => useOrgMutation(async (ids: string[]) => unwrap<OrgLevel[]>(await api.put('/org/levels/order', { ids })));

// ─── Departments / designations / locations ─────────────────

export const useDepartments = () => useQuery({ queryKey: orgKeys.departments, queryFn: async () => unwrap<Department[]>(await api.get('/departments')) });
export const useSaveDepartment = () =>
  useOrgMutation(async ({ id, ...body }: { id?: string; name: string; code: string; parentDepartmentId?: string | null; headEmployeeId?: string | null }) =>
    unwrap<Department>(id ? await api.patch(`/departments/${id}`, body) : await api.post('/departments', body)),
  );
export const useDeleteDepartment = () => useOrgMutation(async (id: string) => unwrap<unknown>(await api.delete(`/departments/${id}`)));

export const useDesignations = () => useQuery({ queryKey: orgKeys.designations, queryFn: async () => unwrap<Designation[]>(await api.get('/designations')) });
export const useSaveDesignation = () =>
  useOrgMutation(async ({ id, ...body }: { id?: string; name: string; orgLevelId?: string | null }) =>
    unwrap<Designation>(id ? await api.patch(`/designations/${id}`, body) : await api.post('/designations', body)),
  );
export const useDeleteDesignation = () => useOrgMutation(async (id: string) => unwrap<unknown>(await api.delete(`/designations/${id}`)));

export const useLocations = () => useQuery({ queryKey: orgKeys.locations, queryFn: async () => unwrap<OfficeLocation[]>(await api.get('/office-locations')) });
export const useSaveLocation = () =>
  useOrgMutation(async ({ id, ...body }: { id?: string; name: string; city?: string; state?: string; country?: string; address?: string; isDefault?: boolean }) =>
    unwrap<OfficeLocation>(id ? await api.patch(`/office-locations/${id}`, body) : await api.post('/office-locations', body)),
  );
export const useDeleteLocation = () => useOrgMutation(async (id: string) => unwrap<unknown>(await api.delete(`/office-locations/${id}`)));

// ─── Employees ──────────────────────────────────────────────

export interface EmployeesQuery {
  search?: string;
  departmentId?: string;
  locationId?: string;
  employmentType?: string;
  status?: string;
  stage?: EmployeeStage | 'current' | 'all';
  /** Direct reports of / "none" */
  managerId?: string;
  sort?: 'recent' | 'name' | 'joined' | 'joined_desc' | 'probation' | 'last_day';
  page?: number;
  limit?: number;
}

export function useEmployees(q: EmployeesQuery) {
  return useQuery({
    queryKey: orgKeys.employees(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));
      const res = (await api.get('/employees', { params })).data;
      // List responses come as { data, meta }
      return (res.meta ? res : res.data) as EmployeesPage;
    },
    placeholderData: keepPreviousData,
  });
}

export type EmployeeInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  joiningDate: string;
  employmentType?: string;
  departmentId?: string | null;
  designationId?: string | null;
  locationId?: string | null;
  reportingManagerId?: string | null;
  employmentStatus?: string;
  confirmationDate?: string;
};

export const useCreateEmployee = () => useOrgMutation(async (body: EmployeeInput) => unwrap<Employee>(await api.post('/employees', body)));
export const useUpdateEmployee = () =>
  useOrgMutation(async ({ id, ...body }: Partial<EmployeeInput> & { id: string; employmentStatus?: string }) => unwrap<Employee>(await api.patch(`/employees/${id}`, body)));
