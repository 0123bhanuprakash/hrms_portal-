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
// attendance (with a few late days, absences and one pending correction),
// two projects (Apollo, Zeus) with a PMO, PM, team leads and members, and a
// few announcements and kudos (written directly: nobody is notified or emailed). Every account gets DEMO_PASSWORD and can sign in
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
  const created = { departments: 0, levels: 0, titles: 0, locations: 0, people: 0, holidays: 0, attendanceDays: 0, corrections: 0, projects: 0, assignments: 0, announcements: 0, kudos: 0, assets: 0, tickets: 0, timesheets: 0 };

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
  await seedProjects(companyId, empOf, created);
  await seedEngagement(companyId, empOf, created);
  await seedAssets(companyId, empOf, created);
  await seedHelpdesk(companyId, empOf, created);
  await seedTimesheets(companyId, empOf, created);
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

// ─── Projects demo data ─────────────────────────────────────

// [code, name, client, assignments: [local, role, allocation, lead-local]]
const PROJECTS = [
  ['APOLLO', 'Apollo', 'Acme Retail', [
    ['ravi', 'MANAGER', 60], ['priya', 'TEAM_LEAD', 100], ['karan', 'TEAM_LEAD', 100],
    ['amit', 'MEMBER', 80, 'priya'], ['neha', 'MEMBER', 100, 'priya'], ['sara', 'MEMBER', 100, 'karan'],
  ]],
  ['ZEUS', 'Zeus', 'Northwind Bank', [['ravi', 'MANAGER', 40], ['amit', 'MEMBER', 20]]],
];

async function seedProjects(companyId, empOf, created) {
  // Pooja (Finance Officer) approves expenses at the Finance step and marks them paid
  const finance = await prisma.role.findFirst({ where: { companyId, key: 'finance' } });
  const pooja = empOf.pooja ? await prisma.employee.findUnique({ where: { id: empOf.pooja }, select: { userId: true } }) : null;
  if (finance && pooja) await prisma.userRole.upsert({ where: { userId_roleId: { userId: pooja.userId, roleId: finance.id } }, update: {}, create: { userId: pooja.userId, roleId: finance.id, companyId } });

  // Vikram (Head of Operations) is the PMO
  const pmo = await prisma.role.findFirst({ where: { companyId, key: 'pmo' } });
  const vikram = await prisma.employee.findUnique({ where: { id: empOf.vikram ?? '00000000-0000-0000-0000-000000000000' }, select: { userId: true } });
  if (pmo && vikram) await prisma.userRole.upsert({ where: { userId_roleId: { userId: vikram.userId, roleId: pmo.id } }, update: {}, create: { userId: vikram.userId, roleId: pmo.id, companyId } });

  const start = new Date('2026-01-05T00:00:00Z');
  for (const [code, name, clientName, members] of PROJECTS) {
    let project = await prisma.project.findUnique({ where: { companyId_code: { companyId, code } } });
    if (!project) {
      project = await prisma.project.create({ data: { companyId, code, name, clientName, status: 'ACTIVE', startDate: start } });
      created.projects++;
    }
    for (const [local, role, allocation, lead] of members) {
      const employeeId = empOf[local];
      if (!employeeId) continue;
      if (await prisma.projectMember.count({ where: { projectId: project.id, employeeId } })) continue;
      await prisma.projectMember.create({
        data: { companyId, projectId: project.id, employeeId, role, allocation, startDate: start, leadEmployeeId: lead ? empOf[lead] ?? null : null },
      });
      created.assignments++;
    }
  }
}

// ─── Announcements + kudos demo data ────────────────────────

const VALUES = [
  ['Teamwork', '🤝', '#0EA5E9', 10, 'Made the team better together.'],
  ['Ownership', '🎯', '#F59E0B', 20, 'Took responsibility and saw it through.'],
  ['Customer first', '💙', '#6366F1', 30, 'Went out of their way for a customer.'],
  ['Innovation', '💡', '#10B981', 40, 'Found a smarter way to do it.'],
  ['Extra mile', '🚀', '#EC4899', 50, 'Did more than anyone asked.'],
];

