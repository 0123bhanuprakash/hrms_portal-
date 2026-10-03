import { TicketPriority, TicketQueue } from '@prisma/client';

/** Response targets by priority, in clock hours. */
export const SLA_HOURS: Record<TicketPriority, { response: number; resolution: number }> = {
  URGENT: { response: 1, resolution: 8 },
  HIGH: { response: 4, resolution: 24 },
  MEDIUM: { response: 8, resolution: 72 },
  LOW: { response: 24, resolution: 120 },
};

/** Resolved tickets close themselves after this many days unless reopened. */
export const AUTO_CLOSE_DAYS = 7;

export const QUEUE_PERMISSION: Record<TicketQueue, string> = {
  IT: 'ticket.handle_it',
  HR: 'ticket.handle_hr',
  FINANCE: 'ticket.handle_finance',
};
export const QUEUE_LABEL: Record<TicketQueue, string> = { IT: 'IT', HR: 'HR', FINANCE: 'Finance' };
export const QUEUES = Object.keys(QUEUE_PERMISSION) as TicketQueue[];

export function dueDates(priority: TicketPriority, from: Date) {
  const h = SLA_HOURS[priority];
  return {
    firstResponseDueAt: new Date(from.getTime() + h.response * 3600_000),
    resolutionDueAt: new Date(from.getTime() + h.resolution * 3600_000),
  };
}
