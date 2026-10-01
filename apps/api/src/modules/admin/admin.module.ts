import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { HealthModule } from '../../health/health.module';

// PrismaModule, EmailModule and StorageModule are @Global() — no import needed.
@Module({
  imports: [AuthModule, CompaniesModule, HealthModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
