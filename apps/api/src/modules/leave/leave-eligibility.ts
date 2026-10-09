import { EmploymentStatus, Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { PersonFacts } from './leave-rules';

type Db = PrismaService | Prisma.TransactionClient;

/** Someone leave rules and balances are worked out for. */
export type Person = PersonFacts & { employmentStatus: EmploymentStatus };

const PERSON_SELECT = {
  id: true,
  joiningDate: true,
  gender: true,
  employmentStatus: true,
  employmentType: true,
  departmentId: true,
  locationId: true,
  designationId: true,
} satisfies Prisma.EmployeeSelect;

/**
 * Loads the facts the eligibility rules look at — profile fields, the managers
 * above each person (hierarchy closure table) and current project memberships —
 * in three queries however many people are asked for.
 */
export async function loadPeople<S extends Prisma.EmployeeSelect = Record<never, never>>(
  db: Db,
  companyId: string,
  where: Prisma.EmployeeWhereInput,
  extra?: S,
): Promise<Array<Person & Prisma.EmployeeGetPayload<{ select: S }>>> {
  const rows = (await db.employee.findMany({ where: { ...where, companyId }, select: { ...PERSON_SELECT, ...(extra ?? {}) } })) as unknown as Array<Prisma.EmployeeGetPayload<{ select: typeof PERSON_SELECT }> & Prisma.EmployeeGetPayload<{ select: S }>>;
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const today = new Date();
  const [chain, members] = await Promise.all([
    db.employeeHierarchy.findMany({ where: { companyId, descendantId: { in: ids }, depth: { gt: 0 } }, select: { ancestorId: true, descendantId: true, depth: true }, orderBy: { depth: 'asc' } }),
    db.projectMember.findMany({ where: { companyId, employeeId: { in: ids }, startDate: { lte: today }, OR: [{ endDate: null }, { endDate: { gte: today } }] }, select: { employeeId: true, projectId: true } }),
  ]);
  const managers = new Map<string, string[]>();
  for (const c of chain) managers.set(c.descendantId, [...(managers.get(c.descendantId) ?? []), c.ancestorId]);
  const projects = new Map<string, string[]>();
  for (const m of members) projects.set(m.employeeId, [...(projects.get(m.employeeId) ?? []), m.projectId]);
  return rows.map((r) => ({ ...r, managerChain: managers.get(r.id) ?? [], projectIds: projects.get(r.id) ?? [] }));
}

export interface GrantRow {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  days: number;
  validFrom: string;
  validTo: string;
  /** Days on pending + approved leave against it */
  taken: number;
  /** Days on approved leave only */
  used: number;
}

/** Active grants with what is already taken from each (leave that is pending or approved). */
export async function activeGrants(db: Db, companyId: string, where: { employeeId?: string; leaveTypeId?: string; ids?: string[] }): Promise<GrantRow[]> {
  const grants = await db.leaveGrant.findMany({
    where: { companyId, status: 'ACTIVE', employeeId: where.employeeId, leaveTypeId: where.leaveTypeId, ...(where.ids && { id: { in: where.ids } }) },
    select: { id: true, employeeId: true, leaveTypeId: true, days: true, validFrom: true, validTo: true },
    orderBy: { validFrom: 'asc' },
  });
  if (!grants.length) return [];
  const sums = await db.leaveRequest.groupBy({
    by: ['leaveGrantId', 'status'],
    where: { leaveGrantId: { in: grants.map((g) => g.id) }, status: { in: ['PENDING', 'APPROVED'] } },
    _sum: { totalDays: true },
  });
  const taken = new Map<string, { taken: number; used: number }>();
  for (const s of sums) {
    const t = taken.get(s.leaveGrantId!) ?? { taken: 0, used: 0 };
    t.taken += s._sum.totalDays ?? 0;
    if (s.status === 'APPROVED') t.used += s._sum.totalDays ?? 0;
    taken.set(s.leaveGrantId!, t);
  }
  const key = (d: Date) => d.toISOString().slice(0, 10);
  return grants.map((g) => ({ ...g, validFrom: key(g.validFrom), validTo: key(g.validTo), taken: taken.get(g.id)?.taken ?? 0, used: taken.get(g.id)?.used ?? 0 }));
}
