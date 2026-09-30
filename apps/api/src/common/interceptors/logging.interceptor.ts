import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// ============================================================
// LoggingInterceptor
// Emits structured JSON logs for every HTTP request:
//
// {
//   "timestamp":  "2026-09-30T05:00:00.000Z",
//   "level":      "info",
//   "request_id": "uuid",
//   "method":     "POST",
//   "path":       "/api/v1/auth/login",
//   "status":     200,
//   "duration_ms": 42,
//   "user_id":    "uuid | null",
//   "company_id": "uuid | null",
//   "ip":         "103.x.x.x"
// }
// ============================================================

interface RequestWithContext {
  method: string;
  url: string;
  ip: string;
  requestId?: string;
  user?: { id?: string; companyId?: string };
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.log(req, res.statusCode, startedAt);
        },
        error: (err: { status?: number }) => {
          this.log(req, err?.status ?? 500, startedAt);
        },
      }),
    );
  }

  private log(
    req: RequestWithContext,
    statusCode: number,
    startedAt: number,
  ): void {
    const durationMs = Date.now() - startedAt;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ??
      'unknown';

    const logEntry = {
      timestamp: new Date().toISOString(),
      request_id: req.requestId ?? null,
      method: req.method,
      path: req.url,
      status: statusCode,
      duration_ms: durationMs,
      user_id: req.user?.id ?? null,
      company_id: req.user?.companyId ?? null,
      ip,
    };

    const message = `${req.method} ${req.url} ${statusCode} ${durationMs}ms`;

    if (statusCode >= 500) {
      this.logger.error(message, JSON.stringify(logEntry));
    } else if (statusCode >= 400) {
      this.logger.warn(message, JSON.stringify(logEntry));
    } else {
      this.logger.log(message, JSON.stringify(logEntry));
    }
  }
}
