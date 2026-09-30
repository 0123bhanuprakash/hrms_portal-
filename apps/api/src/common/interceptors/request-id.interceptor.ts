import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';

// ============================================================
// RequestIdInterceptor
// - Reads X-Request-ID from incoming request (set by upstream proxy/gateway)
// - Falls back to a newly generated UUID v4 if not present
// - Attaches requestId to req object for use in logs + audit
// - Echoes the ID back in X-Request-ID response header
// ============================================================

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();

    const headers = req['headers'] as Record<string, string | undefined>;
    const requestId = (headers['x-request-id'] ?? randomUUID()) as string;

    // Attach to request so other interceptors / handlers can read it
    req['requestId'] = requestId;

    return next.handle().pipe(
      tap(() => {
        res.setHeader('X-Request-ID', requestId);
      }),
    );
  }
}
