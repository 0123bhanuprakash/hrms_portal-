import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, StreamableFile } from '@nestjs/common';
import { Audit, CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '@hrms/types';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { ReportsService } from './reports.service';
import { ReportsOverviewService } from './reports-overview.service';
import { ReportSchedulesService } from './report-schedules.service';
import { DayQueryDto, DrillQueryDto, FilterQueryDto, MonthQueryDto, RangeQueryDto, SaveScheduleDto, UtilisationQueryDto, LeaveLeftQueryDto } from './dto';

const file = (body: string, name: string) => new StreamableFile(Buffer.from(body, 'utf8'), { type: 'text/csv; charset=utf-8', disposition: `attachment; filename="${name}"` });
const uuid = new ParseUUIDPipe({ version: '4' });

// ============================================================
// Reports & analytics (every number limited to what the caller may see;
// departmentId / locationId narrow it further)
//
// GET  /reports/overview                headline numbers vs before, monthly trend, bridge, what changed
// GET  /reports/people                  people report
// GET  /reports/people/list             who is behind one number (dimension + value)
// GET  /reports/people/export           roster CSV
// GET  /reports/attendance              attendance & leave (month or from / to)
// GET  /reports/attendance/day          who was in on one day
// GET  /reports/utilisation(/export)    allocation, logged & billable, by week
// GET|POST /reports/schedules           emailed reports (yours)
// GET  /reports/schedules/recipients    people who can receive them
// PUT|DELETE /reports/schedules/:id
// POST /reports/schedules/:id/send      send now
// ============================================================

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly overviews: ReportsOverviewService,
    private readonly schedules: ReportSchedulesService,
  ) {}

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('overview')
  overview(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RangeQueryDto) {
    return this.overviews.overview(ctx.companyId!, access, q);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('people')
  people(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: FilterQueryDto) {
    return this.reports.people(ctx.companyId!, access, q);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('people/list')
  peopleList(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: DrillQueryDto) {
    return this.reports.peopleList(ctx.companyId!, access, q);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.export')
  @Audit('report:export:people', 'report')
  @Get('people/export')
  async peopleCsv(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext): Promise<StreamableFile> {
    return file(await this.reports.peopleCsv(ctx.companyId!, access), `employees-${await this.reports.todayKey(ctx.companyId!)}.csv`);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('attendance')
  attendance(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: MonthQueryDto) {
    return this.reports.attendance(ctx.companyId!, access, q);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('attendance/day')
  attendanceDay(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: DayQueryDto) {
    return this.reports.attendanceDay(ctx.companyId!, access, q);
  }

  /** "15+ days left" drawer: per leave type, counts and the first few; typeId pages through one type. */
  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('attendance/leave-left')
  leaveLeft(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: LeaveLeftQueryDto) {
    return this.reports.leaveLeft(ctx.companyId!, access, q);
  }

  /** PMO (project.manage) sees everyone; managers with report.view see their scope. */
  @RequireFeature('work.projects')
  @Get('utilisation')
  utilisation(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: UtilisationQueryDto) {
    return this.reports.utilisation(ctx.companyId!, access, q);
  }

  @RequireFeature('work.projects')
  @Audit('report:export:utilisation', 'report')
  @Get('utilisation/export')
  async utilisationCsv(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() q: RangeQueryDto): Promise<StreamableFile> {
    const r = await this.reports.utilisationCsv(ctx.companyId!, access, q);
    return file(r.body, r.name);
  }

  // ─── Emailed on a schedule ────────────────────────────────

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('schedules')
  listSchedules(@TenantCtx() ctx: TenantContext, @CurrentUser() user: JwtPayload) {
    return this.schedules.list(ctx.companyId!, user.sub);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Get('schedules/recipients')
  recipients(@TenantCtx() ctx: TenantContext) {
    return this.schedules.recipients(ctx.companyId!);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Audit('report:schedule:create', 'report')
  @Post('schedules')
  createSchedule(@TenantCtx() ctx: TenantContext, @CurrentUser() user: JwtPayload, @Body() dto: SaveScheduleDto) {
    return this.schedules.create(ctx.companyId!, user.sub, dto);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Audit('report:schedule:update', 'report')
  @Put('schedules/:id')
  updateSchedule(@TenantCtx() ctx: TenantContext, @CurrentUser() user: JwtPayload, @Param('id', uuid) id: string, @Body() dto: SaveScheduleDto) {
    return this.schedules.update(ctx.companyId!, user.sub, id, dto);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @Audit('report:schedule:delete', 'report')
  @Delete('schedules/:id')
  deleteSchedule(@TenantCtx() ctx: TenantContext, @CurrentUser() user: JwtPayload, @Param('id', uuid) id: string) {
    return this.schedules.remove(ctx.companyId!, user.sub, id);
  }

  @RequireFeature('insights.reports')
  @RequirePermission('report.view')
  @HttpCode(200)
  @Post('schedules/:id/send')
  sendSchedule(@TenantCtx() ctx: TenantContext, @CurrentUser() user: JwtPayload, @Param('id', uuid) id: string) {
    return this.schedules.sendNow(ctx.companyId!, user.sub, id);
  }
}
