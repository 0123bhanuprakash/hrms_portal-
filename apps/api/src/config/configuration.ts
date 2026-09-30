// ============================================================
// Typed configuration factory
// Use ConfigService.get<AppConfig>() for type-safe access
// ============================================================

export default () => ({
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['API_PORT'] || '4000', 10),
  apiUrl: process.env['API_URL'] || 'http://localhost:4000',
  webUrl: process.env['WEB_URL'] || 'http://localhost:3000',
  corsOrigins: (process.env['CORS_ORIGINS'] || 'http://localhost:3000').split(',').map((o) => o.trim()),

  database: {
    url: process.env['DATABASE_URL'] || '',
  },

  redis: {
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  },

  elasticsearch: {
    url: process.env['ELASTICSEARCH_URL'] || 'http://localhost:9200',
  },

  jwt: {
    secret: process.env['JWT_SECRET'] || '',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || '',
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] || '15m',
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY'] || '7d',
  },

  email: {
    provider: (process.env['EMAIL_PROVIDER'] || 'mailpit') as 'mailpit' | 'resend',
    smtp: {
      host: process.env['SMTP_HOST'] || 'localhost',
      port: parseInt(process.env['SMTP_PORT'] || '1025', 10),
      from: process.env['SMTP_FROM'] || 'HRMS Portal <noreply@hrms.local>',
    },
    resend: {
      apiKey: process.env['RESEND_API_KEY'] || '',
      from: process.env['RESEND_FROM'] || '',
    },
  },

  minio: {
    endpoint: process.env['MINIO_ENDPOINT'] || 'localhost',
    port: parseInt(process.env['MINIO_PORT'] || '9000', 10),
    useSsl: process.env['MINIO_USE_SSL'] === 'true',
    accessKey: process.env['MINIO_ACCESS_KEY'] || '',
    secretKey: process.env['MINIO_SECRET_KEY'] || '',
    bucketName: process.env['MINIO_BUCKET_NAME'] || 'hrms-dev',
  },

  seed: {
    superAdminEmail: process.env['SUPER_ADMIN_EMAIL'] || '',
    superAdminPassword: process.env['SUPER_ADMIN_PASSWORD'] || '',
    superAdminFirstName: process.env['SUPER_ADMIN_FIRST_NAME'] || 'Super',
    superAdminLastName: process.env['SUPER_ADMIN_LAST_NAME'] || 'Admin',
  },
});

export type AppConfig = ReturnType<typeof configuration>;

// Helper type for nested config access
export type DatabaseConfig = AppConfig['database'];
export type JwtConfig = AppConfig['jwt'];
export type EmailConfig = AppConfig['email'];
export type MinioConfig = AppConfig['minio'];

const configuration = () => ({
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['API_PORT'] || '4000', 10),
  apiUrl: process.env['API_URL'] || 'http://localhost:4000',
  webUrl: process.env['WEB_URL'] || 'http://localhost:3000',
  corsOrigins: (process.env['CORS_ORIGINS'] || 'http://localhost:3000').split(',').map((o) => o.trim()),
  database: { url: process.env['DATABASE_URL'] || '' },
  redis: {
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  },
  elasticsearch: { url: process.env['ELASTICSEARCH_URL'] || 'http://localhost:9200' },
  jwt: {
    secret: process.env['JWT_SECRET'] || '',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || '',
    accessExpiry: process.env['JWT_ACCESS_EXPIRY'] || '15m',
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY'] || '7d',
  },
  email: {
    provider: (process.env['EMAIL_PROVIDER'] || 'mailpit') as 'mailpit' | 'resend',
    smtp: {
      host: process.env['SMTP_HOST'] || 'localhost',
      port: parseInt(process.env['SMTP_PORT'] || '1025', 10),
      from: process.env['SMTP_FROM'] || 'HRMS Portal <noreply@hrms.local>',
    },
    resend: {
      apiKey: process.env['RESEND_API_KEY'] || '',
      from: process.env['RESEND_FROM'] || '',
    },
  },
  minio: {
    endpoint: process.env['MINIO_ENDPOINT'] || 'localhost',
    port: parseInt(process.env['MINIO_PORT'] || '9000', 10),
    useSsl: process.env['MINIO_USE_SSL'] === 'true',
    accessKey: process.env['MINIO_ACCESS_KEY'] || '',
    secretKey: process.env['MINIO_SECRET_KEY'] || '',
    bucketName: process.env['MINIO_BUCKET_NAME'] || 'hrms-dev',
  },
  seed: {
    superAdminEmail: process.env['SUPER_ADMIN_EMAIL'] || '',
    superAdminPassword: process.env['SUPER_ADMIN_PASSWORD'] || '',
    superAdminFirstName: process.env['SUPER_ADMIN_FIRST_NAME'] || 'Super',
    superAdminLastName: process.env['SUPER_ADMIN_LAST_NAME'] || 'Admin',
  },
});

export { configuration };
