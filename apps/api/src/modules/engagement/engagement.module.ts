import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeProfileModule } from '../employee-profile/employee-profile.module';
import { AnnouncementsController, CelebrationsController, KudosController } from './engagement.controller';
import { AnnouncementsService } from './announcements.service';
import { KudosService } from './kudos.service';
import { CelebrationsService } from './celebrations.service';

/** Plan B1–B2: announcements (read / acknowledge), kudos and celebration wishes. */
@Module({
  imports: [PrismaModule, EmployeeProfileModule],
  controllers: [AnnouncementsController, KudosController, CelebrationsController],
  providers: [AnnouncementsService, KudosService, CelebrationsService],
})
export class EngagementModule {}
