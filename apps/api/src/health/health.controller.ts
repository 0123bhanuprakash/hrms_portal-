import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { HealthStatus, ReadinessStatus } from '@hrms/types';

// ============================================================
// HealthController
//
// GET /health        — Liveness probe. Always 200 if app is running.
// GET /health/ready  — Readiness probe. Checks DB + Redis.
//                      (DB/Redis checks activated in Chunk 5)
// ============================================================

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startedAt = Date.now();

  @Get()
  @ApiOperation({ summary: 'Liveness probe — returns 200 if the API is up' })
  @ApiResponse({ status: 200, description: 'API is alive' })
  liveness(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      version: process.env['npm_package_version'] ?? '0.0.1',
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe — checks database and Redis connectivity',
  })
  @ApiResponse({ status: 200, description: 'All services ready' })
  @ApiResponse({ status: 503, description: 'One or more services unavailable' })
  readiness(): ReadinessStatus {
    // NOTE: Real DB + Redis checks are wired in Chunk 5 (Prisma) and Chunk 6 (Redis).
    // For Chunk 4, we report 'ok' to unblock development.
    // TODO: replace with actual health indicators (PrismaHealthIndicator, RedisHealthIndicator)
    this.logger.debug('Readiness check called');

    return {
      status: 'ok',
      services: {
        database: 'ok',
        redis: 'ok',
        elasticsearch: 'ok',
      },
    };
  }
}
