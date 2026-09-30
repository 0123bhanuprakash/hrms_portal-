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
import { DesignationsService } from './designations.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { RequirePermission, Audit, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';

@Controller('designations')
export class DesignationsController {
  constructor(private readonly designationsService: DesignationsService) {}

  @RequirePermission('employee:create')
  @Audit('designation:create', 'designation')
  @Post()
  async create(
    @TenantCtx() ctx: TenantContext,
    @Body() dto: CreateDesignationDto,
  ) {
    return this.designationsService.create(ctx.companyId!, dto);
  }

  @RequirePermission('employee:read')
  @Get()
  async findAll(
    @TenantCtx() ctx: TenantContext,
    @Query('search') search?: string,
  ) {
    return this.designationsService.findAll(ctx.companyId!, { search });
  }

  @RequirePermission('employee:read')
  @Get(':id')
  async findOne(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.designationsService.findOne(ctx.companyId!, id);
  }

  @RequirePermission('employee:update')
  @Audit('designation:update', 'designation')
  @Patch(':id')
  async update(
    @TenantCtx() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.designationsService.update(ctx.companyId!, id, dto);
  }

  @RequirePermission('employee:delete')
  @Audit('designation:delete', 'designation')
  @Delete(':id')
  async remove(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.designationsService.remove(ctx.companyId!, id);
  }
}
