'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================
// Reports & analytics: overview, people, attendance & leave,
// utilisation, "who is behind this number", emailed schedules.
// Every number is limited to the people the caller may see;
// department / location filters narrow it further.
// ============================================================

type Count = { key?: string; label: string; count: number };
interface Mini {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  employeeId?: string;
}

export interface ReportFilters {
  departmentId?: string;
  locationId?: string;
}

export interface PeopleReport {
  asOf: string;
  headcount: number;
  upcomingJoiners: number;
  attritionPct: number;
  leavers12: number;
  joiners12: number;
  byDepartment: Count[];
  byLocation: Count[];
  byType: Count[];
  byStatus: Count[];
  byGender: Count[];
  byLevel: Count[];
  tenure: Count[];
  trend: Array<{ month: string; joiners: number; leavers: number; headcount: number }>;
  startHeadcount: number;
  avgTenureMonths: number;
  movements: Array<Mini & { kind: 'joined' | 'left'; date: string }>;
  probation: Array<Mini & { joiningDate: string; confirmationDate: string | null }>;
  notice: Array<Mini & { terminationDate: string | null }>;
  leaversByDepartment: Array<{ key: string; label: string; headcount: number; months: number[]; leavers: number; ratePct: number }>;
  anniversaries: Array<Mini & { date: string; years: number }>;
}

export interface AttendanceReport {
  month: string | null;
  from: string;
  to: string;
  headcount: number;
  workingDays: number;
  attendanceRatePct: number | null;
  byStatus: Partial<Record<string, number>>;
  wfhDays: number;
  lateArrivals: number;
  avgLateMinutes: number;
  avgWorkingMinutes: number;
  daily: Array<{ date: string; present: number; leave: number; absent: number }>;
  topLate: Array<{ employee: Mini | null; count: number; minutes: number }>;
  leaveByType: Array<{ type: { id: string; name: string; code: string }; days: number; requests: number }>;
  topLeave: Array<{ employee: Mini | null; days: number }>;
  lateByWeekday: number[];
  lateByWeekdayPrevious: number[];
  previous: { from: string; to: string };
  leaveBalances: {
    year: number;
    byType: Array<{ type: { id: string; name: string; code: string }; entitledDays: number; leftDays: number }>;
    plentyLeft: Array<{ employee: Mini | null; days: number; type: string }>;
  };
}

export interface UtilisationReport {
  from: string;
  to: string;
  asOf: string;
  workingDays: number;
  hoursPerDay: number;
  weeks: Array<{ start: string; end: string; capacityMinutes: number }>;
  timesheets: boolean;
  people: number;
  bench: number;
  partial: number;
  full: number;
  avgAllocationPct: number;
  utilisationPct: number | null;
  billablePct: number | null;
  internalMinutes: number | null;
  rows: Array<{
    employee: { id: string; employeeId: string; firstName: string; lastName: string; avatarUrl: string | null; department: string | null; designation: string | null };
    allocation: number;
    projects: Array<{ id: string; code: string; name: string; allocation: number; role: string }>;
    loggedMinutes: number | null;
    billableMinutes: number | null;
    utilisationPct: number | null;
    billablePct: number | null;
    weekly: Array<{ loggedMinutes: number; billableMinutes: number }> | null;
  }>;
  projects: Array<{ project: { id: string; code: string; name: string; clientName: string | null; status: string }; members: number; fte: number; loggedMinutes: number; billableMinutes: number }>;
}

export interface Kpi {
  value: number | null;
  previous: number | null;
  change: number | null;
}

export interface Highlight {
  key: string;
  tone: 'good' | 'bad' | 'warn' | 'info';
  icon: 'up' | 'down' | 'leave' | 'people' | 'clock';
  title: string;
  detail: string;
  tab: 'people' | 'attendance' | 'utilisation';
}

export interface ReportsOverview {
  from: string;
  to: string;
  previous: { from: string; to: string };
  kpis: { headcount: Kpi; attendanceRatePct: Kpi; leaveDays: Kpi; attritionPct: Kpi; billablePct: Kpi | null };
  monthly: Array<{ month: string; headcount: number; attendanceRatePct: number | null; leaveDays: number; attritionPct: number; billablePct: number | null }>;
  bridge: { start: number; joined: number; left: number; end: number; joiners: Mini[]; leavers: Mini[]; upcoming: Array<Mini & { joiningDate: string }> };
  highlights: Highlight[];
}

export interface DrillPerson extends Mini {
  employeeId: string;
  department: string | null;
  designation: string | null;
  location: string | null;
  status: string;
  joiningDate: string;
  terminationDate: string | null;
  tenureMonths: number;
}

export type DayPerson = Mini & { employeeId: string; department: string | null; checkIn: string | null; lateMinutes: number };
export interface AttendanceDay {
  date: string;
  workingDay: boolean;
  holiday: string | null;
  headcount: number;
  present: DayPerson[];
  late: DayPerson[];
  wfh: DayPerson[];
  leave: DayPerson[];
  absent: DayPerson[];
  notRecorded: DayPerson[];
}

