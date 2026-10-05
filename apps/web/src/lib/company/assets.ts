'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { notificationKeys } from '@/lib/notifications';

// ============================================================
// Assets: the register (IT), who holds what (kept or on loan),
// requests approved team lead → manager → HR → IT head, starter
// kits for joiners, repairs, documents and the yearly check.
// ============================================================

export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_REPAIR' | 'RETIRED' | 'LOST';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';
export type StepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
export type Stage = 'LEAD' | 'MANAGER' | 'HR' | 'IT';
export type AssetIcon = 'laptop' | 'monitor' | 'phone' | 'idcard' | 'headset' | 'keyboard' | 'sim' | 'box';
export const ASSET_ICONS: AssetIcon[] = ['laptop', 'monitor', 'phone', 'idcard', 'headset', 'keyboard', 'sim', 'box'];
type Tone = 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'primary';

export interface AssetType {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  sortOrder: number;
  icon: AssetIcon;
  description: string | null;
  warrantyMonths: number | null;
  replaceAfterYears: number | null;
  minStock: number;
  requestable: boolean;
  loanable: boolean;
  maxLoanDays: number | null;
  fields: string[];
  checklist: string[];
}
export interface CatalogType extends AssetType {
  available: number;
}

interface Person {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  designation: { name: string } | null;
}
interface Named {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Assignment {
  id: string;
  assignedAt: string;
  conditionOut: AssetCondition;
  notes: string | null;
  acknowledgedAt: string | null;
  returnedAt: string | null;
  conditionIn: AssetCondition | null;
  returnNotes: string | null;
  requestId: string | null;
  dueBack: string | null;
  employee: Person;
}

export interface Repair {
  id: string;
  issue: string;
  vendor: string | null;
  costPaise: number | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
}

export interface Asset {
  id: string;
  tag: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseCostPaise: number | null;
  vendor: string | null;
  warrantyUntil: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  locationId: string | null;
  notes: string | null;
  specs: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  type: { id: string; name: string; prefix: string; icon: AssetIcon; fields: string[]; checklist: string[]; replaceAfterYears: number | null; loanable: boolean; maxLoanDays: number | null };
  holder: Assignment | null;
  openRepair: { id: string; issue: string; vendor: string | null; startedAt: string } | null;
  dueSoon: boolean;
  overdue: boolean;
  replaceDue: boolean;
  canManage: boolean;
  history?: Assignment[];
  repairs?: Repair[];
  documents?: Array<{ id: string; name: string; mime: string; size: number; createdAt: string }>;
}

export interface HeldAsset extends Assignment {
  asset: { id: string; tag: string; name: string; brand: string | null; model: string | null; serialNumber: string | null; warrantyUntil: string | null; condition: AssetCondition; type: { name: string; icon: AssetIcon } };
  openTickets: Array<{ id: string; number: number; status: string; subject: string }>;
}

export interface RequestStep {
  stage: Stage;
  label: string;
  status: StepStatus;
  approver: Named | null;
  by: Named | null;
  at: string | null;
  note: string | null;
}

export interface AssetRequest {
  id: string;
  reason: string;
  status: RequestStatus;
  source: 'REQUEST' | 'KIT';
  kind: 'KEEP' | 'LOAN';
  loanFrom: string | null;
  loanUntil: string | null;
  neededBy: string | null;
  stage: Stage | null;
  createdAt: string;
  type: { id: string; name: string; icon: AssetIcon; checklist: string[]; loanable: boolean };
  employee: Person & { department: { name: string } | null; joiningDate: string };
  requestedBy: Named | null;
  steps: RequestStep[];
  asset: { id: string; tag: string; name: string } | null;
  canDecide: boolean;
  decideAs: Stage | null;
  canFulfil: boolean;
  canCancel: boolean;
}

export interface AssetSummary {
  total: number;
  boughtPaise: number;
  byStatus: Partial<Record<AssetStatus, number>>;
  byType: Array<{ type: { id: string; name: string; icon: AssetIcon; minStock: number; requestable: boolean }; total: number; available: number }>;
  warrantyEndingSoon: number;
  unconfirmed: number;
  requestsToFulfil: number;
  joinersToPrepare: number;
  attention: { warranty: number; repairLong: number; old: number; unconfirmed: number; loansDue: number; loansOverdue: number; outOfStock: Array<{ name: string; available: number; minStock: number }> };
  lostThisYear: { count: number; paise: number };
}

export interface KitRule {
  id: string;
  name: string;
  isBase: boolean;
  roleKeys: string[];
  designationContains: string | null;
  departmentIds: string[];
  items: Array<{ typeId: string; qty: number; type: { id: string; name: string; icon: AssetIcon } | null }>;
  onPromotion: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface MyCheck {
  id: string;
  name: string;
  dueOn: string;
  items: Array<{ assignmentId: string; asset: { id: string; tag: string; name: string; type: { icon: AssetIcon } }; answer: 'HAVE' | 'PROBLEM' | 'NOT_WITH_ME' | null; note: string | null }>;
  done: boolean;
}

export interface CheckOverview {
  open: { id: string; name: string; dueOn: string; startedAt: string } | null;
  progress: {
    people: number;
    done: number;
    reported: number;
    notAnswered: number;
    reports: Array<{ answer: string; note: string | null; answeredAt: string; employee: Person | null; asset: { id: string; tag: string; name: string } | null }>;
  } | null;
  past: Array<{ id: string; name: string; dueOn: string; startedAt: string; closedAt: string }>;
  canRun: boolean;
}

export interface Returns {
  today: string;
  leavers: Array<{ employee: Person & { employmentStatus: string; terminationDate: string | null }; assets: Array<{ id: string; asset: { id: string; tag: string; name: string; type: { name: string; icon: AssetIcon } } }> }>;
  loans: Array<{ id: string; dueBack: string; overdue: boolean; employee: Person; asset: { id: string; tag: string; name: string; type: { name: string; icon: AssetIcon } } }>;
}

export interface PersonAssets {
  employee: Person & { employmentStatus: string; terminationDate: string | null; department: { name: string } | null };
  assets: Array<{ id: string; assignedAt: string; acknowledgedAt: string | null; dueBack: string | null; asset: { id: string; tag: string; name: string; type: { name: string; icon: AssetIcon } } }>;
}

export const ASSET_STATUS: Record<AssetStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  ASSIGNED: { label: 'With someone', tone: 'info' },
  IN_REPAIR: { label: 'In repair', tone: 'warning' },
  RETIRED: { label: 'Retired', tone: 'neutral' },
  LOST: { label: 'Lost', tone: 'danger' },
};
export const CONDITION_LABEL: Record<AssetCondition, string> = { NEW: 'New', GOOD: 'Good', FAIR: 'Fair', POOR: 'Poor', DAMAGED: 'Damaged' };
export const CONDITIONS = Object.keys(CONDITION_LABEL) as AssetCondition[];
export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Waiting for approval', tone: 'warning' },
  APPROVED: { label: 'Approved — to hand over', tone: 'info' },
  FULFILLED: { label: 'Handed over', tone: 'success' },
  REJECTED: { label: 'Not approved', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
export const STAGE_LABEL: Record<Stage, string> = { LEAD: 'Team lead', MANAGER: 'Manager', HR: 'HR', IT: 'IT head' };

export const assetKeys = {
  all: ['assets'] as const,
  types: (all: boolean) => ['assets', 'types', all] as const,
  catalog: ['assets', 'catalog'] as const,
  list: (q: object) => ['assets', 'list', q] as const,
  people: (q: object) => ['assets', 'people', q] as const,
  asset: (id: string) => ['assets', 'asset', id] as const,
  mine: ['assets', 'mine'] as const,
  employee: (id: string) => ['assets', 'employee', id] as const,
  summary: ['assets', 'summary'] as const,
  requests: (q: object) => ['assets', 'requests', q] as const,
  preview: (forId: string) => ['assets', 'preview', forId] as const,
  matches: (id: string) => ['assets', 'matches', id] as const,
  pending: ['assets', 'pending'] as const,
  kits: ['assets', 'kits'] as const,
  kitPreview: (q: object) => ['assets', 'kit-preview', q] as const,
  returns: ['assets', 'returns'] as const,
  checks: ['assets', 'checks'] as const,
  myCheck: ['assets', 'checks', 'mine'] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
type Page<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } };
const clean = (q: object) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));

