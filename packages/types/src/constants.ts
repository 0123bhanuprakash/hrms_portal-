// ============================================================
// @hrms/types — Permission Constants
//
// All resource:action permission keys defined here.
// Used by:
//   - Backend:  @RequirePermission(PERMISSIONS.EMPLOYEE_CREATE)
//   - Frontend: hasPermission(PERMISSIONS.EMPLOYEE_CREATE)
//   - DB seed:  seeding all permissions into the database
// ============================================================

export const PERMISSIONS = {
  // ── Company (Super Admin only) ──────────────────────────────
  COMPANY_CREATE:      'company:create',
  COMPANY_READ:        'company:read',
  COMPANY_UPDATE:      'company:update',
  COMPANY_DELETE:      'company:delete',
  COMPANY_ACTIVATE:    'company:activate',
  COMPANY_DEACTIVATE:  'company:deactivate',

  // ── User Management ─────────────────────────────────────────
  USER_CREATE:         'user:create',
  USER_READ:           'user:read',
  USER_UPDATE:         'user:update',
  USER_DELETE:         'user:delete',
  USER_DEACTIVATE:     'user:deactivate',

  // ── Role & Permission ────────────────────────────────────────
  ROLE_CREATE:         'role:create',
  ROLE_READ:           'role:read',
  ROLE_UPDATE:         'role:update',
  ROLE_DELETE:         'role:delete',
  PERMISSION_MANAGE:   'permission:manage',

  // ── Settings ─────────────────────────────────────────────────
  SETTINGS_READ:       'settings:read',
  SETTINGS_UPDATE:     'settings:update',
  BRANDING_MANAGE:     'branding:manage',

  // ── Employee ─────────────────────────────────────────────────
  EMPLOYEE_CREATE:     'employee:create',
  EMPLOYEE_READ:       'employee:read',
  EMPLOYEE_READ_OWN:   'employee:read_own',      // Can only read own profile
  EMPLOYEE_UPDATE:     'employee:update',
  EMPLOYEE_UPDATE_OWN: 'employee:update_own',    // Can update own non-sensitive fields
  EMPLOYEE_DELETE:     'employee:delete',
  EMPLOYEE_TERMINATE:  'employee:terminate',
  EMPLOYEE_IMPORT:     'employee:import',

  // ── Salary / Compensation ────────────────────────────────────
  SALARY_READ:         'salary:read',
  SALARY_READ_OWN:     'salary:read_own',
  SALARY_UPDATE:       'salary:update',

  // ── Department & Designation ─────────────────────────────────
  DEPARTMENT_CREATE:   'department:create',
  DEPARTMENT_READ:     'department:read',
  DEPARTMENT_UPDATE:   'department:update',
  DEPARTMENT_DELETE:   'department:delete',
  DESIGNATION_MANAGE:  'designation:manage',

  // ── Attendance ───────────────────────────────────────────────
  ATTENDANCE_READ:         'attendance:read',
  ATTENDANCE_READ_OWN:     'attendance:read_own',
  ATTENDANCE_MARK:         'attendance:mark',           // Check-in/out
  ATTENDANCE_UPDATE:       'attendance:update',         // Corrections
  ATTENDANCE_APPROVE:      'attendance:approve',        // Regularization
  ATTENDANCE_IMPORT:       'attendance:import',
  HOLIDAY_MANAGE:          'holiday:manage',

  // ── Leave ────────────────────────────────────────────────────
  LEAVE_REQUEST:       'leave:request',            // Employee can apply
  LEAVE_READ:          'leave:read',               // HR/Manager: all leaves
  LEAVE_READ_OWN:      'leave:read_own',           // Employee: own leaves
  LEAVE_APPROVE:       'leave:approve',            // Manager can approve
  LEAVE_REJECT:        'leave:reject',
  LEAVE_CANCEL:        'leave:cancel',
  LEAVE_TYPE_MANAGE:   'leave_type:manage',
  LEAVE_BALANCE_ADJUST: 'leave_balance:adjust',

  // ── Payroll ──────────────────────────────────────────────────
  PAYROLL_READ:        'payroll:read',             // HR/Finance: all payroll
  PAYROLL_MANAGE:      'payroll:manage',           // Run/finalize payroll
  PAYSLIP_READ_OWN:    'payslip:read_own',         // Employee: own payslips
  PAYSLIP_READ:        'payslip:read',             // HR: all payslips

  // ── Recruitment ──────────────────────────────────────────────
  JOB_CREATE:          'job:create',
  JOB_READ:            'job:read',
  JOB_UPDATE:          'job:update',
  JOB_DELETE:          'job:delete',
  APPLICATION_READ:    'application:read',
  APPLICATION_UPDATE:  'application:update',
  INTERVIEW_MANAGE:    'interview:manage',
  OFFER_MANAGE:        'offer:manage',

  // ── Performance ──────────────────────────────────────────────
  PERFORMANCE_READ:    'performance:read',
  PERFORMANCE_READ_OWN: 'performance:read_own',
  PERFORMANCE_MANAGE:  'performance:manage',
  GOAL_MANAGE_OWN:     'goal:manage_own',

  // ── Assets ───────────────────────────────────────────────────
  ASSET_READ:          'asset:read',
  ASSET_MANAGE:        'asset:manage',
  ASSET_ASSIGN:        'asset:assign',

  // ── Expenses ─────────────────────────────────────────────────
  EXPENSE_SUBMIT:      'expense:submit',
  EXPENSE_READ:        'expense:read',
  EXPENSE_APPROVE:     'expense:approve',

  // ── Helpdesk ─────────────────────────────────────────────────
  TICKET_CREATE:       'ticket:create',
  TICKET_READ:         'ticket:read',
  TICKET_READ_OWN:     'ticket:read_own',
  TICKET_ASSIGN:       'ticket:assign',
  TICKET_RESOLVE:      'ticket:resolve',

  // ── Announcements ────────────────────────────────────────────
  ANNOUNCEMENT_CREATE: 'announcement:create',
  ANNOUNCEMENT_READ:   'announcement:read',

  // ── Reports ──────────────────────────────────────────────────
  REPORT_READ:         'report:read',
  REPORT_EXPORT:       'report:export',

  // ── Import/Export ────────────────────────────────────────────
  IMPORT_INITIATE:     'import:initiate',
  IMPORT_VIEW_STATUS:  'import:view_status',
  EXPORT_DATA:         'export:data',

  // ── Audit Logs ───────────────────────────────────────────────
  AUDIT_LOG_READ:      'audit_log:read',

  // ── Notifications ────────────────────────────────────────────
  NOTIFICATION_READ_OWN: 'notification:read_own',
} as const;

