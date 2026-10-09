// leave eligibility rules + grants: run with test/e2e/run.js (throwaway API on :4001).
const { prisma: p, suite, call, upload, makeCompany, dropCompany, todayIn, addDays } = require('./lib');

const SLUG = 'leave-grants-e2e';
const t = suite('leave-grants');
const pdf = { buf: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'), type: 'application/pdf', name: 'certificate.pdf' };

(async () => {
  await dropCompany(SLUG);
  let ok = false;
  try {
    const { people: P, sessions: S } = await makeCompany(SLUG, [
      ['hr', ['employee', 'hr']],
      ['mgr', ['employee', 'manager']],
      ['ana', ['employee'], 'mgr'],
      ['ben', ['employee'], 'mgr'],
      ['cat', ['employee']],
    ]);
    await p.employee.update({ where: { id: P.ana.id }, data: { gender: 'FEMALE' } });
    await p.employee.update({ where: { id: P.cat.id }, data: { gender: 'FEMALE' } });
    await p.employee.update({ where: { id: P.ben.id }, data: { gender: 'MALE' } });
    const year = new Date().getUTCFullYear();
    const codes = (r) => (r.data?.balances ?? []).map((b) => b.leaveType.code);

    // Defaults: maternity is only given by grant, with a document; paternity is a men-only rule
    const types = await call(S.hr, 'GET', '/leave/types?all=true');
    const ml = types.data.find((x) => x.code === 'ML');
    const pl = types.data.find((x) => x.code === 'PL');
    t.check('Defaults: maternity is grant-only for women, needs a document', ml.availability === 'GRANT_ONLY' && ml.genders.join() === 'FEMALE' && ml.grantNeedsDocument === true, JSON.stringify(ml));
    t.check('Defaults: paternity is a rule (men)', pl.availability === 'RULES' && pl.genders.join() === 'MALE');
    const pub = await call(S.ana, 'GET', '/leave/types');
    t.check('Employees don’t see the rules or named people', pub.status === 200 && !('members' in pub.data[0]) && !('managerIds' in pub.data[0]));

    // Rules: the manager's team, minus Ben
    const base = { category: 'OTHER', accrual: 'UPFRONT', annualQuota: 2, approvalLevels: 1 };
    const to = await call(S.hr, 'POST', '/leave/types', { ...base, name: 'Team Offsite', code: 'TO', availability: 'RULES', managerIds: [P.mgr.id], members: [{ employeeId: P.ben.id, mode: 'EXCLUDE' }] });
    t.check('Create a rules-based type', to.status === 201, JSON.stringify(to.body));
    const prev = await call(S.hr, 'POST', '/leave/types/eligible-preview', { availability: 'RULES', managerIds: [P.mgr.id], members: [{ employeeId: P.ben.id, mode: 'EXCLUDE' }] });
    t.check('Preview counts the people the rules cover', prev.status === 200 && prev.data.count === 1 && prev.data.people[0].id === P.ana.id, JSON.stringify(prev.data));
    t.check('Manager’s team member sees it', codes(await call(S.ana, 'GET', `/leave/balances?year=${year}`)).includes('TO'));
    t.check('Excluded person doesn’t', !codes(await call(S.ben, 'GET', `/leave/balances?year=${year}`)).includes('TO'));
    t.check('Someone outside the team doesn’t', !codes(await call(S.cat, 'GET', `/leave/balances?year=${year}`)).includes('TO'));
    const tryCat = await call(S.cat, 'POST', '/leave/requests/preview', { leaveTypeId: to.data.id, startDate: addDays(todayIn(), 20), endDate: addDays(todayIn(), 20) });
    t.check('…and can’t apply for it', tryCat.data?.errors?.some((e) => e.includes('isn’t available')), JSON.stringify(tryCat.data?.errors));
    await call(S.hr, 'PATCH', `/leave/types/${to.data.id}`, { ...base, name: 'Team Offsite', code: 'TO', availability: 'RULES', managerIds: [P.mgr.id], members: [{ employeeId: P.ben.id, mode: 'EXCLUDE' }, { employeeId: P.cat.id, mode: 'INCLUDE' }] });
    t.check('Named person added gets it', codes(await call(S.cat, 'GET', `/leave/balances?year=${year}`)).includes('TO'));
    const bad = await call(S.hr, 'POST', '/leave/types', { ...base, name: 'Bad', code: 'BAD', availability: 'RULES', departmentIds: ['00000000-0000-4000-8000-000000000000'] });
    t.check('Rules must use this company’s records', bad.status === 400);

    // Asking HR for maternity
    const anaBal = await call(S.ana, 'GET', `/leave/balances?year=${year}`);
    t.check('No maternity balance before a grant', !codes(anaBal).includes('ML'));
    t.check('…but she can ask HR for it', anaBal.data.askable?.some((a) => a.leaveType.code === 'ML' && !a.request));
    t.check('A man can’t ask for maternity', !(await call(S.ben, 'GET', `/leave/balances?year=${year}`)).data.askable?.some((a) => a.leaveType.code === 'ML'));
    const from = addDays(todayIn(), 30);
    const noDoc = await upload(S.ana, '/leave/grant-requests', { leaveTypeId: ml.id, fromDate: from, toDate: addDays(from, 181), note: 'Due date in a month' });
    t.check('Asking without the document is refused', noDoc.status === 400, JSON.stringify(noDoc.body));
    const ask = await upload(S.ana, '/leave/grant-requests', { leaveTypeId: ml.id, fromDate: from, toDate: addDays(from, 181), note: 'Due date in a month' }, pdf);
    t.check('Ask with a document', ask.status === 201 && ask.data.status === 'PENDING' && ask.data.document, JSON.stringify(ask.body));
    const again = await upload(S.ana, '/leave/grant-requests', { leaveTypeId: ml.id, fromDate: from, toDate: addDays(from, 181), note: 'Again' }, pdf);
    t.check('Only one waiting request per type', again.status === 409);
    const benAsk = await upload(S.ben, '/leave/grant-requests', { leaveTypeId: ml.id, fromDate: from, toDate: addDays(from, 10), note: 'x x x' }, pdf);
    t.check('Ben can’t ask (rules)', benAsk.status === 403);
    const review = await call(S.hr, 'GET', '/leave/grant-requests?view=review');
    t.check('HR sees it waiting', review.data?.some((r) => r.id === ask.data.id));
    t.check('A manager can’t review grant requests', (await call(S.mgr, 'GET', '/leave/grant-requests?view=review')).status === 403);
    const notif = await p.notification.count({ where: { userId: P.hr.user.id, type: 'leave.grant_requested' } });
    t.check('HR is notified', notif === 1);
    const doc = await fetch(`${process.env.E2E_API ?? 'http://localhost:4001/api/v1'}/leave/grant-requests/${ask.data.id}/document`, { headers: { authorization: S.hr.authorization } });
    t.check('HR opens the document', doc.status === 200);

    // HR approves → grant
    const until = addDays(from, 364);
    t.check('Manager can’t approve', (await call(S.mgr, 'POST', `/leave/grant-requests/${ask.data.id}/approve`, { days: 182, validFrom: from, validTo: until })).status === 403);
    const appr = await call(S.hr, 'POST', `/leave/grant-requests/${ask.data.id}/approve`, { days: 182, validFrom: from, validTo: until, note: 'Certificate checked' });
    t.check('HR approves it', appr.status === 200 && appr.data.status === 'APPROVED' && appr.data.grantId, JSON.stringify(appr.body));
    const grants = await call(S.hr, 'GET', `/leave/grants?employeeId=${P.ana.id}`);
    const g = grants.data?.[0];
    t.check('A grant with the request’s document', g && g.days === 182 && g.document && g.left === 182, JSON.stringify(grants.body));
    const withGrant = await call(S.ana, 'GET', `/leave/balances?year=${from.slice(0, 4)}`);
    const mlRow = withGrant.data.balances.find((b) => b.leaveType.code === 'ML');
    t.check('Ana now has 182 days of maternity', mlRow?.available === 182 && mlRow.grants?.length === 1, JSON.stringify(mlRow));
    t.check('Granted person is notified', (await p.notification.count({ where: { userId: P.ana.user.id, type: 'leave.granted' } })) === 1);

    // Applying under the grant
    const outside = await call(S.ana, 'POST', '/leave/requests/preview', { leaveTypeId: ml.id, startDate: addDays(from, -5), endDate: addDays(from, 2) });
    t.check('Dates outside the grant are refused', outside.data?.errors?.some((e) => e.includes('grant covers')), JSON.stringify(outside.data?.errors));
    let start = from;
    let end = addDays(from, 13);
    if (start.slice(0, 4) !== end.slice(0, 4)) { start = `${end.slice(0, 4)}-01-02`; end = addDays(start, 13); }
    const apply = await call(S.ana, 'POST', '/leave/requests', { leaveTypeId: ml.id, startDate: start, endDate: end, reason: 'Maternity leave' });
    t.check('Apply under the grant (14 calendar days)', apply.status === 201 && apply.data.totalDays === 14, JSON.stringify(apply.body));
    const linked = await p.leaveRequest.findUnique({ where: { id: apply.data.id }, select: { leaveGrantId: true } });
    t.check('Leave is linked to the grant', linked.leaveGrantId === g.id);
    const after = (await call(S.hr, 'GET', `/leave/grants?employeeId=${P.ana.id}`)).data[0];
    t.check('Grant shows 168 left', after.taken === 14 && after.left === 168, JSON.stringify(after));
    // Changing a grant
    t.check('Can’t withdraw a grant with leave on it', (await call(S.hr, 'POST', `/leave/grants/${g.id}/revoke`, { note: 'oops' })).status === 409);
    t.check('Can’t shrink below what’s taken', (await call(S.hr, 'PATCH', `/leave/grants/${g.id}`, { days: 10, note: 'shrink' })).status === 400);
    t.check('Shrink to 16 days (14 taken)', (await call(S.hr, 'PATCH', `/leave/grants/${g.id}`, { days: 16, note: 'Only two weeks needed' })).status === 200);
    const tooMany = await call(S.ana, 'POST', '/leave/requests/preview', { leaveTypeId: ml.id, startDate: addDays(end, 1), endDate: addDays(end, 4) });
    t.check('Can’t go past the days left', tooMany.data?.errors?.some((e) => e.includes('left on your grant')), JSON.stringify(tooMany.data?.errors));
    const ext = await call(S.hr, 'PATCH', `/leave/grants/${g.id}`, { days: 182, validTo: addDays(until, 30), note: 'Delivery date moved' });
    t.check('Extend the grant, kept in history', ext.status === 200 && ext.data.validTo === addDays(until, 30) && ext.data.days === 182 && ext.data.history.length === 3, JSON.stringify(ext.body));
    t.check('Balance adjust is refused for grant types', (await call(S.hr, 'POST', '/leave/balances/adjust', { employeeId: P.ana.id, leaveTypeId: ml.id, year, days: 2, reason: 'test' })).status === 400);
    const ye = await call(S.hr, 'GET', `/leave/types/${ml.id}/year-end?year=${year}`);
    t.check('Year-end preview skips grant types (no one “loses” 182)', ye.status === 200 && ye.data.losing.length === 0 && ye.data.lapse === 0);

    // Cancelling gives the days back to the grant
    await call(S.ana, 'POST', `/leave/requests/${apply.data.id}/cancel`, {});
    t.check('Cancelled leave goes back on the grant', (await call(S.hr, 'GET', `/leave/grants?employeeId=${P.ana.id}`)).data[0].left === 182);

    // HR grants directly (several people at once)
    const noFile = await upload(S.hr, '/leave/grants', { employeeIds: JSON.stringify([P.cat.id]), leaveTypeId: ml.id, days: 182, validFrom: from, validTo: until, reason: 'Direct grant' });
    t.check('Direct grant needs the document too', noFile.status === 400);
    const direct = await upload(S.hr, '/leave/grants', { employeeIds: JSON.stringify([P.cat.id]), leaveTypeId: ml.id, days: 182, validFrom: from, validTo: until, reason: 'Direct grant' }, pdf);
    t.check('HR grants directly', direct.status === 201 && direct.data.length === 1, JSON.stringify(direct.body));
    t.check('Overlapping grant for the same person is refused', (await upload(S.hr, '/leave/grants', { employeeIds: JSON.stringify([P.cat.id]), leaveTypeId: ml.id, days: 5, validFrom: from, validTo: from, reason: 'Twice' }, pdf)).status === 409);
    t.check('A manager can’t grant', (await upload(S.mgr, '/leave/grants', { employeeIds: JSON.stringify([P.ana.id]), leaveTypeId: ml.id, days: 5, validFrom: from, validTo: until, reason: 'Nope' }, pdf)).status === 403);
    const rev = await call(S.hr, 'POST', `/leave/grants/${direct.data[0].id}/revoke`, { note: 'Granted by mistake' });
    t.check('Unused grant can be withdrawn', rev.status === 200 && rev.data.status === 'REVOKED');
    t.check('…and Cat no longer has maternity', !codes(await call(S.cat, 'GET', `/leave/balances?year=${from.slice(0, 4)}`)).includes('ML'));
    t.check('Grants only for grant-only types', (await upload(S.hr, '/leave/grants', { employeeIds: JSON.stringify([P.ana.id]), leaveTypeId: to.data.id, days: 2, validFrom: from, validTo: until, reason: 'Wrong type' })).status === 400);

    // Employee takes a request back
    const catAsk = await upload(S.cat, '/leave/grant-requests', { leaveTypeId: ml.id, fromDate: from, toDate: addDays(from, 100), note: 'Due soon' }, pdf);
    const take = await call(S.cat, 'POST', `/leave/grant-requests/${catAsk.data.id}/cancel`);
    t.check('Employee takes a request back', take.status === 200 && take.data.status === 'CANCELLED');
    const rej = await upload(S.cat, '/leave/grant-requests', { leaveTypeId: ml.id, fromDate: from, toDate: addDays(from, 100), note: 'Due soon' }, pdf);
    const decline = await call(S.hr, 'POST', `/leave/grant-requests/${rej.data.id}/reject`, { note: 'Please send the hospital letter' });
    t.check('HR declines with a reason', decline.status === 200 && decline.data.status === 'REJECTED' && decline.data.decisionNote);

    ok = t.done();
  } catch (err) {
    console.error(err);
  } finally {
    await dropCompany(SLUG);
    await p.$disconnect();
    process.exit(ok ? 0 : 1);
  }
})();
