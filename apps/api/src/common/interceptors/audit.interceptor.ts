import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import type { JwtPayload } from '@hrms/types';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { AUDIT_KEY, type AuditMetadata } from '../decorators/audit.decorator';

// ============================================================
// AuditInterceptor
//
// Automatically writes to AuditLog after any handler decorated
// with @Audit('action', 'ResourceType').
//
// Behavior:
//   - Runs AFTER the handler completes successfully
//   - Fires-and-forgets (non-blocking — does not delay the response)
//   - Extracts resourceId from response data if available
//   - Captures IP, User-Agent, and X-Request-ID
//   - Silently swallows logging errors (audit must never crash the app)
//
// Example:
//   @Audit('company.created', 'Company')
//   @Post('companies')
//   create(@Body() dto) { return this.service.create(dto); }
//   // AuditLog entry written after response is sent
// ============================================================

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.getAllAndOverride<AuditMetadata | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Audit() decorator — pass through
    if (!auditMeta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<
      Request & { user?: JwtPayload; requestId?: string }
    >();

    const user = request.user;
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      request.ip ??
      'unknown';
    const userAgent = request.headers['user-agent'] ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: (rawResponse: unknown) => {
          // This interceptor wraps the global RequestId / ResponseTransform
          // interceptors, so read the request id and unwrap { data, meta }
          // only once the handler has finished.
          const responseData = this.unwrapEnvelope(rawResponse);
          const requestId = request.requestId ?? (request.headers['x-request-id'] as string | undefined);

          // Fire-and-forget: don't await, don't block response
          this.writeAuditLog({
            action: auditMeta.action,
            resourceType: auditMeta.resourceType ?? 'Unknown',
            resourceId: this.extractResourceId(responseData),
            afterState: this.sanitizeState(responseData),
            userId: user?.sub ?? null,
            companyId: this.resolveCompanyId(user, request.params, auditMeta, responseData),
            ip,
            userAgent,
            requestId,
          }).catch((err: unknown) => {
            // Audit errors must NEVER crash the app
            this.logger.error('Failed to write audit log', err);
          });
        },
        error: (_err: unknown) => {
          // Don't audit failed requests (could log separately if needed)
        },
      }),
    );
  }

  // ─── Private helpers ───────────────────────────────────────

  private async writeAuditLog(opts: {
    action: string;
    resourceType: string;
    resourceId: string | null;
    afterState: Record<string, unknown> | null;
    userId: string | null;
    companyId: string | null;
    ip: string;
    userAgent: string;
    requestId?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: opts.action,
        resourceType: opts.resourceType,
        resourceId: opts.resourceId,
        afterState: opts.afterState ? (opts.afterState as object) : undefined,
        userId: opts.userId,
        companyId: opts.companyId,
        ipAddress: opts.ip,
        userAgent: opts.userAgent,
        requestId: opts.requestId,
      },
    });
  }

  /** `{ data, meta }` (ResponseTransformInterceptor envelope) → `data` */
  private unwrapEnvelope(response: unknown): unknown {
    if (response && typeof response === 'object' && 'data' in response) {
      const keys = Object.keys(response);
      if (keys.every((k) => k === 'data' || k === 'meta')) {
        return (response as { data: unknown }).data;
      }
    }
    return response;
  }

  /**
   * Company the action belongs to:
   *   1. the actor's own company (tenant users)
   *   2. the route param named by @Audit(..., { companyIdParam }) (Super Admin acting on a company)
   *   3. a `company` object in the response (e.g. company creation)
   */
  private resolveCompanyId(
    user: JwtPayload | undefined,
    params: Record<string, string> | undefined,
    meta: AuditMetadata,
    responseData: unknown,
  ): string | null {
    if (user?.company_id) return user.company_id;

    if (meta.companyIdParam && params?.[meta.companyIdParam]) {
      return params[meta.companyIdParam]!;
    }

    const company = (responseData as { company?: { id?: unknown } } | null)?.company;
    return typeof company?.id === 'string' ? company.id : null;
  }

  /** Extracts the id from response data (handles { data: { id } } and { company: { id } } shapes) */
  private extractResourceId(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;

    if (typeof d['id'] === 'string') return d['id'];

    for (const key of ['data', 'company']) {
      const nested = d[key];
      if (nested && typeof nested === 'object') {
        const n = nested as Record<string, unknown>;
        if (typeof n['id'] === 'string') return n['id'];
      }
    }

    return null;
  }

  /** Removes sensitive fields before storing in audit log */
  private sanitizeState(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;

    const SENSITIVE_KEYS = new Set([
      'password',
      'passwordHash',
      'password_hash',
      'token',
      'tokenHash',
      'token_hash',
      'refreshToken',
      'refresh_token',
      'secret',
      'apiKey',
      'api_key',
    ]);

    const sanitize = (obj: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_KEYS.has(key)) {
          result[key] = '[REDACTED]';
        } else if (value instanceof Date) {
          result[key] = value.toISOString();
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = sanitize(value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return sanitize(data as Record<string, unknown>);
  }
}
