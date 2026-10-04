import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtPayload } from '@hrms/types';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { MaintenanceService } from './maintenance.service';

/**
 * While maintenance mode is on, signed-in company users get 503 "maintenance";
 * Super Admins and public routes (sign-in, status) carry on. Sign-in itself
 * refuses company users in AuthService.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly maintenance: MaintenanceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const user = context.switchToHttp().getRequest<{ user?: JwtPayload }>().user;
    if (!user) return true;
    await this.maintenance.assertOpenFor({ isSuperAdmin: user.is_super_admin });
    return true;
  }
}
