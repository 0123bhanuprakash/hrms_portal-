import { SkipThrottle } from '@nestjs/throttler';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { HealthStatus, ReadinessStatus } from '@hrms/types';
import { Public } from '../modules/auth/decorators/public.decorator';
import { HealthService } from './health.service';

// ============================================================
// HealthController
//
// GET /health        — Liveness probe. Always 200 if app is running.
// GET /health/ready  — Readiness probe. Checks the DB, plus Redis and
//                      Elasticsearch when configured ('disabled' otherwise).
// ============================================================

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly health: HealthService) {}

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
    summary: 'Readiness probe — checks the database plus Redis / Elasticsearch when configured',
  })
  @ApiResponse({ status: 200, description: 'All services ready' })
  @ApiResponse({ status: 503, description: 'One or more services unavailable' })
  async readiness(): Promise<ReadinessStatus> {
    const { status, services } = await this.health.check();

    if (status !== 'ok') {
      throw new ServiceUnavailableException({ status, services });
    }

    return { status, services };
  }
}
