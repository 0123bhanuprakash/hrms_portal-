'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccess } from '@/lib/access/use-access';
import { notificationKeys } from '@/lib/notifications';

// ============================================================
// Helpdesk: tickets to the IT, HR or Finance queue.
// ============================================================

export type Queue = 'IT' | 'HR' | 'FINANCE';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type Tone = 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'primary';

export const QUEUES: Queue[] = ['IT', 'HR', 'FINANCE'];
export const QUEUE_PERMISSION: Record<Queue, string> = { IT: 'ticket.handle_it', HR: 'ticket.handle_hr', FINANCE: 'ticket.handle_finance' };
export const QUEUE_INFO: Record<Queue, { label: string; text: string }> = {
  IT: { label: 'IT', text: 'Laptop, software, access, email, network' },
  HR: { label: 'HR', text: 'Leave, letters, policies, benefits, profile' },
  FINANCE: { label: 'Finance', text: 'Salary, payslips, reimbursements, tax' },
};
export const STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Open', tone: 'warning' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  WAITING: { label: 'Waiting for reply', tone: 'primary' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
};
export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  LOW: { label: 'Low', tone: 'neutral' },
  MEDIUM: { label: 'Medium', tone: 'info' },
  HIGH: { label: 'High', tone: 'warning' },
  URGENT: { label: 'Urgent', tone: 'danger' },
};
/** Same targets as the API (clock hours) */
export const SLA_HOURS: Record<Priority, { response: number; resolution: number }> = {
  URGENT: { response: 1, resolution: 8 },
  HIGH: { response: 4, resolution: 24 },
  MEDIUM: { response: 8, resolution: 72 },
  LOW: { response: 24, resolution: 120 },
};

export interface TicketCategory {
  id: string;
  queue: Queue;
  name: string;
  isActive: boolean;
  sortOrder: number;
}
interface Named {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface Ticket {
  id: string;
  number: number;
  queue: Queue;
  subject: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenCount: number;
  rating: number | null;
  ratingComment: string | null;
  lastActivityAt: string;
  createdAt: string;
  category: { id: string; name: string } | null;
  employee: { id: string; employeeId: string; firstName: string; lastName: string; email: string; avatarUrl: string | null; designation: { name: string } | null; department: { name: string } | null };
  assignee: Named | null;
  responseOverdue: boolean;
  resolutionOverdue: boolean;
  autoCloseAt: string | null;
  isAgent: boolean;
  isMine: boolean;
  canReply: boolean;
  canResolve: boolean;
  canReopen: boolean;
  canClose: boolean;
}

export interface TicketMessage {
  id: string;
  authorId: string | null;
  kind: 'REPLY' | 'NOTE' | 'EVENT';
  body: string;
  fileName: string | null;
  fileMime: string | null;
  fileSize: number | null;
  createdAt: string;
  author: Named | null;
  fromAgent: boolean;
}
export type TicketDetail = Ticket & { messages: TicketMessage[] };

export interface QueueSummary {
  queue: Queue;
  active: number;
  unassigned: number;
  waiting: number;
  overdue: number;
  created: number;
  resolved: number;
  responseOnTimePct: number | null;
  resolutionOnTimePct: number | null;
  avgRating: number | null;
  ratings: number;
}

export const helpdeskKeys = {
  all: ['helpdesk'] as const,
  categories: (all: boolean) => ['helpdesk', 'categories', all] as const,
  list: (q: object) => ['helpdesk', 'list', q] as const,
  ticket: (id: string) => ['helpdesk', 'ticket', id] as const,
  counts: ['helpdesk', 'counts'] as const,
  summary: ['helpdesk', 'summary'] as const,
  agents: (q: Queue) => ['helpdesk', 'agents', q] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;
type Page<T> = { data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } };
const clean = (q: object) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ''));

/** Queues the user works (agent). */
export function useMyQueues(): Queue[] {
  const { can } = useAccess();
  return QUEUES.filter((q) => can(QUEUE_PERMISSION[q]));
}

export function useTicketCategories(all = false, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: helpdeskKeys.categories(all),
    queryFn: async () => unwrap<TicketCategory[]>(await api.get('/helpdesk/categories', { params: all ? { all: true } : {} })),
    enabled: enabled && hasFeature('ops.helpdesk'),
    staleTime: 60_000,
  });
}

