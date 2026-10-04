import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, StreamableFile } from '@nestjs/common';
import type { Request } from 'express';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { AttendanceService } from './attendance.service';
import { AttendancePolicyService } from './policy.service';
import { RegularisationService } from './regularisation.service';
import { HolidaysService } from './holidays.service';
import {
  CalendarQueryDto,
  CreateRegularisationDto,
  ExportQueryDto,
  HolidayQueryDto,
  RegularisationQueryDto,
  ReviewRegularisationDto,
  SaveHolidayDto,
  TeamQueryDto,
  UpdatePolicyDto,
  UpsertRecordDto,
  CheckOutDto,
} from './dto';

const clientIp = (req: Request) => (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;

@RequireFeature('time.attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly policies: AttendancePolicyService,
    private readonly corrections: RegularisationService,
  ) {}

  // ─── Self-service ──────────────────────────────────────────

  @RequirePermission('attendance.mark')
  @Get('today')
  today(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.attendance.today(ctx.companyId!, access);
  }

  @RequirePermission('attendance.mark')
  @Audit('attendance:check-in', 'attendance_record')
  @Post('check-in')
  checkIn(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Req() req: Request) {
    return this.attendance.checkIn(ctx.companyId!, access, clientIp(req));
  }

  @RequirePermission('attendance.mark')
  @Audit('attendance:check-out', 'attendance_record')
  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  checkOut(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Req() req: Request, @Body() dto: CheckOutDto) {
    return this.attendance.checkOut(ctx.companyId!, access, clientIp(req), dto?.note);
  }

  // ─── Viewing ───────────────────────────────────────────────

  @RequirePermission('attendance.view')
  @Get('calendar')
  calendar(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: CalendarQueryDto) {
    return this.attendance.calendar(ctx.companyId!, access, query);
  }

  @RequirePermission('attendance.view')
  @Get('team')
  team(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: TeamQueryDto) {
    return this.attendance.team(ctx.companyId!, access, query);
  }

  @RequirePermission('attendance.export')
  @Audit('attendance:export', 'attendance_record')
  @Get('export')
  async export(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: ExportQueryDto) {
    const csv = await this.attendance.exportMonth(ctx.companyId!, access, query);
    return new StreamableFile(Buffer.from('﻿' + csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="attendance-${query.month}.csv"`,
    });
  }

  // ─── HR corrections ───────────────────────────────────────

  @RequirePermission('attendance.edit')
  @Audit('attendance:record:update', 'attendance_record')
  @Put('records')
  upsert(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: UpsertRecordDto) {
    return this.attendance.upsertRecord(ctx.companyId!, access, dto);
  }

  // ─── Policy ────────────────────────────────────────────────

  @RequirePermission('attendance.view')
  @Get('policy')
  policy(@TenantCtx() ctx: TenantContext) {
    return this.policies.get(ctx.companyId!);
  }

  @RequirePermission('attendance.policy')
  @Audit('attendance:policy:update', 'attendance_policy')
  @Put('policy')
  updatePolicy(@TenantCtx() ctx: TenantContext, @Body() dto: UpdatePolicyDto) {
    return this.policies.update(ctx.companyId!, dto);
  }

  // ─── Correction requests ──────────────────────────────────

  @RequirePermission('attendance.mark')
  @Audit('attendance:correction:request', 'attendance_regularisation')
  @Post('regularisations')
  requestCorrection(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: CreateRegularisationDto) {
    return this.corrections.create(ctx.companyId!, access, dto);
  }

  /** view=mine → my requests; view=review → requests I can decide (403 without attendance.approve). */
  @Get('regularisations')
  listCorrections(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: RegularisationQueryDto) {
    return this.corrections.list(ctx.companyId!, access, query);
  }

  @Get('regularisations/pending-count')
  async pendingCount(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return { count: await this.corrections.pendingCount(ctx.companyId!, access) };
  }

  // Who may decide is checked per request (project leads, line manager, delegates, HR)
  @Audit('attendance:correction:approve', 'attendance_regularisation')
  @Post('regularisations/:id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewRegularisationDto) {
    return this.corrections.approve(ctx.companyId!, access, id, dto);
  }

  @Audit('attendance:correction:reject', 'attendance_regularisation')
  @Post('regularisations/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewRegularisationDto) {
    return this.corrections.reject(ctx.companyId!, access, id, dto);
  }

  @Audit('attendance:correction:cancel', 'attendance_regularisation')
  @Post('regularisations/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.corrections.cancel(ctx.companyId!, access, id);
  }
}

@RequireFeature('time.attendance')
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @RequirePermission('attendance.view')
  @Get()
  list(@TenantCtx() ctx: TenantContext, @Query() query: HolidayQueryDto) {
    return this.holidays.list(ctx.companyId!, query.year);
  }

  @RequirePermission('holiday.manage')
  @Audit('holiday:create', 'holiday')
  @Post()
  create(@TenantCtx() ctx: TenantContext, @Body() dto: SaveHolidayDto) {
    return this.holidays.create(ctx.companyId!, dto);
  }

  @RequirePermission('holiday.manage')
  @Audit('holiday:update', 'holiday')
  @Patch(':id')
  update(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveHolidayDto) {
    return this.holidays.update(ctx.companyId!, id, dto);
  }

  @RequirePermission('holiday.manage')
  @Audit('holiday:delete', 'holiday')
  @Delete(':id')
  remove(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.holidays.remove(ctx.companyId!, id);
  }
}
