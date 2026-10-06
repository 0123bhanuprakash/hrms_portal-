// Time module round 2: shifts (night), policy rules, corrections insight (no limit, alert over N),
// nudges, team month grid, insights, optional / location holidays + import, leave rules
// (probation, sandwich, negative balance, document, carry expiry), questions, team clashes,
// year-end preview, usage.
const { prisma: p, suite, call, upload, wait, makeCompany, dropCompany, todayIn, addDays } = require('./lib');

const SLUG = 'time-plus-e2e';
const t = suite('time-plus');
const { check } = t;

const eventually = async (fn, tries = 20) => {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true;
    await wait(300);
  }
  return false;
};
const weekday = (key) => new Date(key + 'T00:00:00Z').getUTCDay();
/** Next date on or after `from` with that weekday. */
const nextDow = (from, dow) => {
  let k = from;
  while (weekday(k) !== dow) k = addDays(k, 1);
  return k;
};

(async () => {
  await dropCompany(SLUG);
  try {
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['admin', ['employee', 'company_admin']],
      ['hr', ['employee', 'hr']],
      ['mgr', ['employee', 'manager']],
      ['emp', ['employee'], 'mgr'],
      ['peer', ['employee'], 'mgr'],
      ['out', ['employee']],
    ]);
    const cid = company.id;
    const today = todayIn('Asia/Kolkata');
    const year = Number(today.slice(0, 4));

    // ── Policy: new rules
    let r = await call(S.hr, 'PUT', '/attendance/policy', { correctionAlertAt: 2, lateAlertAt: 3, autoCloseAfterMinutes: 120, optionalHolidayLimit: 1 });
    check('HR saves new attendance rules', r.status === 200 && r.data.correctionAlertAt === 2 && r.data.lateAlertAt === 3 && r.data.autoCloseAfterMinutes === 120 && r.data.optionalHolidayLimit === 1, JSON.stringify(r.body));
    r = await call(S.hr, 'PUT', '/attendance/policy', { lateAlertAt: null });
    check('null switches a rule off', r.status === 200 && r.data.lateAlertAt === null && r.data.autoCloseAfterMinutes === 120);
    check('Bad rule value → 400', (await call(S.hr, 'PUT', '/attendance/policy', { correctionAlertAt: 0 })).status === 400);
    check('Employee cannot change rules → 403', (await call(S.emp, 'PUT', '/attendance/policy', { correctionAlertAt: 5 })).status === 403);

    // ── Shifts
    r = await call(S.hr, 'POST', '/attendance/shifts', { name: 'Night', startTime: '21:00', endTime: '06:00', color: '#7C3AED' });
    check('HR adds a Night shift', r.status === 201 && r.data.name === 'Night', JSON.stringify(r.body));
    const night = r.data;
    check('Duplicate shift name → 409', (await call(S.hr, 'POST', '/attendance/shifts', { name: 'Night', startTime: '22:00', endTime: '07:00' })).status === 409);
    check('“General” is reserved → 400', (await call(S.hr, 'POST', '/attendance/shifts', { name: 'General', startTime: '08:00', endTime: '17:00' })).status === 400);
    check('Employee cannot add shifts → 403', (await call(S.emp, 'POST', '/attendance/shifts', { name: 'Early', startTime: '07:00', endTime: '16:00' })).status === 403);
    const twoAgo = addDays(today, -2);
    r = await call(S.hr, 'PUT', '/attendance/records', { employeeId: P.emp.id, date: twoAgo, checkIn: '21:30', checkOut: '05:30' });
    check('Without a night shift, out before in → 400', r.status === 400);
    r = await call(S.hr, 'PUT', `/attendance/shifts/${night.id}/members`, { employeeIds: [P.emp.id] });
    check('Put emp on the Night shift', r.status === 200 && r.data.memberCount === 1, JSON.stringify(r.body));
    r = await call(S.hr, 'PUT', '/attendance/records', { employeeId: P.emp.id, date: twoAgo, checkIn: '21:30', checkOut: '05:30' });
    check('Night shift: out next morning, 8 h worked', r.status === 200 && r.data.workingMinutes === 480, JSON.stringify(r.body));
    check('Late measured from the Night shift start (21:00 + 15)', r.data?.lateMinutes === 15);
    const cal = await call(S.emp, 'GET', `/attendance/calendar?month=${twoAgo.slice(0, 7)}`);
    check('My calendar shows my shift', cal.data?.shift?.name === 'Night' && cal.data.shift.overnight === true);
    r = await call(S.hr, 'GET', '/attendance/shifts');
    check('Shift list: general + Night with member', r.data?.general?.name === 'General' && r.data.shifts[0]?.employees?.[0]?.id === P.emp.id);
    r = await call(S.mgr, 'GET', `/attendance/team?date=${twoAgo}`);
    check('Team view rows carry the shift', r.data?.data?.find((x) => x.employee.id === P.emp.id)?.shift?.name === 'Night');
    check('Delete shift', (await call(S.hr, 'DELETE', `/attendance/shifts/${night.id}`)).status === 200);
    check('People go back to the general shift', (await p.employee.findUnique({ where: { id: P.emp.id } })).shiftId === null);

    // ── Corrections: no limit, alert over N (2 here)
    const window = Array.from({ length: 26 }, (_, i) => addDays(today, -(i + 1)));
    const month = Object.entries(window.reduce((m, k) => ((m[k.slice(0, 7)] ??= []).push(k), m), {})).find(([, ks]) => ks.length >= 3);
    const days3 = month[1].slice(0, 3);
    for (const [i, d] of days3.entries()) {
      r = await call(S.emp, 'POST', '/attendance/regularisations', { date: d, checkIn: '09:30', checkOut: '18:30', reason: `Forgot to punch ${i}` });
    }
    check('Third correction in a month is allowed (no limit)', r.status === 201, JSON.stringify(r.body));
    check(
      'Over the number → manager told once',
      await eventually(async () => (await p.notification.count({ where: { userId: P.mgr.user.id, type: 'attendance.many_corrections' } })) === 1),
    );
    r = await call(S.mgr, 'GET', '/attendance/regularisations?view=review');
    const row = r.data?.find((x) => x.employee.id === P.emp.id);
    check('Reviewer sees the month count + over flag', row?.monthCount === 3 && row?.overLimit === true, JSON.stringify(row && { monthCount: row.monthCount, overLimit: row.overLimit }));
    check('Reviewer sees the last 30 days', Array.isArray(row?.recent) && row.recent.length === 30);
    r = await call(S.mgr, 'GET', '/attendance/insights');
    // Insights look at this month only
    const thisMonth = days3[0].slice(0, 7) === today.slice(0, 7);
    check('Insights: many corrections this month', r.status === 200 && (thisMonth ? r.data.manyCorrections.some((x) => x.employee.id === P.emp.id && x.count === 3) : Array.isArray(r.data.manyCorrections)), JSON.stringify(r.body).slice(0, 300));
    check('Insights need a team → employee 200 with nobody', (await call(S.emp, 'GET', '/attendance/insights')).data?.manyCorrections?.length === 0);

    // ── Nudges: lead / manager / HR only, for people they look after
    r = await call(S.mgr, 'POST', '/attendance/nudge', { employeeIds: [P.emp.id, P.peer.id], kind: 'check_in' });
    check('Manager nudges the team', r.status === 200 && r.data.sent === 2, JSON.stringify(r.body));
    check('Nudge arrives in-app', await eventually(async () => (await p.notification.count({ where: { userId: P.emp.user.id, type: 'attendance.nudge_check_in' } })) === 1));
    check('Same nudge twice a day is not repeated', (await call(S.mgr, 'POST', '/attendance/nudge', { employeeIds: [P.emp.id], kind: 'check_in' })).data?.sent === 0);
    check('Manager cannot nudge outside the team → 403', (await call(S.mgr, 'POST', '/attendance/nudge', { employeeIds: [P.out.id], kind: 'fix' })).status === 403);
    check('Employee cannot nudge a peer → 403', (await call(S.emp, 'POST', '/attendance/nudge', { employeeIds: [P.peer.id], kind: 'check_in' })).status === 403);
    check('HR nudges anyone', (await call(S.hr, 'POST', '/attendance/nudge', { employeeIds: [P.out.id], kind: 'fix' })).data?.sent === 1);

    // ── Team month grid
    r = await call(S.mgr, 'GET', `/attendance/team-month?month=${today.slice(0, 7)}`);
    const daysInMonth = new Date(Date.UTC(year, Number(today.slice(5, 7)), 0)).getUTCDate();
    check('Month grid: manager sees team × days', r.status === 200 && r.data.data.some((x) => x.employee.id === P.emp.id) && r.data.data[0].days.length === daysInMonth, JSON.stringify(r.body).slice(0, 200));
    check('Month grid: not outside reach', !r.data.data.some((x) => x.employee.id === P.out.id));

    // ── Holidays: import, optional picks (limit 1), locations
    r = await call(S.hr, 'POST', '/holidays/import', { year: 2027 });
    check('Import the 2027 national list', r.status === 201 && r.data.added === 10, JSON.stringify(r.body));
    check('Import again adds nothing', (await call(S.hr, 'POST', '/holidays/import', { year: 2027 })).data?.skipped === 10);
    check('Employee cannot import → 403', (await call(S.emp, 'POST', '/holidays/import', { year: 2028 })).status === 403);
    const optDay = nextDow(addDays(today, 20), 3); // a Wednesday ~3 weeks out
    const optDay2 = addDays(optDay, 7);
    const o1 = (await call(S.hr, 'POST', '/holidays', { name: 'Onam', date: optDay, isOptional: true })).data;
    const o2 = (await call(S.hr, 'POST', '/holidays', { name: 'Eid', date: optDay2, isOptional: true })).data;
    r = await call(S.emp, 'POST', `/holidays/${o1.id}/choose`);
    check('Employee picks an optional holiday', r.status === 200 && r.data.find((h) => h.id === o1.id)?.chosen === true, JSON.stringify(r.body).slice(0, 200));
    check('Over the pick limit → 400', (await call(S.emp, 'POST', `/holidays/${o2.id}/choose`)).status === 400);
    const types = (await call(S.emp, 'GET', '/leave/types')).data;
    const T_ = Object.fromEntries(types.map((x) => [x.code, x]));
    r = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: T_.SL.id, startDate: optDay, endDate: optDay });
    check('A picked holiday is a day off for me', r.data?.errors?.some((e) => /no working days/i.test(e)), JSON.stringify(r.body));
    r = await call(S.peer, 'POST', '/leave/requests/preview', { leaveTypeId: T_.SL.id, startDate: optDay, endDate: optDay });
    check('…but a working day for someone who did not pick it', r.data?.days === 1, JSON.stringify(r.body));
    check('Un-pick', (await call(S.emp, 'DELETE', `/holidays/${o1.id}/choose`)).data?.find((h) => h.id === o1.id)?.chosen === false);
    check('A holiday for everyone cannot be picked → 400', (await call(S.emp, 'POST', `/holidays/${(await call(S.hr, 'GET', '/holidays?year=2027')).data[0].id}/choose`)).status === 400);
    const loc = await p.officeLocation.create({ data: { companyId: cid, name: 'Mumbai Office' } });
    const locDay = addDays(optDay, 1);
    const lh = (await call(S.hr, 'POST', '/holidays', { name: 'Maharashtra Day', date: locDay, locationIds: [loc.id] })).data;
    check('Holiday for one location', lh?.locationIds?.[0] === loc.id);
    check('Not my location → not for me', (await call(S.emp, 'GET', `/holidays?year=${locDay.slice(0, 4)}`)).data.find((h) => h.id === lh.id)?.appliesToMe === false);
    await p.employee.update({ where: { id: P.emp.id }, data: { locationId: loc.id } });
    check('My location → for me', (await call(S.emp, 'GET', `/holidays?year=${locDay.slice(0, 4)}`)).data.find((h) => h.id === lh.id)?.appliesToMe === true);
    r = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: T_.SL.id, startDate: locDay, endDate: locDay });
    check('Location holiday is a day off in leave', r.data?.errors?.some((e) => /no working days/i.test(e)));
    check('Unknown location → 400', (await call(S.hr, 'POST', '/holidays', { name: 'X', date: addDays(locDay, 1), locationIds: [P.emp.id] })).status === 400);

    // ── Leave type rules
    const save = (code, patch) => {
      const { id, ...rest } = T_[code];
      return call(S.hr, 'PATCH', `/leave/types/${id}`, { ...rest, ...patch });
    };
    r = await save('CL', { blockDuringProbation: true, sandwichRule: true, maxConsecutiveDays: null, negativeBalance: 2 });
    check('HR turns on CL rules', r.status === 200 && r.data.blockDuringProbation && r.data.sandwichRule && r.data.negativeBalance === 2, JSON.stringify(r.body));
    check('Carry expiry needs carry forward → 400', (await save('CL', { carryExpiry: '03-31' })).status === 400);
    check('Bad expiry format → 400', (await save('EL', { carryExpiry: '31-03' })).status === 400);
    check('EL carried days expire 31 Mar', (await save('EL', { carryExpiry: '03-31' })).data?.carryExpiry === '03-31');
    await p.employee.update({ where: { id: P.emp.id }, data: { employmentStatus: 'PROBATION' } });
    const fri = nextDow(addDays(today, 14), 5);
    const mon = addDays(fri, 3);
    r = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: T_.CL.id, startDate: fri, endDate: fri });
    check('Not during probation', r.data?.errors?.some((e) => /probation/i.test(e)), JSON.stringify(r.body));
    await p.employee.update({ where: { id: P.emp.id }, data: { employmentStatus: 'ACTIVE' } });
    r = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: T_.CL.id, startDate: fri, endDate: mon });
    check('Sandwich rule: Fri + Mon counts Sat & Sun (4 days)', r.data?.days === 4 && r.data.warnings.some((w) => /weekend/i.test(w)), JSON.stringify(r.body));
    await call(S.hr, 'POST', '/leave/balances/adjust', { employeeId: P.emp.id, leaveTypeId: T_.CL.id, year, days: -10, reason: 'Test: only 2 left' });
    r = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: T_.CL.id, startDate: fri, endDate: mon });
    check('Negative balance: 2 days in advance allowed with a warning', r.data?.errors?.length === 0 && r.data.warnings.some((w) => /advance/i.test(w)), JSON.stringify(r.body));
    r = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: T_.CL.id, startDate: fri, endDate: addDays(mon, 3) });
    check('…but not further', r.data?.errors?.some((e) => /balance/i.test(e)));

    // ── Document after N days, questions, team clashes
    await save('SL', { documentAfterDays: 1 });
    const slStart = nextDow(addDays(today, 30), 2);
    r = await call(S.peer, 'POST', '/leave/requests', { leaveTypeId: T_.CL.id, startDate: slStart, endDate: slStart, reason: 'Family function' });
    check('Peer is off on the same day', r.status === 201, JSON.stringify(r.body));
    r = await call(S.emp, 'POST', '/leave/requests/preview', { leaveTypeId: T_.SL.id, startDate: slStart, endDate: addDays(slStart, 1) });
    check('Preview: document needed over 1 day', r.data?.needsDocument === true);
    r = await call(S.emp, 'POST', '/leave/requests', { leaveTypeId: T_.SL.id, startDate: slStart, endDate: addDays(slStart, 1), reason: 'Fever' });
    check('Request saved; document still missing', r.status === 201 && r.data.needsDocument === true, JSON.stringify(r.body));
    const sl = r.data;
    const pdf = { buf: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'), type: 'application/pdf', name: 'doctor note.pdf' };
    check('Someone else cannot attach → 404', (await upload(S.peer, `/leave/requests/${sl.id}/document`, {}, pdf)).status === 404);
    r = await upload(S.emp, `/leave/requests/${sl.id}/document`, {}, pdf);
    check('Employee attaches the note', r.status === 201 && r.data.document?.name === 'doctor note.pdf' && r.data.needsDocument === false, JSON.stringify(r.body));
    check('Wrong file type → 400', (await upload(S.emp, `/leave/requests/${sl.id}/document`, {}, { buf: Buffer.from('hello'), type: 'text/plain', name: 'x.txt' })).status === 400);
    const doc = await fetch(`${process.env.E2E_API ?? 'http://localhost:4001/api/v1'}/leave/requests/${sl.id}/document`, { headers: { authorization: S.mgr.authorization } });
    check('Approver opens the document', doc.status === 200 && (doc.headers.get('content-type') || '').includes('pdf'));
    const peek = await fetch(`${process.env.E2E_API ?? 'http://localhost:4001/api/v1'}/leave/requests/${sl.id}/document`, { headers: { authorization: S.out.authorization } });
    check('Outsider cannot open it → 404', peek.status === 404);
    r = await call(S.mgr, 'GET', '/leave/requests?view=review');
    const mine = r.data?.find((x) => x.id === sl.id);
    check('Approver sees teammates off in those dates', mine?.team?.overlaps?.some((o) => o.employee.id === P.peer.id) && mine.team.teamSize >= 3, JSON.stringify(mine?.team));
    r = await call(S.mgr, 'POST', `/leave/requests/${sl.id}/question`, { question: 'Can you share the doctor’s name?' });
    check('Approver asks a question', r.status === 200);
    check('Question reaches the employee', await eventually(async () => (await p.notification.count({ where: { userId: P.emp.user.id, type: 'leave.question' } })) === 1));
    check('Request is still pending', (await call(S.emp, 'GET', `/leave/requests/${sl.id}`)).data?.status === 'PENDING');
    check('Peer cannot ask → 404', (await call(S.peer, 'POST', `/leave/requests/${sl.id}/question`, { question: 'Why?' })).status === 404);

    // ── Who's off: own team
    r = await call(S.emp, 'GET', `/leave/calendar?month=${slStart.slice(0, 7)}`);
    check("Who's off: employee sees teammates", r.data?.leaves?.some((l) => l.employee.id === P.peer.id));
    r = await call(S.out, 'GET', `/leave/calendar?month=${slStart.slice(0, 7)}`);
    check("Who's off: someone outside the team doesn't", !r.data?.leaves?.some((l) => l.employee.id === P.peer.id));

    // ── Year-end + usage
    r = await call(S.hr, 'GET', `/leave/types/${T_.EL.id}/year-end?year=${year}`);
    check('Year-end preview', r.status === 200 && typeof r.data.carry === 'number' && typeof r.data.lapse === 'number' && r.data.people >= 6, JSON.stringify(r.body).slice(0, 200));
    check('Employee cannot see year-end → 403', (await call(S.emp, 'GET', `/leave/types/${T_.EL.id}/year-end`)).status === 403);
    r = await call(S.hr, 'POST', `/leave/types/${T_.CL.id}/year-end/remind?year=${year}`);
    check('Remind people who would lose days', r.status === 200 && typeof r.data.sent === 'number');
    r = await call(S.hr, 'GET', `/leave/types/usage?year=${year}`);
    check('Usage per type', r.status === 200 && Array.isArray(r.data) && r.data.some((u) => u.leaveTypeId === T_.CL.id));
    const bal = (await call(S.emp, 'GET', `/leave/balances?year=${year}`)).data?.balances?.find((b) => b.leaveType.code === 'EL');
    check('Balance shows year-end carry / lapse', bal?.yearEnd && typeof bal.yearEnd.lapse === 'number' && 'carryExpired' in bal);
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    await dropCompany(SLUG);
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
