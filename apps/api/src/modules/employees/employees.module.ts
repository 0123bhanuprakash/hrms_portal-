import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeImportService } from './employee-import.service';
import { EmployeeLifecycleService } from './lifecycle.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [PrismaModule, EmailModule, AssetsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeImportService, EmployeeLifecycleService],
  exports: [EmployeesService, EmployeeLifecycleService],
})
export class EmployeesModule {}
