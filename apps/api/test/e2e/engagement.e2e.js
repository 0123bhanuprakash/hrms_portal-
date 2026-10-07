// engagement: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Engage-E2E-2026!';
const SLUG = 'engage-e2e';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const isForm = b instanceof FormData;
  const headers = { ...h }; if (isForm) delete headers['content-type'];
  const r = await fetch(B + u, { method: m, headers, body: b ? (isForm ? b : JSON.stringify(b)) : undefined });
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('json')) return { status: r.status, raw: Buffer.from(await r.arrayBuffer()) };
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
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.kudos.deleteMany({ where: { companyId: c.id } });
  await p.kudosValue.deleteMany({ where: { companyId: c.id } });
  await p.announcement.deleteMany({ where: { companyId: c.id } });
  await p.departmentHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.department.deleteMany({ where: { companyId: c.id } });
  await p.officeLocation.deleteMany({ where: { companyId: c.id } });
  await p.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await p.auditLog.deleteMany({ where: { OR: [{ companyId: c.id }, { userId: { in: ids } }] } });
  await p.userRole.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.role.deleteMany({ where: { companyId: c.id } });
  await p.companySettings.deleteMany({ where: { companyId: c.id } });
  await p.company.delete({ where: { id: c.id } });
  fs.rmSync(path.resolve('private-files', c.id), { recursive: true, force: true });
}

