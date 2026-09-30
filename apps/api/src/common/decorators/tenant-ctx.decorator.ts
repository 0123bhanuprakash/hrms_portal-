import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '../types/request.types';

// ============================================================
// @TenantCtx() param decorator
//
// Injects the current request's TenantContext into a controller
// method parameter. Populated by TenantContextMiddleware.
//
// Usage:
//   @Get('employees')
//   findAll(@TenantCtx() ctx: TenantContext) {
//     return this.service.findAll(ctx.companyId);
//   }
// ============================================================

export const TenantCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (
      request.tenantContext ?? {
        companyId: null,
        isSuperAdmin: false,
      }
    );
  },
);
