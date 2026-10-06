import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeProfileModule } from '../employee-profile/employee-profile.module';
import { HelpdeskController } from './helpdesk.controller';
import { TicketCategoriesService } from './ticket-categories.service';
import { TicketsService } from './tickets.service';
import { HelpdeskRemindersService } from './helpdesk-reminders.service';
import { HelpdeskTeamsService } from './teams.service';

/** Plan B5: tickets to the IT, HR, Finance and DevOps queues, team heads, response targets, auto-close. */
@Module({
  imports: [PrismaModule, EmployeeProfileModule],
  controllers: [HelpdeskController],
  providers: [TicketCategoriesService, TicketsService, HelpdeskRemindersService, HelpdeskTeamsService],
  exports: [TicketsService],
})
export class HelpdeskModule {}
