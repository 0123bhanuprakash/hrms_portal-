'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LIVE } from '@/lib/live';
import { orgKeys } from '@/lib/company/org';

// ============================================================
// Self-service profile, private data (masked), documents,
// people directory and spotlight.
// ============================================================

export interface PersonBasic {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
}

export interface ProfileCompletion {
  percent: number;
  items: Array<{ key: string; label: string; done: boolean }>;
}

export interface MyCard {
  employee:
    | (PersonBasic & {
        joiningDate: string;
        employmentType: string;
        employmentStatus: string;
        reportingManager: PersonBasic | null;
        subordinates: PersonBasic[];
        directReportCount: number;
      })
    | null;
  completion: ProfileCompletion | null;
}

export interface Address {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface PrivateProfile {
  id: string;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  personal: {
    personalEmail: string | null;
    bloodGroup: string | null;
    maritalStatus: string | null;
    currentAddress: Address | null;
    permanentAddress: Address | null;
    emergencyContactName: string | null;
    emergencyContactRelation: string | null;
    emergencyContactPhone: string | null;
    updatedAt: string;
  } | null;
  bank: {
    accountHolderName: string;
    accountNumberMasked: string;
    ifscCode: string;
    bankName: string;
    branchName: string;
    updatedAt: string;
  } | null;
  statutory: {
    panMasked: string | null;
    aadhaarMasked: string | null;
    uan: string | null;
    esicNumber: string | null;
    pfAccountNo: string | null;
    taxRegime: 'OLD' | 'NEW';
    updatedAt: string;
  } | null;
  canEdit: boolean;
}

export interface EmployeeDocument {
  id: string;
  category: string;
  name: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string } | null;
  canDelete: boolean;
}

export interface Spotlight {
  windowDays: number;
  birthdays: Array<PersonBasic & { date: string; inDays: number }>;
  anniversaries: Array<PersonBasic & { date: string; inDays: number; years: number }>;
  newJoiners: Array<PersonBasic & { joiningDate: string }>;
  holidays: Array<{ id: string; name: string; date: string; isOptional: boolean }>;
}

/** Today, as everyone sees it (never the leave type or reason). */
export type TodayStatus = 'in' | 'wfh' | 'away' | 'out' | 'not_in' | 'off';
export interface Today {
  status: TodayStatus;
  since: string | null;
}

export interface DirectoryPerson extends PersonBasic {
  reportingManager: { id: string; firstName: string; lastName: string } | null;
  joiningDate?: string;
  today?: Today;
  flags?: { birthdayToday: boolean; newJoinerDays: number | null; anniversaryYears: number | null };
}

export interface DirectoryPage {
  data: DirectoryPerson[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    /** Quick-chip counts (whole match, before the status / group filter) */
    counts?: Record<TodayStatus | 'everyone' | 'new' | 'mine', number>;
    /** First letters that have someone (A–Z rail) */
    letters?: string[];
  };
}

export interface PeopleHighlights {
  date: string;
  workingDay: boolean;
  holiday: string | null;
  total: number;
  counts: Record<TodayStatus, number>;
  away: PersonBasic[];
  newJoiners: Array<PersonBasic & { joiningDate: string }>;
  birthdays: Array<PersonBasic & { date: string; inDays: number }>;
}

export interface PersonCard extends PersonBasic {
  joiningDate: string;
  today: Today;
  reportingManager: PersonBasic | null;
  subordinates: PersonBasic[];
  directReportCount: number;
  teammates: PersonBasic[];
  teammateCount: number;
  /** MM-DD (never the year) */
  birthday: string | null;
  anniversary: { date: string; years: number };
  kudos: { total: number; thisMonth: number };
  thisWeek: Array<{ date: string; day: 'in' | 'wfh' | 'away' | 'off' | 'none' | 'later' }>;
}

export const DOCUMENT_CATEGORIES: Record<string, string> = {
  ID_PROOF: 'ID proof',
  ADDRESS_PROOF: 'Address proof',
  EDUCATION: 'Education',
  EMPLOYMENT: 'Previous employment',
  OFFER_LETTER: 'Offer letter',
  CONTRACT: 'Contract',
  OTHER: 'Other',
};
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const MARITAL_STATUSES = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER'];

