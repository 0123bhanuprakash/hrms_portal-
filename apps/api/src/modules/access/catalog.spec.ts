import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_FEATURES,
  broader,
  CATALOG,
  DEFAULT_PLANS,
  DELEGABLE_PERMISSIONS,
  FEATURE_BY_KEY,
  featureOf,
  PERMISSION_BY_KEY,
  ROLE_TEMPLATES,
  SCOPE_ORDER,
} from './catalog';

// The catalog is the source of truth for permissions, plans and role templates;
// a typo here silently grants nothing, so check it is consistent.
describe('access catalog', () => {
  it('has unique feature and permission keys', () => {
    const features = CATALOG.flatMap((m) => m.features.map((f) => f.key));
    expect(new Set(features).size).toBe(features.length);
    const perms = CATALOG.flatMap((m) => m.features.flatMap((f) => f.permissions.map((p) => p.key)));
    expect(new Set(perms).size).toBe(perms.length);
  });

  it('role templates only grant permissions that exist, at scopes they allow', () => {
    for (const role of ROLE_TEMPLATES) {
      for (const [key, scope] of role.grants) {
        const perm = PERMISSION_BY_KEY.get(key);
        expect(perm, `${role.key} grants unknown permission ${key}`).toBeDefined();
        if (scope) expect(perm!.scopes, `${role.key}: ${key} can't be scoped to ${scope}`).toContain(scope);
        else expect(perm!.scopes.length === 0 || perm!.scopes.includes('company'), `${role.key}: ${key} needs a scope`).toBe(true);
      }
    }
  });

  it('permission prerequisites exist', () => {
    for (const [key, perm] of PERMISSION_BY_KEY) {
      for (const req of perm.requires ?? []) expect(PERMISSION_BY_KEY.has(req), `${key} requires unknown ${req}`).toBe(true);
    }
  });

  it('plans only include real, available features', () => {
    for (const plan of DEFAULT_PLANS) {
      for (const f of plan.features) {
        expect(FEATURE_BY_KEY.has(f), `${plan.key} has unknown feature ${f}`).toBe(true);
        expect(AVAILABLE_FEATURES, `${plan.key} includes coming-soon ${f}`).toContain(f);
      }
    }
  });

  it('delegable permissions exist', () => {
    for (const k of DELEGABLE_PERMISSIONS) expect(PERMISSION_BY_KEY.has(k)).toBe(true);
  });

  it('maps permissions to features', () => {
    expect(featureOf('ticket.handle_it')).toBe('ops.helpdesk');
    expect(featureOf('timesheet.approve')).toBe('work.timesheets');
    expect(featureOf('nope.nothing')).toBeUndefined();
  });

  it('broader picks the wider scope; null (unscoped) loses to any scope', () => {
    expect(broader('own', 'company')).toBe('company');
    expect(broader('company', 'direct_reports')).toBe('company');
    expect(broader(null, 'own')).toBe('own');
    expect(broader('all_reports', null)).toBe('all_reports');
    expect(SCOPE_ORDER[0]).toBe('own');
    expect(SCOPE_ORDER[SCOPE_ORDER.length - 1]).toBe('company');
  });
});
