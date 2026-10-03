import { Module } from '@nestjs/common';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';

/** Temporary hand-over of approval permissions. */
@Module({
  controllers: [DelegationsController],
  providers: [DelegationsService],
})
export class DelegationsModule {}
