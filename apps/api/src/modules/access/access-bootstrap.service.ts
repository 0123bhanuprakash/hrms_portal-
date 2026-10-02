import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyRolesService } from './company-roles.service';
import { HierarchyService } from './hierarchy.service';
import { AVAILABLE_FEATURES, CATALOG, DEFAULT_PLAN_KEY, DEFAULT_PLANS, PERMISSION_BY_KEY, ROLE_TEMPLATES } from './catalog';

/**
 * Runs on every API start (idempotent — a no-op when nothing changed):
 *   1. Sync the code catalog into `permissions` (new keys appear, removed ones are deprecated)
 *   2. Keep the global role templates in line with the catalog
 *   3. Create default plans; companies without a plan get Enterprise (everything on)
 *   4. Give every company its own template roles and move users onto them
 *   5. Build missing hierarchy closures
 *   6. Permissions new to the catalog → added to every company's template-derived
 *      roles that the template grants them to (once — later edits are respected)
 */
@Injectable()
export class AccessBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('AccessBootstrap');

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyRoles: CompanyRolesService,
    private readonly hierarchy: HierarchyService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const started = Date.now();
    const permissions = await this.syncPermissions();
    const templates = await this.syncTemplates();
    const plans = await this.ensurePlans();
    const companies = await this.ensureCompanies();
    await this.rollOutNewPermissions();
    this.logger.log(
      `✅ Access catalog ready — ${permissions} permissions, ${templates} templates, ${plans} plans, ${companies} companies checked (${Date.now() - started} ms)`,
    );
  }

  // 1 ─────────────────────────────────────────────────────────
  private async syncPermissions(): Promise<number> {
    let order = 0;
    for (const m of CATALOG) {
      for (const f of m.features) {
        for (const perm of f.permissions) {
          const [module, action] = perm.key.split('.') as [string, string];
          const data = {
            module,
            action,
            key: perm.key,
            description: perm.description ?? '',
            label: perm.label,
            featureKey: f.key,
            scopes: perm.scopes,
            sensitive: Boolean(perm.sensitive),
            deprecated: false,
            sortOrder: order++,
          };
          const byKey = await this.prisma.permission.findUnique({ where: { key: perm.key }, select: { id: true } });
          // Legacy "module:action" rows share (module, action) — adopt them instead of clashing
          const legacy = byKey ? null : await this.prisma.permission.findUnique({ where: { module_action: { module, action } }, select: { id: true } });
          const id = byKey?.id ?? legacy?.id;
          if (id) await this.prisma.permission.update({ where: { id }, data });
          else await this.prisma.permission.create({ data });
        }
      }
    }
    await this.prisma.permission.updateMany({
      where: { key: { notIn: [...PERMISSION_BY_KEY.keys()] }, deprecated: false },
      data: { deprecated: true },
    });
    return PERMISSION_BY_KEY.size;
  }

  // 2 ─────────────────────────────────────────────────────────
  private async syncTemplates(): Promise<number> {
    for (const template of ROLE_TEMPLATES) {
      let role = await this.prisma.role.findFirst({
        where: { companyId: null, OR: [{ key: template.key }, { name: template.key, isSystemRole: true }] },
        select: { id: true },
      });
      if (!role) {
        role = await this.prisma.role.create({
          data: { companyId: null, key: template.key, name: template.name, description: template.description },
          select: { id: true },
        });
      }
      const rows = await this.companyRoles.grantRows(this.prisma, template.grants);
      const current = await this.prisma.rolePermission.findMany({ where: { roleId: role.id }, select: { permissionId: true, scope: true } });
      const signature = (list: Array<{ permissionId: string; scope: string | null }>) =>
        list.map((r) => `${r.permissionId}:${r.scope ?? ''}`).sort().join(',');
      const changed = signature(rows) !== signature(current);

      await this.prisma.role.update({
        where: { id: role.id },
        data: {
          key: template.key,
          name: template.name,
          description: template.description,
          isTemplate: true,
          isSystemRole: true,
          isOwner: Boolean(template.isOwner),
          ...(changed && { version: { increment: 1 } }),
        },
      });
      if (changed) {
        await this.prisma.$transaction([
          this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
          this.prisma.rolePermission.createMany({ data: rows.map((r) => ({ ...r, roleId: role!.id })) }),
        ]);
      }
    }
    return ROLE_TEMPLATES.length;
  }

  // 3 ─────────────────────────────────────────────────────────
  private async ensurePlans(): Promise<number> {
    for (const [i, plan] of DEFAULT_PLANS.entries()) {
      // Create-only: plans become editable by the Super Admin
      const exists = await this.prisma.plan.findUnique({ where: { key: plan.key }, select: { id: true } });
      if (exists) continue;
      await this.prisma.plan.create({
        data: {
          key: plan.key,
          name: plan.name,
          description: plan.description,
          sortOrder: i,
          limits: plan.limits,
          features: { create: plan.features.map((featureKey) => ({ featureKey })) },
        },
      });
      this.logger.log(`Created plan "${plan.name}"`);
    }
    await this.rollOutNewFeatures();
    const fallback = await this.prisma.plan.findUniqueOrThrow({ where: { key: DEFAULT_PLAN_KEY }, select: { id: true } });
    const { count } = await this.prisma.company.updateMany({ where: { planId: null }, data: { planId: fallback.id } });
    if (count) this.logger.log(`${count} compan${count === 1 ? 'y' : 'ies'} put on the ${DEFAULT_PLAN_KEY} plan (all features)`);
    return DEFAULT_PLANS.length;
  }

  /**
   * Features new to the catalog are added once to the "everything" plan
   * (Enterprise). Tracked like permissions, so a Super Admin removing a
   * feature from that plan later is respected.
   */
  private async rollOutNewFeatures(): Promise<void> {
    const KEY = 'access.knownFeatures';
    const setting = await this.prisma.platformSetting.findUnique({ where: { key: KEY } });
    let known: Set<string>;
    if (setting) known = new Set(setting.value as string[]);
    else {
      // First run: features already in some plan are known; the rest are new
      const inPlans = await this.prisma.planFeature.findMany({ select: { featureKey: true }, distinct: ['featureKey'] });
      known = new Set(inPlans.map((f) => f.featureKey));
    }
    const fresh = AVAILABLE_FEATURES.filter((f) => !known.has(f));
    if (fresh.length) {
      const plan = await this.prisma.plan.findUnique({ where: { key: DEFAULT_PLAN_KEY }, select: { id: true } });
      if (plan) {
        await this.prisma.planFeature.createMany({ data: fresh.map((featureKey) => ({ planId: plan.id, featureKey })), skipDuplicates: true });
        const { count } = await this.prisma.company.updateMany({ where: { planId: plan.id }, data: { featuresVersion: { increment: 1 } } });
        this.logger.log(`New features ${fresh.join(', ')} → ${DEFAULT_PLAN_KEY} plan (${count} compan${count === 1 ? 'y' : 'ies'})`);
      }
    }
    if (fresh.length || !setting) {
      await this.prisma.platformSetting.upsert({ where: { key: KEY }, update: { value: AVAILABLE_FEATURES }, create: { key: KEY, value: AVAILABLE_FEATURES } });
    }
  }

  // 4 + 5 ─────────────────────────────────────────────────────
  private async ensureCompanies(): Promise<number> {
    const companies = await this.prisma.company.findMany({ select: { id: true, slug: true } });

    for (const company of companies) {
      await this.prisma.$transaction(async (tx) => {
        const roleIds = await this.companyRoles.ensureCompanyRoles(tx, company.id);

        // Users still on a global template role → the company's own copy
        const legacy = await tx.userRole.findMany({
          where: { user: { companyId: company.id }, role: { companyId: null, isTemplate: true } },
          select: { userId: true, roleId: true, assignedAt: true, assignedBy: true, role: { select: { key: true } } },
        });
        for (const ur of legacy) {
          const target = ur.role.key ? roleIds.get(ur.role.key) : undefined;
          if (!target) continue;
          await tx.userRole.delete({ where: { userId_roleId: { userId: ur.userId, roleId: ur.roleId } } });
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: ur.userId, roleId: target } },
            update: {},
            create: { userId: ur.userId, roleId: target, companyId: company.id, assignedAt: ur.assignedAt, assignedBy: ur.assignedBy },
          });
        }
        if (legacy.length) this.logger.log(`${company.slug}: moved ${legacy.length} user role(s) onto company roles`);
      }, { timeout: 30_000 });

      // Closures: rebuild when they don't cover every employee / department
      const [employees, employeeSelfRows, departments, departmentSelfRows] = await Promise.all([
        this.prisma.employee.count({ where: { companyId: company.id } }),
        this.prisma.employeeHierarchy.count({ where: { companyId: company.id, depth: 0 } }),
        this.prisma.department.count({ where: { companyId: company.id } }),
        this.prisma.departmentHierarchy.count({ where: { companyId: company.id, depth: 0 } }),
      ]);
      if (employees !== employeeSelfRows) await this.hierarchy.rebuildEmployees(company.id);
      if (departments !== departmentSelfRows) await this.hierarchy.rebuildDepartments(company.id);
    }
    return companies.length;
  }

  // 6 ─────────────────────────────────────────────────────────
  /**
   * Remembers which catalog permissions companies already know about
   * (platform setting), so a permission is rolled out exactly once — even if
   * the API restarts half-way — and later removals by Company Admins stick.
   */
  private async rollOutNewPermissions(): Promise<void> {
    const KEY = 'access.knownPermissions';
    const allKeys = [...PERMISSION_BY_KEY.keys()];
    const setting = await this.prisma.platformSetting.findUnique({ where: { key: KEY } });
    let known: Set<string>;
    if (setting) {
      known = new Set(setting.value as string[]);
    } else {
      // First run: anything a template grants but no company role holds yet is new
      const held = await this.prisma.rolePermission.findMany({
        where: { role: { companyId: { not: null }, isOwner: false } },
        select: { permission: { select: { key: true } } },
        distinct: ['permissionId'],
      });
      const heldKeys = new Set(held.map((h) => h.permission.key));
      const templateKeys = new Set(ROLE_TEMPLATES.flatMap((t) => t.grants.map(([k]) => k)));
      known = new Set(allKeys.filter((k) => !templateKeys.has(k) || heldKeys.has(k)));
    }

    const fresh = allKeys.filter((k) => !known.has(k));
    for (const template of ROLE_TEMPLATES) {
      const grants = template.grants.filter(([key]) => fresh.includes(key));
      if (!grants.length || template.isOwner) continue;
      const rows = await this.companyRoles.grantRows(this.prisma, grants);
      const roles = await this.prisma.role.findMany({ where: { key: template.key, companyId: { not: null } }, select: { id: true } });
      for (const role of roles) {
        const { count } = await this.prisma.rolePermission.createMany({
          data: rows.map((r) => ({ ...r, roleId: role.id })),
          skipDuplicates: true,
        });
        if (count) await this.prisma.role.update({ where: { id: role.id }, data: { version: { increment: 1 } } });
      }
      this.logger.log(`New permissions ${grants.map(([k]) => k).join(', ')} → ${roles.length} "${template.name}" role(s)`);
    }
    if (fresh.length || !setting) {
      await this.prisma.platformSetting.upsert({ where: { key: KEY }, update: { value: allKeys }, create: { key: KEY, value: allKeys } });
    }
  }
}
