/* eslint-disable */
// ============================================================
// Demo organisation for end-to-end testing (development only).
//
//   DEMO_PASSWORD='…' node prisma/seed-demo.cjs <company-slug>
//   (or: pnpm --filter @hrms/api db:seed-demo -- <company-slug>)
//
// Adds departments, org levels, job titles, locations, a custom
// "Payroll Officer" role and ~12 people with reporting lines to an
// EXISTING company, plus national holidays and the last 30 days of
// attendance (with a few late days, absences and one pending correction). Every account gets DEMO_PASSWORD and can sign in
// straight away (no temporary-password step). No emails are sent.
// Idempotent: anything that already exists (by email / name) is kept.
// ============================================================
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const slug = process.argv[2];
const password = process.env.DEMO_PASSWORD;

const DEPARTMENTS = [
  { code: 'OPS', name: 'Operations' },
  { code: 'ENG', name: 'Engineering', parent: 'OPS' },
  { code: 'HR', name: 'Human Resources', parent: 'OPS' },
  { code: 'SALES', name: 'Sales', parent: 'OPS' },
  { code: 'FIN', name: 'Finance', parent: 'OPS' },
];
const LEVELS = [
  { name: 'Executive', color: '#7C3AED' },
  { name: 'Director', color: '#2563EB' },
  { name: 'Manager', color: '#0891B2' },
  { name: 'Team Lead', color: '#059669' },
  { name: 'Member', color: '#64748B' },
];
const TITLES = [
  ['Head of Operations', 'Director'],
  ['Engineering Manager', 'Manager'],
  ['HR Manager', 'Manager'],
  ['Sales Manager', 'Manager'],
  ['Engineering Lead', 'Team Lead'],
  ['Software Engineer', 'Member'],
  ['HR Executive', 'Member'],
  ['Sales Executive', 'Member'],
  ['Finance Officer', 'Member'],
];
const LOCATIONS = [
  { name: 'Bengaluru HQ', city: 'Bengaluru', state: 'Karnataka', isDefault: true },
  { name: 'Mumbai Office', city: 'Mumbai', state: 'Maharashtra', isDefault: false },
];
// [first, last, email-local, title, dept, location, roles, manager-email-local]
const PEOPLE = [
  ['Vikram', 'Rao', 'vikram', 'Head of Operations', 'OPS', 'Bengaluru HQ', ['employee', 'manager'], null],
  ['Ravi', 'Kumar', 'ravi', 'Engineering Manager', 'ENG', 'Bengaluru HQ', ['employee', 'manager'], 'vikram'],
  ['Priya', 'Sharma', 'priya', 'Engineering Lead', 'ENG', 'Bengaluru HQ', ['employee', 'team_lead'], 'ravi'],
  ['Karan', 'Mehta', 'karan', 'Engineering Lead', 'ENG', 'Bengaluru HQ', ['employee', 'team_lead'], 'ravi'],
  ['Amit', 'Verma', 'amit', 'Software Engineer', 'ENG', 'Bengaluru HQ', ['employee'], 'priya'],
  ['Neha', 'Gupta', 'neha', 'Software Engineer', 'ENG', 'Bengaluru HQ', ['employee'], 'priya'],
  ['Sara', 'Khan', 'sara', 'Software Engineer', 'ENG', 'Bengaluru HQ', ['employee'], 'karan'],
  ['Hema', 'Iyer', 'hema', 'HR Manager', 'HR', 'Bengaluru HQ', ['employee', 'hr'], 'vikram'],
  ['Divya', 'Nair', 'divya', 'HR Executive', 'HR', 'Bengaluru HQ', ['employee'], 'hema'],
  ['Meena', 'Joshi', 'meena', 'Sales Manager', 'SALES', 'Mumbai Office', ['employee', 'manager'], 'vikram'],
  ['Rahul', 'Das', 'rahul', 'Sales Executive', 'SALES', 'Mumbai Office', ['employee'], 'meena'],
  ['Pooja', 'Reddy', 'pooja', 'Finance Officer', 'FIN', 'Bengaluru HQ', ['employee', 'payroll_officer'], 'vikram'],
];
const HEADS = { OPS: 'vikram', ENG: 'ravi', HR: 'hema', SALES: 'meena', FIN: 'pooja' };
const PAYROLL_OFFICER = {
  name: 'Payroll Officer',
  description: 'Runs payroll and sees company-wide pay data. (Demo custom role)',
  grants: [
    ['payroll.view'], ['payroll.run'], ['payroll.approve'],
    ['payslip.view', 'company'], ['salary.view', 'company'],
    ['employee.view', 'company'], ['report.view', 'company'],
  ],
};

