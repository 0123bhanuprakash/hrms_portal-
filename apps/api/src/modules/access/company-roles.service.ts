import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessScope } from '@hrms/types';
import { broader, PERMISSION_BY_KEY, ROLE_TEMPLATES } from './catalog';

type Db = PrismaClient | Prisma.TransactionClient;
export type TemplateRoleKey = (typeof ROLE_TEMPLATES)[number]['key'];

/**
 * Every company owns editable copies of the role templates
 * (Company Admin, HR, Manager, Team Lead, Employee). Created at company
 * onboarding and by the start-up bootstrap for existing companies.
 */
@Injectable()
export class CompanyRolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Make sure the company has every template role; returns key → role id. */
  async ensureCompanyRoles(db: Db, companyId: string): Promise<Map<string, string>> {
    const existing = await db.role.findMany({
      where: { companyId, key: { not: null } },
      select: { id: true, key: true },
    });
    const byKey = new Map(existing.map((r) => [r.key!, r.id]));

    for (const template of ROLE_TEMPLATES) {
      if (byKey.has(template.key)) continue;
      // A custom role may already use the template's name → suffix it
      const nameTaken = await db.role.findFirst({ where: { companyId, name: template.name }, select: { id: true } });
      const role = await db.role.create({
        data: {
          companyId,
          key: template.key,
          name: nameTaken ? `${template.name} (default)` : template.name,
          description: template.description,
          isOwner: Boolean(template.isOwner),
          isSystemRole: Boolean(template.isOwner),
          rolePermissions: { create: await this.grantRows(db, template.grants) },
        },
        select: { id: true },
      });
      byKey.set(template.key, role.id);
    }
    return byKey;
  }

  /** The company's role for a template key (creating the set if missing). */
  async roleId(db: Db, companyId: string, key: TemplateRoleKey): Promise<string> {
    const id = (await this.ensureCompanyRoles(db, companyId)).get(key);
    if (!id) throw new InternalServerErrorException(`Role template '${key}' is missing`);
    return id;
  }

  /** role_permissions rows for [permission, scope] pairs (permissions must be synced). */
  async grantRows(db: Db, grants: Array<[string, string?]>): Promise<Array<{ permissionId: string; scope: string | null }>> {
    const keys = [...new Set(grants.map(([key]) => key))];
    const permissions = await db.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
    const idOf = new Map(permissions.map((p) => [p.key, p.id]));
    const missing = keys.filter((k) => !idOf.has(k) || !PERMISSION_BY_KEY.has(k));
    if (missing.length) {
      throw new InternalServerErrorException(`Unknown permissions in role template: ${missing.join(', ')}`);
    }
    // Same permission listed twice (e.g. own + company) → keep the broadest scope
    const rows = new Map<string, { permissionId: string; scope: string | null }>();
    for (const [key, scope] of grants) {
      const previous = rows.get(key)?.scope as AccessScope | null | undefined;
      const next = (scope ?? null) as AccessScope | null;
      rows.set(key, { permissionId: idOf.get(key)!, scope: previous === undefined ? next : broader(previous, next) });
    }
    return [...rows.values()];
  }
}
