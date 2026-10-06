import { Module } from '@nestjs/common';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { CoverService } from './cover.service';
import { DelegationsLiveService } from './delegations-live.service';

/** Temporary hand-over of approval permissions. */
@Module({
  controllers: [DelegationsController],
  providers: [DelegationsService, CoverService, DelegationsLiveService],
})
export class DelegationsModule {}