export type ScheduleReport = 'overview' | 'people' | 'attendance' | 'utilisation';
export interface ReportSchedule {
  id: string;
  report: ScheduleReport;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  recipientIds: string[];
  recipients: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  attachCsv: boolean;
  filters: ReportFilters | null;
  active: boolean;
  nextRunAt: string;
  lastSentAt: string | null;
}
export type SaveSchedule = Omit<ReportSchedule, 'id' | 'recipients' | 'nextRunAt' | 'lastSentAt' | 'filters' | 'dayOfWeek' | 'dayOfMonth'> & ReportFilters & { dayOfWeek?: number; dayOfMonth?: number };

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const reportKeys = {
  all: ['reports'] as const,
  overview: (q: object) => ['reports', 'overview', q] as const,
  people: (f: ReportFilters = {}) => ['reports', 'people', f] as const,
  attendance: (q: object) => ['reports', 'attendance', q] as const,
  utilisation: (q: object) => ['reports', 'utilisation', q] as const,
  list: (q: object) => ['reports', 'people-list', q] as const,
  day: (q: object) => ['reports', 'attendance-day', q] as const,
  schedules: ['reports', 'schedules'] as const,
  recipients: ['reports', 'schedule-recipients'] as const,
};

export function useReportsOverview(q: { from?: string; to?: string } & ReportFilters, enabled = true) {
  return useQuery({ queryKey: reportKeys.overview(q), queryFn: async () => unwrap<ReportsOverview>(await api.get('/reports/overview', { params: clean(q) })), enabled, placeholderData: keepPreviousData, staleTime: 60_000 });
}

export function usePeopleReport(filters: ReportFilters | boolean = {}, enabled = true) {
  // Older callers pass `enabled` first
  const f = typeof filters === 'boolean' ? {} : filters;
  const on = typeof filters === 'boolean' ? filters : enabled;
  return useQuery({ queryKey: reportKeys.people(f), queryFn: async () => unwrap<PeopleReport>(await api.get('/reports/people', { params: clean(f) })), enabled: on, placeholderData: keepPreviousData, staleTime: 60_000 });
}

export function useAttendanceReport(q: string | ({ month?: string; from?: string; to?: string } & ReportFilters), enabled = true) {
  const params = typeof q === 'string' ? { month: q } : q;
  return useQuery({ queryKey: reportKeys.attendance(params), queryFn: async () => unwrap<AttendanceReport>(await api.get('/reports/attendance', { params: clean(params) })), enabled, placeholderData: keepPreviousData, staleTime: 60_000 });
}

export function useUtilisationReport(q: { from?: string; to?: string } & ReportFilters, enabled = true) {
  return useQuery({
    queryKey: reportKeys.utilisation(q),
    queryFn: async () => unwrap<UtilisationReport>(await api.get('/reports/utilisation', { params: clean(q) })),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function usePeopleList(q: ({ dimension: string; value: string } & ReportFilters) | null) {
  return useQuery({ queryKey: reportKeys.list(q ?? {}), queryFn: async () => unwrap<DrillPerson[]>(await api.get('/reports/people/list', { params: clean(q ?? {}) })), enabled: Boolean(q) });
}

export function useAttendanceDay(q: ({ date: string } & ReportFilters) | null) {
  return useQuery({ queryKey: reportKeys.day(q ?? {}), queryFn: async () => unwrap<AttendanceDay>(await api.get('/reports/attendance/day', { params: clean(q ?? {}) })), enabled: Boolean(q) });
}

export const useReportSchedules = (enabled = true) => useQuery({ queryKey: reportKeys.schedules, queryFn: async () => unwrap<ReportSchedule[]>(await api.get('/reports/schedules')), enabled });
export const useScheduleRecipients = (enabled = true) =>
  useQuery({ queryKey: reportKeys.recipients, queryFn: async () => unwrap<Array<{ id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null }>>(await api.get('/reports/schedules/recipients')), enabled, staleTime: 5 * 60_000 });

function useScheduleMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => void qc.invalidateQueries({ queryKey: reportKeys.schedules }) });
}
export const useSaveSchedule = () =>
  useScheduleMutation(async ({ id, ...body }: SaveSchedule & { id?: string }) => unwrap<ReportSchedule>(id ? await api.put(`/reports/schedules/${id}`, clean(body)) : await api.post('/reports/schedules', clean(body))));
export const useDeleteSchedule = () => useScheduleMutation(async (id: string) => unwrap<{ id: string }>(await api.delete(`/reports/schedules/${id}`)));
export const useSendSchedule = () => useScheduleMutation(async (id: string) => unwrap<{ sent: number }>(await api.post(`/reports/schedules/${id}/send`)));

export async function downloadCsv(url: string, name: string, params?: object) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** A CSV made in the browser (e.g. the people behind a number). */
export function saveCsv(rows: unknown[][], name: string) {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s;
  };
  const href = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const LABELS: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
  ACTIVE: 'Active',
  PROBATION: 'Probation',
  NOTICE_PERIOD: 'Notice period',
  ON_LEAVE: 'On leave',
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
  NOT_SET: 'Not set',
};
export const label = (k: string) => LABELS[k] ?? k;
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
export const monthLabel = (ym: string) => monthFmt.format(new Date(`${ym}-01T00:00:00Z`));
