import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { countQuery, dbTraceEnabled } from '../../common/db-trace';
import { ACCESS_MODELS, accessDataChanged } from '../../common/access-cache-signal';

// ============================================================
// PrismaService — Global database client
//
// Features:
//   - Singleton PrismaClient (one connection pool per app)
//   - Graceful connect/disconnect lifecycle hooks
//   - set_tenant_context() helper for RLS middleware (Chunk 8)
//   - isHealthy() for health check endpoint
// ============================================================

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        // Query events only where something listens (dev slow-query log)
        ...(process.env['NODE_ENV'] === 'development' ? [{ emit: 'event' as const, level: 'query' as const }] : []),
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('✅ Database connected');

    // Writes to the tables access is built from drop the auth caches
    const READS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
    this.$use(async (params, next) => {
      const result = await next(params);
      if (params.model && ACCESS_MODELS.has(params.model) && !READS.has(params.action)) accessDataChanged();
      return result;
    });

    // DB_TRACE=true: count / time queries per request (see common/db-trace.ts)
    if (dbTraceEnabled()) this.$use(countQuery);

    // In development, log slow queries (>500ms)
    if (process.env['NODE_ENV'] === 'development') {
      // @ts-expect-error — Prisma event type
      this.$on('query', (event: { duration: number; query: string }) => {
        if (event.duration > 500) {
          this.logger.warn(`🐢 Slow query (${event.duration}ms): ${event.query}`);
        }
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Sets PostgreSQL session variables for Row-Level Security.
   * Called by TenantContextMiddleware (Chunk 8) before each request.
   *
   * @param companyId - The current tenant's UUID (null for Super Admin)
   * @param isSuperAdmin - Whether the current user is a Super Admin
   */
  async setTenantContext(
    companyId: string | null,
    isSuperAdmin: boolean,
  ): Promise<void> {
    await this.$executeRaw`
      SELECT set_tenant_context(${companyId ?? ''}::text, ${isSuperAdmin}::boolean)
    `;
  }

  /**
   * Checks database connectivity.
   * Used by the health check endpoint.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}
