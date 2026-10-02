import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';
import { featureOf } from '../../modules/access/catalog';
import { holds } from '../../modules/access/access.types';
import type { AuthUser } from '../types/request.types';

// ============================================================
// PermissionGuard — layers 1 + 2 of access control
//
//   1. Feature   — @RequireFeature('x') or the feature of the required
//                  permission must be enabled for the company
//                  → else 403 FEATURE_NOT_ENABLED
//   2. Permission — @RequirePermission('leave.approve') must be granted
//                  by one of the user's roles → else 403
//   3. Scope (which records) is applied in services via AccessService.
//
// Access comes from req.user.access, built per request by JwtStrategy
// from version-keyed caches — role edits apply on the next request.
// Super Admins bypass company access control.
// Also sets X-Access-Version so the web can refresh menus on change.
// ============================================================

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const http = context.switchToHttp();
    const user = http.getRequest<Request & { user?: AuthUser }>().user;
    const access = user?.access;
    if (access) http.getResponse<Response>().setHeader('X-Access-Version', access.version);

    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, targets);
    const feature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, targets) ?? (permission ? featureOf(permission) : undefined);
    if (!permission && !feature) return true;

    if (!user || !access) throw new ForbiddenException('Not authenticated');
    if (access.isSuperAdmin) return true;

    const features = [feature, permission ? featureOf(permission) : undefined].filter(Boolean) as string[];
    const off = features.find((f) => !access.features.has(f));
    if (off) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Feature Not Enabled',
        code: 'FEATURE_NOT_ENABLED',
        feature: off,
        message: 'This feature is not enabled for your company.',
      });
    }

    if (permission && !holds(access, permission)) {
      this.logger.warn(`Permission denied: user=${user.sub} required="${permission}"`);
      throw new ForbiddenException(`You do not have permission to perform this action. Required: ${permission}`);
    }
    return true;
  }
}
