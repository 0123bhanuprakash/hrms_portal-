import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import type { JwtPayload } from '@hrms/types';
import type {
  LoginResponse,
  RefreshResponse,
  AuthUserResponse,
} from './dto/auth.dto';

// ============================================================
// AuthService — Core authentication business logic
//
// Responsibilities:
//   - login()   → validate credentials, issue tokens, handle lockout
//   - refresh() → rotate refresh token with reuse detection
//   - logout()  → revoke refresh token
//   - me()      → return enriched user object from JWT payload
// ============================================================

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;    // 15 minutes
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Login ─────────────────────────────────────────────────

  async login(email: string, password: string, ipAddress?: string): Promise<LoginResponse> {
    // 1. Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      // Timing-safe: still run bcrypt to prevent timing attacks
      await bcrypt.compare(password, '$2a$12$invalidhashtopreventtimingattack');
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfterSecs = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 1000,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Account Locked',
          message: `Account locked due to too many failed attempts. Try again in ${retryAfterSecs} seconds.`,
          retry_after: retryAfterSecs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. Validate password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      const newAttempts = user.loginAttempts + 1;
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_DURATION_MS)
            : undefined,
        },
      });

      if (shouldLock) {
        this.logger.warn(`Account locked: ${email} after ${newAttempts} failed attempts`);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Account Locked',
            message: 'Account locked for 15 minutes due to too many failed attempts.',
            retry_after: LOCKOUT_DURATION_MS / 1000,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException(
        `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempt(s) remaining.`,
      );
    }

    // 4. Check account status
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Account is ${user.status.toLowerCase()}. Please contact support.`,
      );
    }

    // 5. Reset lockout counters on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // 6. Collect roles + permissions from DB join
    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    ];

    // 7. Issue tokens
    const { accessToken, refreshToken } = await this.issueTokens(
      user.id,
      user.email,
      user.isSuperAdmin,
      user.companyId,
      roles,
      permissions,
    );

    this.logger.log(`Login success: ${email} (id=${user.id})`);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        companyId: user.companyId,
        roles,
        permissions,
      },
    };
  }

  // ─── Refresh token rotation ─────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<RefreshResponse> {
    // 1. Hash the incoming token to look it up in DB
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 2. Detect token reuse — if token was already revoked, revoke entire family
    if (stored.isRevoked) {
      this.logger.warn(
        `🚨 Token reuse detected! Revoking all sessions for user ${stored.userId}`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, familyId: stored.familyId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException(
        'Token reuse detected. All sessions have been revoked for your security. Please log in again.',
      );
    }

    // 3. Check expiry
    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException('Refresh token has expired. Please log in again.');
    }

    // 4. Check user is still active
    if (stored.user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is inactive. Please contact support.');
    }

    // 5. Revoke the used token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    // 6. Collect permissions
    const roles = stored.user.userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        stored.user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    ];

    // 7. Issue a new access + refresh token pair (same family)
    const { accessToken, refreshToken } = await this.issueTokens(
      stored.userId,
      stored.user.email,
      stored.user.isSuperAdmin,
      stored.user.companyId,
      roles,
      permissions,
      stored.familyId, // keep same family for reuse detection chain
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  // ─── Logout ────────────────────────────────────────────────

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  }

  // ─── Me (current user) ─────────────────────────────────────

  async me(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.key),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      companyId: user.companyId,
      roles,
      permissions,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async issueTokens(
    userId: string,
    email: string,
    isSuperAdmin: boolean,
    companyId: string | null,
    roles: string[],
    permissions: string[],
    existingFamilyId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      is_super_admin: isSuperAdmin,
      company_id: companyId,
      roles,
      permissions,
    };

    // Sign access token
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: `${ACCESS_TOKEN_TTL_SECONDS}s`,
    });

    // Generate opaque refresh token (32 random bytes → 64 hex chars)
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const familyId = existingFamilyId ?? crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash,
        expiresAt,
        isRevoked: false,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  /** SHA-256 hash of a raw token — what we store in DB */
  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
