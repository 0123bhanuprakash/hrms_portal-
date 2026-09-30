// ============================================================
// Common module barrel exports
// Import shared guards, decorators, and interceptors from here
// ============================================================

// Guards
export { PermissionGuard } from './guards/permission.guard';
export { SuperAdminGuard } from './guards/super-admin.guard';
export { TenantGuard } from './guards/tenant.guard';

// Decorators
export { RequirePermission } from './decorators/require-permission.decorator';
export { SuperAdminOnly } from './decorators/super-admin-only.decorator';
export { TenantCtx } from './decorators/tenant-ctx.decorator';
export { Audit } from './decorators/audit.decorator';

// Interceptors
export { AuditInterceptor } from './interceptors/audit.interceptor';

// Middleware
export { TenantContextMiddleware } from './middleware/tenant-context.middleware';

// Types
export type { TenantContext, AuthenticatedRequest } from './types/request.types';