async function seedEngagement(companyId, empOf, created) {
  const userOf = async (local) => (empOf[local] ? (await prisma.employee.findUnique({ where: { id: empOf[local] }, select: { userId: true } }))?.userId : null);
  if (!(await prisma.announcement.count({ where: { companyId } }))) {
    const hema = await userOf('hema');
    const posts = [
      { title: 'Welcome to our new HR portal', body: 'From today, leave, attendance and your profile all live here.\n\nPlease complete your profile (photo, emergency contact, bank details) by the end of the month.', pinned: true, requiresAck: true },
      { title: 'Diwali celebrations on 6 November', body: 'Join us in the cafeteria at 4 pm for sweets, rangoli and the lamp-lighting. Ethnic wear encouraged!', pinned: false, requiresAck: false },
    ];
    for (const [i, p] of posts.entries()) {
      await prisma.announcement.create({ data: { companyId, authorId: hema, ...p, publishedAt: new Date(Date.now() - (posts.length - i) * 3600_000) } });
      created.announcements++;
    }
  }
  if (!(await prisma.kudosValue.count({ where: { companyId } }))) {
    await prisma.kudosValue.createMany({ data: VALUES.map(([name, emoji, color, sortOrder, description]) => ({ companyId, name, emoji, color, sortOrder, description })) });
  }
  if (!(await prisma.kudos.count({ where: { companyId } }))) {
    const value = Object.fromEntries((await prisma.kudosValue.findMany({ where: { companyId } })).map((v) => [v.name, v.id]));
    const items = [
      ['ravi', ['priya', 'karan'], 'Ownership', 'Shipping the Apollo release a day early — and with zero rollbacks. Brilliant work, both of you!'],
      ['priya', ['amit'], 'Teamwork', 'Thanks for pairing with Neha all week on the payments bug. Patient and generous with your time.'],
      ['meena', ['rahul'], 'Customer first', 'Stayed late to get Northwind their proposal before the deadline. They signed!'],
    ];
    for (const [i, [from, to, val, message]] of items.entries()) {
      const fromUserId = await userOf(from);
      if (!fromUserId) continue;
      await prisma.kudos.create({
        data: {
          companyId, fromUserId, message, valueId: value[val] ?? null, createdAt: new Date(Date.now() - (items.length - i) * 5400_000),
          recipients: { create: to.filter((t) => empOf[t]).map((t) => ({ employeeId: empOf[t] })) },
        },
      });
      created.kudos++;
    }
  }
}

// [type, tag, name, brand, serial, warranty (days from today), holder-local, confirmed]
const ASSETS = [
  ['Laptop', 'LAP-0001', 'MacBook Pro 14 (M3)', 'Apple', 'C02FX1AAQ6L4', 400, 'ravi', true],
  ['Laptop', 'LAP-0002', 'MacBook Pro 14 (M3)', 'Apple', 'C02FX1AAQ6L5', 400, 'priya', true],
  ['Laptop', 'LAP-0003', 'ThinkPad T14 Gen 4', 'Lenovo', 'PF4ABC12', 20, 'amit', true],
  ['Laptop', 'LAP-0004', 'ThinkPad T14 Gen 4', 'Lenovo', 'PF4ABC13', 20, 'neha', false],
  ['Laptop', 'LAP-0005', 'ThinkPad T14 Gen 4', 'Lenovo', 'PF4ABC14', 300, null, false],
  ['Monitor', 'MON-0001', 'Dell U2723QE 27"', 'Dell', 'CN0DX9K1', 700, 'priya', true],
  ['Monitor', 'MON-0002', 'Dell U2723QE 27"', 'Dell', 'CN0DX9K2', 700, null, false],
  ['Phone', 'PHN-0001', 'iPhone 15', 'Apple', 'F2LXK8QJ', 200, 'meena', true],
  ['ID card', 'IDC-0001', 'Access card', null, null, null, 'sara', true],
];
const ASSET_TYPES = [['Laptop', 'LAP', 10], ['Monitor', 'MON', 20], ['Phone', 'PHN', 30], ['SIM card', 'SIM', 40], ['ID card', 'IDC', 50], ['Headset', 'HDS', 60], ['Keyboard & mouse', 'KBM', 70], ['Other', 'OTH', 90]];

