import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import type { JwtPayload } from '@hrms/types';
import { Audit, SuperAdminOnly } from '../../common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { MaintenanceService } from './maintenance.service';
import { SystemService } from './system.service';

// ============================================================
// Super Admin → System
//
// GET  /admin/system/health-history     90 days of uptime, incidents, latency
// GET  /admin/system/traffic            last hour: requests, p95, slowest, errors
// GET  /admin/system/timeline           incidents, starts, updates, maintenance
// POST /admin/system/check              run every check now (saved to history)
// GET  /admin/system/database           size, connections, biggest tables
// GET  /admin/system/storage            files, disk, per company
// GET  /admin/system/queue              background job counts
// GET  /admin/system/emails             email log (+ today's numbers)
// POST /admin/system/emails/:id/retry   re-send a failed email
// GET  /admin/system/readiness          "ready for real users?" checklist
// GET  /admin/system/sign-ins           last 24 h + locked accounts
// POST /admin/system/users/:id/unlock   unlock an account
// GET  /admin/system/maintenance        maintenance mode settings
// PUT  /admin/system/maintenance
// POST /admin/system/caches/clear       drop access caches
// GET  /admin/system/diagnostics        support bundle (no secrets)
// GET  /platform/status                 public: paused / upcoming maintenance
// ============================================================

const uuid = new ParseUUIDPipe({ version: '4' });

export class EmailLogQueryDto {
  @ApiPropertyOptional({ enum: ['SENT', 'FAILED'] })
  @IsOptional()
  @IsIn(['SENT', 'FAILED'])
  status?: 'SENT' | 'FAILED';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class MaintenanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  message?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  announce?: boolean;
}

@ApiTags('Admin — System')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('admin/system')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('health-history')
  @ApiOperation({ summary: '90 days of daily uptime, incidents and recent latency per service' })
  healthHistory() {
    return this.system.healthHistory();
  }

  @Get('traffic')
  @ApiOperation({ summary: 'Last hour on this API server: requests, response times, slowest endpoints, errors' })
  traffic() {
    return this.system.traffic();
  }

  @Get('timeline')
  timeline() {
    return this.system.timeline();
  }

  @Post('check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run every health check now (email included) and save it' })
  check() {
    return this.system.checkNow();
  }

  @Get('database')
  database() {
    return this.system.database();
  }

  @Get('storage')
  storage() {
    return this.system.storage();
  }

  @Get('queue')
  queue() {
    return this.system.queue();
  }

  @Get('emails')
  @ApiOperation({ summary: 'Email log — subject, recipient and result only' })
  emails(@Query() query: EmailLogQueryDto) {
    return this.system.emails(query);
  }

  @Post('emails/:id/retry')
  @HttpCode(200)
  @Audit('system:email:retry', 'email')
  retryEmail(@Param('id', uuid) id: string) {
    return this.system.retryEmail(id);
  }

  @Get('readiness')
  readiness() {
    return this.system.readiness();
  }

  @Get('sign-ins')
  signIns() {
    return this.system.signIns();
  }

  @Post('users/:id/unlock')
  @HttpCode(200)
  @Audit('user:unlock', 'user')
  unlock(@Param('id', uuid) id: string) {
    return this.system.unlock(id);
  }

  @Get('maintenance')
  maintenance() {
    return this.system.getMaintenance();
  }

  @Put('maintenance')
  @Audit('system:maintenance:update', 'platform')
  setMaintenance(@Body() dto: MaintenanceDto, @CurrentUser() user: JwtPayload) {
    return this.system.setMaintenance(dto, user.sub);
  }

  @Post('caches/clear')
  @HttpCode(200)
  @Audit('system:caches:clear', 'platform')
  clearCaches() {
    return this.system.clearCaches();
  }

  @Get('diagnostics')
  diagnostics() {
    return this.system.diagnostics();
  }
}

/** What the web app shows everyone: paused right now, or a notice ahead of planned maintenance. */
@ApiTags('Platform')
@Controller('platform')
export class PlatformStatusController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Public()
  @Get('status')
  status() {
    return this.maintenance.publicStatus();
  }
}
