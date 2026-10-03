import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ApprovalRouterService } from './approval-router.service';

/** Projects, assignments with allocation %, and the approval router (leave, attendance). */
@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ApprovalRouterService],
  exports: [ApprovalRouterService],
})
export class ProjectsModule {}
