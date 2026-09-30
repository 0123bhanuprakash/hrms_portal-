// ============================================================
// @hrms/types — Zod Schemas
// Shared validation that runs on BOTH:
//   - Frontend: React Hook Form validation
//   - Backend:  NestJS ValidationPipe / Zod guards
// ============================================================

import { z } from 'zod';

// ─── Reusable Field Schemas ───────────────────────────────────

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #1E40AF)');

const phone = z
  .string()
  .regex(/^[+]?[0-9\s\-().]{7,20}$/, 'Invalid phone number')
  .optional()
  .nullable();

const uuidV4 = z.string().uuid('Invalid UUID format');

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const employeeIdPrefix = z
  .string()
  .min(2, 'Prefix must be at least 2 characters')
  .max(10, 'Prefix cannot exceed 10 characters')
  .regex(/^[A-Z0-9]+$/, 'Prefix must be uppercase letters and numbers only');

const panNumber = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format (e.g. ABCDE1234F)')
  .optional()
  .nullable();

const aadharNumber = z
  .string()
  .regex(/^[0-9]{12}$/, 'Aadhaar number must be 12 digits')
  .optional()
  .nullable();

// ─── Auth Schemas ─────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// ─── Company Schemas ──────────────────────────────────────────

export const CreateCompanySchema = z.object({
  name: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name cannot exceed 100 characters')
    .trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  employeeIdPrefix: employeeIdPrefix,
  primaryColor: hexColor.default('#1E40AF'),
  secondaryColor: hexColor.default('#EFF6FF').optional(),
});

export const UpdateCompanySchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
});

export const CreateCompanyAdminSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).trim(),
  lastName: z.string().min(1, 'Last name is required').max(50).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});

// ─── Branding Schemas ─────────────────────────────────────────

export const UpdateBrandingSchema = z.object({
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  displayName: z.string().min(1).max(100).trim().optional(),
});

// ─── Company Settings Schemas ─────────────────────────────────

export const UpdateCompanySettingsSchema = z.object({
  employeeIdPrefix: employeeIdPrefix.optional(),
  timezone: z.string().optional(),
  fiscalYearStart: z.number().int().min(1).max(12).optional(),
  workingDaysPerWeek: z.number().int().min(4).max(7).optional(),
  workingHoursPerDay: z.number().int().min(4).max(12).optional(),
});

// ─── User & Preferences Schemas ───────────────────────────────

export const UpdatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  timezone: z.string().optional(),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  notificationsEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

// ─── Employee Schemas ─────────────────────────────────────────

export const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: phone,
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  dateOfBirth: z.string().date().optional().nullable(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']).default('full_time'),
  departmentId: uuidV4.optional().nullable(),
  designationId: uuidV4.optional().nullable(),
  locationId: uuidV4.optional().nullable(),
  reportingManagerId: uuidV4.optional().nullable(),
  joiningDate: z.string().date('Invalid joining date'),
  sendWelcomeEmail: z.boolean().default(true),
});

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().omit({
  email: true,
  sendWelcomeEmail: true,
});

export const EmployeePersonalInfoSchema = z.object({
  phone: phone,
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  dateOfBirth: z.string().date().optional().nullable(),
  address: z.object({
    line1: z.string().max(200).optional(),
    line2: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    pincode: z.string().regex(/^[0-9]{6}$/, 'Invalid pincode').optional(),
    country: z.string().max(100).default('India').optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().max(100),
    relationship: z.string().max(50),
    phone: z.string().regex(/^[+]?[0-9\s\-().]{7,20}$/),
  }).optional(),
});

// ─── Statutory (India) Schemas ────────────────────────────────

export const EmployeeStatutorySchema = z.object({
  pan: panNumber,
  aadhar: aadharNumber,
  uan: z.string().regex(/^[0-9]{12}$/, 'UAN must be 12 digits').optional().nullable(),
  esicNumber: z.string().max(20).optional().nullable(),
  pfAccountNumber: z.string().max(30).optional().nullable(),
  taxRegime: z.enum(['old', 'new']).default('new'),
  isPfEnabled: z.boolean().default(true),
  isEsiEnabled: z.boolean().default(false),  // Set based on gross salary
});

