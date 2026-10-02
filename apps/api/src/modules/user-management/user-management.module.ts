import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompanyUsersController } from './company-users.controller';
import { CompanyUsersService } from './company-users.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/** Company Admin → Users and Roles & Permissions. */
@Module({
  imports: [AuthModule],
  controllers: [RolesController, CompanyUsersController],
  providers: [RolesService, CompanyUsersService],
})
export class UserManagementModule {}
