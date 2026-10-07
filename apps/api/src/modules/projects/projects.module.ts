import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectPlanningService } from './planning.service';
import { ApprovalRouterService } from './approval-router.service';
import { ResourceRequestsController } from './resources.controller';
import { ResourceRequestsService } from './resources.service';

/** Projects, assignments with allocation %, resource requests / releases, and the approval router (leave, attendance). */
@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController, ResourceRequestsController],
  providers: [ProjectsService, ApprovalRouterService, ProjectPlanningService, ResourceRequestsService],
  exports: [ApprovalRouterService],
})
export class ProjectsModule {}
