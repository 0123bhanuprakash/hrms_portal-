'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { notificationKeys } from '@/lib/notifications';

// ============================================================
// Assets: the register (IT), who holds what, and asset requests
// that the IT head and HR approve in parallel.
// ============================================================

export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'IN_REPAIR' | 'RETIRED' | 'LOST';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';
export type SideStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
type Tone = 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'primary';

export interface AssetType {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  sortOrder: number;
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
  employee: Person;
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
  createdAt: string;
  updatedAt: string;
  type: { id: string; name: string; prefix: string };
  holder: Assignment | null;
  canManage: boolean;
  history?: Assignment[];
}

export interface HeldAsset extends Assignment {
  asset: { id: string; tag: string; name: string; brand: string | null; model: string | null; serialNumber: string | null; type: { name: string } };
}

export interface AssetRequest {
  id: string;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  type: { id: string; name: string };
  employee: Person & { department: { name: string } | null };
  it: { status: SideStatus; by: Named | null; at: string | null; note: string | null };
  hr: { status: SideStatus; by: Named | null; at: string | null; note: string | null };
  asset: { id: string; tag: string; name: string } | null;
  canDecide: boolean;
  decideAs: 'IT' | 'HR' | null;
  canFulfil: boolean;
  canCancel: boolean;
}

export interface AssetSummary {
  byStatus: Partial<Record<AssetStatus, number>>;
  byType: Array<{ type: AssetType; total: number; available: number }>;
  warrantyEndingSoon: number;
  unconfirmed: number;
  requestsToFulfil: number;
}

export const ASSET_STATUS: Record<AssetStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  ASSIGNED: { label: 'Assigned', tone: 'info' },
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
  REJECTED: { label: 'Rejected', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const assetKeys = {
  all: ['assets'] as const,
  types: (all: boolean) => ['assets', 'types', all] as const,
  list: (q: object) => ['assets', 'list', q] as const,
  asset: (id: string) => ['assets', 'asset', id] as const,
  mine: ['assets', 'mine'] as const,
  employee: (id: string) => ['assets', 'employee', id] as const,
  summary: ['assets', 'summary'] as const,
  requests: (q: object) => ['assets', 'requests', q] as const,
  pending: ['assets', 'pending'] as const,
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

export type AssetQuery = { status?: AssetStatus; typeId?: string; employeeId?: string; search?: string; warrantyWithinDays?: number; page?: number; limit?: number };
export function useAssets(q: AssetQuery, enabled = true) {
  return useQuery({ queryKey: assetKeys.list(q), queryFn: async () => (await api.get('/assets', { params: clean(q) })).data as Page<Asset>, placeholderData: keepPreviousData, enabled });
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

export type RequestQuery = { view: 'mine' | 'review' | 'all' | 'fulfil'; status?: RequestStatus; page?: number; limit?: number };
export function useAssetRequests(q: RequestQuery, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: assetKeys.requests(q),
    queryFn: async () => (await api.get('/assets/requests', { params: clean(q) })).data as Page<AssetRequest>,
    placeholderData: keepPreviousData,
    enabled: enabled && hasFeature('ops.assets'),
  });
}

/** Requests waiting for me (IT head / HR) plus, for IT, approved ones to hand over — nav badge. */
export function usePendingAssetRequests() {
  const { hasFeature, can } = useAccess();
  return useQuery({
    queryKey: assetKeys.pending,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/assets/requests/pending-count')).count,
    enabled: hasFeature('ops.assets') && (can('asset.approve_it') || can('asset.approve_hr') || can('asset.manage')),
    refetchInterval: 2 * 60_000,
  });
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
};
export const useSaveAsset = () =>
  useAssetMutation(async ({ id, ...body }: AssetInput & { id?: string }) => unwrap<Asset>(id ? await api.patch(`/assets/${id}`, body) : await api.post('/assets', body)));
export const useAssignAsset = () =>
  useAssetMutation(async ({ id, ...body }: { id: string; employeeId: string; condition?: AssetCondition; notes?: string | null; requestId?: string }) =>
    unwrap<Asset>(await api.post(`/assets/${id}/assign`, body)),
  );
export const useReturnAsset = () =>
  useAssetMutation(async ({ id, ...body }: { id: string; condition: AssetCondition; notes?: string | null }) => unwrap<Asset>(await api.post(`/assets/${id}/return`, body)));
export const useSetAssetStatus = () =>
  useAssetMutation(async ({ id, ...body }: { id: string; status: 'AVAILABLE' | 'IN_REPAIR' | 'LOST' | 'RETIRED'; notes?: string | null }) =>
    unwrap<Asset>(await api.post(`/assets/${id}/status`, body)),
  );
export const useAcknowledgeAsset = () => useAssetMutation(async (assignmentId: string) => unwrap<unknown>(await api.post(`/assets/assignments/${assignmentId}/acknowledge`)));

export const useSaveAssetType = () =>
  useAssetMutation(async ({ id, ...body }: { id?: string; name: string; prefix: string; isActive?: boolean }) =>
    unwrap<AssetType>(id ? await api.patch(`/assets/types/${id}`, body) : await api.post('/assets/types', body)),
  );

export const useRequestAsset = () => useAssetMutation(async (body: { typeId: string; reason: string }) => unwrap<AssetRequest>(await api.post('/assets/requests', body)));
export const useApproveAssetRequest = () =>
  useAssetMutation(async ({ id, note }: { id: string; note?: string | null }) => unwrap<AssetRequest>(await api.post(`/assets/requests/${id}/approve`, { note: note || null })));
export const useRejectAssetRequest = () =>
  useAssetMutation(async ({ id, reason }: { id: string; reason: string }) => unwrap<AssetRequest>(await api.post(`/assets/requests/${id}/reject`, { reason })));
export const useCancelAssetRequest = () => useAssetMutation(async (id: string) => unwrap<AssetRequest>(await api.post(`/assets/requests/${id}/cancel`)));