// ─── Bank Details Schema ──────────────────────────────────────

export const EmployeeBankDetailsSchema = z.object({
  accountHolderName: z.string().min(1).max(100),
  accountNumber: z.string().min(9).max(18).regex(/^[0-9]+$/, 'Account number must be numeric'),
  ifscCode: z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code (e.g. SBIN0001234)'),
  bankName: z.string().min(1).max(100),
  branchName: z.string().min(1).max(100),
});

// ─── Leave Schemas ────────────────────────────────────────────

export const CreateLeaveRequestSchema = z
  .object({
    leaveTypeId: uuidV4,
    startDate: z.string().date('Invalid start date'),
    endDate: z.string().date('Invalid end date'),
    reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  });

export const LeaveApprovalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().max(500).optional(),
});

export const CreateLeaveTypeSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  code: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z]+$/, 'Code must be uppercase letters only'),
  category: z.enum([
    'casual', 'sick', 'earned', 'maternity', 'paternity', 'unpaid', 'compensatory', 'other',
  ]),
  daysAllowedPerYear: z.number().int().min(0).max(365),
  carryForward: z.boolean().default(false),
  maxCarryForward: z.number().int().min(0).max(365).default(0),
  isPaid: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  maxLevels: z.number().int().min(1).max(5).default(1),
});

// ─── Attendance Schemas ───────────────────────────────────────

export const ManualAttendanceSchema = z.object({
  employeeId: uuidV4,
  date: z.string().date(),
  checkIn: z.string().datetime().optional().nullable(),
  checkOut: z.string().datetime().optional().nullable(),
  status: z.enum(['present', 'absent', 'half_day', 'on_leave', 'work_from_home']),
  notes: z.string().max(500).optional(),
});

// ─── Role & Permission Schemas ────────────────────────────────

export const CreateRoleSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  description: z.string().max(200).trim().optional(),
  permissionIds: z.array(uuidV4).min(1, 'At least one permission is required'),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  description: z.string().max(200).trim().optional(),
  permissionIds: z.array(uuidV4).optional(),
});

export const AssignRoleSchema = z.object({
  userId: uuidV4,
  roleId: uuidV4,
});

// ─── Query / Filter Schemas ───────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(100).optional(),
});

export const DateRangeSchema = z.object({
  from: z.string().date('Invalid from date'),
  to: z.string().date('Invalid to date'),
}).refine((data) => new Date(data.to) >= new Date(data.from), {
  message: 'To date must be on or after from date',
  path: ['to'],
});

// ─── Inferred Types ───────────────────────────────────────────

// Auth
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// Company
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;
export type CreateCompanyAdminInput = z.infer<typeof CreateCompanyAdminSchema>;
export type UpdateBrandingInput = z.infer<typeof UpdateBrandingSchema>;
export type UpdateCompanySettingsInput = z.infer<typeof UpdateCompanySettingsSchema>;

// User
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;

// Employee
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
export type EmployeePersonalInfoInput = z.infer<typeof EmployeePersonalInfoSchema>;
export type EmployeeStatutoryInput = z.infer<typeof EmployeeStatutorySchema>;
export type EmployeeBankDetailsInput = z.infer<typeof EmployeeBankDetailsSchema>;

// Leave
export type CreateLeaveRequestInput = z.infer<typeof CreateLeaveRequestSchema>;
export type LeaveApprovalActionInput = z.infer<typeof LeaveApprovalActionSchema>;
export type CreateLeaveTypeInput = z.infer<typeof CreateLeaveTypeSchema>;

// Attendance
export type ManualAttendanceInput = z.infer<typeof ManualAttendanceSchema>;

// Role
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;

// Query
export type PaginationQueryInput = z.infer<typeof PaginationQuerySchema>;
export type DateRangeInput = z.infer<typeof DateRangeSchema>;
