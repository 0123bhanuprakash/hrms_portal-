import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EMAIL_QUEUE_NAME } from '../email/email.job.types';
import { AuthModule } from '../auth/auth.module';
import { BullBoardController } from './bull-board.controller';
import { QueueSessionController } from './queue-session.controller';
import { isQueueEnabled, redisConnectionFromUrl } from './queue.config';

@Global()
@Module({})
export class QueueModule {
  /** BullMQ + Bull Board when REDIS_URL is set; an empty module otherwise. */
  static register(): DynamicModule {
    if (!isQueueEnabled()) {
      new Logger(QueueModule.name).log('📭 REDIS_URL not set — queue disabled, emails are sent inline');
      return { module: QueueModule };
    }

    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            connection: redisConnectionFromUrl(configService.get<string>('redis.url')!),
          }),
          inject: [ConfigService],
        }),
        BullModule.registerQueue({
          name: EMAIL_QUEUE_NAME,
        }),
        AuthModule, // JwtService for Bull Board session tokens
      ],
      // Order matters: /admin/queues/session must be registered before
      // BullBoardController's catch-all /admin/queues/* route.
      controllers: [QueueSessionController, BullBoardController],
      exports: [BullModule],
    };
  }
}
