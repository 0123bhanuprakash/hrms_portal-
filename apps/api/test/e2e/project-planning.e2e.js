// Project planning without hours: health (milestones, dates, staffing, PM
// updates), milestones, open roles, activity, client vs internal billing with
// the per-person "not billed" switch, timeline, planner, available, my projects.
const path = require('path');
const { prisma: p, suite, call, makeCompany, dropCompany, todayIn, addDays } = require('./lib');
const dist = (m) => require(path.resolve('dist/apps/api/src/modules', m));
const { ProjectPlanningService } = dist('projects/planning.service.js');
const { ProjectsService } = dist('projects/projects.service.js');
const { NotificationsService } = dist('notifications/notifications.service.js');

const SLUG = 'project-planning-e2e';
const t = suite('project-planning');
const { check } = t;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const D = (k) => new Date(`${k}T00:00:00Z`);

(async () => {
  await dropCompany(SLUG);
  try {
    const today = todayIn();
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['pmo', ['employee', 'pmo']],
      ['pm', ['employee']],
      ['ana', ['employee']],
      ['ben', ['employee']],
      ['cara', ['employee']],
    ]);
    const cid = company.id;
    await p.employee.updateMany({ where: { companyId: cid }, data: { joiningDate: D(addDays(today, -400)) } });
    const notes = (who, type) => p.notification.count({ where: { userId: P[who].user.id, type } });

    // ── Projects: client (billable) and internal (investment) ──
    let r = await call(S.pmo, 'POST', '/projects', { name: 'Atlas', code: 'ATL', clientName: 'Northwind', type: 'CLIENT', color: '#4F46E5', startDate: addDays(today, -60), endDate: addDays(today, 90) });
    check('Create a client project', r.status === 201 && r.data.id, JSON.stringify(r.body).slice(0, 200));
    const atl = r.data.id;
    r = await call(S.pmo, 'POST', '/projects', { name: 'HR portal', code: 'INT', type: 'INTERNAL', startDate: addDays(today, -60), endDate: addDays(today, 120) });
    const int = r.data.id;
    check('Bad colour → 400', (await call(S.pmo, 'POST', '/projects', { name: 'X', code: 'XX', color: 'blue', startDate: today })).status === 400);
    const start = addDays(today, -60);
    const ends = { [atl]: addDays(today, 90), [int]: addDays(today, 120) };
    const add = (proj, who, role, allocation, extra = {}) => call(S.pmo, 'POST', `/projects/${proj}/members`, { employeeId: P[who].id, role, allocation, startDate: start, endDate: ends[proj], ...extra });
    await add(atl, 'pm', 'MANAGER', 60);
    await add(int, 'pm', 'MANAGER', 40);
    await add(atl, 'ana', 'MEMBER', 50);
    await add(int, 'ana', 'MEMBER', 50);
    r = await add(atl, 'ben', 'MEMBER', 50, { billed: false });
    check('Add someone as not billed (shadow)', r.status === 201 && r.data.billed === false, JSON.stringify(r.body).slice(0, 200));
    const benMember = r.data.id;

    // ── Billing split from allocations ──
    r = await call(S.pmo, 'GET', '/projects/summary');
    const b = r.data?.billing;
    // 5 people = 500%: billable pm 60 + ana 50 = 110 · investment pm 40 + ana 50 + ben 50 = 140 · bench 250
    check('Company split: billable / investment / bench', b?.billablePct === 22 && b.investmentPct === 28 && b.benchPct === 50 && b.bench === 2 && b.onProjects === 3, JSON.stringify(b));
    r = await call(S.ana, 'GET', `/projects/billing/${P.ana.id}`);
    check('Person split (ana 50/50)', r.data?.billable === 50 && r.data.investment === 50 && r.data.bench === 0, JSON.stringify(r.data));
    r = await call(S.pmo, 'GET', `/projects/billing/${P.ben.id}`);
    check('Not billed counts as investment (ben)', r.data?.billable === 0 && r.data.investment === 50 && r.data.bench === 50, JSON.stringify(r.data));
    check('Billed switch: PM can’t', (await call(S.pm, 'PUT', `/projects/${atl}/members/${benMember}/billed`, { billed: true })).status === 403);

    // ── Health ──
    r = await call(S.pmo, 'GET', '/projects');
    let atlRow = r.data?.find((x) => x.id === atl);
    check('List: type, health, timePct, update overdue', atlRow?.type === 'CLIENT' && atlRow.health.level === 'on_track' && atlRow.health.updateOverdue === true && atlRow.timePct === 40 && atlRow.billedCount === 2, JSON.stringify(atlRow).slice(0, 300));
    check('Milestone: employee can’t add', (await call(S.ana, 'POST', `/projects/${atl}/milestones`, { title: 'API complete', dueDate: addDays(today, -10) })).status === 403);
    check('Milestone: before the project → 400', (await call(S.pm, 'POST', `/projects/${atl}/milestones`, { title: 'Too early', dueDate: addDays(today, -90) })).status === 400);
    r = await call(S.pm, 'POST', `/projects/${atl}/milestones`, { title: 'API complete', dueDate: addDays(today, -10), ownerEmployeeId: P.ana.id });
    check('PM adds a milestone', r.status === 201, JSON.stringify(r.body));
    const api = r.data.id;
    atlRow = (await call(S.pmo, 'GET', '/projects?health=off_track')).data?.find((x) => x.id === atl);
    check('Milestone 10 days late → off track', atlRow?.health.level === 'off_track' && atlRow.health.reasons.some((x) => x.includes('10 days late')), JSON.stringify(atlRow?.health));
    check('Owner can’t rename it', (await call(S.ana, 'PATCH', `/projects/${atl}/milestones/${api}`, { title: 'Renamed' })).status === 403);
    r = await call(S.ana, 'PATCH', `/projects/${atl}/milestones/${api}`, { done: true });
    check('Owner ticks it done', r.status === 200);
    await call(S.pm, 'POST', `/projects/${atl}/milestones`, { title: 'UAT sign-off', dueDate: addDays(today, 3) });
    atlRow = (await call(S.pmo, 'GET', '/projects')).data?.find((x) => x.id === atl);
    check('Milestone due in 3 days → at risk; next milestone', atlRow?.health.level === 'at_risk' && atlRow.milestones.done === 1 && atlRow.milestones.total === 2 && atlRow.milestones.next.title === 'UAT sign-off', JSON.stringify(atlRow?.milestones));
    r = await call(S.pm, 'POST', `/projects/${atl}/roles`, { title: 'QA engineer', allocation: 50, fromDate: addDays(today, 5) });
    check('Open a role', r.status === 201);
    const role = r.data.id;
    atlRow = (await call(S.pmo, 'GET', '/projects')).data?.find((x) => x.id === atl);
    check('Open role shows as a reason', atlRow?.openRoles === 1 && atlRow.health.reasons.includes('Open role: QA engineer'));
    r = await call(S.pm, 'POST', `/projects/${atl}/updates`, { health: 'on_track', note: 'UAT starts Monday — we are fine.' });
    check('PM posts an update', r.status === 201);
    await wait(300);
    check('The team hears about it', (await notes('ana', 'project.update')) === 1 && (await notes('pm', 'project.update')) === 0);
    atlRow = (await call(S.pmo, 'GET', '/projects')).data?.find((x) => x.id === atl);
    check('PM update overrides the computed health (with note)', atlRow?.health.level === 'on_track' && atlRow.health.computed === 'at_risk' && atlRow.health.override?.note.startsWith('UAT') && atlRow.health.updateOverdue === false);
    check('Employee can’t post updates', (await call(S.ana, 'POST', `/projects/${atl}/updates`, { health: 'off_track', note: 'Nope' })).status === 403);
    check('Bad health value → 400', (await call(S.pm, 'POST', `/projects/${atl}/updates`, { health: 'green', note: 'x x x' })).status === 400);

    // ── Detail ──
    r = await call(S.pm, 'GET', `/projects/${atl}`);
    const kinds = (r.data?.activity ?? []).map((e) => e.kind);
    check('Detail: milestones, updates, roles, activity, canPlan', r.data?.milestones.length === 2 && r.data.updates.length === 1 && r.data.openRoles.length === 1 && kinds.includes('created') && kinds.includes('member_added') && kinds.includes('milestone_done') && kinds.includes('update') && r.data.canPlan === true && r.data.canManage === false, JSON.stringify(kinds));
    r = await call(S.ana, 'GET', `/projects/${atl}`);
    check('Detail: employee can’t plan', r.data?.canPlan === false && r.data.updates[0].author.firstName === 'pm');

    // ── Timeline, planner, available ──
    r = await call(S.pmo, 'GET', '/projects/timeline');
    check('Timeline: projects, milestones, overlaps', r.status === 200 && r.data.projects.length === 2 && r.data.projects.find((x) => x.id === atl).milestoneList.length >= 1 && r.data.overlaps.some((o) => o.employee.id === P.ana.id && o.projects.length === 2), JSON.stringify(r.data?.overlaps).slice(0, 300));
    check('Planner: PMO only', (await call(S.pm, 'GET', '/projects/planner')).status === 403);
    r = await call(S.pmo, 'GET', '/projects/planner?weeks=4');
    const row = (who) => r.data?.people.find((x) => x.employee.id === P[who].id);
    check('Planner: weekly cells with billable split', r.status === 200 && r.data.weeks.length === 4 && row('ana').cells[0].total === 100 && row('ana').cells[0].billable === 50 && row('ben').cells[0].investment === 50 && row('cara').cells[0].total === 0, JSON.stringify(row('ana')?.cells[0]));
    check('Planner: counts and open-role suggestions', r.data.counts.full === 2 && r.data.counts.free === 2 && r.data.suggestions[0]?.role.title === 'QA engineer' && r.data.suggestions[0].candidates.some((c) => c.employee.id === P.cara.id), JSON.stringify(r.data.counts));
    r = await call(S.pmo, 'GET', `/projects/available?from=${today}&to=${addDays(today, 28)}&min=50`);
    const free = (r.data ?? []).map((x) => x.employee.firstName).sort().join();
    check('Find someone free (≥50%)', free === 'ben,cara,pmo', free);

    // ── Who sees what ──
    r = await call(S.cara, 'GET', '/projects');
    check('Not on any project: names only', r.status === 200 && r.data.length === 2 && r.data.every((x) => x.limited === true && x.health === undefined && x.team === undefined && x.startDate === undefined && x.managers === undefined) && r.data[0].name, JSON.stringify(r.data?.[0]));
    r = await call(S.ana, 'GET', '/projects');
    check('On the project: full details', r.data?.filter((x) => !x.limited).length === 2);
    r = await call(S.cara, 'GET', `/projects/${atl}`);
    check('Project page for an outsider: basics only', r.status === 200 && r.data.limited === true && r.data.members === undefined && r.data.milestones === undefined && r.data.name === 'Atlas', JSON.stringify(r.data));
    check('Outsider: health filter finds nothing hidden', (await call(S.cara, 'GET', '/projects?health=on_track')).data?.length === 0);
    check('Summary: PMO only', (await call(S.cara, 'GET', '/projects/summary')).status === 403);
    check('Timeline: PMO only', (await call(S.ana, 'GET', '/projects/timeline')).status === 403);
    check('Someone else’s projects: 403', (await call(S.cara, 'GET', `/projects/capacity/${P.ana.id}`)).status === 403 && (await call(S.cara, 'GET', `/projects/billing/${P.ana.id}`)).status === 403);
    check('My own projects / billing: fine', (await call(S.ana, 'GET', `/projects/capacity/${P.ana.id}`)).status === 200 && (await call(S.ana, 'GET', `/projects/billing/${P.ana.id}`)).status === 200);

    // ── Type change keeps history ──
    await call(S.pmo, 'PUT', `/projects/${atl}/members/${benMember}/billed`, { billed: true });
    r = await call(S.pmo, 'PATCH', `/projects/${atl}`, { name: 'Atlas', code: 'ATL', clientName: 'Northwind', type: 'INTERNAL', startDate: addDays(today, -60), endDate: addDays(today, 90) });
    check('PMO changes the type', r.status === 200);
    r = await call(S.pmo, 'GET', '/projects/summary');
    check('Now: no billable work · a month ago: still billable', r.data?.billing.billablePct === 0 && r.data.billingLastMonth.billablePct === 32, JSON.stringify({ now: r.data?.billing.billablePct, before: r.data?.billingLastMonth.billablePct }));
    check('Type change is in the activity', (await call(S.pmo, 'GET', `/projects/${atl}`)).data?.activity.some((e) => e.kind === 'type'));

    // ── My projects ──
    const lt = await p.leaveType.create({ data: { companyId: cid, name: 'Casual', code: 'CL', category: 'CASUAL' } });
    await p.leaveRequest.create({ data: { companyId: cid, employeeId: P.ben.id, leaveTypeId: lt.id, startDate: D(today), endDate: D(today), totalDays: 1, reason: 'x', status: 'APPROVED' } });
    r = await call(S.ana, 'GET', '/projects/my-overview');
    const a1 = r.data?.assignments.find((x) => x.project.id === atl);
    check('My projects: approver, last update, billing', r.data?.assignments.length === 2 && a1.approver.firstName === 'pm' && a1.approver.as === 'Project manager' && a1.lastUpdate.health === 'on_track' && r.data.billing.investment === 100, JSON.stringify(a1?.approver));
    check('My projects: coming milestones, who’s away', r.data.milestones[0]?.title === 'UAT sign-off' && r.data.away.some((x) => x.employee.id === P.ben.id), JSON.stringify(r.data.away));
    check('Detail: away today', (await call(S.pm, 'GET', `/projects/${atl}`)).data?.awayToday.includes(P.ben.id));
    r = await call(S.pm, 'PUT', `/projects/${atl}/roles/${role}?filled=true`);
    check('Fill the open role', r.status === 200 && (await p.projectOpenRole.findUnique({ where: { id: role } })).filledAt !== null);

    // ── Reminder: no update for 14 days ──
    const job = new ProjectPlanningService(p, new ProjectsService(p), new NotificationsService(p, { queueNotification: async () => undefined }, { get: () => undefined }), { get: () => undefined });
    await job.remindUpdates();
    await wait(300);
    check('PM reminded about the internal project (no update)', (await notes('pm', 'project.update_due')) === 1);
    await job.remindUpdates();
    await wait(200);
    check('…once a week', (await notes('pm', 'project.update_due')) === 1);
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
