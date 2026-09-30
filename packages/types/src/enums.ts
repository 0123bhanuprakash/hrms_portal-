// ============================================================
// @hrms/types — Enums
// Single source of truth for all enum values.
// Both apps/api and apps/web import from here.
// ============================================================

// ─── User ────────────────────────────────────────────────────

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
  PENDING_VERIFICATION = 'pending_verification',
}

// ─── Company ─────────────────────────────────────────────────

export enum CompanyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

// ─── Theme ───────────────────────────────────────────────────

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

// ─── Roles ───────────────────────────────────────────────────

export enum DefaultRole {
  SUPER_ADMIN = 'super_admin',
  COMPANY_ADMIN = 'company_admin',
  HR = 'hr',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

// ─── Employment ──────────────────────────────────────────────

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERN = 'intern',
}

export enum EmploymentStatus {
  ACTIVE = 'active',
  PROBATION = 'probation',
  NOTICE_PERIOD = 'notice_period',
  ON_LEAVE = 'on_leave',
  TERMINATED = 'terminated',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

// ─── Leave ───────────────────────────────────────────────────

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  WITHDRAWN = 'withdrawn',
}

export enum LeaveApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SKIPPED = 'skipped',
}

export enum LeaveTypeCategory {
  CASUAL = 'casual',
  SICK = 'sick',
  EARNED = 'earned',
  MATERNITY = 'maternity',
  PATERNITY = 'paternity',
  UNPAID = 'unpaid',
  COMPENSATORY = 'compensatory',
  OTHER = 'other',
}

// ─── Attendance ──────────────────────────────────────────────

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  HALF_DAY = 'half_day',
  ON_LEAVE = 'on_leave',
  HOLIDAY = 'holiday',
  WEEKEND = 'weekend',
  WORK_FROM_HOME = 'work_from_home',
}

// ─── Payroll ─────────────────────────────────────────────────

export enum PayrollRunStatus {
  DRAFT = 'draft',
  LOCKED = 'locked',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PayslipStatus {
  GENERATED = 'generated',
  PUBLISHED = 'published',
  VIEWED = 'viewed',
}

export enum TaxRegime {
  OLD = 'old',
  NEW = 'new',
}

// ─── Import ──────────────────────────────────────────────────

export enum ImportJobStatus {
  UPLOADED = 'uploaded',
  PARSING = 'parsing',
  PARSED = 'parsed',
  VALIDATING = 'validating',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ImportEntityType {
  EMPLOYEE = 'employee',
  ATTENDANCE = 'attendance',
  LEAVE_BALANCE = 'leave_balance',
  SALARY_STRUCTURE = 'salary_structure',
}

// ─── Recruitment ─────────────────────────────────────────────

export enum JobStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
  ON_HOLD = 'on_hold',
}

export enum ApplicationStatus {
  APPLIED = 'applied',
  SCREENING = 'screening',
  INTERVIEW = 'interview',
  OFFER = 'offer',
  HIRED = 'hired',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

// ─── Performance ─────────────────────────────────────────────

export enum ReviewCycleStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum GoalStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ACHIEVED = 'achieved',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
}

// ─── Assets ──────────────────────────────────────────────────

export enum AssetStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  IN_REPAIR = 'in_repair',
  RETIRED = 'retired',
  LOST = 'lost',
}

// ─── Helpdesk ────────────────────────────────────────────────

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// ─── Notifications ───────────────────────────────────────────

export enum NotificationType {
  LEAVE_REQUEST = 'leave_request',
  LEAVE_APPROVED = 'leave_approved',
  LEAVE_REJECTED = 'leave_rejected',
  PAYSLIP_PUBLISHED = 'payslip_published',
  TICKET_UPDATE = 'ticket_update',
  ANNOUNCEMENT = 'announcement',
  BIRTHDAY = 'birthday',
  WORK_ANNIVERSARY = 'work_anniversary',
  SYSTEM = 'system',
}

// ─── Audit ───────────────────────────────────────────────────

export enum AuditAction {
  // Auth
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  TOKEN_REFRESHED = 'auth.token.refreshed',
  TOKEN_REVOKED_ALL = 'auth.token.revoked_all',
  PASSWORD_RESET_REQUESTED = 'auth.password.reset_requested',
  PASSWORD_RESET_COMPLETED = 'auth.password.reset_completed',
  EMAIL_VERIFIED = 'auth.email.verified',
  ACCOUNT_LOCKED = 'auth.account.locked',
  ACCOUNT_UNLOCKED = 'auth.account.unlocked',

  // Company (Super Admin)
  COMPANY_CREATED = 'company.created',
  COMPANY_UPDATED = 'company.updated',
  COMPANY_ACTIVATED = 'company.activated',
  COMPANY_DEACTIVATED = 'company.deactivated',
  COMPANY_SUSPENDED = 'company.suspended',

  // User
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DEACTIVATED = 'user.deactivated',
  USER_ROLE_ASSIGNED = 'user.role.assigned',
  USER_ROLE_REMOVED = 'user.role.removed',

  // Branding
  BRANDING_UPDATED = 'branding.updated',
  BRANDING_LOGO_UPLOADED = 'branding.logo.uploaded',

  // Employee
  EMPLOYEE_CREATED = 'employee.created',
  EMPLOYEE_UPDATED = 'employee.updated',
  EMPLOYEE_TERMINATED = 'employee.terminated',
  EMPLOYEE_SALARY_UPDATED = 'employee.salary.updated',

  // Leave
  LEAVE_REQUESTED = 'leave.requested',
  LEAVE_APPROVED = 'leave.approved',
  LEAVE_REJECTED = 'leave.rejected',
  LEAVE_CANCELLED = 'leave.cancelled',
  LEAVE_BALANCE_ADJUSTED = 'leave.balance.adjusted',

  // Payroll
  PAYROLL_RUN_CREATED = 'payroll.run.created',
  PAYROLL_RUN_LOCKED = 'payroll.run.locked',
  PAYROLL_RUN_COMPLETED = 'payroll.run.completed',
  PAYSLIP_PUBLISHED = 'payroll.payslip.published',

  // Import
  IMPORT_INITIATED = 'import.initiated',
  IMPORT_CONFIRMED = 'import.confirmed',
  IMPORT_COMPLETED = 'import.completed',
  IMPORT_FAILED = 'import.failed',
  IMPORT_CANCELLED = 'import.cancelled',

  // Settings
  SETTINGS_UPDATED = 'settings.updated',
  ROLE_CREATED = 'role.created',
  ROLE_UPDATED = 'role.updated',
  ROLE_DELETED = 'role.deleted',
  PERMISSION_ASSIGNED = 'role.permission.assigned',
}

// ─── Date Formats ────────────────────────────────────────────

export enum DateFormat {
  DD_MM_YYYY = 'DD/MM/YYYY',   // India standard
  MM_DD_YYYY = 'MM/DD/YYYY',   // US
  YYYY_MM_DD = 'YYYY-MM-DD',   // ISO 8601
}

// ─── Sort Order ──────────────────────────────────────────────

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}
