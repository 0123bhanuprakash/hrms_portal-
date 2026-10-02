// ============================================================
// Common module barrel exports
// Import shared guards, decorators, and interceptors from here
// ============================================================

// Guards
export { PermissionGuard } from './guards/permission.guard';
export { SuperAdminGuard } from './guards/super-admin.guard';
export { TenantGuard } from './guards/tenant.guard';
export { PasswordChangeGuard } from './guards/password-change.guard';

// Decorators
export { RequirePermission } from './decorators/require-permission.decorator';
export { RequireFeature } from './decorators/require-feature.decorator';
export { CurrentAccess } from './decorators/current-access.decorator';
export { SuperAdminOnly } from './decorators/super-admin-only.decorator';
export { TenantCtx } from './decorators/tenant-ctx.decorator';
export { Audit } from './decorators/audit.decorator';
export { AllowPendingPasswordChange } from './decorators/allow-pending-password.decorator';

// Interceptors
export { AuditInterceptor } from './interceptors/audit.interceptor';

// Middleware
export { TenantContextMiddleware } from './middleware/tenant-context.middleware';

// Types
export type { TenantContext, AuthenticatedRequest, AuthUser } from './types/request.types';
