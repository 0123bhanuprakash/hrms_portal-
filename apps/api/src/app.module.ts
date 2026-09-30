import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/configuration';
import { validate } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

// ============================================================
// AppModule — Root NestJS module
//
// Feature modules added per chunk:
//   Chunk 5:  PrismaModule
//   Chunk 6:  AuthModule + JwtAuthGuard (global)
//   Chunk 7:  EmailModule
//   Chunk 8:  RbacModule (PermissionGuard wired globally)
//   Chunk 9:  CompaniesModule, AuditModule
//   Chunk 10: BrandingModule, PreferencesModule
//   Chunk 11: QueueModule (BullMQ)
// ============================================================

@Module({
  imports: [
    // ── Global configuration (env vars, typed config) ─────
    ConfigModule.forRoot({
      // Load from root .env, then app-local .env (root takes priority)
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate,
    }),

    // ── Rate limiting (in-memory; Redis-backed added in Chunk 8) ─
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,  // 1 minute window
          limit: 100,   // 100 requests per minute per IP
        },
        {
          name: 'auth',
          ttl: 60_000,
          limit: 10,    // Stricter: 10 requests/min — applied to auth endpoints
        },
      ],
    }),

    // ── Infrastructure ────────────────────────────────────
    HealthModule,
    PrismaModule,

    // ── Feature modules ───────────────────────────────────
    AuthModule,           // Chunk 6
    EmailModule,          // Chunk 7
    // CompaniesModule    — Chunk 9
    // BrandingModule     — Chunk 10
    // PreferencesModule  — Chunk 10
    // QueueModule        — Chunk 11
  ],

  providers: [
    // ── Global JWT guard — all routes protected by default ──
    // Use @Public() on routes that should be publicly accessible.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
