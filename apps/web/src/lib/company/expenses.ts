'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { notificationKeys } from '@/lib/notifications';

// ============================================================
// Expense claims: draft → manager → Finance + HR → paid.
// Amounts come from the API in paise.
// ============================================================

export type ClaimStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED' | 'CANCELLED';
export type Stage = 'MANAGER' | 'FINANCE' | 'HR';

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  maxPerItemPaise: number | null;
  receiptRequiredAbovePaise: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface Named {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ExpenseItem {
  id: string;
  date: string;
  description: string;
  amountPaise: number;
  approvedPaise: number | null;
  adjustReason: string | null;
  receiptName: string | null;
  hasReceipt: boolean;
  category: { id: string; name: string };
  possibleDuplicate?: { claimId: string; title: string } | null;
}

export interface Claim {
  id: string;
  title: string;
  status: ClaimStatus;
  round: number;
  project: { id: string; name: string; code: string } | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  paymentDate: string | null;
  paymentReference: string | null;
  createdAt: string;
  employee: { id: string; employeeId: string; firstName: string; lastName: string; avatarUrl: string | null; designation: { name: string } | null; department: { name: string } | null };
  items: ExpenseItem[];
  totals: { claimedPaise: number; approvedPaise: number; items: number };
  steps: Array<{ stage: Stage; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'; label: string | null; approvers: Named[]; actedBy: Named | null; onBehalfOf: Named | null; comments: string | null; actedAt: string | null }>;
  canEdit: boolean;
  canCancel: boolean;
  canDecide: boolean;
  decideStage: Stage | null;
  canAdjust: boolean;
  canPay: boolean;
}

export interface ExpenseReport {
  from: string;
  to: string;
  totals: { claimedPaise: number; approvedPaise: number; paidPaise: number; items: number };
  byCategory: ReportRow[];
  byEmployee: ReportRow[];
  byProject: ReportRow[];
}
interface ReportRow {
  key: string;
  label: string;
  claimedPaise: number;
  approvedPaise: number;
  items: number;
}

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'primary' }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING: { label: 'Waiting for approval', tone: 'warning' },
  APPROVED: { label: 'Approved — to be paid', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  REJECTED: { label: 'Sent back', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
export const STAGE_LABEL: Record<Stage, string> = { MANAGER: 'Manager', FINANCE: 'Finance', HR: 'HR' };

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
/** 40050 → "₹400.50" */
export const money = (paise: number | null | undefined) => inr.format((paise ?? 0) / 100);

export const expenseKeys = {
  all: ['expenses'] as const,
  categories: (all: boolean) => ['expenses', 'categories', all] as const,
  claims: (q: object) => ['expenses', 'claims', q] as const,
  claim: (id: string) => ['expenses', 'claim', id] as const,
  pending: ['expenses', 'pending'] as const,
  report: (q: object) => ['expenses', 'report', q] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
type Page<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } };

export function useExpenseCategories(all = false, enabled = true) {
  return useQuery({ queryKey: expenseKeys.categories(all), queryFn: async () => unwrap<ExpenseCategory[]>(await api.get('/expenses/categories', { params: all ? { all: true } : {} })), enabled, staleTime: 60_000 });
}

export function useClaims(q: { view: 'mine' | 'review' | 'all' | 'payable'; status?: ClaimStatus; page?: number; limit?: number }, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: expenseKeys.claims(q),
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined));
      return (await api.get('/expenses/claims', { params })).data as Page<Claim>;
    },
    placeholderData: keepPreviousData,
    enabled: enabled && hasFeature('ops.expenses'),
  });
}

export function useClaim(id: string | undefined) {
  return useQuery({ queryKey: expenseKeys.claim(id ?? ''), queryFn: async () => unwrap<Claim>(await api.get(`/expenses/claims/${id}`)), enabled: Boolean(id), retry: false });
}

/** Claims waiting for me (manager step / Finance / HR) — nav badge. */
export function usePendingExpenses() {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: expenseKeys.pending,
    queryFn: async () => unwrap<{ count: number }>(await api.get('/expenses/claims/pending-count')).count,
    enabled: hasFeature('ops.expenses'),
    refetchInterval: 2 * 60_000,
  });
}

export function useExpenseReport(q: { from: string; to: string }, enabled = true) {
  return useQuery({ queryKey: expenseKeys.report(q), queryFn: async () => unwrap<ExpenseReport>(await api.get('/expenses/report', { params: q })), enabled, placeholderData: keepPreviousData });
}

function useExpenseMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export const useSaveClaim = () =>
  useExpenseMutation(async ({ id, ...body }: { id?: string; title: string; projectId?: string | null }) =>
    unwrap<Claim>(id ? await api.patch(`/expenses/claims/${id}`, body) : await api.post('/expenses/claims', body)),
  );

export type ItemInput = { categoryId: string; date: string; description: string; amount: string; receipt?: File | null; removeReceipt?: boolean };
export const useSaveItem = (claimId: string) =>
  useExpenseMutation(async ({ id, receipt, ...fields }: ItemInput & { id?: string }) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, String(v));
    if (receipt) form.append('receipt', receipt);
    const cfg = { headers: { 'Content-Type': 'multipart/form-data' } };
    return unwrap<Claim>(id ? await api.patch(`/expenses/claims/${claimId}/items/${id}`, form, cfg) : await api.post(`/expenses/claims/${claimId}/items`, form, cfg));
  });

export const useRemoveItem = (claimId: string) => useExpenseMutation(async (itemId: string) => unwrap<Claim>(await api.delete(`/expenses/claims/${claimId}/items/${itemId}`)));
export const useSubmitClaim = () => useExpenseMutation(async (id: string) => unwrap<Claim>(await api.post(`/expenses/claims/${id}/submit`)));
export const useCancelClaim = () => useExpenseMutation(async (id: string) => unwrap<Claim>(await api.post(`/expenses/claims/${id}/cancel`)));
export const useApproveClaim = () =>
  useExpenseMutation(async ({ id, ...body }: { id: string; note?: string | null; adjustments?: Array<{ itemId: string; approvedAmount: number; reason: string }> }) =>
    unwrap<Claim>(await api.post(`/expenses/claims/${id}/approve`, body)),
  );
export const useRejectClaim = () => useExpenseMutation(async ({ id, reason }: { id: string; reason: string }) => unwrap<Claim>(await api.post(`/expenses/claims/${id}/reject`, { reason })));
export const usePayClaim = () =>
  useExpenseMutation(async ({ id, ...body }: { id: string; paymentDate: string; reference: string }) => unwrap<Claim>(await api.post(`/expenses/claims/${id}/pay`, body)));

export const useSaveCategory = () =>
  useExpenseMutation(async ({ id, ...body }: { id?: string; name: string; description?: string | null; maxPerItem?: number | null; receiptRequiredAbove?: number | null; isActive?: boolean; sortOrder?: number }) =>
    unwrap<ExpenseCategory>(id ? await api.patch(`/expenses/categories/${id}`, body) : await api.post('/expenses/categories', body)),
  );

async function saveBlob(url: string, name: string, params?: object) {
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

/** Opens a receipt (authorised download). */
export async function openReceipt(claimId: string, item: ExpenseItem) {
  const res = await api.get(`/expenses/claims/${claimId}/items/${item.id}/receipt`, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  if (!/^(image\/|application\/pdf)/.test((res.data as Blob).type)) a.download = item.receiptName ?? 'receipt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export const downloadExpensesCsv = (from: string, to: string) => saveBlob('/expenses/export', `expenses-${from}-to-${to}.csv`, { from, to });
