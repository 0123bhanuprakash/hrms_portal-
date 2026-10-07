// realtime (Socket.IO live updates): run with test/e2e/run.js (throwaway API on :4001).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { io } = require('socket.io-client');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const ORIGIN = new URL(B).origin;
const PW = 'Realtime-E2E-2026!';
const SLUG = 'realtime-e2e';
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
    const j = await r.json();
    if (!j.data) throw new Error(`login ${email} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    const token = j.data.access_token;
    return { token, h: { authorization: 'Bearer ' + token, 'content-type': 'application/json' } };
  }
  throw new Error('login throttled');
}

/** A connected test tab that records every event it receives. */
function tab(token) {
  return new Promise((resolve) => {
    const s = io(ORIGIN, { path: '/socket.io', auth: { token }, transports: ['websocket'], reconnection: false });
    const got = [];
    s.onAny((event, data) => got.push({ event, data }));
    const done = (ok) => resolve({ s, got, ok, has: (event, pred = () => true) => got.some((g) => g.event === event && pred(g.data)), clear: () => (got.length = 0) });
    s.once('ready', () => done(true));
    s.once('unauthorized', () => done(false));
    s.once('connect_error', () => done(false));
    setTimeout(() => done(false), 5000);
  });
}
const emit = (t, ev, body) => new Promise((r) => t.s.emit(ev, body, r));

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.ticketMessage.deleteMany({ where: { companyId: c.id } });
  await p.ticket.deleteMany({ where: { companyId: c.id } });
  await p.celebrationWish.deleteMany({ where: { companyId: c.id } });
  await p.kudos.deleteMany({ where: { companyId: c.id } });
  await p.kudosValue.deleteMany({ where: { companyId: c.id } });
  await p.announcement.deleteMany({ where: { companyId: c.id } });
  await p.attendancePunch.deleteMany({ where: { companyId: c.id } });
  await p.attendanceRecord.deleteMany({ where: { companyId: c.id } });
  await p.employee.updateMany({ where: { companyId: c.id }, data: { reportingManagerId: null } });
  await p.employeeHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.departmentHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.department.deleteMany({ where: { companyId: c.id } });
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
  const tabs = [];
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: 'Asia/Kolkata' } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const mk = async (name, keys) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01') } });
      await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 } });
    };
    await mk('emp', ['employee']);
    await mk('peer', ['employee']);
    await mk('it1', ['employee', 'it_admin']);

    // ── Signing in ──
    const none = await tab(undefined);
    tabs.push(none);
    check('No token → refused', !none.ok && none.has('unauthorized'));
    const junk = await tab('not-a-token');
    tabs.push(junk);
    check('Bad token → refused', !junk.ok);

    const emp = await login(`emp@${SLUG}.test`);
    const peer = await login(`peer@${SLUG}.test`);
    const it1 = await login(`it1@${SLUG}.test`);
    const E = await tab(emp.token);
    const Pe = await tab(peer.token);
    const I = await tab(it1.token);
    tabs.push(E, Pe, I);
    check('Employee, peer and IT agent connect', E.ok && Pe.ok && I.ok);

    // ── New ticket reaches the IT queue live ──
    const created = await call(emp.h, 'POST', '/helpdesk/tickets', { queue: 'IT', subject: 'Laptop fan is loud', description: 'Very loud since this morning' });
    check('Ticket created', created.status === 201, created.status);
    const ticketId = created.data?.id;
    await wait(800);
    check('IT agent gets the notification live', I.has('notification', (n) => n.type === 'ticket.created' && n.link === `/app/helpdesk/${ticketId}`));
    check('IT agent queue told to refresh', I.has('changed', (c) => c.topic === 'helpdesk' && c.ticketId === ticketId));
    check('Employee list told to refresh', E.has('changed', (c) => c.topic === 'helpdesk'));
    check('Peer (not IT) hears nothing', !Pe.has('notification') && !Pe.has('changed'));

    // ── Ticket rooms ──
    check('Employee may watch own ticket', (await emit(E, 'ticket:watch', { id: ticketId })) === true);
    check('Agent may watch a queue ticket', (await emit(I, 'ticket:watch', { id: ticketId })) === true);
    check('Peer may not watch it', (await emit(Pe, 'ticket:watch', { id: ticketId })) === false);
    check('Garbage id refused', (await emit(Pe, 'ticket:watch', { id: 'x; drop' })) === false);

    // ── Typing ──
    E.clear(); I.clear(); Pe.clear();
    I.s.emit('ticket:typing', { id: ticketId, typing: true });
    Pe.s.emit('ticket:typing', { id: ticketId, typing: true });
    await wait(500);
    check('Employee sees “it1 is writing”', E.has('typing', (t) => t.ticketId === ticketId && t.name === 'it1' && t.typing === true));
    check('Writer does not get own typing', !I.has('typing'));
    check('Outsider typing is dropped', !E.has('typing', (t) => t.name === 'peer'));

    // ── Internal note stays with the team ──
    E.clear(); I.clear();
    await call(it1.h, 'POST', `/helpdesk/tickets/${ticketId}/messages`, { body: 'Fan needs cleaning', internal: true });
    await wait(600);
    check('Agent side refreshes after a note', I.has('changed', (c) => c.topic === 'helpdesk'));
    check('Employee gets nothing for an internal note', !E.has('changed') && !E.has('notification'));

    // ── Reply reaches the employee live ──
    E.clear();
    const reply = await call(it1.h, 'POST', `/helpdesk/tickets/${ticketId}/messages`, { body: 'Bring it to IT at 3 pm' });
    check('Agent replied', reply.status === 201 || reply.status === 200, reply.status);
    await wait(600);
    const n = E.got.find((g) => g.event === 'notification' && g.data.type === 'ticket.reply');
    check('Employee gets the reply notification live', Boolean(n));
    check('Employee ticket page told to refresh', E.has('changed', (c) => c.ticketId === ticketId));

    // ── Reading syncs other tabs ──
    const E2 = await tab(emp.token);
    tabs.push(E2);
    await call(emp.h, 'POST', `/notifications/${n?.data.id}/read`);
    await wait(500);
    check('Another tab of the same person hears “read”', E2.has('changed', (c) => c.topic === 'notifications'));
    check('Peer never got any of it', !Pe.has('notification'));

    // ═══ Live areas, access changes and session sign-out ═══
    await mk('hr1', ['employee', 'hr']);
    await mk('mgr', ['employee']);
    await mk('boss', ['company_admin']);
    const empRow = await p.employee.findFirstOrThrow({ where: { companyId: company.id, employeeId: 'EMP' } });
    const mgrRow = await p.employee.findFirstOrThrow({ where: { companyId: company.id, employeeId: 'MGR' } });
    await p.employee.update({ where: { id: empRow.id }, data: { reportingManagerId: mgrRow.id } });
    const hr1 = await login(`hr1@${SLUG}.test`);
    const mgr = await login(`mgr@${SLUG}.test`);
    const boss = await login(`boss@${SLUG}.test`);
    const H = await tab(hr1.token);
    const M = await tab(mgr.token);
    tabs.push(H, M);
    check('HR and line manager connect', H.ok && M.ok);

    // ── A check-in reaches the people who watch attendance, nobody else ──
    for (const t of [E, Pe, H, M, I]) t.clear();
    const inRes = await call(emp.h, 'POST', '/attendance/check-in');
    check('Employee checked in', inRes.status === 201 || inRes.status === 200, inRes.status);
    await wait(3800); // changes are combined for ~3 s
    const att = (t) => t.got.filter((g) => g.event === 'changed' && g.data.topic === 'attendance').length;
    check('HR board told to refresh', att(H) === 1, att(H));
    check('Line manager told to refresh (approver without a role permission)', att(M) === 1, att(M));
    check('Own other tabs told to refresh', att(E) === 1, att(E));
    check('Peer (plain employee) hears nothing about attendance', att(Pe) === 0, att(Pe));

    // ── A burst of check-ins becomes one message ──
    H.clear();
    await Promise.all([call(peer.h, 'POST', '/attendance/check-in'), call(it1.h, 'POST', '/attendance/check-in'), call(mgr.h, 'POST', '/attendance/check-in')]);
    await wait(3800);
    check('Three check-ins → one refresh for HR', att(H) === 1, att(H));

    // ── Role change: menus refresh and live rooms follow ──
    Pe.clear();
    const peerUser = await p.user.findUniqueOrThrow({ where: { email: `peer@${SLUG}.test` } });
    const setRoles = await call(boss.h, 'PUT', `/company/users/${peerUser.id}/roles`, { roleIds: [roles.employee, roles.hr] });
    check('Admin made peer an HR person', setRoles.status === 200, setRoles.status);
    await wait(1500);
    check('Peer told “access changed”', Pe.has('changed', (c) => c.topic === 'access'));
    Pe.clear();
    await call(peer.h, 'POST', '/attendance/check-out');
    await call(emp.h, 'POST', '/attendance/check-out');
    await wait(3800);
    check('Peer now hears attendance changes', att(Pe) >= 1, att(Pe));

    // ── Deactivation signs the open tab out at once ──
    Pe.clear();
    const off = await call(boss.h, 'PATCH', `/company/users/${peerUser.id}/status`, { status: 'INACTIVE' });
    check('Admin turned peer off', off.status === 200, off.status);
    await wait(1500);
    check('Peer tab gets “signed out (inactive)”', Pe.has('signed-out', (e) => e.reason === 'inactive'));
    check('Peer tab disconnected', !Pe.s.connected);

    // ── Signing out one device closes only that device ──
    const emp2 = await login(`emp@${SLUG}.test`);
    const D2 = await tab(emp2.token);
    tabs.push(D2);
    const sessions = await call(emp.h, 'GET', '/auth/sessions');
    const other = (sessions.data ?? []).find((s) => !s.current);
    check('Second device listed', Boolean(other), JSON.stringify(sessions.body).slice(0, 200));
    E.clear();
    // Sign out every session except the first device's
    const firstSid = (sessions.data ?? []).find((s) => s.current)?.id;
    const rev = await call(emp.h, 'POST', '/auth/sessions/revoke-others');
    check('Other devices signed out', rev.status === 200, rev.status);
    await wait(800);
    check('Second device tab closed live', D2.has('signed-out', (e) => e.reason === 'device') && !D2.s.connected);
    check('This device stays connected', E.s.connected && !E.has('signed-out'), firstSid);

    // ── Announcements: a post reaches everyone; reads only reach the people who run them ──
    const ann = (t) => t.got.filter((g) => g.event === 'changed' && g.data.topic === 'announcements').length;
    for (const t of [E, H, M, I]) t.clear();
    const post = await call(hr1.h, 'POST', '/announcements', { title: 'Live test post', body: 'Hello from the live test.', audience: 'COMPANY', sendEmail: false });
    check('HR posted an announcement', post.status === 201, post.status);
    await wait(3800);
    check('Everyone told about the new post', ann(E) === 1 && ann(M) === 1 && ann(I) === 1, `${ann(E)} ${ann(M)} ${ann(I)}`);
    for (const t of [E, H, M, I]) t.clear();
    const seen = await call(emp.h, 'POST', '/announcements/seen', { ids: [post.data?.id] });
    check('Employee read it', seen.status === 200 || seen.status === 201, seen.status);
    await wait(3800);
    check('HR (runs announcements) told the read count changed', ann(H) === 1, ann(H));
    check('Colleagues not disturbed by someone reading', ann(M) === 0 && ann(I) === 0, `${ann(M)} ${ann(I)}`);

    // ── Kudos: the feed and ticker update for everyone ──
    const kud = (t) => t.got.filter((g) => g.event === 'changed' && g.data.topic === 'kudos').length;
    for (const t of [E, H, M, I]) t.clear();
    const given = await call(emp.h, 'POST', '/kudos', { recipientIds: [mgrRow.id], message: 'Thanks for the help this week!' });
    check('Employee gave kudos', given.status === 201, given.status);
    await wait(3800);
    check('Everyone’s kudos feed told to refresh', kud(H) === 1 && kud(I) === 1 && kud(M) === 1, `${kud(H)} ${kud(I)} ${kud(M)}`);

    // ═══ @mentions and deletions ═══
    const empUser = await p.user.findUniqueOrThrow({ where: { email: `emp@${SLUG}.test` } });
    const mgrUser = await p.user.findUniqueOrThrow({ where: { email: `mgr@${SLUG}.test` } });
    const notes = (userId, where = {}) => p.notification.count({ where: { userId, ...where } });

    // Mentioning someone outside the audience is refused
    const emptyDept = await p.department.create({ data: { companyId: company.id, name: 'Nobody here', code: 'NOBODY' } });
    await p.departmentHierarchy.create({ data: { companyId: company.id, ancestorId: emptyDept.id, descendantId: emptyDept.id, depth: 0 } });
    const outside = await call(hr1.h, 'POST', '/announcements', { title: 'Dept only', body: `Hi @[emp T](${empRow.id})`, audience: 'DEPARTMENTS', departmentIds: [emptyDept.id] });
    check('Mention outside the audience → 400 with the name', outside.status === 400 && /emp T/.test(JSON.stringify(outside.body)), `${outside.status} ${JSON.stringify(outside.body).slice(0, 160)}`);

    // Mentioned person gets "mentioned you" instead of "new post"
    const tagged = await call(hr1.h, 'POST', '/announcements', { title: 'Mention test', body: `Welcome aboard, @[emp T](${empRow.id})!`, audience: 'COMPANY', sendEmail: false });
    check('Post with a mention published', tagged.status === 201, tagged.status);
    const link = `/app/announcements/${tagged.data?.id}`;
    await wait(1200);
    check('Mentioned person told “mentioned you”', (await notes(empUser.id, { type: 'announcement.mention', link })) === 1);
    check('…and not also “new post”', (await notes(empUser.id, { type: 'announcement.posted', link })) === 0);
    check('Others get the usual “new post”', (await notes(mgrUser.id, { type: 'announcement.posted', link })) === 1);
    const listed = await call(emp.h, 'GET', `/announcements/${tagged.data?.id}`);
    check('Mention kept in the text', (listed.data?.body ?? '').includes(`@[emp T](${empRow.id})`));

    // Deleting it: only the mentioned person is told; old notifications leave every bell
    const del = await call(hr1.h, 'DELETE', `/announcements/${tagged.data?.id}`);
    check('Post deleted', del.status === 200, del.status);
    await wait(1200);
    check('Mentioned person told it was removed', (await notes(empUser.id, { type: 'announcement.removed' })) === 1);
    check('Nobody else told it was removed', (await p.notification.count({ where: { type: 'announcement.removed', userId: { not: empUser.id }, companyId: company.id } })) === 0);
    check('Old notifications about the post withdrawn', (await p.notification.count({ where: { link } })) === 0);

    // Kudos deletion tells nobody, and its notifications leave the bells
    const kudosId = given.data?.id;
    check('Kudos notification was there', (await notes(mgrUser.id, { type: 'kudos.received' })) === 1);
    const before = await p.notification.count({ where: { companyId: company.id } });
    const kdel = await call(boss.h, 'DELETE', `/kudos/${kudosId}`);
    check('Admin removed the kudos', kdel.status === 200, kdel.status);
    await wait(1200);
    check('Recipient’s kudos notification withdrawn', (await notes(mgrUser.id, { type: 'kudos.received' })) === 0);
    check('No new notification sent to anyone', (await p.notification.count({ where: { companyId: company.id } })) <= before - 1);

    // ═══ Polish: branding, people, "also viewing", import progress, wishes ═══
    const topicCount = (t, topic) => t.got.filter((g) => g.event === 'changed' && g.data.topic === topic).length;
    for (const t of [E, H, M, I]) t.clear();
    const brand = await call(boss.h, 'PATCH', `/companies/${company.id}/branding`, { tagline: 'Live test tagline' });
    check('Admin changed the branding', brand.status === 200, brand.status);
    await wait(3800);
    check('Every open screen told to re-theme', topicCount(E, 'branding') === 1 && topicCount(I, 'branding') === 1, `${topicCount(E, 'branding')} ${topicCount(I, 'branding')}`);

    for (const t of [E, H, M, I]) t.clear();
    const moved = await call(boss.h, 'PATCH', `/employees/${empRow.id}`, { phone: '9876543210' });
    check('Admin edited an employee', moved.status === 200, `${moved.status} ${JSON.stringify(moved.body).slice(0, 120)}`);
    await wait(3800);
    check('People and org chart told to refresh', topicCount(M, 'people') === 1 && topicCount(I, 'people') === 1, `${topicCount(M, 'people')} ${topicCount(I, 'people')}`);

    // "Also viewing": two HR people on one profile see each other; a plain employee can't join
    const hr2 = await login(`hr1@${SLUG}.test`);
    const H2 = await tab(hr2.token);
    const Bs = await tab(boss.token);
    tabs.push(H2, Bs);
    check('HR may view a profile', (await emit(H, 'view:join', { kind: 'employee', id: mgrRow.id })) === true);
    check('Admin may view the same profile', (await emit(Bs, 'view:join', { kind: 'employee', id: mgrRow.id })) === true);
    await wait(400);
    const last = (t) => [...t.got].reverse().find((g) => g.event === 'presence' && g.data.id === mgrRow.id)?.data;
    check('HR sees the admin is also viewing', (last(H)?.people ?? []).some((x) => x.name === 'boss T'), JSON.stringify(last(H)));
    check('Plain employee may not join a profile', (await emit(E, 'view:join', { kind: 'employee', id: mgrRow.id })) === false);
    check('Garbage record refused', (await emit(H, 'view:join', { kind: 'employee', id: '00000000-0000-0000-0000-000000000000' })) === false);
    H.clear();
    Bs.s.disconnect();
    await wait(500);
    check('Closing the tab updates the others', last(H) && !(last(H).people ?? []).some((x) => x.name === 'boss T'), JSON.stringify(last(H)));

    // Import: live "N of M" for the person importing
    Bs.clear();
    const B2 = await tab(boss.token);
    tabs.push(B2);
    const progressId = '11111111-2222-4333-8444-555555555555';
    const imp = await call(boss.h, 'POST', '/employees/import', { rows: [{ firstName: 'Imp', lastName: 'One', email: `imp1@${SLUG}.test`, joiningDate: '2026-01-05' }, { firstName: 'Imp', lastName: 'Two', email: `imp2@${SLUG}.test`, joiningDate: '2026-01-05' }], sendInvites: false, progressId });
    check('Import ran', imp.status === 200 && imp.data?.created === 2, `${imp.status} ${JSON.stringify(imp.body).slice(0, 160)}`);
    await wait(500);
    const prog = B2.got.filter((g) => g.event === 'progress' && g.data.id === progressId).map((g) => g.data);
    check('Importer saw progress up to 2 of 2', prog.length >= 2 && prog[prog.length - 1].done === 2 && prog[prog.length - 1].total === 2, JSON.stringify(prog));
    check('Nobody else saw it', !H.has('progress') && !M.has('progress'));

    // Wishes so far today (birthday today)
    const today = new Date();
    await p.employee.update({ where: { id: mgrRow.id }, data: { dateOfBirth: new Date(Date.UTC(1990, today.getMonth(), today.getDate())) } });
    const wishPings = M.got.filter((g) => g.event === 'changed' && g.data.topic === 'celebrations').length;
    const hrPings = H.got.filter((g) => g.event === 'changed' && g.data.topic === 'celebrations').length;
    const wish = await call(emp.h, 'POST', '/celebrations/wishes', { employeeIds: [mgrRow.id], kind: 'birthday', sticker: '🎂', message: 'Happy birthday, have a great day!' });
    check('Send a birthday wish', wish.status === 201, JSON.stringify(wish.body).slice(0, 200));
    await wait(600);
    check('Celebrant’s count refreshes live (celebrations)', M.got.filter((g) => g.event === 'changed' && g.data.topic === 'celebrations').length > wishPings);
    check('Others aren’t pinged (counts are private)', H.got.filter((g) => g.event === 'changed' && g.data.topic === 'celebrations').length === hrPings);
    const spot = await call(mgr.h, 'GET', '/people/spotlight');
    const bday = (spot.data?.birthdays ?? []).find((b) => b.id === mgrRow.id && b.inDays === 0);
    check('Celebrant sees wishes so far today', bday?.wishesToday === 1, JSON.stringify(bday));
    const colleagueView = ((await call(emp.h, 'GET', '/people/spotlight')).data?.birthdays ?? []).find((b) => b.id === mgrRow.id);
    check('Colleagues don’t see the count', colleagueView && !('wishesToday' in colleagueView), JSON.stringify(colleagueView));
  } catch (err) {
    check('No crash', false, err.stack);
  } finally {
    for (const t of tabs) t.s.disconnect();
    await cleanup().catch(() => undefined);
    await p.$disconnect();
    const failed = results.filter((r) => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();
