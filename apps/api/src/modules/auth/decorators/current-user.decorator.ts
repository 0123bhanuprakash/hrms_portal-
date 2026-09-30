import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@hrms/types';
import type { Request } from 'express';

// ============================================================
// @CurrentUser() param decorator
//
// Injects the currently authenticated user's JWT payload into
// a controller method parameter.
//
// Usage:
//   @Get('me')
//   getMe(@CurrentUser() user: JwtPayload) { ... }
//
// The JwtStrategy attaches the decoded payload to req.user after
// successful token validation.
// ============================================================

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return request.user;
  },
);
