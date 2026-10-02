import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeeImportService } from './employee-import.service';
import { ImportEmployeesDto } from './dto/import-employees.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employee.dto';
import { RequirePermission, RequireFeature, Audit, TenantCtx, CurrentAccess } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';

// Every route needs the Employee directory feature; which employees a caller
// sees or edits follows their permission scope (own / reports / dept / company).
@RequireFeature('people.directory')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly importService: EmployeeImportService,
  ) {}

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
  async import(@TenantCtx() ctx: TenantContext, @Body() dto: ImportEmployeesDto) {
    return this.importService.import(ctx.companyId!, dto.rows, dto.sendInvites ?? true);
  }

  @RequirePermission('employee.create')
  @Audit('employee:create', 'employee')
  @Post()
  async create(
    @TenantCtx() ctx: TenantContext,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(ctx.companyId!, dto);
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
