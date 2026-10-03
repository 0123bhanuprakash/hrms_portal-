import { Controller, Get, Query } from '@nestjs/common';
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
  directory(@TenantCtx() ctx: TenantContext, @Query() query: DirectoryQueryDto) {
    return this.people.directory(ctx.companyId!, query);
  }

  @RequirePermission('org.view')
  @Get('spotlight')
  spotlight(@TenantCtx() ctx: TenantContext) {
    return this.people.spotlight(ctx.companyId!);
  }
}
