import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@hrms/types';
import { PrismaService } from '../../prisma/prisma.service';

// ============================================================
// JwtStrategy — Passport strategy for Bearer token validation
//
// Validates every request hitting a @UseGuards(JwtAuthGuard) route:
//   1. Extracts Bearer token from Authorization header
//   2. Validates signature + expiry (passport-jwt does this)
//   3. Calls validate() with decoded payload
//   4. Attaches returned value to req.user
// ============================================================

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? 'fallback-secret',
    });
  }

  /**
   * Called after passport-jwt verifies the token signature + expiry.
   * Returns the value that will be attached to req.user.
   *
   * We do a lightweight DB check to ensure the user still exists
   * and is still active (catches mid-session deactivation).
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    // Return payload as-is — permissions were embedded at login time
    // (Cache invalidation in Chunk 8 will handle stale permissions)
    return payload;
  }
}
