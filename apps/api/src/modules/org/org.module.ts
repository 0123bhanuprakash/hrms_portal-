import { Module } from '@nestjs/common';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { EmployeesModule } from '../employees/employees.module';

/** Organisation structure: org levels, org chart, reporting lines. */
@Module({
  imports: [EmployeesModule],
  controllers: [OrgController],
  providers: [OrgService],
})
export class OrgModule {}
