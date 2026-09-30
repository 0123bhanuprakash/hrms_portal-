import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '@hrms/types';

// ============================================================
// TenantGuard
//
// Resource-level IDOR (Insecure Direct Object Reference) prevention.
//
// Verifies that the resource being accessed belongs to the same
// tenant (company) as the requesting user.
//
// IMPORTANT: Returns 404 (not 403) on tenant mismatch.
// Returning 403 would reveal the resource EXISTS but the user
// lacks access — a security leak. 404 makes cross-tenant
// resources appear non-existent.
//
// Usage:
//   @UseGuards(JwtAuthGuard, TenantGuard)
//   @Get(':id')
//   async findOne(@Param('id') id: string) {
//     const resource = await this.service.findOne(id);
//     // TenantGuard needs resource's companyId on req.resource
//     return resource;
//   }
//
// To use TenantGuard, the service must attach the resource's
// companyId to req before the guard runs, OR the guard can
// be applied at controller class level to protect all routes.
//
// This guard is a building block — feature services implement
// company_id filtering in their Prisma queries, making this
// a second layer of defense.
// ============================================================

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        user: JwtPayload;
        resource?: { companyId?: string | null };
      }
    >();

    const user = request.user;

    // Super Admin can access any resource (platform level)
    if (user?.is_super_admin) return true;

    // If no resource is attached, allow (single-tenant route or public route)
    // Feature services filter by company_id in their queries anyway
    if (!request.resource) return true;

    const resourceCompanyId = request.resource.companyId;
    const userCompanyId = user?.company_id;

    if (resourceCompanyId && userCompanyId && resourceCompanyId !== userCompanyId) {
      this.logger.warn(
        `Tenant isolation violation: user=${user.sub} (company=${userCompanyId}) ` +
          `attempted to access resource in company=${resourceCompanyId}`,
      );
      // Return 404 — never reveal the resource exists for another tenant
      throw new NotFoundException('Resource not found');
    }

    return true;
  }
}
