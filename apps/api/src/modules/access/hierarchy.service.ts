import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Layer 3 support — keeps the closure tables in sync with reporting lines
 * and the department tree, so "everyone below X" is one indexed lookup.
 *
 *   employee_hierarchy(ancestor, descendant, depth)   depth 0 = self
 *   department_hierarchy(ancestor, descendant, depth)
 *
 * Every change bumps companies.hierarchy_version, which refreshes cached
 * access on the next request.
 */
@Injectable()
export class HierarchyService {
  private readonly logger = new Logger(HierarchyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Employees ────────────────────────────────────────────

  /** Rebuild a company's reporting closure from employees.reporting_manager_id. */
  async rebuildEmployees(companyId: string, db: Db = this.prisma): Promise<number> {
    const employees = await db.employee.findMany({
      where: { companyId },
      select: { id: true, reportingManagerId: true },
    });
    const managerOf = new Map(employees.map((e) => [e.id, e.reportingManagerId]));

    const rows: Prisma.EmployeeHierarchyCreateManyInput[] = [];
    for (const e of employees) {
      // Walk up the chain; a corrupt loop in old data is cut where it repeats
      const seen = new Set<string>([e.id]);
      rows.push({ companyId, ancestorId: e.id, descendantId: e.id, depth: 0 });
      let current = managerOf.get(e.id) ?? null;
      let depth = 1;
      while (current && managerOf.has(current) && !seen.has(current)) {
        rows.push({ companyId, ancestorId: current, descendantId: e.id, depth });
        seen.add(current);
        current = managerOf.get(current) ?? null;
        depth++;
      }
      if (current && seen.has(current)) this.logger.warn(`Reporting loop at employee ${e.id} (company ${companyId}) — cut`);
    }

    await db.employeeHierarchy.deleteMany({ where: { companyId } });
    if (rows.length) await db.employeeHierarchy.createMany({ data: rows });
    await this.bump(companyId, db);
    return rows.length;
  }

  /** A newly created employee: self row + all of the manager's ancestors. */
  async addEmployee(db: Db, companyId: string, employeeId: string, managerId: string | null): Promise<void> {
    await db.employeeHierarchy.create({ data: { companyId, ancestorId: employeeId, descendantId: employeeId, depth: 0 } });
    if (managerId) {
      await this.assertSameCompany(db, companyId, managerId);
      await db.$executeRaw`
        INSERT INTO employee_hierarchy (company_id, ancestor_id, descendant_id, depth)
        SELECT company_id, ancestor_id, ${employeeId}::uuid, depth + 1
        FROM employee_hierarchy WHERE descendant_id = ${managerId}::uuid`;
    }
    await this.bump(companyId, db);
  }

  /**
   * Move an employee (with everyone under them) to a new manager.
   * Rejects moves that would create a reporting loop.
   */
  async setManager(db: Db, companyId: string, employeeId: string, managerId: string | null): Promise<void> {
    if (managerId) {
      if (managerId === employeeId) throw new BadRequestException('An employee cannot report to themselves');
      await this.assertSameCompany(db, companyId, managerId);
      const loop = await db.employeeHierarchy.findUnique({
        where: { ancestorId_descendantId: { ancestorId: employeeId, descendantId: managerId } },
      });
      if (loop) {
        throw new BadRequestException('That would create a reporting loop: the new manager reports (directly or indirectly) to this employee');
      }
    }

    // Detach the subtree from its old ancestors…
    await db.$executeRaw`
      DELETE FROM employee_hierarchy
      WHERE descendant_id IN (SELECT descendant_id FROM employee_hierarchy WHERE ancestor_id = ${employeeId}::uuid)
        AND ancestor_id IN (SELECT ancestor_id FROM employee_hierarchy WHERE descendant_id = ${employeeId}::uuid AND ancestor_id <> ${employeeId}::uuid)`;

    // …and attach it under the new manager's chain
    if (managerId) {
      await db.$executeRaw`
        INSERT INTO employee_hierarchy (company_id, ancestor_id, descendant_id, depth)
        SELECT a.company_id, a.ancestor_id, d.descendant_id, a.depth + d.depth + 1
        FROM employee_hierarchy a
        CROSS JOIN employee_hierarchy d
        WHERE a.descendant_id = ${managerId}::uuid AND d.ancestor_id = ${employeeId}::uuid`;
    }
    await this.bump(companyId, db);
  }

  private async assertSameCompany(db: Db, companyId: string, employeeId: string) {
    const found = await db.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } });
    if (!found) throw new NotFoundException('Reporting manager not found in this company');
  }

  // ─── Departments ──────────────────────────────────────────

  /** Departments are few — rebuild the company's tree on any change. */
  async rebuildDepartments(companyId: string, db: Db = this.prisma): Promise<number> {
    const departments = await db.department.findMany({
      where: { companyId },
      select: { id: true, parentDepartmentId: true },
    });
    const parentOf = new Map(departments.map((d) => [d.id, d.parentDepartmentId]));

    const rows: Prisma.DepartmentHierarchyCreateManyInput[] = [];
    for (const d of departments) {
      const seen = new Set<string>([d.id]);
      rows.push({ companyId, ancestorId: d.id, descendantId: d.id, depth: 0 });
      let current = parentOf.get(d.id) ?? null;
      let depth = 1;
      while (current && parentOf.has(current) && !seen.has(current)) {
        rows.push({ companyId, ancestorId: current, descendantId: d.id, depth });
        seen.add(current);
        current = parentOf.get(current) ?? null;
        depth++;
      }
    }

    await db.departmentHierarchy.deleteMany({ where: { companyId } });
    if (rows.length) await db.departmentHierarchy.createMany({ data: rows });
    await this.bump(companyId, db);
    return rows.length;
  }

  /** Would making `parentId` the parent of `departmentId` create a loop? */
  async assertNoDepartmentLoop(db: Db, departmentId: string, parentId: string | null): Promise<void> {
    if (!parentId) return;
    if (parentId === departmentId) throw new BadRequestException('A department cannot be its own parent');
    const loop = await db.departmentHierarchy.findUnique({
      where: { ancestorId_descendantId: { ancestorId: departmentId, descendantId: parentId } },
    });
    if (loop) throw new BadRequestException('That would create a loop: the new parent is inside this department');
  }

  private async bump(companyId: string, db: Db) {
    await db.company.update({ where: { id: companyId }, data: { hierarchyVersion: { increment: 1 } } });
  }
}
