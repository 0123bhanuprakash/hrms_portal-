import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ProjectsModule } from '../projects/projects.module';
import { LeaveController } from './leave.controller';
import { LeaveTypesService } from './leave-types.service';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveRequestsService } from './leave-requests.service';

/** Phase 4 — leave types, balances, requests with multi-level approval, who's off. */
@Module({
  imports: [PrismaModule, AttendanceModule, ProjectsModule],
  controllers: [LeaveController],
  providers: [LeaveTypesService, LeaveBalancesService, LeaveRequestsService],
})
export class LeaveModule {}
