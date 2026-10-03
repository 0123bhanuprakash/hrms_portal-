import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetsController } from './assets.controller';
import { AssetTypesService } from './asset-types.service';
import { AssetsService } from './assets.service';
import { AssetRequestsService } from './asset-requests.service';
import { AssetRemindersService } from './asset-reminders.service';

/** Plan B4: asset register, assignments, requests (IT head + HR), warranty reminders. */
@Module({
  imports: [PrismaModule],
  controllers: [AssetsController],
  providers: [AssetTypesService, AssetsService, AssetRequestsService, AssetRemindersService],
})
export class AssetsModule {}
