import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import {
  resetPasswordEmail,
  verifyEmailTemplate,
  welcomeCompanyAdminEmail,
  welcomeEmployeeEmail,
  type ResetPasswordEmailOptions,
  type VerifyEmailOptions,
  type WelcomeCompanyAdminOptions,
  type WelcomeEmployeeOptions,
} from './templates/email.templates';

// ============================================================
// EmailService — Unified email sending interface
//
// In development  → Nodemailer → Mailpit SMTP (localhost:1025)
//                   All emails are caught locally, none leave your machine
//
// In production   → Resend API
//                   Set EMAIL_PROVIDER=resend in .env
//
// Usage:
//   await this.emailService.sendResetPassword({ to, firstName, resetLink });
//   await this.emailService.sendVerifyEmail({ to, firstName, verifyLink });
//   await this.emailService.sendWelcomeCompanyAdmin({ to, firstName, ... });
//   await this.emailService.sendWelcomeEmployee({ to, firstName, ... });
// ============================================================

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: 'mailpit' | 'resend';
  private nodemailerTransport?: nodemailer.Transporter;
  private resendClient?: Resend;

  constructor(private readonly config: ConfigService) {
    this.provider =
      (this.config.get<string>('email.provider') as 'mailpit' | 'resend') ??
      'mailpit';

    if (this.provider === 'resend') {
      const apiKey = this.config.get<string>('email.resend.apiKey');
      if (!apiKey) {
        this.logger.warn('RESEND_API_KEY not set — email sending will fail in production');
      } else {
        this.resendClient = new Resend(apiKey);
        this.logger.log('✉️  Email provider: Resend');
      }
    } else {
      const host = this.config.get<string>('email.smtp.host') ?? 'localhost';
      const port = this.config.get<number>('email.smtp.port') ?? 1025;

      this.nodemailerTransport = nodemailer.createTransport({
        host,
        port,
        secure: false,    // Mailpit does not use TLS
        ignoreTLS: true,  // No TLS for local Mailpit
      });
      this.logger.log(`✉️  Email provider: Mailpit (${host}:${port}) — view at http://localhost:8025`);
    }
  }

  // ─── Core send method ──────────────────────────────────────

  async send(opts: SendEmailOptions): Promise<void> {
    const from =
      opts.from ??
      (this.provider === 'resend'
        ? (this.config.get<string>('email.resend.from') ?? 'noreply@hrms.app')
        : (this.config.get<string>('email.smtp.from') ?? 'HRMS Portal <noreply@hrms.local>'));

    try {
      if (this.provider === 'resend' && this.resendClient) {
        await this.resendClient.emails.send({
          from,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
        });
      } else if (this.nodemailerTransport) {
        await this.nodemailerTransport.sendMail({
          from,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
        });
      }
      this.logger.log(`📧 Email sent → ${opts.to} | Subject: "${opts.subject}"`);
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${opts.to}`, error);
      throw error;
    }
  }

  // ─── Convenience methods ───────────────────────────────────

  async sendResetPassword(
    opts: ResetPasswordEmailOptions & { to: string },
  ): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `Reset your ${opts.companyName ?? 'HRMS Portal'} password`,
      html: resetPasswordEmail(opts),
    });
  }

  async sendVerifyEmail(
    opts: VerifyEmailOptions & { to: string },
  ): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `Verify your ${opts.companyName ?? 'HRMS Portal'} email address`,
      html: verifyEmailTemplate(opts),
    });
  }

  async sendWelcomeCompanyAdmin(
    opts: WelcomeCompanyAdminOptions & { to: string },
  ): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `Welcome to ${opts.companyName ?? 'HRMS Portal'} — Your Admin Account`,
      html: welcomeCompanyAdminEmail(opts),
    });
  }

  async sendWelcomeEmployee(
    opts: WelcomeEmployeeOptions & { to: string },
  ): Promise<void> {
    await this.send({
      to: opts.to,
      subject: `Welcome to ${opts.companyName ?? 'HRMS Portal'}`,
      html: welcomeEmployeeEmail(opts),
    });
  }
}
