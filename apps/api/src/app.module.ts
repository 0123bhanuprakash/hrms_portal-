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
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DesignationsModule } from './modules/designations/designations.module';
import { LocationsModule } from './modules/locations/locations.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { SuperAdminGuard } from './common/guards/super-admin.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

// ============================================================
// AppModule — Root NestJS module
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
    CompaniesModule,      // Chunk 9
    UsersModule,          // Chunk 9
    AdminModule,          // Chunk 9 Super Admin
    DepartmentsModule,   // Chunk 10
    DesignationsModule,  // Chunk 10
    LocationsModule,     // Chunk 10
    EmployeesModule,      // Chunk 10
  ],

  providers: [
    // ── Global JWT guard — all routes protected by default ──
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
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