// TypeScript type for all permission values
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// All permission values as array (used for DB seed)
export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// ─── Default Role → Permissions Mapping ──────────────────────
// Used by the DB seed script to assign permissions to system roles.

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: [
    PERMISSIONS.COMPANY_CREATE,
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.COMPANY_UPDATE,
    PERMISSIONS.COMPANY_ACTIVATE,
    PERMISSIONS.COMPANY_DEACTIVATE,
    PERMISSIONS.IMPORT_VIEW_STATUS,
    PERMISSIONS.AUDIT_LOG_READ,
  ],

  company_admin: [
    // User management
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DEACTIVATE,
    // Role & permissions
    PERMISSIONS.ROLE_CREATE,
    PERMISSIONS.ROLE_READ,
    PERMISSIONS.ROLE_UPDATE,
    PERMISSIONS.ROLE_DELETE,
    PERMISSIONS.PERMISSION_MANAGE,
    // Settings & branding
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.BRANDING_MANAGE,
    // Employees
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.EMPLOYEE_UPDATE,
    PERMISSIONS.EMPLOYEE_TERMINATE,
    PERMISSIONS.EMPLOYEE_IMPORT,
    PERMISSIONS.SALARY_READ,
    PERMISSIONS.SALARY_UPDATE,
    // Org structure
    PERMISSIONS.DEPARTMENT_CREATE,
    PERMISSIONS.DEPARTMENT_READ,
    PERMISSIONS.DEPARTMENT_UPDATE,
    PERMISSIONS.DEPARTMENT_DELETE,
    PERMISSIONS.DESIGNATION_MANAGE,
    // Attendance
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_UPDATE,
    PERMISSIONS.ATTENDANCE_APPROVE,
    PERMISSIONS.ATTENDANCE_IMPORT,
    PERMISSIONS.HOLIDAY_MANAGE,
    // Leave
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_REJECT,
    PERMISSIONS.LEAVE_CANCEL,
    PERMISSIONS.LEAVE_TYPE_MANAGE,
    PERMISSIONS.LEAVE_BALANCE_ADJUST,
    // Payroll
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.PAYSLIP_READ,
    // Reports
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
    // Import
    PERMISSIONS.IMPORT_INITIATE,
    PERMISSIONS.IMPORT_VIEW_STATUS,
    // Audit
    PERMISSIONS.AUDIT_LOG_READ,
  ],

  hr: [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.EMPLOYEE_UPDATE,
    PERMISSIONS.EMPLOYEE_IMPORT,
    PERMISSIONS.SALARY_READ,
    PERMISSIONS.DEPARTMENT_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_UPDATE,
    PERMISSIONS.ATTENDANCE_APPROVE,
    PERMISSIONS.ATTENDANCE_IMPORT,
    PERMISSIONS.HOLIDAY_MANAGE,
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_REJECT,
    PERMISSIONS.LEAVE_CANCEL,
    PERMISSIONS.LEAVE_TYPE_MANAGE,
    PERMISSIONS.LEAVE_BALANCE_ADJUST,
    PERMISSIONS.PAYROLL_READ,
    PERMISSIONS.PAYROLL_MANAGE,
    PERMISSIONS.PAYSLIP_READ,
    PERMISSIONS.JOB_CREATE,
    PERMISSIONS.JOB_READ,
    PERMISSIONS.JOB_UPDATE,
    PERMISSIONS.APPLICATION_READ,
    PERMISSIONS.APPLICATION_UPDATE,
    PERMISSIONS.INTERVIEW_MANAGE,
    PERMISSIONS.OFFER_MANAGE,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.IMPORT_INITIATE,
    PERMISSIONS.IMPORT_VIEW_STATUS,
    PERMISSIONS.ANNOUNCEMENT_CREATE,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.NOTIFICATION_READ_OWN,
  ],

  manager: [
    PERMISSIONS.EMPLOYEE_READ,
    PERMISSIONS.EMPLOYEE_READ_OWN,
    PERMISSIONS.EMPLOYEE_UPDATE_OWN,
    PERMISSIONS.DEPARTMENT_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_READ_OWN,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.LEAVE_READ,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.LEAVE_READ_OWN,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_REJECT,
    PERMISSIONS.PAYSLIP_READ_OWN,
    PERMISSIONS.SALARY_READ_OWN,
    PERMISSIONS.PERFORMANCE_READ,
    PERMISSIONS.PERFORMANCE_READ_OWN,
    PERMISSIONS.GOAL_MANAGE_OWN,
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.EXPENSE_SUBMIT,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.NOTIFICATION_READ_OWN,
  ],

  employee: [
    PERMISSIONS.EMPLOYEE_READ_OWN,
    PERMISSIONS.EMPLOYEE_UPDATE_OWN,
    PERMISSIONS.ATTENDANCE_READ_OWN,
    PERMISSIONS.ATTENDANCE_MARK,
    PERMISSIONS.LEAVE_REQUEST,
    PERMISSIONS.LEAVE_READ_OWN,
    PERMISSIONS.LEAVE_CANCEL,
    PERMISSIONS.PAYSLIP_READ_OWN,
    PERMISSIONS.SALARY_READ_OWN,
    PERMISSIONS.PERFORMANCE_READ_OWN,
    PERMISSIONS.GOAL_MANAGE_OWN,
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.EXPENSE_SUBMIT,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.NOTIFICATION_READ_OWN,
  ],
};

