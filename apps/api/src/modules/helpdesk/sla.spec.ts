import { describe, expect, it } from 'vitest';
import { dueDates, isBuiltIn, QUEUE_KEY, QUEUE_PERMISSION, QUEUES, SLA_HOURS } from './sla';

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

  it('IT, HR, Finance and DevOps are built in; company teams get generated keys', () => {
    expect(QUEUES).toEqual(['IT', 'HR', 'FINANCE', 'DEVOPS']);
    expect(isBuiltIn('HR')).toBe(true);
    expect(isBuiltIn('T0A1B2C3D')).toBe(false);
    expect(QUEUE_KEY.test('T0A1B2C3D')).toBe(true);
    expect(QUEUE_KEY.test('hr')).toBe(false);
    expect(QUEUE_PERMISSION.FINANCE).toBe('ticket.handle_finance');
    expect(QUEUE_PERMISSION.DEVOPS).toBe('ticket.handle_devops');
  });
});