(async () => {
  await cleanup();
  const mailDir = path.resolve('.mail');
  const mailBefore = new Set(fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []);
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' }, include: { features: true } });
    check('Enterprise plan has announcements + kudos', ['engage.announcements', 'engage.kudos'].every((k) => enterprise.features.some((f) => f.featureKey === k)));
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: {} } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const ops = await p.department.create({ data: { companyId: company.id, name: 'Operations', code: 'OPS' } });
    const eng = await p.department.create({ data: { companyId: company.id, name: 'Engineering', code: 'ENG', parentDepartmentId: ops.id } });
    const sales = await p.department.create({ data: { companyId: company.id, name: 'Sales', code: 'SALES' } });
    for (const d of [ops, eng, sales]) await p.departmentHierarchy.create({ data: { companyId: company.id, ancestorId: d.id, descendantId: d.id, depth: 0 } });
    await p.departmentHierarchy.create({ data: { companyId: company.id, ancestorId: ops.id, descendantId: eng.id, depth: 1 } });
    const blr = await p.officeLocation.create({ data: { companyId: company.id, name: 'Bengaluru' } });
    const mum = await p.officeLocation.create({ data: { companyId: company.id, name: 'Mumbai' } });
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys, departmentId, locationId) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), departmentId, locationId } });
      P[name] = { ...e, user: u };
    };
    await mk('hr', ['employee', 'hr'], ops.id, blr.id);
    await mk('dev', ['employee'], eng.id, blr.id);
    await mk('dev2', ['employee'], eng.id, mum.id);
    await mk('seller', ['employee'], sales.id, mum.id);
    const H = await login(P.hr.email), D = await login(P.dev.email), D2 = await login(P.dev2.email), S = await login(P.seller.email);
    const inbox = (name, type) => p.notification.findMany({ where: { userId: P[name].user.id, ...(type && { type }) } });

    // ── Announcements
    check('Employee cannot post → 403', (await call(D, 'POST', '/announcements', { title: 'Hello', body: 'World!', audience: 'COMPANY' })).status === 403);
    const a1 = await call(H, 'POST', '/announcements', { title: 'New leave policy', body: 'Please read the attached policy.\nIt starts next month.', audience: 'COMPANY', pinned: true, requiresAck: true, sendEmail: true });
    check('HR posts company-wide (pinned, needs ack, emailed)', a1.status === 201 && a1.data.pinned, JSON.stringify(a1.body));
    await wait(1500);
    const n1 = await inbox('dev', 'announcement.posted');
    check('Everyone notified (not the author), emailed as chosen', n1.length === 1 && n1[0].emailedAt && (await inbox('seller', 'announcement.posted')).length === 1 && (await inbox('hr', 'announcement.posted')).length === 0);
    const a2 = await call(H, 'POST', '/announcements', { title: 'Ops town hall', body: 'Friday 4 pm in the big room.', audience: 'DEPARTMENTS', departmentIds: [ops.id], sendEmail: false });
    await wait(1200);
    const n2 = (await inbox('dev', 'announcement.posted')).find((n) => n.title.includes('town hall'));
    check('Department audience includes sub-departments; in-app only (no email)', n2 && !n2.emailedAt && (await inbox('seller', 'announcement.posted')).length === 1);
    check('Outside the audience → 404', (await call(S, 'GET', `/announcements/${a2.data.id}`)).status === 404);
    const a3 = await call(H, 'POST', '/announcements', { title: 'Mumbai parking', body: 'New passes at reception.', audience: 'LOCATIONS', locationIds: [mum.id] });
    await wait(1200);
    check('Location audience', (await inbox('dev2', 'announcement.posted')).length === 3 && (await inbox('dev', 'announcement.posted')).length === 2);
    check('Departments audience without departments → 400', (await call(H, 'POST', '/announcements', { title: 'Oops', body: 'No targets', audience: 'DEPARTMENTS' })).status === 400);
    check('Expiry in the past → 400', (await call(H, 'POST', '/announcements', { title: 'Old', body: 'Old news', audience: 'COMPANY', expiresAt: '2020-01-01T00:00:00Z' })).status === 400);

    const listDev = await call(D, 'GET', '/announcements');
    check('Dev sees 2 (company + ops), pinned first, unread 2, needs ack 1', listDev.body.data.length === 2 && listDev.body.data[0].id === a1.data.id && listDev.body.meta.unread === 2 && listDev.body.meta.needsAck === 1, JSON.stringify(listDev.body.meta));
    const opened = await call(D, 'GET', `/announcements/${a1.data.id}`);
    check('Opening marks it read', opened.data.readAt && (await call(D, 'GET', '/announcements')).body.meta.unread === 1);
    check('Ack filter lists it', (await call(D, 'GET', '/announcements?filter=ack')).body.data.length === 1);
    const ack = await call(D, 'POST', `/announcements/${a1.data.id}/acknowledge`);
    check('Acknowledge', ack.data?.acknowledgedAt && (await call(D, 'GET', '/announcements')).body.meta.needsAck === 0);
    check('Ack on a post that doesn’t need it → 400', (await call(D, 'POST', `/announcements/${a2.data.id}/acknowledge`)).status === 400);
    const rep = await call(H, 'GET', `/announcements/${a1.data.id}/report`);
    check('Report: 3 in audience, 1 read, 1 acknowledged', rep.data?.total === 3 && rep.data.read === 1 && rep.data.acknowledged === 1, JSON.stringify(rep.data && { t: rep.data.total, r: rep.data.read, a: rep.data.acknowledged }));
    check('Employee cannot see the report → 403', (await call(D, 'GET', `/announcements/${a1.data.id}/report`)).status === 403);

    const f = new FormData(); f.append('file', new Blob([PDF], { type: 'application/pdf' }), 'leave-policy.pdf');
    check('HR attaches a PDF', (await call(H, 'POST', `/announcements/${a1.data.id}/attachment`, f)).status === 201);
    const dl = await call(D, 'GET', `/announcements/${a1.data.id}/attachment`);
    check('Audience downloads it', dl.status === 200 && dl.raw?.equals(PDF));
    const f2 = new FormData(); f2.append('file', new Blob([PDF], { type: 'application/pdf' }), 'x.pdf');
    await call(H, 'POST', `/announcements/${a2.data.id}/attachment`, f2);
    check('Outside the audience cannot download → 404', (await call(S, 'GET', `/announcements/${a2.data.id}/attachment`)).status === 404);

    await call(H, 'PATCH', `/announcements/${a3.data.id}`, { title: 'Mumbai parking', body: 'Ended.', audience: 'LOCATIONS', locationIds: [mum.id], expiresAt: new Date(Date.now() + 2000).toISOString() });
    await wait(2500);
    check('Expired: hidden for readers', !(await call(D2, 'GET', '/announcements')).body.data.some((a) => a.id === a3.data.id));
    check('…but posters can include it', (await call(H, 'GET', '/announcements?includeExpired=true')).body.data.some((a) => a.id === a3.data.id && a.expired));
    check('Employee cannot delete → 403', (await call(D, 'DELETE', `/announcements/${a2.data.id}`)).status === 403);
    check('HR deletes', (await call(H, 'DELETE', `/announcements/${a2.data.id}`)).status === 200 && (await call(D, 'GET', `/announcements/${a2.data.id}`)).status === 404);

    // ── Kudos
    const values = (await call(D, 'GET', '/kudos/values')).data;
    check('Default values created', values?.length === 5);
    const team = values.find((v) => v.name === 'Teamwork');
    const k1 = await call(D, 'POST', '/kudos', { recipientIds: [P.dev2.id, P.seller.id], message: 'Thanks for staying late on the release!', valueId: team.id });
    check('Give kudos to two people', k1.status === 201 && k1.data.recipients.length === 2 && k1.data.value.name === 'Teamwork', JSON.stringify(k1.body));
    await wait();
    const kn = await inbox('dev2', 'kudos.received');
    check('Recipients notified in-app (no email)', kn.length === 1 && !kn[0].emailedAt && kn[0].title.includes('🤝 Teamwork'), JSON.stringify(kn[0]));
    check('Notification opens this kudos', kn[0]?.link === `/app/kudos/${k1.data.id}`, kn[0]?.link);
    const one = await call(H, 'GET', `/kudos/${k1.data.id}`);
    check('Open one kudos (its own page)', one.status === 200 && one.data.id === k1.data.id && one.data.recipients.length === 2 && one.data.canThank === true, JSON.stringify(one.body).slice(0, 300));
    check('Unknown kudos → 404', (await call(S, 'GET', `/kudos/${P.dev.id}`)).status === 404);
    check('Kudos to yourself → 400', (await call(D, 'POST', '/kudos', { recipientIds: [P.dev.id], message: 'I am great' })).status === 400);
    check('No recipients → 400', (await call(D, 'POST', '/kudos', { recipientIds: [], message: 'Hello there' })).status === 400);
    check('Unknown value → 404', (await call(D, 'POST', '/kudos', { recipientIds: [P.dev2.id], message: 'Hello there', valueId: P.dev.id })).status === 404);
    check('Everyone sees the feed', (await call(S, 'GET', '/kudos')).body.data.length === 1);
    check('Filter: received by dev2', (await call(D, 'GET', `/kudos?employeeId=${P.dev2.id}`)).body.data.length === 1 && (await call(D, 'GET', `/kudos?employeeId=${P.dev.id}`)).body.data.length === 0);
    const r1 = await call(S, 'POST', `/kudos/${k1.data.id}/reactions`, { emoji: '🎉' });
    await call(D2, 'POST', `/kudos/${k1.data.id}/reactions`, { emoji: '🎉' });
    const r2 = await call(S, 'POST', `/kudos/${k1.data.id}/reactions`, { emoji: '🎉' });
    check('Reactions toggle with counts', r1.data.reactions[0].count === 1 && r1.data.reactions[0].mine && r2.data.reactions[0].count === 1 && !r2.data.reactions[0].mine, JSON.stringify(r2.data?.reactions));
    check('Unknown reaction → 400', (await call(S, 'POST', `/kudos/${k1.data.id}/reactions`, { emoji: '💩' })).status === 400);
    const st = await call(S, 'GET', `/kudos/stats/${P.dev2.id}`);
    check('Stats: received 1, Teamwork', st.data?.received === 1 && st.data.values[0]?.value.name === 'Teamwork', JSON.stringify(st.data));
    check('Someone else cannot remove → 403', (await call(S, 'DELETE', `/kudos/${k1.data.id}`)).status === 403);
    check('Giver can take it back', (await call(D, 'DELETE', `/kudos/${k1.data.id}`)).status === 200 && (await call(S, 'GET', '/kudos')).body.data.length === 0);
    const k2 = await call(S, 'POST', '/kudos', { recipientIds: [P.dev.id], message: 'Something not ok' });
    check('Removed kudos → 404', (await call(S, 'GET', `/kudos/${k1.data.id}`)).status === 404);
    check('HR (kudos.manage) can remove any', (await call(H, 'DELETE', `/kudos/${k2.data.id}`)).status === 200);
    check('Employee cannot add values → 403', (await call(D, 'POST', '/kudos/values', { name: 'Speed', emoji: '⚡' })).status === 403);
    check('HR adds a value', (await call(H, 'POST', '/kudos/values', { name: 'Speed', emoji: '⚡' })).status === 201);
    check('Duplicate value → 409', (await call(H, 'POST', '/kudos/values', { name: 'Speed', emoji: '⚡' })).status === 409);
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    for (const f of fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []) if (!mailBefore.has(f)) fs.rmSync(path.join(mailDir, f));
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company and test emails removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
