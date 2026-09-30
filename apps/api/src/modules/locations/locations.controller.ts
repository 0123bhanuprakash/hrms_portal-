import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RequirePermission, Audit, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';

@Controller('office-locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @RequirePermission('employee:create')
  @Audit('location:create', 'office_location')
  @Post()
  async create(
    @TenantCtx() ctx: TenantContext,
    @Body() dto: CreateLocationDto,
  ) {
    return this.locationsService.create(ctx.companyId!, dto);
  }

  @RequirePermission('employee:read')
  @Get()
  async findAll(@TenantCtx() ctx: TenantContext) {
    return this.locationsService.findAll(ctx.companyId!);
  }

  @RequirePermission('employee:read')
  @Get(':id')
  async findOne(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.locationsService.findOne(ctx.companyId!, id);
  }

  @RequirePermission('employee:update')
  @Audit('location:update', 'office_location')
  @Patch(':id')
  async update(
    @TenantCtx() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationsService.update(ctx.companyId!, id, dto);
  }

  @RequirePermission('employee:delete')
  @Audit('location:delete', 'office_location')
  @Delete(':id')
  async remove(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.locationsService.remove(ctx.companyId!, id);
  }
}
