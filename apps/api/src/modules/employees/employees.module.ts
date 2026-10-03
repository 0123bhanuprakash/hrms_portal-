import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeImportService } from './employee-import.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeImportService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
