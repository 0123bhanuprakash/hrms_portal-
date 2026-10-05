import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtPayload } from '@hrms/types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './account.service';

export const RISKY_KEY = 'risky';
/**
 * A change that can hurt many people (suspending a company, changing plans,
 * maintenance mode, Super Admin access). Super Admins who turned on
 * "Ask for my password again" must send a fresh confirm-password token
 * (header `x-reauth`, from POST /account/reauth).
 */
export const Risky = () => SetMetadata(RISKY_KEY, true);

@Injectable()
export class ReauthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly account: AccountService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.reflector.getAllAndOverride<boolean>(RISKY_KEY, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<{ user?: JwtPayload; headers: Record<string, string | string[] | undefined> }>();
    const user = req.user;
    if (!user?.is_super_admin) return true;
    const prefs = await this.prisma.userPreferences.findUnique({ where: { userId: user.sub }, select: { reauthForRisky: true } });
    if (!prefs?.reauthForRisky) return true;
    const header = req.headers['x-reauth'];
    if (await this.account.verifyReauth(user.sub, Array.isArray(header) ? header[0] : header)) return true;
    throw new ForbiddenException({ message: 'Confirm your password to continue', code: 'reauth_required' });
  }
}