async function seedAssets(companyId, empOf, created) {
  // Karan (Engineering Lead) is the IT head: runs the register and approves asset requests
  const itAdmin = await prisma.role.findFirst({ where: { companyId, key: 'it_admin' } });
  const karan = empOf.karan ? await prisma.employee.findUnique({ where: { id: empOf.karan }, select: { userId: true } }) : null;
  if (itAdmin && karan) await prisma.userRole.upsert({ where: { userId_roleId: { userId: karan.userId, roleId: itAdmin.id } }, update: {}, create: { userId: karan.userId, roleId: itAdmin.id, companyId } });
  if (await prisma.asset.count({ where: { companyId } })) return;

  if (!(await prisma.assetType.count({ where: { companyId } }))) {
    await prisma.assetType.createMany({ data: ASSET_TYPES.map(([name, prefix, sortOrder]) => ({ companyId, name, prefix, sortOrder })), skipDuplicates: true });
  }
  const type = Object.fromEntries((await prisma.assetType.findMany({ where: { companyId } })).map((t) => [t.name, t.id]));
  const day = (n) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d; };
  for (const [t, tag, name, brand, serialNumber, warranty, holder, confirmed] of ASSETS) {
    const held = holder && empOf[holder];
    const asset = await prisma.asset.create({
      data: { companyId, typeId: type[t], tag, name, brand, serialNumber, warrantyUntil: warranty === null ? null : day(warranty), purchaseDate: day(-200), condition: 'GOOD', status: held ? 'ASSIGNED' : 'AVAILABLE' },
    });
    if (held) await prisma.assetAssignment.create({ data: { companyId, assetId: asset.id, employeeId: held, assignedAt: day(-150), conditionOut: 'GOOD', acknowledgedAt: confirmed ? day(-149) : null } });
    created.assets++;
  }
  // Sara wants a monitor: HR (Hema) already approved; waiting for the IT head
  if (empOf.sara && type.Monitor) {
    const hema = empOf.hema ? await prisma.employee.findUnique({ where: { id: empOf.hema }, select: { userId: true } }) : null;
    await prisma.assetRequest.create({
      data: { companyId, employeeId: empOf.sara, typeId: type.Monitor, reason: 'Second screen for code reviews and design work', ...(hema && { hrStatus: 'APPROVED', hrById: hema.userId, hrAt: day(-1) }) },
    });
  }
}

const TICKET_CATEGORIES = [
  ['IT', 'Laptop / hardware'], ['IT', 'Software & installs'], ['IT', 'Access & passwords'], ['IT', 'Email & accounts'], ['IT', 'Network / VPN'], ['IT', 'Other'],
  ['HR', 'Leave & attendance'], ['HR', 'Letters & documents'], ['HR', 'Policies'], ['HR', 'Benefits & insurance'], ['HR', 'Profile changes'], ['HR', 'Other'],
  ['FINANCE', 'Salary & payslip'], ['FINANCE', 'Reimbursements'], ['FINANCE', 'Tax & investment proofs'], ['FINANCE', 'Other'],
];
const SLA = { URGENT: [1, 8], HIGH: [4, 24], MEDIUM: [8, 72], LOW: [24, 120] };
// [requester, queue, category, subject, description, priority, status, hours ago, agent, thread: [who ('emp' | 'agent'), kind, body, hours ago]]
const TICKETS = [
  ['neha', 'IT', 'Laptop / hardware', 'Laptop battery drains in two hours', 'Since last week my ThinkPad (LAP-0004) goes from full to empty in about two hours, even with only the browser and IDE open.', 'HIGH', 'OPEN', 5, null, []],
  ['amit', 'HR', 'Letters & documents', 'Employment verification letter for home loan', 'My bank needs an employment verification letter with my joining date and current CTC. Could HR share one on the letterhead?', 'MEDIUM', 'IN_PROGRESS', 20, 'hema', [['agent', 'REPLY', 'Sure Amit — we’ll prepare it today. Does the bank need the CTC broken down or just the annual figure?', 18], ['emp', 'REPLY', 'Just the annual figure is fine, thanks!', 17]]],
  ['rahul', 'FINANCE', 'Reimbursements', 'September travel reimbursement not received', 'My Mumbai client-visit claim was approved two weeks ago but I haven’t received the money yet.', 'MEDIUM', 'WAITING', 30, 'pooja', [['agent', 'REPLY', 'Hi Rahul, could you share the claim title or the date you submitted it? I can’t find an approved claim under your name for September.', 26]]],
  ['sara', 'IT', 'Software & installs', 'Figma licence for design reviews', 'I review UI designs with the product team and need edit access in Figma.', 'LOW', 'RESOLVED', 60, 'karan', [['agent', 'REPLY', 'Added you to the company Figma team with an editor seat. Please log out and back in.', 30]]],
];

