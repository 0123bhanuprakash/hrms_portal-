// helpdesk topics (icon, starting priority, route-to, questions, quick answer): run with test/e2e/run.js.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Topics-E2E-2026!';
const SLUG = 'helpdesk-topics-e2e';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const wait = (ms = 1000) => new Promise((r) => setTimeout(r, ms));
const call = async (h, m, u, b) => {
  const r = await fetch(B + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
async function login(email) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (r.status === 429) { await wait(15000); continue; }
    return { authorization: 'Bearer ' + (await r.json()).data.access_token, 'content-type': 'application/json' };
  }
  throw new Error('login throttled');
}

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.ticketMessage.deleteMany({ where: { companyId: c.id } });
  await p.ticket.deleteMany({ where: { companyId: c.id } });
  await p.ticketCategory.deleteMany({ where: { companyId: c.id } });
  await p.helpdeskTeam.deleteMany({ where: { companyId: c.id } });
  await p.assetAssignment.deleteMany({ where: { companyId: c.id } });
  await p.asset.deleteMany({ where: { companyId: c.id } });
  await p.assetType.deleteMany({ where: { companyId: c.id } });
  await p.employeeHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await p.auditLog.deleteMany({ where: { OR: [{ companyId: c.id }, { userId: { in: ids } }] } });
  await p.userRole.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.role.deleteMany({ where: { companyId: c.id } });
  await p.companySettings.deleteMany({ where: { companyId: c.id } });
  await p.company.delete({ where: { id: c.id } });
}

/** Raise a ticket the way the web app does (multipart). */
async function raise(h, fields) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  const r = await fetch(B + '/helpdesk/tickets', { method: 'POST', headers: { authorization: h.authorization }, body: form });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
}

