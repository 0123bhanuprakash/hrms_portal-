import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LiveInterceptor } from './live.interceptor';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/** Global: any module can push a live update after a write. */
@Global()
@Module({
  providers: [RealtimeService, RealtimeGateway, { provide: APP_INTERCEPTOR, useClass: LiveInterceptor }],
  exports: [RealtimeService],
})
export class RealtimeModule {}
