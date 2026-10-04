import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlanInsightsService } from './plan-insights.service';

/** Super Admin: subscription plans and per-company feature switches & limits. */
@Module({
  controllers: [PlansController],
  providers: [PlansService, PlanInsightsService],
  exports: [PlansService],
})
export class PlansModule {}
