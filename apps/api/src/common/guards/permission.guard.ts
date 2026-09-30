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
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';

// ============================================================
// PermissionGuard
//
// Enforces permission-based access control on routes decorated
// with @RequirePermission('resource:action').
//
// Flow:
//   1. Skip if route is @Public() or has no @RequirePermission()
//   2. Extract user's permissions from JWT (req.user.permissions)
//   3. Check if required permission is included
//   4. Return 403 if not — never 404 (existence is not leaked)
//
// NOTE: In Chunk 8 permissions come from the JWT payload.
// In a future enhancement, a Redis cache layer can be added
// (key: perms:{userId}, TTL: 15 min) to handle role changes
// without waiting for token refresh.
// ============================================================

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Read required permission from route metadata
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission required → allow (JwtAuthGuard already ensured authentication)
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // Super Admin bypasses all permission checks
    if (user.is_super_admin) return true;

    // Check if user has the required permission
    const hasPermission = user.permissions?.includes(requiredPermission) ?? false;

    if (!hasPermission) {
      this.logger.warn(
        `Permission denied: user=${user.sub} | required="${requiredPermission}" | has=[${user.permissions?.join(', ')}]`,
      );
      throw new ForbiddenException(
        `You do not have permission to perform this action. Required: ${requiredPermission}`,
      );
    }

    return true;
  }
}
