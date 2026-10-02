import type { AccessScope, CatalogFeature, CatalogModule, CatalogPermission } from '@hrms/types';

// ============================================================
// Access catalog — the single source of truth for what the HRMS
// can do. Module → Feature → Permission.
//
//   • Super Admin switches FEATURES on/off per company (plans + overrides)
//   • Company Admin grants PERMISSIONS to roles, each with a SCOPE
//   • Synced into the `permissions` table on API start-up
//
// Adding a module = add it here. It appears in the catalog, is OFF
// for companies until their plan includes it, and owner roles
// (Company Admin) get it automatically once enabled.
// ============================================================

/** Narrowest → broadest; the broadest scope wins when roles overlap. */
export const SCOPE_ORDER: AccessScope[] = [
  'own',
  'direct_reports',
  'all_reports',
  'department',
  'department_tree',
  'location',
  'company',
];

const EVERYONE: AccessScope[] = [...SCOPE_ORDER];
const OTHERS: AccessScope[] = ['direct_reports', 'all_reports', 'department', 'department_tree', 'location', 'company'];
const SELF: AccessScope[] = ['own'];

const p = (
  key: string,
  label: string,
  scopes: AccessScope[] = [],
  extra: Partial<CatalogPermission> = {},
): CatalogPermission => ({ key, action: key.split('.')[1]!, label, scopes, ...extra });