export function useAssetTypes(all = false, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: assetKeys.types(all),
    queryFn: async () => unwrap<AssetType[]>(await api.get('/assets/types', { params: all ? { all: true } : {} })),
    enabled: enabled && hasFeature('ops.assets'),
    staleTime: 60_000,
  });
}

export function useAssetCatalog(enabled = true) {
  return useQuery({ queryKey: assetKeys.catalog, queryFn: async () => unwrap<CatalogType[]>(await api.get('/assets/types/catalog')), enabled });
}

export type AssetQuery = { status?: AssetStatus; typeId?: string; employeeId?: string; locationId?: string; search?: string; warrantyWithinDays?: number; attention?: 'warranty' | 'repair' | 'old' | 'unconfirmed' | 'loans'; page?: number; limit?: number };
export function useAssets(q: AssetQuery, enabled = true) {
  return useQuery({ queryKey: assetKeys.list(q), queryFn: async () => (await api.get('/assets', { params: clean(q) })).data as Page<Asset>, placeholderData: keepPreviousData, enabled });
}

export function useAssetPeople(q: { search?: string; page?: number }, enabled = true) {
  return useQuery({ queryKey: assetKeys.people(q), queryFn: async () => (await api.get('/assets/people', { params: clean(q) })).data as Page<PersonAssets>, placeholderData: keepPreviousData, enabled });
}

