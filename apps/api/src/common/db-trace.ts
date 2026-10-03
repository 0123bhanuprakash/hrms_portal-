import { AsyncLocalStorage } from 'async_hooks';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { Prisma } from '@prisma/client';

// ============================================================
// DB_TRACE=true — per-request database accounting for speed work.
// Every response gets `X-DB-Queries: <n>` and
// `Server-Timing: db;dur=<ms>;desc="<n> queries", app;dur=<ms>`.
// Off by default (production): no store, no headers, no overhead.
// ============================================================

export const dbTraceEnabled = () => process.env['DB_TRACE'] === 'true';

interface TraceStore {
  queries: number;
  dbMs: number;
  start: number;
}
const store = new AsyncLocalStorage<TraceStore>();

/** Express middleware: opens a trace for the request. */
export function dbTraceMiddleware(_req: Request, _res: Response, next: NextFunction) {
  store.run({ queries: 0, dbMs: 0, start: performance.now() }, next);
}

/** Prisma middleware ($use): counts and times queries in the current request. */
export async function countQuery(params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>): Promise<unknown> {
  const s = store.getStore();
  if (!s) return next(params);
  const t = performance.now();
  try {
    return await next(params);
  } finally {
    s.queries++;
    s.dbMs += performance.now() - t;
  }
}

/** Writes the headers once the handler has finished (before the body is sent). */
@Injectable()
export class DbTraceInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = ctx.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        const s = store.getStore();
        if (!s || res.headersSent) return;
        res.setHeader('X-DB-Queries', String(s.queries));
        res.setHeader('Server-Timing', `db;dur=${s.dbMs.toFixed(1)};desc="${s.queries} queries", app;dur=${(performance.now() - s.start).toFixed(1)}`);
      }),
    );
  }
}