async function seedHelpdesk(companyId, empOf, created) {
  if (await prisma.ticket.count({ where: { companyId } })) return;
  if (!(await prisma.ticketCategory.count({ where: { companyId } }))) {
    await prisma.ticketCategory.createMany({ data: TICKET_CATEGORIES.map(([queue, name], i) => ({ companyId, queue, name, sortOrder: name === 'Other' ? 90 : (i + 1) * 10 })), skipDuplicates: true });
  }
  const cat = new Map((await prisma.ticketCategory.findMany({ where: { companyId } })).map((c) => [`${c.queue}:${c.name}`, c.id]));
  const userOf = async (local) => (empOf[local] ? (await prisma.employee.findUnique({ where: { id: empOf[local] }, select: { userId: true } }))?.userId : null);
  const ago = (h) => new Date(Date.now() - h * 3600_000);
  let number = 0;
  for (const [who, queue, category, subject, description, priority, status, hoursAgo, agentLocal, thread] of TICKETS) {
    const requester = await userOf(who);
    if (!requester) continue;
    const agent = agentLocal ? await userOf(agentLocal) : null;
    const createdAt = ago(hoursAgo);
    const firstReply = thread.find((m) => m[0] === 'agent');
    const resolved = status === 'RESOLVED';
    const t = await prisma.ticket.create({
      data: {
        companyId, number: ++number, queue, categoryId: cat.get(`${queue}:${category}`) ?? null, employeeId: empOf[who], subject, description, priority, status,
        assigneeId: agent, createdAt, lastActivityAt: thread.length ? ago(thread[thread.length - 1][3]) : createdAt,
        firstResponseDueAt: new Date(createdAt.getTime() + SLA[priority][0] * 3600_000), resolutionDueAt: new Date(createdAt.getTime() + SLA[priority][1] * 3600_000),
        firstRespondedAt: firstReply ? ago(firstReply[3]) : null, resolvedAt: resolved ? ago(thread[thread.length - 1][3]) : null,
      },
    });
    const messages = [{ authorId: requester, kind: 'REPLY', body: description, createdAt }];
    if (agent) messages.push({ authorId: agent, kind: 'EVENT', body: 'Took the ticket', createdAt: new Date(createdAt.getTime() + 60_000) });
    for (const [side, kind, body, h] of thread) messages.push({ authorId: side === 'agent' ? agent : requester, kind, body, createdAt: ago(h) });
    if (status === 'WAITING') messages.push({ authorId: agent, kind: 'EVENT', body: 'Asked the employee for more information', createdAt: ago(thread[thread.length - 1][3] - 0.001) });
    if (resolved) messages.push({ authorId: agent, kind: 'EVENT', body: 'Marked as resolved', createdAt: ago(thread[thread.length - 1][3] - 0.001) });
    await prisma.ticketMessage.createMany({ data: messages.map((m) => ({ companyId, ticketId: t.id, ...m })) });
    created.tickets++;
  }
}

