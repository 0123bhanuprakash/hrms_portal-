// ============================================================
// Typed configuration factory
// Use ConfigService.get<AppConfig>() for type-safe access
// ============================================================

/** SMTP settings; EMAIL_PROVIDER=gmail fills in Gmail's host/port. */
function smtpConfig() {
  const gmail = process.env['EMAIL_PROVIDER'] === 'gmail';
  const port = parseInt(process.env['SMTP_PORT'] || (gmail ? '587' : '1025'), 10);
  return {
    host: process.env['SMTP_HOST'] || (gmail ? 'smtp.gmail.com' : 'localhost'),
    port,
    // Implicit TLS on 465; everything else upgrades with STARTTLS
    secure: process.env['SMTP_SECURE'] ? process.env['SMTP_SECURE'] === 'true' : port === 465,
    user: process.env['SMTP_USER'] || '',
    password: process.env['SMTP_PASSWORD'] || '',
    from: process.env['SMTP_FROM'] || 'HRMS Portal <noreply@hrms.local>',
  };
}

const configuration = () => ({
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['API_PORT'] || '4000', 10),
  apiUrl: process.env['API_URL'] || 'http://localhost:4000',
  webUrl: process.env['WEB_URL'] || 'http://localhost:3000',
  corsOrigins: (process.env['CORS_ORIGINS'] || 'http://localhost:3000').split(',').map((o) => o.trim()),

  database: { url: process.env['DATABASE_URL'] || '' },

  // Optional — when unset, the queue is disabled and emails are sent inline
  redis: { url: process.env['REDIS_URL'] || '' },

  // Optional — used from Phase 2+ (search)
  elasticsearch: { url: process.env['ELASTICSEARCH_URL'] || '' },

  jwt: {
    secret: process.env['JWT_SECRET'] || '',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || '',
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] || '15m',
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY'] || '7d',
  },

  email: {
    provider: (process.env['EMAIL_PROVIDER'] || 'console') as 'console' | 'smtp' | 'gmail' | 'mailpit' | 'resend',
    outputDir: '.mail',
    smtp: smtpConfig(),
    resend: {
      apiKey: process.env['RESEND_API_KEY'] || '',
      from: process.env['RESEND_FROM'] || '',
    },
  },

  storage: {
    driver: (process.env['STORAGE_DRIVER'] || 'local') as 'local' | 's3',
    uploadsDir: process.env['UPLOADS_DIR'] || 'uploads',
    privateDir: process.env['PRIVATE_FILES_DIR'] || 'private-files',
    minio: {
      endpoint: process.env['MINIO_ENDPOINT'] || 'localhost',
      port: parseInt(process.env['MINIO_PORT'] || '9000', 10),
      useSsl: process.env['MINIO_USE_SSL'] === 'true',
      accessKey: process.env['MINIO_ACCESS_KEY'] || '',
      secretKey: process.env['MINIO_SECRET_KEY'] || '',
      bucket: process.env['MINIO_BUCKET_NAME'] || 'hrms-dev',
    },
  },

  seed: {
    superAdminEmail: process.env['SUPER_ADMIN_EMAIL'] || '',
    superAdminPassword: process.env['SUPER_ADMIN_PASSWORD'] || '',
    superAdminFirstName: process.env['SUPER_ADMIN_FIRST_NAME'] || 'Super',
    superAdminLastName: process.env['SUPER_ADMIN_LAST_NAME'] || 'Admin',
  },
});

export type AppConfig = ReturnType<typeof configuration>;

// Helper types for nested config access
export type DatabaseConfig = AppConfig['database'];
export type JwtConfig = AppConfig['jwt'];
export type EmailConfig = AppConfig['email'];
export type StorageConfig = AppConfig['storage'];

export { configuration };