(async () => {
  await cleanup();
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: 'Asia/Kolkata' } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01') } });
      await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 } });
      P[name] = { ...e, user: u };
    };
    await mk('emp', ['employee']);
    await mk('other', ['employee']);
    await mk('it1', ['employee', 'it_admin']);
    await mk('it2', ['employee', 'it_admin']);
    const H = {};
    for (const n of Object.keys(P)) H[n] = await login(`${n}@${SLUG}.test`);

    // A laptop held by emp, one held by someone else
    const type = await p.assetType.create({ data: { companyId: company.id, name: 'Laptop', prefix: 'LAP' } });
    const mine = await p.asset.create({ data: { companyId: company.id, typeId: type.id, tag: 'LAP-0042', name: 'MacBook Pro', status: 'ASSIGNED' } });
    const theirs = await p.asset.create({ data: { companyId: company.id, typeId: type.id, tag: 'LAP-0043', name: 'ThinkPad', status: 'ASSIGNED' } });
    await p.assetAssignment.create({ data: { companyId: company.id, assetId: mine.id, employeeId: P.emp.id, assignedAt: new Date(), conditionOut: 'GOOD' } });
    await p.assetAssignment.create({ data: { companyId: company.id, assetId: theirs.id, employeeId: P.other.id, assignedAt: new Date(), conditionOut: 'GOOD' } });

    // ── Starter topics, now with icons — DevOps included ──
    const all = await call(H.it1, 'GET', '/helpdesk/categories?all=true');
    check('Starter topics for all 4 teams', ['IT', 'HR', 'FINANCE', 'DEVOPS'].every((q) => all.data?.some((c) => c.queue === q)), all.status);
    const vpn = all.data?.find((c) => c.queue === 'IT' && c.name === 'Network / VPN');
    check('Starter topics have icon + help line', vpn?.icon === '📶' && Boolean(vpn?.description));
    check('Agents get use counts', vpn?.used30 === 0);

    // ── Editing a topic ──
    const base = { queue: 'IT', name: 'Network / VPN' };
    check('Route-to must work the queue', (await call(H.it1, 'PATCH', `/helpdesk/categories/${vpn.id}`, { ...base, routeToId: P.emp.user.id })).status === 400);
    check('Choice needs 2+ options', (await call(H.it1, 'PATCH', `/helpdesk/categories/${vpn.id}`, { ...base, questions: [{ id: 'where', label: 'Where?', kind: 'choice', options: ['Home'], required: true }] })).status === 400);
    check('Only one device question', (await call(H.it1, 'PATCH', `/helpdesk/categories/${vpn.id}`, { ...base, questions: [{ id: 'd1', label: 'Device', kind: 'device', required: true }, { id: 'd2', label: 'Other device', kind: 'device', required: false }] })).status === 400);
    check('Bad question id refused', (await call(H.it1, 'PATCH', `/helpdesk/categories/${vpn.id}`, { ...base, questions: [{ id: 'Where Are You', label: 'Where?', kind: 'text', required: true }] })).status === 400);
    const questions = [
      { id: 'where', label: 'Where do you work from?', kind: 'choice', options: ['Office', 'Home', 'Client site'], required: true },
      { id: 'since', label: 'Since when?', kind: 'text', required: false },
      { id: 'device', label: 'Which device?', kind: 'device', required: true },
    ];
    const saved = await call(H.it1, 'PATCH', `/helpdesk/categories/${vpn.id}`, {
      ...base, icon: '🛜', description: 'Wi-Fi, VPN, slow internet in office', defaultPriority: 'HIGH', routeToId: P.it2.user.id, questions,
      quickAnswer: 'VPN drops after a Windows update? Reinstall the VPN app from Company Portal, then restart your laptop.',
    });
    check('Topic saved with all the new settings', saved.status === 200 && saved.data?.icon === '🛜' && saved.data?.defaultPriority === 'HIGH' && saved.data?.routeToId === P.it2.user.id && saved.data?.questions.length === 3, saved.status + ' ' + JSON.stringify(saved.body.message ?? ''));
    check('HR agent can’t edit IT topics', (await call(H.emp, 'PATCH', `/helpdesk/categories/${vpn.id}`, { ...base, icon: 'x' })).status === 403);

    // ── What employees see ──
    const forEmp = await call(H.emp, 'GET', '/helpdesk/categories');
    const t = forEmp.data?.find((c) => c.id === vpn.id);
    check('Employee sees icon, questions, quick answer, who gets it', t?.icon === '🛜' && t?.questions.length === 3 && Boolean(t?.quickAnswer) && t?.routeTo?.firstName === 'it2');
    check('…but not the agent stats', t?.used30 === undefined && t?.helpedCount === undefined);

    // ── Quick answers while typing ──
    const a1 = await call(H.emp, 'GET', '/helpdesk/answers?q=' + encodeURIComponent('my vpn keeps dropping after update'));
    check('Quick answer found while typing', a1.data?.topics[0]?.id === vpn.id, JSON.stringify(a1.data));
    check('Too-short search refused', (await call(H.emp, 'GET', '/helpdesk/answers?q=a')).status === 400);
    check('“That helped” counts', (await call(H.emp, 'POST', `/helpdesk/categories/${vpn.id}/helped`)).status === 200 && (await p.ticketCategory.findUnique({ where: { id: vpn.id } })).helpedCount === 1);

    // ── Raising a ticket on the topic ──
    const fields = { queue: 'IT', categoryId: vpn.id, subject: 'VPN keeps dropping', description: 'Every 20 minutes since the update' };
    check('Required answer missing → refused', (await raise(H.emp, { ...fields, answers: { device: mine.id } })).status === 400);
    check('Not one of the choices → refused', (await raise(H.emp, { ...fields, answers: { where: 'Mars', device: mine.id } })).status === 400);
    check('Someone else’s device → refused', (await raise(H.emp, { ...fields, answers: { where: 'Home', device: theirs.id } })).status === 400);
    check('Broken answers JSON → refused', (await raise(H.emp, { ...fields, answers: '{nope' })).status === 400);
    const ok = await raise(H.emp, { ...fields, answers: { where: 'Home', since: 'This morning', device: mine.id } });
    check('Ticket raised with answers', ok.status === 201, ok.status + ' ' + JSON.stringify(ok.body.message ?? ''));
    check('Starts at the topic’s priority', ok.data?.priority === 'HIGH');
    check('Goes straight to the topic’s person', ok.data?.assignee?.id === P.it2.user.id);
    check('Answers saved as asked', JSON.stringify(ok.data?.answers) === JSON.stringify([{ label: 'Where do you work from?', answer: 'Home' }, { label: 'Since when?', answer: 'This morning' }, { label: 'Which device?', answer: 'LAP-0042 · MacBook Pro' }]));
    check('Device linked to the ticket', ok.data?.asset?.tag === 'LAP-0042');
    check('Employee’s own choice of priority wins', (await raise(H.emp, { ...fields, priority: 'LOW', answers: { where: 'Office', device: mine.id } })).data?.priority === 'LOW');
    await wait(500);
    const n = await p.notification.findMany({ where: { userId: { in: [P.it1.user.id, P.it2.user.id] }, type: 'ticket.created' } });
    check('Only the routed person is told', n.length >= 1 && n.every((x) => x.userId === P.it2.user.id && x.title.startsWith('New ticket for you')), JSON.stringify(n.map((x) => x.userId)));
    check('“Sent straight to” shows in the conversation', (await call(H.it2, 'GET', `/helpdesk/tickets/${ok.data?.id}`)).data?.messages.some((m) => m.kind === 'EVENT' && m.body.startsWith('Sent straight to it2 T')));

    // ── Own solved tickets show up as answers (only your own) ──
    await call(H.it2, 'POST', `/helpdesk/tickets/${ok.data?.id}/resolve`, { resolution: 'Updated the VPN app' });
    check('Your solved ticket shows while typing', (await call(H.emp, 'GET', '/helpdesk/answers?q=vpn%20dropping')).data?.tickets.some((x) => x.id === ok.data?.id));
    check('…but never someone else’s', !(await call(H.other, 'GET', '/helpdesk/answers?q=vpn%20dropping')).data?.tickets.length);

    // ── Team directory (reply times + head) for employees ──
    await p.helpdeskTeam.create({ data: { companyId: company.id, queue: 'IT', headId: P.it1.user.id } });
    for (const mins of [30, 90, 120]) {
      await p.ticket.create({ data: { companyId: company.id, number: 900 + mins, queue: 'IT', employeeId: P.other.id, subject: 'Old one', description: 'Old ticket for reply time', firstResponseDueAt: new Date(), resolutionDueAt: new Date(), createdAt: new Date(Date.now() - 86400_000), firstRespondedAt: new Date(Date.now() - 86400_000 + mins * 60_000), status: 'CLOSED' } });
    }
    const dir = await call(H.emp, 'GET', '/helpdesk/directory');
    const itDir = dir.data?.find((d) => d.queue === 'IT');
    check('Directory lists all 4 teams', dir.data?.map((d) => d.queue).join() === 'IT,HR,FINANCE,DEVOPS', dir.status);
    check('IT: usual reply time (median) and head', itDir?.typicalReplyMinutes >= 30 && itDir?.typicalReplyMinutes <= 120 && itDir?.head?.firstName === 'it1', JSON.stringify(itDir));
    check('Teams with too few tickets show no time', dir.data?.find((d) => d.queue === 'HR')?.typicalReplyMinutes === null);
    await p.helpdeskTeam.deleteMany({ where: { companyId: company.id } });

    // ── Reorder ──
    const it = all.data.filter((c) => c.queue === 'IT');
    check('Reorder needs every topic once', (await call(H.it1, 'POST', '/helpdesk/categories/reorder', { queue: 'IT', ids: it.slice(1).map((c) => c.id) })).status === 400);
    const reversed = [...it].reverse().map((c) => c.id);
    const ro = await call(H.it1, 'POST', '/helpdesk/categories/reorder', { queue: 'IT', ids: reversed });
    check('Reorder saves the new order', ro.status === 200 && ro.data?.map((c) => c.id).join() === reversed.join(), ro.status);
    check('Use count went up', ro.data?.find((c) => c.id === vpn.id)?.used30 === 2);
    check('Can’t reorder another team', (await call(H.it1, 'POST', '/helpdesk/categories/reorder', { queue: 'HR', ids: [vpn.id] })).status === 403);

    // ── Route-to person leaves the queue → falls back to the team ──
    await p.userRole.deleteMany({ where: { userId: P.it2.user.id, roleId: roles.it_admin } });
    const fb = await raise(H.emp, { ...fields, answers: { where: 'Home', device: mine.id } });
    check('Route-to person no longer in the queue → stays unassigned', fb.status === 201 && fb.data?.assignee === null, fb.status);
  } catch (err) {
    check('No crash', false, err.stack);
  } finally {
    await cleanup().catch((e) => console.error(e));
    await p.$disconnect();
    const failed = results.filter((r) => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();
