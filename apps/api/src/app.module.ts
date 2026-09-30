import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/configuration';
import { validate } from './config/env.validation';
import { HealthModule } from './health/health.module';

// ============================================================
// AppModule — Root NestJS module
//
// Feature modules are added here as they are built in later chunks:
//   Chunk 5: PrismaModule
//   Chunk 6: AuthModule
//   Chunk 7: EmailModule
//   Chunk 8: RbacModule (guards wired globally via APP_GUARD)
//   Chunk 9: CompaniesModule, AuditModule
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

    // ── Rate limiting (in-memory for Chunk 4, Redis-backed in Chunk 8) ─
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

    // ── Feature modules (added progressively per chunk) ───
    // PrismaModule       — Chunk 5
    // AuthModule         — Chunk 6
    // EmailModule        — Chunk 7
    // CompaniesModule    — Chunk 9
    // BrandingModule     — Chunk 10
    // PreferencesModule  — Chunk 10
    // QueueModule        — Chunk 11
  ],
})
export class AppModule {}
