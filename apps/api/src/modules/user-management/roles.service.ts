import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AccessScope } from '@hrms/types';
import { PrismaService } from '../prisma/prisma.service';
import { broader, FEATURE_BY_KEY, PERMISSION_BY_KEY, SCOPE_ORDER } from '../access/catalog';
import type { AccessContext } from '../access/access.types';
import type { DuplicateRoleDto, GrantDto, RoleStatusDto, SaveRoleDto } from './dto';

type Grants = Map<string, AccessScope | null>;

const ROLE_LIST_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  isOwner: true,
  status: true,
  version: true,
  updatedAt: true,
  createdAt: true,
  _count: { select: { rolePermissions: true, userRoles: true } },
} as const;

/**
 * Company roles (Roles & Permissions). Rules enforced here, not just in the UI:
 *   • The owner role (Company Admin) can't be edited, deactivated or deleted
 *   • Only features enabled for the company can be granted
 *   • Scopes must be ones the permission supports; dependencies are auto-added
 *   • No privilege escalation: non-owners can only grant what they hold,
 *     at most at their own scope
 *   • Every change bumps the role version → members' access refreshes next request
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Read ─────────────────────────────────────────────────

  async list(companyId: string) {
    const roles = await this.prisma.role.findMany({
      where: { companyId },
      select: ROLE_LIST_SELECT,
      orderBy: [{ isOwner: 'desc' }, { status: 'asc' }, { createdAt: 'asc' }],
    });
    return roles.map(({ _count, ...r }) => ({ ...r, permissionCount: _count.rolePermissions, userCount: _count.userRoles }));
  }

  async get(companyId: string, id: string) {
    const role = await this.findRole(companyId, id);
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId: id, permission: { deprecated: false } },
      select: { scope: true, permission: { select: { key: true } } },
    });
    const { _count, ...rest } = role;
    return {
      ...rest,
      permissionCount: _count.rolePermissions,
      userCount: _count.userRoles,
      grants: Object.fromEntries(rows.map((r) => [r.permission.key, r.scope])) as Record<string, AccessScope | null>,
    };
  }

  // ─── Write ────────────────────────────────────────────────

  async create(companyId: string, actor: AccessContext, dto: SaveRoleDto) {
    const grants = this.normalize(dto.grants, actor);
    this.assertNoEscalation(actor, grants);
    await this.assertNameFree(companyId, dto.name);

    const role = await this.prisma.role.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? '',
        createdById: actor.userId,
        updatedById: actor.userId,
        rolePermissions: { create: await this.rows(grants) },
      },
      select: { id: true },
    });
    return { ...(await this.get(companyId, role.id)), changes: { added: [...grants.keys()], removed: [], rescoped: [] } };
  }

  async update(companyId: string, actor: AccessContext, id: string, dto: SaveRoleDto) {
    const role = await this.findRole(companyId, id);
    this.assertEditable(role);
    const grants = this.normalize(dto.grants, actor);
    this.assertNoEscalation(actor, grants);
    if (dto.name.trim() !== role.name) await this.assertNameFree(companyId, dto.name, id);

    const before = (await this.get(companyId, id)).grants;
    const changes = {
      added: [...grants.keys()].filter((k) => !(k in before)),
      removed: Object.keys(before).filter((k) => !grants.has(k)),
      rescoped: [...grants.entries()]
        .filter(([k, s]) => k in before && before[k] !== s)
        .map(([k, s]) => `${k}: ${before[k] ?? '—'} → ${s ?? '—'}`),
    };
    const grantsChanged = changes.added.length + changes.removed.length + changes.rescoped.length > 0;
    const rows = await this.rows(grants);

    await this.prisma.$transaction([
      ...(grantsChanged
        ? [
            this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
            this.prisma.rolePermission.createMany({ data: rows.map((r) => ({ ...r, roleId: id })) }),
          ]
        : []),
      this.prisma.role.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() ?? role.description,
          updatedById: actor.userId,
          ...(grantsChanged && { version: { increment: 1 } }),
        },
      }),
    ]);
    return { ...(await this.get(companyId, id)), changes };
  }

  async duplicate(companyId: string, actor: AccessContext, id: string, dto: DuplicateRoleDto) {
    const source = await this.get(companyId, id);
    const grants: GrantDto[] = source.isOwner
      ? [] // the owner role has no stored grants — copying it makes an empty role
      : Object.entries(source.grants).map(([key, scope]) => ({ key, scope }));
    const name = dto.name?.trim() || (await this.copyName(companyId, source.name));
    return this.create(companyId, actor, { name, description: source.description, grants });
  }

  async setStatus(companyId: string, actor: AccessContext, id: string, dto: RoleStatusDto) {
    const role = await this.findRole(companyId, id);
    if (role.isOwner) throw new BadRequestException('The Company Admin role cannot be deactivated');

    if (dto.status === 'INACTIVE') {
      const holders = await this.prisma.userRole.findMany({
        where: { roleId: id },
        select: { userId: true, user: { select: { userRoles: { select: { role: { select: { id: true, status: true } } } } } } },
      });
      // Users who'd be left without any active role
      const stranded = holders.filter((h) => !h.user.userRoles.some((ur) => ur.role.id !== id && ur.role.status === 'ACTIVE'));

      if (dto.reassignToRoleId) {
        const target = await this.findRole(companyId, dto.reassignToRoleId);
        if (target.id === id || target.status !== 'ACTIVE') throw new BadRequestException('Choose another active role to move users to');
        if (target.isOwner && !actor.isOwner && !actor.isSuperAdmin) throw new ForbiddenException('Only a Company Admin can grant the Company Admin role');
        if (!target.isOwner) this.assertNoEscalation(actor, new Map(Object.entries((await this.get(companyId, target.id)).grants)));
        await this.prisma.$transaction(async (tx) => {
          for (const h of holders) {
            await tx.userRole.upsert({
              where: { userId_roleId: { userId: h.userId, roleId: target.id } },
              update: {},
              create: { userId: h.userId, roleId: target.id, companyId, assignedBy: actor.userId },
            });
          }
          await tx.userRole.deleteMany({ where: { roleId: id } });
          await tx.role.update({ where: { id: target.id }, data: { version: { increment: 1 } } });
        });
      } else if (stranded.length) {
        throw new BadRequestException(
          `${stranded.length} user(s) have no other active role. Choose a role to move them to before deactivating.`,
        );
      }
    }

    await this.prisma.role.update({
      where: { id },
      data: { status: dto.status, updatedById: actor.userId, version: { increment: 1 } },
    });
    return this.get(companyId, id);
  }

  async remove(companyId: string, id: string) {
    const role = await this.findRole(companyId, id);
    if (role.isOwner) throw new BadRequestException('The Company Admin role cannot be deleted');
    if (role._count.userRoles > 0) {
      throw new BadRequestException(`This role is assigned to ${role._count.userRoles} user(s). Move them to another role first.`);
    }
    await this.prisma.role.delete({ where: { id } });
    return { id, name: role.name, deleted: true };
  }

  // ─── Rules ────────────────────────────────────────────────

  /**
   * Validate keys/scopes against the catalog and the company's features,
   * add required permissions, and merge duplicates (broadest scope wins).
   */
  normalize(input: GrantDto[], actor: AccessContext): Grants {
    const grants: Grants = new Map();
    const add = (key: string, scope: AccessScope | null, via?: string) => {
      const perm = PERMISSION_BY_KEY.get(key);
      if (!perm) throw new BadRequestException(`Unknown permission '${key}'`);
      const feature = FEATURE_BY_KEY.get(perm.feature)!;
      if (feature.stage === 'coming_soon') throw new BadRequestException(`'${feature.label}' is not available yet`);
      if (!actor.isSuperAdmin && !actor.features.has(feature.key)) {
        throw new BadRequestException(`'${feature.label}' is not enabled for your company`);
      }
      let effective: AccessScope | null = null;
      if (perm.scopes.length) {
        if (via) {
          // Dependency: same scope if supported, else the broadest supported one not wider than the parent's
          const cap = scope ? SCOPE_ORDER.indexOf(scope) : SCOPE_ORDER.length - 1;
          effective = perm.scopes.includes(scope as AccessScope)
            ? (scope as AccessScope)
            : ([...perm.scopes].reverse().find((s) => SCOPE_ORDER.indexOf(s) <= cap) ?? perm.scopes[0]!);
        } else {
          if (!scope) throw new BadRequestException(`Choose a scope for '${perm.label}' (${perm.scopes.join(', ')})`);
          if (!perm.scopes.includes(scope)) throw new BadRequestException(`'${perm.label}' can't be scoped to '${scope}'`);
          effective = scope;
        }
      } else if (scope && !via) {
        throw new BadRequestException(`'${perm.label}' doesn't take a scope`);
      }
      grants.set(key, grants.has(key) ? broader(grants.get(key)!, effective) : effective);
      for (const required of perm.requires ?? []) add(required, effective, key);
    };
    for (const g of input) add(g.key, g.scope ?? null);
    return grants;
  }

  /** Non-owners may only hand out what they hold themselves, at most at their scope. */
  assertNoEscalation(actor: AccessContext, grants: Grants): void {
    if (actor.isOwner || actor.isSuperAdmin) return;
    const beyond = [...grants.entries()].filter(([key, scope]) => {
      if (!actor.grants.has(key)) return true;
      const mine = actor.grants.get(key) ?? null;
      return scope !== null && mine !== null && SCOPE_ORDER.indexOf(scope) > SCOPE_ORDER.indexOf(mine);
    });
    if (beyond.length) {
      throw new ForbiddenException(
        `You can't grant permissions beyond your own: ${beyond.map(([k, s]) => (s ? `${k} (${s})` : k)).join(', ')}`,
      );
    }
  }

  private assertEditable(role: { isOwner: boolean }) {
    if (role.isOwner) throw new BadRequestException('The Company Admin role has every permission and cannot be edited');
  }

  private async findRole(companyId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, companyId }, select: ROLE_LIST_SELECT });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private async assertNameFree(companyId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.role.findFirst({
      where: { companyId, name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId && { NOT: { id: exceptId } }) },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`A role named '${name.trim()}' already exists`);
  }

  private async copyName(companyId: string, name: string) {
    for (let i = 1; ; i++) {
      const candidate = i === 1 ? `${name} (copy)` : `${name} (copy ${i})`;
      const clash = await this.prisma.role.count({ where: { companyId, name: candidate } });
      if (!clash) return candidate;
    }
  }

  private async rows(grants: Grants) {
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: [...grants.keys()] } },
      select: { id: true, key: true },
    });
    const idOf = new Map(permissions.map((p) => [p.key, p.id]));
    return [...grants.entries()].map(([key, scope]) => ({ permissionId: idOf.get(key)!, scope }));
  }
}
