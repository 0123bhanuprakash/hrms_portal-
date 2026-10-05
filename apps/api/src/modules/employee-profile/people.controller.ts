import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { CurrentAccess, RequireFeature, RequirePermission, TenantCtx } from '../../common';
import type { TenantContext } from '../../common/types/request.types';
import type { AccessContext } from '../access/access.types';
import { PeopleService } from './people.service';
import { DirectoryQueryDto } from './dto';

/** Colleague-facing views: basic details only, never personal data. */
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  /** The caller's own employee card (null when the account has no employee profile). */
  @Get('me')
  me(@TenantCtx() ctx: TenantContext, @CurrentAccess() access: AccessContext) {
    return this.people.me(ctx.companyId!, access);
  }

  @RequireFeature('people.directory')
  @RequirePermission('org.view')
  @Get()
  directory(@TenantCtx() ctx: TenantContext, @Query() query: DirectoryQueryDto, @CurrentAccess() access: AccessContext) {
    return this.people.directory(ctx.companyId!, query, access);
  }

  /** New this month, birthdays this week, and who's in today. */
  @RequireFeature('people.directory')
  @RequirePermission('org.view')
  @Get('highlights')
  highlights(@TenantCtx() ctx: TenantContext) {
    return this.people.highlights(ctx.companyId!);
  }

  /** Quick look at one colleague (basic details only, never personal data). */
  @RequireFeature('people.directory')
  @RequirePermission('org.view')
  @Get(':id/card')
  card(@TenantCtx() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.people.card(ctx.companyId!, id);
  }

  @RequirePermission('org.view')
  @Get('spotlight')
  spotlight(@TenantCtx() ctx: TenantContext) {
    return this.people.spotlight(ctx.companyId!);
  }
}
