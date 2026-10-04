import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { normalizePath, requestMetrics } from './request-metrics';

/** Times every request (guards' rejections included) once the response is sent. */
@Injectable()
export class RequestMetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = performance.now();
    res.on('finish', () => {
      if (req.method === 'OPTIONS') return;
      const r = req as Request & { route?: { path?: string }; baseUrl?: string; user?: { sub?: string; company_id?: string | null } };
      const route = r.route?.path ? `${r.baseUrl ?? ''}${r.route.path}` : normalizePath(req.originalUrl ?? req.url);
      const user = r.user?.sub ? { id: r.user.sub, companyId: r.user.company_id ?? null } : null;
      requestMetrics.record(req.method, route, res.statusCode, Math.round(performance.now() - start), user);
    });
    next();
  }
}
