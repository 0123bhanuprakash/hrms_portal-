import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '@hrms/types';
import type { TenantContext } from '../types/request.types';

// ============================================================
// TenantContextMiddleware
//
// Runs on every request BEFORE guards.
//
// What it does:
//   1. Extracts Bearer token from Authorization header
//   2. DECODES it (without verifying — JwtAuthGuard does that)
//   3. Attaches TenantContext to req.tenantContext:
//        { companyId: string | null, isSuperAdmin: boolean }
//
// This allows guards, interceptors, and decorators downstream
// to read the tenant context without re-parsing the token.
//
// NOTE: PostgreSQL RLS session variables are set inside each
// guard/service method as needed, not globally here, to avoid
// issues with connection pooling and PgBouncer.
// ============================================================

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      try {
        // decode() does NOT verify — fast, no DB hit
        const payload = this.jwtService.decode(token) as JwtPayload | null;

        if (payload?.sub) {
          const tenantContext: TenantContext = {
            companyId: payload.company_id,
            isSuperAdmin: payload.is_super_admin,
          };

          req.tenantContext = tenantContext;
          req.user = payload; // Pre-attach for middleware consumers
        }
      } catch (err) {
        // Silently ignore decode errors — JwtAuthGuard will handle 401
        this.logger.debug('Failed to decode JWT in TenantContextMiddleware', err);
      }
    }

    next();
  }
}
