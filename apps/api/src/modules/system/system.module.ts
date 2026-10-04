import { Global, Module } from '@nestjs/common';
import { HealthModule } from '../../health/health.module';
import { AccessModule } from '../access/access.module';
import { MaintenanceGuard } from './maintenance.guard';
import { MaintenanceService } from './maintenance.service';
import { PlatformStatusController, SystemController } from './system.controller';
import { SystemService } from './system.service';

/** Super Admin → System, plus maintenance mode (global: sign-in and the guard read it). */
@Global()
@Module({
  imports: [HealthModule, AccessModule],
  controllers: [SystemController, PlatformStatusController],
  providers: [SystemService, MaintenanceService, MaintenanceGuard],
  exports: [MaintenanceService, MaintenanceGuard],
})
export class SystemModule {}
