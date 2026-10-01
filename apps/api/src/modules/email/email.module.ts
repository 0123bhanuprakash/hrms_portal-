import { DynamicModule, Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProducerService } from './email.producer.service';
import { EmailProcessor } from './email.processor';
import { isQueueEnabled } from '../queue/queue.config';

// ============================================================
// EmailModule — @Global() so EmailService & EmailProducerService
// are injectable everywhere without explicit imports.
//
// The BullMQ worker (EmailProcessor) is only registered when the
// queue is enabled (REDIS_URL set).
// ============================================================

@Global()
@Module({})
export class EmailModule {
  static register(): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        EmailService,
        EmailProducerService,
        ...(isQueueEnabled() ? [EmailProcessor] : []),
      ],
      exports: [EmailService, EmailProducerService],
    };
  }
}
