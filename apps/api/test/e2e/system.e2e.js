// Super Admin → System: health history, traffic, data, email log + retry, readiness,
// sign-in safety + unlock, maintenance mode, caches, diagnostics.
const bcrypt = require('bcryptjs');
const { prisma: p, suite, call, login, makeCompany, dropCompany } = require('./lib');

const A = 'system-e2e-a';
const SA_EMAIL = 'sa-system-e2e@platform.test';
const PW = 'Sa-System-2026!';
const t = suite('system');
const { check } = t;
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const json = { 'content-type': 'application/json' };

(async () => {
  await dropCompany(A);
  await p.user.deleteMany({ where: { email: SA_EMAIL } });
  const savedMaintenance = await p.platformSetting.findUnique({ where: { key: 'maintenance' } });
  let SA;
  try {
    await p.user.create({ data: { email: SA_EMAIL, passwordHash: await bcrypt.hash(PW, 10), firstName: 'System', lastName: 'Owner', isSuperAdmin: true, status: 'ACTIVE', emailVerifiedAt: new Date() } });
    SA = await login(SA_EMAIL, PW);
    const a = await makeCompany(A, [['admin', ['employee', 'company_admin']], ['emp', ['employee']]]);
    const adminEmail = a.people.admin.email;

    check('Company admins can’t open System → 403', (await call(a.sessions.admin, 'GET', '/admin/system/traffic')).status === 403);

    // Health & speed
    let r = await call(SA, 'POST', '/admin/system/check');
    check('Run checks now', r.status === 200 && typeof r.data?.ok === 'boolean' && r.data.services.database === 'ok', JSON.stringify(r.body));
    r = await call(SA, 'GET', '/admin/system/health-history');
    check('Health history: 90 days, checks counted', r.status === 200 && r.data.days.length === 90 && r.data.checks >= 1 && r.data.days[89].checks >= 1, JSON.stringify(r.data?.days?.[89]));
    r = await call(SA, 'GET', '/admin/system/traffic');
    check('Traffic: last hour and slowest endpoints', r.status === 200 && r.data.minutes.length === 60 && r.data.lastHour.requests > 0 && Array.isArray(r.data.slowest) && r.data.activeUsers >= 1, JSON.stringify(r.data?.lastHour));
    check('Traffic: routes are patterns, not ids', !(r.data.slowest ?? []).some((s) => /[0-9a-f]{8}-[0-9a-f]{4}-/.test(s.route)));
    r = await call(SA, 'GET', '/admin/system/timeline');
    check('Timeline lists events', r.status === 200 && Array.isArray(r.data));

    // Data & delivery
    r = await call(SA, 'GET', '/admin/system/database');
    check('Database: size, connections, tables', r.status === 200 && r.data.sizeBytes > 0 && r.data.connections.max > 0 && r.data.tables.length > 0 && r.data.latestMigration?.name, JSON.stringify(r.data));
    r = await call(SA, 'GET', '/admin/system/storage');
    check('Storage: driver and per-company list', r.status === 200 && r.data.driver === 'local' && Array.isArray(r.data.byCompany), JSON.stringify(r.data));
    r = await call(SA, 'GET', '/admin/system/queue');
    check('Queue: off without Redis', r.status === 200 && r.data.enabled === false);

    await fetch(B + '/auth/forgot-password', { method: 'POST', headers: json, body: JSON.stringify({ email: adminEmail }) });
    await new Promise((res) => setTimeout(res, 600));
    r = await call(SA, 'GET', '/admin/system/emails?limit=50');
    const sent = r.data?.data?.find((e) => e.to === adminEmail);
    check('Email log records a sent email with its company', r.status === 200 && sent?.status === 'SENT' && sent.company?.id === a.company.id && !('payload' in sent), JSON.stringify(sent));
    check('Email log: today’s numbers', r.data.stats.sentToday >= 1);
    const failed = await p.emailLog.create({ data: { companyId: a.company.id, to: adminEmail, subject: 'E2E failed email', status: 'FAILED', error: 'Mailbox not found', provider: 'smtp', payload: '<p>retry me</p>' } });
    r = await call(SA, 'GET', '/admin/system/emails?status=FAILED&limit=50');
    check('Filter failed emails; retry offered', r.data?.data?.some((e) => e.id === failed.id && e.canRetry === true));
    r = await call(SA, 'POST', `/admin/system/emails/${failed.id}/retry`);
    await new Promise((res) => setTimeout(res, 400));
    const after = await p.emailLog.findUnique({ where: { id: failed.id } });
    check('Retry re-sends and marks it sent', r.status === 200 && after?.status === 'SENT' && after.payload === null && after.retriedAt, JSON.stringify(r.body));
    check('Retry twice → 400', (await call(SA, 'POST', `/admin/system/emails/${failed.id}/retry`)).status === 400);

    // Readiness & safety
    r = await call(SA, 'GET', '/admin/system/readiness');
    check('Readiness checklist', r.status === 200 && r.data.total === 6 && r.data.checks.every((c) => typeof c.ok === 'boolean' && c.detail), JSON.stringify(r.data));
    check('Readiness never shows secrets', !JSON.stringify(r.data).includes(process.env.JWT_SECRET || '§none§'));
    await fetch(B + '/auth/login', { method: 'POST', headers: json, body: JSON.stringify({ email: adminEmail, password: 'wrong-password' }) });
    await p.user.update({ where: { id: a.people.emp.user.id }, data: { lockedUntil: new Date(Date.now() + 10 * 60_000), loginAttempts: 5 } });
    r = await call(SA, 'GET', '/admin/system/sign-ins');
    check('Sign-ins: failures counted, locked account listed', r.status === 200 && r.data.failed >= 1 && r.data.successful >= 1 && r.data.locked.some((u) => u.id === a.people.emp.user.id && u.company?.id === a.company.id), JSON.stringify(r.data?.locked));
    r = await call(SA, 'POST', `/admin/system/users/${a.people.emp.user.id}/unlock`);
    const unlocked = await p.user.findUnique({ where: { id: a.people.emp.user.id } });
    check('Unlock an account', r.status === 200 && unlocked.lockedUntil === null && unlocked.loginAttempts === 0);

    // Maintenance mode
    r = await call(SA, 'PUT', '/admin/system/maintenance', { enabled: true, title: 'E2E upgrade', message: 'Back soon (e2e)' });
    check('Turn maintenance on', r.status === 200 && r.data.enabled === true);
    r = await call(a.sessions.admin, 'GET', '/users/me');
    check('Company users are paused → 503 maintenance', r.status === 503 && r.body.code === 'maintenance' && r.body.detail === 'Back soon (e2e)', JSON.stringify(r.body));
    // Sign-in is rate limited per IP; earlier suites may have used it up
    for (let i = 0; i < 6; i++) {
      r = await fetch(B + '/auth/login', { method: 'POST', headers: json, body: JSON.stringify({ email: adminEmail, password: 'E2E-Test-2026!' }) });
      if (r.status !== 429) break;
      await new Promise((res) => setTimeout(res, 15000));
    }
    check('Company sign-in is paused too', r.status === 503, String(r.status));
    check('Super Admin carries on', (await call(SA, 'GET', '/admin/system/readiness')).status === 200);
    r = await fetch(B + '/platform/status');
    let j = await r.json();
    check('Public status shows the pause', r.status === 200 && j.data.paused?.title === 'E2E upgrade', JSON.stringify(j));
    r = await call(SA, 'PUT', '/admin/system/maintenance', { enabled: false, announce: true, startsAt: new Date(Date.now() + 86_400_000).toISOString(), endsAt: new Date(Date.now() + 90_000_000).toISOString() });
    check('Turn it off and announce a window', r.status === 200 && r.data.enabled === false, JSON.stringify(r.body));
    check('Company users are back', (await call(a.sessions.admin, 'GET', '/users/me')).status === 200);
    j = await (await fetch(B + '/platform/status')).json();
    check('Public status shows the notice ahead', j.data.paused === null && j.data.notice?.title === 'E2E upgrade', JSON.stringify(j));
    check('End before start → 400', (await call(SA, 'PUT', '/admin/system/maintenance', { startsAt: '2030-01-02T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' })).status === 400);
    r = await call(SA, 'GET', '/admin/system/timeline');
    check('Timeline shows maintenance on/off', r.data?.some((e) => e.kind === 'maintenance_on') && r.data.some((e) => e.kind === 'maintenance_off'));

    // Tools
    r = await call(SA, 'POST', '/admin/system/caches/clear');
    check('Clear caches', r.status === 200 && r.data.cleared === true);
    check('Signed-in users still work after clearing', (await call(a.sessions.admin, 'GET', '/users/me')).status === 200);
    r = await call(SA, 'GET', '/admin/system/diagnostics');
    check('Diagnostics: versions and settings, no secrets', r.status === 200 && r.data.api.version && r.data.readiness.total === 6 && !JSON.stringify(r.data).includes(process.env.JWT_SECRET || '§none§'));
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    // Put maintenance back exactly as it was
    if (savedMaintenance) await p.platformSetting.update({ where: { key: 'maintenance' }, data: { value: savedMaintenance.value } });
    else await p.platformSetting.deleteMany({ where: { key: 'maintenance' } });
    await p.systemEvent.deleteMany({ where: { kind: { in: ['maintenance_on', 'maintenance_off', 'caches_cleared'] }, at: { gte: new Date(Date.now() - 10 * 60_000) } } });
    await dropCompany(A);
    await p.auditLog.deleteMany({ where: { user: { email: SA_EMAIL } } });
    const sa = await p.user.findUnique({ where: { email: SA_EMAIL }, select: { id: true } });
    if (sa) await p.signInAttempt.deleteMany({ where: { userId: sa.id } });
    await p.user.deleteMany({ where: { email: SA_EMAIL } });
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
