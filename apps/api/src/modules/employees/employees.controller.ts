import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employee.dto';
import { RequirePermission, Audit, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @RequirePermission('employee:create')
  @Audit('employee:create', 'employee')
  @Post()
  async create(
    @TenantCtx() ctx: TenantContext,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(ctx.companyId!, dto);
  }

  @RequirePermission('employee:read')
  @Get()
  async findAll(
    @TenantCtx() ctx: TenantContext,
    @Query() query: QueryEmployeesDto,
  ) {
    return this.employeesService.findAll(ctx.companyId!, query);
  }

  @RequirePermission('employee:read')
  @Get('org-chart')
  async getOrgChart(@TenantCtx() ctx: TenantContext) {
    return this.employeesService.getOrgChart(ctx.companyId!);
  }

  @RequirePermission('employee:read')
  @Get(':id')
  async findOne(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.employeesService.findOne(ctx.companyId!, id);
  }

  @RequirePermission('employee:update')
  @Audit('employee:update', 'employee')
  @Patch(':id')
  async update(
    @TenantCtx() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(ctx.companyId!, id, dto);
  }
}
