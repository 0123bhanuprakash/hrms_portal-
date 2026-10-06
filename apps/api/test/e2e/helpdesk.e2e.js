// helpdesk: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Helpdesk-E2E-2026!';
const SLUG = 'helpdesk-e2e';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const r = await fetch(B + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
const upload = async (h, u, fields, file) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  if (file) form.append('file', new Blob([file.buf], { type: file.type }), file.name);
  const r = await fetch(B + u, { method: 'POST', headers: { authorization: h.authorization }, body: form });
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
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.ticketMessage.deleteMany({ where: { companyId: c.id } });
  await p.ticket.deleteMany({ where: { companyId: c.id } });
  await p.ticketCategory.deleteMany({ where: { companyId: c.id } });
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
  fs.rmSync(path.resolve('private-files', c.id, 'helpdesk'), { recursive: true, force: true });
}

(async () => {
  await cleanup();
  const mailDir = path.resolve('.mail');
  const mailBefore = new Set(fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []);
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' }, include: { features: true } });
    check('Enterprise plan has Helpdesk', enterprise.features.some((f) => f.featureKey === 'ops.helpdesk'));
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: 'Asia/Kolkata' } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: { include: { permission: true } } } });
    check('IT Admin template works the IT queue', templates.find((t) => t.key === 'it_admin')?.rolePermissions.some((rp) => rp.permission.key === 'ticket.handle_it'));
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01') } });
      P[name] = { ...e, user: u };
      await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 } });
    };
    await mk('emp', ['employee']);
    await mk('peer', ['employee', 'manager']);
    await mk('it1', ['employee', 'it_admin']);
    await mk('it2', ['employee', 'it_admin']);
    await mk('hr', ['employee', 'hr']);
    await mk('fin', ['employee', 'finance']);
    const S = {};
    for (const n of Object.keys(P)) S[n] = await login(P[n].email);

    // ── Categories
    const cats = (await call(S.emp, 'GET', '/helpdesk/categories')).data;
    check('Default categories for 4 queues (incl. DevOps)', cats?.length === 21 && new Set(cats.map((c) => c.queue)).size === 4);
    const cat = (q, n) => cats.find((c) => c.queue === q && c.name === n);
    check('Employee cannot add categories → 403', (await call(S.emp, 'POST', '/helpdesk/categories', { queue: 'IT', name: 'Printers' })).status === 403);
    check('HR cannot add IT categories → 403', (await call(S.hr, 'POST', '/helpdesk/categories', { queue: 'IT', name: 'Printers' })).status === 403);
    check('IT adds an IT category', (await call(S.it1, 'POST', '/helpdesk/categories', { queue: 'IT', name: 'Printers' })).status === 201);

    // ── Raise
    check('Wrong-queue category → 400', (await upload(S.emp, '/helpdesk/tickets', { queue: 'HR', categoryId: cat('IT', 'Network / VPN').id, subject: 'VPN keeps dropping', description: 'Disconnects every 10 minutes since Monday.' })).status === 400);
    check('Employee can’t pick Urgent → 400', (await upload(S.emp, '/helpdesk/tickets', { queue: 'IT', subject: 'VPN keeps dropping', description: 'Disconnects every 10 minutes since Monday.', priority: 'URGENT' })).status === 400);
    const t1r = await upload(S.emp, '/helpdesk/tickets', { queue: 'IT', categoryId: cat('IT', 'Network / VPN').id, subject: 'VPN keeps dropping', description: 'Disconnects every 10 minutes since Monday.', priority: 'HIGH' }, { buf: PNG, type: 'image/png', name: 'screenshot.png' });
    const t1 = t1r.data;
    check('Raise IT ticket with screenshot', t1r.status === 201 && t1.number === 1 && t1.status === 'OPEN' && t1.messages.length === 1 && t1.messages[0].fileName === 'screenshot.png', JSON.stringify(t1r.body).slice(0, 300));
    const dueH = (new Date(t1.firstResponseDueAt) - new Date(t1.createdAt)) / 3600_000;
    check('High priority: 4h response target', Math.round(dueH) === 4);
    const bad = await upload(S.emp, '/helpdesk/tickets', { queue: 'IT', subject: 'Exe file attached', description: 'Here is the installer you asked for.' }, { buf: Buffer.from('MZ fake exe'), type: 'application/octet-stream', name: 'setup.exe' });
    check('Executable attachment rejected → 400', bad.status === 400);
    const t2 = (await upload(S.emp, '/helpdesk/tickets', { queue: 'HR', categoryId: cat('HR', 'Letters & documents').id, subject: 'Address proof letter', description: 'Need an address proof letter for my bank account.' })).data;
    check('Numbers run per company', t2?.number === 2);
    await wait();
    check('IT agents notified (not HR)', (await p.notification.count({ where: { type: 'ticket.created', userId: { in: [P.it1.user.id, P.it2.user.id] } } })) === 2 && (await p.notification.count({ where: { type: 'ticket.created', userId: P.hr.user.id } })) === 1);

    // ── Visibility
    check('Peer (manager) cannot open it → 404', (await call(S.peer, 'GET', `/helpdesk/tickets/${t1.id}`)).status === 404);
    check('HR cannot open an IT ticket → 404', (await call(S.hr, 'GET', `/helpdesk/tickets/${t1.id}`)).status === 404);
    check('Finance cannot see the IT queue → 403', (await call(S.fin, 'GET', '/helpdesk/tickets?view=queue&queue=IT')).status === 403);
    check('Employee cannot list a queue → 403', (await call(S.emp, 'GET', '/helpdesk/tickets?view=queue')).status === 403);
    const q1 = await call(S.it1, 'GET', '/helpdesk/tickets?view=queue&status=active');
    check('IT queue shows only IT tickets', q1.body.data?.length === 1 && q1.body.data[0].id === t1.id && q1.body.data[0].isAgent);
    check('Search by #number', (await call(S.it1, 'GET', '/helpdesk/tickets?view=queue&search=%231')).body.data?.length === 1);
    check('Search by employee name', (await call(S.it1, 'GET', '/helpdesk/tickets?view=queue&search=emp')).body.data?.length === 1);
    check('Counts: IT queue needs 1', (await call(S.it1, 'GET', '/helpdesk/counts')).data?.queue === 1);

    // ── Work it
    const agents = (await call(S.it1, 'GET', '/helpdesk/agents/IT')).data;
    check('IT agent list', agents?.some((a) => a.id === P.it2.user.id) && !agents.some((a) => a.id === P.hr.user.id));
    check('Assign to someone outside IT → 400', (await call(S.it1, 'POST', `/helpdesk/tickets/${t1.id}/assign`, { assigneeId: P.hr.user.id })).status === 400);
    const as = await call(S.it1, 'POST', `/helpdesk/tickets/${t1.id}/assign`, { assigneeId: P.it2.user.id });
    check('Assign to it2', as.data?.assignee?.id === P.it2.user.id && as.data.messages.some((m) => m.kind === 'EVENT' && m.body.startsWith('Assigned to')));
    await wait();
    check('it2 notified of assignment', (await p.notification.count({ where: { userId: P.it2.user.id, type: 'ticket.assigned' } })) === 1);
    await upload(S.it2, `/helpdesk/tickets/${t1.id}/messages`, { body: 'Possibly the old VPN client.', internal: true });
    const asEmp = await call(S.emp, 'GET', `/helpdesk/tickets/${t1.id}`);
    check('Employee doesn’t see internal notes', asEmp.data && !asEmp.data.messages.some((m) => m.kind === 'NOTE'));
    check('Employee cannot post internal note → 403', (await upload(S.emp, `/helpdesk/tickets/${t1.id}/messages`, { body: 'note', internal: true })).status === 403);
    const ask = await upload(S.it2, `/helpdesk/tickets/${t1.id}/messages`, { body: 'Which VPN client version do you have?', waitForEmployee: true });
    check('Agent asks → Waiting, first response recorded', ask.data?.status === 'WAITING' && ask.data.firstRespondedAt);
    await wait();
    check('Employee notified to reply', (await p.notification.count({ where: { userId: P.emp.user.id, type: 'ticket.waiting' } })) === 1);
    check('Employee counts: needs me 1', (await call(S.emp, 'GET', '/helpdesk/counts')).data?.mine === 1);
    const rep = await upload(S.emp, `/helpdesk/tickets/${t1.id}/messages`, { body: 'Version 4.2' }, { buf: PNG, type: 'image/png', name: 'about.png' });
    check('Employee reply → In progress', rep.data?.status === 'IN_PROGRESS');
    const fileMsg = rep.data.messages.find((m) => m.fileName === 'about.png');
    const dl = await fetch(`${B}/helpdesk/tickets/${t1.id}/messages/${fileMsg.id}/file`, { headers: { authorization: S.it2.authorization } });
    check('Agent downloads the attachment', dl.status === 200 && (await dl.arrayBuffer()).byteLength === PNG.length);
    check('Peer cannot download → 404', (await fetch(`${B}/helpdesk/tickets/${t1.id}/messages/${fileMsg.id}/file`, { headers: { authorization: S.peer.authorization } })).status === 404);
    const pr = await call(S.it2, 'PATCH', `/helpdesk/tickets/${t1.id}`, { priority: 'URGENT' });
    check('Agent raises to Urgent → targets recomputed', pr.data?.priority === 'URGENT' && Math.round((new Date(pr.data.resolutionDueAt) - new Date(pr.data.createdAt)) / 3600_000) === 8);
    const res = await call(S.it2, 'POST', `/helpdesk/tickets/${t1.id}/resolve`, { resolution: 'Updated the VPN client to 5.0.' });
    check('Resolve', res.data?.status === 'RESOLVED' && res.data.resolvedAt);
    check('Employee can’t reply to a resolved ticket → 400', (await upload(S.emp, `/helpdesk/tickets/${t1.id}/messages`, { body: 'Still broken' })).status === 400);
    const ro = await call(S.emp, 'POST', `/helpdesk/tickets/${t1.id}/reopen`, { reason: 'Still drops after the update.' });
    check('Employee reopens → In progress (assigned)', ro.data?.status === 'IN_PROGRESS' && ro.data.reopenCount === 1);
    await call(S.it2, 'POST', `/helpdesk/tickets/${t1.id}/resolve`, { resolution: 'Replaced the Wi-Fi adapter driver.' });
    const cl = await call(S.emp, 'POST', `/helpdesk/tickets/${t1.id}/close`, { rating: 5, comment: 'Quick, thanks!' });
    check('Employee closes and rates 5', cl.data?.status === 'CLOSED' && cl.data.rating === 5);
    check('Closed: no more replies → 400', (await upload(S.it2, `/helpdesk/tickets/${t1.id}/messages`, { body: 'One more thing' })).status === 400);

    // ── Move queues, own tickets, withdraw
    const mv = await call(S.hr, 'PATCH', `/helpdesk/tickets/${t2.id}`, { queue: 'FINANCE' });
    check('HR moves ticket to Finance (loses access)', mv.data?.moved === true && (await call(S.hr, 'GET', `/helpdesk/tickets/${t2.id}`)).status === 404);
    check('Finance now sees it', (await call(S.fin, 'GET', `/helpdesk/tickets/${t2.id}`)).data?.queue === 'FINANCE');
    const own = (await upload(S.it1, '/helpdesk/tickets', { queue: 'IT', subject: 'My monitor flickers', description: 'Flickers when on battery power.' })).data;
    check('IT agent cannot work their own ticket → 403', (await call(S.it1, 'POST', `/helpdesk/tickets/${own.id}/resolve`, { resolution: 'Fixed myself' })).status === 403);
    check('…and can’t be assigned it → 400', (await call(S.it2, 'POST', `/helpdesk/tickets/${own.id}/assign`, { assigneeId: P.it1.user.id })).status === 400);
    check('Own ticket not in own queue count', (await call(S.it1, 'GET', '/helpdesk/counts')).data?.queue === 0);
    const wd = await call(S.it1, 'POST', `/helpdesk/tickets/${own.id}/close`, {});
    check('Withdraw an open ticket', wd.data?.status === 'CLOSED' && wd.data.rating === null);
    check('Rating an unresolved ticket → 400', (await call(S.emp, 'POST', `/helpdesk/tickets/${t2.id}/close`, { rating: 4 })).status === 400);
    const mine = await call(S.emp, 'GET', '/helpdesk/tickets?view=mine');
    check('My tickets', mine.body.data?.length === 2 && mine.body.data.every((t) => !t.isAgent));

    // ── SLA reminders + auto-close (run against the DB directly)
    await p.ticket.update({ where: { id: t2.id }, data: { firstResponseDueAt: new Date(Date.now() - 60_000), resolutionDueAt: new Date(Date.now() - 60_000) } });
    const t3 = (await upload(S.emp, '/helpdesk/tickets', { queue: 'IT', subject: 'Keyboard missing keys', description: 'The E key fell off this morning.' })).data;
    await call(S.it1, 'POST', `/helpdesk/tickets/${t3.id}/resolve`, { resolution: 'Swapped the keyboard.' });
    await p.ticket.update({ where: { id: t3.id }, data: { resolvedAt: new Date(Date.now() - 8 * 86400_000) } });
    const summary0 = await call(S.fin, 'GET', '/helpdesk/summary');
    check('Summary shows overdue', summary0.data?.queues[0].queue === 'FINANCE' && summary0.data.queues[0].overdue === 1);
    const { HelpdeskRemindersService } = require(path.resolve('dist/apps/api/src/modules/helpdesk/helpdesk-reminders.service.js'));
    const { NotificationsService } = require(path.resolve('dist/apps/api/src/modules/notifications/notifications.service.js'));
    void NotificationsService;
    const notifs = {
      companyWideApprovers: async (companyId, perm) => (await p.user.findMany({ where: { companyId, userRoles: { some: { role: { rolePermissions: { some: { permission: { key: perm } } } } } } }, select: { id: true } })).map((u) => u.id),
      notify: async (n) => {
        let c = 0;
        for (const u of n.userIds) {
          const key = n.dedupeKey;
          if (key && (await p.notification.count({ where: { userId: u, dedupeKey: key } }))) continue;
          await p.notification.create({ data: { companyId: n.companyId, userId: u, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, dedupeKey: key ?? null } });
          c++;
        }
        return c;
      },
    };
    const rem = new HelpdeskRemindersService(p, notifs, { get: () => 'false' }, { live: () => undefined }, { leads: async () => ({ headId: null, backupId: null, onDuty: [] }) });
    const r1 = await rem.run();
    check('SLA warning to Finance (response + resolution)', r1.warned === 2 && (await p.notification.count({ where: { userId: P.fin.user.id, type: 'ticket.sla' } })) === 2, JSON.stringify(r1));
    check('Resolved > 7 days auto-closed', r1.closed >= 1 && (await p.ticket.findUnique({ where: { id: t3.id } })).status === 'CLOSED');
    const r2 = await rem.run();
    check('Warnings not repeated', (await p.notification.count({ where: { userId: P.fin.user.id, type: 'ticket.sla' } })) === 2 && r2.closed === 0);
    const sum = await call(S.it1, 'GET', '/helpdesk/summary');
    const itq = sum.data?.queues.find((q) => q.queue === 'IT');
    check('IT summary: rating 5, resolved counted', itq?.avgRating === 5 && itq.resolved >= 1, JSON.stringify(itq));
    check('Employee cannot see summary → 403', (await call(S.emp, 'GET', '/helpdesk/summary')).status === 403);
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    for (const f of fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []) if (!mailBefore.has(f)) fs.rmSync(path.join(mailDir, f));
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company, files and emails removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
