import type { TicketPriority } from '@prisma/client';

/** Response targets by priority, in clock hours. */
export const SLA_HOURS: Record<TicketPriority, { response: number; resolution: number }> = {
  URGENT: { response: 1, resolution: 8 },
  HIGH: { response: 4, resolution: 24 },
  MEDIUM: { response: 8, resolution: 72 },
  LOW: { response: 24, resolution: 120 },
};

/** Resolved tickets close themselves after this many days unless reopened. */
export const AUTO_CLOSE_DAYS = 7;

/**
 * The four teams every company has. They are worked through role permissions
 * (ticket.handle_<team>) and can't be renamed or archived. Companies add their
 * own teams on top (HelpdeskTeam rows with `custom`), worked by picked members.
 */
export const QUEUES = ['IT', 'HR', 'FINANCE', 'DEVOPS'] as const;
export type BuiltInQueue = (typeof QUEUES)[number];
export const QUEUE_PERMISSION: Record<BuiltInQueue, string> = {
  IT: 'ticket.handle_it',
  HR: 'ticket.handle_hr',
  FINANCE: 'ticket.handle_finance',
  DEVOPS: 'ticket.handle_devops',
};
export const QUEUE_LABEL: Record<BuiltInQueue, string> = { IT: 'IT', HR: 'HR', FINANCE: 'Finance', DEVOPS: 'DevOps' };
export const QUEUE_EMOJI: Record<BuiltInQueue, string> = { IT: '💻', HR: '🧑‍💼', FINANCE: '💰', DEVOPS: '🚀' };
export const QUEUE_TEXT: Record<BuiltInQueue, string> = {
  IT: 'Laptop, software, access, email, network',
  HR: 'Leave, letters, policies, benefits, profile',
  FINANCE: 'Salary, payslips, reimbursements, tax',
  DEVOPS: 'Servers, deployments, CI/CD, cloud access',
};
export const isBuiltIn = (queue: string): queue is BuiltInQueue => (QUEUES as readonly string[]).includes(queue);

/** Team keys in URLs and DTOs: the built-in four or a generated key ("T" + 8 hex). */
export const QUEUE_KEY = /^(IT|HR|FINANCE|DEVOPS|T[0-9A-F]{8})$/;

export function dueDates(priority: TicketPriority, from: Date) {
  const h = SLA_HOURS[priority];
  return {
    firstResponseDueAt: new Date(from.getTime() + h.response * 3600_000),
    resolutionDueAt: new Date(from.getTime() + h.resolution * 3600_000),
  };
}
