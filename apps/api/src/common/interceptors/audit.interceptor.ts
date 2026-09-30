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
    const requestId = request.requestId ?? request.headers['x-request-id'] as string;

    return next.handle().pipe(
      tap({
        next: (responseData: unknown) => {
          // Fire-and-forget: don't await, don't block response
          this.writeAuditLog({
            action: auditMeta.action,
            resourceType: auditMeta.resourceType ?? 'Unknown',
            resourceId: this.extractResourceId(responseData),
            afterState: this.sanitizeState(responseData),
            userId: user?.sub ?? null,
            companyId: user?.company_id ?? null,
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

  /** Extracts the id from response data (handles nested { data: { id } } shapes) */
  private extractResourceId(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;

    if (typeof d['id'] === 'string') return d['id'];

    const nested = d['data'];
    if (nested && typeof nested === 'object') {
      const n = nested as Record<string, unknown>;
      if (typeof n['id'] === 'string') return n['id'];
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
