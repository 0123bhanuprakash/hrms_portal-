import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetsController } from './assets.controller';
import { AssetTypesService } from './asset-types.service';
import { AssetsService } from './assets.service';
import { AssetRequestsService } from './asset-requests.service';
import { AssetRemindersService } from './asset-reminders.service';
import { AssetKitsService } from './asset-kits.service';
import { AssetChecksService } from './asset-checks.service';
import { EmployeeProfileModule } from '../employee-profile/employee-profile.module';
import { HelpdeskModule } from '../helpdesk/helpdesk.module';

/** Assets: register, assignments & loans, requests (team lead → manager → HR → IT head), starter kits, repairs, documents, yearly check, reminders. */
@Module({
  imports: [PrismaModule, EmployeeProfileModule, HelpdeskModule],
  controllers: [AssetsController],
  providers: [AssetTypesService, AssetsService, AssetRequestsService, AssetRemindersService, AssetKitsService, AssetChecksService],
  exports: [AssetKitsService],
})
export class AssetsModule {}
