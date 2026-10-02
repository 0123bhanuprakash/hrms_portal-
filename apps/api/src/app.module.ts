import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PasswordChangeGuard } from './common';

import { configuration } from './config/configuration';
import { validate } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { StorageModule } from './modules/storage/storage.module';
import { QueueModule } from './modules/queue/queue.module';
import { AccessModule } from './modules/access/access.module';
import { UserManagementModule } from './modules/user-management/user-management.module';
import { PlansModule } from './modules/plans/plans.module';
import { OrgModule } from './modules/org/org.module';
import { DelegationsModule } from './modules/delegations/delegations.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DesignationsModule } from './modules/designations/designations.module';
import { LocationsModule } from './modules/locations/locations.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { EmployeeProfileModule } from './modules/employee-profile/employee-profile.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ThemesModule } from './modules/themes/themes.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { SuperAdminGuard } from './common/guards/super-admin.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

import { AppController } from './app.controller';

// ============================================================
// AppModule — Root NestJS module
// ============================================================

@Module({
  controllers: [AppController],
  imports: [
    // ── Global configuration (env vars, typed config) ─────
    ConfigModule.forRoot({
      // Single source of truth: apps/api/.env (same file the Prisma CLI reads)
      envFilePath: ['.env'],
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate,
    }),

    // ── Rate limiting (per IP, in-memory; Redis-backed later) ─
    // Generous default for the SPA; credential endpoints tighten it
    // with @Throttle (see auth.controller.ts).
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
    }),

    // ── Infrastructure ────────────────────────────────────
    HealthModule,
    PrismaModule,
    StorageModule.register(), // Local disk or MinIO/S3 (STORAGE_DRIVER)
    QueueModule.register(),   // BullMQ — only when REDIS_URL is set

    // ── Feature modules ───────────────────────────────────
    AccessModule,         // Feature toggles · RBAC · org hierarchy
    AuthModule,           // Chunk 6
    EmailModule.register(), // Chunk 7
    CompaniesModule,      // Chunk 9
    UsersModule,          // Chunk 9
    AdminModule,          // Chunk 9 Super Admin
    DepartmentsModule,   // Chunk 10
    DesignationsModule,  // Chunk 10
    LocationsModule,     // Chunk 10
    EmployeesModule,     // Chunk 10
    EmployeeProfileModule, // Profile, private data, documents, directory
    AttendanceModule,      // Phase 3: attendance
    LeaveModule,           // Phase 4: leave
    NotificationsModule,   // In-app inbox + notification emails
    ThemesModule,         // Theme Studio
    UserManagementModule, // Company Admin: users, roles & permissions
    PlansModule,          // Super Admin: plans & per-company features
    OrgModule,            // Org levels, org chart, reporting lines
    DelegationsModule,    // Approval delegation
  ],

  providers: [
    // ── Rate limiting first, so floods are rejected before any DB work ─
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // ── Global JWT guard — all routes protected by default ──
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // ── Temporary password → only password-change routes until changed ─
    {
      provide: APP_GUARD,
      useClass: PasswordChangeGuard,
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
