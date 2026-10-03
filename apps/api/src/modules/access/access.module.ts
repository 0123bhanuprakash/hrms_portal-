import { Global, Module } from '@nestjs/common';
import { AccessBootstrapService } from './access-bootstrap.service';
import { AccessController } from './access.controller';
import { ExplainController } from './explain.controller';
import { ExplainService } from './explain.service';
import { AccessService } from './access.service';
import { CompanyRolesService } from './company-roles.service';
import { EntitlementService } from './entitlement.service';
import { HierarchyService } from './hierarchy.service';

/**
 * Access control: feature entitlements (plans), company roles & grants,
 * org hierarchy closures and the per-request AccessContext.
 * Global — guards, JwtStrategy and feature modules all depend on it.
 */
@Global()
@Module({
  controllers: [AccessController, ExplainController],
  providers: [AccessService, EntitlementService, HierarchyService, CompanyRolesService, AccessBootstrapService, ExplainService],
  exports: [AccessService, EntitlementService, HierarchyService, CompanyRolesService],
})
export class AccessModule {}
