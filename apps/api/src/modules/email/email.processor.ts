import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { openJobData } from './email-job-crypto';
import {
  EMAIL_QUEUE_NAME,
  EMAIL_JOBS,
  WelcomeCompanyAdminJobData,
  WelcomeEmployeeJobData,
  ResetPasswordJobData,
  VerifyEmailJobData,
  NotificationJobData,
} from './email.job.types';

@Processor(EMAIL_QUEUE_NAME)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`⚙️  Processing email job: ${job.name} (Job ID: ${job.id}, Attempt: ${job.attemptsMade + 1})`);

    // Decrypt temporary passwords / links sealed by EmailProducerService
    const data = openJobData(job.data as object, this.config.get<string>('jwt.secret')!);

    switch (job.name) {
      case EMAIL_JOBS.WELCOME_COMPANY_ADMIN:
        await this.emailService.sendWelcomeCompanyAdmin(data as WelcomeCompanyAdminJobData);
        break;

      case EMAIL_JOBS.WELCOME_EMPLOYEE:
        await this.emailService.sendWelcomeEmployee(data as WelcomeEmployeeJobData);
        break;

      case EMAIL_JOBS.RESET_PASSWORD:
        await this.emailService.sendResetPassword(data as ResetPasswordJobData);
        break;

      case EMAIL_JOBS.VERIFY_EMAIL:
        await this.emailService.sendVerifyEmail(data as VerifyEmailJobData);
        break;

      case EMAIL_JOBS.NOTIFICATION:
        await this.emailService.sendNotification(data as NotificationJobData);
        break;

      default:
        this.logger.warn(`⚠️ Unknown email job type: ${job.name}`);
        throw new Error(`Unknown job type: ${job.name}`);
    }

    this.logger.log(`✅ Completed email job: ${job.name} (Job ID: ${job.id})`);
  }
}
