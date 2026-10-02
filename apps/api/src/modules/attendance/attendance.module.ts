import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceController, HolidaysController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendancePolicyService } from './policy.service';
import { RegularisationService } from './regularisation.service';
import { HolidaysService } from './holidays.service';

/** Phase 3 — check-in/out, calendars, corrections, holidays, policy, export. */
@Module({
  imports: [PrismaModule],
  controllers: [AttendanceController, HolidaysController],
  providers: [AttendanceService, AttendancePolicyService, RegularisationService, HolidaysService],
  exports: [AttendancePolicyService, HolidaysService],
})
export class AttendanceModule {}
