// Reports & analytics: people, attendance & leave, utilisation — numbers and role-based scope.
const { prisma: p, suite, call, makeCompany, dropCompany, mailSnapshot, todayIn, addDays, mondayOf, B } = require('./lib');

const SLUG = 'reports-e2e';
const t = suite('reports');
const { check } = t;
const D = (k) => new Date(`${k}T00:00:00Z`);

(async () => {
  await dropCompany(SLUG);
  const restoreMail = mailSnapshot();
  try {
    const today = todayIn();
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['hr', ['employee', 'hr']],
      ['mgr', ['employee', 'manager']],
      ['a', ['employee'], 'mgr'],
      ['b', ['employee'], 'mgr'],
      ['c', ['employee'], 'mgr'],
      ['gone', ['employee'], 'mgr'],
      ['soon', ['employee'], 'mgr'],
      ['pmo', ['employee', 'pmo']],
      ['emp', ['employee']],
    ]);
    const cid = company.id;
    const eng = await p.department.create({ data: { companyId: cid, name: 'Engineering', code: 'ENG' } });
    const hrd = await p.department.create({ data: { companyId: cid, name: 'People', code: 'HR' } });
    await p.employee.updateMany({ where: { id: { in: [P.mgr.id, P.a.id, P.b.id, P.c.id, P.gone.id, P.soon.id] } }, data: { departmentId: eng.id } });
    await p.employee.update({ where: { id: P.hr.id }, data: { departmentId: hrd.id, gender: 'FEMALE' } });
    await p.employee.update({ where: { id: P.c.id }, data: { employmentStatus: 'PROBATION', joiningDate: D(addDays(today, -40)), confirmationDate: D(addDays(today, 50)) } });
    const leftOn = addDays(today, -60);
    await p.employee.update({ where: { id: P.gone.id }, data: { employmentStatus: 'TERMINATED', joiningDate: D('2023-01-10'), terminationDate: D(leftOn) } });
    await p.employee.update({ where: { id: P.soon.id }, data: { joiningDate: D(addDays(today, 10)) } });
    await p.employee.update({ where: { id: P.a.id }, data: { joiningDate: D('2020-06-01') } });

    // ── People
    const hrPeople = await call(S.hr, 'GET', '/reports/people');
    const r = hrPeople.data;
    check('HR: headcount 7 (no leaver, no future joiner)', r?.headcount === 7, JSON.stringify(hrPeople.body).slice(0, 300));
    check('Upcoming joiner counted separately', r?.upcomingJoiners === 1);
    check('By department', r?.byDepartment.find((x) => x.label === 'Engineering')?.count === 4 && r.byDepartment.find((x) => x.label === 'Not set')?.count === 2);
    check('By status (probation)', r?.byStatus.find((x) => x.label === 'PROBATION')?.count === 1);
    check('Tenure buckets add up', r?.tenure.reduce((n, x) => n + x.count, 0) === 7 && r.tenure[3].count === 1);
    check('12-month trend with the leaver', r?.trend.length === 12 && r.trend.reduce((n, x) => n + x.leavers, 0) === 1 && r.trend.find((x) => x.month === leftOn.slice(0, 7))?.leavers === 1);
    check('Attrition % over 12 months', r?.leavers12 === 1 && r.attritionPct > 0);
    check('Probation list', r?.probation.length === 1 && r.probation[0].id === P.c.id);
    const mgrPeople = await call(S.mgr, 'GET', '/reports/people');
    check('Manager: only their tree (self + a, b, c)', mgrPeople.data?.headcount === 4, String(mgrPeople.data?.headcount));
    check('Employee has no reports → 403', (await call(S.emp, 'GET', '/reports/people')).status === 403);
    check('PMO has no people report → 403', (await call(S.pmo, 'GET', '/reports/people')).status === 403);
    const csv = await fetch(`${B}/reports/people/export`, { headers: { authorization: S.hr.authorization } });
    const text = await csv.text();
    check('HR exports the roster CSV', csv.status === 200 && text.split('\r\n').length === 10 && text.includes('Employee ID'));
    check('Manager can’t export (no report.export) → 403', (await fetch(`${B}/reports/people/export`, { headers: { authorization: S.mgr.authorization } })).status === 403);

    // ── Attendance & leave (last month)
    const lm = (() => {
      const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d.toISOString().slice(0, 7);
    })();
    const weekdays = [];
    for (let d = `${lm}-01`; d.startsWith(lm); d = addDays(d, 1)) if (![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) weekdays.push(d);
    const rec = (e, date, status, extra = {}) => ({ companyId: cid, employeeId: e.id, date: D(date), status, ...extra });
    await p.attendanceRecord.createMany({
      data: [
        rec(P.a, weekdays[0], 'PRESENT', { workingMinutes: 540 }),
        rec(P.a, weekdays[1], 'PRESENT', { workingMinutes: 480, lateMinutes: 20 }),
        rec(P.a, weekdays[2], 'WORK_FROM_HOME', { workingMinutes: 480 }),
        rec(P.b, weekdays[0], 'ON_LEAVE'),
        rec(P.hr, weekdays[0], 'PRESENT', { workingMinutes: 500, lateMinutes: 5 }),
      ],
    });
    const cl = await p.leaveType.create({ data: { companyId: cid, name: 'Casual leave', code: 'CL', category: 'CASUAL' } });
    await p.leaveRequest.create({ data: { companyId: cid, employeeId: P.b.id, leaveTypeId: cl.id, startDate: D(weekdays[0]), endDate: D(weekdays[1]), totalDays: 2, reason: 'Family function', status: 'APPROVED' } });
    await p.leaveRequest.create({ data: { companyId: cid, employeeId: P.a.id, leaveTypeId: cl.id, startDate: D(weekdays[3]), endDate: D(weekdays[3]), totalDays: 1, reason: 'Pending one', status: 'PENDING' } });
    const att = await call(S.hr, 'GET', `/reports/attendance?month=${lm}`);
    const A = att.data;
    check('Attendance: working days = weekdays', A?.workingDays === weekdays.length, JSON.stringify(att.body).slice(0, 300));
    check('Late arrivals + average', A?.lateArrivals === 2 && A.avgLateMinutes === 13);
    check('WFH days and average hours', A?.wfhDays === 1 && A.avgWorkingMinutes === 500);
    check('Top late: a first', A?.topLate[0]?.employee.id === P.a.id || A?.topLate[0]?.employee.id === P.hr.id);
    check('Leave by type: approved only (2 days)', A?.leaveByType.length === 1 && A.leaveByType[0].days === 2);
    check('Daily series covers every working day', A?.daily.length === weekdays.length && A.daily[0].present === 2 && A.daily[0].leave === 1);
    check('Attendance rate computed', typeof A?.attendanceRatePct === 'number');
    const attMgr = await call(S.mgr, 'GET', `/reports/attendance?month=${lm}`);
    check('Manager: HR’s late day not in their numbers', attMgr.data?.lateArrivals === 1);
    check('Future month → 400', (await call(S.hr, 'GET', `/reports/attendance?month=${addDays(today, 40).slice(0, 7)}`)).status === 400);

    // ── Utilisation
    const apollo = await p.project.create({ data: { companyId: cid, code: 'APO', name: 'Apollo', clientName: 'Acme', status: 'ACTIVE', startDate: D('2026-01-01') } });
    const zeus = await p.project.create({ data: { companyId: cid, code: 'ZEU', name: 'Zeus', status: 'ACTIVE', startDate: D('2026-01-01') } });
    await p.projectMember.createMany({
      data: [
        { companyId: cid, projectId: apollo.id, employeeId: P.a.id, role: 'MEMBER', allocation: 100, startDate: D('2026-01-01') },
        { companyId: cid, projectId: apollo.id, employeeId: P.b.id, role: 'MEMBER', allocation: 50, startDate: D('2026-01-01') },
        { companyId: cid, projectId: zeus.id, employeeId: P.hr.id, role: 'MEMBER', allocation: 20, startDate: D('2026-01-01') },
      ],
    });
    const wk = addDays(mondayOf(today), -14);
    await p.timesheet.create({
      data: {
        companyId: cid, employeeId: P.a.id, weekStart: D(wk), status: 'APPROVED', totalMinutes: 2400,
        entries: { create: [0, 1, 2, 3, 4].map((i) => ({ companyId: cid, employeeId: P.a.id, date: D(addDays(wk, i)), projectId: apollo.id, task: 'Dev', billable: true, minutes: 480, status: 'APPROVED' })) },
      },
    });
    await p.timesheet.create({
      data: {
        companyId: cid, employeeId: P.b.id, weekStart: D(wk), status: 'DRAFT', totalMinutes: 600,
        entries: { create: [{ companyId: cid, employeeId: P.b.id, date: D(wk), projectId: apollo.id, task: 'Dev', billable: true, minutes: 600 }] },
      },
    });
    const u = await call(S.pmo, 'GET', '/reports/utilisation');
    const U = u.data;
    const row = (e) => U?.rows.find((x) => x.employee.id === e.id);
    check('PMO: whole company (7 on the payroll)', U?.people === 7, JSON.stringify(u.body).slice(0, 300));
    check('Bench / partial / full', U?.full === 1 && U.partial === 2 && U.bench === 4);
    check('Apollo FTE 1.5 with 40h logged (drafts ignored)', U?.projects.find((x) => x.project.id === apollo.id)?.fte === 1.5 && U.projects.find((x) => x.project.id === apollo.id).loggedMinutes === 2400);
    const cap = U?.workingDays * 8 * 60;
    check('Person utilisation from timesheets', row(P.a)?.loggedMinutes === 2400 && row(P.a).utilisationPct === Math.round((2400 / cap) * 100) && row(P.b)?.loggedMinutes === 0);
    check('Bench people listed first', U?.rows[0].allocation === 0);
    check('Utilisation: counts per quick filter', U?.counts?.all === 7 && U.counts.bench === 4 && U.meta?.total === 7 && U.meta.page === 1, JSON.stringify({ counts: U?.counts, meta: U?.meta }));
    let up = await call(S.pmo, 'GET', '/reports/utilisation?limit=2&page=2');
    check('Utilisation: a page of people, totals still for everyone', up.data?.rows.length === 2 && up.data.meta.totalPages === 4 && up.data.people === 7 && up.data.bench === 4, JSON.stringify(up.data?.meta));
    up = await call(S.pmo, 'GET', '/reports/utilisation?show=bench');
    check('Utilisation: only the bench', up.data?.rows.length === 4 && up.data.rows.every((x) => x.allocation === 0) && up.data.people === 7);
    up = await call(S.pmo, 'GET', `/reports/utilisation?search=${P.a.employeeId}`);
    check('Utilisation: search by name or ID', up.data?.rows.some((x) => x.employee.id === P.a.id) && up.data.meta.total < 7, JSON.stringify(up.data?.rows.map((x) => x.employee.firstName)));
    up = await call(S.pmo, 'GET', '/reports/utilisation?sort=name');
    check('Utilisation: sort by name', up.data?.rows.map((x) => x.employee.firstName).join() === [...up.data.rows].map((x) => x.employee.firstName).sort((a, b) => a.localeCompare(b)).join());
    check('Utilisation: weekly grid holds at most 8 weeks', (await call(S.pmo, 'GET', `/reports/utilisation?from=${addDays(today, -120)}&to=${addDays(today, -1)}`)).data?.weeks.length === 8);
    check('Utilisation: unknown filter → 400', (await call(S.pmo, 'GET', '/reports/utilisation?show=everyone')).status === 400);
    const um = await call(S.mgr, 'GET', '/reports/utilisation');
    check('Manager utilisation: only their tree', um.data?.people === 4);
    check('Employee → 403', (await call(S.emp, 'GET', '/reports/utilisation')).status === 403);
    const uc = await fetch(`${B}/reports/utilisation/export`, { headers: { authorization: S.pmo.authorization } });
    const uText = await uc.text();
    check('PMO exports utilisation CSV', uc.status === 200 && uText.split('\r\n').length === 8 && uText.includes('Utilisation %'));
    check('Bad range → 400', (await call(S.pmo, 'GET', `/reports/utilisation?from=${today}&to=${addDays(today, -5)}`)).status === 400);
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    restoreMail();
    await dropCompany(SLUG);
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
