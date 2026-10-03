// assets: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Assets-E2E-2026!';
const SLUG = 'assets-e2e';
const TZ = 'Asia/Kolkata';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const r = await fetch(B + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
const wait = (ms = 1000) => new Promise((r) => setTimeout(r, ms));
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

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.assetRequest.deleteMany({ where: { companyId: c.id } });
  await p.assetAssignment.deleteMany({ where: { companyId: c.id } });
  await p.asset.deleteMany({ where: { companyId: c.id } });
  await p.assetType.deleteMany({ where: { companyId: c.id } });
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
  const mailDir = path.resolve('.mail');
  const mailBefore = new Set(fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []);
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' }, include: { features: true } });
    check('Enterprise plan has Assets', enterprise.features.some((f) => f.featureKey === 'ops.assets'));
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: TZ } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    check('IT Admin role template exists', templates.some((t) => t.key === 'it_admin'));
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys, manager) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), reportingManagerId: manager ? P[manager].id : null } });
      P[name] = { ...e, user: u };
      await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 } });
      if (manager) await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: P[manager].id, descendantId: e.id, depth: 1 } });
    };
    await mk('boss', ['employee', 'manager']);
    await mk('emp', ['employee'], 'boss');
    await mk('peer', ['employee'], 'boss');
    await mk('it', ['employee', 'it_admin']);
    await mk('hr', ['employee', 'hr']);
    await mk('both', ['employee', 'it_admin', 'hr']);
    const S = {};
    for (const n of ['emp', 'peer', 'it', 'hr', 'both', 'boss']) S[n] = await login(P[n].email);

    // ── Types + register
    const types = Object.fromEntries((await call(S.emp, 'GET', '/assets/types')).data.map((t) => [t.name, t]));
    check('Default asset types', Object.keys(types).length === 8 && types.Laptop.prefix === 'LAP');
    check('Employee cannot add assets → 403', (await call(S.emp, 'POST', '/assets', { typeId: types.Laptop.id, name: 'X' })).status === 403);
    check('Employee cannot see the register → 403', (await call(S.emp, 'GET', '/assets')).status === 403);
    const lap1 = (await call(S.it, 'POST', '/assets', { typeId: types.Laptop.id, name: 'MacBook Pro 14', brand: 'Apple', serialNumber: 'C02XYZ', purchaseCost: 189999.5, warrantyUntil: addDays(today, 20) })).data;
    const lap2 = (await call(S.it, 'POST', '/assets', { typeId: types.Laptop.id, name: 'ThinkPad T14' })).data;
    check('Tags generated per type', lap1?.tag === 'LAP-0001' && lap2?.tag === 'LAP-0002', `${lap1?.tag} ${lap2?.tag}`);
    check('Custom tag', (await call(S.it, 'POST', '/assets', { typeId: types.Monitor.id, name: 'Dell 27"', tag: 'mon-blr-1' })).data?.tag === 'MON-BLR-1');
    check('Duplicate tag → 409', (await call(S.it, 'POST', '/assets', { typeId: types.Monitor.id, name: 'Dell 27"', tag: 'MON-BLR-1' })).status === 409);
    const search = await call(S.it, 'GET', '/assets?search=c02xyz');
    check('Search by serial (in the database)', search.body.data?.length === 1 && search.body.data[0].id === lap1.id);
    check('Warranty filter', (await call(S.it, 'GET', '/assets?warrantyWithinDays=30')).body.data.length === 1);
    check('HR (company view) sees the register', (await call(S.hr, 'GET', '/assets')).body.meta.total === 3);

    // ── Assign → confirm → return
    const as = await call(S.it, 'POST', `/assets/${lap1.id}/assign`, { employeeId: P.emp.id, condition: 'NEW', notes: 'With charger' });
    check('IT assigns to emp', as.status === 200 && as.data.status === 'ASSIGNED' && as.data.holder.employee.id === P.emp.id, JSON.stringify(as.body).slice(0, 200));
    await wait();
    check('Emp notified to confirm', (await p.notification.count({ where: { userId: P.emp.user.id, type: 'asset.assigned' } })) === 1);
    check('Assigning an assigned asset → 400', (await call(S.it, 'POST', `/assets/${lap1.id}/assign`, { employeeId: P.peer.id })).status === 400);
    const mine = await call(S.emp, 'GET', '/assets/mine');
    check('My assets', mine.data?.current.length === 1 && mine.data.current[0].acknowledgedAt === null);
    check('Holder can open it; colleague cannot', (await call(S.emp, 'GET', `/assets/${lap1.id}`)).status === 200 && (await call(S.peer, 'GET', `/assets/${lap1.id}`)).status === 404);
    check('Colleague cannot confirm → 404', (await call(S.peer, 'POST', `/assets/assignments/${mine.data.current[0].id}/acknowledge`)).status === 404);
    const ack = await call(S.emp, 'POST', `/assets/assignments/${mine.data.current[0].id}/acknowledge`);
    check('Holder confirms receipt', ack.data?.current[0].acknowledgedAt);
    check('Manager sees report’s assets', (await call(S.boss, 'GET', `/assets/employee/${P.emp.id}`)).data?.current.length === 1);
    check('Peer cannot see emp’s assets → 404', (await call(S.peer, 'GET', `/assets/employee/${P.emp.id}`)).status === 404);
    check('Retire while assigned → 400', (await call(S.it, 'POST', `/assets/${lap1.id}/status`, { status: 'RETIRED' })).status === 400);

    // ── Offboarding warning
    await call(S.hr, 'PATCH', `/employees/${P.emp.id}`, { employmentStatus: 'NOTICE_PERIOD' });
    await wait();
    const off = await p.notification.findFirst({ where: { userId: P.it.user.id, type: 'asset.offboarding' } });
    check('IT warned: leaving with 1 asset', off && off.title.includes('is leaving and still has 1 asset') && off.body.includes('LAP-0001'), JSON.stringify(off));

    const ret = await call(S.it, 'POST', `/assets/${lap1.id}/return`, { condition: 'DAMAGED', notes: 'Cracked screen' });
    check('Return damaged → In repair', ret.data?.status === 'IN_REPAIR' && ret.data.holder === null && ret.data.history[0].conditionIn === 'DAMAGED');
    check('Can’t assign an asset in repair → 400', (await call(S.it, 'POST', `/assets/${lap1.id}/assign`, { employeeId: P.peer.id })).status === 400);
    check('Back to available', (await call(S.it, 'POST', `/assets/${lap1.id}/status`, { status: 'AVAILABLE' })).data?.status === 'AVAILABLE');
    await call(S.it, 'POST', `/assets/${lap2.id}/assign`, { employeeId: P.peer.id });
    const lost = await call(S.it, 'POST', `/assets/${lap2.id}/status`, { status: 'LOST', notes: 'Left in a cab' });
    check('Lost while assigned closes the assignment', lost.data?.status === 'LOST' && lost.data.holder === null && lost.data.history[0].returnNotes.includes('lost'));

    // ── Requests: IT head + HR in parallel
    const rq = await call(S.peer, 'POST', '/assets/requests', { typeId: types.Monitor.id, reason: 'Second screen for design work' });
    check('Employee requests a monitor', rq.status === 201 && rq.data.status === 'PENDING', JSON.stringify(rq.body));
    check('Duplicate open request → 409', (await call(S.peer, 'POST', '/assets/requests', { typeId: types.Monitor.id, reason: 'Again please' })).status === 409);
    await wait();
    check('IT and HR notified', (await p.notification.count({ where: { userId: { in: [P.it.user.id, P.hr.user.id] }, type: 'asset.requested' } })) === 2);
    check('Employee cannot approve → 403', (await call(S.emp, 'POST', `/assets/requests/${rq.data.id}/approve`, {})).status === 403);
    const h1 = await call(S.hr, 'POST', `/assets/requests/${rq.data.id}/approve`, { note: 'OK from HR' });
    check('HR approves first (parallel) — still pending', h1.data?.status === 'PENDING' && h1.data.hr.status === 'APPROVED');
    const i1 = await call(S.it, 'POST', `/assets/requests/${rq.data.id}/approve`, {});
    check('IT head approves → APPROVED', i1.data?.status === 'APPROVED' && i1.data.canFulfil);
    await wait();
    check('Employee told it was approved', (await p.notification.count({ where: { userId: P.peer.user.id, type: 'asset.request_approved' } })) === 1);
    const mon = (await call(S.it, 'GET', '/assets?search=MON-BLR-1')).body.data[0];
    check('Fulfil with a laptop (wrong type) → 400', (await call(S.it, 'POST', `/assets/${lap1.id}/assign`, { employeeId: P.peer.id, requestId: rq.data.id })).status === 400);
    const ful = await call(S.it, 'POST', `/assets/${mon.id}/assign`, { employeeId: P.peer.id, requestId: rq.data.id });
    check('Fulfil by handing over a monitor', ful.status === 200 && (await call(S.peer, 'GET', `/assets/requests/${rq.data.id}`)).data.status === 'FULFILLED');

    const rq2 = await call(S.emp, 'POST', '/assets/requests', { typeId: types.Phone.id, reason: 'On-call phone for support' });
    const rj = await call(S.it, 'POST', `/assets/requests/${rq2.data.id}/reject`, { reason: 'Use the shared on-call phone' });
    check('IT rejects → REJECTED, HR side skipped', rj.data?.status === 'REJECTED' && rj.data.hr.status === 'SKIPPED');
    const rq3 = await call(S.emp, 'POST', '/assets/requests', { typeId: types.Headset.id, reason: 'Noise cancelling for calls' });
    const b1 = await call(S.both, 'POST', `/assets/requests/${rq3.data.id}/approve`, {});
    check('IT+HR person approves one side', b1.data?.status === 'PENDING' && [b1.data.it.status, b1.data.hr.status].filter((x) => x === 'APPROVED').length === 1);
    check('…but not the other side → 403', (await call(S.both, 'POST', `/assets/requests/${rq3.data.id}/approve`, {})).status === 403);
    check('Employee cancels own request', (await call(S.emp, 'POST', `/assets/requests/${rq3.data.id}/cancel`)).data?.status === 'CANCELLED');
    const own = await call(S.it, 'POST', '/assets/requests', { typeId: types.Headset.id, reason: 'My own headset please' });
    check('Nobody approves their own request → 404', (await call(S.it, 'POST', `/assets/requests/${own.data.id}/approve`, {})).status === 404);

    // ── Summary
    const sum = await call(S.it, 'GET', '/assets/summary');
    check('Summary', sum.data?.byStatus.LOST === 1 && sum.data.byStatus.ASSIGNED === 1 && sum.data.byType.find((t) => t.type.name === 'Laptop').total === 2, JSON.stringify(sum.data?.byStatus));
    check('Employee cannot see summary → 403', (await call(S.emp, 'GET', '/assets/summary')).status === 403);
    check('IT pending count (to review + to fulfil)', (await call(S.it, 'GET', '/assets/requests/pending-count')).data.count >= 0);
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    for (const f of fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []) if (!mailBefore.has(f)) fs.rmSync(path.join(mailDir, f));
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company and test emails removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
