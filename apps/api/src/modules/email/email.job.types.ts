import {
  NotificationEmailOptions,
  ResetPasswordEmailOptions,
  VerifyEmailOptions,
  WelcomeCompanyAdminOptions,
  WelcomeEmployeeOptions,
} from './templates/email.templates';

export const EMAIL_QUEUE_NAME = 'email';

export const EMAIL_JOBS = {
  WELCOME_COMPANY_ADMIN: 'send-welcome-company-admin',
  WELCOME_EMPLOYEE: 'send-welcome-employee',
  RESET_PASSWORD: 'send-reset-password',
  VERIFY_EMAIL: 'send-verify-email',
  NOTIFICATION: 'send-notification',
} as const;

export type EmailJobType = (typeof EMAIL_JOBS)[keyof typeof EMAIL_JOBS];

export interface WelcomeCompanyAdminJobData extends WelcomeCompanyAdminOptions {
  to: string;
}

export interface WelcomeEmployeeJobData extends WelcomeEmployeeOptions {
  to: string;
}

export interface ResetPasswordJobData extends ResetPasswordEmailOptions {
  to: string;
}

export interface VerifyEmailJobData extends VerifyEmailOptions {
  to: string;
}

export interface NotificationJobData extends NotificationEmailOptions {
  to: string;
}
