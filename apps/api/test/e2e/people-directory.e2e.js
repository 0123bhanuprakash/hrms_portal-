// People directory: today's status for everyone, celebrations, quick chips,
// filters, highlights strip and the quick-look card.
const { prisma: p, suite, call, makeCompany, dropCompany, todayIn, addDays } = require('./lib');

const SLUG = 'people-dir-e2e';
const t = suite('people-directory');
const { check } = t;
const D = (k) => new Date(`${k}T00:00:00Z`);

(async () => {
  await dropCompany(SLUG);
  try {
    const today = todayIn();
    const weekend = [0, 6].includes(new Date(`${today}T00:00:00Z`).getUTCDay());
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['mgr', ['employee', 'manager']],
      ['ana', ['employee'], 'mgr'],
      ['ben', ['employee'], 'mgr'],
      ['cara', ['employee'], 'mgr'],
      ['dev', ['employee'], 'mgr'],
      ['eva', ['employee']],
      ['finn', ['employee']],
      ['gus', ['employee']],
    ]);
    const cid = company.id;
    const eng = await p.department.create({ data: { companyId: cid, name: 'Engineering', code: 'ENG' } });
    await p.employee.updateMany({ where: { id: { in: [P.mgr.id, P.ana.id, P.ben.id, P.cara.id] } }, data: { departmentId: eng.id } });
    // Ana: checked in now, birthday today
    await p.employee.update({ where: { id: P.ana.id }, data: { dateOfBirth: D(`1995-${today.slice(5)}`) } });
    await p.attendanceRecord.create({ data: { companyId: cid, employeeId: P.ana.id, date: D(today), status: 'PRESENT', checkIn: new Date(Date.now() - 3600_000), openSince: new Date(Date.now() - 3600_000), sessions: 1 } });
    // Ben: checked in and out; 3-year work anniversary today
    await p.employee.update({ where: { id: P.ben.id }, data: { joiningDate: D(`${Number(today.slice(0, 4)) - 3}${today.slice(4)}`) } });
    await p.attendanceRecord.create({ data: { companyId: cid, employeeId: P.ben.id, date: D(today), status: 'PRESENT', checkIn: new Date(Date.now() - 7200_000), checkOut: new Date(Date.now() - 600_000), sessions: 1 } });
    // Cara: work from home (approved WFH leave) · Dev: on leave (never says which)
    const wfh = await p.leaveType.create({ data: { companyId: cid, name: 'Work From Home', code: 'WFH', category: 'WORK_FROM_HOME' } });
    const cl = await p.leaveType.create({ data: { companyId: cid, name: 'Casual', code: 'CL', category: 'CASUAL' } });
    await p.leaveRequest.create({ data: { companyId: cid, employeeId: P.cara.id, leaveTypeId: wfh.id, startDate: D(today), endDate: D(today), totalDays: 1, reason: 'Plumber', status: 'APPROVED' } });
    await p.leaveRequest.create({ data: { companyId: cid, employeeId: P.dev.id, leaveTypeId: cl.id, startDate: D(addDays(today, -1)), endDate: D(addDays(today, 1)), totalDays: 3, reason: 'Private reason', status: 'APPROVED' } });
    // Eva: new joiner (5 days) · Finn: night shift still running from yesterday · Gus: joins next week
    await p.employee.update({ where: { id: P.eva.id }, data: { joiningDate: D(addDays(today, -5)) } });
    await p.attendanceRecord.create({ data: { companyId: cid, employeeId: P.finn.id, date: D(addDays(today, -1)), status: 'PRESENT', checkIn: new Date(Date.now() - 5 * 3600_000), openSince: new Date(Date.now() - 5 * 3600_000), sessions: 1 } });
    await p.employee.update({ where: { id: P.gus.id }, data: { joiningDate: D(addDays(today, 7)) } });
    // Kudos for Ana
    await p.kudos.create({ data: { companyId: cid, fromUserId: P.ben.user.id, message: 'Thanks for the help!', recipients: { create: [{ employeeId: P.ana.id }] } } });

    let r = await call(S.eva, 'GET', '/people?limit=50');
    const by = (name) => r.data?.find((x) => x.firstName === name);
    const notIn = weekend ? 'off' : 'not_in';
    check('Directory lists current people (not next week’s joiner)', r.status === 200 && r.data.length === 7 && !by('gus'), JSON.stringify(r.body).slice(0, 200));
    check('Checked in now', by('ana')?.today.status === 'in' && by('ana').today.since);
    check('Night shift from yesterday counts as in', by('finn')?.today.status === 'in');
    check('Checked out', by('ben')?.today.status === 'out');
    check('Working from home', by('cara')?.today.status === 'wfh');
    check('Away — no leave type or reason anywhere', by('dev')?.today.status === 'away' && !JSON.stringify(r.body).includes('Private reason') && !JSON.stringify(by('dev')).includes('CASUAL'));
    check('Not checked in yet (or off at the weekend)', by('mgr')?.today.status === notIn && by('eva')?.today.status === notIn);
    check('Celebrations: birthday, new joiner, anniversary', by('ana')?.flags.birthdayToday === true && by('eva')?.flags.newJoinerDays === 5 && by('ben')?.flags.anniversaryYears === 3 && by('mgr')?.flags.birthdayToday === false);
    const counts = r.body.meta?.counts;
    check('Quick-chip counts', counts?.in === 2 && counts.wfh === 1 && counts.away === 1 && counts.out === 1 && counts.new === 1 && counts.everyone === 7 && r.body.meta.letters.includes('A'), JSON.stringify(r.body.meta));
    r = await call(S.eva, 'GET', '/people?status=in');
    check('Filter: checked in', r.data?.length === 2 && r.data.every((x) => x.today.status === 'in'));
    r = await call(S.eva, 'GET', '/people?group=new');
    check('Filter: new joiners', r.data?.length === 1 && r.data[0].firstName === 'eva');
    r = await call(S.ana, 'GET', '/people?group=mine');
    const mine = (r.data ?? []).map((x) => x.firstName).sort().join();
    check('Filter: my team (manager, same-manager colleagues)', mine === 'ben,cara,dev,mgr', mine);
    r = await call(S.eva, 'GET', `/people?departmentId=${eng.id}&search=engineering`);
    check('Search matches the team name too', r.data?.length === 4);
    // Teams view: the first N of every team, with each team's real size
    r = await call(S.eva, 'GET', '/people?perTeam=2');
    const tEng = r.body.meta?.teams?.find((t) => t.id === eng.id);
    const tNone = r.body.meta?.teams?.find((t) => t.id === null);
    check('Teams: Engineering has 4, only 2 sent', tEng?.total === 4 && r.data.filter((x) => x.department?.id === eng.id).length === 2, JSON.stringify(r.body.meta?.teams));
    check('Teams: sizes add up; "No team yet" comes last', r.body.meta.teams.reduce((n, t) => n + t.total, 0) === r.body.meta.total && r.body.meta.teams[r.body.meta.teams.length - 1].id === null && tNone?.name === 'No team yet');
    r = await call(S.eva, 'GET', '/people?noTeam=true&limit=50');
    check('View all of "No team yet"', r.data?.length === tNone?.total && r.data.every((x) => !x.department));
    r = await call(S.eva, 'GET', '/people?search=' + encodeURIComponent('ana t'));
    check('Full-name search (first + last)', r.data?.length === 1 && r.data[0].firstName === 'ana', JSON.stringify(r.data?.map((x) => x.firstName)));
    r = await call(S.eva, 'GET', '/people?search=' + encodeURIComponent('  T   ana '));
    check('Words in any order, extra spaces ignored', r.data?.length === 1 && r.data[0].firstName === 'ana');
    r = await call(S.eva, 'GET', '/people?search=' + encodeURIComponent('ana nobody'));
    check('Every word must match', r.data?.length === 0);
    r = await call(S.mgr, 'GET', '/employees?search=' + encodeURIComponent('ben t'));
    check('Employees list: full-name search', r.status === 200 && r.data?.length === 1 && r.data[0].firstName === 'ben', JSON.stringify(r.body).slice(0, 200));
    r = await call(S.eva, 'GET', '/people?sort=joined&limit=2');
    check('Sort by newest', r.data?.[0]?.firstName === 'eva');
    r = await call(S.eva, 'GET', '/people?letter=d');
    check('A–Z: first letter', r.data?.length === 1 && r.data[0].firstName === 'dev' && r.body.meta.letters.includes('A'), JSON.stringify(r.body.meta));
    check('Bad status → 400', (await call(S.eva, 'GET', '/people?status=asleep')).status === 400);

    // Highlights
    r = await call(S.eva, 'GET', '/people/highlights');
    const h = r.data;
    check('Highlights: who’s in today', r.status === 200 && h.counts.in === 2 && h.counts.wfh === 1 && h.counts.away === 1 && h.total === 7, JSON.stringify(h?.counts));
    check('Highlights: new joiners and birthdays', h?.newJoiners.some((x) => x.id === P.eva.id) && h.birthdays.some((x) => x.id === P.ana.id && x.inDays === 0));
    check('Highlights: who’s away (names only)', h?.away.length === 1 && h.away[0].id === P.dev.id && !JSON.stringify(h).includes('Private reason'));

    // Quick look
    r = await call(S.eva, 'GET', `/people/${P.ana.id}/card`);
    const k = r.data;
    check('Card: today and reporting line', r.status === 200 && k.today.status === 'in' && k.reportingManager?.id === P.mgr.id, JSON.stringify(r.body).slice(0, 200));
    check('Card: teammates in the department', k?.teammateCount === 3 && k.teammates.every((x) => x.id !== P.ana.id));
    check('Card: birthday as day + month only', k?.birthday === today.slice(5) && !JSON.stringify(k).includes('1995'));
    check('Card: kudos received', k?.kudos.total === 1 && k.kudos.thisMonth === 1);
    check('Card: this week (Mon–Fri)', k?.thisWeek.length === 5 && (weekend || k.thisWeek.find((d) => d.date === today)?.day === 'in'), JSON.stringify(k?.thisWeek));
    r = await call(S.eva, 'GET', `/people/${P.mgr.id}/card`);
    check('Card: the people someone leads', r.data?.directReportCount === 4 && r.data.subordinates.length === 4);
    check('Unknown person → 404', (await call(S.eva, 'GET', '/people/00000000-0000-4000-8000-000000000000/card')).status === 404);
    r = await call(S.eva, 'GET', `/people/${P.dev.id}/card`);
    check('Card never shows the leave type', r.data?.today.status === 'away' && !JSON.stringify(r.body).includes('CASUAL') && !JSON.stringify(r.body).includes('Private reason'));
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
