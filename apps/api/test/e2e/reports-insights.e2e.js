// Reports — overview vs before, what changed, filters, "who is behind this number",
// attendance day + weekday lates + leave balances, utilisation by week, emailed schedules.
const fs = require('fs');
const path = require('path');
const { prisma: p, suite, call, makeCompany, dropCompany, mailSnapshot, todayIn, addDays } = require('./lib');

const SLUG = 'reports-insights-e2e';
const t = suite('reports-insights');
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
      ['n', ['employee'], 'mgr'],
      ['gone', ['employee'], 'mgr'],
      ['gone2', ['employee'], 'mgr'],
      ['emp', ['employee']],
    ]);
    const cid = company.id;
    const eng = await p.department.create({ data: { companyId: cid, name: 'Engineering', code: 'ENG' } });
    const ppl = await p.department.create({ data: { companyId: cid, name: 'People', code: 'HR' } });
    const blr = await p.officeLocation.create({ data: { companyId: cid, name: 'Bengaluru', code: 'BLR' } }).catch(() => null);
    await p.employee.updateMany({ where: { id: { in: [P.mgr.id, P.a.id, P.b.id, P.c.id, P.n.id, P.gone.id, P.gone2.id] } }, data: { departmentId: eng.id } });
    await p.employee.update({ where: { id: P.hr.id }, data: { departmentId: ppl.id, ...(blr && { locationId: blr.id }) } });
    await p.employee.update({ where: { id: P.a.id }, data: { joiningDate: D('2019-03-01') } });
    // Work anniversary in 10 days (2 years)
    const anniv = addDays(today, 10);
    await p.employee.update({ where: { id: P.b.id }, data: { joiningDate: D(`${Number(anniv.slice(0, 4)) - 2}${anniv.slice(4)}`) } });
    await p.employee.update({ where: { id: P.c.id }, data: { employmentStatus: 'PROBATION', joiningDate: D(addDays(today, -80)), confirmationDate: D(addDays(today, 20)) } });
    await p.employee.update({ where: { id: P.n.id }, data: { joiningDate: D(addDays(today, -5)) } });
    await p.employee.update({ where: { id: P.gone.id }, data: { employmentStatus: 'TERMINATED', joiningDate: D('2022-01-10'), terminationDate: D(addDays(today, -30)) } });
    await p.employee.update({ where: { id: P.gone2.id }, data: { employmentStatus: 'TERMINATED', joiningDate: D('2022-01-10'), terminationDate: D(addDays(today, -50)) } });

    // ── Filters + people extras
    let r = await call(S.hr, 'GET', `/reports/people?departmentId=${eng.id}`);
    check('Filter people by department', r.status === 200 && r.data.headcount === 5, JSON.stringify(r.data?.headcount));
    r = await call(S.hr, 'GET', '/reports/people');
    const R = r.data;
    check('Breakdowns carry keys for "see who"', R?.byDepartment.find((x) => x.label === 'Engineering')?.key === eng.id && R.tenure.every((x) => x.key));
    const engLeavers = R?.leaversByDepartment.find((x) => x.key === eng.id);
    check('Leavers by department (12 months)', engLeavers?.leavers === 2 && engLeavers.months.length === 12 && engLeavers.ratePct > 0, JSON.stringify(engLeavers));
    check('Anniversaries coming up', R?.anniversaries.some((x) => x.id === P.b.id && x.years === 2 && x.date === anniv), JSON.stringify(R?.anniversaries));
    r = await call(S.hr, 'GET', `/reports/people/list?dimension=department&value=${eng.id}`);
    check('Who is behind a number: department', r.status === 200 && r.data.length === 5 && r.data.every((x) => x.department === 'Engineering'), JSON.stringify(r.body).slice(0, 200));
    r = await call(S.hr, 'GET', '/reports/people/list?dimension=tenure&value=5%2B');
    check('… tenure band 5+ years', r.data?.length === 1 && r.data[0].id === P.a.id, JSON.stringify(r.data));
    r = await call(S.hr, 'GET', `/reports/people/list?dimension=left&value=${addDays(today, -30).slice(0, 7)}`);
    check('… who left in a month', r.data?.some((x) => x.id === P.gone.id));
    r = await call(S.mgr, 'GET', `/reports/people/list?dimension=department&value=${ppl.id}`);
    check('Manager only sees their tree in lists', r.status === 200 && r.data.length === 0);
    check('Bad dimension → 400', (await call(S.hr, 'GET', '/reports/people/list?dimension=salary&value=x')).status === 400);
    check('Employee → 403', (await call(S.emp, 'GET', `/reports/people/list?dimension=department&value=${eng.id}`)).status === 403);

    // ── Attendance: range, weekday lates, day list, leave balances
    const from = addDays(today, -27);
    const weekdays = [];
    for (let d = from; d <= today; d = addDays(d, 1)) if (![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())) weekdays.push(d);
    const day = weekdays[2];
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    await p.attendanceRecord.createMany({
      data: [
        { companyId: cid, employeeId: P.a.id, date: D(day), status: 'PRESENT', lateMinutes: 15, checkIn: new Date(`${day}T04:00:00Z`) },
        { companyId: cid, employeeId: P.b.id, date: D(day), status: 'PRESENT', lateMinutes: 25 },
        { companyId: cid, employeeId: P.hr.id, date: D(day), status: 'PRESENT' },
        { companyId: cid, employeeId: P.mgr.id, date: D(day), status: 'ON_LEAVE' },
        { companyId: cid, employeeId: P.c.id, date: D(day), status: 'WORK_FROM_HOME' },
      ],
    });
    r = await call(S.hr, 'GET', `/reports/attendance?from=${from}&to=${today}`);
    check('Attendance for a date range', r.status === 200 && r.data.from === from && r.data.to === today && r.data.workingDays === weekdays.length, JSON.stringify(r.body).slice(0, 200));
    check('Late arrivals by weekday', r.data?.lateByWeekday?.length === 5 && r.data.lateByWeekday[dow - 1] === 2 && r.data.lateByWeekdayPrevious.length === 5, JSON.stringify(r.data?.lateByWeekday));
    check('Range over a year → 400', (await call(S.hr, 'GET', `/reports/attendance?from=2024-01-01&to=${today}`)).status === 400);
    r = await call(S.hr, 'GET', `/reports/attendance/day?date=${day}`);
    const g = r.data;
    check('Who was in on a day', r.status === 200 && g.present.length === 1 && g.late.length === 2 && g.leave.length === 1 && g.wfh.length === 1 && g.notRecorded.some((x) => x.id === P.n.id || x.id === P.emp.id), JSON.stringify(g && { p: g.present.length, l: g.late.length, lv: g.leave.length, w: g.wfh.length, nr: g.notRecorded.length }));
    check('Future day → 400', (await call(S.hr, 'GET', `/reports/attendance/day?date=${addDays(today, 3)}`)).status === 400);
    const el = await p.leaveType.create({ data: { companyId: cid, name: 'Earned leave', code: 'EL', category: 'EARNED' } }).catch(() => p.leaveType.create({ data: { companyId: cid, name: 'Earned leave', code: 'EL', category: 'CASUAL' } }));
    const year = Number(today.slice(0, 4));
    await p.leaveBalance.createMany({
      data: [
        { companyId: cid, employeeId: P.a.id, leaveTypeId: el.id, year, allocated: 20, usedDays: 2 },
        { companyId: cid, employeeId: P.b.id, leaveTypeId: el.id, year, allocated: 12, usedDays: 10 },
      ],
    });
    r = await call(S.hr, 'GET', '/reports/attendance');
    const lb = r.data?.leaveBalances;
    check('Leave balances left per type', lb?.byType.find((x) => x.type.id === el.id)?.leftDays === 20 && lb.byType.find((x) => x.type.id === el.id).entitledDays === 32, JSON.stringify(lb));
    check('Who has 15+ days left', lb?.plentyLeft.length === 1 && lb.plentyLeft[0].employee.id === P.a.id && lb.plentyLeft[0].days === 18);

    // ── Overview
    r = await call(S.hr, 'GET', `/reports/overview?from=${addDays(today, -30)}&to=${today}`);
    const O = r.data;
    check('Overview: headline numbers with the period before', r.status === 200 && O.kpis.headcount.value === 7 && typeof O.kpis.headcount.previous === 'number' && O.kpis.attendanceRatePct && O.kpis.attritionPct.value > 0, JSON.stringify(O?.kpis));
    check('Overview: 7 months of trend', O?.monthly.length === 7 && O.monthly[6].headcount === 7);
    check('Overview: headcount bridge', O?.bridge.joined >= 1 && O.bridge.joiners.some((x) => x.id === P.n.id) && O.bridge.left === 1 && O.bridge.end === O.bridge.start + O.bridge.joined - O.bridge.left, JSON.stringify(O?.bridge && { s: O.bridge.start, j: O.bridge.joined, l: O.bridge.left, e: O.bridge.end }));
    check('What changed: probation ending', O?.highlights.some((h) => h.key === 'probations'), JSON.stringify(O?.highlights));
    check('What changed: people leaving one department', O?.highlights.some((h) => h.key === 'attrition-dept' && h.title.includes('Engineering')));
    r = await call(S.mgr, 'GET', '/reports/overview');
    check('Manager overview is their tree', r.status === 200 && r.data.kpis.headcount.value === 5, JSON.stringify(r.data?.kpis?.headcount));
    check('Employee → 403', (await call(S.emp, 'GET', '/reports/overview')).status === 403);

    // ── Utilisation by week
    const proj = await p.project.create({ data: { companyId: cid, code: 'ATL', name: 'Atlas', startDate: D(addDays(today, -90)) } });
    await p.projectMember.create({ data: { companyId: cid, projectId: proj.id, employeeId: P.a.id, allocation: 100, startDate: D(addDays(today, -60)) } });
    const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) - 7);
    const ts = await p.timesheet.create({ data: { companyId: cid, employeeId: P.a.id, weekStart: D(monday), status: 'SUBMITTED' } });
    await p.timesheetEntry.createMany({ data: [0, 1, 2].map((i) => ({ companyId: cid, timesheetId: ts.id, employeeId: P.a.id, projectId: proj.id, date: D(addDays(monday, i)), minutes: 480, billable: true, task: 'Build', line: i, status: 'SUBMITTED' })) });
    r = await call(S.hr, 'GET', `/reports/utilisation?from=${addDays(monday, -7)}&to=${addDays(monday, 6)}`);
    const u = r.data;
    const ra = u?.rows?.find((x) => x.employee.id === P.a.id);
    check('Utilisation by week', r.status === 200 && u.weeks.length === 2 && u.weeks[0].capacityMinutes > 0 && ra?.weekly?.[1]?.loggedMinutes === 1440 && ra.weekly[1].billableMinutes === 1440 && ra.weekly[0].loggedMinutes === 0, JSON.stringify(u && { weeks: u.weeks, a: ra?.weekly }));

    // ── Emailed on a schedule
    r = await call(S.hr, 'GET', '/reports/schedules/recipients');
    const recIds = (r.data ?? []).map((x) => x.id);
    check('Recipients: only people who can see reports', recIds.includes(P.hr.user.id) && recIds.includes(P.mgr.user.id) && !recIds.includes(P.emp.user.id), JSON.stringify(r.data?.map((x) => x.email)));
    check('Someone without reports → 400', (await call(S.hr, 'POST', '/reports/schedules', { report: 'overview', frequency: 'WEEKLY', dayOfWeek: 1, hour: 9, recipientIds: [P.emp.user.id] })).status === 400);
    check('Weekly without a day → 400', (await call(S.hr, 'POST', '/reports/schedules', { report: 'overview', frequency: 'WEEKLY', hour: 9, recipientIds: [P.hr.user.id] })).status === 400);
    r = await call(S.hr, 'POST', '/reports/schedules', { report: 'people', frequency: 'WEEKLY', dayOfWeek: 1, hour: 9, recipientIds: [P.hr.user.id, P.mgr.user.id], attachCsv: true });
    const sched = r.data;
    const next = sched && new Date(sched.nextRunAt);
    const localDow = next && new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(next);
    const localHour = next && Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(next));
    check('Create a weekly schedule (next Monday 9:00 local)', r.status === 201 && next > new Date() && localDow === 'Mon' && localHour === 9, JSON.stringify({ next: sched?.nextRunAt, localDow, localHour }));
    r = await call(S.hr, 'GET', '/reports/schedules');
    check('List your schedules with recipients', r.data?.length === 1 && r.data[0].recipients.length === 2);
    check('Others can’t change it → 403', (await call(S.mgr, 'DELETE', `/reports/schedules/${sched.id}`)).status === 403);
    r = await call(S.hr, 'POST', `/reports/schedules/${sched.id}/send`);
    await new Promise((res) => setTimeout(res, 800));
    check('Send now: one email per recipient', r.status === 200 && r.data.sent === 2, JSON.stringify(r.body));
    const logs = await p.emailLog.findMany({ where: { companyId: cid, subject: { startsWith: 'People report' } } });
    check('Emails recorded', logs.length === 2);
    const dir = path.resolve('.mail');
    const csvFiles = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.includes('people-report') && f.endsWith('.csv')) : [];
    check('CSV attached only for people who may export it', csvFiles.length === 1, JSON.stringify(csvFiles));
    r = await call(S.hr, 'PUT', `/reports/schedules/${sched.id}`, { report: 'overview', frequency: 'MONTHLY', dayOfMonth: 28, hour: 18, recipientIds: [P.hr.user.id] });
    const m = r.data && new Date(r.data.nextRunAt);
    check('Change it to monthly on the 28th', r.status === 200 && Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric' }).format(m)) === 28, JSON.stringify(r.body));
    r = await call(S.hr, 'DELETE', `/reports/schedules/${sched.id}`);
    check('Delete it', r.status === 200 && (await p.reportSchedule.count({ where: { companyId: cid } })) === 0);
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    await dropCompany(SLUG);
    restoreMail();
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
