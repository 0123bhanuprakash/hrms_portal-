import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { EmployeeProfileModule } from '../employee-profile/employee-profile.module';
import { ExpensesController } from './expenses.controller';
import { ExpenseCategoriesService } from './categories.service';
import { ExpenseClaimsService } from './claims.service';

/** Plan B3: expense claims → manager → Finance + HR → paid. */
@Module({
  imports: [PrismaModule, ProjectsModule, EmployeeProfileModule],
  controllers: [ExpensesController],
  providers: [ExpenseCategoriesService, ExpenseClaimsService],
})
export class ExpensesModule {}