export const CATALOG: CatalogModule[] = [
  {
    key: 'people',
    label: 'People',
    icon: 'Users',
    features: [
      {
        key: 'people.directory',
        label: 'Employee directory',
        description: 'Employee profiles, onboarding and offboarding.',
        stage: 'ga',
        permissions: [
          p('employee.view', 'View employees', EVERYONE),
          p('employee.create', 'Add employees', [], { requires: ['employee.view'] }),
          p('employee.edit', 'Edit employees', EVERYONE, { requires: ['employee.view'] }),
          p('employee.delete', 'Delete employees', OTHERS, { requires: ['employee.view'] }),
          p('employee.terminate', 'Terminate / offboard', OTHERS, { requires: ['employee.view'] }),
          p('employee.import', 'Bulk import employees', [], { requires: ['employee.create'] }),
          p('employee.export', 'Export employees', OTHERS, { requires: ['employee.view'] }),
        ],
      },
      {
        key: 'people.org',
        label: 'Organisation structure',
        description: 'Departments, designations, locations, org levels and reporting lines.',
        core: true,
        stage: 'ga',
        permissions: [
          p('org.view', 'View org chart & structure'),
          p('org.manage', 'Manage departments, levels & reporting lines', [], { requires: ['org.view'] }),
        ],
      },
      {
        key: 'people.documents',
        label: 'Employee documents',
        description: 'Contracts, ID proofs and letters per employee.',
        stage: 'ga',
        permissions: [
          p('document.view', 'View documents', EVERYONE),
          p('document.upload', 'Upload documents', EVERYONE, { requires: ['document.view'] }),
          p('document.delete', 'Delete documents', OTHERS, { requires: ['document.view'] }),
        ],
      },
    ],
  },
  {
    key: 'time',
    label: 'Time',
    icon: 'Clock',
    features: [
      {
        key: 'time.attendance',
        label: 'Attendance',
        description: 'Check-in/out, corrections, regularisation and holidays.',
        stage: 'ga',
        permissions: [
          p('attendance.view', 'View attendance', EVERYONE),
          p('attendance.mark', 'Check in / out', SELF),
          p('attendance.edit', 'Correct attendance', OTHERS, { requires: ['attendance.view'] }),
          p('attendance.approve', 'Approve regularisation', OTHERS, { requires: ['attendance.view'] }),
          p('attendance.export', 'Export attendance', OTHERS, { requires: ['attendance.view'] }),
          p('holiday.manage', 'Manage holiday calendar'),
        ],
      },
      {
        key: 'time.leave',
        label: 'Leave',
        description: 'Leave requests, approvals, types and balances.',
        stage: 'ga',
        permissions: [
          p('leave.view', 'View leave', EVERYONE),
          p('leave.request', 'Apply for leave', SELF),
          p('leave.approve', 'Approve / reject leave', OTHERS, { requires: ['leave.view'] }),
          p('leave.adjust_balance', 'Adjust leave balances', OTHERS, { requires: ['leave.view'], sensitive: true }),
          p('leave.manage_types', 'Manage leave types & policies'),
        ],
      },
      {
        key: 'time.shifts',
        label: 'Shifts & rosters',
        description: 'Shift patterns and team rosters.',
        stage: 'beta',
        dependsOn: ['time.attendance'],
        permissions: [
          p('shift.view', 'View shifts & rosters', EVERYONE),
          p('shift.manage', 'Plan shifts & rosters', OTHERS, { requires: ['shift.view'] }),
        ],
      },
    ],
  },
  {
    key: 'pay',
    label: 'Pay',
    icon: 'Wallet',
    features: [
      {
        key: 'pay.payroll',
        label: 'Payroll',
        description: 'Payroll runs, approvals and payslips.',
        stage: 'ga',
        permissions: [
          p('payslip.view', 'View payslips', EVERYONE, { sensitive: true }),
          p('payroll.view', 'View payroll runs', [], { sensitive: true }),
          p('payroll.run', 'Run payroll', [], { sensitive: true, requires: ['payroll.view'] }),
          p('payroll.approve', 'Approve & finalise payroll', [], { sensitive: true, requires: ['payroll.view'] }),
        ],
      },
      {
        key: 'pay.salary',
        label: 'Salary & compensation',
        description: 'Salary structures and revisions.',
        stage: 'ga',
        permissions: [
          p('salary.view', 'View salaries', EVERYONE, { sensitive: true }),
          p('salary.edit', 'Revise salaries', OTHERS, { sensitive: true, requires: ['salary.view'] }),
        ],
      },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    icon: 'BarChart3',
    features: [
      {
        key: 'insights.reports',
        label: 'Reports',
        description: 'Headcount, attendance, leave and payroll reports.',
        stage: 'ga',
        permissions: [
          p('report.view', 'View reports', OTHERS),
          p('report.export', 'Export reports', OTHERS, { requires: ['report.view'] }),
        ],
      },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    icon: 'ShieldCheck',
    features: [
      {
        key: 'admin.users',
        label: 'Users & roles',
        description: 'Invite users, manage roles and permissions.',
        core: true,
        stage: 'ga',
        permissions: [
          p('user.view', 'View users'),
          p('user.invite', 'Invite users', [], { requires: ['user.view'] }),
          p('user.edit', 'Edit users', [], { requires: ['user.view'] }),
          p('user.deactivate', 'Deactivate users', [], { requires: ['user.view'] }),
          p('user.assign_roles', 'Assign roles to users', [], { sensitive: true, requires: ['user.view', 'role.view'] }),
          p('role.view', 'View roles & permissions'),
          p('role.manage', 'Create & edit roles', [], { sensitive: true, requires: ['role.view'] }),
        ],
      },
      {
        key: 'admin.settings',
        label: 'Settings & branding',
        description: 'Company settings, branding and theme.',
        core: true,
        stage: 'ga',
        permissions: [
          p('settings.view', 'View company settings'),
          p('settings.manage', 'Change company settings', [], { requires: ['settings.view'] }),
          p('branding.manage', 'Manage branding & theme'),
        ],
      },
      {
        key: 'admin.audit',
        label: 'Audit log',
        description: 'Who changed what, and when.',
        stage: 'ga',
        permissions: [p('audit.view', 'View audit log', [], { sensitive: true })],
      },
    ],
  },
  {
    key: 'coming',
    label: 'Coming soon',
    icon: 'Sparkles',
    features: [
      { key: 'talent.recruitment', label: 'Recruitment', description: 'Jobs, candidates and offers.', stage: 'coming_soon', permissions: [p('recruitment.view', 'View hiring'), p('recruitment.manage', 'Manage hiring', [], { requires: ['recruitment.view'] })] },
      { key: 'talent.performance', label: 'Performance', description: 'Goals and reviews.', stage: 'coming_soon', permissions: [p('performance.view', 'View reviews', EVERYONE), p('performance.manage', 'Run reviews', OTHERS, { requires: ['performance.view'] })] },
      { key: 'ops.assets', label: 'Assets', description: 'Company assets and assignments.', stage: 'coming_soon', permissions: [p('asset.view', 'View assets', EVERYONE), p('asset.manage', 'Manage assets', [], { requires: ['asset.view'] })] },
      { key: 'ops.expenses', label: 'Expenses', description: 'Claims and reimbursements.', stage: 'coming_soon', permissions: [p('expense.view', 'View expenses', EVERYONE), p('expense.submit', 'Submit expenses', SELF), p('expense.approve', 'Approve expenses', OTHERS, { requires: ['expense.view'] })] },
      { key: 'ops.helpdesk', label: 'Helpdesk', description: 'Employee tickets.', stage: 'coming_soon', permissions: [p('ticket.view', 'View tickets', EVERYONE), p('ticket.create', 'Raise tickets', SELF), p('ticket.resolve', 'Resolve tickets', OTHERS, { requires: ['ticket.view'] })] },
    ],
  },
];

// ─── Lookups ────────────────────────────────────────────────

export const FEATURES: CatalogFeature[] = CATALOG.flatMap((m) => m.features);
export const FEATURE_BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));
export const PERMISSION_BY_KEY = new Map<string, CatalogPermission & { feature: string; module: string }>(
  CATALOG.flatMap((m) => m.features.flatMap((f) => f.permissions.map((perm) => [perm.key, { ...perm, feature: f.key, module: m.key }] as const))),
);
export const CORE_FEATURES = FEATURES.filter((f) => f.core).map((f) => f.key);
/** Features a plan may include (coming_soon ones are never granted). */
export const AVAILABLE_FEATURES = FEATURES.filter((f) => f.stage !== 'coming_soon').map((f) => f.key);

