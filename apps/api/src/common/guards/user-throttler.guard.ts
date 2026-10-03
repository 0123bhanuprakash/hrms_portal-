import { createSecretKey } from 'crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limits per signed-in user, per IP for everyone else.
 *
 * Per-IP limits alone throttle a whole office behind one NAT address (each
 * page fires ~12 calls). The user is taken from a *verified* access token,
 * so a forged token can't be used to spread requests over many buckets.
 * Sign-in endpoints are anonymous, so their tight @Throttle limits stay per IP.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  private jwt: JwtService | null = null;

  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const header: unknown = req['headers']?.['authorization'];
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      const secret = process.env['JWT_SECRET'];
      if (secret) {
        this.jwt ??= new JwtService({ secret: createSecretKey(Buffer.from(secret)) as unknown as string });
        try {
          const payload = this.jwt.verify<{ sub?: string }>(header.slice(7));
          if (payload.sub) return `user:${payload.sub}`;
        } catch {
          /* invalid / expired → fall back to the IP */
        }
      }
    }
    return `ip:${req['ips']?.length ? req['ips'][0] : req['ip']}`;
  }
}
