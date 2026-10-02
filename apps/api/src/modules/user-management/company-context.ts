import { BadRequestException } from '@nestjs/common';
import type { TenantContext } from '../../common/types/request.types';

/** These routes act on the caller's own company; Super Admins use /admin/* instead. */
export function companyOf(ctx: TenantContext): string {
  if (!ctx.companyId) throw new BadRequestException('Sign in as a company user to manage users and roles');
  return ctx.companyId;
}
