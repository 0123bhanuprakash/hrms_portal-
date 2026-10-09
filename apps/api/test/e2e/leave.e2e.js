// leave: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Leave-E2E-2026!';
const SLUG = 'leave-e2e';
const TZ = 'Asia/Kolkata';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const r = await fetch(B + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
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
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const addDays = (key, n) => { const d = new Date(key + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const wd = (key) => new Date(key + 'T00:00:00Z').getUTCDay();
/** n-th Monday on or after (today + offset) */
const monday = (offsetDays) => { let k = addDays(today, offsetDays); while (wd(k) !== 1) k = addDays(k, 1); return k; };

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.leaveRequest.deleteMany({ where: { companyId: c.id } });
  await p.leaveBalance.deleteMany({ where: { companyId: c.id } });
  await p.leaveType.deleteMany({ where: { companyId: c.id } });
  await p.attendanceRecord.deleteMany({ where: { companyId: c.id } });
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
    const P = {};
    const mk = async (name, keys, manager) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), reportingManagerId: manager ? P[manager].id : null } });
      P[name] = { ...e, user: u };
    };
    await mk('top', ['employee', 'manager']);
    await mk('boss', ['employee', 'manager'], 'top');
    await mk('emp', ['employee'], 'boss');
    await mk('peer', ['employee'], 'boss');
    await mk('cover', ['employee']);
    await mk('hr', ['employee', 'hr']);
    // closure: every ancestor chain
    for (const n of Object.keys(P)) {
      let depth = 0, cur = P[n];
      while (cur) {
        await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: cur.id, descendantId: P[n].id, depth } });
        cur = cur.reportingManagerId ? Object.values(P).find((x) => x.id === cur.reportingManagerId) : null;
        depth++;
      }
    }

    const E = await login(P.emp.email), PE = await login(P.peer.email), BO = await login(P.boss.email), T = await login(P.top.email), C = await login(P.cover.email), H = await login(P.hr.email);
    const year = Number(today.slice(0, 4));

    // ── Types + balances
    const types = await call(E, 'GET', '/leave/types');
    check('Default leave types created', types.status === 200 && types.data.length === 7, JSON.stringify(types.body).slice(0, 200));
    const T_ = Object.fromEntries(types.data.map((t) => [t.code, t]));
    check('Employee cannot create types → 403', (await call(E, 'POST', '/leave/types', { name: 'X', code: 'X', category: 'OTHER', accrual: 'UPFRONT', annualQuota: 1, approvalLevels: 1 })).status === 403);
    const cl2 = await call(H, 'PATCH', `/leave/types/${T_.CL.id}`, { ...T_.CL, approvalLevels: 2, maxConsecutiveDays: 3, id: undefined, isActive: true });
    check('HR sets Casual Leave to 2 approval levels', cl2.status === 200 && cl2.data.approvalLevels === 2, JSON.stringify(cl2.body));
    const lop0 = await call(H, 'PATCH', `/leave/types/${T_.LOP.id}`, { ...T_.LOP, approvalLevels: 0, id: undefined });
    check('HR makes Unpaid leave auto-approved', lop0.data?.approvalLevels === 0, JSON.stringify(lop0.body));

    const bal = await call(E, 'GET', `/leave/balances?year=${year}`);
    const b = (code) => bal.data.balances.find((x) => x.leaveType.code === code);
    check('Balances: gender-specific types hidden (no gender set)', bal.status === 200 && !b('ML') && !b('PL'), bal.data?.balances?.map((x) => x.leaveType.code).join());
    check('CL 12 available, WFH unlimited', b('CL')?.available === 12 && b('WFH')?.available === null);
    const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'numeric' }).format(new Date()));
    check('Earned leave accrues monthly', b('EL')?.allocated === 18 && b('EL')?.accrued === Math.round((18 * month / 12) * 2) / 2, `${b('EL')?.accrued}`);

    // ── Preview + validation
    const m1 = monday(8);
    const prev = await call(E, 'POST', '/leave/requests/preview', { leaveTypeId: T_.CL.id, startDate: m1, endDate: addDays(m1, 1) });
    check('Preview: 2 days, 12 → 10', prev.status === 200 && prev.data.days === 2 && prev.data.after === 10 && !prev.data.errors.length, JSON.stringify(prev.data));
    const prevWeekend = await call(E, 'POST', '/leave/requests/preview', { leaveTypeId: T_.CL.id, startDate: addDays(m1, -2), endDate: addDays(m1, -1) });
    check('Preview: weekend only → no working days', prevWeekend.data.errors.some((e) => e.includes('no working days')));
    const prevLong = await call(E, 'POST', '/leave/requests/preview', { leaveTypeId: T_.CL.id, startDate: m1, endDate: addDays(m1, 3) });
    check('Preview: CL over 3 days → error', prevLong.data.errors.some((e) => e.includes('at most 3')));
    const prevNotice = await call(E, 'POST', '/leave/requests/preview', { leaveTypeId: T_.EL.id, startDate: addDays(today, 2), endDate: addDays(today, 2) });
    check('Preview: EL needs 7 days notice', prevNotice.data.errors.some((e) => e.includes('notice')));
    check('Half day across 2 dates → 400', (await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.CL.id, startDate: m1, endDate: addDays(m1, 1), halfDay: 'FIRST_HALF', reason: 'x y z' })).status === 400);
    check('Cross-year → 400', (await call(E, 'POST', '/leave/requests/preview', { leaveTypeId: T_.SL.id, startDate: `${year}-12-31`, endDate: `${year + 1}-01-01` })).data.errors.some((e) => e.includes('two calendar years')));

    // ── Two-level approval up the chain
    const req = await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.CL.id, startDate: m1, endDate: addDays(m1, 1), reason: 'Family function' });
    check('Apply CL (2 levels: boss → top)', req.status === 201 && req.data.status === 'PENDING' && req.data.requiredLevels === 2, JSON.stringify(req.body));
    check('Overlapping request → 400', (await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.SL.id, startDate: m1, endDate: m1, reason: 'again' })).status === 400);
    check('Pending days held', (await call(E, 'GET', `/leave/balances?year=${year}`)).data.balances.find((x) => x.leaveType.code === 'CL').pending === 2);
    check('Peer cannot approve → 403', (await call(PE, 'POST', `/leave/requests/${req.data.id}/approve`, {})).status === 403);
    check('Level 2 (top) cannot jump the queue → 403', (await call(T, 'POST', `/leave/requests/${req.data.id}/approve`, {})).status === 403);
    check('Boss sees it waiting', (await call(BO, 'GET', '/leave/requests?view=review')).data?.some((r) => r.id === req.data.id && r.canDecide));
    const rv = (q) => call(BO, 'GET', `/leave/requests?view=review&${q}`);
    check('Approvals search by name finds it', (await rv('search=emp')).data?.some((r) => r.id === req.data.id));
    check('…and by employee id', (await rv('search=EMP')).data?.some((r) => r.id === req.data.id));
    check('No match → empty list', (await rv('search=nobody-like-this')).body.meta?.total === 0);
    check('Leave type filter', (await rv(`leaveTypeId=${T_.SL.id}`)).body.meta?.total === 0 && (await rv(`leaveTypeId=${T_.CL.id}`)).data?.some((r) => r.id === req.data.id));
    const facets = (await rv(`leaveTypeId=${T_.SL.id}`)).body.meta?.facets;
    check('Facets list the types in the queue (ignoring the type filter)', facets?.leaveTypes.some((t) => t.id === T_.CL.id && t.count >= 1), JSON.stringify(facets));
    check('Date filter: outside the request → none', (await rv(`from=${addDays(m1, 10)}&to=${addDays(m1, 12)}`)).body.meta?.total === 0);
    check('Sort newest works', (await rv('sort=newest')).status === 200);
    const allRes = await call(H, 'GET', '/leave/requests?view=all&search=emp');
    check('HR "all": search keeps only matching people, with facets', allRes.data?.length > 0 && allRes.data.every((r) => r.employee.firstName === 'emp') && Array.isArray(allRes.body.meta?.facets?.leaveTypes), JSON.stringify(allRes.body).slice(0, 300));
    // ── Questions and replies (asking doesn't block approving)
    const notes = async (who, type) => { for (let i = 0; i < 20; i++) { const n = await p.notification.count({ where: { userId: P[who].user.id, type } }); if (n) return n; await new Promise((r) => setTimeout(r, 150)); } return 0; };
    check('Employee can’t reply before any question → 400', (await call(E, 'POST', `/leave/requests/${req.data.id}/reply`, { body: 'Hello' })).status === 400);
    check('A peer can’t ask → 404', (await call(PE, 'POST', `/leave/requests/${req.data.id}/question`, { question: 'Why these days?' })).status === 404);
    const asked = await call(BO, 'POST', `/leave/requests/${req.data.id}/question`, { question: 'Can you hand over the release first?' });
    check('Boss asks — saved, still pending, shows as open', asked.status === 200 && asked.data?.status === 'PENDING' && asked.data.questionOpen && asked.data.comments.length === 1 && asked.data.comments[0].kind === 'QUESTION' && asked.data.comments[0].mine, JSON.stringify(asked.body).slice(0, 300));
    check('Employee is told, with a link to the request', (await notes('emp', 'leave.question')) === 1 && (await p.notification.findFirst({ where: { userId: P.emp.user.id, type: 'leave.question' } })).link === `/app/leave?request=${req.data.id}`);
    const mineNow = (await call(E, 'GET', '/leave/requests?view=mine')).data?.find((r) => r.id === req.data.id);
    check('Employee sees the question and can reply', mineNow?.canReply && mineNow.questionOpen && mineNow.comments[0].author?.firstName === 'boss', JSON.stringify(mineNow?.comments));
    check('Someone else can’t reply → 404', (await call(PE, 'POST', `/leave/requests/${req.data.id}/reply`, { body: 'Yes' })).status === 404);
    const replied = await call(E, 'POST', `/leave/requests/${req.data.id}/reply`, { body: 'Yes, handover is on Friday.' });
    check('Employee replies — question closed', replied.status === 200 && replied.data?.questionOpen === false && replied.data.comments.length === 2 && replied.data.comments[1].kind === 'REPLY' && replied.data.comments[1].mine, JSON.stringify(replied.body).slice(0, 300));
    check('Boss is told about the answer', (await notes('boss', 'leave.reply')) === 1);
    check('Boss sees the answer on the approvals card', (await call(BO, 'GET', '/leave/requests?view=review')).data?.find((r) => r.id === req.data.id)?.comments.length === 2);
    check('Boss pending count = 1', (await call(BO, 'GET', '/leave/requests/pending-count')).data?.count === 1);
    const a1 = await call(BO, 'POST', `/leave/requests/${req.data.id}/approve`, { note: 'ok from me' });
    check('Boss approves level 1 → moves to level 2', a1.status === 200 && a1.data.status === 'PENDING' && a1.data.currentLevel === 2, JSON.stringify(a1.body));
    check('Top now sees it waiting', (await call(T, 'GET', '/leave/requests?view=review')).data?.some((r) => r.id === req.data.id));
    const a2 = await call(T, 'POST', `/leave/requests/${req.data.id}/approve`, {});
    check('Top approves level 2 → APPROVED', a2.status === 200 && a2.data.status === 'APPROVED' && a2.data.approvals.every((x) => x.status === 'APPROVED'), JSON.stringify(a2.body));
    const clAfter = (await call(E, 'GET', `/leave/balances?year=${year}`)).data.balances.find((x) => x.leaveType.code === 'CL');
    check('Balance: used 2, pending 0, available 10', clAfter.used === 2 && clAfter.pending === 0 && clAfter.available === 10, JSON.stringify(clAfter));

    // ── Attendance shows it
    const cal = await call(E, 'GET', `/attendance/calendar?month=${m1.slice(0, 7)}`);
    check('Attendance calendar: ON_LEAVE with leave info', cal.data?.days.find((d) => d.date === m1)?.status === 'ON_LEAVE' && cal.data.days.find((d) => d.date === m1).leave?.code === 'CL');
    check('Team view on that day: ON_LEAVE', (await call(BO, 'GET', `/attendance/team?date=${m1}`)).data?.data.find((r) => r.employee.id === P.emp.id)?.status === 'ON_LEAVE');
    // ── WFH via delegate
    const del = await call(BO, 'POST', '/delegations', { delegateId: P.cover.user.id, endsAt: new Date(Date.now() + 5 * 86400000).toISOString(), reason: 'Away' });
    check('Boss delegates approvals', del.status === 201, JSON.stringify(del.body));
    const C2 = await login(P.cover.email);
    const m2 = addDays(m1, 7);
    const wfh = await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.WFH.id, startDate: m2, endDate: m2, reason: 'Plumber visit' });
    const dw = await call(C2, 'POST', `/leave/requests/${wfh.data.id}/approve`, {});
    check('Delegate approves WFH on behalf of boss', dw.status === 200 && dw.data.status === 'APPROVED' && dw.data.approvals[0].onBehalfOf?.id === P.boss.user.id && dw.data.decideAs === null, JSON.stringify(dw.body));
    const cal2 = await call(E, 'GET', `/attendance/calendar?month=${m2.slice(0, 7)}`);
    check('Attendance calendar: WORK_FROM_HOME', cal2.data?.days.find((d) => d.date === m2)?.status === 'WORK_FROM_HOME');

    // ── HR override settles remaining levels
    const m3 = addDays(m1, 14);
    const cl3 = await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.CL.id, startDate: m3, endDate: m3, halfDay: 'SECOND_HALF', reason: 'Bank work' });
    check('Half-day CL = 0.5', cl3.data?.totalDays === 0.5, JSON.stringify(cl3.body));
    const ho = await call(H, 'POST', `/leave/requests/${cl3.data.id}/approve`, { note: 'HR' });
    check('HR override approves both levels at once', ho.status === 200 && ho.data.status === 'APPROVED' && ho.data.approvals[1].status === 'SKIPPED', JSON.stringify(ho.body));

    // ── Reject + cancel
    const m4 = addDays(m1, 21);
    const sl = await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.SL.id, startDate: m4, endDate: m4, reason: 'Dentist' });
    const rj = await call(BO, 'POST', `/leave/requests/${sl.data.id}/reject`, { note: 'Busy week' });
    check('Boss rejects; pending released', rj.data?.status === 'REJECTED' && (await call(E, 'GET', `/leave/balances?year=${year}`)).data.balances.find((x) => x.leaveType.code === 'SL').pending === 0);
    check('Peer cannot cancel someone else → 404', (await call(PE, 'POST', `/leave/requests/${req.data.id}/cancel`, {})).status === 404);
    const cn = await call(E, 'POST', `/leave/requests/${req.data.id}/cancel`, { reason: 'Plans changed' });
    check('Employee cancels approved future leave; days back', cn.data?.status === 'CANCELLED' && (await call(E, 'GET', `/leave/balances?year=${year}`)).data.balances.find((x) => x.leaveType.code === 'CL').available === 11.5, JSON.stringify(cn.body));

    // ── Started leave: the person asks to cancel (or end early), whoever approved it decides
    const clBal = async () => (await call(E, 'GET', `/leave/balances?year=${year}`)).data.balances.find((x) => x.leaveType.code === 'CL');
    const m5 = addDays(m1, 28);
    const lv = await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.CL.id, startDate: m5, endDate: addDays(m5, 2), reason: 'Trip' });
    await call(BO, 'POST', `/leave/requests/${lv.data.id}/approve`, {});
    await call(T, 'POST', `/leave/requests/${lv.data.id}/approve`, {});
    // Pretend it started yesterday (dates moved in the DB; the 3 days stay booked)
    await p.leaveRequest.update({ where: { id: lv.data.id }, data: { startDate: new Date(addDays(today, -1)), endDate: new Date(addDays(today, 3)) } });
    const usedBefore = (await clBal()).used;
    const started = (await call(E, 'GET', '/leave/requests?view=mine')).data?.find((r) => r.id === lv.data.id);
    check('Started approved leave: no direct cancel, can request one', started?.canCancel === false && started.canRequestCancel === true, JSON.stringify(started && { c: started.canCancel, r: started.canRequestCancel }));
    check('Direct cancel of started leave → 400', (await call(E, 'POST', `/leave/requests/${lv.data.id}/cancel`, { reason: 'x' })).status === 400);
    check('Early: last day must be before the end → 400', (await call(E, 'POST', `/leave/requests/${lv.data.id}/cancel-request`, { mode: 'early', lastDay: addDays(today, 3), reason: 'Back early' })).status === 400);
    const cr = await call(E, 'POST', `/leave/requests/${lv.data.id}/cancel-request`, { mode: 'early', lastDay: today, reason: 'Back early' });
    check('Employee asks to end it early', cr.status === 200 && cr.data?.cancelRequest?.lastDay === today && cr.data.canRequestCancel === false && cr.data.status === 'APPROVED', JSON.stringify(cr.body).slice(0, 300));
    check('Asking twice → 409', (await call(E, 'POST', `/leave/requests/${lv.data.id}/cancel-request`, { mode: 'all', reason: 'again' })).status === 409);
    check('Approvers are told', (await notes('boss', 'leave.cancel_request')) >= 1 && (await notes('top', 'leave.cancel_request')) >= 1);
    check('It waits in the approver’s queue', (await call(BO, 'GET', '/leave/requests?view=review')).data?.find((r) => r.id === lv.data.id)?.canDecideCancel === true);
    check('A peer can’t decide it → 403', (await call(PE, 'POST', `/leave/requests/${lv.data.id}/cancel-request/approve`, {})).status === 403);
    const ok = await call(BO, 'POST', `/leave/requests/${lv.data.id}/cancel-request/approve`, {});
    const back = 3 - ok.data?.totalDays;
    check('Boss agrees: leave ends today, unused days back', ok.status === 200 && ok.data.status === 'APPROVED' && ok.data.endDate === today && ok.data.cancelRequest === null && (await clBal()).used === usedBefore - back, JSON.stringify(ok.body).slice(0, 300));
    check('Employee is told', (await notes('emp', 'leave.cancelled')) >= 1);
    // Whole cancellation: declined once, then HR agrees
    await call(E, 'POST', `/leave/requests/${lv.data.id}/cancel-request`, { mode: 'all', reason: 'Did not travel at all' });
    const no = await call(T, 'POST', `/leave/requests/${lv.data.id}/cancel-request/reject`, { note: 'You were away' });
    check('Declined: stays approved, request cleared', no.data?.status === 'APPROVED' && no.data.cancelRequest === null && (await notes('emp', 'leave.cancel_declined')) >= 1, JSON.stringify(no.body).slice(0, 200));
    await call(E, 'POST', `/leave/requests/${lv.data.id}/cancel-request`, { mode: 'all', reason: 'Did not travel at all' });
    check('Employee can take the request back', (await call(E, 'POST', `/leave/requests/${lv.data.id}/cancel-request/withdraw`, {})).data?.cancelRequest === null);
    await call(E, 'POST', `/leave/requests/${lv.data.id}/cancel-request`, { mode: 'all', reason: 'Did not travel at all' });
    const usedMid = (await clBal()).used;
    const hrOk = await call(H, 'POST', `/leave/requests/${lv.data.id}/cancel-request/approve`, {});
    check('HR agrees to cancel all of it; every day back', hrOk.data?.status === 'CANCELLED' && (await clBal()).used === usedMid - hrOk.data.totalDays, JSON.stringify(hrOk.body).slice(0, 200));

    // ── Self-approval + top of the chain
    const bl = await call(BO, 'POST', '/leave/requests', { leaveTypeId: T_.SL.id, startDate: m4, endDate: m4, reason: 'Unwell' });
    check('Boss cannot approve own leave → 404', (await call(BO, 'POST', `/leave/requests/${bl.data.id}/approve`, {})).status === 404);
    check('Top approves boss (his manager)', (await call(T, 'POST', `/leave/requests/${bl.data.id}/approve`, {})).data?.status === 'APPROVED');
    const tl = await call(T, 'POST', '/leave/requests', { leaveTypeId: T_.SL.id, startDate: m4, endDate: m4, reason: 'Unwell' });
    check('Top of chain → waits for HR', tl.data?.approvals?.[0]?.approver === null && (await call(H, 'GET', '/leave/requests?view=review')).data.some((r) => r.id === tl.data.id), JSON.stringify(tl.body).slice(0, 300));
    check('Boss cannot approve his manager → 403/404', [403, 404].includes((await call(BO, 'POST', `/leave/requests/${tl.data.id}/approve`, {})).status));

    // ── Auto-approve + balance adjustments
    const lop = await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.LOP.id, startDate: addDays(m4, 1), endDate: addDays(m4, 1), reason: 'Personal' });
    check('Auto-approved unpaid leave', lop.data?.status === 'APPROVED' && lop.data.approvals.length === 0, JSON.stringify(lop.body));
    check('Employee cannot adjust → 403', (await call(E, 'POST', '/leave/balances/adjust', { employeeId: P.emp.id, leaveTypeId: T_.CL.id, year, days: 5, reason: 'gift' })).status === 403);
    const adj = await call(H, 'POST', '/leave/balances/adjust', { employeeId: P.emp.id, leaveTypeId: T_.CL.id, year, days: -11, reason: 'Encashed' });
    check('HR adjusts CL by −11', adj.status === 201 && adj.data.adjusted === -11, JSON.stringify(adj.body));
    const noBal = await call(E, 'POST', '/leave/requests', { leaveTypeId: T_.CL.id, startDate: addDays(m4, 7), endDate: addDays(m4, 7), reason: 'Trip' });
    check('Not enough balance → 400', noBal.status === 400 && /balance/i.test(noBal.body.detail || ''), JSON.stringify(noBal.body));
    const balRow = (await call(H, 'GET', `/leave/balances?year=${year}&employeeId=${P.emp.id}`)).data.balances.find((x) => x.leaveType.code === 'CL');
    check('Adjustment history', (await call(H, 'GET', `/leave/balances/${balRow.balanceId}/history`)).data?.[0]?.reason === 'Encashed');
    check('Peer cannot see emp balances → 404', (await call(PE, 'GET', `/leave/balances?employeeId=${P.emp.id}`)).status === 404);

    // ── Who's off
    const off = await call(H, 'GET', `/leave/calendar?month=${m4.slice(0, 7)}`);
    check("Who's off: HR sees leave in the month", off.status === 200 && off.data.leaves.length >= 2, JSON.stringify(off.data?.leaves?.length));
    // Employees see their own team (same manager, their manager, their reports) — not everyone
    const team = new Set([P.emp.id, P.peer.id, P.boss.id]);
    check("Who's off: employee sees own team only", (await call(E, 'GET', `/leave/calendar?month=${m4.slice(0, 7)}`)).data.leaves.every((l) => team.has(l.employee.id)));
    const types2 = await call(H, 'GET', '/leave/types?all=true');
    check('HR lists all types incl. inactive', types2.data?.length === 7);
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
