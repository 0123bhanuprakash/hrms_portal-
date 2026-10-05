import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountController, PlatformAdminsController } from './account.controller';
import { AccountService } from './account.service';
import { ReauthGuard } from './reauth.guard';

/** Profile & security for the signed-in person, platform admins, and the confirm-password guard. */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [AccountController, PlatformAdminsController],
  providers: [AccountService, ReauthGuard],
  exports: [AccountService, ReauthGuard],
})
export class AccountModule {}
