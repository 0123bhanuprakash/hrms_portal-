// projects: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Projects-E2E-2026!';
const SLUG = 'projects-e2e';
const TZ = 'Asia/Kolkata';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const r = await fetch(B + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
const wait = (ms = 800) => new Promise((r) => setTimeout(r, ms));
async function login(email) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (r.status === 429) { await wait(15000); continue; }
    return { authorization: 'Bearer ' + (await r.json()).data.access_token, 'content-type': 'application/json' };
  }
  throw new Error('login throttled');
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const addDays = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = (off) => { let k = addDays(today, off); while (new Date(k + 'T00:00:00Z').getUTCDay() !== 1) k = addDays(k, 1); return k; };
const prevWorkday = (k) => { let x = addDays(k, -1); while ([0, 6].includes(new Date(x + 'T00:00:00Z').getUTCDay())) x = addDays(x, -1); return x; };
const names = (lvl) => lvl.approvers.map((a) => a.firstName).sort().join(',');

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.projectMember.deleteMany({ where: { companyId: c.id } });
  await p.project.deleteMany({ where: { companyId: c.id } });
  await p.attendanceRegularisation.deleteMany({ where: { companyId: c.id } });
  await p.attendanceRecord.deleteMany({ where: { companyId: c.id } });
  await p.leaveRequest.deleteMany({ where: { companyId: c.id } });
  await p.leaveBalance.deleteMany({ where: { companyId: c.id } });
  await p.leaveType.deleteMany({ where: { companyId: c.id } });
  await p.approvalDelegation.deleteMany({ where: { companyId: c.id } });
  await p.employeeHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.employee.updateMany({ where: { companyId: c.id }, data: { reportingManagerId: null } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await p.auditLog.deleteMany({ where: { OR: [{ companyId: c.id }, { userId: { in: ids } }] } });
  await p.userRole.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.role.deleteMany({ where: { companyId: c.id } });
  await p.companySettings.deleteMany({ where: { companyId: c.id } });
  await p.company.delete({ where: { id: c.id } });
}

(async () => {
  await cleanup();
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' }, include: { features: true } });
    check('Enterprise plan includes Projects', enterprise.features.some((f) => f.featureKey === 'work.projects'));
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: TZ } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    check('PMO role template exists', templates.some((t) => t.key === 'pmo'));
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys, manager) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), reportingManagerId: manager ? P[manager].id : null } });
      P[name] = { ...e, user: u };
    };
    // Plain "Employee" roles on purpose: approval power must come from the project
    await mk('head', ['employee', 'manager']);
    await mk('pm', ['employee'], 'head');
    await mk('pm2', ['employee'], 'head');
    await mk('lead', ['employee'], 'head');
    await mk('mem', ['employee'], 'head');
    await mk('mem2', ['employee'], 'head');
    await mk('other', ['employee'], 'head');
    await mk('pmo', ['employee', 'pmo']);
    await mk('hr', ['employee', 'hr']);
    for (const n of Object.keys(P)) {
      let depth = 0, cur = P[n];
      while (cur) {
        await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: cur.id, descendantId: P[n].id, depth } });
        cur = cur.reportingManagerId ? Object.values(P).find((x) => x.id === cur.reportingManagerId) : null;
        depth++;
      }
    }
    const S = {};
    for (const n of ['pmo', 'hr', 'head', 'pm', 'pm2', 'lead', 'mem', 'mem2', 'other']) S[n] = await login(P[n].email);
    const start = addDays(today, -30);

    // ── Projects + allocation (PMO only)
    check('HR cannot create projects → 403', (await call(S.hr, 'POST', '/projects', { name: 'Nope', code: 'NOPE', startDate: start })).status === 403);
    const apollo = (await call(S.pmo, 'POST', '/projects', { name: 'Apollo', code: 'apl', clientName: 'Acme', startDate: start })).data;
    const zeus = (await call(S.pmo, 'POST', '/projects', { name: 'Zeus', code: 'ZEUS', startDate: start })).data;
    check('PMO creates projects (code upper-cased)', apollo?.code === 'APL' && zeus?.id);
    check('Duplicate code → 409', (await call(S.pmo, 'POST', '/projects', { name: 'Xy', code: 'APL', startDate: start })).status === 409);
    const add = (proj, body) => call(S.pmo, 'POST', `/projects/${proj.id}/members`, { startDate: start, ...body });
    await add(apollo, { employeeId: P.pm.id, role: 'MANAGER', allocation: 50 });
    await add(apollo, { employeeId: P.lead.id, role: 'TEAM_LEAD', allocation: 100 });
    const memA = await add(apollo, { employeeId: P.mem.id, role: 'MEMBER', leadEmployeeId: P.lead.id, allocation: 80 });
    check('Member added with team lead', memA.status === 201 && memA.data.lead?.id === P.lead.id, JSON.stringify(memA.body));
    await add(apollo, { employeeId: P.mem2.id, role: 'MEMBER', allocation: 100 });
    await add(zeus, { employeeId: P.pm2.id, role: 'MANAGER', allocation: 100 });
    const over = await add(zeus, { employeeId: P.mem.id, role: 'MEMBER', allocation: 30 });
    check('Over 100% → blocked with free %', over.status === 400 && /20% is free/.test(over.body.detail), over.body.detail);
    check('Exactly 100% → allowed', (await add(zeus, { employeeId: P.mem.id, role: 'MEMBER', allocation: 20 })).status === 201);
    check('Same person twice on a project → 409', (await add(apollo, { employeeId: P.mem.id, role: 'MEMBER', allocation: 1 })).status === 409);
    check('Lead must be a team lead of the project → 400', (await add(apollo, { employeeId: P.other.id, role: 'MEMBER', leadEmployeeId: P.mem2.id, allocation: 10 })).status === 400);
    check('HR cannot assign people → 403', (await call(S.hr, 'POST', `/projects/${apollo.id}/members`, { employeeId: P.other.id, role: 'MEMBER', allocation: 10, startDate: start })).status === 403);
    const cap = await call(S.hr, 'GET', `/projects/capacity/${P.mem.id}`);
    check('Capacity: mem 100% allocated, 0 free, 2 projects', cap.data?.allocatedToday === 100 && cap.data.free === 0 && cap.data.assignments.length === 2, JSON.stringify(cap.data));
    check('Later, non-overlapping allocation is fine', (await add(zeus, { employeeId: P.other.id, role: 'MEMBER', allocation: 100, startDate: addDays(today, 200), endDate: addDays(today, 230) })).status === 201);
    check('Project list (any employee)', (await call(S.mem, 'GET', '/projects')).data?.length === 2);
    check('My projects', (await call(S.mem, 'GET', '/projects/mine')).data?.length === 2);

    const types = Object.fromEntries((await call(S.mem, 'GET', '/leave/types')).data.map((t) => [t.code, t]));
    const m1 = monday(8);
    const preview = (who, code, d1, d2 = d1) => call(S[who], 'POST', '/leave/requests/preview', { leaveTypeId: types[code].id, startDate: d1, endDate: d2 });
    const apply = (who, code, d1, reason = 'x y z') => call(S[who], 'POST', '/leave/requests', { leaveTypeId: types[code].id, startDate: d1, endDate: d1, reason });

    // ── 1 level: member → lead / PMs of both projects / line manager (any one)
    const pv = await preview('mem', 'SL', m1);
    check('Route preview: member on 2 projects (1 level)', pv.data?.route.mode === 'project' && names(pv.data.route.levels[0]) === 'head,lead,pm,pm2', JSON.stringify(pv.data?.route));
    const r1 = await apply('mem', 'SL', m1);
    await wait();
    check('Team lead (plain Employee role) sees it waiting', (await call(S.lead, 'GET', '/leave/requests?view=review')).data?.some((r) => r.id === r1.data.id));
    check('Other project’s PM is notified too', (await p.notification.count({ where: { userId: P.pm2.user.id, type: 'leave.submitted' } })) === 1);
    check('Unrelated colleague cannot approve → 403', (await call(S.other, 'POST', `/leave/requests/${r1.data.id}/approve`, {})).status === 403);
    const a1 = await call(S.pm2, 'POST', `/leave/requests/${r1.data.id}/approve`, {});
    check('Any one (Zeus PM) approves → done', a1.data?.status === 'APPROVED', JSON.stringify(a1.body));

    // ── 2 levels: lead first, then PM; nobody decides twice
    const cl = types.CL;
    await call(S.hr, 'PATCH', `/leave/types/${cl.id}`, { ...cl, id: undefined, approvalLevels: 2 });
    const pv2 = await preview('mem', 'CL', addDays(m1, 1));
    check('2-level route: lead (+Zeus PM) then PM, line manager in both', names(pv2.data.route.levels[0]) === 'head,lead,pm2' && names(pv2.data.route.levels[1]) === 'head,pm', JSON.stringify(pv2.data.route));
    const r2 = await apply('mem', 'CL', addDays(m1, 1));
    check('PM cannot jump to level 1 → 403', (await call(S.pm, 'POST', `/leave/requests/${r2.data.id}/approve`, {})).status === 403);
    await call(S.head, 'POST', `/leave/requests/${r2.data.id}/approve`, {});
    check('Line manager approved level 1 → cannot approve level 2', (await call(S.head, 'POST', `/leave/requests/${r2.data.id}/approve`, {})).status === 403);
    const a2 = await call(S.pm, 'POST', `/leave/requests/${r2.data.id}/approve`, {});
    check('PM approves level 2 → APPROVED', a2.data?.status === 'APPROVED' && a2.data.approvals[0].label.includes('Team lead · Apollo'), JSON.stringify(a2.body).slice(0, 300));

    // ── Team lead → PM (or line manager)
    const pvLead = await preview('lead', 'SL', addDays(m1, 2));
    check('Team lead → PM + line manager', names(pvLead.data.route.levels[0]) === 'head,pm', JSON.stringify(pvLead.data.route));
    const rl = await apply('lead', 'SL', addDays(m1, 2));
    check('Lead cannot approve own → 404', (await call(S.lead, 'POST', `/leave/requests/${rl.data.id}/approve`, {})).status === 404);
    check('PM approves the lead', (await call(S.pm, 'POST', `/leave/requests/${rl.data.id}/approve`, {})).data?.status === 'APPROVED');

    // ── PM → reporting manager
    const pvPm = await preview('pm', 'SL', addDays(m1, 3));
    check('PM → reporting manager', pvPm.data.route.mode === 'reporting_line' && names(pvPm.data.route.levels[0]) === 'head', JSON.stringify(pvPm.data.route));
    // ── Member without a lead → PM
    check('Member without a lead → PM + line manager', names((await preview('mem2', 'SL', addDays(m1, 3))).data.route.levels[0]) === 'head,pm');
    // ── Not on a project (or project starts later) → reporting line
    check('Not on a project during the dates → line manager', (await preview('other', 'SL', addDays(m1, 3))).data.route.mode === 'reporting_line');
    check('…but on the project later → project route', (await preview('other', 'SL', addDays(today, 210))).data.route.mode === 'project');

    // ── Delegation by a project-only lead
    const del = await call(S.lead, 'POST', '/delegations', { delegateId: P.other.user.id, endsAt: new Date(Date.now() + 3 * 864e5).toISOString() });
    check('Project-only lead can delegate', del.status === 201 && del.data.permissions.some((x) => x.key === 'leave.approve'), JSON.stringify(del.body));
    const O2 = await login(P.other.email);
    const r3 = await apply('mem', 'SL', addDays(m1, 4));
    const d3 = await call(O2, 'POST', `/leave/requests/${r3.data.id}/approve`, {});
    check('Delegate approves on behalf of the lead', d3.data?.status === 'APPROVED' && d3.data.approvals[0].onBehalfOf?.id === P.lead.user.id, JSON.stringify(d3.body).slice(0, 300));

    // ── Attendance correction follows the project too
    const y1 = prevWorkday(today);
    const corr = await call(S.mem, 'POST', '/attendance/regularisations', { date: y1, checkIn: '09:30', checkOut: '18:30', reason: 'Card reader' });
    check('Correction saved with project approvers', corr.status === 201);
    const L2 = await login(P.lead.email);
    check('Lead sees correction to review', (await call(L2, 'GET', '/attendance/regularisations?view=review')).data?.length === 1);
    check('Lead pending count = 1', (await call(L2, 'GET', '/attendance/regularisations/pending-count')).data?.count === 1);
    check('Unrelated colleague: empty review list', (await call(S.mem2, 'GET', '/attendance/regularisations?view=review')).data?.length === 0);
    const ca = await call(L2, 'POST', `/attendance/regularisations/${corr.data.id}/approve`, {});
    check('Lead approves the correction', ca.data?.status === 'APPROVED', JSON.stringify(ca.body));

    // ── Removing a lead hands their members to the PM
    const leadRow = (await call(S.pmo, 'GET', `/projects/${apollo.id}`)).data.members.find((m) => m.employee.id === P.lead.id);
    const rm = await call(S.pmo, 'DELETE', `/projects/${apollo.id}/members/${leadRow.id}`);
    check('Removing a lead clears their members’ lead', rm.data?.unassignedMembers === 1, JSON.stringify(rm.body));
    check('…so the member now goes to the PM', names((await preview('mem', 'SL', addDays(m1, 5))).data.route.levels[0]) === 'head,pm,pm2');
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
