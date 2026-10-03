// notifications: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Notify-E2E-2026!';
const SLUG = 'notify-e2e';
const TZ = 'Asia/Kolkata';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const r = await fetch(B + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
const wait = (ms = 1200) => new Promise((r) => setTimeout(r, ms));
async function login(email) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (r.status === 429) { await wait(15000); continue; }
    return { authorization: 'Bearer ' + (await r.json()).data.access_token, 'content-type': 'application/json' };
  }
  throw new Error('login throttled');
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const addDays = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = (off) => { let k = addDays(today, off); while (new Date(k + 'T00:00:00Z').getUTCDay() !== 1) k = addDays(k, 1); return k; };
const prevWorkday = (k) => { let x = addDays(k, -1); while ([0, 6].includes(new Date(x + 'T00:00:00Z').getUTCDay())) x = addDays(x, -1); return x; };
const inbox = (userId, type) => p.notification.findMany({ where: { userId, ...(type && { type }) }, orderBy: { createdAt: 'desc' } });

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.attendanceRegularisation.deleteMany({ where: { companyId: c.id } });
  await p.attendanceRecord.deleteMany({ where: { companyId: c.id } });
  await p.leaveRequest.deleteMany({ where: { companyId: c.id } });
  await p.leaveBalance.deleteMany({ where: { companyId: c.id } });
  await p.leaveType.deleteMany({ where: { companyId: c.id } });
  await p.approvalDelegation.deleteMany({ where: { companyId: c.id } });
  await p.employeeHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.employee.updateMany({ where: { companyId: c.id }, data: { reportingManagerId: null } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.userPreferences.deleteMany({ where: { userId: { in: ids } } });
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
  const mailDir = path.resolve('.mail');
  const mailBefore = new Set(fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []);
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: TZ } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys, manager, first = name) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: first, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: first, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), reportingManagerId: manager ? P[manager].id : null } });
      P[name] = { ...e, user: u };
    };
    await mk('top', ['employee', 'manager']);
    await mk('boss', ['employee', 'manager'], 'top');
    await mk('emp', ['employee'], 'boss', 'Emp<script>alert(1)</script>');
    await mk('peer', ['employee'], 'boss');
    await mk('cover', ['employee']);
    await mk('hr', ['employee', 'hr']);
    for (const n of Object.keys(P)) {
      let depth = 0, cur = P[n];
      while (cur) {
        await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: cur.id, descendantId: P[n].id, depth } });
        cur = cur.reportingManagerId ? Object.values(P).find((x) => x.id === cur.reportingManagerId) : null;
        depth++;
      }
    }
    // Peer opted out of notification emails
    await p.userPreferences.create({ data: { userId: P.peer.user.id, emailNotifications: false } });

    const E = await login(P.emp.email), BO = await login(P.boss.email), T = await login(P.top.email), H = await login(P.hr.email), PE = await login(P.peer.email);
    const types = Object.fromEntries((await call(E, 'GET', '/leave/types')).data.map((t) => [t.code, t]));
    await call(H, 'PATCH', `/leave/types/${types.CL.id}`, { ...types.CL, id: undefined, approvalLevels: 2 });

    // ── Leave: submitted → level 2 → approved
    const m1 = monday(8);
    const req = await call(E, 'POST', '/leave/requests', { leaveTypeId: types.CL.id, startDate: m1, endDate: m1, reason: 'Family <b>event</b>' });
    await wait();
    const bossN = await inbox(P.boss.user.id, 'leave.submitted');
    check('Boss notified of new request', bossN.length === 1 && bossN[0].link === '/app/leave/approvals' && bossN[0].title.includes('(approval 1 of 2)'), JSON.stringify(bossN[0]));
    check('…and emailed', Boolean(bossN[0]?.emailedAt));
    check('Employee not notified of own request', (await inbox(P.emp.user.id)).length === 0);
    await call(BO, 'POST', `/leave/requests/${req.data.id}/approve`, {});
    await wait();
    check('Top notified for level 2', (await inbox(P.top.user.id, 'leave.submitted')).some((n) => n.title.includes('(approval 2 of 2)')));
    check('Employee not told yet (still pending)', (await inbox(P.emp.user.id, 'leave.approved')).length === 0);
    await call(T, 'POST', `/leave/requests/${req.data.id}/approve`, { note: 'Have fun' });
    await wait();
    const approved = (await inbox(P.emp.user.id, 'leave.approved'))[0];
    check('Employee told it was approved, by whom, with note', approved && approved.body.includes('By top T') && approved.body.includes('Note: Have fun') && approved.link === '/app/leave', JSON.stringify(approved));

    // ── Reject
    const sl = await call(E, 'POST', '/leave/requests', { leaveTypeId: types.SL.id, startDate: addDays(m1, 1), endDate: addDays(m1, 1), reason: 'Doctor' });
    await wait(600);
    await call(BO, 'POST', `/leave/requests/${sl.data.id}/reject`, { note: 'Team offsite that day' });
    await wait();
    check('Employee told about rejection with reason', (await inbox(P.emp.user.id, 'leave.rejected'))[0]?.body.includes('Team offsite'));

    // ── Delegation + covering approver notified
    await call(BO, 'POST', '/delegations', { delegateId: P.cover.user.id, endsAt: new Date(Date.now() + 3 * 864e5).toISOString() });
    await wait();
    check('Delegate told they are covering', (await inbox(P.cover.user.id, 'delegation.assigned')).length === 1);
    const wfh = await call(E, 'POST', '/leave/requests', { leaveTypeId: types.WFH.id, startDate: addDays(m1, 2), endDate: addDays(m1, 2), reason: 'Plumber' });
    await wait();
    check('Both boss and his delegate notified', (await inbox(P.cover.user.id, 'leave.submitted')).length === 1 && (await inbox(P.boss.user.id, 'leave.submitted')).length === 3);

    // ── Withdraw (in-app only)
    await call(E, 'POST', `/leave/requests/${wfh.data.id}/cancel`, {});
    await wait();
    const wd = (await inbox(P.boss.user.id, 'leave.withdrawn'))[0];
    check('Approver told it was withdrawn — no email', wd && !wd.emailedAt, JSON.stringify(wd));

    // ── Top of chain → HR
    const tl = await call(T, 'POST', '/leave/requests', { leaveTypeId: types.SL.id, startDate: addDays(m1, 3), endDate: addDays(m1, 3), reason: 'Unwell' });
    await wait();
    check('Top of chain → HR notified', tl.status === 201 && (await inbox(P.hr.user.id, 'leave.submitted')).length === 1);

    // ── HR cancels someone's leave → employee told
    await call(H, 'POST', `/leave/requests/${req.data.id}/cancel`, { reason: 'Audit week' });
    await wait();
    check('Employee told HR cancelled their leave', (await inbox(P.emp.user.id, 'leave.cancelled'))[0]?.body.includes('Audit week'));

    // ── Attendance correction
    const y1 = prevWorkday(today);
    const corr = await call(E, 'POST', '/attendance/regularisations', { date: y1, checkIn: '09:30', checkOut: '18:30', reason: 'Card reader down' });
    await wait();
    check('Manager + delegate told about the correction', corr.status === 201 && (await inbox(P.boss.user.id, 'attendance.correction_submitted')).length === 1 && (await inbox(P.cover.user.id, 'attendance.correction_submitted')).length === 1);
    await call(BO, 'POST', `/attendance/regularisations/${corr.data.id}/approve`, { note: 'ok' });
    await wait();
    check('Employee told correction approved', (await inbox(P.emp.user.id, 'attendance.correction_approved')).length === 1);

    // ── Email preference respected
    const pr = await call(PE, 'POST', '/leave/requests', { leaveTypeId: types.SL.id, startDate: addDays(m1, 4), endDate: addDays(m1, 4), reason: 'Errand' });
    await call(BO, 'POST', `/leave/requests/${pr.data.id}/approve`, {});
    await wait();
    const peerN = (await inbox(P.peer.user.id, 'leave.approved'))[0];
    check('Opted-out user: in-app yes, email no', peerN && !peerN.emailedAt, JSON.stringify(peerN));

    // ── Emails escape user input
    const newMail = fs.readdirSync(mailDir).filter((f) => !mailBefore.has(f));
    const html = newMail.map((f) => fs.readFileSync(path.join(mailDir, f), 'utf8')).join('\n');
    check('Emails written (console provider)', newMail.length >= 5, newMail.length);
    check('Names / reasons are HTML-escaped in emails', html.includes('Emp&lt;script&gt;') && !html.includes('<script>alert(1)</script>') && html.includes('&lt;b&gt;event&lt;/b&gt;'));

    // ── Inbox API
    const list = await call(E, 'GET', '/notifications?limit=10');
    check('Inbox lists newest first with unread count', list.status === 200 && list.body.data.length >= 4 && list.body.meta.unread === list.body.meta.total, JSON.stringify(list.body.meta));
    const first = list.body.data[0];
    const rd = await call(E, 'POST', `/notifications/${first.id}/read`);
    check('Mark one read', rd.status === 200 && rd.data.unread === list.body.meta.unread - 1);
    check('Someone else cannot mark it → 404', (await call(BO, 'POST', `/notifications/${first.id}/read`)).status === 404);
    check('Unread-only filter', (await call(E, 'GET', '/notifications?unreadOnly=true')).body.data.every((n) => n.readAt === null));
    await call(E, 'POST', '/notifications/read-all');
    check('Read all → 0 unread', (await call(E, 'GET', '/notifications/unread-count')).data.count === 0);
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    // remove the test emails written to .mail
    for (const f of fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []) if (!mailBefore.has(f)) fs.rmSync(path.join(mailDir, f));
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company and test emails removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
