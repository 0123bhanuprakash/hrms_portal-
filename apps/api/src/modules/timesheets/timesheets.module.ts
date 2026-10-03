import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { TimesheetRemindersService } from './timesheet-reminders.service';

/** Weekly timesheets per project / task, approved like leave (project lead / PM / line manager). */
@Module({
  imports: [PrismaModule, ProjectsModule],
  controllers: [TimesheetsController],
  providers: [TimesheetsService, TimesheetRemindersService],
})
export class TimesheetsModule {}
