import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserStatus } from '@prisma/client';
import type { AccessScope } from '@hrms/types';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProducerService } from '../email/email.producer.service';
import { AuthService } from '../auth/auth.service';
import { CompanyRolesService } from '../access/company-roles.service';
import type { AccessContext } from '../access/access.types';
import { generateTemporaryPassword, hashPassword } from '../auth/password.util';
import { RolesService } from './roles.service';
import { EmployeesService } from '../employees/employees.service';
import type { BulkUsersDto, InviteUserDto, QueryCompanyUsersDto, UpdateCompanyUserDto } from './dto';
import { broader, PERMISSION_BY_KEY, SCOPE_ORDER } from '../access/catalog';

const DAY = 86_400_000;
/** Permissions that let someone see other people's private data (salary, bank, IDs, payslips). */
const PRIVATE_DATA = ['salary.view', 'employee.view_private', 'payslip.view'];
import { wordsWhere } from '../../common/word-search';
import { RealtimeService } from '../realtime/realtime.service';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  status: true,
  lastLoginAt: true,
  mustChangePassword: true,
  createdAt: true,
  userRoles: {
    select: { assignedAt: true, role: { select: { id: true, key: true, name: true, isOwner: true, status: true } } },
    orderBy: { assignedAt: 'asc' },
  },
  employee: {
    select: {
      id: true,
      employeeId: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/**
 * Company Admin → Users. Everything is scoped to the caller's company;
 * guardrails: nobody changes their own roles/status, every company keeps
 * ≥ 1 active Company Admin, and roles can only be handed out by someone
 * who holds all of their permissions (or by a Company Admin).
 */
@Injectable()
export class CompanyUsersService {
  private readonly logger = new Logger(CompanyUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailProducerService,
    private readonly auth: AuthService,
    private readonly companyRoles: CompanyRolesService,
    private readonly roles: RolesService,
    private readonly employees: EmployeesService,
    private readonly realtime: RealtimeService,
  ) {}

  // ─── Read ─────────────────────────────────────────────────

  async list(companyId: string, query: QueryCompanyUsersDto, actor: AccessContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const and: Prisma.UserWhereInput[] = [{ companyId }];
    // Every word must match a field: "priya sharma" finds Priya Sharma
    const search = wordsWhere(query.search, (w): Prisma.UserWhereInput[] => [
      { firstName: { contains: w, mode: 'insensitive' as const } },
      { lastName: { contains: w, mode: 'insensitive' as const } },
      { email: { contains: w, mode: 'insensitive' as const } },
    ]);
    if (search) and.push(search);
    if (query.roleId) and.push({ userRoles: { some: { roleId: query.roleId } } });
    if (query.status === 'INVITED') and.push({ status: UserStatus.ACTIVE, lastLoginAt: null });
    else if (query.status) and.push({ status: query.status });

    const where: Prisma.UserWhereInput = { AND: and };
    const [rows, total, counts] = await Promise.all([
      this.prisma.user.findMany({ where, select: USER_SELECT, orderBy: [{ createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['status'], where: { companyId }, _count: true }),
    ]);
    const invited = await this.prisma.user.count({ where: { companyId, status: UserStatus.ACTIVE, lastLoginAt: null } });

    return {
      data: rows.map((u) => this.present(u, actor)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        counts: {
          all: counts.reduce((n, c) => n + c._count, 0),
          active: counts.find((c) => c.status === UserStatus.ACTIVE)?._count ?? 0,
          inactive: counts.filter((c) => c.status !== UserStatus.ACTIVE).reduce((n, c) => n + c._count, 0),
          invited,
        },
      },
    };
  }

  async get(companyId: string, id: string, actor: AccessContext) {
    const user = await this.find(companyId, id);
    const sessions = await this.prisma.refreshToken.count({ where: { userId: id, isRevoked: false, expiresAt: { gt: new Date() } } });
    return { ...this.present(user, actor), activeSessions: sessions };
  }

  /** "Needs a look" on Users: old invites, unused access, who can see private data. */
  async insights(companyId: string) {
    const now = Date.now();
    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                key: true,
                name: true,
                isOwner: true,
                status: true,
                rolePermissions: { where: { permission: { key: { in: PRIVATE_DATA } } }, select: { scope: true } },
              },
            },
          },
        },
      },
    });
    const active = users.filter((u) => u.status === UserStatus.ACTIVE);
    const name = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
    const invited = active.filter((u) => !u.lastLoginAt);
    const oldInvites = invited
      .map((u) => ({ id: u.id, name: name(u), days: Math.floor((now - u.createdAt.getTime()) / DAY) }))
      .filter((u) => u.days >= 7)
      .sort((a, b) => b.days - a.days);
    // Has more than self-service, but hasn't signed in for 30+ days
    const dormant = active
      .filter((u) => u.lastLoginAt && now - u.lastLoginAt.getTime() >= 30 * DAY)
      .filter((u) => u.userRoles.some((ur) => ur.role.status === 'ACTIVE' && ur.role.key !== 'employee'))
      .map((u) => ({
        id: u.id,
        name: name(u),
        days: Math.floor((now - u.lastLoginAt!.getTime()) / DAY),
        roles: u.userRoles.filter((ur) => ur.role.key !== 'employee').map((ur) => ur.role.name),
      }))
      .sort((a, b) => b.days - a.days);
    const privateRoles = new Set<string>();
    const privatePeople = active.filter((u) => {
      const roles = u.userRoles.filter(
        (ur) => ur.role.status === 'ACTIVE' && (ur.role.isOwner || ur.role.rolePermissions.some((rp) => rp.scope && rp.scope !== 'own')),
      );
      roles.forEach((ur) => privateRoles.add(ur.role.name));
      return roles.length > 0;
    });
    return {
      counts: {
        active: active.length,
        activeThisMonth: active.filter((u) => u.lastLoginAt && now - u.lastLoginAt.getTime() < 30 * DAY).length,
        invited: invited.length,
        oldInvites: oldInvites.length,
        inactive: users.length - active.length,
        admins: active.filter((u) => u.userRoles.some((ur) => ur.role.isOwner)).length,
      },
      oldInvites: oldInvites.slice(0, 10),
      dormant: dormant.slice(0, 10),
      dormantCount: dormant.length,
      privateData: { people: privatePeople.length, roles: [...privateRoles] },
    };
  }

  /** What changes for this person if their roles become `roleIds` (shown before saving). */
  async previewRoles(companyId: string, id: string, roleIds: string[]) {
    const user = await this.find(companyId, id);
    const merged = async (ids: string[]) => {
      const roles = await this.prisma.role.findMany({
        where: { id: { in: ids }, companyId, status: 'ACTIVE' },
        select: { isOwner: true, rolePermissions: { select: { scope: true, permission: { select: { key: true } } } } },
      });
      const grants = new Map<string, AccessScope | null>();
      for (const r of roles) {
        for (const rp of r.rolePermissions) {
          const k = rp.permission.key;
          const s = rp.scope as AccessScope | null;
          grants.set(k, grants.has(k) ? broader(grants.get(k)!, s) : s);
        }
      }
      return { owner: roles.some((r) => r.isOwner), grants };
    };
    const [before, after] = await Promise.all([merged(user.userRoles.map((ur) => ur.role.id)), merged(roleIds)]);
    const info = (key: string, scope: AccessScope | null) => {
      const p = PERMISSION_BY_KEY.get(key);
      return { key, label: p?.label ?? key, sensitive: Boolean(p?.sensitive), scope };
    };
    const known = ([k]: [string, AccessScope | null]) => PERMISSION_BY_KEY.has(k);
    const added = [...after.grants].filter(known).filter(([k]) => !before.grants.has(k)).map(([k, s]) => info(k, s));
    const removed = [...before.grants].filter(known).filter(([k]) => !after.grants.has(k)).map(([k, s]) => info(k, s));
    const widened: Array<ReturnType<typeof info> & { from: AccessScope }> = [];
    const narrowed: Array<ReturnType<typeof info> & { from: AccessScope }> = [];
    for (const [k, s] of after.grants) {
      const was = before.grants.get(k);
      if (!was || !s || s === was || !PERMISSION_BY_KEY.has(k)) continue;
      (SCOPE_ORDER.indexOf(s) > SCOPE_ORDER.indexOf(was) ? widened : narrowed).push({ ...info(k, s), from: was });
    }
    return {
      becomesOwner: after.owner && !before.owner,
      losesOwner: before.owner && !after.owner,
      added,
      removed,
      widened,
      narrowed,
      sensitiveAdded: added.filter((a) => a.sensitive).length + widened.filter((w) => w.sensitive).length,
      permissionCount: { before: before.grants.size, after: after.grants.size },
    };
  }

  /** Account history: invites, role changes, status changes, resets — newest first. */
  async history(companyId: string, id: string) {
    await this.find(companyId, id);
    const rows = await this.prisma.auditLog.findMany({
      where: { companyId, resourceType: 'user', resourceId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, action: true, createdAt: true, afterState: true, user: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((r) => {
      const after = (r.afterState ?? {}) as { changes?: { added?: string[]; removed?: string[] }; status?: string };
      return {
        id: r.id,
        action: r.action,
        at: r.createdAt,
        by: r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : null,
        added: after.changes?.added ?? [],
        removed: after.changes?.removed ?? [],
        status: r.action === 'user:status:update' ? (after.status ?? null) : null,
      };
    });
  }

  // ─── Write ────────────────────────────────────────────────

  /** Same action for many people; each one is checked on its own and failures are reported, not thrown. */
  async bulk(companyId: string, actor: AccessContext, dto: BulkUsersDto) {
    const need = (key: string) => {
      if (!actor.isOwner && !actor.isSuperAdmin && !actor.grants.has(key)) {
        throw new ForbiddenException(`You do not have permission for this. Required: ${key}`);
      }
    };
    if (dto.action === 'add_role' || dto.action === 'remove_role') {
      need('user.assign_roles');
      if (!dto.roleId) throw new BadRequestException('Choose a role');
    }
    if (dto.action === 'resend_invite') need('user.invite');
    if (dto.action === 'deactivate' || dto.action === 'activate') need('user.deactivate');

    const done: string[] = [];
    const failed: Array<{ id: string; name: string; error: string }> = [];
    for (const id of [...new Set(dto.ids)]) {
      let name = '';
      try {
        const u = await this.find(companyId, id);
        name = `${u.firstName} ${u.lastName}`.trim();
        const current = u.userRoles.map((ur) => ur.role.id);
        if (dto.action === 'add_role') {
          if (!current.includes(dto.roleId!)) await this.setRoles(companyId, id, actor, [...current, dto.roleId!]);
        } else if (dto.action === 'remove_role') {
          if (current.includes(dto.roleId!)) {
            const rest = current.filter((r) => r !== dto.roleId);
            if (!rest.length) throw new BadRequestException('This is their only role');
            await this.setRoles(companyId, id, actor, rest);
          }
        } else if (dto.action === 'resend_invite') {
          await this.resendInvite(companyId, id, actor);
        } else {
          await this.setStatus(companyId, id, actor, dto.action === 'deactivate' ? 'INACTIVE' : 'ACTIVE');
        }
        done.push(id);
      } catch (err) {
        failed.push({ id, name, error: (err as Error).message });
      }
    }
    return { done: done.length, failed };
  }

  /** Paste many emails: each gets the Employee role (or the roles given) and a basic employee profile. */
  async inviteMany(companyId: string, actor: AccessContext, emails: string[], roleIds?: string[]) {
    const results: Array<{ email: string; ok: boolean; id?: string; emailSent?: boolean; error?: string }> = [];
    const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
    for (const raw of [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))]) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        results.push({ email: raw, ok: false, error: 'Not an email address' });
        continue;
      }
      const local = raw.split('@')[0]!;
      const words = local.split(/[._-]+/).map((w) => w.replace(/\d+/g, '')).filter(Boolean);
      try {
        const r = await this.invite(companyId, actor, {
          email: raw,
          firstName: cap(words[0] ?? local),
          lastName: words.slice(1).map(cap).join(' '),
          ...(roleIds?.length ? { roleIds } : {}),
        });
        results.push({ email: raw, ok: true, id: r.id, emailSent: r.emailSent });
      } catch (err) {
        results.push({ email: raw, ok: false, error: (err as Error).message });
      }
    }
    return { invited: results.filter((r) => r.ok).length, results };
  }

  async invite(companyId: string, actor: AccessContext, dto: InviteUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException(`A user with the email '${email}' already exists`);
    }

    const defaultRoleId = await this.companyRoles.roleId(this.prisma, companyId, 'employee');
    const roleIds = [...new Set(dto.roleIds?.length ? dto.roleIds : [defaultRoleId])];
    const onlyDefault = roleIds.length === 1 && roleIds[0] === defaultRoleId;
    if (!onlyDefault) this.requireAssignRoles(actor);
    await this.assertAssignable(companyId, actor, roleIds);

    // Employee profile requested: check it fully before creating anything
    if (dto.employee) {
      if (!actor.isOwner && !actor.isSuperAdmin && !actor.grants.has('employee.create')) {
        throw new ForbiddenException('You do not have permission to add employees. Required: employee.create');
      }
      await this.employees.assertProfileInput(companyId, dto.employee);
    }

    const tempPassword = generateTemporaryPassword();
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        companyId,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        userRoles: { create: roleIds.map((roleId) => ({ roleId, companyId, assignedBy: actor.userId })) },
      },
      select: USER_SELECT,
    });

    let employeeError: string | null = null;
    {
      try {
        // Everyone in a company is an employee: with the details given, or a basic profile to complete later
        if (dto.employee) await this.employees.createForUser(companyId, user.id, dto.employee);
        else await this.employees.basicProfileFor(companyId, user.id);
      } catch (err) {
        // Account exists — the profile can be added from Users → "Add employee profile"
        employeeError = (err as Error).message;
      }
    }

    const emailSent = await this.sendWelcome(companyId, user, tempPassword);
    return { ...this.present(await this.find(companyId, user.id), actor), emailSent, employeeError };
  }

  async update(companyId: string, id: string, actor: AccessContext, dto: UpdateCompanyUserDto) {
    await this.find(companyId, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName.trim() }),
        ...(dto.lastName && { lastName: dto.lastName.trim() }),
      },
      select: USER_SELECT,
    });
    return this.present(user, actor);
  }

  async setRoles(companyId: string, id: string, actor: AccessContext, roleIds: string[]) {
    if (id === actor.userId) throw new ForbiddenException("You can't change your own roles — ask another admin");
    const user = await this.find(companyId, id);
    const unique = [...new Set(roleIds)];
    await this.assertAssignable(companyId, actor, unique);

    // Also covers roles being *removed*: a non-owner can't strip roles they couldn't grant
    const removed = user.userRoles.filter((ur) => !unique.includes(ur.role.id)).map((ur) => ur.role.id);
    if (removed.length) await this.assertAssignable(companyId, actor, removed, { allowInactive: true });

    const losesOwner = user.userRoles.some((ur) => ur.role.isOwner) && !(await this.anyOwner(companyId, unique));
    if (losesOwner && user.status === UserStatus.ACTIVE) await this.assertAnotherActiveOwner(companyId, id);

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id, roleId: { notIn: unique } } }),
      ...unique.map((roleId) =>
        this.prisma.userRole.upsert({
          where: { userId_roleId: { userId: id, roleId } },
          update: {},
          create: { userId: id, roleId, companyId, assignedBy: actor.userId },
        }),
      ),
    ]);
    const updated = await this.find(companyId, id);
    // New role (e.g. manager) → starter kit extras for that group
    const emp = await this.prisma.employee.findFirst({ where: { userId: id, companyId }, select: { id: true } });
    if (emp && unique.some((r) => !user.userRoles.some((ur) => ur.role.id === r))) this.employees.provisionKit(companyId, emp.id, 'promotion');
    return {
      ...this.present(updated, actor),
      changes: {
        added: updated.userRoles.filter((ur) => !user.userRoles.some((o) => o.role.id === ur.role.id)).map((ur) => ur.role.name),
        removed: user.userRoles.filter((ur) => !unique.includes(ur.role.id)).map((ur) => ur.role.name),
      },
    };
  }

  async setStatus(companyId: string, id: string, actor: AccessContext, status: 'ACTIVE' | 'INACTIVE') {
    if (id === actor.userId) throw new ForbiddenException("You can't change your own status");
    const user = await this.find(companyId, id);
    if (status === UserStatus.INACTIVE && user.userRoles.some((ur) => ur.role.isOwner) && user.status === UserStatus.ACTIVE) {
      await this.assertAnotherActiveOwner(companyId, id);
    }
    // A non-owner can't deactivate someone holding roles they couldn't grant (e.g. an admin)
    await this.assertAssignable(companyId, actor, user.userRoles.map((ur) => ur.role.id), { allowInactive: true });

    const { updated, revokedSessions } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { status }, select: USER_SELECT });
      // Deactivation signs them out everywhere immediately
      const revoked =
        status === UserStatus.INACTIVE
          ? await tx.refreshToken.updateMany({ where: { userId: id, isRevoked: false }, data: { isRevoked: true } })
          : { count: 0 };
      return { updated, revokedSessions: revoked.count };
    });
    return { ...this.present(updated, actor), revokedSessions };
  }

  async resendInvite(companyId: string, id: string, actor: AccessContext) {
    const user = await this.find(companyId, id);
    if (user.lastLoginAt) throw new BadRequestException('This user has already signed in — send a password reset instead');
    if (user.status !== UserStatus.ACTIVE) throw new BadRequestException('Activate the user before re-sending the invite');
    const tempPassword = generateTemporaryPassword();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, loginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, isRevoked: false }, data: { isRevoked: true } }),
    ]);
    this.realtime.signOut(id, {}, 'password');
    const emailSent = await this.sendWelcome(companyId, user, tempPassword);
    return { ...this.present(user, actor), emailSent };
  }

  async sendPasswordReset(companyId: string, id: string) {
    const user = await this.find(companyId, id);
    if (user.status !== UserStatus.ACTIVE) throw new BadRequestException('Activate the user before sending a password reset');
    await this.auth.forgotPassword(user.email);
    return { id, email: user.email, sent: true };
  }

  // ─── Rules ────────────────────────────────────────────────

  private requireAssignRoles(actor: AccessContext) {
    if (!actor.isOwner && !actor.isSuperAdmin && !actor.grants.has('user.assign_roles')) {
      throw new ForbiddenException('You do not have permission to assign roles. Required: user.assign_roles');
    }
  }

  /** Roles exist in this company, are active, and the actor could grant every one of them. */
  private async assertAssignable(companyId: string, actor: AccessContext, roleIds: string[], opts: { allowInactive?: boolean } = {}) {
    if (!roleIds.length) return;
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, companyId },
      select: {
        id: true,
        name: true,
        isOwner: true,
        status: true,
        rolePermissions: { select: { scope: true, permission: { select: { key: true } } } },
      },
    });
    if (roles.length !== roleIds.length) throw new NotFoundException('Role not found in this company');
    for (const role of roles) {
      if (!opts.allowInactive && role.status !== 'ACTIVE') throw new BadRequestException(`The role '${role.name}' is inactive`);
      if (actor.isOwner || actor.isSuperAdmin) continue;
      if (role.isOwner) throw new ForbiddenException('Only a Company Admin can grant or remove the Company Admin role');
      this.roles.assertNoEscalation(
        actor,
        new Map(role.rolePermissions.map((rp) => [rp.permission.key, rp.scope as AccessScope | null])),
      );
    }
  }

  private async anyOwner(companyId: string, roleIds: string[]) {
    return (await this.prisma.role.count({ where: { id: { in: roleIds }, companyId, isOwner: true } })) > 0;
  }

  private async assertAnotherActiveOwner(companyId: string, exceptUserId: string) {
    const others = await this.prisma.user.count({
      where: {
        companyId,
        id: { not: exceptUserId },
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { isOwner: true, status: 'ACTIVE' } } },
      },
    });
    if (!others) throw new BadRequestException('Every company needs at least one active Company Admin. Make someone else an admin first.');
  }

  private async find(companyId: string, id: string): Promise<UserRow> {
    const user = await this.prisma.user.findFirst({ where: { id, companyId }, select: USER_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private present(u: UserRow, actor: AccessContext) {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      invited: u.status === UserStatus.ACTIVE && !u.lastLoginAt,
      mustChangePassword: u.mustChangePassword,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      isSelf: u.id === actor.userId,
      isAdmin: u.userRoles.some((ur) => ur.role.isOwner),
      roles: u.userRoles.map((ur) => ur.role),
      employee: u.employee,
    };
  }

  private async sendWelcome(companyId: string, user: { email: string; firstName: string }, temporaryPassword: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true, slug: true } });
    try {
      await this.email.queueWelcomeEmployee({
        to: user.email,
        email: user.email,
        firstName: user.firstName,
        companyName: company?.name ?? 'HRMS',
        loginUrl: `${this.config.get<string>('webUrl')}/login?company=${company?.slug ?? ''}`,
        temporaryPassword,
      });
      return true;
    } catch (err) {
      this.logger.error(`Invite email to ${user.email} failed: ${(err as Error).message}`);
      return false;
    }
  }
}
