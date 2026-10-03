import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Use NestJS built-in logger (can swap for Winston/Pino in Phase 10)
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 4000);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const corsOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  // ── Security middleware ─────────────────────────────────────
  app.use(
    helmet({
      // Allow Swagger UI's inline styles and scripts in development
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );
  app.use(compression());

  // ── Local file storage (STORAGE_DRIVER=local) ──────────────
  // Uploaded branding assets are served from /uploads. Headers make
  // them loadable cross-origin by the web app, while preventing
  // uploaded SVGs from running scripts if opened directly.
  if (config.get<string>('storage.driver') === 'local') {
    const uploadsDir = path.resolve(config.get<string>('storage.uploadsDir') ?? 'uploads');
    app.useStaticAssets(uploadsDir, {
      prefix: '/uploads/',
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      },
    });
  }

  // ── CORS ───────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Tenant-ID',
    ],
    exposedHeaders: ['X-Request-ID', 'X-Access-Version', 'Retry-After'],
  });

  // ── Global API prefix & versioning ─────────────────────────
  // Health endpoints excluded — used by container orchestrators
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health', '/health/ready'],
  });

  // ── Global exception filter ─────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Global interceptors (ORDER MATTERS) ────────────────────
  // 1. RequestId  — must be first so downstream interceptors can read it
  // 2. Logging    — logs after RequestId so it can include the ID
  // 3. Transform  — wraps the final response in { data, meta }
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new LoggingInterceptor(),
    new ResponseTransformInterceptor(),
  );

  // ── Global validation pipe ──────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties silently
      forbidNonWhitelisted: true, // Reject requests with unknown properties
      transform: true,           // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // string '42' → number 42 where needed
      },
    }),
  );

  // ── Swagger UI (development + staging only) ─────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HRMS Portal API')
      .setDescription(
        `
**Multi-tenant HRMS SaaS Backend**

This API serves the HRMS Portal frontend. All tenant-scoped endpoints
require a valid JWT Bearer token containing the \`company_id\` claim.

### Authentication
- \`POST /api/v1/auth/login\` → returns \`access_token\` + \`refresh_token\`
- Include \`Authorization: Bearer <access_token>\` on all protected requests
- Refresh tokens via \`POST /api/v1/auth/refresh\`

### Multi-tenancy
Every authenticated request is scoped to a single company.
Attempting to access another company's data returns \`404 Not Found\`
(not 403) to prevent existence leakage.
      `.trim(),
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your access token',
        },
        'access-token',
      )
      .addTag('Health', 'Liveness and readiness probes')
      .addTag('Auth', 'Login, logout, token refresh, password reset')
      .addTag('Companies', 'Super Admin — company management')
      .addTag('Users', 'User management and profile')
      .addTag('Roles', 'Role and permission management')
      .addTag('Branding', 'Company branding configuration')
      .addTag('Preferences', 'User preferences (theme, timezone)')
      .addTag('Employees', 'Employee lifecycle management')
      .addTag('Attendance', 'Attendance tracking and corrections')
      .addTag('Leave', 'Leave requests and approvals')
      .addTag('Payroll', 'Payroll runs and payslips')
      .addTag('Import', 'Bulk data import pipeline')
      .addTag('Audit', 'Audit log queries')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
      },
      customSiteTitle: 'HRMS Portal API Docs',
    });

    logger.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
  }

  // ── Start server ────────────────────────────────────────────
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 HRMS API running → http://localhost:${port}/api/v1`);
  logger.log(`🏥 Health check    → http://localhost:${port}/health`);
  logger.log(`⚙️  Environment     → ${nodeEnv}`);
}

bootstrap().catch((err: Error) => {
  console.error('❌ Failed to start application:', err.message);
  process.exit(1);
});
