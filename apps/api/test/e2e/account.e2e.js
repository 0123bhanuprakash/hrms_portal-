// Profile & security: overview, sign-in history + new-device email, password age and
// "keep other devices", photo, email change, confirm-password for risky changes, platform admins.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { prisma: p, suite, call, upload, login, makeCompany, dropCompany, mailSnapshot, B } = require('./lib');

const A = 'account-e2e-a';
const SA_EMAIL = 'sa-account-e2e@platform.test';
const NEW_EMAIL = 'sa-account-e2e-new@platform.test';
const INVITE = 'sa-account-e2e-invite@platform.test';
const PW = 'Sa-Account-2026!';
const t = suite('account');
const { check } = t;
const json = { 'content-type': 'application/json' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function loginAs(email, password, ua) {
  const r = await fetch(B + '/auth/login', { method: 'POST', headers: { ...json, 'user-agent': ua }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  return { status: r.status, h: j.data?.access_token ? { authorization: 'Bearer ' + j.data.access_token, 'content-type': 'application/json' } : null };
}

/** The newest console email whose file name contains `slug`. */
function latestMail(slug) {
  const dir = path.resolve('.mail');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.includes(slug)).sort() : [];
  return files.length ? fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8') : '';
}

(async () => {
  const restoreMail = mailSnapshot();
  const emails = [SA_EMAIL, NEW_EMAIL, INVITE];
  const clean = async () => {
    const ids = (await p.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    await p.signInAttempt.deleteMany({ where: { userId: { in: ids } } });
    await p.emailLog.deleteMany({ where: { to: { in: emails } } });
    await p.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await p.user.deleteMany({ where: { id: { in: ids } } });
  };
  await dropCompany(A);
  await clean();
  try {
    await p.user.create({ data: { email: SA_EMAIL, passwordHash: await bcrypt.hash(PW, 10), firstName: 'Acct', lastName: 'Owner', isSuperAdmin: true, status: 'ACTIVE', emailVerifiedAt: new Date(), passwordChangedAt: new Date(Date.now() - 20 * 86_400_000) } });
    const first = await loginAs(SA_EMAIL, PW, 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36');
    const SA = first.h;
    const a = await makeCompany(A, [['admin', ['employee', 'company_admin']]]);

    // Overview
    let r = await call(SA, 'GET', '/account/overview');
    check('Overview: details, password age, protection defaults', r.status === 200 && r.data.user.email === SA_EMAIL && r.data.user.passwordChangedAt && r.data.protection.notifyNewDevice === true && r.data.protection.reauthForRisky === false, JSON.stringify(r.body));

    // Sign-in history + new device email
    const mailsBefore = await p.emailLog.count({ where: { to: SA_EMAIL, subject: { contains: 'New sign-in' } } });
    check('First sign-in sends no new-device email', mailsBefore === 0);
    await loginAs(SA_EMAIL, 'wrong-Password1!', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0');
    const second = await loginAs(SA_EMAIL, PW, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1');
    await new Promise((res) => setTimeout(res, 600));
    check('A new device sends a new-device email', (await p.emailLog.count({ where: { to: SA_EMAIL, subject: { contains: 'New sign-in' } } })) === 1);
    await loginAs(SA_EMAIL, PW, 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36');
    await new Promise((res) => setTimeout(res, 400));
    check('A known device sends nothing', (await p.emailLog.count({ where: { to: SA_EMAIL, subject: { contains: 'New sign-in' } } })) === 1);
    r = await call(SA, 'GET', '/account/sign-ins');
    const rows = r.data?.data ?? [];
    check('Sign-in history: device and result', r.status === 200 && rows.length >= 4 && rows.some((x) => !x.success && x.device === 'Firefox on Linux') && rows.some((x) => x.success && x.device === 'Safari on iPhone'), JSON.stringify(rows.slice(0, 4)));
    check('New networks/devices are flagged', rows.find((x) => x.device === 'Safari on iPhone')?.newNetwork === true && rows.filter((x) => x.device === 'Chrome on Windows').every((x) => x.newNetwork === false) && r.data.failedFromNewPlaces >= 1, JSON.stringify(rows));
    r = await call(SA, 'GET', '/account/sign-ins?status=failed');
    check('Filter failed sign-ins', r.data?.data?.length >= 1 && r.data.data.every((x) => !x.success));
    r = await call(SA, 'PATCH', '/users/me/preferences', { notifyNewDevice: false, idleTimeoutMinutes: 30 });
    check('Save protection settings', r.status === 200 && r.data.notifyNewDevice === false && r.data.idleTimeoutMinutes === 30, JSON.stringify(r.body));
    check('Odd idle timeout → 400', (await call(SA, 'PATCH', '/users/me/preferences', { idleTimeoutMinutes: 7 })).status === 400);
    await loginAs(SA_EMAIL, PW, 'Mozilla/5.0 (Macintosh; Mac OS X 14_0) Edg/130.0');
    await new Promise((res) => setTimeout(res, 400));
    check('Alerts off → no email', (await p.emailLog.count({ where: { to: SA_EMAIL, subject: { contains: 'New sign-in' } } })) === 1);

    // Password: keep other devices when asked
    const NEW_PW = 'Sa-Account-2027!';
    r = await call(SA, 'POST', '/auth/change-password', { current_password: PW, new_password: NEW_PW, sign_out_others: false });
    check('Change password, keep other devices', r.status === 200 && r.data.revokedSessions === 0, JSON.stringify(r.body));
    check('Other device still signed in', (await call(second.h, 'GET', '/account/overview')).status === 200);
    const changed = await p.user.findUnique({ where: { email: SA_EMAIL } });
    check('Password age resets', Date.now() - changed.passwordChangedAt.getTime() < 60_000);

    // Photo
    r = await upload(SA, '/account/avatar', {}, { buf: PNG, type: 'image/png', name: 'me.png' });
    check('Upload a photo', r.status === 201 && r.data?.avatarUrl, JSON.stringify(r.body));
    check('Not an image → 400', (await upload(SA, '/account/avatar', {}, { buf: Buffer.from('hello'), type: 'image/png', name: 'x.png' })).status === 400);
    r = await call(SA, 'DELETE', '/account/avatar');
    check('Remove the photo', r.status === 200 && r.data.avatarUrl === null);

    // Email change
    check('Email change needs the password', (await call(SA, 'POST', '/account/email', { email: NEW_EMAIL, password: 'nope' })).status === 400);
    check('Email in use → 409', (await call(SA, 'POST', '/account/email', { email: a.people.admin.email, password: NEW_PW })).status === 409);
    r = await call(SA, 'POST', '/account/email', { email: NEW_EMAIL, password: NEW_PW });
    check('Start an email change', r.status === 200 && r.data.pendingEmail === NEW_EMAIL, JSON.stringify(r.body));
    r = await call(SA, 'GET', '/account/overview');
    check('Overview shows the pending email', r.data?.pendingEmail?.email === NEW_EMAIL && r.data.user.email === SA_EMAIL);
    const token = (latestMail('confirm-your-new-email').match(/change=([a-f0-9]{64})/) ?? [])[1];
    check('Link sent to the new address', Boolean(token));
    check('Bad link → 400', (await (await fetch(B + '/account/email/confirm', { method: 'POST', headers: json, body: JSON.stringify({ token: 'f'.repeat(64) }) })).status) === 400);
    r = await fetch(B + '/account/email/confirm', { method: 'POST', headers: json, body: JSON.stringify({ token }) });
    check('Confirm the new email', r.status === 200);
    check('Old sessions are signed out', (await p.refreshToken.count({ where: { user: { email: NEW_EMAIL }, isRevoked: false } })) === 0);
    const relog = await loginAs(NEW_EMAIL, NEW_PW, 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36');
    check('Sign in with the new email', relog.status === 200 && relog.h);
    const S = relog.h;

    // Confirm password before risky changes
    r = await call(S, 'PUT', `/admin/companies/${a.company.id}/limits`, { limits: {} });
    check('Risky change works while the setting is off', r.status === 200, JSON.stringify(r.body));
    await call(S, 'PATCH', '/users/me/preferences', { reauthForRisky: true });
    r = await call(S, 'PUT', `/admin/companies/${a.company.id}/limits`, { limits: {} });
    check('Setting on → asks for the password (403 reauth_required)', r.status === 403 && r.body.code === 'reauth_required', JSON.stringify(r.body));
    check('Wrong password → 400', (await call(S, 'POST', '/account/reauth', { password: 'nope' })).status === 400);
    r = await call(S, 'POST', '/account/reauth', { password: NEW_PW });
    check('Confirm password → token', r.status === 200 && r.data.token);
    r = await call({ ...S, 'x-reauth': r.data.token }, 'PUT', `/admin/companies/${a.company.id}/limits`, { limits: {} });
    check('With the token the change goes through', r.status === 200, JSON.stringify(r.body));
    check('A forged token is refused', (await call({ ...S, 'x-reauth': 'abc.def.ghi' }, 'PUT', `/admin/companies/${a.company.id}/limits`, { limits: {} })).status === 403);
    check('Normal pages don’t ask', (await call(S, 'GET', '/admin/companies?limit=1')).status === 200);
    await call(S, 'PATCH', '/users/me/preferences', { reauthForRisky: false });

    // Platform admins
    check('Company admins can’t list platform admins → 403', (await call(a.sessions.admin, 'GET', '/admin/platform-admins')).status === 403);
    r = await call(S, 'POST', '/admin/platform-admins', { email: INVITE, firstName: 'New', lastName: 'Admin' });
    check('Invite a Super Admin', r.status === 201 && r.data.email === INVITE, JSON.stringify(r.body));
    check('Duplicate invite → 409', (await call(S, 'POST', '/admin/platform-admins', { email: INVITE, firstName: 'New', lastName: 'Admin' })).status === 409);
    r = await call(S, 'GET', '/admin/platform-admins');
    const invited = r.data?.find((x) => x.email === INVITE);
    check('List shows the invite', r.status === 200 && invited?.invited === true && r.data.some((x) => x.email === NEW_EMAIL));
    check('Can’t remove yourself → 403', (await call(S, 'DELETE', `/admin/platform-admins/${(await p.user.findUnique({ where: { email: NEW_EMAIL } })).id}`)).status === 403);
    r = await call(S, 'DELETE', `/admin/platform-admins/${invited.id}`);
    check('Remove access', r.status === 200 && (await p.user.findUnique({ where: { email: INVITE } })).status === 'INACTIVE');
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    await dropCompany(A);
    await clean();
    restoreMail();
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
