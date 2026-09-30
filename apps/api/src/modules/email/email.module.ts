import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

// ============================================================
// EmailModule — @Global() so EmailService is injectable
// everywhere without explicit imports.
//
// EmailService auto-selects provider based on EMAIL_PROVIDER env:
//   'mailpit' (default) → Nodemailer → localhost:1025
//   'resend'            → Resend API
// ============================================================

@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
