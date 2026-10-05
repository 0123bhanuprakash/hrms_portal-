import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { openText, sealText } from './email-job-crypto';
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
  notificationEmail,
  type NotificationEmailOptions,
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
  /** Internal: re-sending a logged failure (the log row is updated instead of adding one) */
  retryOf?: string;
  /** Small files (e.g. a report CSV) */
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}

type EmailProvider = 'console' | 'smtp' | 'resend';

export interface EmailStatus {
  provider: string;
  state: 'ok' | 'error' | 'unverified' | 'disabled';
  detail: string;
  from: string;
  checkedAt?: string;
}

/** Turns common SMTP failures into actionable messages. */
function describeSmtpError(message: string): string {
  if (/535|Username and Password not accepted|Invalid login|BadCredentials/i.test(message)) {
    return 'Login rejected — for Gmail use a 16-character App Password (2-Step Verification must be on), not your normal password.';
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(message)) return `Cannot reach the SMTP server (${message}). Check SMTP_HOST / SMTP_PORT and your network.`;
  if (/ETIMEDOUT|timeout/i.test(message)) return 'Connection timed out — port 587/465 may be blocked by a firewall or network.';
  if (/certificate|TLS|SSL/i.test(message)) return `TLS problem: ${message}. Try SMTP_PORT=587 with SMTP_SECURE=false, or 465 with true.`;
  return message;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;
  private readonly outputDir: string;
  private nodemailerTransport?: nodemailer.Transporter;
  private resendClient?: Resend;
  private smtpLabel = '';
  private lastCheck?: { state: 'ok' | 'error'; detail: string; checkedAt: Date };

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    const configured = this.config.get<string>('email.provider') ?? 'console';
    this.provider = configured === 'mailpit' || configured === 'gmail' ? 'smtp' : (configured as EmailProvider);
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
      const secure = this.config.get<boolean>('email.smtp.secure') ?? false;
      const user = this.config.get<string>('email.smtp.user') || undefined;
      const pass = this.config.get<string>('email.smtp.password') || undefined;
      const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);

      this.nodemailerTransport = nodemailer.createTransport({
        host,
        port,
        secure, // implicit TLS (465)
        auth: user && pass ? { user, pass } : undefined,
        // Remote servers must upgrade to TLS (STARTTLS) — never send credentials in clear text.
        // Only a local catcher like Mailpit may skip TLS.
        requireTLS: !secure && !isLocal,
        ignoreTLS: isLocal && !user,
        tls: { minVersion: 'TLSv1.2', servername: host },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
      });
      this.smtpLabel = `${host}:${port}${user ? ` as ${user}` : ''}`;
      this.logger.log(`✉️  Email provider: ${configured === 'gmail' ? 'Gmail SMTP' : 'SMTP'} (${this.smtpLabel})`);
    }
  }

  /** Checks SMTP connectivity + credentials at startup (never blocks boot). */
  async onModuleInit(): Promise<void> {
    if (!this.nodemailerTransport) return;
    await this.verifyConnection();
  }

  async verifyConnection(): Promise<EmailStatus> {
    if (!this.nodemailerTransport) return this.getStatus();
    try {
      await this.nodemailerTransport.verify();
      this.lastCheck = { state: 'ok', detail: `Connected to ${this.smtpLabel}`, checkedAt: new Date() };
      this.logger.log(`✅ SMTP connection verified (${this.smtpLabel})`);
    } catch (err) {
      const message = (err as Error).message;
      this.lastCheck = { state: 'error', detail: describeSmtpError(message), checkedAt: new Date() };
      this.logger.error(`❌ SMTP connection failed (${this.smtpLabel}): ${message}`);
    }
    return this.getStatus();
  }

  /** Delivery mode + last connection check, for the Super Admin System page. */
  getStatus(): EmailStatus {
    const from =
      this.provider === 'resend'
        ? (this.config.get<string>('email.resend.from') ?? '')
        : (this.config.get<string>('email.smtp.from') ?? '');
    if (this.provider === 'console') {
      return { provider: 'console', state: 'disabled', detail: 'Emails are printed to the API log and saved to .mail/', from };
    }
    if (this.provider === 'resend') {
      return { provider: 'resend', state: this.resendClient ? 'ok' : 'error', detail: this.resendClient ? 'Resend API' : 'RESEND_API_KEY missing', from };
    }
    return {
      provider: this.config.get<string>('email.provider') ?? 'smtp',
      state: this.lastCheck?.state ?? 'unverified',
      detail: this.lastCheck?.detail ?? `Not checked yet (${this.smtpLabel})`,
      from,
      checkedAt: this.lastCheck?.checkedAt.toISOString(),
    };
  }

  // ─── Core send method ──────────────────────────────────────

  async send(opts: SendEmailOptions): Promise<void> {
    const from =
      opts.from ??
      (this.provider === 'resend'
        ? (this.config.get<string>('email.resend.from') ?? 'noreply@hrms.app')
        : (this.config.get<string>('email.smtp.from') ?? 'HRMS Portal <noreply@hrms.local>'));

    const started = performance.now();
    try {
      if (this.provider === 'console') {
        await this.writeToConsole(from, opts);
        this.record(opts, 'SENT', started);
        return;
      }

      if (this.provider === 'resend' && this.resendClient) {
        await this.resendClient.emails.send({
          from,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          ...(opts.attachments?.length && { attachments: opts.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'utf8') })) }),
        });
      } else if (this.nodemailerTransport) {
        await this.nodemailerTransport.sendMail({
          from,
          to: opts.to,
          subject: opts.subject,
          html: opts.html,
          ...(opts.attachments?.length && { attachments: opts.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) }),
        });
        this.lastCheck = { state: 'ok', detail: `Last email delivered via ${this.smtpLabel}`, checkedAt: new Date() };
      }
      this.logger.log(`📧 Email sent → ${opts.to} | Subject: "${opts.subject}"`);
      this.record(opts, 'SENT', started);
    } catch (error) {
      this.record(opts, 'FAILED', started, describeSmtpError((error as Error).message));
      if (this.nodemailerTransport) {
        this.lastCheck = { state: 'error', detail: describeSmtpError((error as Error).message), checkedAt: new Date() };
      }
      this.logger.error(`❌ Failed to send email to ${opts.to}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Email log (Super Admin → System): subject, recipient and result. A failed
   * email keeps its HTML encrypted so it can be retried; never blocks sending.
   */
  private record(opts: SendEmailOptions, status: 'SENT' | 'FAILED', started: number, error?: string) {
    if (!this.prisma) return;
    const prisma = this.prisma;
    const durationMs = Math.round(performance.now() - started);
    const secret = this.config.get<string>('jwt.secret') ?? '';
    void (async () => {
      if (opts.retryOf) {
        await prisma.emailLog.update({
          where: { id: opts.retryOf },
          data: status === 'SENT' ? { status, error: null, payload: null, durationMs, retriedAt: new Date() } : { error: error ?? 'Failed again', retriedAt: new Date() },
        });
        return;
      }
      const user = await prisma.user.findUnique({ where: { email: opts.to.toLowerCase() }, select: { companyId: true } });
      await prisma.emailLog.create({
        data: {
          companyId: user?.companyId ?? null,
          to: opts.to,
          subject: opts.subject.slice(0, 300),
          status,
          error: error?.slice(0, 500) ?? null,
          provider: this.provider,
          durationMs,
          payload: status === 'FAILED' && secret ? sealText(opts.html, secret) : null,
        },
      });
    })().catch((e: unknown) => this.logger.warn(`Email log not written: ${(e as Error).message}`));
  }

  /** Re-sends a logged failure with its saved content. */
  async retry(logId: string): Promise<void> {
    if (!this.prisma) throw new Error('Email log unavailable');
    const row = await this.prisma.emailLog.findUnique({ where: { id: logId } });
    if (!row || row.status !== 'FAILED' || !row.payload) throw new Error('This email can no longer be retried');
    const html = openText(row.payload, this.config.get<string>('jwt.secret') ?? '');
    await this.send({ to: row.to, subject: row.subject, html, retryOf: row.id });
  }

  /** Dev-only: print a summary (incl. links) and save the HTML to disk. */
  private async writeToConsole(from: string, opts: SendEmailOptions): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const slug = opts.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    const file = path.join(this.outputDir, `${stamp}_${slug}.html`);
    await fs.writeFile(file, opts.html, 'utf8');
    for (const att of opts.attachments ?? []) {
      await fs.writeFile(path.join(this.outputDir, `${stamp}_${slug}_${att.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`), att.content, 'utf8');
    }

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

  async sendNotification(opts: NotificationEmailOptions & { to: string }): Promise<void> {
    await this.send({ to: opts.to, subject: opts.title, html: notificationEmail(opts) });
  }
}
