import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { ReadinessStatus } from '@hrms/types';
import { PrismaService } from '../modules/prisma/prisma.service';

type ServiceState = ReadinessStatus['services']['database'];

export interface HealthReport extends ReadinessStatus {
  checkedAt: string;
  /** Round-trip time per checked service, in ms (omitted when disabled) */
  latencyMs: Partial<Record<keyof ReadinessStatus['services'], number>>;
}

// ============================================================
// HealthService — dependency checks shared by /health/ready and the
// Super Admin system page. Optional services report 'disabled' when
// they are not configured.
// ============================================================

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis, elasticsearch] = await Promise.all([
      this.timed(async () => ((await this.prisma.isHealthy()) ? 'ok' : 'error')),
      this.timed(() => this.checkRedis()),
      this.timed(() => this.checkElasticsearch()),
    ]);

    const services = { database: database.state, redis: redis.state, elasticsearch: elasticsearch.state };
    const latencyMs: HealthReport['latencyMs'] = {};
    for (const [name, result] of Object.entries({ database, redis, elasticsearch })) {
      if (result.state !== 'disabled') latencyMs[name as keyof typeof services] = result.ms;
    }

    return {
      status: Object.values(services).every((s) => s !== 'error') ? 'ok' : 'error',
      services,
      latencyMs,
      checkedAt: new Date().toISOString(),
    };
  }

  private async timed(fn: () => Promise<ServiceState>): Promise<{ state: ServiceState; ms: number }> {
    const start = performance.now();
    const state = await fn();
    return { state, ms: Math.round(performance.now() - start) };
  }

  /** 'disabled' when REDIS_URL is unset (queue off), otherwise a PING. */
  private async checkRedis(): Promise<ServiceState> {
    const url = this.config.get<string>('redis.url');
    if (!url) return 'disabled';

    const client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
    });
    try {
      await client.connect();
      return (await client.ping()) === 'PONG' ? 'ok' : 'error';
    } catch (err) {
      this.logger.warn(`Redis health check failed: ${(err as Error).message}`);
      return 'error';
    } finally {
      client.disconnect();
    }
  }

  /** 'disabled' when ELASTICSEARCH_URL is unset, otherwise GET /_cluster/health. */
  private async checkElasticsearch(): Promise<ServiceState> {
    const url = this.config.get<string>('elasticsearch.url');
    if (!url) return 'disabled';

    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/_cluster/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok ? 'ok' : 'error';
    } catch (err) {
      this.logger.warn(`Elasticsearch health check failed: ${(err as Error).message}`);
      return 'error';
    }
  }
}
