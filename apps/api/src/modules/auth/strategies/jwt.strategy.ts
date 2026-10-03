import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@hrms/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../../access/access.service';
import { ACCESS_USER_SELECT } from '../../access/access.types';
import type { AuthUser } from '../../../common/types/request.types';

// ============================================================
// JwtStrategy — Passport strategy for Bearer token validation
//
// Validates every request hitting a @UseGuards(JwtAuthGuard) route:
//   1. Extracts the Bearer token from the Authorization header only
//      (never from URLs — they leak into logs and Referer headers)
//   2. Validates signature + expiry (passport-jwt does this)
//   3. Calls validate() with decoded payload
//   4. Attaches returned value to req.user
// ============================================================

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
  ) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Called after passport-jwt verifies the token signature + expiry.
   * Returns the value that will be attached to req.user.
   */
  async validate(payload: JwtPayload & { aud?: string }): Promise<AuthUser> {
    // Tokens issued for a specific audience (e.g. Bull Board sessions)
    // are not API access tokens.
    if (payload.aud) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        ...ACCESS_USER_SELECT,
        status: true,
        mustChangePassword: true,
        company: { select: { status: true, featuresVersion: true, hierarchyVersion: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    // Company deactivated/suspended → existing access tokens stop working immediately
    if (user.company && user.company.status !== 'ACTIVE') {
      throw new UnauthorizedException('Company account is not active');
    }

    // Fresh from the DB on every request: temp-password flag (PasswordChangeGuard)
    // and access context (PermissionGuard, services) — role/feature/hierarchy
    // changes apply on the next request, not at token refresh.
    const access = await this.accessService.resolve(user);
    return { ...payload, must_change_password: user.mustChangePassword, access };
  }
}