export function useAsset(id: string | undefined) {
  return useQuery({ queryKey: assetKeys.asset(id ?? ''), queryFn: async () => unwrap<Asset>(await api.get(`/assets/${id}`)), enabled: Boolean(id), retry: false });
}

export function useMyAssets(enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({ queryKey: assetKeys.mine, queryFn: async () => unwrap<{ current: HeldAsset[]; past: HeldAsset[] }>(await api.get('/assets/mine')), enabled: enabled && hasFeature('ops.assets') });
}

export function useEmployeeAssets(employeeId: string, enabled = true) {
  return useQuery({
    queryKey: assetKeys.employee(employeeId),
    queryFn: async () => unwrap<{ current: HeldAsset[]; past: HeldAsset[] }>(await api.get(`/assets/employee/${employeeId}`)),
    enabled,
    retry: false,
  });
}

export function useAssetSummary(enabled = true) {
  return useQuery({ queryKey: assetKeys.summary, queryFn: async () => unwrap<AssetSummary>(await api.get('/assets/summary')), enabled });
}

export type RequestQuery = { view: 'mine' | 'review' | 'all' | 'fulfil' | 'joiners'; status?: RequestStatus; page?: number; limit?: number };
export function useAssetRequests(q: RequestQuery, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: assetKeys.requests(q),
    queryFn: async () => (await api.get('/assets/requests', { params: clean(q) })).data as Page<AssetRequest>,
    placeholderData: keepPreviousData,
    enabled: enabled && hasFeature('ops.assets'),
  });
}

export function useRequestPreview(forEmployeeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: assetKeys.preview(forEmployeeId ?? 'me'),
    queryFn: async () =>
      unwrap<{ for: Named; steps: Array<{ stage: Stage; label: string; person: Named | null }>; team: Array<Named & { avatarUrl: string | null; joiningDate: string }> }>(
        await api.get('/assets/requests/preview', { params: forEmployeeId ? { forEmployeeId } : {} }),
      ),
    enabled,
    retry: false,
  });
}

export function useRequestMatches(requestId: string | undefined) {
  return useQuery({
    queryKey: assetKeys.matches(requestId ?? ''),
    queryFn: async () => unwrap<Array<{ id: string; tag: string; name: string; brand: string | null; model: string | null; condition: AssetCondition; warrantyUntil: string | null; purchaseDate: string | null }>>(await api.get(`/assets/requests/${requestId}/matches`)),
    enabled: Boolean(requestId),
  });
}

