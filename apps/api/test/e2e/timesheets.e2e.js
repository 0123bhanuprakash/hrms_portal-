// Timesheets: time blocks, no overlaps, night work, submit unsent days, lead-routed approval,
// send back / approve, team grid, compliance, reminders.
const path = require('path');
const { prisma: p, suite, call, makeCompany, dropCompany, mailSnapshot, todayIn, addDays, mondayOf } = require('./lib');

const SLUG = 'timesheets-e2e';
/** Notifications are sent in the background — give them a moment */
const eventually = async (fn) => {
  for (let i = 0; i < 30; i++) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};
const t = suite('timesheets');
const { check } = t;

(async () => {
  await dropCompany(SLUG);
  const restoreMail = mailSnapshot();
  try {
    const today = todayIn();
    const thisWeek = mondayOf(today);
    const lastWeek = addDays(thisWeek, -7);
    const [MON, TUE, WED, THU, FRI, SAT] = [0, 1, 2, 3, 4, 5].map((i) => addDays(lastWeek, i));
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

    // Apollo (client): tl = team lead, pm = manager, emp = member under tl. Zeus (internal): emp only, ended last Friday.
    const start = new Date('2026-01-01');
    const apollo = await p.project.create({ data: { companyId: company.id, code: 'APO', name: 'Apollo', clientName: 'Acme', type: 'CLIENT', status: 'ACTIVE', startDate: start } });
    const zeus = await p.project.create({ data: { companyId: company.id, code: 'ZEU', name: 'Zeus', type: 'INTERNAL', status: 'ACTIVE', startDate: start } });
    const other = await p.project.create({ data: { companyId: company.id, code: 'OTH', name: 'Other', type: 'CLIENT', clientName: 'X', status: 'ACTIVE', startDate: start } });
    await p.projectMember.createMany({
      data: [
        { companyId: company.id, projectId: apollo.id, employeeId: P.tl.id, role: 'TEAM_LEAD', allocation: 100, startDate: start },
        { companyId: company.id, projectId: apollo.id, employeeId: P.pm.id, role: 'MANAGER', allocation: 50, startDate: start },
        { companyId: company.id, projectId: apollo.id, employeeId: P.emp.id, role: 'MEMBER', leadEmployeeId: P.tl.id, allocation: 80, startDate: start },
        { companyId: company.id, projectId: zeus.id, employeeId: P.emp.id, role: 'MEMBER', allocation: 20, startDate: start, endDate: new Date(`${FRI}T00:00:00Z`) },
      ],
    });
    const block = (s, date, from, to, projectId, description = 'Work') => call(s, 'POST', '/timesheets/blocks', { date, startMin: from * 60, endMin: to * 60, projectId, description });

    // ── The week
    check('Week must start on Monday → 400', (await call(S.emp, 'GET', `/timesheets/weeks/${TUE}`)).status === 400);
    const w0 = await call(S.emp, 'GET', `/timesheets/weeks/${lastWeek}`);
    check('Empty week: 7 days, my 2 projects, nothing logged', w0.data?.days.length === 7 && w0.data.projects.length === 2 && w0.data.blocks.length === 0 && w0.data.days[5].weekend, JSON.stringify(w0.body).slice(0, 300));
    check('Projects carry billable from the project type', w0.data?.projects.find((x) => x.id === apollo.id).billable === true && w0.data.projects.find((x) => x.id === zeus.id).billable === false);

    // ── Blocks
    const b1 = await block(S.emp, MON, 10, 12, apollo.id, 'Invoice API');
    check('Log 10:00–12:00 on Apollo → draft, 2h, billable', b1.status === 201 && b1.data.minutes === 120 && b1.data.billable && b1.data.status === 'DRAFT' && b1.data.canEdit, JSON.stringify(b1.body).slice(0, 300));
    const ov = await block(S.emp, MON, 11, 13, zeus.id, 'Support');
    check('Overlapping block on another project → 400', ov.status === 400 && /Overlaps/.test(ov.body.detail), ov.body.detail);
    check('Touching block is fine; internal never billable', (await block(S.emp, MON, 12, 13, zeus.id, 'Support')).data?.billable === false);
    check('General time (no project)', (await block(S.emp, MON, 13, 14, null, 'Hiring panel')).status === 201);
    check('After the assignment ended → 400', (await block(S.emp, SAT, 10, 11, zeus.id)).status === 400);
    check('Project I’m not on → 400', (await block(S.emp, MON, 15, 16, other.id)).status === 400);
    check('Future day → 400', (await block(S.emp, addDays(today, 1), 10, 11, null)).status === 400);
    check('Older than 8 weeks → 400', (await block(S.emp, addDays(thisWeek, -63), 10, 11, null)).status === 400);
    check('End before start → 400', (await call(S.emp, 'POST', '/timesheets/blocks', { date: MON, startMin: 900, endMin: 900, description: 'x y' })).status === 400);
    check('Not in 5-minute steps → 400', (await call(S.emp, 'POST', '/timesheets/blocks', { date: MON, startMin: 901, endMin: 960, description: 'x y' })).status === 400);
    check('Description required → 400', (await call(S.emp, 'POST', '/timesheets/blocks', { date: MON, startMin: 900, endMin: 960, description: ' ' })).status === 400);
    const cur = await call(S.emp, 'GET', `/timesheets/weeks/${thisWeek}`);
    if (cur.data && cur.data.nowMin < 1380) {
      const s = Math.ceil((cur.data.nowMin + 10) / 5) * 5;
      check('Later today → 400', (await call(S.emp, 'POST', '/timesheets/blocks', { date: today, startMin: s, endMin: s + 30, description: 'Later' })).status === 400);
    }
    // Night work crosses midnight
    check('Night block 10 pm – 2 am', (await block(S.emp, TUE, 22, 26, null, 'Release night')).status === 201);
    check('Next morning 1–2 am overlaps it → 400', (await block(S.emp, WED, 1, 2, null)).status === 400);
    check('Next morning 2–3 am is fine', (await block(S.emp, WED, 2, 3, null, 'Smoke tests')).status === 201);
    // Edit
    const up = await call(S.emp, 'PUT', `/timesheets/blocks/${b1.data.id}`, { date: MON, startMin: 540, endMin: 720, projectId: apollo.id, description: 'Invoice API + tests' });
    check('Edit block → 9:00–12:00 (3h)', up.data?.minutes === 180 && up.data.description === 'Invoice API + tests');
    check('Edit into an overlap → 400', (await call(S.emp, 'PUT', `/timesheets/blocks/${b1.data.id}`, { date: MON, startMin: 540, endMin: 790, projectId: apollo.id, description: 'x y' })).status === 400);
    // Copy a day
    const cp = await call(S.emp, 'POST', '/timesheets/copy-day', { from: MON, to: THU });
    check('Copy Monday onto Thursday → 3 blocks', cp.data?.copied === 3 && cp.data.skipped.length === 0, JSON.stringify(cp.body));
    check('Copy again → all skipped as overlaps', (await call(S.emp, 'POST', '/timesheets/copy-day', { from: MON, to: THU })).data?.copied === 0);
    const w1 = await call(S.emp, 'GET', `/timesheets/weeks/${lastWeek}`);
    check('Week: Monday 5h draft, totals, unsent days', w1.data?.days[0].minutes === 300 && w1.data.days[0].status === 'draft' && w1.data.totalMinutes === 300 + 240 + 60 + 300 && w1.data.unsentDays === 4, JSON.stringify(w1.data?.days.map((d) => [d.minutes, d.status])));
    check('Apollo logged vs expected', w1.data?.projects.find((x) => x.id === apollo.id).loggedMinutes === 360 && w1.data.projects.find((x) => x.id === apollo.id).expectedMinutes === Math.round(5 * 480 * 0.8));

    // ── Submit
    const pv = await call(S.emp, 'GET', '/timesheets/submit-preview?scope=all');
    const goes = (id) => pv.data?.projects.find((x) => (x.project?.id ?? null) === id)?.goesTo;
    check('Preview: Mon–Thu, with day checks', pv.data?.dates.length === 4 && pv.data.days.some((d) => d.date === FRI && d.check === 'empty'), JSON.stringify(pv.data?.days));
    check('Preview: Apollo → its team lead only', goes(apollo.id)?.length === 1 && goes(apollo.id)[0].label === 'Team lead · Apollo' && goes(apollo.id)[0].people[0].id === P.tl.user.id, JSON.stringify(goes(apollo.id)));
    check('Preview: Zeus (no lead, no PM) and General → line manager', goes(zeus.id)?.[0].label === 'Line manager' && goes(null)?.[0].people[0].id === P.boss.user.id);
    const sub = await call(S.emp, 'POST', '/timesheets/submit', { scope: 'all', note: 'Release week' });
    check('Submit sends every unsent day', sub.data?.days === 4 && sub.data.sent === 8, JSON.stringify(sub.body));
    const apoBlocks = await p.timesheetEntry.findMany({ where: { employeeId: P.emp.id, projectId: apollo.id } });
    check('Apollo blocks wait for the team lead (not the PM)', apoBlocks.every((b) => b.status === 'SUBMITTED' && b.approverIds.length === 1 && b.approverIds[0] === P.tl.user.id));
    check('Nothing left to send → 400', (await call(S.emp, 'POST', '/timesheets/submit', { scope: 'all' })).status === 400);
    check('Lead and line manager told; PM not', (await eventually(async () => (await p.notification.count({ where: { type: 'timesheet.submitted', userId: P.boss.user.id } })) === 1)) && (await p.notification.count({ where: { type: 'timesheet.submitted', userId: P.tl.user.id } })) === 1 && (await p.notification.count({ where: { type: 'timesheet.submitted', userId: P.boss.user.id } })) === 1 && (await p.notification.count({ where: { type: 'timesheet.submitted', userId: P.pm.user.id } })) === 0);
    check('Sent block can’t be edited → 400', (await call(S.emp, 'PUT', `/timesheets/blocks/${b1.data.id}`, { date: MON, startMin: 540, endMin: 700, projectId: apollo.id, description: 'x y' })).status === 400);
    check('…or deleted → 400', (await call(S.emp, 'DELETE', `/timesheets/blocks/${b1.data.id}`)).status === 400);
    check('Recall Thursday', (await call(S.emp, 'POST', '/timesheets/recall', { dates: [THU] })).data?.recalled === 3);
    check('Later: Submit sends just the rest (Thursday)', (await call(S.emp, 'POST', '/timesheets/submit', { scope: 'all' })).data?.dates?.join() === THU);

    // ── Approving
    check('Pending for lead: Mon + Thu', (await call(S.tl, 'GET', '/timesheets/pending-count')).data?.count === 2);
    check('Pending for line manager: Mon, Tue, Wed, Thu', (await call(S.boss, 'GET', '/timesheets/pending-count')).data?.count === 4);
    const grid = await call(S.tl, 'GET', `/timesheets/team?weekStart=${lastWeek}`);
    const row = grid.data?.people.find((r) => r.employee.id === P.emp.id);
    check('Team grid (lead): Monday waiting, only Apollo time is theirs', row?.cells[0].state === 'waiting' && row.cells[0].myMinutes === 180 && row.cells[0].minutes === 300 && row.waitingDays === 2, JSON.stringify(row?.cells.slice(0, 2)));
    check('Team grid: counts per filter + paging', grid.data?.counts?.all === grid.data.meta.total && grid.data.counts.waiting >= 1 && grid.data.meta.page === 1, JSON.stringify({ c: grid.data?.counts, m: grid.data?.meta }));
    const gw = await call(S.tl, 'GET', `/timesheets/team?weekStart=${lastWeek}&show=waiting&search=${P.emp.employeeId}`);
    check('Team grid: "waiting on me" + search', gw.data?.people.length === 1 && gw.data.people[0].employee.id === P.emp.id && gw.data.summary.waitingPeople === grid.data.summary.waitingPeople, JSON.stringify(gw.data?.meta));
    check('Team grid: unknown filter → 400', (await call(S.tl, 'GET', `/timesheets/team?weekStart=${lastWeek}&show=all-of-them`)).status === 400);
    check('Peer can’t see the week → 404', (await call(S.solo, 'GET', `/timesheets/weeks/${lastWeek}?employeeId=${P.emp.id}`)).status === 404);
    const asTl = await call(S.tl, 'GET', `/timesheets/weeks/${lastWeek}?employeeId=${P.emp.id}`);
    check('Lead opens the week: can decide Apollo, not the rest', asTl.data?.blocks.filter((b) => b.canDecide).every((b) => b.project?.id === apollo.id) && asTl.data.blocks.filter((b) => b.canDecide).length === 2);
    check('Peer approving by id → 403', (await call(S.solo, 'POST', '/timesheets/approve', { ids: [b1.data.id] })).status === 403);
    check('PM isn’t the approver when a lead is set → 403', (await call(S.pm, 'POST', '/timesheets/approve', { ids: [b1.data.id] })).status === 403);
    check('Own time → 403', (await call(S.emp, 'POST', '/timesheets/approve', { ids: [b1.data.id] })).status === 403);
    check('Send back needs a note → 400', (await call(S.tl, 'POST', '/timesheets/send-back', { ids: [b1.data.id], note: '' })).status === 400);
    const back = await call(S.tl, 'POST', '/timesheets/send-back', { ids: [b1.data.id], note: 'Split the tests out' });
    check('Lead sends one block back', back.data?.decided === 1 && (await p.timesheetEntry.findUnique({ where: { id: b1.data.id } })).status === 'REJECTED');
    check('Employee told why', await eventually(async () => (await p.notification.findFirst({ where: { userId: P.emp.user.id, type: 'timesheet.rejected' } }))?.body?.includes('Split the tests')));
    check('Week shows as sent back', (await call(S.emp, 'GET', '/timesheets?view=mine&status=REJECTED')).body.data?.length === 1);
    const w2 = await call(S.emp, 'GET', `/timesheets/weeks/${lastWeek}`);
    check('Monday: sent back, block editable with the note', w2.data?.days[0].status === 'back' && w2.data.blocks.find((b) => b.id === b1.data.id).canEdit && w2.data.blocks.find((b) => b.id === b1.data.id).decisionNote === 'Split the tests out');
    await call(S.emp, 'PUT', `/timesheets/blocks/${b1.data.id}`, { date: MON, startMin: 540, endMin: 660, projectId: apollo.id, description: 'Invoice API' });
    check('Fixed + resent: only that block goes', (await call(S.emp, 'POST', '/timesheets/submit', { scope: 'all' })).data?.sent === 1);
    const ap = await call(S.tl, 'POST', '/timesheets/approve', { employeeId: P.emp.id, dates: [MON, THU] });
    check('Lead approves Mon + Thu (their Apollo time only)', ap.data?.decided === 2, JSON.stringify(ap.body));
    check('Approve again → nothing waiting (400)', (await call(S.tl, 'POST', '/timesheets/approve', { employeeId: P.emp.id })).status === 400);
    const w3 = await call(S.emp, 'GET', `/timesheets/weeks/${lastWeek}`);
    check('Monday partly approved', w3.data?.days[0].status === 'partial');
    check('Line manager approves the rest in bulk', (await call(S.boss, 'POST', '/timesheets/approve', { employeeIds: [P.emp.id] })).data?.decided === 6);
    const w4 = await call(S.emp, 'GET', `/timesheets/weeks/${lastWeek}`);
    check('All approved; week approved', w4.data?.days.slice(0, 4).every((d) => d.status === 'approved') && (await p.timesheet.findFirst({ where: { employeeId: P.emp.id, weekStart: new Date(`${lastWeek}T00:00:00Z`) } })).status === 'APPROVED');
    check('Approved block locked → 400', (await call(S.emp, 'DELETE', `/timesheets/blocks/${b1.data.id}`)).status === 400);

    // ── No project: line manager; HR can approve anyone
    await block(S.solo, MON, 9, 17, null, 'Recruiting drive');
    await call(S.solo, 'POST', '/timesheets/submit', { scope: 'all' });
    const soloBlock = await p.timesheetEntry.findFirst({ where: { employeeId: P.solo.id } });
    check('Not on a project → line manager', soloBlock.approverIds[0] === P.boss.user.id && soloBlock.approverLabel === 'Line manager');
    check('HR (company scope) can approve anyone', (await call(S.hr, 'POST', '/timesheets/approve', { ids: [soloBlock.id] })).data?.decided === 1);

    // ── Nudge
    check('Lead nudges someone they lead', (await call(S.tl, 'POST', `/timesheets/nudge/${P.emp.id}`)).data?.sent === true);
    check('Peer can’t nudge → 403', (await call(S.solo, 'POST', `/timesheets/nudge/${P.emp.id}`)).status === 403);

    // ── Team views
    const comp = await call(S.boss, 'GET', `/timesheets/compliance?weekStart=${lastWeek}`);
    check('Compliance: manager + reports with status', comp.body.data?.length === 5 && comp.body.data.find((r) => r.employee.id === P.tl.id).timesheet === null && comp.body.data.find((r) => r.employee.id === P.emp.id).timesheet.status === 'APPROVED');
    const missing = await call(S.boss, 'GET', `/timesheets/compliance?weekStart=${lastWeek}&status=missing`);
    check('Compliance filter: missing (in the DB)', missing.body.meta?.total === 3);

    // ── Reminders (direct, with fake clocks)
    const { TimesheetRemindersService } = require(path.resolve('dist/apps/api/src/modules/timesheets/timesheet-reminders.service.js'));
    const notifications = {
      notify: async (n) => {
        let c = 0;
        for (const u of n.userIds) {
          if (n.dedupeKey && (await p.notification.count({ where: { userId: u, dedupeKey: n.dedupeKey } }))) continue;
          await p.notification.create({ data: { companyId: n.companyId, userId: u, type: n.type, title: n.title, dedupeKey: n.dedupeKey ?? null } });
          c++;
        }
        return c;
      },
    };
    const entitlements = { forCompany: async () => ({ features: new Set(['work.timesheets']) }) };
    const rem = new TimesheetRemindersService(p, notifications, entitlements, { get: () => 'false' });
    const monday = new Date(`${thisWeek}T05:30:00Z`); // 11:00 IST
    const n1 = await rem.run(monday, company.id);
    check('Monday: tl and pm (on Apollo, nothing sent)', n1 === 2 && (await p.notification.count({ where: { companyId: company.id, type: 'timesheet.reminder', dedupeKey: `timesheet-missing:${lastWeek}` } })) === 2, String(n1));
    check('Monday reminder not repeated', (await rem.run(monday, company.id)) === 0);
    check('No reminder before 10:00', (await rem.run(new Date(`${thisWeek}T03:00:00Z`), company.id)) === 0);
    // Evening: tl checked in today and logged nothing
    await p.attendanceRecord.create({ data: { companyId: company.id, employeeId: P.tl.id, date: new Date(`${today}T00:00:00Z`), checkIn: new Date(`${today}T04:00:00Z`) } });
    await rem.run(new Date(`${today}T13:00:00Z`), company.id); // 18:30 IST
    check('Evening: checked in, nothing logged → reminded once', (await p.notification.count({ where: { userId: P.tl.user.id, dedupeKey: `timesheet-today:${today}` } })) === 1 && (await p.notification.count({ where: { userId: P.pm.user.id, dedupeKey: `timesheet-today:${today}` } })) === 0);
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
