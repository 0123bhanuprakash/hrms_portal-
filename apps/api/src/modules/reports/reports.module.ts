import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsOverviewService } from './reports-overview.service';
import { ReportSchedulesService } from './report-schedules.service';

/** Role-based analytics: people (HR), attendance & leave, utilisation (PMO). */
@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsOverviewService, ReportSchedulesService],
})
export class ReportsModule {}
