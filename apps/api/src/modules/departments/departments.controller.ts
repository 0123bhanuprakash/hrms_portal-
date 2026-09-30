import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { RequirePermission, Audit, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @RequirePermission('employee:create')
  @Audit('department:create', 'department')
  @Post()
  async create(
    @TenantCtx() ctx: TenantContext,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(ctx.companyId!, dto);
  }

  @RequirePermission('employee:read')
  @Get()
  async findAll(
    @TenantCtx() ctx: TenantContext,
    @Query('search') search?: string,
  ) {
    return this.departmentsService.findAll(ctx.companyId!, { search });
  }

  @RequirePermission('employee:read')
  @Get(':id')
  async findOne(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.departmentsService.findOne(ctx.companyId!, id);
  }

  @RequirePermission('employee:update')
  @Audit('department:update', 'department')
  @Patch(':id')
  async update(
    @TenantCtx() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(ctx.companyId!, id, dto);
  }

  @RequirePermission('employee:delete')
  @Audit('department:delete', 'department')
  @Delete(':id')
  async remove(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.departmentsService.remove(ctx.companyId!, id);
  }
}
