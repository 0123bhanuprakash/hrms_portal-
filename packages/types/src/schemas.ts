// ============================================================
// Zod Schemas — Shared validation that runs on BOTH
// frontend (React Hook Form) and backend (NestJS pipes)
// Fully expanded in Chunk 3
// ============================================================

import { z } from 'zod';

// ---- Auth Schemas ----

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ---- Company Schemas ----

export const CreateCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  employeeIdPrefix: z
    .string()
    .min(2, 'Prefix must be at least 2 characters')
    .max(10, 'Prefix cannot exceed 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Prefix must be uppercase letters and numbers only'),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #1E40AF)'),
});

export const CreateCompanyAdminSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email('Invalid email address'),
});

// ---- Branding Schema ----

export const UpdateBrandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  displayName: z.string().min(1).max(100).optional(),
});

// ---- Preferences Schema ----

export const UpdatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  timezone: z.string().optional(),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  notificationsEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

// ---- Inferred Types from Schemas ----

export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type CreateCompanyAdminInput = z.infer<typeof CreateCompanyAdminSchema>;
export type UpdateBrandingInput = z.infer<typeof UpdateBrandingSchema>;
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
