import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload } from '@hrms/types';
import { IS_SUPER_ADMIN_KEY } from '../decorators/super-admin-only.decorator';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';

// ============================================================
// SuperAdminGuard
//
// Restricts routes decorated with @SuperAdminOnly() to users
// who are Super Admins (isSuperAdmin === true in JWT payload).
//
// Usage:
//   @SuperAdminOnly()    ← triggers this guard
//   @UseGuards(SuperAdminGuard)   ← OR apply directly
//   @Get('admin/companies')
//   listCompanies() { ... }
//
// Returns 403 Forbidden — the route existence is NOT hidden
// (403 is intentional for super admin routes, unlike 404 for IDOR).
// ============================================================

@Injectable()
export class SuperAdminGuard implements CanActivate {
  private readonly logger = new Logger(SuperAdminGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Check if the route requires super admin access
    const requiresSuperAdmin = this.reflector.getAllAndOverride<boolean>(
      IS_SUPER_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No restriction → allow
    if (!requiresSuperAdmin) return true;

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;

    if (!user?.is_super_admin) {
      this.logger.warn(
        `Super Admin access denied for user=${user?.sub ?? 'unknown'}`,
      );
      throw new ForbiddenException(
        'This action requires Super Administrator privileges',
      );
    }

    return true;
  }
}
