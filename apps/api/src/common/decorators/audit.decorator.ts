import { SetMetadata } from '@nestjs/common';

// ============================================================
// @Audit() decorator
//
// Marks a route handler for automatic audit logging.
// The AuditInterceptor reads this metadata and writes an
// AuditLog entry AFTER the handler completes (fire-and-forget).
//
// Usage:
//   @Audit('company.created')
//   @Post('companies')
//   createCompany(@Body() dto: CreateCompanyDto) { ... }
//
//   @Audit('user.login.success')
//   @Post('auth/login')
//   login() { ... }
//
// The resourceType and resourceId are automatically extracted
// from the handler response if it contains { id } or { data.id }.
// ============================================================

export const AUDIT_KEY = 'audit_action';

export interface AuditMetadata {
  action: string;
  resourceType?: string;
}

export const Audit = (action: string, resourceType?: string) =>
  SetMetadata(AUDIT_KEY, { action, resourceType } satisfies AuditMetadata);