/** Requests waiting for me plus, for IT, approved ones to hand over — nav badge. */
export function usePendingAssetRequests() {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: assetKeys.pending,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/assets/requests/pending-count')).count,
    enabled: hasFeature('ops.assets'),
    refetchInterval: 2 * 60_000,
  });
}

export function useKits(enabled = true) {
  return useQuery({ queryKey: assetKeys.kits, queryFn: async () => unwrap<KitRule[]>(await api.get('/assets/kits')), enabled });
}

export function useKitPreview(q: { designationId?: string; departmentId?: string; roleKeys?: string }, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: assetKeys.kitPreview(q),
    queryFn: async () => unwrap<{ rules: string[]; items: Array<{ typeId: string; name: string; icon: AssetIcon; qty: number }> }>(await api.get('/assets/kits/preview', { params: clean(q) })),
    enabled: enabled && hasFeature('ops.assets'),
    retry: false,
  });
}

export function useAssetReturns(enabled = true) {
  return useQuery({ queryKey: assetKeys.returns, queryFn: async () => unwrap<Returns>(await api.get('/assets/returns')), enabled });
}

export function useCheckOverview(enabled = true) {
  return useQuery({ queryKey: assetKeys.checks, queryFn: async () => unwrap<CheckOverview>(await api.get('/assets/checks')), enabled });
}

export function useMyCheck(enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({ queryKey: assetKeys.myCheck, queryFn: async () => unwrap<MyCheck | null>(await api.get('/assets/checks/mine')), enabled: enabled && hasFeature('ops.assets') });
}

function useAssetMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: assetKeys.all });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export type AssetInput = {
  typeId: string;
  tag?: string | null;
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  vendor?: string | null;
  warrantyUntil?: string | null;
  condition?: AssetCondition;
  notes?: string | null;
  specs?: Record<string, string> | null;
};
export const useSaveAsset = () =>
  useAssetMutation(async ({ id, ...body }: AssetInput & { id?: string }) => unwrap<Asset>(id ? await api.patch(`/assets/${id}`, body) : await api.post('/assets', body)));
export const useAssignAsset = () =>
  useAssetMutation(async ({ id, ...body }: { id: string; employeeId: string; condition?: AssetCondition; notes?: string | null; requestId?: string; checklist?: string[]; dueBack?: string | null }) =>
    unwrap<Asset>(await api.post(`/assets/${id}/assign`, body)),
  );
export const useReturnAsset = () =>
  useAssetMutation(async ({ id, ...body }: { id: string; condition: AssetCondition; notes?: string | null }) => unwrap<Asset>(await api.post(`/assets/${id}/return`, body)));
export const useSetAssetStatus = () =>
  useAssetMutation(async ({ id, ...body }: { id: string; status: 'AVAILABLE' | 'IN_REPAIR' | 'LOST' | 'RETIRED'; notes?: string | null; issue?: string | null; vendor?: string | null; repairCost?: number | null }) =>
    unwrap<Asset>(await api.post(`/assets/${id}/status`, body)),
  );
export const useAcknowledgeAsset = () => useAssetMutation(async (assignmentId: string) => unwrap<unknown>(await api.post(`/assets/assignments/${assignmentId}/acknowledge`)));
export const useReportProblem = () =>
  useAssetMutation(async ({ assignmentId, description }: { assignmentId: string; description: string }) =>
    unwrap<{ ticket: { id: string; number: number } | null }>(await api.post(`/assets/assignments/${assignmentId}/problem`, { description })),
  );
export const useAskReturn = () =>
  useAssetMutation(async ({ assignmentId, note }: { assignmentId: string; note?: string }) => unwrap<{ sent: boolean }>(await api.post(`/assets/assignments/${assignmentId}/return-request`, { note: note || null })));
