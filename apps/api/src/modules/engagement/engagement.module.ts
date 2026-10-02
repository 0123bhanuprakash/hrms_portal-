import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeProfileModule } from '../employee-profile/employee-profile.module';
import { AnnouncementsController, KudosController } from './engagement.controller';
import { AnnouncementsService } from './announcements.service';
import { KudosService } from './kudos.service';

/** Plan B1–B2: announcements (read / acknowledge) and kudos. */
@Module({
  imports: [PrismaModule, EmployeeProfileModule],
  controllers: [AnnouncementsController, KudosController],
  providers: [AnnouncementsService, KudosService],
})
export class EngagementModule {}