export function featureOf(permission: string): string | undefined {
  return PERMISSION_BY_KEY.get(permission)?.feature;
}

export function broader(a: AccessScope | null, b: AccessScope | null): AccessScope | null {
  if (a === null || b === null) return a ?? b;
  return SCOPE_ORDER.indexOf(a) >= SCOPE_ORDER.indexOf(b) ? a : b;
}

// ─── Limits (per plan, overridable per company; null = unlimited) ──

export const LIMITS: Array<{ key: string; label: string; description: string }> = [
  { key: 'maxEmployees', label: 'Max employees', description: 'Employee records the company can have (terminated ones excluded).' },
];
export const LIMIT_KEYS = new Set(LIMITS.map((l) => l.key));

// ─── Plans (defaults; editable later from the Super Admin portal) ──

export const DEFAULT_PLANS: Array<{ key: string; name: string; description: string; features: string[]; limits: Record<string, number | null> }> = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Core HR for small teams.',
    features: ['people.directory', 'people.org', 'time.attendance', 'time.leave', 'admin.users', 'admin.settings'],
    limits: { maxEmployees: 50 },
  },
  {
    key: 'growth',
    name: 'Growth',
    description: 'Payroll, documents and reports for growing companies.',
    features: [
      'people.directory', 'people.org', 'people.documents', 'time.attendance', 'time.leave',
      'pay.payroll', 'pay.salary', 'insights.reports', 'admin.users', 'admin.settings', 'admin.audit',
    ],
    limits: { maxEmployees: 500 },
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Everything, including beta features.',
    features: AVAILABLE_FEATURES,
    limits: { maxEmployees: null },
  },
];
export const DEFAULT_PLAN_KEY = 'enterprise';

// ─── Role templates (cloned into every company, then fully editable) ──

type Grant = [permission: string, scope?: AccessScope];

const SELF_SERVICE: Grant[] = [
  ['employee.view', 'own'], ['employee.edit', 'own'],
  ['document.view', 'own'], ['document.upload', 'own'],
  ['attendance.view', 'own'], ['attendance.mark', 'own'],
  ['leave.view', 'own'], ['leave.request', 'own'],
  ['shift.view', 'own'], ['payslip.view', 'own'], ['salary.view', 'own'],
  ['org.view'],
];

export const ROLE_TEMPLATES: Array<{ key: string; name: string; description: string; isOwner?: boolean; grants: Grant[] }> = [
  {
    key: 'company_admin',
    name: 'Company Admin',
    description: 'Full access to every feature enabled for the company. Cannot be edited or removed.',
    isOwner: true,
    grants: [],
  },
  {
    key: 'hr',
    name: 'HR',
    description: 'Company-wide people, time and pay administration — except running payroll and managing roles.',
    grants: [
      ...SELF_SERVICE,
      ['employee.view', 'company'], ['employee.create'], ['employee.edit', 'company'], ['employee.terminate', 'company'],
      ['employee.import'], ['employee.export', 'company'],
      ['org.manage'],
      ['document.view', 'company'], ['document.upload', 'company'], ['document.delete', 'company'],
      ['attendance.view', 'company'], ['attendance.edit', 'company'], ['attendance.approve', 'company'], ['attendance.export', 'company'],
      ['holiday.manage'],
      ['leave.view', 'company'], ['leave.approve', 'company'], ['leave.adjust_balance', 'company'], ['leave.manage_types'],
      ['shift.view', 'company'], ['shift.manage', 'company'],
      ['payslip.view', 'company'], ['payroll.view'], ['salary.view', 'company'], ['salary.edit', 'company'],
      ['report.view', 'company'], ['report.export', 'company'],
      ['user.view'], ['user.invite'], ['user.edit'], ['user.deactivate'], ['role.view'],
      ['settings.view'],
    ],
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Sees everyone below them in the reporting tree; approves for direct reports.',
    grants: [
      ...SELF_SERVICE,
      ['employee.view', 'all_reports'], ['document.view', 'all_reports'],
      ['attendance.view', 'all_reports'], ['attendance.approve', 'direct_reports'],
      ['leave.view', 'all_reports'], ['leave.approve', 'direct_reports'],
      ['shift.view', 'all_reports'], ['shift.manage', 'all_reports'],
      ['report.view', 'all_reports'],
    ],
  },
  {
    key: 'team_lead',
    name: 'Team Lead',
    description: 'Sees and approves for their direct reports.',
    grants: [
      ...SELF_SERVICE,
      ['employee.view', 'direct_reports'],
      ['attendance.view', 'direct_reports'], ['attendance.approve', 'direct_reports'],
      ['leave.view', 'direct_reports'], ['leave.approve', 'direct_reports'],
      ['shift.view', 'direct_reports'],
    ],
  },
  {
    key: 'employee',
    name: 'Employee',
    description: 'Self-service: own profile, attendance, leave and payslips.',
    grants: SELF_SERVICE,
  },
];