export const profileKeys = {
  me: ['people', 'me'] as const,
  private: (id: string) => ['employee', id, 'private'] as const,
  documents: (id: string) => ['employee', id, 'documents'] as const,
  employee: (id: string) => ['employee', id] as const,
  directory: (q: object) => ['people', 'directory', q] as const,
  spotlight: ['people', 'spotlight'] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

// ─── Queries ────────────────────────────────────────────────

export function useMyCard(enabled = true) {
  return useQuery({ queryKey: profileKeys.me, queryFn: async () => unwrap<MyCard>(await api.get('/people/me')), enabled, staleTime: 60_000 });
}

export function usePrivateProfile(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: profileKeys.private(id ?? ''),
    queryFn: async () => unwrap<PrivateProfile>(await api.get(`/employees/${id}/private`)),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useDocuments(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: profileKeys.documents(id ?? ''),
    queryFn: async () => unwrap<{ canUpload: boolean; documents: EmployeeDocument[] }>(await api.get(`/employees/${id}/documents`)),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useSpotlight(enabled = true) {
  return useQuery({ queryKey: profileKeys.spotlight, queryFn: async () => unwrap<Spotlight>(await api.get('/people/spotlight')), enabled, staleTime: 5 * 60_000 });
}

export function useDirectory(q: { search?: string; departmentId?: string; locationId?: string; status?: TodayStatus; group?: 'new' | 'mine'; sort?: 'name' | 'joined'; letter?: string; page?: number; limit?: number }, enabled = true) {
  return useQuery({
    queryKey: profileKeys.directory(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));
      return (await api.get('/people', { params })).data as DirectoryPage;
    },
    placeholderData: keepPreviousData,
    enabled,
    ...LIVE,
  });
}

export function usePeopleHighlights(enabled = true) {
  // Who's in changes through the day
  return useQuery({ queryKey: ['people', 'highlights'], queryFn: async () => (await api.get('/people/highlights')).data.data as PeopleHighlights, enabled, ...LIVE });
}

export function usePersonCard(id: string | null) {
  return useQuery({ queryKey: ['people', 'card', id], queryFn: async () => (await api.get(`/people/${id}/card`)).data.data as PersonCard, enabled: Boolean(id), ...LIVE });
}

// ─── Mutations ──────────────────────────────────────────────

/** Profile edits can change the home checklist, lists, chart and spotlight. */
function useProfileMutation<V, R>(id: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.private(id) });
      void qc.invalidateQueries({ queryKey: profileKeys.employee(id) });
      void qc.invalidateQueries({ queryKey: profileKeys.me });
      void qc.invalidateQueries({ queryKey: ['people'] });
      void qc.invalidateQueries({ queryKey: orgKeys.employeesAll });
      void qc.invalidateQueries({ queryKey: orgKeys.chart });
    },
  });
}

export type PersonalInput = Partial<{
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  personalEmail: string | null;
  bloodGroup: string | null;
  maritalStatus: string | null;
  currentAddress: Address | null;
  permanentAddress: Address | null;
  emergencyContactName: string | null;
  emergencyContactRelation: string | null;
  emergencyContactPhone: string | null;
}>;

export const useUpdatePersonal = (id: string) =>
  useProfileMutation(id, async (body: PersonalInput) => unwrap(await api.put(`/employees/${id}/personal`, body)));

export const useUpdateBank = (id: string) =>
  useProfileMutation(id, async (body: { accountHolderName: string; accountNumber: string; ifscCode: string; bankName: string; branchName?: string | null }) =>
    unwrap(await api.put(`/employees/${id}/bank`, body)),
  );

export const useUpdateStatutory = (id: string) =>
  useProfileMutation(id, async (body: Partial<{ pan: string | null; aadhaar: string | null; uan: string | null; esicNumber: string | null; pfAccountNo: string | null; taxRegime: 'OLD' | 'NEW' }>) =>
    unwrap(await api.put(`/employees/${id}/statutory`, body)),
  );

export const useUploadAvatar = (id: string) =>
  useProfileMutation(id, async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<{ avatarUrl: string }>(await api.post(`/employees/${id}/avatar`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  });

export const useRemoveAvatar = (id: string) => useProfileMutation(id, async () => unwrap(await api.delete(`/employees/${id}/avatar`)));

/** Full PAN + account number (audited). Not cached. */
export async function revealPrivate(id: string): Promise<{ pan: string | null; accountNumber: string | null }> {
  return unwrap(await api.post(`/employees/${id}/private/reveal`));
}

export function useUploadDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { file: File; category: string; name?: string }) => {
      const form = new FormData();
      form.append('file', v.file);
      form.append('category', v.category);
      if (v.name) form.append('name', v.name);
      return unwrap<EmployeeDocument>(await api.post(`/employees/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.documents(id) }),
  });
}

export function useDeleteDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => unwrap(await api.delete(`/employees/${id}/documents/${documentId}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.documents(id) }),
  });
}

/** Downloads through the API (authorised + audited), then saves via a blob link. */
export async function downloadDocument(employeeId: string, doc: EmployeeDocument): Promise<void> {
  const res = await api.get(`/employees/${employeeId}/documents/${doc.id}/download`, { responseType: 'blob' }).catch(async (err) => {
    // Errors arrive as a Blob too — turn them back into JSON so messages show normally
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        err.response.data = JSON.parse(await data.text());
      } catch {
        err.response.data = {};
      }
    }
    throw err;
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Employee record (GET /employees/:id, scoped) ──────────

export interface EmployeeRecord extends PersonBasic {
  userId: string;
  phone: string | null;
  employmentType: string;
  employmentStatus: string;
  joiningDate: string;
  confirmationDate: string | null;
  terminationDate: string | null;
  reportingManager: { id: string; employeeId: string; firstName: string; lastName: string; email: string } | null;
  subordinates: Array<{ id: string; employeeId: string; firstName: string; lastName: string; email: string; designation: { name: string } | null }>;
  user: { id: string; email: string; status: string; lastLoginAt: string | null } | null;
}

export function useEmployeeRecord(id: string | undefined) {
  return useQuery({
    queryKey: profileKeys.employee(id ?? ''),
    queryFn: async () => unwrap<EmployeeRecord>(await api.get(`/employees/${id}`)),
    enabled: Boolean(id),
    retry: false,
  });
}
