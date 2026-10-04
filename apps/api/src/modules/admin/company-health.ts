// ============================================================
// Company health for the Super Admin — pure functions, no database.
// ============================================================

export type CompanyStatusName = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface SetupFacts {
  departments: number;
  employees: number;
  hasAttendancePolicy: boolean;
  leaveTypes: number;
  holidays: number;
  hasLogo: boolean;
}

export const SETUP_STEPS: Array<{ key: keyof SetupFacts; label: string; done: (f: SetupFacts) => boolean }> = [
  { key: 'departments', label: 'Departments added', done: (f) => f.departments > 0 },
  { key: 'employees', label: 'Employees added', done: (f) => f.employees > 0 },
  { key: 'hasAttendancePolicy', label: 'Attendance policy set', done: (f) => f.hasAttendancePolicy },
  { key: 'leaveTypes', label: 'Leave types set', done: (f) => f.leaveTypes > 0 },
  { key: 'holidays', label: 'Holidays added', done: (f) => f.holidays > 0 },
  { key: 'hasLogo', label: 'Logo uploaded', done: (f) => f.hasLogo },
];

export function setupOf(f: SetupFacts) {
  const items = SETUP_STEPS.map((s) => ({ key: s.key, label: s.label, done: s.done(f) }));
  return { percent: Math.round((items.filter((i) => i.done).length / items.length) * 100), items };
}

export type HealthLabel = 'healthy' | 'watch' | 'at_risk';

/**
 * 0–100: how much people use it (share of users active in the last 7 days)
 * and how far setup has got. Suspended / inactive companies are capped.
 */
export function healthOf(opts: { status: CompanyStatusName; users: number; activeUsers7d: number; setupPercent: number }): { score: number; label: HealthLabel } {
  const activeRate = opts.users ? Math.min(1, opts.activeUsers7d / opts.users) : 0;
  let score = Math.round(activeRate * 55 + opts.setupPercent * 0.45);
  if (opts.status === 'SUSPENDED') score = Math.min(score, 15);
  if (opts.status === 'INACTIVE') score = Math.min(score, 35);
  return { score, label: score >= 75 ? 'healthy' : score >= 45 ? 'watch' : 'at_risk' };
}

/** Where a company is in onboarding. */
export type Stage = 'invited' | 'setting_up' | 'live' | 'paused';
export function stageOf(opts: { status: CompanyStatusName; everActive: boolean; setupPercent: number }): Stage {
  if (opts.status !== 'ACTIVE') return 'paused';
  if (!opts.everActive) return 'invited';
  return opts.setupPercent >= 100 ? 'live' : 'setting_up';
}

export interface AttentionInput {
  id: string;
  name: string;
  status: CompanyStatusName;
  statusSince: Date;
  users: number;
  employees: number;
  maxEmployees: number | null;
  setupPercent: number;
  holidays: number;
  lastActivity: Date | null;
}
export interface Attention {
  companyId: string;
  kind: 'suspended' | 'inactive' | 'near_limit' | 'no_activity' | 'setup' | 'no_holidays';
  severity: number;
  title: string;
  detail: string;
}

const days = (from: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
const ago = (n: number) => (n === 0 ? 'today' : n === 1 ? '1 day' : `${n} days`);
const forHow = (n: number) => (n === 0 ? 'since today' : `for ${ago(n)}`);

/** What needs the Super Admin's attention, most serious first. */
export function attentionFor(list: AttentionInput[], now = new Date()): Attention[] {
  const out: Attention[] = [];
  for (const c of list) {
    if (c.status === 'SUSPENDED') {
      out.push({ companyId: c.id, kind: 'suspended', severity: 90, title: `${c.name} is suspended`, detail: `${forHow(days(c.statusSince, now))} · nobody can sign in` });
      continue;
    }
    if (c.status === 'INACTIVE') {
      out.push({ companyId: c.id, kind: 'inactive', severity: 60, title: `${c.name} is inactive`, detail: forHow(days(c.statusSince, now)) });
      continue;
    }
    if (c.maxEmployees && c.employees >= c.maxEmployees * 0.9) {
      out.push({ companyId: c.id, kind: 'near_limit', severity: 80, title: `${c.name} is near its employee limit`, detail: `${c.employees} of ${c.maxEmployees} on the plan` });
    }
    const idle = c.lastActivity ? days(c.lastActivity, now) : null;
    if (c.users > 0 && (idle === null || idle >= 7)) {
      out.push({ companyId: c.id, kind: 'no_activity', severity: 70, title: `No sign-ins at ${c.name}`, detail: idle === null ? 'nobody has signed in yet' : `last sign-in ${ago(idle)} ago` });
    }
    if (c.setupPercent < 50) {
      out.push({ companyId: c.id, kind: 'setup', severity: 50, title: `${c.name} hasn’t set up`, detail: `${c.employees} employees · setup ${c.setupPercent}%` });
    } else if (c.holidays === 0) {
      out.push({ companyId: c.id, kind: 'no_holidays', severity: 30, title: `${c.name} has no holidays`, detail: `setup ${c.setupPercent}% · leave days may count wrongly` });
    }
  }
  return out.sort((a, b) => b.severity - a.severity);
}