const email = (local, domain) => `${local}.${domain}@yopmail.com`;

async function main() {
  if (!slug || !password) throw new Error('Usage: DEMO_PASSWORD=… node prisma/seed-demo.cjs <company-slug>');
  const company = await prisma.company.findUnique({ where: { slug }, include: { settings: true } });
  if (!company) throw new Error(`Company '${slug}' not found`);
  const domain = slug.split('-')[0]; // aakash-portal → ravi.aakash@yopmail.com
  const companyId = company.id;
  const created = { departments: 0, levels: 0, titles: 0, locations: 0, people: 0, holidays: 0, attendanceDays: 0, corrections: 0 };

  // Roles (the company's own copies; created by the API at start-up)
  const roles = Object.fromEntries((await prisma.role.findMany({ where: { companyId, key: { not: null } } })).map((r) => [r.key, r.id]));
  for (const key of ['employee', 'manager', 'team_lead', 'hr']) if (!roles[key]) throw new Error(`Role '${key}' missing — start the API once first`);
  let payroll = await prisma.role.findFirst({ where: { companyId, name: PAYROLL_OFFICER.name } });
  if (!payroll) {
    const perms = await prisma.permission.findMany({ where: { key: { in: PAYROLL_OFFICER.grants.map((g) => g[0]) } } });
    const id = Object.fromEntries(perms.map((p) => [p.key, p.id]));
    payroll = await prisma.role.create({
      data: {
        companyId, name: PAYROLL_OFFICER.name, description: PAYROLL_OFFICER.description,
        rolePermissions: { create: PAYROLL_OFFICER.grants.map(([k, s]) => ({ permissionId: id[k], scope: s ?? null })) },
      },
    });
  }
  roles.payroll_officer = payroll.id;

  // Departments (tree)
  const dept = {};
  for (const d of DEPARTMENTS) {
    let row = await prisma.department.findFirst({ where: { companyId, code: d.code } });
    if (!row) {
      row = await prisma.department.create({ data: { companyId, code: d.code, name: d.name, parentDepartmentId: d.parent ? dept[d.parent] : null } });
      created.departments++;
    }
    dept[d.code] = row.id;
  }

  // Org levels + titles
  const level = {};
  const existingLevels = await prisma.orgLevel.findMany({ where: { companyId } });
  let rank = existingLevels.length ? Math.min(...existingLevels.map((l) => l.rank)) - 10 : LEVELS.length * 10;
  for (const l of LEVELS) {
    let row = existingLevels.find((x) => x.name.toLowerCase() === l.name.toLowerCase());
    if (!row) {
      row = await prisma.orgLevel.create({ data: { companyId, name: l.name, color: l.color, rank: existingLevels.length ? rank : rank } });
      rank -= 10;
      created.levels++;
    }
    level[l.name] = row.id;
  }
  const title = {};
  for (const [name, lvl] of TITLES) {
    let row = await prisma.designation.findFirst({ where: { companyId, name } });
    if (!row) {
      row = await prisma.designation.create({ data: { companyId, name, orgLevelId: level[lvl] } });
      created.titles++;
    }
    title[name] = row.id;
  }

  // Locations
  const loc = {};
  for (const l of LOCATIONS) {
    let row = await prisma.officeLocation.findFirst({ where: { companyId, name: l.name } });
    if (!row) {
      const hasDefault = await prisma.officeLocation.count({ where: { companyId, isDefault: true } });
      row = await prisma.officeLocation.create({ data: { companyId, name: l.name, city: l.city, state: l.state, isDefault: l.isDefault && !hasDefault } });
      created.locations++;
    }
    loc[l.name] = row.id;
  }

  // People (managers first — PEOPLE is ordered top-down)
  const hash = await bcrypt.hash(password, 12);
  const empOf = {};
  let seq = company.settings?.employeeIdSequence ?? 0;
  const prefix = company.settings?.employeeIdPrefix ?? 'EMP';
  for (const [first, last, local, t, d, l, roleKeys, mgr] of PEOPLE) {
    const mail = email(local, domain);
    const existing = await prisma.user.findUnique({ where: { email: mail }, include: { employee: true } });
    if (existing) {
      if (existing.employee) empOf[local] = existing.employee.id;
      continue;
    }
    seq++;
    const user = await prisma.user.create({
      data: {
        email: mail, passwordHash: hash, firstName: first, lastName: last, companyId,
        status: 'ACTIVE', emailVerifiedAt: new Date(), mustChangePassword: false,
        userRoles: { create: roleKeys.map((k) => ({ roleId: roles[k], companyId })) },
      },
    });
    const emp = await prisma.employee.create({
      data: {
        companyId, userId: user.id, employeeId: `${prefix}${String(seq).padStart(3, '0')}`,
        firstName: first, lastName: last, email: mail,
        departmentId: dept[d], designationId: title[t], locationId: loc[l],
        reportingManagerId: mgr ? empOf[mgr] ?? null : null,
        joiningDate: new Date('2026-01-05'),
      },
    });
    empOf[local] = emp.id;
    created.people++;
  }
  await prisma.companySettings.update({ where: { companyId }, data: { employeeIdSequence: seq } });

  // Department heads
  for (const [code, local] of Object.entries(HEADS)) {
    if (empOf[local]) await prisma.department.update({ where: { id: dept[code] }, data: { headEmployeeId: empOf[local] } });
  }

  // Hierarchy closures (same rules as the API's HierarchyService)
  await rebuild(companyId);

  await seedTime(companyId, company.settings?.timezone || 'Asia/Kolkata', empOf, created);
  return created;
}

