// ============================================================
// @hrms/types — Interfaces & Type Definitions
// ============================================================

import type {
  UserStatus,
  CompanyStatus,
  Theme,
  DefaultRole,
  EmploymentType,
  EmploymentStatus,
  Gender,
  LeaveStatus,
  LeaveApprovalStatus,
  LeaveTypeCategory,
  AttendanceStatus,
  PayrollRunStatus,
  PayslipStatus,
  TaxRegime,
  ImportJobStatus,
  ImportEntityType,
  AuditAction,
  DateFormat,
  SortOrder,
  NotificationType,
} from './enums';

// ─── API Response Envelope ───────────────────────────────────

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  requestId?: string;
}

export interface ApiResponse<T = unknown> {
  data: T;
  meta?: ApiMeta;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: Required<Omit<ApiMeta, 'requestId'>> & { requestId?: string };
}

/**
 * RFC 7807 Problem Details — used for all error responses
 * https://tools.ietf.org/html/rfc7807
 */
export interface ApiError {
  type: string;        // URI reference e.g. /errors/validation
  title: string;       // Short human-readable summary
  status: number;      // HTTP status code
  detail: string;      // Longer explanation
  instance?: string;   // The URI of the specific request
  errors?: Record<string, string[]>; // Field-level validation errors
  code?: string;       // App-level error code e.g. "EMAIL_NOT_VERIFIED"
}

// ─── Pagination Query ────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: SortOrder;
  search?: string;
}

// ─── Auth & Identity ─────────────────────────────────────────

export interface JwtPayload {
  sub: string;                  // User UUID
  email: string;                // User email (embedded for convenience)
  company_id: string | null;    // null for Super Admin
  is_super_admin: boolean;
  roles: string[];
  permissions: string[];        // e.g. ['employee:create', 'leave:approve']
  iat?: number;
  exp?: number;
}

export interface TenantContext {
  company_id: string;
  is_super_admin: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;           // access token TTL in seconds
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: UserProfile;
}

export interface RefreshResponse {
  tokens: AuthTokens;
}

// ─── User ────────────────────────────────────────────────────

export interface UserPreferences {
  theme: Theme;
  timezone: string;             // e.g. 'Asia/Kolkata'
  dateFormat: DateFormat;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;             // Computed: firstName + ' ' + lastName
  avatarUrl: string | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  companyId: string | null;
  roles: DefaultRole[];
  permissions: string[];
  preferences: UserPreferences;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  status: UserStatus;
}

// ─── Company ─────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: CompanyStatus;
  settings: CompanySettings;
  branding: CompanyBranding;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  userCount?: number;
  employeeCount?: number;
  createdAt: string;
}

export interface CompanySettings {
  companyId: string;
  employeeIdPrefix: string;     // e.g. 'CL', 'ACM'
  employeeIdSequence: number;   // Current sequence number
  timezone: string;             // e.g. 'Asia/Kolkata'
  fiscalYearStart: number;      // Month number (1=Jan, 4=Apr)
  workingDaysPerWeek: number;   // 5 or 6
  workingHoursPerDay: number;   // typically 8 or 9
}

export interface CompanyBranding {
  companyId: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;         // Hex e.g. '#1E40AF'
  secondaryColor: string;       // Hex e.g. '#F0F9FF'
  displayName: string;          // Name shown in UI (may differ from legal name)
}

// ─── Roles & Permissions ─────────────────────────────────────

export interface RolePermission {
  id: string;
  module: string;               // e.g. 'employee'
  action: string;               // e.g. 'create'
  key: string;                  // e.g. 'employee:create' (computed)
  description: string;
}

