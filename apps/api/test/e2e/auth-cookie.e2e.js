// Session security: the refresh token lives only in an httpOnly cookie, refresh /
// sign-out need the CSRF header, rotation + reuse detection, edited tokens are
// refused, and the temporary-password flag is enforced by the server.
const { prisma: p, suite, makeCompany, dropCompany, wait, B } = require('./lib');

const SLUG = 'auth-cookie-e2e';
const PW = 'E2E-Test-2026!';
const t = suite('auth-cookie');
const { check } = t;
const ORIGIN = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',')[0].trim();

/** Raw sign-in (lib.login only returns the header). Waits out the 10/min sign-in limit. */
async function signIn(email) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (r.status === 429) {
      await wait(15000);
      continue;
    }
    return { r, body: await r.json(), cookie: r.headers.getSetCookie().find((c) => c.startsWith('hrms_rt=')) ?? '' };
  }
  throw new Error('sign-in throttled');
}
const valueOf = (setCookie) => setCookie.split(';')[0]; // "hrms_rt=…"
const refresh = (cookie, csrf = true) =>
  fetch(B + '/auth/refresh', { method: 'POST', headers: { ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-hrms-csrf': '1' } : {}) } });

(async () => {
  await dropCompany(SLUG);
  const { people } = await makeCompany(SLUG, [['admin', ['company_admin', 'employee']], ['temp', ['employee']]]);

  // ── Sign-in: no refresh token in the body, an httpOnly cookie instead
  const a = await signIn(people.admin.email);
  check('sign-in succeeds', a.r.status === 200, a.r.status);
  check('access token in the body', typeof a.body.data?.access_token === 'string');
  check('NO refresh token anywhere in the body', !JSON.stringify(a.body).includes('refresh_token'), Object.keys(a.body.data ?? {}).join(','));
  check('refresh cookie set', a.cookie.startsWith('hrms_rt='), a.cookie);
  check('cookie is HttpOnly', /;\s*HttpOnly/i.test(a.cookie), a.cookie);
  check('cookie only goes to /api/v1/auth', /;\s*Path=\/api\/v1\/auth/i.test(a.cookie), a.cookie);
  check('cookie is SameSite=Lax', /;\s*SameSite=Lax/i.test(a.cookie), a.cookie);
  const access = { authorization: 'Bearer ' + a.body.data.access_token };

  // ── Refresh needs the cookie AND the CSRF header
  const c1 = valueOf(a.cookie);
  const noHeader = await refresh(c1, false);
  check('refresh without the CSRF header → 403', noHeader.status === 403, noHeader.status);
  const noCookie = await refresh(null);
  check('refresh without the cookie → 401', noCookie.status === 401, noCookie.status);
  const garbage = await refresh('hrms_rt=' + 'a'.repeat(64));
  check('refresh with a made-up cookie → 401', garbage.status === 401, garbage.status);
  const ok = await refresh(c1);
  const okBody = await ok.json();
  const rotated = ok.headers.getSetCookie().find((c) => c.startsWith('hrms_rt=')) ?? '';
  check('refresh with cookie + header → 200', ok.status === 200, ok.status);
  check('refresh returns a new access token', typeof okBody.data?.access_token === 'string');
  check('refresh body has NO refresh token', !JSON.stringify(okBody).includes('refresh_token'));
  check('refresh rotates the cookie', rotated && valueOf(rotated) !== c1, rotated);

  // ── Reuse detection: the old cookie again ends the whole session
  const reused = await refresh(c1);
  check('re-using a rotated cookie → 401', reused.status === 401, reused.status);
  check('…and the refusal clears the cookie', (reused.headers.getSetCookie().find((c) => c.startsWith('hrms_rt=')) ?? '').match(/Expires=Thu, 01 Jan 1970|Max-Age=0/i));
  const afterTheft = await refresh(valueOf(rotated));
  check('…and the newest cookie is revoked too (family)', afterTheft.status === 401, afterTheft.status);

  // ── Sign-out revokes the cookie's session and clears it
  const b = await signIn(people.admin.email);
  const c2 = valueOf(b.cookie);
  const outNoHeader = await fetch(B + '/auth/logout', { method: 'POST', headers: { cookie: c2 } });
  check('sign-out without the CSRF header → 403', outNoHeader.status === 403, outNoHeader.status);
  const out = await fetch(B + '/auth/logout', { method: 'POST', headers: { cookie: c2, 'x-hrms-csrf': '1' } });
  check('sign-out → 200', out.status === 200, out.status);
  check('sign-out clears the cookie', (out.headers.getSetCookie().find((c) => c.startsWith('hrms_rt=')) ?? '').match(/Expires=Thu, 01 Jan 1970|Max-Age=0/i));
  const afterOut = await refresh(c2);
  check('signed-out cookie can no longer refresh', afterOut.status === 401, afterOut.status);
  const outExpired = await fetch(B + '/auth/logout', { method: 'POST', headers: { 'x-hrms-csrf': '1' } });
  check('sign-out works without an access token or cookie', outExpired.status === 200, outExpired.status);

  // ── CORS: other sites can't send the CSRF header
  const evil = await fetch(B + '/auth/refresh', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-hrms-csrf' } });
  check('preflight from another site is not allowed', evil.headers.get('access-control-allow-origin') !== 'https://evil.example', evil.headers.get('access-control-allow-origin'));
  const ours = await fetch(B + '/auth/refresh', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-hrms-csrf' } });
  check('preflight from our web app allows the header + credentials', ours.headers.get('access-control-allow-origin') === ORIGIN && /x-hrms-csrf/i.test(ours.headers.get('access-control-allow-headers') ?? '') && ours.headers.get('access-control-allow-credentials') === 'true', [...ours.headers].join(' | '));

  // ── Edited tokens are refused (the signature no longer matches)
  const me = await fetch(B + '/auth/me', { headers: access });
  check('/auth/me with the real token → 200', me.status === 200, me.status);
  const [h, payload, sig] = a.body.data.access_token.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  const forged = [h, Buffer.from(JSON.stringify({ ...claims, is_super_admin: true })).toString('base64url'), sig].join('.');
  const asSa = await fetch(B + '/admin/companies', { headers: { authorization: 'Bearer ' + forged } });
  check('token edited to Super Admin → 401', asSa.status === 401, asSa.status);
  const other = [h, Buffer.from(JSON.stringify({ ...claims, sub: people.temp.user.id })).toString('base64url'), sig].join('.');
  const asOther = await fetch(B + '/auth/me', { headers: { authorization: 'Bearer ' + other } });
  check('token edited to another person → 401', asOther.status === 401, asOther.status);

  // ── Temporary password: the server's flag decides, whatever the browser says
  await p.user.update({ where: { id: people.temp.user.id }, data: { mustChangePassword: true } });
  const tmp = await signIn(people.temp.email);
  const th = { authorization: 'Bearer ' + tmp.body.data.access_token };
  const tme = await (await fetch(B + '/auth/me', { headers: th })).json();
  check('/auth/me reports mustChangePassword from the server', tme.data?.mustChangePassword === true, JSON.stringify(tme.data));
  const blocked = await fetch(B + '/people/me', { headers: th });
  const blockedBody = await blocked.json().catch(() => ({}));
  check('other API calls are refused until the password is changed', blocked.status === 403 && JSON.stringify(blockedBody).includes('PASSWORD_CHANGE_REQUIRED'), `${blocked.status} ${JSON.stringify(blockedBody).slice(0, 120)}`);
  const wrong = await fetch(B + '/auth/change-password', { method: 'POST', headers: { ...th, 'content-type': 'application/json' }, body: JSON.stringify({ current_password: 'not-the-password', new_password: 'Brand-New-2026!x' }) });
  check('changing a password needs the current one', wrong.status === 400, wrong.status);

  await dropCompany(SLUG);
  await p.$disconnect();
  process.exit(t.done() ? 0 : 1);
})().catch(async (e) => {
  console.error(e);
  await dropCompany(SLUG).catch(() => undefined);
  await p.$disconnect();
  process.exit(1);
});
