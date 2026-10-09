// asking for more leave, lending / giving days, year-end take-back, ledger: run with test/e2e/run.js (throwaway API on :4001).
const { prisma: p, suite, call, makeCompany, dropCompany, todayIn, addDays } = require('./lib');

const SLUG = 'leave-extra-e2e';
const t = suite('leave-extra');

(async () => {
  await dropCompany(SLUG);
  let ok = false;
  try {
    const { company, roles, people: P, sessions: S } = await makeCompany(SLUG, [
      ['hr', ['employee', 'hr']],
      ['mgr', ['employee', 'manager']],
      ['emp', ['employee'], 'mgr'],
      ['other', ['employee']],
      ['small', ['employee']],
    ]);
    const year = new Date().getUTCFullYear();
    const types = await call(S.hr, 'GET', '/leave/types?all=true');
    const sl = types.data.find((x) => x.code === 'SL');
    const bal = async (who, code = 'SL') => (await call(S[who], 'GET', `/leave/balances?year=${year}`)).data.balances.find((b) => b.leaveType.code === code);

    // Use up most of sick leave: HR deducts 11 of 12
    const ded = await call(S.hr, 'POST', '/leave/balances/adjust', { employeeId: P.emp.id, leaveTypeId: sl.id, year, kind: 'DEDUCTION', days: -11, reason: 'Taken before we moved systems' });
    t.check('Deduction (kind) applies', ded.status === 201 && ded.data.kind === 'DEDUCTION', JSON.stringify(ded.body));
    t.check('A deduction must take days away', (await call(S.hr, 'POST', '/leave/balances/adjust', { employeeId: P.emp.id, leaveTypeId: sl.id, year, kind: 'DEDUCTION', days: 2, reason: 'wrong sign' })).status === 400);
    const self = await call(S.hr, 'POST', '/leave/balances/adjust', { employeeId: P.hr.id, leaveTypeId: sl.id, year, kind: 'EXTRA', days: 2, reason: 'For myself' });
    t.check('HR can’t adjust their own balance', self.status === 403, JSON.stringify(self.body));

    // Not enough → ask HR
    let d0 = addDays(todayIn(), 7);
    while ([0, 6].includes(new Date(d0 + 'T00:00:00Z').getUTCDay())) d0 = addDays(d0, 1);
    let d2 = d0;
    for (let n = 1; n < 3; ) { d2 = addDays(d2, 1); if (![0, 6].includes(new Date(d2 + 'T00:00:00Z').getUTCDay())) n++; }
    if (d2.slice(0, 4) !== d0.slice(0, 4)) throw new Error('test dates cross the year — run again after New Year');
    const pre = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: sl.id, startDate: d0, endDate: d2 });
    t.check('Short of balance → can ask for more', pre.data?.canAskMore === true && pre.data.short === 2 && pre.data.errors[0].includes('Not enough balance'), JSON.stringify(pre.data));
    const ask = await call(S.emp, 'POST', '/leave/extra-requests', { leaveTypeId: sl.id, year, days: 2, startDate: d0, endDate: d2, reason: 'Surgery recovery' });
    t.check('Ask HR for 2 more days', ask.status === 201 && ask.data.status === 'PENDING', JSON.stringify(ask.body));
    t.check('One waiting request per type', (await call(S.emp, 'POST', '/leave/extra-requests', { leaveTypeId: sl.id, year, days: 1, reason: 'again' })).status === 409);
    t.check('Deciders are notified', (await p.notification.count({ where: { userId: P.hr.user.id, type: 'leave.extra_requested' } })) === 1);
    t.check('A plain manager can’t see requests to decide', (await call(S.mgr, 'GET', '/leave/extra-requests?view=decide')).status === 403);
    const list = await call(S.hr, 'GET', '/leave/extra-requests?view=decide');
    t.check('HR sees it waiting', list.data?.some((r) => r.id === ask.data.id));
    t.check('The balance card shows the waiting request', (await bal('emp')).extraRequest?.id === ask.data.id);

    // Lend: hard cap at next year's quota
    const over = await call(S.hr, 'POST', `/leave/extra-requests/${ask.data.id}/decide`, { action: 'lend', days: 13 });
    t.check('Can’t lend more than next year’s quota', over.status === 400 && over.body.detail?.includes('at most 12'), JSON.stringify(over.body));
    t.check('…and the request stays waiting', (await p.extraLeaveRequest.findUnique({ where: { id: ask.data.id } })).status === 'PENDING');
    const lend = await call(S.hr, 'POST', `/leave/extra-requests/${ask.data.id}/decide`, { action: 'lend', days: 2 });
    t.check('HR lends 2 days', lend.status === 200 && lend.data.status === 'LENT' && lend.data.decidedDays === 2, JSON.stringify(lend.body));
    const b1 = await bal('emp');
    t.check('Balance: 1 available, may go 2 below 0', b1.available === 1 && b1.lent === 2 && b1.below === 2, JSON.stringify(b1));
    t.check('Employee is told', (await p.notification.count({ where: { userId: P.emp.user.id, type: 'leave.lent' } })) === 1);
    const pre2 = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: sl.id, startDate: d0, endDate: d2 });
    t.check('Now allowed, with a "taken from next year" warning', !pre2.data.errors.length && pre2.data.warnings.some((w) => w.includes(`taken from your ${year + 1}`)), JSON.stringify(pre2.data));
    const apply = await call(S.emp, 'POST', '/leave/requests', { leaveTypeId: sl.id, startDate: d0, endDate: d2, reason: 'Surgery recovery' });
    t.check('Apply for the 3 days', apply.status === 201, JSON.stringify(apply.body));
    let d3 = addDays(d2, 1);
    while ([0, 6].includes(new Date(d3 + 'T00:00:00Z').getUTCDay())) d3 = addDays(d3, 1);
    const pre3 = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: sl.id, startDate: d3, endDate: d3 });
    t.check('Lent days used up → blocked, ask again', pre3.data?.errors?.some((e) => e.includes('used all 2 days lent')) && pre3.data.canAskMore, JSON.stringify(pre3.data?.errors));

    // Give extra (kept)
    const ask2 = await call(S.emp, 'POST', '/leave/extra-requests', { leaveTypeId: sl.id, year, days: 1, reason: 'Follow-up' });
    const give = await call(S.hr, 'POST', `/leave/extra-requests/${ask2.data.id}/decide`, { action: 'give', days: 1 });
    t.check('HR gives 1 extra day', give.status === 200 && give.data.status === 'GIVEN');
    const b2 = await bal('emp');
    t.check('Balance −1 now (extra counts as a gift)', b2.available === -1 && b2.yearEnd.owe === 1, JSON.stringify(b2));
    const ask3 = await call(S.emp, 'POST', '/leave/extra-requests', { leaveTypeId: sl.id, year, days: 1, reason: 'One more' });
    const dec = await call(S.hr, 'POST', `/leave/extra-requests/${ask3.data.id}/decide`, { action: 'decline', note: 'Please use unpaid leave' });
    t.check('Decline with a reason', dec.status === 200 && dec.data.status === 'DECLINED' && dec.data.decisionNote);
    const cancelAsk = await call(S.emp, 'POST', '/leave/extra-requests', { leaveTypeId: sl.id, year, days: 1, reason: 'Never mind' });
    t.check('Employee takes a request back', (await call(S.emp, 'POST', `/leave/extra-requests/${cancelAsk.data.id}/cancel`)).data?.status === 'CANCELLED');

    // Owed list + ledger
    const owed = await call(S.hr, 'GET', `/leave/owed?year=${year}`);
    const row = owed.data?.rows?.find((r) => r.employee.id === P.emp.id);
    t.check('Owed list shows 1 day to take from next year', row && row.owesAtYearEnd === 1 && row.lent === 2, JSON.stringify(owed.body));
    t.check('A plain manager can’t see the owed list', (await call(S.mgr, 'GET', '/leave/owed')).status === 403);
    const led = await call(S.emp, 'GET', `/leave/ledger?leaveTypeId=${sl.id}&year=${year}`);
    const kinds = led.data?.entries?.map((e) => e.kind) ?? [];
    t.check('Ledger: opening, deduction, lent, extra, leave', ['OPENING', 'DEDUCTION', 'LEND', 'EXTRA', 'LEAVE'].every((k) => kinds.includes(k)), kinds.join());
    t.check('Ledger: running balance ends at −1', led.data.entries[led.data.entries.length - 1].balance === -1, JSON.stringify(led.data.entries.slice(-2)));

    // Waive
    const w = await call(S.hr, 'POST', `/leave/balances/${b2.balanceId}/waive`, { note: 'Medical emergency — goodwill' });
    t.check('Waive what’s owed', w.status === 200 && w.data.waived === 1, JSON.stringify(w.body));
    const b3 = await bal('emp');
    t.check('…balance back to 0, nothing owed at year end', b3.available === 0 && b3.yearEnd.owe === 0, JSON.stringify(b3));

    // Year end: a past year below 0 → taken from this year
    const otherRow = await p.leaveBalance.findFirst({ where: { employeeId: P.other.id, leaveTypeId: sl.id, year } });
    if (otherRow) await p.leaveBalance.delete({ where: { id: otherRow.id } });
    await p.leaveBalance.create({ data: { companyId: company.id, employeeId: P.other.id, leaveTypeId: sl.id, year: year - 1, allocated: 12, usedDays: 14, lendLimit: 2 } });
    const ob = await bal('other');
    t.check('Last year’s −2 is taken from this year (12 → 10)', ob.available === 10, JSON.stringify(ob));
    const closed = await p.leaveBalance.findFirst({ where: { employeeId: P.other.id, leaveTypeId: sl.id, year: year - 1 } });
    t.check('Last year is closed with 2 owed', closed.closedAt && closed.owedOut === 2 && closed.lapsed === 0);
    t.check('Taken-back entry + notification', (await p.leaveBalanceAdjustment.count({ where: { balance: { employeeId: P.other.id, year }, kind: 'TAKEN_BACK', days: -2 } })) === 1 && (await p.notification.count({ where: { userId: P.other.user.id, type: 'leave.taken_back' } })) === 1);
    await bal('other');
    t.check('Taken back only once', (await p.leaveBalanceAdjustment.count({ where: { balance: { employeeId: P.other.id }, kind: 'TAKEN_BACK' } })) === 1);

    // Year end: next year too small → the rest stays owed
    const smallRow = await p.leaveBalance.findFirst({ where: { employeeId: P.small.id, leaveTypeId: sl.id, year } });
    if (smallRow) await p.leaveBalance.delete({ where: { id: smallRow.id } });
    await p.leaveBalance.create({ data: { companyId: company.id, employeeId: P.small.id, leaveTypeId: sl.id, year: year - 1, allocated: 12, usedDays: 22, lendLimit: 10 } });
    await p.leaveBalance.create({ data: { companyId: company.id, employeeId: P.small.id, leaveTypeId: sl.id, year, allocated: 6 } });
    const sb = await bal('small');
    t.check('Only 6 can be taken: balance 0, 4 still owed', sb.available === 0 && sb.owedLeft === 4 && sb.yearEnd.owe === 4, JSON.stringify(sb));

    // Roles decide who can lend: a manager role given leave.extra_decide for direct reports
    const perm = await p.permission.findUniqueOrThrow({ where: { key: 'leave.extra_decide' } });
    await p.rolePermission.create({ data: { roleId: roles.manager, permissionId: perm.id, scope: 'direct_reports' } });
    await p.role.update({ where: { id: roles.manager }, data: { version: { increment: 1 } } });
    const askM = await call(S.emp, 'POST', '/leave/extra-requests', { leaveTypeId: sl.id, year, days: 1, reason: 'Via manager' });
    const askO = await call(S.other, 'POST', '/leave/extra-requests', { leaveTypeId: sl.id, year, days: 1, reason: 'Not his team' });
    const mlist = await call(S.mgr, 'GET', '/leave/extra-requests?view=decide');
    t.check('Manager with the permission sees their report’s request only', mlist.status === 200 && mlist.data.some((r) => r.id === askM.data.id) && !mlist.data.some((r) => r.id === askO.data.id), JSON.stringify(mlist.body).slice(0, 300));
    t.check('…and can lend to them', (await call(S.mgr, 'POST', `/leave/extra-requests/${askM.data.id}/decide`, { action: 'lend', days: 1 })).data?.status === 'LENT');
    t.check('…but not outside their team', (await call(S.mgr, 'POST', `/leave/extra-requests/${askO.data.id}/decide`, { action: 'lend', days: 1 })).status === 404);
    const corr = await call(S.mgr, 'POST', '/leave/balances/adjust', { employeeId: P.emp.id, leaveTypeId: sl.id, year, kind: 'CORRECTION', days: 1, reason: 'Fixing a typo' });
    t.check('Manager can’t make a correction (needs adjust_balance)', corr.status === 403, JSON.stringify(corr.body));

    // Shortcut without a request
    const lg = await call(S.hr, 'POST', '/leave/extra/lend-give', { employeeId: P.other.id, leaveTypeId: sl.id, year, action: 'give', days: 2, reason: 'Covered the release weekend' });
    t.check('Lend / give without a request', lg.status === 200 && lg.data.kind === 'EXTRA' && (await bal('other')).available === 12, JSON.stringify(lg.body));

    ok = t.done();
  } catch (err) {
    console.error(err);
  } finally {
    await dropCompany(SLUG);
    await p.$disconnect();
    process.exit(ok ? 0 : 1);
  }
})();
