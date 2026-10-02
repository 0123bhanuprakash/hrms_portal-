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
import type { InviteUserDto, QueryCompanyUsersDto, UpdateCompanyUserDto } from './dto';

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
  ) {}

  // ─── Read ─────────────────────────────────────────────────

  async list(companyId: string, query: QueryCompanyUsersDto, actor: AccessContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const and: Prisma.UserWhereInput[] = [{ companyId }];
    if (query.search?.trim()) {
      const q = query.search.trim();
      and.push({
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
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

  // ─── Write ────────────────────────────────────────────────

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

    const emailSent = await this.sendWelcome(companyId, user, tempPassword);
    return { ...this.present(user, actor), emailSent };
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
