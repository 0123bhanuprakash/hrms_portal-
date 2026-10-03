// attendance: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Attend-E2E-2026!';
const SLUG = 'attendance-e2e';
const TZ = 'Asia/Kolkata';
const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const r = await fetch(B + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('json')) return { status: r.status, text: await r.text(), headers: r.headers };
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
async function login(email) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 15000)); continue; }
    return { authorization: 'Bearer ' + (await r.json()).data.access_token, 'content-type': 'application/json' };
  }
  throw new Error('login throttled');
}
const localKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const addDays = (key, n) => { const d = new Date(key + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (key) => new Date(key + 'T00:00:00Z').getUTCDay();
/** Most recent working day (Mon–Fri) strictly before `key`. */
const prevWorkday = (key) => { let k = addDays(key, -1); while ([0, 6].includes(weekday(k))) k = addDays(k, -1); return k; };

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.attendanceRegularisation.deleteMany({ where: { companyId: c.id } });
  await p.attendanceRecord.deleteMany({ where: { companyId: c.id } });
  await p.attendancePolicy.deleteMany({ where: { companyId: c.id } });
  await p.publicHoliday.deleteMany({ where: { companyId: c.id } });
  await p.approvalDelegation.deleteMany({ where: { companyId: c.id } });
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
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: TZ } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const people = {};
    const mk = async (name, keys, managerId, first = name) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: first, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: first, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), reportingManagerId: managerId ?? null } });
      people[name] = { ...e, user: u };
      await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 } });
      if (managerId) await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: managerId, descendantId: e.id, depth: 1 } });
      return e;
    };
    const boss = await mk('boss', ['employee', 'manager']);
    await mk('emp', ['employee'], boss.id);
    await mk('peer', ['employee'], boss.id, '=SUM(1)');
    await mk('cover', ['employee']);
    await mk('hr', ['employee', 'hr']);

    const E = await login(people.emp.email), P = await login(people.peer.email), M = await login(boss.email), C = await login(people.cover.email), H = await login(people.hr.email);
    const today = localKey(new Date());
    const month = today.slice(0, 7);
    const y1 = prevWorkday(today), y2 = prevWorkday(y1), y3 = prevWorkday(y2);

    // ── Holidays
    const hol = await call(H, 'POST', '/holidays', { name: 'Test Holiday', date: y3 });
    check('HR adds a holiday', hol.status === 201, JSON.stringify(hol.body));
    check('Duplicate holiday date → 409', (await call(H, 'POST', '/holidays', { name: 'Dup', date: y3 })).status === 409);
    check('Employee cannot add holidays → 403', (await call(E, 'POST', '/holidays', { name: 'Mine', date: today })).status === 403);
    check('Employee lists holidays', (await call(E, 'GET', `/holidays?year=${y3.slice(0, 4)}`)).data?.length === 1);

    // ── Policy
    check('Employee reads policy', (await call(E, 'GET', '/attendance/policy')).data?.timeZone === TZ);
    check('Employee cannot change policy → 403', (await call(E, 'PUT', '/attendance/policy', { graceMinutes: 0 })).status === 403);
    check('Shift end before start → 400', (await call(H, 'PUT', '/attendance/policy', { shiftStart: '18:00', shiftEnd: '09:00' })).status === 400);
    const pol = await call(H, 'PUT', '/attendance/policy', { graceMinutes: 10, workDays: [1, 2, 3, 4, 5] });
    check('HR updates policy', pol.status === 200 && pol.data.graceMinutes === 10, JSON.stringify(pol.body));

    // ── Check in / out
    const t0 = await call(E, 'GET', '/attendance/today');
    check('Today before check-in', t0.status === 200 && t0.data.date === today && t0.data.record === null, JSON.stringify(t0.data));
    const ci = await call(E, 'POST', '/attendance/check-in');
    check('Check in', ci.status === 201 && ci.data.checkIn, JSON.stringify(ci.body));
    const nowMin = (() => { const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number); return h * 60 + m; })();
    const expectLate = Math.max(0, nowMin - (9 * 60 + 30 + 10));
    check('Late minutes from shift start + grace', Math.abs((ci.data?.lateMinutes ?? 0) - expectLate) <= 1, `${ci.data?.lateMinutes} vs ${expectLate}`);
    check('Second check-in → 409', (await call(E, 'POST', '/attendance/check-in')).status === 409);
    check('Today shows WORKING', (await call(E, 'GET', '/attendance/today')).data.status === 'WORKING');
    const co = await call(E, 'POST', '/attendance/check-out');
    check('Check out (minutes worked → status)', co.status === 200 && co.data.workingMinutes === 0 && co.data.status === 'ABSENT', JSON.stringify(co.body));
    check('Second check-out → 409', (await call(E, 'POST', '/attendance/check-out')).status === 409);
    check('Check-out without check-in → 400', (await call(P, 'POST', '/attendance/check-out')).status === 400);

    // ── Corrections
    const bad = [
      ['Future date → 400', { date: addDays(today, 1), checkIn: '09:30', checkOut: '18:30', reason: 'future' }],
      ['Outside the window → 400', { date: addDays(today, -60), checkIn: '09:30', checkOut: '18:30', reason: 'old' }],
      ['Check-out before check-in → 400', { date: y1, checkIn: '18:30', checkOut: '09:30', reason: 'swap' }],
    ];
    for (const [name, body] of bad) check(name, (await call(E, 'POST', '/attendance/regularisations', body)).status === 400);
    const req1 = await call(E, 'POST', '/attendance/regularisations', { date: y1, checkIn: '09:30', checkOut: '18:45', reason: 'Forgot to check in' });
    check('Employee requests a correction', req1.status === 201 && req1.data.status === 'PENDING', JSON.stringify(req1.body));
    check('Second pending request same day → 409', (await call(E, 'POST', '/attendance/regularisations', { date: y1, checkIn: '10:00', reason: 'again' })).status === 409);
    check('Employee sees own requests', (await call(E, 'GET', '/attendance/regularisations?view=mine')).data?.length === 1);
    check('Employee has nothing to review', (await call(E, 'GET', '/attendance/regularisations?view=review')).data?.length === 0);
    check('Employee cannot approve own → 404', (await call(E, 'POST', `/attendance/regularisations/${req1.data.id}/approve`, {})).status === 404);
    check('Peer (not an approver) → 404', (await call(P, 'POST', `/attendance/regularisations/${req1.data.id}/approve`, {})).status === 404);
    check('Manager pending count = 1', (await call(M, 'GET', '/attendance/regularisations/pending-count')).data?.count === 1);
    const review = await call(M, 'GET', '/attendance/regularisations?view=review');
    check('Manager review list', review.data?.length === 1 && review.data[0].employee.id === people.emp.id);
    const ap = await call(M, 'POST', `/attendance/regularisations/${req1.data.id}/approve`, { note: 'ok' });
    check('Manager approves', ap.status === 200 && ap.data.status === 'APPROVED' && ap.data.onBehalfOf === null, JSON.stringify(ap.body));
    check('Approving twice → 409', (await call(M, 'POST', `/attendance/regularisations/${req1.data.id}/approve`, {})).status === 409);
    const rec1 = await p.attendanceRecord.findFirst({ where: { employeeId: people.emp.id, date: new Date(y1 + 'T00:00:00Z') } });
    check('Record written from correction (555 min, PRESENT)', rec1?.workingMinutes === 555 && rec1.status === 'PRESENT' && rec1.checkInSource === 'REGULARISED' && rec1.isManualEntry, JSON.stringify(rec1));
    check('Stored instant = 09:30 IST', rec1 && rec1.checkIn.toISOString().endsWith('04:00:00.000Z'), rec1?.checkIn.toISOString());

    // ── Delegation: cover approves on behalf of boss
    const del = await call(M, 'POST', '/delegations', { delegateId: people.cover.user.id, endsAt: new Date(Date.now() + 3 * 86400000).toISOString(), reason: 'Leave' });
    check('Manager delegates approvals', del.status === 201, JSON.stringify(del.body));
    const C2 = await login(people.cover.email);
    const req2 = await call(E, 'POST', '/attendance/regularisations', { date: y2, checkIn: '10:00', checkOut: '15:00', reason: 'Card issue' });
    const ap2 = await call(C2, 'POST', `/attendance/regularisations/${req2.data.id}/approve`, {});
    check('Delegate approves, recorded on behalf of manager', ap2.status === 200 && ap2.data.onBehalfOf?.id === boss.userId && ap2.data.reviewedBy.id === people.cover.user.id, JSON.stringify(ap2.body));
    const rec2 = await p.attendanceRecord.findFirst({ where: { employeeId: people.emp.id, date: new Date(y2 + 'T00:00:00Z') } });
    check('300 min → HALF_DAY', rec2?.status === 'HALF_DAY', rec2?.status);
    const own = await call(C2, 'POST', '/attendance/regularisations', { date: y1, checkIn: '09:00', checkOut: '18:00', reason: 'mine' });
    check('Delegate cannot approve own request → 404', (await call(C2, 'POST', `/attendance/regularisations/${own.data.id}/approve`, {})).status === 404);
    const rej = await call(H, 'POST', `/attendance/regularisations/${own.data.id}/reject`, { note: 'No proof' });
    check('HR rejects', rej.status === 200 && rej.data.status === 'REJECTED' && rej.data.reviewNote === 'No proof');
    const req3 = await call(E, 'POST', '/attendance/regularisations', { date: y1, checkIn: '09:00', reason: 'again' });
    check('Employee cancels own pending', (await call(E, 'POST', `/attendance/regularisations/${req3.data.id}/cancel`)).data?.status === 'CANCELLED');

    // ── HR sets a day directly
    const y4 = prevWorkday(y3);
    check('Peer cannot edit records → 403', (await call(P, 'PUT', '/attendance/records', { employeeId: people.emp.id, date: y4, status: 'ON_LEAVE' })).status === 403);
    const up = await call(H, 'PUT', '/attendance/records', { employeeId: people.emp.id, date: y4, status: 'ON_LEAVE', notes: 'Sick' });
    check('HR marks a day ON_LEAVE', up.status === 200 && up.data.status === 'ON_LEAVE', JSON.stringify(up.body));

    // ── Calendar
    const cal = await call(E, 'GET', `/attendance/calendar?month=${y4.slice(0, 7)}`);
    const day = (k) => cal.data?.days.find((d) => d.date === k)?.status;
    check('Calendar: correction → PRESENT', y1.slice(0, 7) !== y4.slice(0, 7) || day(y1) === 'PRESENT', day(y1));
    check('Calendar: holiday + leave', day(y3) === 'HOLIDAY' && day(y4) === 'ON_LEAVE', `${day(y3)} ${day(y4)}`);
    const sat = cal.data?.days.find((d) => weekday(d.date) === 6);
    check('Calendar: Saturday = WEEKEND', sat?.status === 'WEEKEND');
    check('Peer cannot see emp calendar → 404', (await call(P, 'GET', `/attendance/calendar?month=${month}&employeeId=${people.emp.id}`)).status === 404);
    check('Manager sees report calendar', (await call(M, 'GET', `/attendance/calendar?month=${month}&employeeId=${people.emp.id}`)).status === 200);

    // ── Team
    const team = await call(M, 'GET', '/attendance/team');
    check('Manager team view (self + 2 reports)', team.status === 200 && team.data.counts.total === 3, JSON.stringify(team.data?.counts));
    check('Team: emp status today = ABSENT (checked out at 0h)', team.data.data.find((r) => r.employee.id === people.emp.id)?.status === 'ABSENT');
    check('Team filter NOT_CHECKED_IN', (await call(M, 'GET', '/attendance/team?status=NOT_CHECKED_IN')).data.data.every((r) => r.status === 'NOT_CHECKED_IN'));
    check('HR team view = whole company (5)', (await call(H, 'GET', '/attendance/team')).data.counts.total === 5);
    check('Employee team view = only self', (await call(E, 'GET', '/attendance/team')).data.counts.total === 1);

    // ── Export
    const ex = await call(H, 'GET', `/attendance/export?month=${month}`);
    check('HR exports CSV', ex.status === 200 && (ex.headers.get('content-type') || '').includes('text/csv') && ex.text.includes('Employee ID,Name'));
    check('CSV neutralises formulas', ex.text.includes("'=SUM(1) T") && !/(^|,)=SUM/m.test(ex.text));
    check('Employee cannot export → 403', (await call(E, 'GET', `/attendance/export?month=${month}`)).status === 403);
    await new Promise((s) => setTimeout(s, 400));
    const exLog = await p.auditLog.findFirst({ where: { action: 'attendance:export', companyId: company.id } });
    check('Export audited without file bytes', exLog && exLog.afterState === null);

    // ── Web check-in switch
    await call(H, 'PUT', '/attendance/policy', { webCheckInEnabled: false });
    check('Web check-in off → 403', (await call(P, 'POST', '/attendance/check-in')).status === 403);
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
