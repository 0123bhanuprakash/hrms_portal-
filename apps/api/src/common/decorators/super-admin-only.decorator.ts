import { SetMetadata } from '@nestjs/common';

// ============================================================
// @SuperAdminOnly() decorator
//
// Marks a route as accessible only to Super Admins.
// The SuperAdminGuard reads this metadata.
//
// Usage:
//   @SuperAdminOnly()
//   @Get('admin/companies')
//   listCompanies() { ... }
// ============================================================

export const IS_SUPER_ADMIN_KEY = 'isSuperAdminOnly';
export const SuperAdminOnly = () => SetMetadata(IS_SUPER_ADMIN_KEY, true);
