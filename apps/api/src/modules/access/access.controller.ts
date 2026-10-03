import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MyAccess } from '@hrms/types';
import type { AuthenticatedRequest } from '../../common';
import { AllowPendingPasswordChange } from '../../common';
import { AccessService } from './access.service';
import { CATALOG } from './catalog';

// ============================================================
// GET /access/me       my effective access (features, roles, grants + scopes)
// GET /access/catalog  modules → features → permissions; for company users
//                      each feature carries `enabled` for their company
// ============================================================

@ApiTags('Access')
@ApiBearerAuth()
@Controller('access')
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get('me')
  @AllowPendingPasswordChange()
  @ApiOperation({ summary: 'My effective access: enabled features, roles and permission grants with scopes' })
  me(@Req() req: AuthenticatedRequest): MyAccess {
    return this.access.toMyAccess(req.user.access);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Feature & permission catalog (with enabled flags for company users)' })
  catalog(@Req() req: AuthenticatedRequest) {
    const { access } = req.user;
    return CATALOG.map((m) => ({
      ...m,
      features: m.features.map((f) => ({
        ...f,
        ...(access.isSuperAdmin ? {} : { enabled: access.features.has(f.key) }),
      })),
    }));
  }
}
