import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EmploymentStatus, EmploymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../access/entitlement.service';
import { EmployeesService } from './employees.service';
import type { ImportRowDto } from './dto/import-employees.dto';

type Status = 'ok' | 'warning' | 'error';

export interface PreviewRow {
  row: number; // 1-based, as in the spreadsheet (excluding the header)
  status: Status;
  messages: string[];
  name: string;
  email: string;
  resolved: {
    departmentId: string | null;
    designationId: string | null;
    locationId: string | null;
    /** Existing employee id, or the row number of a manager in this file */
    manager: { existing: string } | { row: number } | null;
    joiningDate: string | null;
    employmentType: EmploymentType;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bulk employee import: preview (row-by-row validation, nothing written)
 * then import (valid rows only, managers before their reports).
 */
@Injectable()
export class EmployeeImportService {
  private readonly logger = new Logger(EmployeeImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly entitlements: EntitlementService,
  ) {}

  async preview(companyId: string, rows: ImportRowDto[]) {
    const [departments, designations, locations, existingEmployees, company] = await Promise.all([
      this.prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, code: true } }),
      this.prisma.designation.findMany({ where: { companyId }, select: { id: true, name: true } }),
      this.prisma.officeLocation.findMany({ where: { companyId }, select: { id: true, name: true, isDefault: true } }),
      this.prisma.employee.findMany({ where: { companyId }, select: { id: true, email: true } }),
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { featuresVersion: true } }),
    ]);
    const norm = (v?: string) => (v ?? '').trim().toLowerCase();
    const deptBy = new Map<string, string>();
    departments.forEach((d) => {
      deptBy.set(norm(d.name), d.id);
      deptBy.set(norm(d.code), d.id);
    });
    const titleBy = new Map(designations.map((d) => [norm(d.name), d.id]));
    const locBy = new Map(locations.map((l) => [norm(l.name), l.id]));
    const defaultLocation = locations.find((l) => l.isDefault)?.id ?? null;
    const empByEmail = new Map(existingEmployees.map((e) => [norm(e.email), e.id]));

    const emails = rows.map((r) => norm(r.email));
    const takenUsers = new Set(
      (await this.prisma.user.findMany({ where: { email: { in: emails.filter(Boolean) } }, select: { email: true } })).map((u) => norm(u.email)),
    );
    const rowByEmail = new Map<string, number>();
    emails.forEach((e, i) => e && !rowByEmail.has(e) && rowByEmail.set(e, i + 1));

    const preview: PreviewRow[] = rows.map((r, i) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const email = norm(r.email);
      if (!r.firstName?.trim()) errors.push('First name is missing');
      if (!r.lastName?.trim()) errors.push('Last name is missing');
      if (!email) errors.push('Email is missing');
      else if (!EMAIL_RE.test(email)) errors.push(`'${r.email}' isn't a valid email`);
      else if (rowByEmail.get(email) !== i + 1) errors.push(`Duplicate of row ${rowByEmail.get(email)}`);
      else if (takenUsers.has(email)) errors.push('Someone with this email already exists');

      const joiningDate = parseDate(r.joiningDate);
      if (!r.joiningDate?.trim()) errors.push('Joining date is missing');
      else if (!joiningDate) errors.push(`Joining date '${r.joiningDate}' — use YYYY-MM-DD or DD/MM/YYYY`);

      const typeKey = (r.employmentType ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
      let employmentType: EmploymentType = EmploymentType.FULL_TIME;
      if (typeKey) {
        if (typeKey in EmploymentType) employmentType = typeKey as EmploymentType;
        else warnings.push(`Unknown employment type '${r.employmentType}' — using Full time`);
      }

      const lookup = (value: string | undefined, map: Map<string, string>, label: string) => {
        if (!value?.trim()) return null;
        const id = map.get(norm(value));
        if (!id) warnings.push(`${label} '${value.trim()}' not found — left empty`);
        return id ?? null;
      };
      const departmentId = lookup(r.department, deptBy, 'Department');
      const designationId = lookup(r.designation, titleBy, 'Job title');
      const locationId = r.location?.trim() ? lookup(r.location, locBy, 'Location') : defaultLocation;

      let manager: PreviewRow['resolved']['manager'] = null;
      const mgr = norm(r.managerEmail);
      if (mgr) {
        if (mgr === email) errors.push("Can't report to themselves");
        else if (empByEmail.has(mgr)) manager = { existing: empByEmail.get(mgr)! };
        else if (rowByEmail.has(mgr)) manager = { row: rowByEmail.get(mgr)! };
        else warnings.push(`Manager '${r.managerEmail}' not found — imported without a manager`);
      }

      return {
        row: i + 1,
        status: errors.length ? 'error' : warnings.length ? 'warning' : 'ok',
        messages: [...errors, ...warnings],
        name: `${r.firstName?.trim() ?? ''} ${r.lastName?.trim() ?? ''}`.trim(),
        email,
        resolved: { departmentId, designationId, locationId, manager, joiningDate, employmentType },
      };
    });

    // Managers inside the file: an error row can't be anyone's manager; loops are errors
    const byRow = new Map(preview.map((p) => [p.row, p]));
    for (const p of preview) {
      const m = p.resolved.manager;
      if (m && 'row' in m && byRow.get(m.row)?.status === 'error' && p.status !== 'error') {
        p.messages.push(`Manager (row ${m.row}) has errors — imported without a manager`);
        p.resolved.manager = null;
        p.status = 'warning';
      }
    }
    for (const p of preview) {
      const seen = new Set<number>([p.row]);
      let cur = p.resolved.manager;
      while (cur && 'row' in cur) {
        if (seen.has(cur.row)) {
          p.status = 'error';
          p.messages.unshift('Managers in the file form a loop');
          break;
        }
        seen.add(cur.row);
        cur = byRow.get(cur.row)?.resolved.manager ?? null;
      }
    }

    const importable = preview.filter((p) => p.status !== 'error').length;
    const { limits } = await this.entitlements.forCompany(companyId, company.featuresVersion);
    const current = await this.prisma.employee.count({ where: { companyId, employmentStatus: { not: EmploymentStatus.TERMINATED } } });
    const max = limits.maxEmployees ?? null;
    return {
      rows: preview,
      summary: {
        total: preview.length,
        ok: preview.filter((p) => p.status === 'ok').length,
        warnings: preview.filter((p) => p.status === 'warning').length,
        errors: preview.filter((p) => p.status === 'error').length,
        importable,
      },
      limit: { max, current, remaining: max === null ? null : Math.max(0, max - current), exceeded: max !== null && current + importable > max },
    };
  }

  async import(companyId: string, rows: ImportRowDto[], sendInvites = true) {
    const preview = await this.preview(companyId, rows);
    if (preview.limit.exceeded) {
      throw new BadRequestException(
        `This import would take the company past its plan limit of ${preview.limit.max} employees (${preview.limit.current} now, ${preview.summary.importable} to add)`,
      );
    }
    const todo = preview.rows.filter((p) => p.status !== 'error');
    const created = new Map<number, string>(); // row → employee id
    const failed: Array<{ row: number; name: string; error: string }> = [];
    const skipped = preview.rows.filter((p) => p.status === 'error').map((p) => ({ row: p.row, name: p.name, reasons: p.messages }));

    // Managers first: repeatedly take rows whose in-file manager is already created
    const pending = [...todo];
    while (pending.length) {
      const ready = pending.filter((p) => !p.resolved.manager || 'existing' in p.resolved.manager || created.has(p.resolved.manager.row));
      const batch = ready.length ? ready : pending.slice(0, 1); // manager failed → still import, without one
      for (const p of batch) {
        pending.splice(pending.indexOf(p), 1);
        const src = rows[p.row - 1]!;
        const m = p.resolved.manager;
        const reportingManagerId = m ? ('existing' in m ? m.existing : created.get(m.row) ?? null) : null;
        try {
          const e = await this.employees.create(
            companyId,
            {
              firstName: src.firstName!.trim(),
              lastName: src.lastName!.trim(),
              email: p.email,
              phone: src.phone?.trim() || undefined,
              joiningDate: p.resolved.joiningDate!,
              employmentType: p.resolved.employmentType,
              departmentId: p.resolved.departmentId ?? undefined,
              designationId: p.resolved.designationId ?? undefined,
              locationId: p.resolved.locationId ?? undefined,
              reportingManagerId: reportingManagerId ?? undefined,
            },
            { sendWelcome: sendInvites },
          );
          created.set(p.row, e.id);
        } catch (err) {
          failed.push({ row: p.row, name: p.name, error: (err as { message?: string }).message ?? 'Failed' });
        }
      }
    }
    this.logger.log(`Import for company ${companyId}: ${created.size} created, ${skipped.length} skipped, ${failed.length} failed`);
    return { created: created.size, skipped, failed, invitesSent: sendInvites };
  }
}

/** YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD (null if invalid). */
function parseDate(value?: string): string | null {
  const v = (value ?? '').trim();
  let y: number, m: number, d: number;
  let match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}
