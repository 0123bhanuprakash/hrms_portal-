// Shared helpers for the end-to-end suites (plain Node, run from apps/api).
// The API under test is started by run.js on E2E_API (default :4001) with
// console email and reminders off, so nothing leaves the machine.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const prisma = new PrismaClient();

function suite(name) {
  const results = [];
  return {
    results,
    check(label, ok, extra = '') {
      results.push(Boolean(ok));
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && extra !== '' ? '  — ' + extra : ''}`);
    },
    done() {
      const passed = results.filter(Boolean).length;
      console.log(`\n${name}: ${passed}/${results.length} passed`);
      return passed === results.length;
    },
  };
}

async function call(h, method, url, body) {
  const r = await fetch(B + url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
}

async function upload(h, url, fields, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  if (file) form.append('file', new Blob([file.buf], { type: file.type }), file.name);
  const r = await fetch(B + url, { method: 'POST', headers: { authorization: h.authorization }, body: form });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
}

const wait = (ms = 1000) => new Promise((r) => setTimeout(r, ms));

async function login(email, password) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (r.status === 429) {
      await wait(15000);
      continue;
    }
    const j = await r.json();
    if (!j.data?.access_token) throw new Error(`login failed for ${email}: ${JSON.stringify(j)}`);
    return { authorization: 'Bearer ' + j.data.access_token, 'content-type': 'application/json' };
  }
  throw new Error('login throttled');
}

/**
 * A throwaway company on the Enterprise plan with copies of the role templates.
 * people: [[name, roleKeys[], managerName?]] — email <name>@<slug>.test
 */
async function makeCompany(slug, people, { password = 'E2E-Test-2026!', timezone = 'Asia/Kolkata' } = {}) {
  const enterprise = await prisma.plan.findUniqueOrThrow({ where: { key: 'enterprise' }, include: { features: true } });
  const company = await prisma.company.create({ data: { name: slug, slug, email: `x@${slug}.test`, planId: enterprise.id, settings: { create: { timezone } } } });
  const templates = await prisma.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
  const roles = {};
  for (const t of templates) {
    roles[t.key] = (await prisma.role.create({
      data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } },
    })).id;
  }
  const hash = await bcrypt.hash(password, 10);
  const P = {};
  for (const [name, keys, manager] of people) {
    const u = await prisma.user.create({
      data: {
        email: `${name}@${slug}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(),
        userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) },
      },
    });
    const e = await prisma.employee.create({
      data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), reportingManagerId: manager ? P[manager].id : null },
    });
    P[name] = { ...e, user: u };
  }
  // Closure table for the reporting lines
  const rows = [];
  for (const e of Object.values(P)) {
    rows.push({ companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 });
    let cur = e.reportingManagerId;
    let depth = 1;
    while (cur) {
      rows.push({ companyId: company.id, ancestorId: cur, descendantId: e.id, depth: depth++ });
      cur = Object.values(P).find((x) => x.id === cur)?.reportingManagerId ?? null;
    }
  }
  await prisma.employeeHierarchy.createMany({ data: rows });
  const sessions = {};
  for (const name of Object.keys(P)) sessions[name] = await login(P[name].email, password);
  return { company, roles, people: P, sessions };
}

/** Removes a test company and everything it owns. */
async function dropCompany(slug) {
  const c = await prisma.company.findUnique({ where: { slug } });
  if (!c) return;
  const ids = (await prisma.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  const id = c.id;
  const steps = [
    () => prisma.notification.deleteMany({ where: { userId: { in: ids } } }),
    () => prisma.expenseClaim.deleteMany({ where: { companyId: id } }),
    () => prisma.expenseCategory.deleteMany({ where: { companyId: id } }),
    () => prisma.kudos.deleteMany({ where: { companyId: id } }),
    () => prisma.announcement.deleteMany({ where: { companyId: id } }),
    () => prisma.timesheetEntry.deleteMany({ where: { companyId: id } }),
    () => prisma.timesheet.deleteMany({ where: { companyId: id } }),
    () => prisma.ticketMessage.deleteMany({ where: { companyId: id } }),
    () => prisma.ticket.deleteMany({ where: { companyId: id } }),
    () => prisma.ticketCategory.deleteMany({ where: { companyId: id } }),
    () => prisma.assetRequest.deleteMany({ where: { companyId: id } }),
    () => prisma.assetAssignment.deleteMany({ where: { companyId: id } }),
    () => prisma.asset.deleteMany({ where: { companyId: id } }),
    () => prisma.assetType.deleteMany({ where: { companyId: id } }),
    () => prisma.projectMember.deleteMany({ where: { companyId: id } }),
    () => prisma.project.deleteMany({ where: { companyId: id } }),
    () => prisma.approvalDelegation.deleteMany({ where: { companyId: id } }),
    () => prisma.attendanceRecord.deleteMany({ where: { companyId: id } }),
    () => prisma.leaveRequest.deleteMany({ where: { companyId: id } }),
    () => prisma.leaveBalance.deleteMany({ where: { companyId: id } }),
    () => prisma.leaveType.deleteMany({ where: { companyId: id } }),
    () => prisma.publicHoliday.deleteMany({ where: { companyId: id } }),
    () => prisma.employeeHierarchy.deleteMany({ where: { companyId: id } }),
    () => prisma.employee.updateMany({ where: { companyId: id }, data: { reportingManagerId: null } }),
    () => prisma.employee.deleteMany({ where: { companyId: id } }),
    () => prisma.departmentHierarchy.deleteMany({ where: { companyId: id } }),
    () => prisma.department.deleteMany({ where: { companyId: id } }),
    () => prisma.officeLocation.deleteMany({ where: { companyId: id } }),
    () => prisma.designation.deleteMany({ where: { companyId: id } }),
    () => prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } }),
    () => prisma.auditLog.deleteMany({ where: { OR: [{ companyId: id }, { userId: { in: ids } }] } }),
    () => prisma.userRole.deleteMany({ where: { userId: { in: ids } } }),
    () => prisma.user.deleteMany({ where: { id: { in: ids } } }),
    () => prisma.role.deleteMany({ where: { companyId: id } }),
    () => prisma.companySettings.deleteMany({ where: { companyId: id } }),
    () => prisma.company.delete({ where: { id } }),
  ];
  for (const s of steps) await s();
  fs.rmSync(path.resolve('private-files', id), { recursive: true, force: true });
}

/** Emails written by the console provider during a suite are removed afterwards. */
function mailSnapshot() {
  const dir = path.resolve('.mail');
  const before = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  return () => {
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (!before.has(f)) fs.rmSync(path.join(dir, f));
  };
}

const todayIn = (tz = 'Asia/Kolkata') => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
const addDays = (k, n) => {
  const d = new Date(k + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (k) => addDays(k, -((new Date(k + 'T00:00:00Z').getUTCDay() + 6) % 7));

module.exports = { B, prisma, suite, call, upload, wait, login, makeCompany, dropCompany, mailSnapshot, todayIn, addDays, mondayOf };
