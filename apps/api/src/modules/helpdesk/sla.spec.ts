import { describe, expect, it } from 'vitest';
import { dueDates, QUEUE_PERMISSION, QUEUES, SLA_HOURS } from './sla';

describe('helpdesk response targets', () => {
  const raised = new Date('2026-10-05T10:00:00Z');

  it.each([
    ['URGENT', 1, 8],
    ['HIGH', 4, 24],
    ['MEDIUM', 8, 72],
    ['LOW', 24, 120],
  ] as const)('%s: first reply in %ih, resolved in %ih', (priority, response, resolution) => {
    const d = dueDates(priority, raised);
    expect((d.firstResponseDueAt.getTime() - raised.getTime()) / 3600_000).toBe(response);
    expect((d.resolutionDueAt.getTime() - raised.getTime()) / 3600_000).toBe(resolution);
  });

  it('a reply is always due before resolution', () => {
    for (const h of Object.values(SLA_HOURS)) expect(h.response).toBeLessThan(h.resolution);
  });

  it('only IT, HR and Finance take tickets', () => {
    expect(QUEUES).toEqual(['IT', 'HR', 'FINANCE']);
    expect(QUEUE_PERMISSION.FINANCE).toBe('ticket.handle_finance');
  });
});
