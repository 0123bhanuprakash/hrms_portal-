import { z } from 'zod';

// ============================================================
// Environment variable schema + validation
// Called by ConfigModule at startup — app WILL NOT START
// if any required variable is missing or invalid.
// ============================================================

const envSchema = z.object({
  // ── App ───────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // ── Database ──────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),

  // ── Redis (optional) ──────────────────────────────────────
  // Unset → emails are sent inline and Bull Board is disabled.
  REDIS_URL: z.string().url().optional(),

  // ── Elasticsearch (optional, used from Phase 2+) ──────────
  ELASTICSEARCH_URL: z.string().url().optional(),

  // ── JWT ───────────────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // ── Email ─────────────────────────────────────────────────
  // console → print to terminal + save .html to apps/api/.mail (no mail server)
  // smtp    → any SMTP server (Mailpit, Gmail, ...). 'mailpit' kept as an alias.
  // resend  → Resend API (production)
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'mailpit', 'resend']).default('console'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_FROM: z.string().default('HRMS Portal <noreply@hrms.local>'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),

  // ── File storage ──────────────────────────────────────────
  // local → files saved under UPLOADS_DIR and served at /uploads
  // s3    → MinIO / AWS S3 / Supabase Storage (MINIO_* vars required)
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOADS_DIR: z.string().default('uploads'),
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().int().default(9000),
  MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET_NAME: z.string().default('hrms-dev'),

  // ── Seed / Super Admin ────────────────────────────────────
  SUPER_ADMIN_EMAIL: z.string().email('SUPER_ADMIN_EMAIL must be a valid email'),
  SUPER_ADMIN_PASSWORD: z
    .string()
    .min(8, 'SUPER_ADMIN_PASSWORD must be at least 8 characters'),
  SUPER_ADMIN_FIRST_NAME: z.string().default('Super'),
  SUPER_ADMIN_LAST_NAME: z.string().default('Admin'),
}).superRefine((env, ctx) => {
  if (env.STORAGE_DRIVER === 's3' && (!env.MINIO_ACCESS_KEY || !env.MINIO_SECRET_KEY)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MINIO_ACCESS_KEY'],
      message: 'MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required when STORAGE_DRIVER=s3',
    });
  }
  if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESEND_API_KEY'],
      message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
    });
  }
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Called by NestJS ConfigModule at startup.
 * Throws on any missing or invalid environment variable.
 */
export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `  ✗ ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Environment validation failed. Fix the following:\n${errors}\n`,
    );
  }

  return result.data;
}