// ─── Attendance demo data ───────────────────────────────────

/** Fixed-date national holidays (movable festivals vary by year — add those in the app). */
const HOLIDAYS = [['01-26', 'Republic Day'], ['05-01', 'Labour Day'], ['08-15', 'Independence Day'], ['10-02', 'Gandhi Jayanti'], ['12-25', 'Christmas']];

/** Wall-clock "HH:mm" on a date in a time zone → real instant. */
function zoned(dateKey, minutes, timeZone) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const offset = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - guess;
  return new Date(guess - offset);
}
/** Stable pseudo-random 0..1 per (person, day) so re-runs look the same. */
function rand(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

async function seedTime(companyId, timeZone, empOf, created) {
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  const year = Number(todayKey.slice(0, 4));
  for (const y of [year, year + 1]) {
    for (const [md, name] of HOLIDAYS) {
      const date = new Date(`${y}-${md}T00:00:00Z`);
      const exists = await prisma.publicHoliday.findUnique({ where: { companyId_date: { companyId, date } } });
      if (!exists) { await prisma.publicHoliday.create({ data: { companyId, name, date, year: y } }); created.holidays++; }
    }
  }
  const holidayKeys = new Set((await prisma.publicHoliday.findMany({ where: { companyId }, select: { date: true } })).map((h) => h.date.toISOString().slice(0, 10)));
  const policy = await prisma.attendancePolicy.findUnique({ where: { companyId } });
  const workDays = policy?.workDays ?? [1, 2, 3, 4, 5];
  const start = (policy ? +policy.shiftStart.slice(0, 2) * 60 + +policy.shiftStart.slice(3) : 570) + (policy?.graceMinutes ?? 15);
  const full = policy?.fullDayMinutes ?? 480, half = policy?.halfDayMinutes ?? 240;

  const rows = [];
  for (const [local, employeeId] of Object.entries(empOf)) {
    for (let i = 30; i >= 1; i--) {
      const d = new Date(`${todayKey}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (!workDays.includes(d.getUTCDay()) || holidayKeys.has(key) || key < '2026-01-05') continue;
      const r = rand(local + key);
      if (r < 0.05) continue; // absent
      const inMin = 9 * 60 + Math.round(rand('in' + local + key) * (local === 'amit' ? 75 : 50)); // 09:00–10:15
      const checkIn = zoned(key, inMin, timeZone);
      const missing = local === 'neha' && i === 3;
      const worked = r < 0.1 ? 300 : 450 + Math.round(rand('out' + local + key) * 90); // a few half days
      const checkOut = missing ? null : new Date(checkIn.getTime() + worked * 60000);
      rows.push({
        companyId, employeeId, date: new Date(`${key}T00:00:00Z`), checkIn, checkOut,
        workingMinutes: checkOut ? worked : null,
        lateMinutes: Math.max(0, inMin - start) || null,
        status: !checkOut ? 'PRESENT' : worked >= full ? 'PRESENT' : worked >= half ? 'HALF_DAY' : 'ABSENT',
        checkInSource: 'WEB', checkOutSource: checkOut ? 'WEB' : null,
      });
    }
  }
  const { count } = await prisma.attendanceRecord.createMany({ data: rows, skipDuplicates: true });
  created.attendanceDays = count;

  // One pending correction for Amit (his team lead Priya approves it)
  const amit = empOf.amit;
  if (amit && !(await prisma.attendanceRegularisation.count({ where: { companyId, employeeId: amit } }))) {
    const missed = rows.filter((r) => r.employeeId === amit && r.lateMinutes).pop();
    if (missed) {
      const key = missed.date.toISOString().slice(0, 10);
      await prisma.attendanceRegularisation.create({
        data: { companyId, employeeId: amit, date: missed.date, checkIn: zoned(key, 9 * 60 + 30, timeZone), checkOut: zoned(key, 18 * 60 + 40, timeZone), reason: 'Reached on time — the office Wi-Fi was down so check-in failed' },
      });
      created.corrections++;
    }
  }
}

async function rebuild(companyId) {
  const emps = await prisma.employee.findMany({ where: { companyId }, select: { id: true, reportingManagerId: true } });
  const mgr = new Map(emps.map((e) => [e.id, e.reportingManagerId]));
  const rows = [];
  for (const e of emps) {
    rows.push({ companyId, ancestorId: e.id, descendantId: e.id, depth: 0 });
    const seen = new Set([e.id]);
    let cur = mgr.get(e.id), depth = 1;
    while (cur && !seen.has(cur)) { rows.push({ companyId, ancestorId: cur, descendantId: e.id, depth: depth++ }); seen.add(cur); cur = mgr.get(cur); }
  }
  const depts = await prisma.department.findMany({ where: { companyId }, select: { id: true, parentDepartmentId: true } });
  const parent = new Map(depts.map((d) => [d.id, d.parentDepartmentId]));
  const drows = [];
  for (const d of depts) {
    drows.push({ companyId, ancestorId: d.id, descendantId: d.id, depth: 0 });
    let cur = parent.get(d.id), depth = 1;
    while (cur) { drows.push({ companyId, ancestorId: cur, descendantId: d.id, depth: depth++ }); cur = parent.get(cur); }
  }
  await prisma.$transaction([
    prisma.employeeHierarchy.deleteMany({ where: { companyId } }),
    prisma.employeeHierarchy.createMany({ data: rows }),
    prisma.departmentHierarchy.deleteMany({ where: { companyId } }),
    prisma.departmentHierarchy.createMany({ data: drows }),
    prisma.company.update({ where: { id: companyId }, data: { hierarchyVersion: { increment: 1 } } }),
  ]);
}

main()
  .then((c) => console.log(`✅ Demo data for '${slug}':`, JSON.stringify(c)))
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
