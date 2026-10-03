import type { ConnectionOptions } from 'bullmq';

// ============================================================
// Queue feature flag
//
// The queue (BullMQ + Bull Board) is only enabled when REDIS_URL
// is set. Without Redis, emails are sent inline by
// EmailProducerService so local development needs no Redis.
//
// Read from process.env at module-definition time: ConfigModule.forRoot()
// (first entry in AppModule.imports) has already loaded .env by then.
// ============================================================

export function isQueueEnabled(): boolean {
  return Boolean(process.env['REDIS_URL']);
}

/** Converts redis://[:password@]host:port[/db] into BullMQ connection options. */
export function redisConnectionFromUrl(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}
