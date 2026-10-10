// Internships: end date required for interns, the "internships ending" card,
// convert (type, probation, title, Intern role → Employee), extend, the
// company rule (remind vs convert automatically) and the reminder job:
// heads-up, overdue, escalation to Company Admins, automatic conversion.
const path = require('path');
const { prisma: p, suite, call, makeCompany, dropCompany, todayIn, addDays } = require('./lib');

const dist = (m) => require(path.resolve(__dirname, '..', '..', 'dist/apps/api/src/modules', m));
const { InternshipRemindersService } = dist('employees/internship-reminders.service.js');
const { EmployeeLifecycleService } = dist('employees/lifecycle.service.js');
const { CompanyRolesService } = dist('access/company-roles.service.js');
const { NotificationsService } = dist('notifications/notifications.service.js');
const { RealtimeService } = dist('realtime/realtime.service.js');

const SLUG = 'internships-e2e';
const t = suite('internships');
const { check } = t;
const D = (k) => new Date(`${k}T00:00:00Z`);

(async () => {
  await dropCompany(SLUG);
  try {
    const today = todayIn();
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['boss', ['employee', 'company_admin']],
      ['hr', ['employee', 'hr']],
      ['mgr', ['employee', 'manager']],
      ['ivy', ['employee'], 'mgr'],
      ['ian', ['employee'], 'mgr'],
      ['ida', ['employee'], 'mgr'],
      ['ike', ['employee'], 'mgr'],
      ['ina', ['employee'], 'mgr'],
      ['noa', ['employee'], 'mgr'],
    ]);
    const cid = company.id;
    // The company made an "Intern" role from the template
    const internRole = await p.role.create({ data: { companyId: cid, name: 'Intern', description: 'Self-service for interns' } });
    const employeeRole = await p.role.findFirst({ where: { companyId: cid, key: 'employee' } });
    const intern = (who, end, extra = {}) => p.employee.update({ where: { id: P[who].id }, data: { employmentType: 'INTERN', internshipEndDate: end ? D(end) : null, ...extra } });
    await intern('ivy', addDays(today, 10)); // ending soon
    await intern('ian', addDays(today, -8)); // ended over a week ago
    await intern('ida', addDays(today, -1)); // ended yesterday
    await intern('ike', addDays(today, 60)); // far off
    await intern('ina', today, { skipAutoConvert: true }); // ends today, excluded from auto
    await intern('noa', null); // imported without a date
    await p.userRole.create({ data: { userId: P.ida.user.id, roleId: internRole.id, companyId: cid } });
    await p.userRole.create({ data: { userId: P.ina.user.id, roleId: internRole.id, companyId: cid } });

    // ── Creating interns ──
    let r = await call(S.hr, 'POST', '/employees', { firstName: 'Zia', lastName: 'Q', email: `zia@${SLUG}.test`, joiningDate: today, employmentType: 'INTERN' });
    check('New intern needs an end date', r.status === 400 && /internship ends/.test(r.body?.message ?? JSON.stringify(r.body)), JSON.stringify(r.body));
    r = await call(S.hr, 'POST', '/employees', { firstName: 'Zia', lastName: 'Q', email: `zia@${SLUG}.test`, joiningDate: today, employmentType: 'INTERN', internshipEndDate: today });
    check('End date must be after joining', r.status === 400);
    r = await call(S.hr, 'POST', '/employees', { firstName: 'Zia', lastName: 'Q', email: `zia@${SLUG}.test`, joiningDate: today, employmentType: 'INTERN', internshipEndDate: addDays(today, 180) });
    check('Create an intern with an end date', r.status === 201 && r.data.internshipEndDate?.startsWith(addDays(today, 180)), JSON.stringify(r.body).slice(0, 200));
    r = await call(S.hr, 'PATCH', `/employees/${P.mgr.id}`, { internshipEndDate: addDays(today, 30) });
    check('Only interns have an internship end date', r.status === 400);

    // ── Needs attention ──
    r = await call(S.hr, 'GET', '/employees/lifecycle');
    const card = r.data?.attention?.find((a) => a.key === 'internships');
    check('HR: internships card (soon, overdue, no date; not the far one)', card && card.tone === 'danger' && /overdue/.test(card.title) && /no end date/.test(card.title) && card.people.some((x) => x.name === 'noa T') && !card.people.some((x) => x.name === 'ike T'), JSON.stringify(card));
    check('HR: rule is "remind" and they may change it', r.data.internshipEndAction === 'remind' && r.data.managesInternships === true);
    r = await call(S.mgr, 'GET', '/employees/lifecycle');
    check('Manager: sees their interns, may not change the rule', r.data?.attention?.some((a) => a.key === 'internships') && r.data.managesInternships === false);
    r = await call(S.hr, 'GET', '/employees?employmentType=INTERN&sort=internship&limit=50');
    check('List: interns by end date, no date first', r.status === 200 && r.body.data[0].firstName === 'noa' && r.body.data[1].firstName === 'ian', r.body.data?.map((x) => x.firstName).join());

    // ── Convert ──
    check('Manager can’t convert', [403, 404].includes((await call(S.mgr, 'POST', `/employees/${P.ida.id}/convert`, { employmentType: 'FULL_TIME' })).status));
    check('Can’t convert someone who isn’t an intern', (await call(S.hr, 'POST', `/employees/${P.mgr.id}/convert`, { employmentType: 'FULL_TIME' })).status === 400);
    check('Can’t convert to Intern', (await call(S.hr, 'POST', `/employees/${P.ida.id}/convert`, { employmentType: 'INTERN' })).status === 400);
    check('Probation must end after the start', (await call(S.hr, 'POST', `/employees/${P.ida.id}/convert`, { employmentType: 'FULL_TIME', startDate: today, probationEnd: today })).status === 400);
    const title = await p.designation.create({ data: { companyId: cid, name: 'Software Engineer' } });
    r = await call(S.hr, 'POST', `/employees/${P.ida.id}/convert`, { employmentType: 'FULL_TIME', startDate: today, probationEnd: addDays(today, 90), designationId: title.id, note: 'Offer accepted' });
    check('HR converts Ida: Full-time on probation', r.status === 200 && r.data.employmentType === 'FULL_TIME' && r.data.employmentStatus === 'PROBATION', JSON.stringify(r.body));
    const ida = await p.employee.findUnique({ where: { id: P.ida.id } });
    check('Ida: type, probation end, title, no internship date', ida.employmentType === 'FULL_TIME' && ida.confirmationDate?.toISOString().startsWith(addDays(today, 90)) && ida.designationId === title.id && ida.internshipEndDate === null);
    const idaRoles = (await p.userRole.findMany({ where: { userId: P.ida.user.id } })).map((x) => x.roleId);
    check('Ida: Intern role swapped for Employee', !idaRoles.includes(internRole.id) && idaRoles.includes(employeeRole.id), idaRoles.join());
    check('Ida is told', (await p.notification.count({ where: { userId: P.ida.user.id, type: 'employee.converted' } })) === 1);
    r = await call(S.hr, 'GET', `/employees/${P.ida.id}/history`);
    const conv = r.data?.find((x) => x.kind === 'converted');
    check('History: converted, with who and details', conv && conv.title === 'Converted from intern' && conv.detail === 'Intern → Full time' && conv.by === 'hr T' && /Software Engineer/.test(conv.note) && /Offer accepted/.test(conv.note), JSON.stringify(conv));
    check('Convert twice → 400', (await call(S.hr, 'POST', `/employees/${P.ida.id}/convert`, { employmentType: 'FULL_TIME' })).status === 400);

    // ── Extend ──
    check('Extend: date must be ahead', (await call(S.hr, 'POST', `/employees/${P.ivy.id}/extend-internship`, { until: today })).status === 400);
    r = await call(S.hr, 'POST', `/employees/${P.ivy.id}/extend-internship`, { until: addDays(today, 100), note: 'Project runs longer' });
    check('HR extends Ivy', r.status === 200 && r.data.internshipEndDate === addDays(today, 100));
    r = await call(S.hr, 'GET', `/employees/${P.ivy.id}/history`);
    check('History: extended + upcoming end', r.data?.some((x) => x.kind === 'internship_extended' && x.note === 'Project runs longer') && r.data.some((x) => x.id === 'upcoming-internship'), (r.data ?? []).map((x) => x.kind).join());
    await p.employee.update({ where: { id: P.ivy.id }, data: { internshipEndDate: D(addDays(today, 5)) } });

    // ── Reminder job: "remind" ──
    const config = { get: (k) => (k === 'webUrl' ? 'http://localhost:3000' : undefined) };
    const notifications = new NotificationsService(p, { queueNotification: async () => undefined }, config, new RealtimeService());
    const lifecycle = new EmployeeLifecycleService(p, null, null, notifications, new CompanyRolesService(p));
    const job = new InternshipRemindersService(p, lifecycle, notifications, config);
    const count = (userId, type, where = {}) => p.notification.count({ where: { userId, type, ...where } });
    let out = await job.run(cid);
    check('Remind mode: nobody converted', out.converted === 0 && (await p.employee.count({ where: { companyId: cid, employmentType: 'INTERN' } })) === 6, JSON.stringify(out));
    check('Heads-up for Ivy to HR and her manager', (await count(P.hr.user.id, 'employee.internship_ending', { dedupeKey: { startsWith: `internship-ending:${P.ivy.id}` } })) === 1 && (await count(P.mgr.user.id, 'employee.internship_ending', { dedupeKey: { startsWith: `internship-ending:${P.ivy.id}` } })) === 1);
    check('No heads-up for Ike (60 days off)', (await p.notification.count({ where: { dedupeKey: { contains: P.ike.id } } })) === 0);
    check('Ian overdue → HR reminded and Company Admin told', (await count(P.hr.user.id, 'employee.internship_ending', { dedupeKey: { startsWith: `internship-ended:${P.ian.id}` } })) === 1 && (await count(P.boss.user.id, 'employee.internship_ending', { dedupeKey: { startsWith: `internship-escalated:${P.ian.id}` } })) === 1 && out.escalated === 1, JSON.stringify(out));
    const before = await p.notification.count({ where: { user: { companyId: cid } } });
    await job.run(cid);
    check('Second run → no duplicates', (await p.notification.count({ where: { user: { companyId: cid } } })) === before);

    // ── The company rule ──
    check('Manager can’t change the rule', (await call(S.mgr, 'PUT', '/employees/internship-settings', { internshipEndAction: 'convert' })).status === 403);
    check('Bad value → 400', (await call(S.hr, 'PUT', '/employees/internship-settings', { internshipEndAction: 'always' })).status === 400);
    r = await call(S.hr, 'PUT', '/employees/internship-settings', { internshipEndAction: 'convert' });
    check('HR turns on automatic conversion', r.status === 200 && (await call(S.hr, 'GET', '/employees/lifecycle')).data.internshipEndAction === 'convert');

    // ── Reminder job: "convert" ──
    out = await job.run(cid);
    const ian = await p.employee.findUnique({ where: { id: P.ian.id } });
    check('Ian converted automatically: Full-time, Active', out.converted === 1 && ian.employmentType === 'FULL_TIME' && ian.employmentStatus === 'ACTIVE' && ian.internshipEndDate === null, JSON.stringify(out));
    const ev = await p.employeeEvent.findFirst({ where: { employeeId: P.ian.id, kind: 'converted' } });
    check('History: by the system', ev && ev.actorUserId === null && /automatically/.test(ev.note ?? ''));
    check('Ian and HR are told', (await count(P.ian.user.id, 'employee.converted')) === 1 && (await count(P.hr.user.id, 'employee.converted')) === 1);
    check('Ina (excluded) stays an intern', (await p.employee.findUnique({ where: { id: P.ina.id } })).employmentType === 'INTERN');
    check('Ivy (5 days left) stays an intern', (await p.employee.findUnique({ where: { id: P.ivy.id } })).employmentType === 'INTERN');

    // ── Edit form: Intern → Full-time also swaps the role ──
    r = await call(S.hr, 'PATCH', `/employees/${P.ina.id}`, { employmentType: 'FULL_TIME' });
    const ina = await p.employee.findUnique({ where: { id: P.ina.id } });
    const inaRoles = (await p.userRole.findMany({ where: { userId: P.ina.user.id } })).map((x) => x.roleId);
    check('Edit to Full-time: date cleared, Intern role gone', r.status === 200 && ina.internshipEndDate === null && ina.skipAutoConvert === false && !inaRoles.includes(internRole.id) && inaRoles.includes(employeeRole.id), JSON.stringify(r.body).slice(0, 200));
    r = await call(S.hr, 'PATCH', `/employees/${P.ina.id}`, { employmentType: 'INTERN' });
    check('Edit back to Intern needs an end date', r.status === 400);
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
