import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/configuration';
import { validate } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { SuperAdminGuard } from './common/guards/super-admin.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

// ============================================================
// AppModule — Root NestJS module
//
// Feature modules added per chunk:
//   Chunk 5:  PrismaModule
//   Chunk 6:  AuthModule + JwtAuthGuard (global)
//   Chunk 7:  EmailModule
//   Chunk 8:  TenantContextMiddleware + PermissionGuard + SuperAdminGuard + AuditInterceptor
//   Chunk 9:  CompaniesModule, AuditModule
//   Chunk 10: BrandingModule, PreferencesModule
//   Chunk 11: QueueModule (BullMQ)
// ============================================================

@Module({
  imports: [
    // ── Global configuration (env vars, typed config) ─────
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate,
    }),

    // ── Rate limiting (in-memory; Redis-backed added later) ─
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 100,
        },
        {
          name: 'auth',
          ttl: 60_000,
          limit: 10,
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
    // Routes decorated with @Public() bypass this guard.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // ── Global Permission guard — enforces @RequirePermission() ─
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },

    // ── Global Super Admin guard — enforces @SuperAdminOnly() ─
    {
      provide: APP_GUARD,
      useClass: SuperAdminGuard,
    },

    // ── Global Audit interceptor — writes @Audit() entries ─
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  // ── Apply TenantContextMiddleware to all routes ──────────
  // Decodes JWT (without verifying) and attaches tenantContext
  // to every request before guards run.
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