// ─── Redis Key Prefixes ───────────────────────────────────────
// Centralized so both apps use the same key format.

export const REDIS_KEYS = {
  // Permission cache per user
  userPermissions: (userId: string) => `perms:${userId}`,
  // Branding cache per company
  companyBranding: (companyId: string) => `branding:${companyId}`,
  // Rate limit: login attempts per IP
  loginRateLimit: (ip: string) => `ratelimit:login:${ip}`,
  // Token family (for refresh token reuse detection)
  tokenFamily: (familyId: string) => `token_family:${familyId}`,
} as const;

// ─── System Constants ─────────────────────────────────────────

export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_EXPIRY_MS:   15 * 60 * 1000,          // 15 minutes
  REFRESH_TOKEN_EXPIRY_MS:  7 * 24 * 60 * 60 * 1000, // 7 days
  MAX_LOGIN_ATTEMPTS:       5,
  LOCKOUT_DURATION_MS:      15 * 60 * 1000,           // 15 minutes
  PASSWORD_RESET_EXPIRY_MS: 15 * 60 * 1000,           // 15 minutes
  EMAIL_VERIFY_EXPIRY_MS:   24 * 60 * 60 * 1000,      // 24 hours
  BCRYPT_ROUNDS:            12,
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE:  1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const FILE_LIMITS = {
  LOGO_MAX_BYTES:    2 * 1024 * 1024,  // 2 MB
  DOCUMENT_MAX_BYTES: 10 * 1024 * 1024, // 10 MB
  IMPORT_MAX_BYTES:  50 * 1024 * 1024, // 50 MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  ALLOWED_IMPORT_TYPES: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
} as const;

export const INDIA_CONSTANTS = {
  // Professional Tax thresholds (Karnataka example — seed with full slab table)
  DEFAULT_PT_STATE: 'KARNATAKA',
  // PF
  PF_EMPLOYEE_RATE: 0.12,       // 12% of basic
  PF_EMPLOYER_RATE: 0.12,       // 12% of basic
  EPF_RATE:         0.0367,     // 3.67% of basic (goes to EPF)
  EPS_RATE:         0.0833,     // 8.33% of basic (goes to EPS, capped at ₹15,000)
  PF_WAGE_CAP:      15000,      // PF calculated on max ₹15,000 basic
  // ESI
  ESI_EMPLOYEE_RATE: 0.0075,    // 0.75%
  ESI_EMPLOYER_RATE: 0.0325,    // 3.25%
  ESI_GROSS_LIMIT:  21000,      // Applicable only if gross ≤ ₹21,000
} as const;
