// ============================================================
// Email HTML Templates
// Professional, responsive HTML email templates
// Used by EmailService to send transactional emails
// ============================================================

export interface BaseTemplateOptions {
  companyName?: string;
  logoUrl?: string;
  primaryColor?: string;
  year?: number;
}

function baseLayout(content: string, opts: BaseTemplateOptions = {}): string {
  const {
    companyName = 'HRMS Portal',
    logoUrl,
    primaryColor = '#4F46E5',
    year = new Date().getFullYear(),
  } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${companyName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f4f4f5; color: #18181b; -webkit-text-size-adjust: 100%; }
    a { color: ${primaryColor}; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 40px 16px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: ${primaryColor}; padding: 32px; text-align: center; }
    .header img { max-height: 48px; }
    .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; margin-top: ${logoUrl ? '12px' : '0'}; }
    .body { padding: 40px 36px; }
    .body h2 { font-size: 20px; font-weight: 700; color: #18181b; margin-bottom: 12px; }
    .body p { font-size: 15px; line-height: 1.7; color: #3f3f46; margin-bottom: 16px; }
    .btn { display: inline-block; padding: 14px 32px; background: ${primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 8px 0 24px; }
    .info-box { background: #f4f4f5; border-radius: 8px; padding: 20px 24px; margin: 20px 0; }
    .info-box p { margin: 0; font-size: 14px; color: #52525b; }
    .info-box strong { color: #18181b; }
    .credential { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #e4e4e7; }
    .credential:last-child { border-bottom: none; }
    .credential .label { font-size: 13px; color: #71717a; }
    .credential .value { font-size: 14px; font-weight: 600; color: #18181b; font-family: 'Courier New', monospace; }
    .divider { height: 1px; background: #e4e4e7; margin: 28px 0; }
    .warning { background: #fef9c3; border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #713f12; margin: 16px 0; }
    .footer { padding: 24px 36px; text-align: center; }
    .footer p { font-size: 12px; color: #a1a1aa; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} logo" />` : ''}
        <h1>${companyName}</h1>
      </div>
      <div class="body">
        ${content}
      </div>
    </div>
    <div class="footer">
      <p>© ${year} ${companyName}. All rights reserved.<br />
      This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// Reset Password Email
// ─────────────────────────────────────────────────────────────

export interface ResetPasswordEmailOptions extends BaseTemplateOptions {
  firstName: string;
  resetLink: string;
  expiresInMinutes?: number;
}

export function resetPasswordEmail(opts: ResetPasswordEmailOptions): string {
  const { firstName, resetLink, expiresInMinutes = 15 } = opts;

  const content = `
    <h2>Reset your password</h2>
    <p>Hi ${firstName},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetLink}" class="btn">Reset Password</a>
    </div>
    <div class="warning">
      ⏰ This link expires in <strong>${expiresInMinutes} minutes</strong>. If it's already expired, simply request a new one.
    </div>
    <div class="divider"></div>
    <p style="font-size:13px; color:#71717a;">
      If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
      If you're concerned about unauthorized access, please contact your administrator immediately.
    </p>
    <p style="font-size:13px; color:#71717a;">
      Or copy and paste this URL into your browser:<br />
      <a href="${resetLink}" style="word-break:break-all; font-size:12px;">${resetLink}</a>
    </p>
  `;

  return baseLayout(content, opts);
}

// ─────────────────────────────────────────────────────────────
// Verify Email
// ─────────────────────────────────────────────────────────────

export interface VerifyEmailOptions extends BaseTemplateOptions {
  firstName: string;
  verifyLink: string;
  expiresInHours?: number;
}

export function verifyEmailTemplate(opts: VerifyEmailOptions): string {
  const { firstName, verifyLink, expiresInHours = 24 } = opts;

  const content = `
    <h2>Verify your email address</h2>
    <p>Hi ${firstName},</p>
    <p>Welcome! Before you can log in, please verify your email address by clicking the button below.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verifyLink}" class="btn">Verify Email Address</a>
    </div>
    <div class="warning">
      ⏰ This link expires in <strong>${expiresInHours} hours</strong>.
    </div>
    <div class="divider"></div>
    <p style="font-size:13px; color:#71717a;">
      If you didn't create an account, you can safely ignore this email.
    </p>
    <p style="font-size:13px; color:#71717a;">
      Or copy and paste this URL:<br />
      <a href="${verifyLink}" style="word-break:break-all; font-size:12px;">${verifyLink}</a>
    </p>
  `;

  return baseLayout(content, opts);
}

// ─────────────────────────────────────────────────────────────
// Welcome Company Admin
// ─────────────────────────────────────────────────────────────

export interface WelcomeCompanyAdminOptions extends BaseTemplateOptions {
  firstName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}

export function welcomeCompanyAdminEmail(opts: WelcomeCompanyAdminOptions): string {
  const { firstName, email, temporaryPassword, loginUrl } = opts;
  const companyName = opts.companyName ?? 'HRMS Portal';

  const content = `
    <h2>Welcome to ${companyName}!</h2>
    <p>Hi ${firstName},</p>
    <p>Your company portal has been set up on <strong>${companyName}</strong>. You've been added as a <strong>Company Administrator</strong>.</p>
    <p>Here are your login credentials:</p>
    <div class="info-box">
      <div class="credential">
        <span class="label">Login URL</span>
        <span class="value"><a href="${loginUrl}">${loginUrl}</a></span>
      </div>
      <div class="credential">
        <span class="label">Email</span>
        <span class="value">${email}</span>
      </div>
      <div class="credential">
        <span class="label">Temporary Password</span>
        <span class="value">${temporaryPassword}</span>
      </div>
    </div>
    <div class="warning">
      🔒 For security, please change your password immediately after your first login.
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${loginUrl}" class="btn">Log in to Your Portal</a>
    </div>
    <div class="divider"></div>
    <p style="font-size:13px; color:#71717a;">
      As Company Administrator, you can manage employees, configure branding, set up departments, and more. 
      If you have any questions, contact your platform administrator.
    </p>
  `;

  return baseLayout(content, opts);
}

// ─────────────────────────────────────────────────────────────
// Welcome Employee
// ─────────────────────────────────────────────────────────────

export interface WelcomeEmployeeOptions extends BaseTemplateOptions {
  firstName: string;
  email: string;
  temporaryPassword: string;
  employeeId: string;
  loginUrl: string;
}

export function welcomeEmployeeEmail(opts: WelcomeEmployeeOptions): string {
  const { firstName, email, temporaryPassword, employeeId, loginUrl } = opts;
  const companyName = opts.companyName ?? 'HRMS Portal';

  const content = `
    <h2>Welcome to ${companyName}!</h2>
    <p>Hi ${firstName},</p>
    <p>You've been added to the <strong>${companyName}</strong> HR Management System. Here are your login details:</p>
    <div class="info-box">
      <div class="credential">
        <span class="label">Employee ID</span>
        <span class="value">${employeeId}</span>
      </div>
      <div class="credential">
        <span class="label">Email</span>
        <span class="value">${email}</span>
      </div>
      <div class="credential">
        <span class="label">Temporary Password</span>
        <span class="value">${temporaryPassword}</span>
      </div>
    </div>
    <div class="warning">
      🔒 Please change your password immediately after your first login.
    </div>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${loginUrl}" class="btn">Access Your Portal</a>
    </div>
  `;

  return baseLayout(content, opts);
}
