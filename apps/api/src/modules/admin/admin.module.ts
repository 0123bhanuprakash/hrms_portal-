import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { HealthModule } from '../../health/health.module';
import { PlansModule } from '../plans/plans.module';
import { CompanyInsightsService } from './company-insights.service';

// PrismaModule, EmailModule and StorageModule are @Global() — no import needed.
@Module({
  imports: [AuthModule, CompaniesModule, HealthModule, PlansModule],
  controllers: [AdminController],
  providers: [AdminService, CompanyInsightsService],
  exports: [AdminService],
})
export class AdminModule {}
