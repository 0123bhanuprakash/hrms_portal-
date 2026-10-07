// celebrations (birthday / work-anniversary wishes): run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Wishes-E2E-2026!';
const SLUG = 'wishes-e2e';
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

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.celebrationWish.deleteMany({ where: { companyId: c.id } });
  await p.kudos.deleteMany({ where: { companyId: c.id } });
  await p.userPreferences.deleteMany({ where: { userId: { in: ids } } });
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
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: TZ } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;

    // Today in the company's time zone; birthdays / anniversaries fall on it
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()).split('-').map(Number);
    const on = (year) => new Date(Date.UTC(year, m - 1, d));
    const notToday = new Date(Date.UTC(1990, (m % 12), 15)); // a different month
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys, extra = {}) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), ...extra } });
      P[name] = { ...e, user: u };
    };
    await mk('amy', ['employee'], { dateOfBirth: on(1994) }); // birthday today
    await mk('annie', ['employee'], { joiningDate: on(y - 3) }); // 3-year anniversary today, no birthday on file
    await mk('dev', ['employee'], { dateOfBirth: notToday });
    await mk('sam', ['employee']);
    await mk('hr', ['employee', 'hr']);
    const AMY = await login(P.amy.email), ANN = await login(P.annie.email), D = await login(P.dev.email), S = await login(P.sam.email), H = await login(P.hr.email);
    const inbox = (name) => p.notification.findMany({ where: { userId: P[name].user.id, type: { startsWith: 'celebration.' } } });

    let sp = await call(D, 'GET', '/people/spotlight');
    const amyToday = sp.data?.birthdays.find((b) => b.id === P.amy.id);
    check('Spotlight: Amy celebrates today with 0 wishes', amyToday?.inDays === 0 && amyToday.wishesToday === 0, JSON.stringify(amyToday));

    // ── Rules
    check('Wishing yourself → 400', (await call(AMY, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'birthday', sticker: '🎂' })).status === 400);
    const notDay = await call(S, 'POST', '/celebrations/wishes', { employeeIds: [P.dev.id], kind: 'birthday', sticker: '🎂' });
    check('Not their birthday today → 400', notDay.status === 400 && /isn’t dev’s birthday/.test(notDay.body.detail ?? ''), JSON.stringify(notDay.body));
    check('No birthday on file → 400', (await call(S, 'POST', '/celebrations/wishes', { employeeIds: [P.annie.id], kind: 'birthday', sticker: '🎂' })).status === 400);
    check('Anniversary sticker on a birthday → 400', (await call(S, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'birthday', sticker: '🏆' })).status === 400);
    check('Unknown kind → 400', (await call(S, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'promotion', sticker: '🎂' })).status === 400);
    check('Message over 280 → 400', (await call(S, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'birthday', sticker: '🎂', message: 'x'.repeat(281) })).status === 400);

    // ── First wish
    const w1 = await call(D, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'birthday', sticker: '🎂', message: 'Have a great one!' });
    check('Send a birthday wish', w1.status === 201 && w1.data.sent.length === 1, JSON.stringify(w1.body));
    await wait(300);
    let n = await inbox('amy');
    check('Celebrant notified: "dev T wished you a happy birthday 🎂"', n.length === 1 && n[0].type === 'celebration.birthday' && n[0].title === 'dev T wished you a happy birthday 🎂' && n[0].link === '/app/wishes' && !n[0].readAt, JSON.stringify(n));
    check('Body carries the sticker and message', n[0]?.body === '🎂 “Have a great one!” — dev', n[0]?.body);
    check('No email for wishes', !n[0]?.emailedAt);
    const again = await call(D, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'birthday', sticker: '🎉' });
    check('Wishing twice: nothing new', again.status === 201 && again.data.sent.length === 0 && again.data.alreadyWished[0] === P.amy.id && (await p.celebrationWish.count({ where: { employeeId: P.amy.id } })) === 1, JSON.stringify(again.body));

    // ── More wishes grow one notification instead of piling up
    await p.notification.updateMany({ where: { userId: P.amy.user.id }, data: { readAt: new Date() } });
    await call(S, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'birthday', sticker: '🥳' });
    await wait(300);
    n = await inbox('amy');
    check('Second wish: still one notification, unread again', n.length === 1 && n[0].title === 'sam and dev wished you a happy birthday 🎂' && !n[0].readAt && n[0].body === '🥳 from sam', JSON.stringify(n));
    await call(H, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'birthday', sticker: '🎈', message: 'Cheers!' });
    await wait(300);
    n = await inbox('amy');
    check('Third wish: "hr, sam and 1 other…"', n.length === 1 && n[0].title === 'hr, sam and 1 other wished you a happy birthday 🎂', n[0]?.title);

    sp = await call(D, 'GET', '/people/spotlight');
    check('Spotlight counts 3 wishes today', sp.data.birthdays.find((b) => b.id === P.amy.id)?.wishesToday === 3);
    check('Wishes are not kudos', (await call(D, 'GET', '/kudos')).body.data?.length === 0);

    // ── Who sees what
    const dToday = await call(D, 'GET', '/celebrations/today');
    check('Wisher: today lists whom they wished', dToday.data?.wished.some((w) => w.employeeId === P.amy.id && w.kind === 'birthday') && dToday.data.received.length === 0, JSON.stringify(dToday.data));
    const aToday = await call(AMY, 'GET', '/celebrations/today');
    const occ = aToday.data?.received[0];
    check('Celebrant: today has 3 wishes, newest first, with senders', occ?.kind === 'birthday' && occ.wishes.length === 3 && occ.wishes[0].from.firstName === 'hr' && occ.wishes[0].message === 'Cheers!', JSON.stringify(aToday.data));
    check('Celebrant: My wishes page has them', (await call(AMY, 'GET', '/celebrations/wishes/mine')).data?.[0]?.wishes.length === 3);
    check('Others can’t read them (own wishes only)', (await call(D, 'GET', '/celebrations/wishes/mine')).data?.length === 0);

    // ── Work anniversary
    const an = await call(S, 'POST', '/celebrations/wishes', { employeeIds: [P.annie.id], kind: 'anniversary', sticker: '🏆', message: 'Congrats!' });
    check('Anniversary wish', an.status === 201 && an.data.sent.length === 1, JSON.stringify(an.body));
    await wait(300);
    n = await inbox('annie');
    check('"…wished you on your 3-year work anniversary 🏆"', n.length === 1 && n[0].type === 'celebration.anniversary' && n[0].title === 'sam T wished you on your 3-year work anniversary 🏆', n[0]?.title);
    check('Anniversary to someone who isn’t celebrating → 400', (await call(S, 'POST', '/celebrations/wishes', { employeeIds: [P.dev.id], kind: 'anniversary', sticker: '🏆' })).status === 400);
    check('Anniversary self-wish → 400', (await call(ANN, 'POST', '/celebrations/wishes', { employeeIds: [P.annie.id], kind: 'anniversary', sticker: '🏆' })).status === 400);

    // ── Notification settings are respected (Kudos & celebrations → in-app off)
    await p.userPreferences.upsert({ where: { userId: P.amy.user.id }, create: { userId: P.amy.user.id, notificationTopics: { kudos: { app: false } } }, update: { notificationTopics: { kudos: { app: false } } } });
    await p.notification.updateMany({ where: { userId: P.amy.user.id }, data: { readAt: new Date() } });
    await call(ANN, 'POST', '/celebrations/wishes', { employeeIds: [P.amy.id], kind: 'birthday', sticker: '💐' });
    await wait(300);
    n = await inbox('amy');
    check('In-app off: the wish is saved, no new ping', (await p.celebrationWish.count({ where: { employeeId: P.amy.id } })) === 4 && n.length === 1 && n[0].readAt && n[0].title.startsWith('hr, sam'), JSON.stringify(n));
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
