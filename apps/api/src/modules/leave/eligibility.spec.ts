import { describe, expect, it } from 'vitest';
import { canAskForGrant, isEligible, matchesRules, pickGrant, serviceMonths, type EligibilityRules, type PersonFacts } from './leave-rules';

const rules = (r: Partial<EligibilityRules> = {}): EligibilityRules => ({
  availability: 'RULES',
  genders: [],
  departmentIds: [],
  locationIds: [],
  designationIds: [],
  employmentTypes: [],
  minServiceMonths: null,
  managerIds: [],
  managerDeep: false,
  projectIds: [],
  members: [],
  ...r,
});
const person = (p: Partial<PersonFacts> = {}): PersonFacts => ({
  id: 'p1',
  gender: 'FEMALE',
  departmentId: 'eng',
  locationId: 'pune',
  designationId: 'dev',
  employmentType: 'FULL_TIME',
  joiningDate: new Date('2026-01-15'),
  managerChain: ['lead', 'head'],
  projectIds: ['atlas'],
  ...p,
});
const today = new Date('2026-10-09');

describe('serviceMonths', () => {
  it('counts whole months', () => {
    expect(serviceMonths(new Date('2026-01-15'), new Date('2026-02-14'))).toBe(0);
    expect(serviceMonths(new Date('2026-01-15'), new Date('2026-02-15'))).toBe(1);
    expect(serviceMonths(new Date('2026-01-15'), today)).toBe(8);
  });
});

describe('matchesRules', () => {
  it('empty rules match everyone', () => expect(matchesRules(rules(), person(), today)).toBe(true));
  it('values inside one rule are OR', () => expect(matchesRules(rules({ locationIds: ['blr', 'pune'] }), person(), today)).toBe(true));
  it('different rules are AND', () => expect(matchesRules(rules({ locationIds: ['pune'], departmentIds: ['hr'] }), person(), today)).toBe(false));
  it('a missing value fails a set rule', () => expect(matchesRules(rules({ genders: ['FEMALE'] }), person({ gender: null }), today)).toBe(false));
  it('minimum service', () => {
    expect(matchesRules(rules({ minServiceMonths: 8 }), person(), today)).toBe(true);
    expect(matchesRules(rules({ minServiceMonths: 9 }), person(), today)).toBe(false);
  });
  it('manager team: direct reports unless deep', () => {
    expect(matchesRules(rules({ managerIds: ['head'] }), person(), today)).toBe(false);
    expect(matchesRules(rules({ managerIds: ['head'], managerDeep: true }), person(), today)).toBe(true);
    expect(matchesRules(rules({ managerIds: ['lead'] }), person(), today)).toBe(true);
  });
  it('project team', () => {
    expect(matchesRules(rules({ projectIds: ['atlas'] }), person(), today)).toBe(true);
    expect(matchesRules(rules({ projectIds: ['zeus'] }), person(), today)).toBe(false);
  });
  it('include beats the rules, exclude beats everything', () => {
    expect(matchesRules(rules({ departmentIds: ['hr'], members: [{ employeeId: 'p1', mode: 'INCLUDE' }] }), person(), today)).toBe(true);
    expect(matchesRules(rules({ members: [{ employeeId: 'p1', mode: 'EXCLUDE' }] }), person(), today)).toBe(false);
  });
});

describe('isEligible / canAskForGrant', () => {
  it('everyone ignores the rules', () => expect(isEligible(rules({ availability: 'EVERYONE', genders: ['MALE'] }), person(), today)).toBe(true));
  it('grant-only needs a grant', () => {
    const r = rules({ availability: 'GRANT_ONLY', genders: ['FEMALE'] });
    expect(isEligible(r, person(), today)).toBe(false);
    expect(isEligible(r, person(), today, true)).toBe(true);
    expect(canAskForGrant(r, person(), today)).toBe(true);
    expect(canAskForGrant(r, person({ gender: 'MALE' }), today)).toBe(false);
  });
});

describe('pickGrant', () => {
  const g = (id: string, validFrom: string, validTo: string, days: number, taken = 0) => ({ id, validFrom, validTo, days, taken });
  it('needs a grant covering the dates', () => expect(pickGrant([g('a', '2026-11-01', '2027-04-30', 182)], '2026-10-20', '2026-11-05', 10).problem).toBe('dates'));
  it('uses the oldest grant with room', () => {
    const r = pickGrant([g('new', '2026-10-01', '2027-03-31', 10), g('old', '2026-09-01', '2027-03-31', 10, 8)], '2026-11-02', '2026-11-06', 5);
    expect(r.grant?.id).toBe('new');
  });
  it('reports running out of days', () => expect(pickGrant([g('a', '2026-11-01', '2027-04-30', 182, 180)], '2027-04-01', '2027-04-10', 10).problem).toBe('days'));
});