// [person, weeks ago, status, decided by, lines: [project code | null, task, billable, hours Mon–Fri]]
const TIMESHEETS = [
  ['amit', 2, 'APPROVED', 'priya', [['APOLLO', 'Checkout API', true, [6, 6, 6, 6, 6]], ['ZEUS', 'Support rotation', true, [2, 2, 2, 2, 2]]]],
  ['neha', 2, 'APPROVED', 'priya', [['APOLLO', 'Payments bug fixes', true, [8, 8, 7, 8, 8]]]],
  ['sara', 2, 'APPROVED', 'karan', [['APOLLO', 'Design system', true, [7, 8, 8, 8, 6]], [null, 'Hiring interviews', false, [1, 0, 0, 0, 2]]]],
  ['priya', 2, 'APPROVED', 'ravi', [['APOLLO', 'Code reviews & planning', true, [8, 8, 8, 8, 8]]]],
  ['amit', 1, 'SUBMITTED', null, [['APOLLO', 'Checkout API', true, [6, 7, 6, 6, 6]], ['ZEUS', 'Support rotation', true, [2, 1, 2, 2, 2]]]],
  ['sara', 1, 'SUBMITTED', null, [['APOLLO', 'Design system', true, [8, 8, 8, 8, 8]]]],
  ['neha', 1, 'REJECTED', 'priya', [['APOLLO', 'Payments bug fixes', true, [8, 8, 8, 8, 12]]]],
  ['priya', 1, 'DRAFT', null, [['APOLLO', 'Code reviews & planning', true, [8, 8, 8, 0, 0]]]],
];

async function seedTimesheets(companyId, empOf, created) {
  if (await prisma.timesheet.count({ where: { companyId } })) return;
  const tz = (await prisma.companySettings.findUnique({ where: { companyId }, select: { timezone: true } }))?.timezone || 'Asia/Kolkata';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const add = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const monday = add(today, -((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7));
  const projects = Object.fromEntries((await prisma.project.findMany({ where: { companyId }, select: { id: true, code: true } })).map((p) => [p.code, p.id]));
  const userOf = async (local) => (empOf[local] ? (await prisma.employee.findUnique({ where: { id: empOf[local] }, select: { userId: true } }))?.userId : null);
  // Approvers as the app would route them: team lead + project manager + line manager
  const pool = { amit: ['priya', 'ravi'], neha: ['priya', 'ravi'], sara: ['karan', 'ravi'], priya: ['ravi'] };
  const label = { amit: 'Team lead · Apollo, Project manager · Apollo, Line manager', neha: 'Team lead · Apollo, Project manager · Apollo, Line manager', sara: 'Team lead · Apollo, Project manager · Apollo, Line manager', priya: 'Project manager · Apollo, Line manager' };
  for (const [who, weeksAgo, status, decider, lines] of TIMESHEETS) {
    if (!empOf[who]) continue;
    const week = add(monday, -7 * weeksAgo);
    const approverIds = status === 'DRAFT' ? [] : (await Promise.all(pool[who].map(userOf))).filter(Boolean);
    const entries = [];
    lines.forEach(([code, task, billable, hours], line) => {
      hours.forEach((h, i) => { if (h) entries.push({ companyId, employeeId: empOf[who], date: new Date(add(week, i) + 'T00:00:00Z'), projectId: code ? projects[code] ?? null : null, task, billable: Boolean(code) && billable, minutes: h * 60, line }); });
    });
    const submittedAt = status === 'DRAFT' ? null : new Date(add(week, 4) + 'T12:30:00Z');
    const decided = status === 'APPROVED' || status === 'REJECTED';
    await prisma.timesheet.create({
      data: {
        companyId, employeeId: empOf[who], weekStart: new Date(week + 'T00:00:00Z'), status, totalMinutes: entries.reduce((n, e) => n + e.minutes, 0),
        approverIds, approverLabel: status === 'DRAFT' ? null : label[who], submittedAt,
        decidedById: decided ? await userOf(decider) : null, decidedAt: decided ? new Date(add(week, 7) + 'T05:00:00Z') : null,
        decisionNote: status === 'REJECTED' ? 'Friday shows 12 hours — please split the overtime or correct it.' : null,
        entries: { create: entries.map(({ companyId: _c, ...e }) => ({ companyId, ...e })) },
      },
    });
    created.timesheets++;
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
