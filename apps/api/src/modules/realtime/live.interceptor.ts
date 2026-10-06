import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import type { AuthUser } from '../../common/types/request.types';
import { LIVE_ACCESS_KEY, LIVE_AREA_KEY, type LiveAccessScope, type LiveAreaMeta } from './live.decorator';
import { RealtimeService, room } from './realtime.service';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * After a successful write under @Live / @LiveAccess, pushes the live update.
 * Fire-and-forget: it never delays or fails the response.
 */
@Injectable()
export class LiveInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly realtime: RealtimeService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!WRITES.has(req.method)) return next.handle();
    const targets = [context.getHandler(), context.getClass()];
    const area = this.reflector.getAllAndOverride<LiveAreaMeta | null | undefined>(LIVE_AREA_KEY, targets);
    const access = this.reflector.getAllAndOverride<LiveAccessScope | undefined>(LIVE_ACCESS_KEY, targets);
    if (!area && !access) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => {
          const user = req.user;
          const companyId = user?.access?.companyId ?? null;
          if (area && companyId && user) {
            const audience = area.to === 'company' ? room.company(companyId) : room.area(companyId, area.area);
            this.realtime.soon([audience, room.user(user.sub)], area.area);
          }
          if (access) {
            const params = req.params ?? {};
            const userId = access === 'caller' ? undefined : (params['userId'] ?? (access === 'user' ? params['id'] : undefined));
            const company = access === 'company' ? params['id'] : undefined;
            if (userId) this.realtime.accessChanged({ userIds: [userId] });
            else if (company) this.realtime.accessChanged({ companyId: company });
            else if (companyId) this.realtime.accessChanged({ companyId });
          }
        },
      }),
    );
  }
}
