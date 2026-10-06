// Check in and out many times a day: sessions, breaks, early check-out notes, the trail of taps, night shifts.
const { prisma: p, suite, call, makeCompany, dropCompany, todayIn, addDays } = require('./lib');

const SLUG = 'att-sessions-e2e';
const t = suite('attendance-sessions');
const { check } = t;
const D = (k) => new Date(`${k}T00:00:00Z`);

(async () => {
  await dropCompany(SLUG);
  try {
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['hr', ['employee', 'hr']],
      ['emp', ['employee']],
      ['night', ['employee']],
      ['day', ['employee']],
    ]);
    const cid = company.id;
    const today = todayIn();
    const yesterday = addDays(today, -1);

    // Taps within a minute of each other count as one accidental double tap, so
    // move today's taps back a few minutes between steps (like real use)
    const age = async (minutes) => {
      const ms = minutes * 60_000;
      const rec0 = await p.attendanceRecord.findFirst({ where: { companyId: cid, employeeId: P.emp.id, date: D(today) } });
      if (!rec0) return;
      const back = (d) => (d ? new Date(d.getTime() - ms) : d);
      await p.attendanceRecord.update({ where: { id: rec0.id }, data: { checkIn: back(rec0.checkIn), checkOut: back(rec0.checkOut), openSince: back(rec0.openSince) } });
      for (const t of await p.attendancePunch.findMany({ where: { recordId: rec0.id } })) await p.attendancePunch.update({ where: { id: t.id }, data: { at: back(t.at) } });
    };

    // ── Several sessions in a day
    let r = await call(S.emp, 'POST', '/attendance/check-in');
    check('First check-in starts session 1', r.status === 201 && r.data?.sessions === 1 && r.data?.openSince, JSON.stringify(r.body));
    check('Cannot check in twice while working', (await call(S.emp, 'POST', '/attendance/check-in')).status === 409);

    r = await call(S.emp, 'POST', '/attendance/check-out', { note: 'Doctor’s appointment' });
    check('Early check-out keeps the reason', r.status === 200 && r.data?.early === true && r.data?.earlyCheckout === true && r.data?.openSince === null, JSON.stringify(r.body));
    check('Cannot check out again', (await call(S.emp, 'POST', '/attendance/check-out')).status === 409);
    check('Note too long → 400', (await call(S.emp, 'POST', '/attendance/check-out', { note: 'x'.repeat(501) })).status === 400);

    await age(5);
    r = await call(S.emp, 'POST', '/attendance/check-in');
    check('Check in again → session 2', r.status === 201 && r.data?.sessions === 2 && r.data?.checkOut === null && r.data?.breakMinutes !== null, JSON.stringify(r.body));
    r = await call(S.emp, 'GET', '/attendance/today');
    check('Today shows working with all taps', r.data?.status === 'WORKING' && r.data?.punches?.length === 3 && r.data.punches.map((x) => x.kind).join() === 'IN,OUT,IN', JSON.stringify(r.data?.punches));
    check('Early reason is on the tap', r.data?.punches?.[1]?.early === true && r.data.punches[1].note === 'Doctor’s appointment');

    await age(5);
    r = await call(S.emp, 'POST', '/attendance/check-out');
    check('Second check-out without a note', r.status === 200 && r.data?.sessions === 2 && r.data?.workingMinutes >= 0 && r.data.punches === undefined, JSON.stringify(r.body));
    const rec = await p.attendanceRecord.findFirst({ where: { companyId: cid, employeeId: P.emp.id, date: D(today) } });
    check('Day keeps first in, last out', rec && rec.checkIn < rec.checkOut && rec.sessions === 2 && rec.openSince === null);
    check('Four taps recorded with source', (await p.attendancePunch.count({ where: { recordId: rec.id, source: 'WEB' } })) === 4);
    const cal = await call(S.emp, 'GET', `/attendance/calendar?month=${today.slice(0, 7)}`);
    const day = cal.data?.days?.find((d) => d.date === today);
    check('Calendar shows sessions', day?.sessions === 2 && day?.earlyCheckout === true, JSON.stringify(day));

    // ── Double taps: check in then straight out again → that check-in is undone
    await age(5);
    r = await call(S.emp, 'POST', '/attendance/check-in');
    check('Check in a third time', r.status === 201 && r.data?.sessions === 3, JSON.stringify(r.body));
    r = await call(S.emp, 'POST', '/attendance/check-out');
    check('Straight out again undoes it (still 2 sessions)', r.status === 200 && r.data?.sessions === 2 && r.data?.openSince === null, JSON.stringify(r.body));
    check('No empty session left behind', (await p.attendancePunch.count({ where: { recordId: rec.id } })) === 4);
    // …and checking out then straight back in carries on the same session
    await age(5);
    await call(S.emp, 'POST', '/attendance/check-in');
    await age(5);
    await call(S.emp, 'POST', '/attendance/check-out');
    r = await call(S.emp, 'POST', '/attendance/check-in');
    check('Back in within a minute continues the session', r.status === 201 && r.data?.sessions === 3 && r.data?.openSince !== null, JSON.stringify(r.body));
    check('The mistaken check-out was removed', (await p.attendancePunch.count({ where: { recordId: rec.id } })) === 5);
    await call(S.emp, 'POST', '/attendance/check-out');

    // ── The day resets at midnight; night shifts can carry on
    const threeHoursAgo = new Date(Date.now() - 3 * 3600_000);
    for (const who of ['night', 'day']) {
      await p.attendanceRecord.create({ data: { companyId: cid, employeeId: P[who].id, date: D(yesterday), checkIn: threeHoursAgo, openSince: threeHoursAgo, sessions: 1, status: 'PRESENT' } });
    }
    const project = await p.project.create({ data: { companyId: cid, code: 'NITE', name: 'Night ops', startDate: D(addDays(today, -30)) } });
    await p.projectMember.create({ data: { companyId: cid, projectId: project.id, employeeId: P.night.id, allocation: 100, nightShift: true, startDate: D(addDays(today, -30)) } });

    check('Day worker: yesterday stays open, today needs a check-in', (await call(S.day, 'POST', '/attendance/check-out')).status === 400);
    r = await call(S.night, 'GET', '/attendance/today');
    check('Night shift shows as carried over', r.data?.nightShift === true && r.data?.carriedOver?.date === yesterday, JSON.stringify(r.data?.carriedOver));
    const ncal = await call(S.night, 'GET', `/attendance/calendar?month=${yesterday.slice(0, 7)}`);
    check('Running night shift shows as checked in, not a missed check-out', ncal.data?.days?.find((d) => d.date === yesterday)?.status === 'WORKING', JSON.stringify(ncal.data?.days?.find((d) => d.date === yesterday)));
    const dcal = await call(S.day, 'GET', `/attendance/calendar?month=${yesterday.slice(0, 7)}`);
    check('Day worker’s open yesterday is a missed check-out', dcal.data?.days?.find((d) => d.date === yesterday)?.status === 'MISSING_CHECKOUT');
    check('Night shift cannot check in until it checks out', (await call(S.night, 'POST', '/attendance/check-in')).status === 409);
    r = await call(S.night, 'POST', '/attendance/check-out');
    check('Night shift check-out closes the day it started', r.status === 200 && r.data?.workingMinutes >= 179, JSON.stringify(r.body));
    const y = await p.attendanceRecord.findFirst({ where: { companyId: cid, employeeId: P.night.id, date: D(yesterday) } });
    check('Yesterday now has the check-out', y?.checkOut && y.openSince === null);
    check('Then a fresh day can start', (await call(S.night, 'POST', '/attendance/check-in')).status === 201);

    // ── HR corrections set the day as one session
    r = await call(S.hr, 'PUT', '/attendance/records', { employeeId: P.day.id, date: yesterday, checkIn: '09:30', checkOut: '13:00', notes: 'Fixed' });
    const fixed = await p.attendanceRecord.findFirst({ where: { companyId: cid, employeeId: P.day.id, date: D(yesterday) } });
    check('HR correction: one closed session, early', r.status === 200 && fixed?.sessions === 1 && fixed.openSince === null && fixed.earlyCheckout === true, JSON.stringify(r.body));
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