export interface Role {
  id: string;
  companyId: string | null;     // null = system role (not editable)
  name: string;
  description: string;
  isSystemRole: boolean;
  permissions: RolePermission[];
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Employee ────────────────────────────────────────────────

export interface Employee {
  id: string;
  companyId: string;
  employeeId: string;           // e.g. 'CL001'
  userId: string;
  user: UserSummary;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  departmentId: string | null;
  department: DepartmentSummary | null;
  designationId: string | null;
  designation: DesignationSummary | null;
  locationId: string | null;
  reportingManagerId: string | null;
  reportingManager: EmployeeSummary | null;
  joiningDate: string;
  confirmationDate: string | null;
  terminationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSummary {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  designationId: string | null;
  designation: DesignationSummary | null;
  departmentId: string | null;
  department: DepartmentSummary | null;
  employmentStatus: EmploymentStatus;
}

// ─── Organization ────────────────────────────────────────────

export interface Department {
  id: string;
  companyId: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  headEmployeeId: string | null;
  headEmployee: EmployeeSummary | null;
  employeeCount?: number;
  createdAt: string;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  code: string;
}

export interface Designation {
  id: string;
  companyId: string;
  name: string;
  level: number;                // 1 = entry, higher = senior
  createdAt: string;
}

export interface DesignationSummary {
  id: string;
  name: string;
  level: number;
}

// ─── Leave ───────────────────────────────────────────────────

export interface LeaveType {
  id: string;
  companyId: string;
  name: string;
  code: string;                 // e.g. 'CL', 'SL', 'EL'
  category: LeaveTypeCategory;
  daysAllowedPerYear: number;
  carryForward: boolean;
  maxCarryForward: number;
  isPaid: boolean;
  requiresApproval: boolean;
  maxLevels: number;            // Approval levels required
  createdAt: string;
}

export interface LeaveBalance {
  id: string;
  companyId: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType: LeaveType;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;        // Computed: total - used - pending
  carriedForward: number;
}

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  employee: EmployeeSummary;
  leaveTypeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  currentLevel: number;
  approvals: LeaveApproval[];
  createdAt: string;
  updatedAt: string;
}

export interface LeaveApproval {
  id: string;
  leaveRequestId: string;
  approverId: string;
  approver: UserSummary;
  level: number;
  status: LeaveApprovalStatus;
  comments: string | null;
  actedAt: string | null;
}

// ─── Attendance ──────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employee: EmployeeSummary;
  date: string;                 // YYYY-MM-DD
  checkIn: string | null;       // ISO datetime
  checkOut: string | null;      // ISO datetime
  workingHours: number | null;  // In minutes
  status: AttendanceStatus;
  isManualEntry: boolean;
  notes: string | null;
}

// ─── Payroll ─────────────────────────────────────────────────

export interface PayrollRun {
  id: string;
  companyId: string;
  month: number;                // 1-12
  year: number;
  status: PayrollRunStatus;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedAt: string | null;
  processedBy: UserSummary | null;
  createdAt: string;
}

export interface Payslip {
  id: string;
  companyId: string;
  payrollRunId: string;
  employeeId: string;
  employee: EmployeeSummary;
  month: number;
  year: number;
  status: PayslipStatus;

  // Earnings
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  otherAllowances: number;
  overtimeAmount: number;
  bonus: number;
  grossEarnings: number;

  // Deductions
  employeePf: number;
  employeeEsi: number;
  professionalTax: number;
  tds: number;
  loanEmi: number;
  otherDeductions: number;
  totalDeductions: number;

  // Net
  netSalary: number;

  // Employer contributions (shown on payslip, not deducted from employee)
  employerPf: number;
  employerEsi: number;
  ctc: number;

  // Statutory
  taxRegime: TaxRegime;
  pan: string | null;           // Masked e.g. 'ABCDE****F'
  uan: string | null;           // UAN for PF

  pdfUrl: string | null;        // Signed URL
  publishedAt: string | null;
  createdAt: string;
}

// ─── Import Pipeline ─────────────────────────────────────────

export interface ImportJob {
  id: string;
  companyId: string;
  entityType: ImportEntityType;
  status: ImportJobStatus;
  fileName: string;
  totalRows: number | null;
  validRows: number | null;
  invalidRows: number | null;
  processedRows: number | null;
  errorSummary: Record<string, number> | null;   // errorType → count
  initiatedBy: UserSummary;
  completedAt: string | null;
  createdAt: string;
}

// ─── Audit Log ───────────────────────────────────────────────

export interface AuditLog {
  id: string;
  companyId: string | null;
  userId: string | null;
  user: UserSummary | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

// ─── Notification ────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;  // Context-specific payload
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────

export interface SuperAdminStats {
  totalCompanies: number;
  activeCompanies: number;
  inactiveCompanies: number;
  suspendedCompanies: number;
  totalUsers: number;
  newCompaniesLast30Days: number;
}

export interface CompanyDashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveToday: number;
  pendingLeaveRequests: number;
  presentToday: number;
  attendanceRate: number;        // Percentage
  payrollPendingMonth: boolean;
  openTickets: number;
}

// ─── Health Check ────────────────────────────────────────────

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;               // In seconds
  version: string;
}

export interface ReadinessStatus {
  status: 'ok' | 'error';
  services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    elasticsearch: 'ok' | 'error';
  };
}
