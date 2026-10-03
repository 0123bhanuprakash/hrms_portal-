import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload } from '@hrms/types';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';
import { ALLOW_PENDING_PASSWORD_KEY } from '../decorators/allow-pending-password.decorator';

// ============================================================
// PasswordChangeGuard
//
// Users signed in with a temporary password (users.must_change_password,
// loaded fresh on every request by JwtStrategy) can only reach routes
// marked @AllowPendingPasswordChange() until they set their own password.
// Enforced server-side so the web redirect can't simply be skipped.
// ============================================================

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, targets)) return true;

    const user = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>().user;
    if (user?.must_change_password) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Password Change Required',
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Please choose a new password before continuing.',
      });
    }
    return true;
  }
}
