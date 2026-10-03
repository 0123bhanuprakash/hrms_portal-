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
  /**
   * Route param holding the affected company's id. Needed when the actor
   * has no company of their own (Super Admin), so the entry still shows
   * up in that company's audit trail. e.g. { companyIdParam: 'id' }
   */
  companyIdParam?: string;
}

export interface AuditOptions {
  companyIdParam?: string;
}

export const Audit = (action: string, resourceType?: string, options: AuditOptions = {}) =>
  SetMetadata(AUDIT_KEY, { action, resourceType, ...options } satisfies AuditMetadata);
