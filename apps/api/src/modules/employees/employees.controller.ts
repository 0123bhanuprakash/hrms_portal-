import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeeImportService } from './employee-import.service';
import { ImportEmployeesDto } from './dto/import-employees.dto';
import { CreateEmployeeProfileDto } from './dto/create-employee-profile.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employee.dto';
import { EmployeeLifecycleService } from './lifecycle.service';
import { AddChecklistItemDto, BulkEmployeesDto, ChecklistQueryDto, ConvertInternDto, ExtendInternshipDto, InternshipSettingsDto, ExtendProbationDto, MarkLeftDto, NoteDto, StartNoticeDto, TickChecklistDto } from './dto/lifecycle.dto';
import { RequirePermission, RequireFeature, Audit, TenantCtx, CurrentAccess } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { Live } from '../realtime/live.decorator';

// Every route needs the Employee directory feature; which employees a caller
// sees or edits follows their permission scope (own / reports / dept / company).
@RequireFeature('people.directory')
@Live('people', 'company')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly importService: EmployeeImportService,
    private readonly lifecycle: EmployeeLifecycleService,
  ) {}

  /**
   * Everyone in a company is an employee: an account without a profile (e.g. a
   * company admin from before this rule) creates its own basic one, then completes it.
   */
  @Audit('employee:create-own', 'employee')
  @Post('me')
  async createMine(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.employeesService.basicProfileFor(ctx.companyId!, access.userId);
  }

  /** Employee profile for an existing sign-in account (e.g. invited from Users). */
  @RequirePermission('employee.create')
  @Audit('employee:create', 'employee')
  @Post('for-user/:userId')
  async createForUser(
    @TenantCtx() ctx: TenantContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateEmployeeProfileDto,
  ) {
    return this.employeesService.createForUser(ctx.companyId!, userId, dto);
  }

  /** Bulk import step 1: validate every row, write nothing. */
  @RequirePermission('employee.import')
  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  async importPreview(@TenantCtx() ctx: TenantContext, @Body() dto: ImportEmployeesDto) {
    return this.importService.preview(ctx.companyId!, dto.rows);
  }

  /** Bulk import step 2: create the valid rows (managers first). */
  @RequirePermission('employee.import')
  @Audit('employee:import', 'employee')
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async import(@TenantCtx() ctx: TenantContext, @Body() dto: ImportEmployeesDto, @CurrentAccess() access: AccessContext) {
    return this.importService.import(ctx.companyId!, dto.rows, dto.sendInvites ?? true, dto.progressId ? { userId: access.userId, id: dto.progressId } : undefined);
  }

  @RequirePermission('employee.create')
  @Audit('employee:create', 'employee')
  @Post()
  async create(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(ctx.companyId!, dto, { actorUserId: access.userId });
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /** Counts per stage + "needs your attention" (within the caller's reach). */
  @RequirePermission('employee.view')
  @Get('lifecycle')
  lifecycleSummary(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.lifecycle.summary(ctx.companyId!, access);
  }

  /** What happens when an internship ends: remind HR, or convert to Full-time automatically. */
  @RequirePermission('employee.edit')
  @Audit('employee:internship-settings', 'company_settings')
  @Put('internship-settings')
  internshipSettings(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: InternshipSettingsDto) {
    return this.lifecycle.setInternshipEndAction(ctx.companyId!, access, dto.internshipEndAction);
  }

  @RequirePermission('employee.view')
  @Get('board')
  board(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.lifecycle.board(ctx.companyId!, access);
  }

  @RequirePermission('employee.create')
  @Get('next-id')
  nextId(@TenantCtx() ctx: TenantContext) {
    return this.employeesService.nextId(ctx.companyId!);
  }

  @RequirePermission('employee.export')
  @Get('export')
  async exportCsv(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Query() query: QueryEmployeesDto): Promise<StreamableFile> {
    const csv = await this.employeesService.exportCsv(ctx.companyId!, query, access);
    return new StreamableFile(Buffer.from(csv, 'utf8'), { type: 'text/csv; charset=utf-8', disposition: 'attachment; filename="employees.csv"' });
  }

  @RequirePermission('employee.edit')
  @Audit('employee:bulk', 'employee')
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  bulk(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Body() dto: BulkEmployeesDto) {
    return this.lifecycle.bulk(ctx.companyId!, access, dto);
  }

  @RequirePermission('employee.view')
  @Get(':id/history')
  history(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.lifecycle.history(ctx.companyId!, id, access);
  }

  @RequirePermission('employee.view')
  @Get(':id/glance')
  glance(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.lifecycle.glance(ctx.companyId!, id, access);
  }

  @RequirePermission('employee.edit')
  @Audit('employee:confirm', 'employee')
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) {
    return this.lifecycle.confirm(ctx.companyId!, id, access, dto.note);
  }

  @RequirePermission('employee.edit')
  @Audit('employee:extend-probation', 'employee')
  @Post(':id/extend-probation')
  @HttpCode(HttpStatus.OK)
  extendProbation(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ExtendProbationDto) {
    return this.lifecycle.extendProbation(ctx.companyId!, id, access, dto.until, dto.note);
  }

  @RequirePermission('employee.edit')
  @Audit('employee:convert-intern', 'employee')
  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  convertIntern(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertInternDto) {
    return this.lifecycle.convertIntern(ctx.companyId!, id, access, dto);
  }

  @RequirePermission('employee.edit')
  @Audit('employee:extend-internship', 'employee')
  @Post(':id/extend-internship')
  @HttpCode(HttpStatus.OK)
  extendInternship(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ExtendInternshipDto) {
    return this.lifecycle.extendInternship(ctx.companyId!, id, access, dto.until, dto.note);
  }

  @RequirePermission('employee.terminate')
  @Audit('employee:notice', 'employee')
  @Post(':id/notice')
  @HttpCode(HttpStatus.OK)
  startNotice(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StartNoticeDto) {
    return this.lifecycle.startNotice(ctx.companyId!, id, access, dto);
  }

  @RequirePermission('employee.terminate')
  @Audit('employee:withdraw-notice', 'employee')
  @Post(':id/withdraw-notice')
  @HttpCode(HttpStatus.OK)
  withdrawNotice(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) {
    return this.lifecycle.withdrawNotice(ctx.companyId!, id, access, dto.note);
  }

  @RequirePermission('employee.terminate')
  @Audit('employee:left', 'employee')
  @Post(':id/left')
  @HttpCode(HttpStatus.OK)
  markLeft(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkLeftDto) {
    return this.lifecycle.markLeft(ctx.companyId!, id, access, dto);
  }

  @RequirePermission('employee.edit')
  @Get(':id/checklist')
  checklist(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Query() q: ChecklistQueryDto) {
    return this.lifecycle.checklist(ctx.companyId!, id, access, q.kind);
  }

  @RequirePermission('employee.edit')
  @Post(':id/checklist')
  addChecklistItem(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddChecklistItemDto) {
    return this.lifecycle.addChecklistItem(ctx.companyId!, id, dto.kind, dto.label, access);
  }

  @RequirePermission('employee.edit')
  @Patch(':id/checklist/:itemId')
  tickChecklist(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: TickChecklistDto,
  ) {
    return this.lifecycle.tickChecklist(ctx.companyId!, id, itemId, dto.done, access);
  }

  @RequirePermission('employee.view')
  @Get()
  async findAll(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Query() query: QueryEmployeesDto,
  ) {
    return this.employeesService.findAll(ctx.companyId!, query, access);
  }

  @RequirePermission('org.view')
  @Get('org-chart')
  async getOrgChart(@TenantCtx() ctx: TenantContext) {
    return this.employeesService.getOrgChart(ctx.companyId!);
  }

  @RequirePermission('employee.view')
  @Get(':id')
  async findOne(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeesService.findOne(ctx.companyId!, id, access);
  }

  @RequirePermission('employee.edit')
  @Audit('employee:update', 'employee')
  @Patch(':id')
  async update(
    @TenantCtx() ctx: TenantContext,
    @CurrentAccess() access: AccessContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(ctx.companyId!, id, dto, access);
  }
}
