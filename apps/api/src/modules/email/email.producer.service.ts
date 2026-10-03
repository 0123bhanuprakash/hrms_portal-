import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { sealJobData } from './email-job-crypto';
import {
  EMAIL_QUEUE_NAME,
  EMAIL_JOBS,
  EmailJobType,
  WelcomeCompanyAdminJobData,
  WelcomeEmployeeJobData,
  ResetPasswordJobData,
  VerifyEmailJobData,
  NotificationJobData,
} from './email.job.types';

// ============================================================
// EmailProducerService
//
// With Redis (REDIS_URL set) → jobs are added to the BullMQ email
// queue and sent by EmailProcessor with retries.
// Without Redis → the email is sent inline via EmailService.
// ============================================================

@Injectable()
export class EmailProducerService {
  private readonly logger = new Logger(EmailProducerService.name);

  private readonly defaultJobOptions: JobsOptions = {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s, 8s, 16s
    },
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // 7 days (DLQ review)
    },
  };

  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    @Optional() @InjectQueue(EMAIL_QUEUE_NAME) private readonly emailQueue?: Queue,
  ) {}

  async queueWelcomeCompanyAdmin(data: WelcomeCompanyAdminJobData): Promise<void> {
    await this.dispatch(EMAIL_JOBS.WELCOME_COMPANY_ADMIN, data, 'welcome email for company admin', () =>
      this.emailService.sendWelcomeCompanyAdmin(data),
    );
  }

  async queueWelcomeEmployee(data: WelcomeEmployeeJobData): Promise<void> {
    await this.dispatch(EMAIL_JOBS.WELCOME_EMPLOYEE, data, 'welcome email for employee', () =>
      this.emailService.sendWelcomeEmployee(data),
    );
  }

  async queueResetPassword(data: ResetPasswordJobData): Promise<void> {
    await this.dispatch(EMAIL_JOBS.RESET_PASSWORD, data, 'password reset email', () =>
      this.emailService.sendResetPassword(data),
    );
  }

  async queueVerifyEmail(data: VerifyEmailJobData): Promise<void> {
    await this.dispatch(EMAIL_JOBS.VERIFY_EMAIL, data, 'email verification', () =>
      this.emailService.sendVerifyEmail(data),
    );
  }

  async queueNotification(data: NotificationJobData): Promise<void> {
    await this.dispatch(EMAIL_JOBS.NOTIFICATION, data, 'notification email', () => this.emailService.sendNotification(data));
  }

  private async dispatch(
    jobName: EmailJobType,
    data: { to: string },
    label: string,
    sendInline: () => Promise<void>,
  ): Promise<void> {
    if (!this.emailQueue) {
      await sendInline();
      return;
    }

    // Temporary passwords / links are encrypted while they sit in Redis
    const sealed = sealJobData(data, this.config.get<string>('jwt.secret')!);
    const job = await this.emailQueue.add(jobName, sealed, this.defaultJobOptions);
    this.logger.log(`📥 Enqueued ${label}: ${data.to} (Job ID: ${job.id})`);
  }
}
