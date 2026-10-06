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
          p('employee.view_private', 'View personal, bank & ID details', EVERYONE, {
            sensitive: true,
            requires: ['employee.view'],
            description: 'Address, emergency contact, bank account, PAN / Aadhaar (masked; revealing the full number is audited).',
          }),
          p('employee.edit_private', 'Edit personal, bank & ID details', EVERYONE, { sensitive: true, requires: ['employee.view_private'] }),
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
          p('attendance.policy', 'Manage attendance policy', [], { description: 'Work days, shift timings, grace period and half / full-day rules.' }),
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
    key: 'engage',
    label: 'Engagement',
    icon: 'Megaphone',
    features: [
      {
        key: 'engage.announcements',
        label: 'Announcements',
        description: 'Company / department / location news with optional read acknowledgement.',
        stage: 'ga',
        permissions: [
          p('announcement.view', 'Read announcements'),
          p('announcement.post', 'Post announcements', [], { requires: ['announcement.view'], description: 'Post to everyone, departments or locations; edit and remove their own posts and see who has read them.' }),
          p('announcement.manage', 'Manage all announcements', [], { requires: ['announcement.post'], description: 'Pin one announcement for everyone, edit or remove anyone’s posts and see every read report.' }),
          p('announcement.post_team', 'Post to my team', [], { requires: ['announcement.view'], description: 'Post announcements to the people who report to them (directly or further down), and see who has read them.' }),
        ],
      },
      {
        key: 'engage.kudos',
        label: 'Kudos',
        description: 'Public thank-yous between colleagues, tagged with company values.',
        stage: 'ga',
        permissions: [
          p('kudos.view', 'See kudos'),
          p('kudos.give', 'Give kudos', [], { requires: ['kudos.view'] }),
          p('kudos.manage', 'Manage values & remove kudos', [], { requires: ['kudos.view'] }),
        ],
      },
    ],
  },
  {
    key: 'work',
    label: 'Work',
    icon: 'Briefcase',
    features: [
      {
        key: 'ops.assets',
        label: 'Assets',
        description: 'Company assets, who holds what, and asset requests approved by the IT head and HR.',
        stage: 'ga',
        permissions: [
          p('asset.view', 'View assets', EVERYONE),
          p('asset.request', 'Request an asset', SELF),
          p('asset.manage', 'Manage the asset register (IT)', [], { requires: ['asset.view'], description: 'Add assets, assign and take them back, mark repair / lost / retired.' }),
          p('asset.approve_it', 'Approve asset requests (IT head)', [], { requires: ['asset.view'] }),
          p('asset.approve_hr', 'Approve asset requests (HR)', [], { requires: ['asset.view'] }),
        ],
      },
      {
        key: 'ops.helpdesk',
        label: 'Helpdesk',
        description: 'Employees raise tickets to IT, HR, Finance or DevOps; each team works its own queue with response targets. A team head can assign the work.',
        stage: 'ga',
        permissions: [
          p('ticket.view', 'View own tickets', SELF),
          p('ticket.create', 'Raise tickets', SELF),
          p('ticket.handle_it', 'Work the IT queue', [], { requires: ['ticket.view'], description: 'See, assign, answer and resolve IT tickets; manage IT categories.' }),
          p('ticket.handle_hr', 'Work the HR queue', [], { requires: ['ticket.view'], sensitive: true, description: 'See, assign, answer and resolve HR tickets; manage HR categories.' }),
          p('ticket.handle_finance', 'Work the Finance queue', [], { requires: ['ticket.view'], description: 'See, assign, answer and resolve Finance tickets; manage Finance categories.' }),
          p('ticket.handle_devops', 'Work the DevOps queue', [], { requires: ['ticket.view'], description: 'See, assign, answer and resolve DevOps tickets (servers, deployments, CI/CD, cloud access); manage DevOps categories.' }),
          p('ticket.manage_teams', 'Choose helpdesk team heads', [], { requires: ['ticket.view'], description: 'Pick the head and backup of each helpdesk team. The head gets new tickets and assigns them.' }),
        ],
      },
      {
        key: 'work.projects',
        label: 'Projects',
        description: 'Projects, team leads and allocation. Leave and attendance corrections are approved by the project team lead / manager.',
        stage: 'ga',
        permissions: [
          p('project.view', 'View projects & allocation'),
          p('project.manage', 'Create projects & assign people (PMO)', [], { requires: ['project.view'], description: 'Add people to projects, set their role, team lead and allocation %.' }),
        ],
      },
      {
        key: 'work.timesheets',
        label: 'Timesheets',
        description: 'Weekly hours per project and task, approved by the project team lead / manager (or line manager).',
        stage: 'ga',
        permissions: [
          p('timesheet.view', 'View timesheets & hours', EVERYONE),
          p('timesheet.submit', 'Fill and submit own timesheet', SELF),
          p('timesheet.approve', 'Approve timesheets', OTHERS, { requires: ['timesheet.view'], description: 'Project leads / PMs approve their people automatically; with company scope this approves anyone (HR).' }),
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
        key: 'ops.expenses',
        label: 'Expenses',
        description: 'Claims with receipts: manager → Finance + HR approval → paid.',
        stage: 'ga',
        permissions: [
          p('expense.view', 'View expense claims', EVERYONE),
          p('expense.submit', 'Submit expense claims', SELF),
          p('expense.approve', 'Approve claims (manager step)', OTHERS, { requires: ['expense.view'] }),
          p('expense.finance', 'Finance approval & mark paid', [], { requires: ['expense.view'], sensitive: true, description: 'Approve (or reduce) claims at the Finance step, mark them paid and see payment reports.' }),
          p('expense.hr', 'HR approval', [], { requires: ['expense.view'], description: 'Approve (or reduce) claims at the HR step.' }),
          p('expense.manage', 'Manage expense categories & limits'),
        ],
      },
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
          p('theme.seasonal', 'Manage seasonal themes', [], { description: 'Plan festival looks (Diwali, New Year…) that switch on and back by themselves.' }),
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

// ─── Delegation ─────────────────────────────────────────────

/** Approval permissions a person can hand over temporarily (e.g. while on leave). */
export const DELEGABLE_PERMISSIONS = ['leave.approve', 'attendance.approve', 'expense.approve', 'timesheet.approve'];
/** Approval actions: the person's own record is never in reach (no self-approval). */
export function isApproval(permission: string): boolean {
  return permission.endsWith('.approve');
}

/** Longest allowed delegation. */
export const MAX_DELEGATION_DAYS = 90;

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
    features: ['people.directory', 'people.org', 'time.attendance', 'time.leave', 'admin.users', 'admin.settings', 'engage.announcements', 'engage.kudos'],
    limits: { maxEmployees: 50 },
  },
  {
    key: 'growth',
    name: 'Growth',
    description: 'Payroll, documents and reports for growing companies.',
    features: [
      'people.directory', 'people.org', 'people.documents', 'time.attendance', 'time.leave', 'work.projects', 'work.timesheets',
      'engage.announcements', 'engage.kudos',
      'pay.payroll', 'pay.salary', 'ops.expenses', 'ops.assets', 'ops.helpdesk', 'insights.reports', 'admin.users', 'admin.settings', 'admin.audit',
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
  ['employee.view_private', 'own'], ['employee.edit_private', 'own'],
  ['document.view', 'own'], ['document.upload', 'own'],
  ['attendance.view', 'own'], ['attendance.mark', 'own'],
  ['leave.view', 'own'], ['leave.request', 'own'],
  ['shift.view', 'own'], ['payslip.view', 'own'], ['salary.view', 'own'],
  ['org.view'], ['project.view'],
  ['announcement.view'], ['kudos.view'], ['kudos.give'],
  ['expense.view', 'own'], ['expense.submit', 'own'],
  ['asset.view', 'own'], ['asset.request', 'own'],
  ['ticket.view', 'own'], ['ticket.create', 'own'],
  ['timesheet.view', 'own'], ['timesheet.submit', 'own'],
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
      ['employee.view_private', 'company'], ['employee.edit_private', 'company'],
      ['employee.import'], ['employee.export', 'company'],
      ['org.manage'],
      ['document.view', 'company'], ['document.upload', 'company'], ['document.delete', 'company'],
      ['attendance.view', 'company'], ['attendance.edit', 'company'], ['attendance.approve', 'company'], ['attendance.export', 'company'],
      ['holiday.manage'], ['attendance.policy'],
      ['announcement.post'], ['announcement.manage'], ['kudos.manage'],
      ['expense.view', 'company'], ['expense.hr'], ['expense.manage'],
      ['asset.view', 'company'], ['asset.approve_hr'], ['ticket.handle_hr'],
      ['timesheet.view', 'company'], ['timesheet.approve', 'company'],
      ['leave.view', 'company'], ['leave.approve', 'company'], ['leave.adjust_balance', 'company'], ['leave.manage_types'],
      ['shift.view', 'company'], ['shift.manage', 'company'],
      ['payslip.view', 'company'], ['payroll.view'], ['salary.view', 'company'], ['salary.edit', 'company'],
      ['report.view', 'company'], ['report.export', 'company'],
      ['user.view'], ['user.invite'], ['user.edit'], ['user.deactivate'], ['role.view'],
      ['settings.view'], ['theme.seasonal'],
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
      ['expense.view', 'all_reports'], ['expense.approve', 'direct_reports'],
      ['asset.view', 'all_reports'],
      ['timesheet.view', 'all_reports'], ['timesheet.approve', 'direct_reports'],
      ['announcement.post_team'],
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
      ['expense.view', 'direct_reports'], ['expense.approve', 'direct_reports'],
      ['timesheet.view', 'direct_reports'], ['timesheet.approve', 'direct_reports'],
      ['announcement.post_team'],
    ],
  },
  {
    key: 'it_admin',
    name: 'IT Admin',
    description: 'Runs the asset register, approves asset requests as IT head and works the IT helpdesk queue.',
    grants: [...SELF_SERVICE, ['asset.view', 'company'], ['asset.manage'], ['asset.approve_it'], ['ticket.handle_it'], ['employee.view', 'company'], ['announcement.post']],
  },
  {
    key: 'finance',
    name: 'Finance',
    description: 'Approves expense claims at the Finance step, marks them paid, sees spend reports and works the Finance helpdesk queue.',
    grants: [...SELF_SERVICE, ['expense.view', 'company'], ['expense.finance'], ['expense.manage'], ['ticket.handle_finance']],
  },
  {
    key: 'devops',
    name: 'DevOps',
    description: 'Works the DevOps helpdesk queue (servers, deployments, CI/CD, cloud access).',
    grants: [...SELF_SERVICE, ['ticket.handle_devops']],
  },
  {
    key: 'pmo',
    name: 'PMO',
    description: 'Project management office: creates projects, allocates people (role, team lead, allocation %) and sees logged hours.',
    grants: [...SELF_SERVICE, ['project.manage'], ['employee.view', 'company'], ['timesheet.view', 'company']],
  },
  {
    key: 'employee',
    name: 'Employee',
    description: 'Self-service: own profile, attendance, leave and payslips.',
    grants: SELF_SERVICE,
  },
];

/**
 * Starting points for new roles ("Start from a template" on Roles). Not created
 * for companies — the admin picks one, adjusts it and saves it as a normal role.
 */
export const EXTRA_ROLE_TEMPLATES: Array<{ key: string; name: string; description: string; grants: Grant[] }> = [
  {
    key: 'recruiter',
    name: 'Recruiter',
    description: 'Adds new joiners, uploads their documents and sees the org chart and people reports.',
    grants: [
      ...SELF_SERVICE,
      ['employee.view', 'company'], ['employee.create'], ['employee.import'],
      ['document.view', 'company'], ['document.upload', 'company'],
      ['report.view', 'company'], ['user.view'], ['user.invite'],
    ],
  },
  {
    key: 'payroll_officer',
    name: 'Payroll officer',
    description: 'Salaries, payslips and payroll runs, with the attendance and leave they depend on.',
    grants: [
      ...SELF_SERVICE,
      ['employee.view', 'company'], ['employee.view_private', 'company'],
      ['salary.view', 'company'], ['salary.edit', 'company'], ['payslip.view', 'company'],
      ['payroll.view'], ['payroll.run'],
      ['attendance.view', 'company'], ['leave.view', 'company'],
      ['report.view', 'company'], ['report.export', 'company'],
    ],
  },
  {
    key: 'office_admin',
    name: 'Office admin',
    description: 'Runs the office: assets, holidays, announcements and the IT desk.',
    grants: [
      ...SELF_SERVICE,
      ['employee.view', 'company'], ['asset.view', 'company'], ['asset.manage'],
      ['holiday.manage'], ['announcement.post'], ['ticket.handle_it'],
    ],
  },
  {
    key: 'auditor',
    name: 'Auditor (view only)',
    description: 'Can look at everything across the company but change nothing.',
    grants: [
      ...SELF_SERVICE,
      ['employee.view', 'company'], ['document.view', 'company'], ['attendance.view', 'company'], ['leave.view', 'company'],
      ['shift.view', 'company'], ['expense.view', 'company'], ['asset.view', 'company'], ['timesheet.view', 'company'],
      ['report.view', 'company'], ['user.view'], ['role.view'], ['settings.view'], ['audit.view'],
    ],
  },
  {
    key: 'intern',
    name: 'Intern',
    description: 'Self-service for interns: attendance, leave, timesheets and tickets — no pay screens.',
    grants: SELF_SERVICE.filter(([k]) => k !== 'payslip.view' && k !== 'salary.view'),
  },
];
