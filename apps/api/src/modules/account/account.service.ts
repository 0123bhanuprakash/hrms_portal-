import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { EmailProducerService } from '../email/email.producer.service';
import { detectFileType, IMAGE_TYPES } from '../employee-profile/file-types';
import { deviceFamily, networkOf } from '../auth/auth.service';
import { generateTemporaryPassword, hashPassword } from '../auth/password.util';

const DAY = 86_400_000;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;
export const REAUTH_AUDIENCE = 'reauth';
const REAUTH_TTL_SECONDS = 5 * 60;

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

/**
 * Profile & security for the signed-in person (Super Admin console):
 * overview, photo, email change, own sign-in history and recent actions,
 * "confirm your password" tokens, and the list of platform admins.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly emailProducer: EmailProducerService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Overview ─────────────────────────────────────────────

  async overview(userId: string) {
    const since = new Date(Date.now() - 30 * DAY);
    const [user, lastSignIn, actions, touched, sessions, prefs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, isSuperAdmin: true, emailVerifiedAt: true, createdAt: true, lastLoginAt: true, passwordChangedAt: true },
      }),
      // The sign-in before this session (the current one is the latest)
      this.prisma.signInAttempt.findMany({ where: { userId, success: true }, orderBy: { at: 'desc' }, take: 2, select: { at: true, ipAddress: true, userAgent: true } }),
      this.prisma.auditLog.count({ where: { userId, createdAt: { gte: since } } }),
      this.prisma.auditLog.groupBy({ by: ['companyId'], where: { userId, createdAt: { gte: since }, companyId: { not: null } } }).then((r) => r.length),
      this.prisma.refreshToken.groupBy({ by: ['familyId'], where: { userId, isRevoked: false, expiresAt: { gt: new Date() } } }).then((r) => r.length),
      this.prisma.userPreferences.findUnique({ where: { userId }, select: { notifyNewDevice: true, idleTimeoutMinutes: true, reauthForRisky: true } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    const pending = await this.prisma.emailVerificationToken.findFirst({
      where: { userId, newEmail: { not: null }, verifiedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { newEmail: true, expiresAt: true },
    });
    const previous = lastSignIn[1] ?? lastSignIn[0] ?? null;
    return {
      user,
      lastSignIn: previous ? { at: previous.at, device: deviceFamily(previous.userAgent), ipAddress: previous.ipAddress } : null,
      actions30d: actions,
      companiesTouched30d: touched,
      activeDevices: sessions,
      pendingEmail: pending ? { email: pending.newEmail, expiresAt: pending.expiresAt } : null,
      protection: { notifyNewDevice: prefs?.notifyNewDevice ?? true, idleTimeoutMinutes: prefs?.idleTimeoutMinutes ?? null, reauthForRisky: prefs?.reauthForRisky ?? false },
    };
  }

  /** What this person did recently (from the audit log). */
  async recentActions(userId: string, limit = 8) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(30, limit),
      select: { id: true, action: true, resourceType: true, createdAt: true, company: { select: { id: true, name: true } } },
    });
  }

  // ─── Photo ────────────────────────────────────────────────

  async uploadAvatar(userId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No photo provided');
    if (file.size > AVATAR_MAX_BYTES) throw new BadRequestException('Photo must be 2 MB or smaller');
    const type = detectFileType(file.buffer);
    if (!type || !IMAGE_TYPES.has(type.ext)) throw new BadRequestException('Photo must be a JPG, PNG or WebP image');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { companyId: true } });
    // Random name: the public URL can't be guessed from the user id
    const key = `${user.companyId ?? 'platform'}/avatars/user-${userId}-${randomBytes(8).toString('hex')}.${type.ext}`;
    const avatarUrl = await this.storage.upload(key, file.buffer, type.mime);
    return this.setAvatar(userId, avatarUrl);
  }

  removeAvatar(userId: string) {
    return this.setAvatar(userId, null);
  }

  private async setAvatar(userId: string, avatarUrl: string | null) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl }, select: { id: true, avatarUrl: true } });
    await this.prisma.employee.updateMany({ where: { userId }, data: { avatarUrl } });
    return user;
  }

  // ─── Email change ─────────────────────────────────────────

  /** Sends a confirmation link to the new address; the email changes only once it's opened. */
  async requestEmailChange(userId: string, newEmail: string, password: string) {
    const email = newEmail.trim().toLowerCase();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, firstName: true, passwordHash: true, isSuperAdmin: true } });
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new BadRequestException('Password is incorrect');
    if (email === user.email) throw new BadRequestException('That is already your email');
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new ConflictException('Another account already uses that email');

    const raw = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      // One pending change at a time
      this.prisma.emailVerificationToken.deleteMany({ where: { userId, newEmail: { not: null }, verifiedAt: null } }),
      this.prisma.emailVerificationToken.create({ data: { userId, tokenHash: hashToken(raw), newEmail: email, expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS) } }),
    ]);
    const base = this.config.get<string>('webUrl') ?? 'http://localhost:3000';
    const link = `${base}/${user.isSuperAdmin ? 'platform/' : ''}verify-email?change=${raw}`;
    await this.email.send({
      to: email,
      subject: 'Confirm your new email for HRMS',
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1c1917">
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>You asked to use this address for your HRMS account. Confirm it within 24 hours:</p>
        <p><a href="${link}" style="display:inline-block;background:#b7791f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">Confirm new email</a></p>
        <p style="color:#78716c">Until you confirm, you keep signing in with ${escapeHtml(user.email)}. Didn’t ask for this? Ignore this email.</p>
      </div>`,
    });
    // Tell the old address too
    void this.email
      .send({
        to: user.email,
        subject: 'Your HRMS email is being changed',
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1c1917"><p>Someone signed in as you asked to change your email to <b>${escapeHtml(email)}</b>. If that wasn’t you, change your password now.</p></div>`,
      })
      .catch(() => undefined);
    return { pendingEmail: email };
  }

  async cancelEmailChange(userId: string) {
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId, newEmail: { not: null }, verifiedAt: null } });
    return { cancelled: true };
  }

  /** Opened from the link (no sign-in needed). Signs out every device afterwards. */
  async confirmEmailChange(raw: string) {
    const token = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!token?.newEmail || token.verifiedAt || token.expiresAt < new Date()) throw new BadRequestException('This link is invalid or has expired');
    if (await this.prisma.user.findUnique({ where: { email: token.newEmail }, select: { id: true } })) throw new ConflictException('Another account already uses that email');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: token.id }, data: { verifiedAt: now } }),
      this.prisma.user.update({ where: { id: token.userId }, data: { email: token.newEmail, emailVerifiedAt: now } }),
      this.prisma.employee.updateMany({ where: { userId: token.userId }, data: { email: token.newEmail } }),
      this.prisma.refreshToken.updateMany({ where: { userId: token.userId, isRevoked: false }, data: { isRevoked: true } }),
    ]);
    return { email: token.newEmail };
  }

  // ─── Sign-in history ──────────────────────────────────────

  async signIns(userId: string, query: { status?: 'success' | 'failed'; limit?: number }) {
    const since = new Date(Date.now() - 30 * DAY);
    const rows = await this.prisma.signInAttempt.findMany({
      where: { userId, at: { gte: since }, ...(query.status && { success: query.status === 'success' }) },
      orderBy: { at: 'desc' },
      take: Math.min(100, query.limit ?? 30),
      select: { id: true, at: true, success: true, ipAddress: true, userAgent: true },
    });
    // "New network": no successful sign-in from that network + device earlier
    const history = await this.prisma.signInAttempt.findMany({
      where: { userId, success: true, at: { gte: new Date(Date.now() - 120 * DAY) } },
      orderBy: { at: 'asc' },
      select: { at: true, ipAddress: true, userAgent: true },
    });
    const firstSeen = new Map<string, number>();
    for (const h of history) {
      const k = `${networkOf(h.ipAddress)}|${deviceFamily(h.userAgent)}`;
      if (!firstSeen.has(k)) firstSeen.set(k, h.at.getTime());
    }
    const firstEver = history[0]?.at.getTime() ?? Infinity;
    // New = there was history before, and this network + device hadn't signed in successfully until now
    const isNew = (r: { at: Date; ipAddress: string | null; userAgent: string | null }) => {
      const seen = firstSeen.get(`${networkOf(r.ipAddress)}|${deviceFamily(r.userAgent)}`);
      return firstEver < r.at.getTime() && (seen === undefined || seen >= r.at.getTime());
    };
    return {
      failedFromNewPlaces: rows.filter((r) => !r.success && isNew(r)).length,
      data: rows.map((r) => ({ id: r.id, at: r.at, success: r.success, ipAddress: r.ipAddress, device: deviceFamily(r.userAgent), newNetwork: isNew(r) })),
    };
  }

  // ─── Confirm password before risky changes ────────────────

  async reauth(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new BadRequestException('Password is incorrect');
    const token = await this.jwt.signAsync({ sub: userId }, { audience: REAUTH_AUDIENCE, expiresIn: REAUTH_TTL_SECONDS });
    return { token, expiresAt: new Date(Date.now() + REAUTH_TTL_SECONDS * 1000) };
  }

  /** True when `token` is a fresh "confirm password" token for this user. */
  async verifyReauth(userId: string, token: string | undefined): Promise<boolean> {
    if (!token) return false;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { audience: REAUTH_AUDIENCE });
      return payload.sub === userId;
    } catch {
      return false;
    }
  }

  // ─── Platform admins ──────────────────────────────────────

  async platformAdmins() {
    const admins = await this.prisma.user.findMany({
      where: { isSuperAdmin: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, status: true, lastLoginAt: true, createdAt: true, mustChangePassword: true },
    });
    return admins.map((a) => ({ ...a, invited: a.mustChangePassword && !a.lastLoginAt }));
  }

  async inviteAdmin(input: { email: string; firstName: string; lastName: string }) {
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new ConflictException('An account with that email already exists');
    const temporaryPassword = generateTemporaryPassword();
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        isSuperAdmin: true,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    try {
      await this.emailProducer.queueWelcomeCompanyAdmin({
        to: email,
        email,
        firstName: user.firstName,
        companyName: 'the HRMS platform (Super Admin)',
        loginUrl: `${this.config.get<string>('webUrl')}/platform/login`,
        temporaryPassword,
      });
    } catch (err) {
      this.logger.error(`Invite email to ${email} failed: ${(err as Error).message}`);
    }
    return user;
  }

  /** Takes away Super Admin access (never your own, never the last active one). */
  async removeAdmin(actorId: string, adminId: string) {
    if (actorId === adminId) throw new ForbiddenException('You can’t remove your own access');
    const admin = await this.prisma.user.findUnique({ where: { id: adminId }, select: { id: true, email: true, isSuperAdmin: true } });
    if (!admin?.isSuperAdmin) throw new NotFoundException('Super Admin not found');
    const others = await this.prisma.user.count({ where: { isSuperAdmin: true, status: 'ACTIVE', id: { not: adminId } } });
    if (!others) throw new BadRequestException('At least one Super Admin must remain');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: adminId }, data: { status: 'INACTIVE' } }),
      this.prisma.refreshToken.updateMany({ where: { userId: adminId, isRevoked: false }, data: { isRevoked: true } }),
    ]);
    return { id: admin.id, email: admin.email, removed: true };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
