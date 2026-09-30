import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('✅ Database connected');

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
