import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { promises as fs } from 'fs';
import * as path from 'path';
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
// EMAIL_PROVIDER=console (default) → nothing is sent. Subject + links are
//                   printed to the terminal and the full HTML is saved to
//                   apps/api/.mail/ so it can be opened in a browser.
//
// EMAIL_PROVIDER=smtp → Nodemailer → any SMTP server (e.g. Mailpit)
//                   ('mailpit' is accepted as an alias)
//
// EMAIL_PROVIDER=resend → Resend API (production)
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

type EmailProvider = 'console' | 'smtp' | 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;
  private readonly outputDir: string;
  private nodemailerTransport?: nodemailer.Transporter;
  private resendClient?: Resend;

  constructor(private readonly config: ConfigService) {
    const configured = this.config.get<string>('email.provider') ?? 'console';
    this.provider = configured === 'mailpit' ? 'smtp' : (configured as EmailProvider);
    this.outputDir = path.resolve(this.config.get<string>('email.outputDir') ?? '.mail');

    if (this.provider === 'console') {
      this.logger.log(`✉️  Email provider: console — emails saved to ${this.outputDir}`);
    } else if (this.provider === 'resend') {
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
      this.logger.log(`✉️  Email provider: SMTP (${host}:${port})`);
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
      if (this.provider === 'console') {
        await this.writeToConsole(from, opts);
        return;
      }

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

  /** Dev-only: print a summary (incl. links) and save the HTML to disk. */
  private async writeToConsole(from: string, opts: SendEmailOptions): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const slug = opts.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const file = path.join(this.outputDir, `${stamp}_${slug}.html`);
    await fs.writeFile(file, opts.html, 'utf8');

    const links = [...opts.html.matchAll(/href="(https?:\/\/[^"]+)"/g)]
      .map((m) => m[1]!.replace(/&amp;/g, '&'))
      .filter((href, i, all) => all.indexOf(href) === i);

    this.logger.log(
      [
        `📧 [console] ${from} → ${opts.to}`,
        `   Subject: ${opts.subject}`,
        ...links.map((href) => `   Link:    ${href}`),
        `   Saved:   ${file}`,
      ].join('\n'),
    );
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
