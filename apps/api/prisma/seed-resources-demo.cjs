// Demo company for resource requests & releases (Lead → PM → Delivery Director → PMO).
//
//   DEMO_PASSWORD='…' node prisma/seed-resources-demo.cjs            (API on :4000 must be running)
//
// Creates (or re-creates) the company "resources-demo": a PMO, a Delivery
// Director, two PMs, leads, developers with skills, three projects with a tech
// stack, someone who reports to the PMO, and requests / releases in different
// states (waiting for the PM, on hold, with the PMO, a release waiting).
// Every account: <first>@resources-demo.test with DEMO_PASSWORD. No emails are sent
// (in-app notifications only).
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();
const SLUG = 'resources-demo';
const API = process.env.DEMO_API ?? 'http://127.0.0.1:4000/api/v1';
const password = process.env.DEMO_PASSWORD;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (k, n) => {
  const d = new Date(k + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// name, title, roles, skills, reportsTo ('pmo' | name | null)
const PEOPLE = [
  ['admin', 'Company admin', ['company_admin'], [], null],
  ['vikram', 'Head of PMO', ['employee', 'pmo'], ['Planning'], null],
  ['suresh', 'Delivery Director', ['employee'], ['Delivery', 'Fintech'], null],
  ['ravi', 'Project Manager', ['employee'], ['Scrum', 'Payments'], 'suresh'],
  ['farhan', 'Project Manager', ['employee'], ['Scrum', 'Healthcare'], 'suresh'],
  ['priya', 'Team Lead', ['employee'], ['React', 'TypeScript', 'Node.js'], 'ravi'],
  ['karan', 'Team Lead', ['employee'], ['Java', 'Spring'], 'farhan'],
  ['kavya', 'Senior Frontend Engineer', ['employee'], ['React', 'TypeScript', 'Payments UI', 'Jest'], 'priya'],
  ['rohit', 'Software Engineer', ['employee'], ['Node.js', 'PostgreSQL'], 'priya'],
  ['swati', 'Software Engineer', ['employee'], ['React', 'CSS'], 'karan'],
  ['amit', 'Software Engineer', ['employee'], ['React', 'Redux', 'Jest'], 'karan'],
  ['tanvi', 'Software Engineer', ['employee'], ['React', 'Figma'], 'pmo'],
  ['nikhil', 'QA Engineer', ['employee'], ['Selenium', 'Cypress'], 'pmo'],
];

async function api(token, method, url, body) {
  const r = await fetch(API + url, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: 'Bearer ' + token }) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status >= 400) throw new Error(`${method} ${url} → ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
}
async function login(name) {
  const d = await api(null, 'POST', '/auth/login', { email: `${name}@${SLUG}.test`, password });
  return d.access_token;
}

async function drop() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const id = c.id;
  const ids = (await p.user.findMany({ where: { companyId: id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.assignmentLog.deleteMany({ where: { companyId: id } });
  await p.resourceRequestEvent.deleteMany({ where: { companyId: id } });
  await p.resourceRequest.deleteMany({ where: { companyId: id } });
  await p.projectMember.deleteMany({ where: { companyId: id } });
  await p.project.deleteMany({ where: { companyId: id } });
  await p.leaveBalance.deleteMany({ where: { companyId: id } });
  await p.leaveType.deleteMany({ where: { companyId: id } });
  await p.employeeHierarchy.deleteMany({ where: { companyId: id } });
  await p.employee.updateMany({ where: { companyId: id }, data: { reportingManagerId: null } });
  await p.employee.deleteMany({ where: { companyId: id } });
  await p.designation.deleteMany({ where: { companyId: id } });
  await p.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await p.auditLog.deleteMany({ where: { OR: [{ companyId: id }, { userId: { in: ids } }] } });
  await p.userRole.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.role.deleteMany({ where: { companyId: id } });
  await p.companyBranding.deleteMany({ where: { companyId: id } });
  await p.companySettings.deleteMany({ where: { companyId: id } });
  await p.company.delete({ where: { id } });
}

(async () => {
  if (!password) throw new Error('Usage: DEMO_PASSWORD=… node prisma/seed-resources-demo.cjs');
  await drop();
  const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
  const company = await p.company.create({ data: { name: 'Resources Demo', slug: SLUG, email: `hello@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: 'Asia/Kolkata' } }, branding: { create: { displayName: 'Resources Demo' } } } });
  const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
  const roles = {};
  for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
  // A hand-made "PMO lead" role (as a Company Admin would make in Roles & permissions)
  const perms = await p.permission.findMany({ where: { key: { in: ['project.pmo_lead', 'project.view'] } } });
  const pmoLead = await p.role.create({ data: { companyId: company.id, key: 'pmo_lead_demo', name: 'PMO lead', rolePermissions: { create: perms.map((x) => ({ permissionId: x.id })) } } });

  const hash = await bcrypt.hash(password, 10);
  const E = {};
  for (const [name, title, keys, skills, reportsTo] of PEOPLE) {
    const first = name[0].toUpperCase() + name.slice(1);
    const designation = await p.designation.upsert({ where: { companyId_name: { companyId: company.id, name: title } }, update: {}, create: { companyId: company.id, name: title } });
    const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: first, lastName: 'Demo', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
    E[name] = await p.employee.create({
      data: { companyId: company.id, userId: u.id, employeeId: `RD${String(Object.keys(E).length + 1).padStart(3, '0')}`, firstName: first, lastName: 'Demo', email: u.email, joiningDate: new Date('2025-01-06'), skills, designationId: designation.id, reportingManagerId: reportsTo && reportsTo !== 'pmo' ? E[reportsTo].id : null, reportsToPmo: reportsTo === 'pmo' },
    });
    E[name].userId = u.id;
  }
  await p.userRole.create({ data: { userId: E.vikram.userId, roleId: pmoLead.id, companyId: company.id } });
  const rows = [];
  for (const e of Object.values(E)) {
    rows.push({ companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 });
    let cur = e.reportingManagerId;
    let depth = 1;
    while (cur) {
      rows.push({ companyId: company.id, ancestorId: cur, descendantId: e.id, depth: depth++ });
      cur = Object.values(E).find((x) => x.id === cur)?.reportingManagerId ?? null;
    }
  }
  await p.employeeHierarchy.createMany({ data: rows });

  // Projects through the API (PM booked at 30%, DD set, tech stack by the lead)
  const T = { vikram: await login('vikram'), priya: await login('priya'), ravi: await login('ravi'), karan: await login('karan') };
  const project = (name, code, pm, type, client) => api(T.vikram, 'POST', '/projects', { name, code, type, clientName: client, startDate: addDays(today, -60), endDate: addDays(today, 240), managerEmployeeId: E[pm].id, deliveryDirectorId: E.suresh.id });
  const atlas = await project('Atlas Payments', 'ATLAS', 'ravi', 'CLIENT', 'Northwind Bank');
  const nimbus = await project('Nimbus CRM', 'NIMBUS', 'ravi', 'INTERNAL', null);
  const helix = await project('Helix Health', 'HELIX', 'farhan', 'CLIENT', 'Helix Clinics');
  const add = (proj, who, role, allocation, lead) => api(T.vikram, 'POST', `/projects/${proj.id}/members`, { employeeId: E[who].id, role, allocation, startDate: addDays(today, -50), endDate: proj.endDate, leadEmployeeId: lead ? E[lead].id : undefined });
  await add(atlas, 'priya', 'TEAM_LEAD', 100);
  const rohitM = await add(atlas, 'rohit', 'MEMBER', 100, 'priya');
  await add(nimbus, 'kavya', 'MEMBER', 50);
  await add(nimbus, 'swati', 'MEMBER', 50);
  await add(helix, 'karan', 'TEAM_LEAD', 100);
  await add(helix, 'amit', 'MEMBER', 100, 'karan');
  await add(helix, 'swati', 'MEMBER', 50, 'karan');
  await api(T.priya, 'PUT', `/projects/${atlas.id}/tech-stack`, { techStack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'] });
  await api(T.karan, 'PUT', `/projects/${helix.id}/tech-stack`, { techStack: ['Java', 'Spring', 'React'] });

  // Requests in different states
  const r1 = await api(T.priya, 'POST', '/resources/requests', { projectId: atlas.id, title: 'Senior React developer', skills: ['React', 'TypeScript', 'Payments UI'], allocation: 50, fromDate: addDays(today, 7), reason: 'Checkout revamp UAT is on the 15th — we need one more front-end developer.', preferredEmployeeId: E.kavya.id });
  const r2 = await api(T.priya, 'POST', '/resources/requests', { projectId: atlas.id, title: 'QA engineer', skills: ['Cypress'], allocation: 100, fromDate: addDays(today, 14), reason: 'Regression testing for the payments release.' });
  await api(T.ravi, 'POST', `/resources/requests/${r2.id}/hold`, { reason: 'Waiting for the client budget for QA', remindAt: addDays(today, 5) });
  const r3 = await api(T.priya, 'POST', '/resources/requests', { projectId: atlas.id, title: 'React developer', skills: ['React', 'Figma'], allocation: 100, fromDate: addDays(today, 10), reason: 'Design-system work for the merchant dashboard.', preferredEmployeeId: E.tanvi.id });
  await api(T.ravi, 'POST', `/resources/requests/${r3.id}/forward`, { note: 'Nobody free on my projects' });
  const suresh = await login('suresh');
  await api(suresh, 'POST', `/resources/requests/${r3.id}/forward`, { note: 'Agreed — Tanvi from the pool fits' });
  await api(T.priya, 'POST', '/resources/releases', { memberId: rohitM.id, reason: 'Backend work on Atlas is done', lastDate: addDays(today, 21), handover: 'Payments API docs are in Confluence; Priya takes over reviews.' });
  console.log(`resources-demo ready: ${Object.keys(E).length} people, 3 projects, requests ${r1.id.slice(0, 4)} ${r2.id.slice(0, 4)} ${r3.id.slice(0, 4)} + 1 release`);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
