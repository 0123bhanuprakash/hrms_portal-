import { InternalServerErrorException } from '@nestjs/common';
import type { Prisma, PrismaClient, Role } from '@prisma/client';
import type { DefaultRole } from '@hrms/types';

// ============================================================
// System roles are created once by prisma/seed.ts (companyId = null,
// isSystemRole = true) and carry the default permission sets.
//
// Always assign these — never create an ad-hoc role with the same
// purpose, because a new role would have no permissions.
// ============================================================

/** Seeded role names, type-checked against DefaultRole (type-only import). */
export type SystemRoleName = `${DefaultRole}`;

export async function getSystemRole(
  db: PrismaClient | Prisma.TransactionClient,
  name: SystemRoleName,
): Promise<Role> {
  const role = await db.role.findFirst({
    where: { name, isSystemRole: true, companyId: null },
  });

  if (!role) {
    throw new InternalServerErrorException(
      `System role '${name}' is missing. Run "pnpm db:seed" to create default roles.`,
    );
  }

  return role;
}
