'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================
// Reports & analytics (people, attendance & leave, utilisation).
// ============================================================

type Count = { label: string; count: number };
interface Mini {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  employeeId?: string;
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
  probation: Array<Mini & { joiningDate: string; confirmationDate: string | null }>;
  notice: Array<Mini & { terminationDate: string | null }>;
}

export interface AttendanceReport {
  month: string;
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
}

export interface UtilisationReport {
  from: string;
  to: string;
  asOf: string;
  workingDays: number;
  hoursPerDay: number;
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
  }>;
  projects: Array<{ project: { id: string; code: string; name: string; clientName: string | null; status: string }; members: number; fte: number; loggedMinutes: number; billableMinutes: number }>;
}

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

export const reportKeys = {
  people: ['reports', 'people'] as const,
  attendance: (month: string) => ['reports', 'attendance', month] as const,
  utilisation: (q: object) => ['reports', 'utilisation', q] as const,
};

export function usePeopleReport(enabled = true) {
  return useQuery({ queryKey: reportKeys.people, queryFn: async () => unwrap<PeopleReport>(await api.get('/reports/people')), enabled, staleTime: 60_000 });
}

export function useAttendanceReport(month: string, enabled = true) {
  return useQuery({ queryKey: reportKeys.attendance(month), queryFn: async () => unwrap<AttendanceReport>(await api.get('/reports/attendance', { params: { month } })), enabled, placeholderData: keepPreviousData, staleTime: 60_000 });
}

export function useUtilisationReport(q: { from?: string; to?: string }, enabled = true) {
  return useQuery({
    queryKey: reportKeys.utilisation(q),
    queryFn: async () => unwrap<UtilisationReport>(await api.get('/reports/utilisation', { params: Object.fromEntries(Object.entries(q).filter(([, v]) => v)) })),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

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
