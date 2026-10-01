import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ============================================================
// ResponseTransformInterceptor
// Wraps all successful controller responses in:
//   { data: <controller_return_value>, meta?: { request_id } }
//
// Exceptions bypass this — they go through GlobalExceptionFilter.
// Passthrough cases (null, undefined, already-wrapped) are handled.
// ============================================================

interface WrappedResponse<T> {
  data: T;
  meta?: {
    request_id?: string;
    [key: string]: unknown;
  };
}

interface RequestWithId {
  requestId?: string;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, WrappedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<WrappedResponse<T>> {
    const req = context.switchToHttp().getRequest();
    const url = req?.url || req?.originalUrl || '';

    // Bypass transformation for raw HTML / Bull Board UI stream routes
    if (url.includes('/admin/queues')) {
      return next.handle() as any;
    }

    return next.handle().pipe(
      map((data) => {
        // Already wrapped (e.g., paginated responses from service layer)
        if (this.isAlreadyWrapped(data)) {
          return data as unknown as WrappedResponse<T>;
        }

        return {
          data,
          meta: {
            request_id: req.requestId,
          },
        };
      }),
    );
  }

  /**
   * Checks if data is already in { data: ..., meta?: ... } envelope.
   * Prevents double-wrapping from services that return paginated results.
   */
  private isAlreadyWrapped(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'data' in data &&
      Object.keys(data).every((key) => ['data', 'meta'].includes(key))
    );
  }
}
