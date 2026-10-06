import { describe, expect, it } from 'vitest';
import { EXTRA_ROLE_TEMPLATES, PERMISSION_BY_KEY, ROLE_TEMPLATES } from './catalog';

describe('extra role templates (Recruiter, Payroll officer, …)', () => {
  it('are the five agreed ones', () => {
    expect(EXTRA_ROLE_TEMPLATES.map((t) => t.key)).toEqual(['recruiter', 'payroll_officer', 'office_admin', 'auditor', 'intern']);
  });

  for (const t of EXTRA_ROLE_TEMPLATES) {
    it(`${t.key}: every grant is a real permission with an allowed scope`, () => {
      for (const [key, scope] of t.grants) {
        const perm = PERMISSION_BY_KEY.get(key);
        expect(perm, `${t.key} grants unknown permission ${key}`).toBeDefined();
        if (scope) expect(perm!.scopes, `${t.key}: ${key} can't be scoped to ${scope}`).toContain(scope);
        else expect(perm!.scopes.length, `${t.key}: ${key} needs a scope`).toBe(0);
      }
    });
  }

  it('auditor only looks — beyond self-service, nothing that changes data', () => {
    const auditor = EXTRA_ROLE_TEMPLATES.find((t) => t.key === 'auditor')!;
    const self = new Set(ROLE_TEMPLATES.find((t) => t.key === 'employee')!.grants.map(([k]) => k));
    const changing = auditor.grants.map(([k]) => k).filter((k) => !self.has(k) && !k.endsWith('.view'));
    expect(changing).toEqual([]);
  });

  it('intern has no pay screens', () => {
    const intern = EXTRA_ROLE_TEMPLATES.find((t) => t.key === 'intern')!;
    expect(intern.grants.some(([k]) => k === 'salary.view' || k === 'payslip.view')).toBe(false);
  });
});
