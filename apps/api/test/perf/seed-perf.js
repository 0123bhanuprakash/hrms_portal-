#!/usr/bin/env node
// Builds a large throwaway company for speed measurements ("perf-bench").
//
//   node test/perf/seed-perf.js            # (re)create it
//   node test/perf/seed-perf.js --drop     # remove it
//
// ~500 employees in a 4-level tree, 6 months of attendance, leave, projects,
// 8 weeks of timesheets, expenses, assets, tickets, notifications and
// announcements. Written straight to the database: nobody is notified.
// Sign-in for every account: PERF_PASSWORD (default below).
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma: p, dropCompany } = require('../e2e/lib');

const SLUG = 'perf-bench';
const PASSWORD = process.env.PERF_PASSWORD ?? 'Perf-Bench-2026!';
const TZ = 'Asia/Kolkata';
const D = (k) => new Date(`${k}T00:00:00Z`);
const addDays = (k, n) => {
  const d = D(k);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (k) => D(k).getUTCDay();
const mondayOf = (k) => addDays(k, -((weekday(k) + 6) % 7));
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (a) => a[Math.floor(rnd() * a.length)];
async function chunked(model, rows, size = 5000) {
  for (let i = 0; i < rows.length; i += size) await p[model].createMany({ data: rows.slice(i, i + size) });
}

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Pari', 'Anika', 'Navya', 'Myra', 'Sara', 'Kiara', 'Rohan', 'Kabir', 'Meera', 'Riya', 'Tara', 'Neel', 'Zoya', 'Dev', 'Isha', 'Nikhil'];
const LAST = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Gupta', 'Mehta', 'Khan', 'Das', 'Joshi', 'Rao', 'Patel', 'Singh', 'Menon', 'Kulkarni', 'Bose', 'Chopra', 'Pillai'];
const DEPTS = [['ENG', 'Engineering'], ['QA', 'Quality'], ['DES', 'Design'], ['PRD', 'Product'], ['SAL', 'Sales'], ['MKT', 'Marketing'], ['SUP', 'Support'], ['OPS', 'Operations'], ['HR', 'People'], ['FIN', 'Finance']];

(async () => {
  const t0 = Date.now();
  await dropCompany(SLUG);
  if (process.argv.includes('--drop')) {
    console.log('perf-bench removed');
    return p.$disconnect();
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
  const company = await p.company.create({ data: { name: 'Perf Bench', slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: TZ } }, branding: { create: { displayName: 'Perf Bench' } } } });
  const cid = company.id;
  const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
  const roles = {};
  for (const t of templates) {
    roles[t.key] = (await p.role.create({ data: { companyId: cid, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
  }

  // ── Org structure
  const depts = DEPTS.map(([code, name]) => ({ id: randomUUID(), companyId: cid, code, name }));
  await p.department.createMany({ data: depts });
  await p.departmentHierarchy.createMany({ data: depts.map((d) => ({ companyId: cid, ancestorId: d.id, descendantId: d.id, depth: 0 })) });
  const locs = ['Bengaluru HQ', 'Mumbai', 'Pune'].map((name) => ({ id: randomUUID(), companyId: cid, name }));
  await p.officeLocation.createMany({ data: locs });
  const titles = ['Head', 'Lead', 'Senior Engineer', 'Engineer', 'Analyst', 'Associate'].map((name) => ({ id: randomUUID(), companyId: cid, name }));
  await p.designation.createMany({ data: titles });

  // ── People: CEO → 10 heads → 4 leads each → ~11 members each (≈500)
  const hash = await bcrypt.hash(PASSWORD, 10);
  const people = [];
  const add = (local, roleKeys, dept, title, managerId) => {
    const id = randomUUID();
    const userId = randomUUID();
    const n = people.length;
    people.push({
      id, userId, local, roleKeys, managerId,
      firstName: local.startsWith('emp') || local.startsWith('m') ? pick(FIRST) : local.replace(/\d+$/, '').replace(/^./, (c) => c.toUpperCase()),
      lastName: pick(LAST),
      dept: dept.id,
      title: title.id,
      loc: pick(locs).id,
      joining: addDays(today, -Math.floor(30 + rnd() * 2500)),
      n,
    });
    return id;
  };
  const ceo = add('ceo', ['employee', 'manager'], depts[7], titles[0], null);
  const heads = depts.map((d, i) => add(`head${i + 1}`, ['employee', 'manager', ...(d.code === 'HR' ? ['hr'] : []), ...(d.code === 'FIN' ? ['finance'] : [])], d, titles[0], ceo));
  const leads = [];
  heads.forEach((h, i) => {
    for (let j = 0; j < 4; j++) leads.push({ id: add(`lead${i * 4 + j + 1}`, ['employee', 'team_lead'], depts[i], titles[1], h), dept: depts[i] });
  });
  let m = 0;
  for (const l of leads) for (let k = 0; k < 11; k++) add(`m${++m}`, ['employee'], l.dept, pick(titles.slice(2)), l.id);
  // Named accounts for the benchmark
  const hrHead = people.find((x) => x.local === 'head9');
  hrHead.local = 'hr';
  const pmo = add('pmo', ['employee', 'pmo'], depts[7], titles[0], ceo);
  add('itadmin', ['employee', 'it_admin'], depts[7], titles[1], ceo);
  const managerAcc = people.find((x) => x.local === 'head1');
  managerAcc.local = 'manager';
  const leadAcc = people.find((x) => x.local === 'lead1');
  leadAcc.local = 'lead';
  const empAcc = people.find((x) => x.local === 'm1');
  empAcc.local = 'emp';
  void pmo;

  await chunked('user', people.map((x) => ({ id: x.userId, email: `${x.local}@${SLUG}.test`, passwordHash: hash, firstName: x.firstName, lastName: x.lastName, companyId: cid, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date() })));
  await chunked('employee', people.map((x) => ({
    id: x.id, companyId: cid, userId: x.userId, employeeId: `PB${String(x.n + 1).padStart(4, '0')}`, firstName: x.firstName, lastName: x.lastName, email: `${x.local}@${SLUG}.test`,
    departmentId: x.dept, designationId: x.title, locationId: x.loc, joiningDate: D(x.joining), gender: pick(['MALE', 'FEMALE']),
    employmentStatus: x.n % 47 === 0 ? 'PROBATION' : x.n % 61 === 0 ? 'NOTICE_PERIOD' : 'ACTIVE',
  })));
  for (const x of people) if (x.managerId) await p.employee.update({ where: { id: x.id }, data: { reportingManagerId: x.managerId } }).catch(() => undefined);
  await chunked('userRole', people.flatMap((x) => x.roleKeys.map((k) => ({ userId: x.userId, roleId: roles[k], companyId: cid }))));
  const byId = new Map(people.map((x) => [x.id, x]));
  const closure = [];
  for (const x of people) {
    closure.push({ companyId: cid, ancestorId: x.id, descendantId: x.id, depth: 0 });
    let cur = x.managerId;
    let depth = 1;
    while (cur) {
      closure.push({ companyId: cid, ancestorId: cur, descendantId: x.id, depth: depth++ });
      cur = byId.get(cur).managerId;
    }
  }
  await chunked('employeeHierarchy', closure);
  console.log(`people: ${people.length}`);

  // ── Attendance: 6 months of working days
  const start = addDays(today, -182);
  const days = [];
  for (let d = start; d < today; d = addDays(d, 1)) if (weekday(d) !== 0 && weekday(d) !== 6) days.push(d);
  const att = [];
  for (const x of people) {
    for (const d of days) {
      if (d < x.joining) continue;
      const r = rnd();
      const status = r < 0.04 ? 'ON_LEAVE' : r < 0.06 ? 'ABSENT' : r < 0.14 ? 'WORK_FROM_HOME' : r < 0.17 ? 'HALF_DAY' : 'PRESENT';
      const inMin = 9 * 60 + Math.floor(rnd() * 70) - 30;
      const work = status === 'HALF_DAY' ? 270 : status === 'ON_LEAVE' || status === 'ABSENT' ? null : 450 + Math.floor(rnd() * 90);
      att.push({
        companyId: cid, employeeId: x.id, date: D(d), status, workingMinutes: work,
        checkIn: work ? new Date(D(d).getTime() + (inMin - 330) * 60_000) : null,
        checkOut: work ? new Date(D(d).getTime() + (inMin + work - 330) * 60_000) : null,
        lateMinutes: work && inMin > 9 * 60 + 15 ? inMin - (9 * 60 + 15) : null,
      });
    }
  }
  await chunked('attendanceRecord', att);
  console.log(`attendance: ${att.length}`);

  // ── Leave
  const types = [['CL', 'Casual leave', 'CASUAL', 12], ['SL', 'Sick leave', 'SICK', 10], ['EL', 'Earned leave', 'EARNED', 18], ['WFH', 'Work from home', 'WORK_FROM_HOME', 24]].map(([code, name, category, quota]) => ({ id: randomUUID(), companyId: cid, code, name, category, annualQuota: quota }));
  await p.leaveType.createMany({ data: types });
  const year = Number(today.slice(0, 4));
  await chunked('leaveBalance', people.flatMap((x) => types.map((t) => ({ companyId: cid, employeeId: x.id, leaveTypeId: t.id, year, allocated: t.annualQuota, usedDays: Math.floor(rnd() * 5) }))));
  const leaves = [];
  const approvals = [];
  for (const x of people) {
    for (let i = 0; i < 3; i++) {
      const s = addDays(today, Math.floor(rnd() * 200) - 160);
      const len = 1 + Math.floor(rnd() * 3);
      const pending = s > today || rnd() < 0.08;
      const id = randomUUID();
      leaves.push({ id, companyId: cid, employeeId: x.id, leaveTypeId: pick(types).id, startDate: D(s), endDate: D(addDays(s, len - 1)), totalDays: len, reason: 'Personal', status: pending ? 'PENDING' : 'APPROVED', decidedAt: pending ? null : new Date() });
      const mgr = x.managerId ? byId.get(x.managerId).userId : null;
      approvals.push({ leaveRequestId: id, level: 1, approverId: mgr, approverIds: mgr ? [mgr] : [], label: 'Line manager', status: pending ? 'PENDING' : 'APPROVED', actedById: pending ? null : mgr, actedAt: pending ? null : new Date() });
    }
  }
  await chunked('leaveRequest', leaves);
  await chunked('leaveApproval', approvals);
  console.log(`leave requests: ${leaves.length}`);

  // ── Projects: 25, people in Engineering/QA/Design/Product on 1–2 each
  const projects = Array.from({ length: 25 }, (_, i) => ({ id: randomUUID(), companyId: cid, code: `P${i + 1}`, name: `Project ${i + 1}`, clientName: i % 3 ? `Client ${i + 1}` : null, status: i < 22 ? 'ACTIVE' : 'COMPLETED', startDate: D(addDays(today, -300)) }));
  await p.project.createMany({ data: projects });
  const members = [];
  const onProject = people.filter((x) => [depts[0].id, depts[1].id, depts[2].id, depts[3].id].includes(x.dept) && x.local !== 'ceo');
  for (const x of onProject) {
    const a = pick(projects.slice(0, 22));
    const two = rnd() < 0.3;
    members.push({ companyId: cid, projectId: a.id, employeeId: x.id, role: x.local.startsWith('lead') || x.local === 'lead' ? 'TEAM_LEAD' : 'MEMBER', allocation: two ? 60 : 100, startDate: D(addDays(today, -200)) });
    if (two) {
      const b = pick(projects.slice(0, 22).filter((q) => q.id !== a.id));
      members.push({ companyId: cid, projectId: b.id, employeeId: x.id, role: 'MEMBER', allocation: 40, startDate: D(addDays(today, -200)) });
    }
  }
  await chunked('projectMember', members);
  console.log(`project members: ${members.length}`);

  // ── Timesheets: last 8 weeks for people on projects
  const sheets = [];
  const entries = [];
  const thisMonday = mondayOf(today);
  for (const x of onProject) {
    const mine = members.filter((q) => q.employeeId === x.id);
    for (let w = 1; w <= 8; w++) {
      const week = addDays(thisMonday, -7 * w);
      const id = randomUUID();
      let total = 0;
      mine.forEach((q, line) => {
        for (let i = 0; i < 5; i++) {
          const minutes = Math.round((8 * 60 * q.allocation) / 100);
          total += minutes;
          entries.push({ companyId: cid, timesheetId: id, employeeId: x.id, date: D(addDays(week, i)), projectId: q.projectId, task: 'Development', billable: true, minutes, line });
        }
      });
      const mgr = byId.get(x.managerId)?.userId;
      sheets.push({ id, companyId: cid, employeeId: x.id, weekStart: D(week), status: w === 1 && rnd() < 0.4 ? 'SUBMITTED' : 'APPROVED', totalMinutes: total, approverIds: mgr ? [mgr] : [], approverLabel: 'Line manager', submittedAt: new Date() });
    }
  }
  await chunked('timesheet', sheets);
  await chunked('timesheetEntry', entries);
  console.log(`timesheets: ${sheets.length}, entries: ${entries.length}`);

  // ── Expenses: ~800 claims
  const cats = ['Travel', 'Food', 'Local conveyance', 'Accommodation', 'Other'].map((name) => ({ id: randomUUID(), companyId: cid, name, receiptRequiredAbovePaise: null }));
  await p.expenseCategory.createMany({ data: cats });
  const claims = [];
  const items = [];
  const expApprovals = [];
  for (let i = 0; i < 800; i++) {
    const x = pick(people.filter((q) => q.managerId));
    const id = randomUUID();
    const status = pick(['PENDING', 'APPROVED', 'PAID', 'PAID', 'PAID', 'DRAFT']);
    claims.push({ id, companyId: cid, employeeId: x.id, title: `Claim ${i + 1}`, status, round: status === 'DRAFT' ? 0 : 1, submittedAt: status === 'DRAFT' ? null : new Date() });
    for (let k = 0; k < 2; k++) items.push({ claimId: id, categoryId: pick(cats).id, date: D(addDays(today, -Math.floor(rnd() * 90))), description: 'Expense', amountPaise: 5000 + Math.floor(rnd() * 500000) });
    if (status !== 'DRAFT') {
      const mgr = byId.get(x.managerId).userId;
      const done = status !== 'PENDING';
      expApprovals.push({ claimId: id, round: 1, stage: 'MANAGER', approverIds: [mgr], label: 'Line manager', status: done ? 'APPROVED' : 'PENDING' });
      expApprovals.push({ claimId: id, round: 1, stage: 'FINANCE', label: 'Finance', status: done ? 'APPROVED' : 'PENDING' });
      expApprovals.push({ claimId: id, round: 1, stage: 'HR', label: 'HR', status: done ? 'APPROVED' : 'PENDING' });
    }
  }
  await chunked('expenseClaim', claims);
  await chunked('expenseItem', items);
  await chunked('expenseApproval', expApprovals);
  console.log(`expense claims: ${claims.length}`);

  // ── Assets: 600, 450 assigned
  const atypes = [['Laptop', 'LAP'], ['Monitor', 'MON'], ['Phone', 'PHN']].map(([name, prefix], i) => ({ id: randomUUID(), companyId: cid, name, prefix, sortOrder: i * 10 }));
  await p.assetType.createMany({ data: atypes });
  const assets = [];
  const assigns = [];
  for (let i = 0; i < 600; i++) {
    const t = atypes[i % 3];
    const id = randomUUID();
    const holder = i < 450 ? people[i % people.length] : null;
    assets.push({ id, companyId: cid, typeId: t.id, tag: `${t.prefix}-${String(i + 1).padStart(4, '0')}`, name: `${t.name} ${i + 1}`, status: holder ? 'ASSIGNED' : 'AVAILABLE', warrantyUntil: D(addDays(today, Math.floor(rnd() * 700) - 100)) });
    if (holder) assigns.push({ companyId: cid, assetId: id, employeeId: holder.id, conditionOut: 'GOOD', acknowledgedAt: rnd() < 0.8 ? new Date() : null });
  }
  await chunked('asset', assets);
  await chunked('assetAssignment', assigns);

  // ── Helpdesk: 1500 tickets × 3 messages
  const tickets = [];
  const msgs = [];
  const itAdmin = people.find((x) => x.local === 'itadmin');
  for (let i = 0; i < 1500; i++) {
    const x = pick(people);
    const id = randomUUID();
    const created = new Date(Date.now() - Math.floor(rnd() * 90) * 86400_000);
    const status = pick(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED', 'CLOSED', 'CLOSED']);
    const queue = pick(['IT', 'IT', 'HR', 'FINANCE']);
    tickets.push({
      id, companyId: cid, number: i + 1, queue, employeeId: x.id, subject: `Ticket ${i + 1}`, description: 'Something needs fixing', priority: pick(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH']), status,
      assigneeId: status === 'OPEN' ? null : queue === 'IT' ? itAdmin.userId : hrHead.userId,
      firstResponseDueAt: new Date(created.getTime() + 8 * 3600_000), resolutionDueAt: new Date(created.getTime() + 72 * 3600_000),
      firstRespondedAt: status === 'OPEN' ? null : new Date(created.getTime() + 3600_000), resolvedAt: ['RESOLVED', 'CLOSED'].includes(status) ? new Date(created.getTime() + 86400_000) : null,
      closedAt: status === 'CLOSED' ? new Date(created.getTime() + 2 * 86400_000) : null, rating: status === 'CLOSED' ? 3 + Math.floor(rnd() * 3) : null, createdAt: created, lastActivityAt: created,
    });
    for (let k = 0; k < 3; k++) msgs.push({ companyId: cid, ticketId: id, authorId: k % 2 ? itAdmin.userId : x.userId, kind: 'REPLY', body: 'Message', createdAt: new Date(created.getTime() + k * 60_000) });
  }
  await chunked('ticket', tickets);
  await chunked('ticketMessage', msgs);

  // ── Announcements + notifications
  await p.announcement.createMany({ data: Array.from({ length: 40 }, (_, i) => ({ companyId: cid, title: `Announcement ${i + 1}`, body: 'Hello everyone', authorId: hrHead.userId, publishedAt: new Date(Date.now() - i * 86400_000) })) });
  const notes = [];
  for (const x of people) for (let i = 0; i < 40; i++) notes.push({ companyId: cid, userId: x.userId, type: pick(['leave.approved', 'timesheet.reminder', 'ticket.reply', 'announcement.posted']), title: `Notification ${i + 1}`, link: '/app', readAt: i < 30 ? new Date() : null, createdAt: new Date(Date.now() - i * 3600_000) });
  await chunked('notification', notes);

  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s — sign in as hr@ / manager@ / lead@ / emp@ / pmo@${SLUG}.test`);
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
