import type { JwtPayload } from '@hrms/types';

// ============================================================
// Express Request type augmentation
//
// Adds typed custom properties to every request object:
//   - req.tenantContext → extracted tenant info (set by TenantContextMiddleware)
//   - req.requestId     → X-Request-ID (set by RequestIdInterceptor)
//
// Note: req.user is typed via JwtPayload (Passport sets it
// during JwtAuthGuard validation).
// ============================================================

export interface TenantContext {
  companyId: string | null;
  isSuperAdmin: boolean;
}

// Augment Express namespace — only add new fields, not user
// (Passport already declares req.user as its own type)
declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      requestId?: string;
    }
  }
}

export type AuthenticatedRequest = import('express').Request & {
  user: JwtPayload;
  tenantContext: TenantContext;
  requestId: string;
};
