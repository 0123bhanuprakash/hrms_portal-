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
import { RequirePermission, RequireFeature, Audit, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';

// Organisation structure is a core feature; reads need org.view, changes org.manage
@RequireFeature('people.org')
@Controller('office-locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @RequirePermission('org.manage')
  @Audit('location:create', 'office_location')
  @Post()
  async create(
    @TenantCtx() ctx: TenantContext,
    @Body() dto: CreateLocationDto,
  ) {
    return this.locationsService.create(ctx.companyId!, dto);
  }

  @RequirePermission('org.view')
  @Get()
  async findAll(@TenantCtx() ctx: TenantContext) {
    return this.locationsService.findAll(ctx.companyId!);
  }

  @RequirePermission('org.view')
  @Get(':id')
  async findOne(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.locationsService.findOne(ctx.companyId!, id);
  }

  @RequirePermission('org.manage')
  @Audit('location:update', 'office_location')
  @Patch(':id')
  async update(
    @TenantCtx() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationsService.update(ctx.companyId!, id, dto);
  }

  @RequirePermission('org.manage')
  @Audit('location:delete', 'office_location')
  @Delete(':id')
  async remove(@TenantCtx() ctx: TenantContext, @Param('id') id: string) {
    return this.locationsService.remove(ctx.companyId!, id);
  }
}
