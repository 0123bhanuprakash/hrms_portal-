import { RoleStatus, UserStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/** Permission of the people who look after everyone reporting to the PMO. */
export const PMO_LEAD = 'project.pmo_lead';

/**
 * Active users holding "Lead the PMO pool" — they approve leave, attendance
 * corrections and timesheets for people who report to the PMO instead of a
 * person. Empty → those approvals fall back to HR, as for anyone with no manager.
 */
export async function pmoLeadUserIds(prisma: PrismaService, companyId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      companyId,
      status: UserStatus.ACTIVE,
      userRoles: { some: { role: { status: RoleStatus.ACTIVE, rolePermissions: { some: { permission: { key: PMO_LEAD } } } } } },
    },
    select: { id: true },
    take: 25,
  });
  return users.map((u) => u.id);
}

/** Does this person report to the PMO (no manager of their own)? */
export async function reportsToPmo(prisma: PrismaService, employeeId: string): Promise<boolean> {
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { reportsToPmo: true, reportingManagerId: true } });
  return Boolean(e?.reportsToPmo && !e.reportingManagerId);
}
