import { describe, expect, it } from 'vitest';
import { attentionFor, healthOf, setupOf, stageOf } from './company-health';

const facts = { departments: 3, employees: 20, hasAttendancePolicy: true, leaveTypes: 5, holidays: 0, hasLogo: false };

describe('company health', () => {
  it('setup is the share of steps done', () => {
    const s = setupOf(facts);
    expect(s.percent).toBe(67);
    expect(s.items.find((i) => i.key === 'holidays')?.done).toBe(false);
  });

  it('health mixes activity and setup; suspended and inactive are capped', () => {
    expect(healthOf({ status: 'ACTIVE', users: 10, activeUsers7d: 10, setupPercent: 100 })).toEqual({ score: 100, label: 'healthy' });
    expect(healthOf({ status: 'ACTIVE', users: 10, activeUsers7d: 5, setupPercent: 50 }).label).toBe('watch');
    expect(healthOf({ status: 'ACTIVE', users: 0, activeUsers7d: 0, setupPercent: 17 }).label).toBe('at_risk');
    expect(healthOf({ status: 'SUSPENDED', users: 10, activeUsers7d: 10, setupPercent: 100 }).score).toBe(15);
    expect(healthOf({ status: 'INACTIVE', users: 10, activeUsers7d: 10, setupPercent: 100 }).score).toBe(35);
  });

  it('stages follow sign-ins and setup', () => {
    expect(stageOf({ status: 'ACTIVE', everActive: false, setupPercent: 0 })).toBe('invited');
    expect(stageOf({ status: 'ACTIVE', everActive: true, setupPercent: 67 })).toBe('setting_up');
    expect(stageOf({ status: 'ACTIVE', everActive: true, setupPercent: 100 })).toBe('live');
    expect(stageOf({ status: 'SUSPENDED', everActive: true, setupPercent: 100 })).toBe('paused');
  });

  it('attention: most serious first', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    const base = { users: 5, employees: 5, maxEmployees: null, setupPercent: 100, holidays: 3, lastActivity: now, statusSince: new Date('2026-10-01T00:00:00Z') };
    const list = attentionFor(
      [
        { ...base, id: 'a', name: 'Acme', status: 'SUSPENDED' },
        { ...base, id: 'b', name: 'Beta', status: 'ACTIVE', setupPercent: 17, employees: 0 },
        { ...base, id: 'c', name: 'Core', status: 'ACTIVE', holidays: 0, setupPercent: 83 },
        { ...base, id: 'd', name: 'Delta', status: 'ACTIVE', employees: 95, maxEmployees: 100 },
        { ...base, id: 'e', name: 'Echo', status: 'ACTIVE', lastActivity: new Date('2026-09-20T00:00:00Z') },
        { ...base, id: 'f', name: 'Fine', status: 'ACTIVE' },
      ],
      now,
    );
    expect(list.map((x) => x.kind)).toEqual(['suspended', 'near_limit', 'no_activity', 'setup', 'no_holidays']);
    expect(list[0]!.detail).toContain('3 days');
    expect(list.find((x) => x.companyId === 'f')).toBeUndefined();
  });
});
