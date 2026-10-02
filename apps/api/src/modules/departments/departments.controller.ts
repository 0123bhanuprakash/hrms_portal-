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
import { RequirePermission, RequireFeature, Audit, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';

// Organisation structure is a core feature; reads need org.view, changes org.manage
@RequireFeature('people.org')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @RequirePermission('org.manage')
  @Audit('department:create', 'department')
  @Post()
  async create(
    @TenantCtx() ctx: TenantContext,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(ctx.companyId!, dto);
  }

  @RequirePermission('org.view')
  @Get()
  async findAll(
    @TenantCtx() ctx: TenantContext,
    @Query('search') search?: string,
  ) {
    return this.departmentsService.findAll(ctx.companyId!, { search });
  }

  @RequirePermission('org.view')
  @Get(':id')
  async findOne(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.departmentsService.findOne(ctx.companyId!, id);
  }

  @RequirePermission('org.manage')
  @Audit('department:update', 'department')
  @Patch(':id')
  async update(
    @TenantCtx() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(ctx.companyId!, id, dto);
  }

  @RequirePermission('org.manage')
  @Audit('department:delete', 'department')
  @Delete(':id')
  async remove(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.departmentsService.remove(ctx.companyId!, id);
  }
}
