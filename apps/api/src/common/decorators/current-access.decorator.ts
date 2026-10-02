import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AccessContext } from '../../modules/access/access.types';
import type { AuthUser } from '../types/request.types';

/** The caller's AccessContext (features, grants + scopes, employee record). */
export const CurrentAccess = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AccessContext =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user.access,
);
