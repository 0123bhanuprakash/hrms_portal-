import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AttendanceController, HolidaysController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendancePolicyService } from './policy.service';
import { RegularisationService } from './regularisation.service';
import { HolidaysService } from './holidays.service';
import { AttendanceRemindersService } from './attendance-reminders.service';

/** Phase 3 — check-in/out, calendars, corrections, holidays, policy, export. */
@Module({
  imports: [PrismaModule, ProjectsModule],
  controllers: [AttendanceController, HolidaysController],
  providers: [AttendanceService, AttendancePolicyService, RegularisationService, HolidaysService, AttendanceRemindersService],
  exports: [AttendancePolicyService, HolidaysService, AttendanceRemindersService],
})
export class AttendanceModule {}
