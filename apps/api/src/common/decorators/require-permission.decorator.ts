import { SetMetadata } from '@nestjs/common';

// ============================================================
// @RequirePermission() decorator
//
// Attaches a permission key to a route's metadata.
// The PermissionGuard reads this to enforce access control.
//
// Usage:
//   @RequirePermission('employee:create')
//   @Post('employees')
//   createEmployee() { ... }
//
//   @RequirePermission('leave:approve')
//   @Patch('leaves/:id/approve')
//   approveLeave() { ... }
// ============================================================

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