export type TicketQuery = {
  view: 'mine' | 'queue';
  queue?: Queue;
  status?: TicketStatus | 'active';
  assignee?: string;
  priority?: Priority;
  overdue?: 'true';
  search?: string;
  page?: number;
  limit?: number;
};
export function useTickets(q: TicketQuery, enabled = true) {
  const { hasFeature } = useAccess();
  return useQuery({
    queryKey: helpdeskKeys.list(q),
    queryFn: async () => (await api.get('/helpdesk/tickets', { params: clean(q) })).data as Page<Ticket>,
    placeholderData: keepPreviousData,
    enabled: enabled && hasFeature('ops.helpdesk'),
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({ queryKey: helpdeskKeys.ticket(id ?? ''), queryFn: async () => unwrap<TicketDetail>(await api.get(`/helpdesk/tickets/${id}`)), enabled: Boolean(id), retry: false });
}

/** Nav badges: { mine: tickets that need my reply / confirmation, queue: tickets that need an agent } */
export function useHelpdeskCounts() {
  const { hasFeature, can } = useAccess();
  return useQuery({
    queryKey: helpdeskKeys.counts,
    queryFn: async () => unwrap<{ mine: number; queue: number }>(await api.get('/helpdesk/counts')),
    enabled: hasFeature('ops.helpdesk') && can('ticket.view'),
    refetchInterval: 2 * 60_000,
  });
}

export function useHelpdeskSummary(enabled = true) {
  return useQuery({ queryKey: helpdeskKeys.summary, queryFn: async () => unwrap<{ days: number; queues: QueueSummary[] }>(await api.get('/helpdesk/summary')), enabled });
}

export function useQueueAgents(queue: Queue | undefined, enabled = true) {
  return useQuery({
    queryKey: helpdeskKeys.agents(queue ?? 'IT'),
    queryFn: async () => unwrap<Array<{ id: string; firstName: string; lastName: string; email: string }>>(await api.get(`/helpdesk/agents/${queue}`)),
    enabled: enabled && Boolean(queue),
    staleTime: 60_000,
  });
}

function useHelpdeskMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: helpdeskKeys.all });
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
function form(fields: Record<string, unknown>, file?: File | null) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') f.append(k, String(v));
  if (file) f.append('file', file);
  return f;
}

export const useCreateTicket = () =>
  useHelpdeskMutation(async ({ file, ...fields }: { queue: Queue; categoryId?: string; subject: string; description: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH'; file?: File | null }) =>
    unwrap<TicketDetail>(await api.post('/helpdesk/tickets', form(fields, file), multipart)),
  );
export const usePostMessage = (id: string) =>
  useHelpdeskMutation(async ({ file, ...fields }: { body: string; internal?: boolean; waitForEmployee?: boolean; file?: File | null }) =>
    unwrap<TicketDetail>(await api.post(`/helpdesk/tickets/${id}/messages`, form(fields, file), multipart)),
  );
export const useAssignTicket = (id: string) => useHelpdeskMutation(async (assigneeId: string | null) => unwrap<TicketDetail>(await api.post(`/helpdesk/tickets/${id}/assign`, { assigneeId })));
export const useUpdateTicket = (id: string) =>
  useHelpdeskMutation(async (body: { priority?: Priority; categoryId?: string | null; queue?: Queue }) => unwrap<TicketDetail | { id: string; moved: true; queue: Queue }>(await api.patch(`/helpdesk/tickets/${id}`, body)));
export const useResolveTicket = (id: string) => useHelpdeskMutation(async (resolution: string) => unwrap<TicketDetail>(await api.post(`/helpdesk/tickets/${id}/resolve`, { resolution })));
export const useReopenTicket = (id: string) => useHelpdeskMutation(async (reason: string) => unwrap<TicketDetail>(await api.post(`/helpdesk/tickets/${id}/reopen`, { reason })));
export const useCloseTicket = (id: string) =>
  useHelpdeskMutation(async (body: { rating?: number; comment?: string | null }) => unwrap<TicketDetail>(await api.post(`/helpdesk/tickets/${id}/close`, body)));
export const useSaveTicketCategory = () =>
  useHelpdeskMutation(async ({ id, ...body }: { id?: string; queue: Queue; name: string; isActive?: boolean }) =>
    unwrap<TicketCategory>(id ? await api.patch(`/helpdesk/categories/${id}`, body) : await api.post('/helpdesk/categories', body)),
  );

/** Opens an attachment (authorised download). */
export async function openAttachment(ticketId: string, m: TicketMessage) {
  const res = await api.get(`/helpdesk/tickets/${ticketId}/messages/${m.id}/file`, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  if (!/^(image\/|application\/pdf)/.test((res.data as Blob).type)) a.download = m.fileName ?? 'attachment';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/** "in 3h" / "2h overdue" for a due date */
export function dueText(iso: string): { text: string; late: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.round(abs / 3600_000);
  const span = abs < 3600_000 ? `${Math.max(1, Math.round(abs / 60_000))}m` : h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
  return ms < 0 ? { text: `${span} overdue`, late: true } : { text: `due in ${span}`, late: false };
}
