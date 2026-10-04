// profile: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Profile-E2E-2026!';
const SLUG = 'profile-e2e';
const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x !== '' && !ok ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const isForm = b instanceof FormData;
  const headers = { ...h }; if (isForm) delete headers['content-type'];
  const r = await fetch(B + u, { method: m, headers, body: b ? (isForm ? b : JSON.stringify(b)) : undefined });
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('json')) return { status: r.status, raw: Buffer.from(await r.arrayBuffer()), headers: r.headers };
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
async function login(email) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 15000)); continue; }
    return { authorization: 'Bearer ' + (await r.json()).data.access_token, 'content-type': 'application/json' };
  }
  throw new Error('login throttled');
}
async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.employeeHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.employee.updateMany({ where: { companyId: c.id }, data: { reportingManagerId: null } });
  await p.employeeDocument.deleteMany({ where: { companyId: c.id } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.publicHoliday.deleteMany({ where: { companyId: c.id } });
  await p.department.deleteMany({ where: { companyId: c.id } });
  await p.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await p.auditLog.deleteMany({ where: { OR: [{ companyId: c.id }, { userId: { in: ids } }] } });
  await p.userRole.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.role.deleteMany({ where: { companyId: c.id } });
  await p.companySettings.deleteMany({ where: { companyId: c.id } });
  await p.company.delete({ where: { id: c.id } });
  require('fs').rmSync(require('path').resolve('private-files', c.id), { recursive: true, force: true });
  require('fs').rmSync(require('path').resolve('uploads', c.id), { recursive: true, force: true });
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const form = (buf, name, type, fields = {}) => { const f = new FormData(); f.append('file', new Blob([buf], { type }), name); for (const [k, v] of Object.entries(fields)) f.append(k, v); return f; };

(async () => {
  await cleanup();
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    // The company's calendar day (Asia/Kolkata, UTC+5:30) — the UTC day differs between 00:00 and 05:30 IST
    const today = new Date(Date.now() + 330 * 60_000); const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
    const people = {};
    const mk = async (name, keys, managerId, extra = {}) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: utc(2025, 0, 1), reportingManagerId: managerId ?? null, ...extra } });
      people[name] = e; return e;
    };
    const boss = await mk('boss', ['employee', 'manager']);
    const emp = await mk('emp', ['employee'], boss.id, {
      dateOfBirth: utc(1995, today.getUTCMonth(), today.getUTCDate() + 3), showBirthday: true,
      joiningDate: utc(today.getUTCFullYear() - 2, today.getUTCMonth(), today.getUTCDate() + 5),
    });
    await mk('peer', ['employee'], boss.id, { dateOfBirth: utc(1990, today.getUTCMonth(), today.getUTCDate() + 1), showBirthday: false, joiningDate: utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 3) });
    await mk('hr', ['employee', 'hr']);
    // closure rows
    for (const e of Object.values(people)) await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 } });
    for (const n of ['emp', 'peer']) await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: boss.id, descendantId: people[n].id, depth: 1 } });
    await p.publicHoliday.create({ data: { companyId: company.id, name: 'Test Day', date: utc(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 10), year: today.getUTCFullYear() } });

    const E = await login(emp.email), P = await login(people.peer.email), M = await login(boss.email), H = await login(people.hr.email);
    const base = `/employees/${emp.id}`;

    // me + completion
    const me = await call(E, 'GET', '/people/me');
    check('people/me returns own card + checklist', me.status === 200 && me.data.employee.id === emp.id && me.data.completion.percent === 14, JSON.stringify(me.data?.completion));
    check('boss sees direct-report count', (await call(M, 'GET', '/people/me')).data.employee.directReportCount === 2);

    // personal
    const pers = await call(E, 'PUT', `${base}/personal`, { phone: '9876543210', bloodGroup: 'O+', currentAddress: { line1: '12 MG Road', city: 'Bengaluru', state: 'KA', postalCode: '560001' }, emergencyContactName: 'Mom', emergencyContactRelation: 'Mother', emergencyContactPhone: '9000000000' });
    check('Employee updates own personal details', pers.status === 200, JSON.stringify(pers.body));
    check('Bad blood group → 400', (await call(E, 'PUT', `${base}/personal`, { bloodGroup: 'Z' })).status === 400);
    check('Future date of birth → 400', (await call(E, 'PUT', `${base}/personal`, { dateOfBirth: '2999-01-01' })).status === 400);

    // bank + statutory
    const bank = await call(E, 'PUT', `${base}/bank`, { accountHolderName: 'Emp T', accountNumber: '123456789012', ifscCode: 'hdfc0001234', bankName: 'HDFC' });
    check('Bank saved, response masked', bank.status === 200 && bank.data.bank.accountNumberMasked.endsWith('9012') && !JSON.stringify(bank.data).includes('123456789012'), JSON.stringify(bank.body));
    check('Bad IFSC → 400', (await call(E, 'PUT', `${base}/bank`, { accountHolderName: 'Emp T', accountNumber: '123456789012', ifscCode: 'BAD', bankName: 'HDFC' })).status === 400);
    const stat = await call(E, 'PUT', `${base}/statutory`, { pan: 'abcde1234f', aadhaar: '1234 5678 9012', uan: '100200300400' });
    check('IDs saved: PAN + Aadhaar masked', stat.status === 200 && stat.data.statutory.panMasked === '••••••234F' && stat.data.statutory.aadhaarMasked === 'XXXX XXXX 9012', JSON.stringify(stat.body));
    check('Bad PAN → 400', (await call(E, 'PUT', `${base}/statutory`, { pan: '12345' })).status === 400);
    const rawBank = await p.employeeBankDetails.findUnique({ where: { employeeId: emp.id } });
    const rawStat = await p.employeeStatutory.findUnique({ where: { employeeId: emp.id } });
    check('DB: account number encrypted', rawBank.accountNumber.startsWith('v1.') && !rawBank.accountNumber.includes('123456789012'));
    check('DB: PAN encrypted, only Aadhaar last 4 kept', rawStat.pan.startsWith('v1.') && rawStat.aadhaarLast4 === '9012' && !JSON.stringify(rawStat).includes('12345678'));

    // read + reveal
    const priv = await call(E, 'GET', `${base}/private`);
    check('Own private view (masked, editable)', priv.status === 200 && priv.data.canEdit && priv.data.personal.bloodGroup === 'O+' && priv.data.bank.accountNumberMasked.endsWith('9012'));
    const rev = await call(E, 'POST', `${base}/private/reveal`);
    check('Reveal returns full values', rev.status === 200 && rev.data.pan === 'ABCDE1234F' && rev.data.accountNumber === '123456789012');
    await new Promise((s) => setTimeout(s, 500));
    const log = await p.auditLog.findFirst({ where: { action: 'employee:private:reveal', companyId: company.id } });
    check('Reveal audited, values redacted', log && JSON.stringify(log.afterState).includes('REDACTED') && !JSON.stringify(log.afterState).includes('ABCDE1234F'), JSON.stringify(log?.afterState));

    // who else can see it
    check('Colleague: private → 404', (await call(P, 'GET', `${base}/private`)).status === 404);
    { const r = await call(P, 'PUT', `${base}/bank`, { accountHolderName: 'Xy Z', accountNumber: '999999999', ifscCode: 'HDFC0001234', bankName: 'Xyz' }); check('Colleague: cannot edit → 404', r.status === 404, r.status + ' ' + JSON.stringify(r.body)); }
    check('Manager (private = own only) → 404 for a report', (await call(M, 'GET', `${base}/private`)).status === 404);
    const hrPriv = await call(H, 'GET', `${base}/private`);
    check('HR sees private (masked) + can edit', hrPriv.status === 200 && hrPriv.data.canEdit && hrPriv.data.statutory.panMasked === '••••••234F');
    check('Employee record (employee.view) has no bank/ID data', !JSON.stringify((await call(M, 'GET', `/employees/${emp.id}`)).data).match(/accountNumber|pan"|aadhaar|bloodGroup/));

    // avatar
    const av = await call(E, 'POST', `${base}/avatar`, form(PNG, 'me.png', 'image/png'));
    check('Avatar upload (PNG)', av.status === 201 && /\/uploads\/.+\/avatars\/.+\.png/.test(av.data.avatarUrl), JSON.stringify(av.body));
    check('Avatar: text file disguised as PNG → 400', (await call(E, 'POST', `${base}/avatar`, form(Buffer.from('hello'), 'x.png', 'image/png'))).status === 400);
    check('Avatar: colleague cannot change → 404', (await call(P, 'POST', `${base}/avatar`, form(PNG, 'x.png', 'image/png'))).status === 404);
    check('Avatar also on the user account', (await p.user.findUnique({ where: { id: emp.userId } })).avatarUrl === av.data.avatarUrl);

    // documents
    const up = await call(E, 'POST', `${base}/documents`, form(PDF, '../../evil name.pdf', 'application/pdf', { category: 'ID_PROOF', name: 'PAN card' }));
    check('Employee uploads own document', up.status === 201 && up.data.fileName === 'evil name.pdf', JSON.stringify(up.body));
    check('Exe disguised as PDF → 400', (await call(E, 'POST', `${base}/documents`, form(Buffer.from('MZ\x90\x00'), 'a.pdf', 'application/pdf', { category: 'OTHER' }))).status === 400);
    check('Bad category → 400', (await call(E, 'POST', `${base}/documents`, form(PDF, 'a.pdf', 'application/pdf', { category: 'NOPE' }))).status === 400);
    const dl = await call(E, 'GET', `${base}/documents/${up.data.id}/download`);
    check('Download returns the same bytes, as attachment', dl.status === 200 && dl.raw?.equals(PDF) && (dl.headers.get('content-disposition') || '').startsWith('attachment'), dl.status);
    check('Colleague cannot list/download → 404', (await call(P, 'GET', `${base}/documents`)).status === 404 && (await call(P, 'GET', `${base}/documents/${up.data.id}/download`)).status === 404);
    check('Manager (all_reports) can list', (await call(M, 'GET', `${base}/documents`)).data?.documents?.length === 1);
    check('Not publicly served under /uploads', (await fetch(B.replace('/api/v1', '') + `/uploads/${company.id}/documents/${emp.id}/${up.data.id}.pdf`)).status === 404);
    const hrUp = await call(H, 'POST', `${base}/documents`, form(PDF, 'offer.pdf', 'application/pdf', { category: 'OFFER_LETTER' }));
    const list = (await call(E, 'GET', `${base}/documents`)).data;
    check('List: own upload deletable, HR upload not', list.documents.find((d) => d.id === up.data.id).canDelete && !list.documents.find((d) => d.id === hrUp.data.id).canDelete);
    check('Employee cannot delete HR-uploaded doc → 403', (await call(E, 'DELETE', `${base}/documents/${hrUp.data.id}`)).status === 403);
    check('Employee deletes own upload', (await call(E, 'DELETE', `${base}/documents/${up.data.id}`)).status === 200);
    check('HR deletes a document', (await call(H, 'DELETE', `${base}/documents/${hrUp.data.id}`)).status === 200);
    check('Download audited', (await p.auditLog.count({ where: { action: 'employee:document:download', companyId: company.id } })) === 1);

    // directory + spotlight
    const dir = await call(P, 'GET', '/people?search=emp');
    check('Directory (any employee) — basic fields only', dir.status === 200 && dir.body.data.length === 1 && !('phone' in dir.body.data[0]) && !('dateOfBirth' in dir.body.data[0]), JSON.stringify(dir.body.data?.[0]));
    const sp = (await call(P, 'GET', '/people/spotlight')).data;
    check('Spotlight: everyone’s birthday, day and month only', sp.birthdays.length === 2 && sp.birthdays.some((b) => b.id === emp.id && b.inDays === 3) && !JSON.stringify(sp.birthdays).match(/199[05]/), JSON.stringify(sp.birthdays));
    check('Spotlight: 2-year anniversary in 5 days', sp.anniversaries.some((a) => a.id === emp.id && a.years === 2 && a.inDays === 5), JSON.stringify(sp.anniversaries));
    check('Spotlight: new joiner + holiday', sp.newJoiners.some((n) => n.id === people.peer.id) && sp.holidays[0]?.name === 'Test Day');

    const meAfter = await call(E, 'GET', '/people/me');
    check('Checklist updates (100% done)', meAfter.data.completion.percent === 100, JSON.stringify(meAfter.data.completion));
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
