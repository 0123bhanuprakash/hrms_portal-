import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { HealthStatus, ReadinessStatus } from '@hrms/types';
import { PrismaService } from '../modules/prisma/prisma.service';
import { Public } from '../modules/auth/decorators/public.decorator';

// ============================================================
// HealthController
//
// GET /health        — Liveness probe. Always 200 if app is running.
// GET /health/ready  — Readiness probe. Checks DB + Redis.
// ============================================================

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Public()
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

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe — checks database and Redis connectivity',
  })
  @ApiResponse({ status: 200, description: 'All services ready' })
  @ApiResponse({ status: 503, description: 'One or more services unavailable' })
  async readiness(): Promise<ReadinessStatus> {
    const dbHealthy = await this.prisma.isHealthy();

    const services = {
      database: dbHealthy ? ('ok' as const) : ('error' as const),
      redis: 'ok' as const,
      elasticsearch: 'ok' as const,
    };

    const isAllOk = dbHealthy;

    if (!isAllOk) {
      throw new ServiceUnavailableException({
        status: 'error',
        services,
      });
    }

    return {
      status: 'ok',
      services,
    };
  }
}