export const useBulkMove = () => useAssetMutation(async (body: { ids: string[]; locationId: string | null }) => unwrap<{ moved: number }>(await api.post('/assets/bulk/move', body)));
export const useImportAssets = () =>
  useAssetMutation(async (body: { csv: string; dryRun?: boolean }) =>
    unwrap<{ rows: number; valid: number; created: number; errors: Array<{ line: number; errors: string[] }> }>(await api.post('/assets/import', body)),
  );
export const useUploadAssetDocument = (assetId: string) =>
  useAssetMutation(async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<Asset>(await api.post(`/assets/${assetId}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  });
export const useRemoveAssetDocument = (assetId: string) => useAssetMutation(async (docId: string) => unwrap<Asset>(await api.delete(`/assets/${assetId}/documents/${docId}`)));

export type AssetTypeInput = Partial<Omit<AssetType, 'id'>> & { id?: string; name: string; prefix: string };
export const useSaveAssetType = () =>
  useAssetMutation(async ({ id, ...body }: AssetTypeInput) => unwrap<AssetType>(id ? await api.patch(`/assets/types/${id}`, body) : await api.post('/assets/types', body)));

export type RequestInput = { typeId: string; reason: string; forEmployeeId?: string | null; kind?: 'KEEP' | 'LOAN'; loanFrom?: string | null; loanUntil?: string | null; neededBy?: string | null };
export const useRequestAsset = () => useAssetMutation(async (body: RequestInput) => unwrap<AssetRequest>(await api.post('/assets/requests', body)));
export const useApproveAssetRequest = () =>
  useAssetMutation(async ({ id, note }: { id: string; note?: string | null }) => unwrap<AssetRequest>(await api.post(`/assets/requests/${id}/approve`, { note: note || null })));
export const useRejectAssetRequest = () =>
  useAssetMutation(async ({ id, reason }: { id: string; reason: string }) => unwrap<AssetRequest>(await api.post(`/assets/requests/${id}/reject`, { reason })));
export const useCancelAssetRequest = () => useAssetMutation(async (id: string) => unwrap<AssetRequest>(await api.post(`/assets/requests/${id}/cancel`)));

export type KitInput = { id?: string; name: string; isBase?: boolean; roleKeys?: string[]; designationContains?: string | null; departmentIds?: string[]; items: Array<{ typeId: string; qty: number }>; onPromotion?: boolean; isActive?: boolean };
export const useSaveKit = () => useAssetMutation(async ({ id, ...body }: KitInput) => unwrap<KitRule>(id ? await api.patch(`/assets/kits/${id}`, body) : await api.post('/assets/kits', body)));
export const useRemoveKit = () => useAssetMutation(async (id: string) => unwrap<unknown>(await api.delete(`/assets/kits/${id}`)));

export const useStartCheck = () => useAssetMutation(async (body: { name: string; dueOn: string }) => unwrap<CheckOverview>(await api.post('/assets/checks', body)));
export const useRemindCheck = () => useAssetMutation(async (id: string) => unwrap<{ reminded: number }>(await api.post(`/assets/checks/${id}/remind`)));
export const useCloseCheck = () => useAssetMutation(async (id: string) => unwrap<CheckOverview>(await api.post(`/assets/checks/${id}/close`)));
export const useAnswerCheck = () =>
  useAssetMutation(async (answers: Array<{ assignmentId: string; answer: 'HAVE' | 'PROBLEM' | 'NOT_WITH_ME'; note?: string | null }>) => unwrap<MyCheck | null>(await api.post('/assets/checks/answers', { answers })));

/** Opens an asset document (authorised download). */
export async function openAssetDocument(assetId: string, doc: { id: string; name: string }) {
  const res = await api.get(`/assets/${assetId}/documents/${doc.id}`, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  if (!/^(image\/|application\/pdf)/.test((res.data as Blob).type)) a.download = doc.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/** Days from today (company-agnostic, local) to a date key; negative = past. */
export const daysUntil = (key: string) => {
  const t = new Date();
  const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((Date.parse(`${key}T00:00:00Z`) - today) / 86_400_000);
};
