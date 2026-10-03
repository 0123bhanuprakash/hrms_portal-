// Timesheets: weekly grid, validation, project-routed approval, compliance, report, reminder.
const path = require('path');
const { prisma: p, suite, call, wait, makeCompany, dropCompany, mailSnapshot, todayIn, addDays, mondayOf } = require('./lib');

const SLUG = 'timesheets-e2e';
const t = suite('timesheets');
const { check } = t;

(async () => {
  await dropCompany(SLUG);
  const restoreMail = mailSnapshot();
  try {
    const today = todayIn();
    const thisWeek = mondayOf(today);
    const lastWeek = addDays(thisWeek, -7);
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['boss', ['employee', 'manager']],
      ['tl', ['employee'], 'boss'],
      ['pm', ['employee'], 'boss'],
      ['emp', ['employee'], 'boss'],
      ['solo', ['employee'], 'boss'],
      ['hr', ['employee', 'hr']],
      ['pmo', ['employee', 'pmo']],
    ]);
    const tpl = await p.role.findFirst({ where: { isTemplate: true, key: 'employee' }, include: { rolePermissions: { include: { permission: true } } } });
    check('Employee template can fill timesheets', tpl.rolePermissions.some((r) => r.permission.key === 'timesheet.submit'));

    // Project Apollo: tl = team lead, pm = manager, emp = member under tl
    const apollo = await p.project.create({ data: { companyId: company.id, code: 'APO', name: 'Apollo', clientName: 'Acme', status: 'ACTIVE', startDate: new Date('2026-01-01') } });
    const zeus = await p.project.create({ data: { companyId: company.id, code: 'ZEU', name: 'Zeus', status: 'ACTIVE', startDate: new Date('2026-01-01') } });
    const start = new Date('2026-01-01');
    await p.projectMember.createMany({
      data: [
        { companyId: company.id, projectId: apollo.id, employeeId: P.tl.id, role: 'TEAM_LEAD', allocation: 100, startDate: start },
        { companyId: company.id, projectId: apollo.id, employeeId: P.pm.id, role: 'MANAGER', allocation: 50, startDate: start },
        { companyId: company.id, projectId: apollo.id, employeeId: P.emp.id, role: 'MEMBER', leadEmployeeId: P.tl.id, allocation: 80, startDate: start },
        // Zeus assignment ended two days before the end of last week
        { companyId: company.id, projectId: zeus.id, employeeId: P.emp.id, role: 'MEMBER', allocation: 20, startDate: start, endDate: new Date(addDays(lastWeek, 4) + 'T00:00:00Z') },
      ],
    });

    // ── The week view
    check('Week must start on Monday → 400', (await call(S.emp, 'GET', `/timesheets/weeks/${addDays(lastWeek, 1)}`)).status === 400);
    const w0 = await call(S.emp, 'GET', `/timesheets/weeks/${lastWeek}`);
    check('Empty week: editable, 7 days, my projects', w0.data?.status === null && w0.data.canEdit && w0.data.days.length === 7 && w0.data.projects.length === 2, JSON.stringify(w0.body).slice(0, 300));
    check('Future week can’t be filled → 400', (await call(S.emp, 'PUT', `/timesheets/weeks/${addDays(thisWeek, 7)}`, { lines: [] })).status === 400);
    check('Week older than 8 weeks is locked → 400', (await call(S.emp, 'PUT', `/timesheets/weeks/${addDays(thisWeek, -63)}`, { lines: [] })).status === 400);

    // ── Validation
    const H = (h) => Math.round(h * 60);
    const bad = async (lines) => (await call(S.emp, 'PUT', `/timesheets/weeks/${lastWeek}`, { lines })).status;
    check('Project I’m not on → 400', (await bad([{ projectId: (await p.project.create({ data: { companyId: company.id, code: 'OTH', name: 'Other', startDate: start } })).id, task: 'Dev', minutes: [60, 0, 0, 0, 0, 0, 0] }])) === 400);
    check('Hours after an assignment ended → 400', (await bad([{ projectId: zeus.id, task: 'Support', minutes: [0, 0, 0, 0, 0, H(2), 0] }])) === 400);
    check('More than 24h in a day → 400', (await bad([{ projectId: null, task: 'Training', minutes: [1000, 0, 0, 0, 0, 0, 0] }, { projectId: apollo.id, task: 'Dev', minutes: [500, 0, 0, 0, 0, 0, 0] }])) === 400);
    check('Same task twice → 400', (await bad([{ projectId: apollo.id, task: 'Dev', minutes: [60, 0, 0, 0, 0, 0, 0] }, { projectId: apollo.id, task: 'dev', minutes: [0, 60, 0, 0, 0, 0, 0] }])) === 400);
    if (today < addDays(thisWeek, 6)) {
      check('Future day this week → 400', (await call(S.emp, 'PUT', `/timesheets/weeks/${thisWeek}`, { lines: [{ projectId: apollo.id, task: 'Dev', minutes: [0, 0, 0, 0, 0, 0, 60] }] })).status === 400);
    }

    // ── Save + submit
    const lines = [
      { projectId: apollo.id, task: 'Feature development', billable: true, minutes: [H(6), H(6), H(5), H(6), H(6), 0, 0] },
      { projectId: zeus.id, task: 'Support', billable: true, minutes: [H(1), H(1), H(2), 0, 0, 0, 0] },
      { projectId: null, task: 'Training', billable: true, minutes: [0, 0, 0, H(1), 0, 0, 0] },
      { projectId: apollo.id, task: 'Planning (copied)', minutes: [0, 0, 0, 0, 0, 0, 0] },
    ];
    const saved = await call(S.emp, 'PUT', `/timesheets/weeks/${lastWeek}`, { lines });
    check('Save week → Draft, 34h total', saved.data?.status === 'DRAFT' && saved.data.totalMinutes === H(34), JSON.stringify(saved.body).slice(0, 300));
    check('Empty row kept; internal work never billable', saved.data?.lines.length === 4 && saved.data.lines.find((l) => l.task === 'Training').billable === false);
    check('Can submit', saved.data?.canSubmit);
    const sub = await call(S.emp, 'POST', `/timesheets/weeks/${lastWeek}/submit`);
    check('Submit → approvers: team lead, PM and line manager', sub.data?.status === 'SUBMITTED' && sub.data.approval.approvers.length === 3, JSON.stringify(sub.data?.approval));
    check('Submitted week is read-only → 400', (await call(S.emp, 'PUT', `/timesheets/weeks/${lastWeek}`, { lines })).status === 400);
    await wait();
    check('Approvers notified in-app', (await p.notification.count({ where: { type: 'timesheet.submitted', userId: { in: [P.tl.user.id, P.pm.user.id, P.boss.user.id] } } })) === 3);
    check('Recall → Draft', (await call(S.emp, 'POST', `/timesheets/weeks/${lastWeek}/recall`)).data?.status === 'DRAFT');
    await call(S.emp, 'POST', `/timesheets/weeks/${lastWeek}/submit`);

    // ── Review
    const tlList = await call(S.tl, 'GET', '/timesheets?view=review');
    check('Team lead sees it waiting (DB-filtered)', tlList.body.data?.length === 1 && tlList.body.data[0].canDecide);
    check('Pending count for team lead', (await call(S.tl, 'GET', '/timesheets/pending-count')).data?.count === 1);
    check('Peer cannot see it in review', (await call(S.solo, 'GET', '/timesheets?view=review')).body.data?.length === 0);
    const id = tlList.body.data[0].id;
    check('Peer cannot open the week → 404', (await call(S.solo, 'GET', `/timesheets/weeks/${lastWeek}?employeeId=${P.emp.id}`)).status === 404);
    const asTl = await call(S.tl, 'GET', `/timesheets/weeks/${lastWeek}?employeeId=${P.emp.id}`);
    check('Approver opens the week', asTl.data?.canDecide && asTl.data.lines.length === 4 && !asTl.data.canEdit);
    check('Peer cannot approve → 403', (await call(S.solo, 'POST', `/timesheets/${id}/approve`, {})).status === 403);
    check('Employee cannot approve own → 404', (await call(S.emp, 'POST', `/timesheets/${id}/approve`, {})).status === 404);
    const rj = await call(S.pm, 'POST', `/timesheets/${id}/reject`, { reason: 'Zeus hours belong to the Support task code' });
    check('PM rejects', rj.data?.status === 'REJECTED');
    await wait();
    check('Employee told why', (await p.notification.findFirst({ where: { userId: P.emp.user.id, type: 'timesheet.rejected' } }))?.body?.includes('Support task code'));
    const again = await call(S.emp, 'GET', `/timesheets/weeks/${lastWeek}`);
    check('Rejected week is editable again with the note', again.data?.canEdit && again.data.approval.note.includes('Support'));
    await call(S.emp, 'PUT', `/timesheets/weeks/${lastWeek}`, { lines: lines.slice(0, 3) });
    await call(S.emp, 'POST', `/timesheets/weeks/${lastWeek}/submit`);
    const ap = await call(S.tl, 'POST', `/timesheets/${id}/approve`, { note: 'Thanks' });
    check('Team lead approves', ap.data?.status === 'APPROVED');
    check('Second decision → 409', (await call(S.pm, 'POST', `/timesheets/${id}/approve`, {})).status === 409);
    check('Approved week is locked → 400', (await call(S.emp, 'PUT', `/timesheets/weeks/${lastWeek}`, { lines })).status === 400);

    // ── No project: line manager; HR can approve anyone
    await call(S.solo, 'PUT', `/timesheets/weeks/${lastWeek}`, { lines: [{ projectId: null, task: 'Recruiting drive', minutes: [H(8), H(8), 0, 0, 0, 0, 0] }] });
    const solo = await call(S.solo, 'POST', `/timesheets/weeks/${lastWeek}/submit`);
    check('Not on a project → line manager approves', solo.data?.approval.approvers.length === 1 && solo.data.approval.approvers[0].id === P.boss.user.id);
    const soloId = solo.data.id;
    check('HR (company scope) can approve anyone', (await call(S.hr, 'POST', `/timesheets/${soloId}/approve`, {})).data?.status === 'APPROVED');

    // ── Team views
    const team = await call(S.boss, 'GET', '/timesheets?view=team');
    check('Manager sees reports’ submitted weeks', team.body.data?.length === 2);
    const own = await call(S.emp, 'GET', '/timesheets?view=team');
    check('Employee “team” view shows only their own weeks', own.body.data?.length === 1 && own.body.data[0].employee.id === P.emp.id);
    const comp = await call(S.boss, 'GET', `/timesheets/compliance?weekStart=${lastWeek}`);
    check('Compliance: manager + reports with status', comp.body.data?.length === 5 && comp.body.data.find((r) => r.employee.id === P.tl.id).timesheet === null);
    const missing = await call(S.boss, 'GET', `/timesheets/compliance?weekStart=${lastWeek}&status=missing`);
    check('Compliance filter: missing (in the DB)', missing.body.meta?.total === 3);

    // ── Report (PMO: company-wide view)
    const rep = await call(S.pmo, 'GET', `/timesheets/report?from=${lastWeek}&to=${addDays(lastWeek, 6)}`);
    const apo = rep.data?.byProject.find((r) => r.project?.id === apollo.id);
    check('Report: Apollo 29h all billable', apo?.minutes === H(29) && apo.billableMinutes === H(29), JSON.stringify(rep.data?.byProject));
    check('Report: internal work + totals', rep.data?.byProject.some((r) => r.project === null) && rep.data.totalMinutes === H(34 + 16) && rep.data.billableMinutes === H(33));
    check('Report: by person', rep.data?.byEmployee.length === 2);
    const repTl = await call(S.tl, 'GET', `/timesheets/report?from=${lastWeek}&to=${addDays(lastWeek, 6)}`);
    check('Report limited to own scope', repTl.data?.totalMinutes === 0);

    // ── Monday reminder (direct, with a fake Monday 11:00 IST)
    const { TimesheetRemindersService } = require(path.resolve('dist/apps/api/src/modules/timesheets/timesheet-reminders.service.js'));
    const notifications = {};
    notifications.notify = async (n) => {
      let c = 0;
      for (const u of n.userIds) {
        if (n.dedupeKey && (await p.notification.count({ where: { userId: u, dedupeKey: n.dedupeKey } }))) continue;
        await p.notification.create({ data: { companyId: n.companyId, userId: u, type: n.type, title: n.title, dedupeKey: n.dedupeKey ?? null } });
        c++;
      }
      return c;
    };
    const entitlements = { forCompany: async () => ({ features: new Set(['work.timesheets']) }) };
    const rem = new TimesheetRemindersService(p, notifications, entitlements, { get: () => 'false' });
    // Monday after last week, 05:30 UTC = 11:00 IST
    const monday = new Date(`${thisWeek}T05:30:00Z`);
    const n1 = await rem.run(monday, company.id);
    check('Reminder: tl and pm (on Apollo, nothing submitted)', n1 === 2 && (await p.notification.count({ where: { type: 'timesheet.reminder', userId: { in: [P.tl.user.id, P.pm.user.id] } } })) === 2, String(n1));
    check('Reminder not repeated', (await rem.run(monday, company.id)) === 0);
    check('No reminder before 10:00', (await rem.run(new Date(`${thisWeek}T03:00:00Z`), company.id)) === 0);
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
