// Employee lifecycle: stage counts and "needs attention", probation confirm /
// extend, notice → left, checklists, history, bulk changes, org chart + health,
// and who may see notice periods and leavers (HR only, plus the person).
const { B, prisma: p, suite, call, makeCompany, dropCompany, todayIn, addDays } = require('./lib');

const SLUG = 'lifecycle-e2e';
const t = suite('employee-lifecycle');
const { check } = t;
const D = (k) => new Date(`${k}T00:00:00Z`);

(async () => {
  await dropCompany(SLUG);
  try {
    const today = todayIn();
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['hr', ['employee', 'hr']],
      ['mgr', ['employee', 'manager']],
      ['ana', ['employee'], 'mgr'],
      ['ben', ['employee'], 'mgr'],
      ['cara', ['employee'], 'mgr'],
      ['dan', ['employee']],
      ['gus', ['employee']],
    ]);
    const cid = company.id;
    const eng = await p.department.create({ data: { companyId: cid, name: 'Engineering', code: 'ENG' } });
    await p.employee.updateMany({ where: { id: { in: [P.mgr.id, P.ana.id, P.ben.id] } }, data: { departmentId: eng.id } });
    // Ana: on probation, review in 10 days · Gus: joins next week
    await p.employee.update({ where: { id: P.ana.id }, data: { employmentStatus: 'PROBATION', confirmationDate: D(addDays(today, 10)) } });
    await p.employee.update({ where: { id: P.gus.id }, data: { joiningDate: D(addDays(today, 7)) } });

    // ── Stage counts and attention ──
    let r = await call(S.hr, 'GET', '/employees/lifecycle');
    const c = r.data?.counts;
    check('HR: counts per stage', r.status === 200 && c.all === 7 && c.joining === 1 && c.probation === 1 && c.active === 5 && c.notice === 0 && c.left === 0 && r.data.seesExits === true, JSON.stringify(r.body).slice(0, 300));
    const keys = (r.data?.attention ?? []).map((a) => a.key);
    check('HR: probation ending + no manager + incomplete profiles', keys.includes('probation') && keys.includes('no-manager') && keys.includes('profiles'), keys.join());
    check('No manager lists dan (not mgr, who leads people)', r.data.attention.find((a) => a.key === 'no-manager').people.some((x) => x.name === 'dan T') && !r.data.attention.find((a) => a.key === 'no-manager').people.some((x) => x.name === 'mgr T'));
    r = await call(S.mgr, 'GET', '/employees/lifecycle');
    const mk = (r.data?.attention ?? []).map((a) => a.key);
    check('Manager: sees their team’s probation, no exits', r.status === 200 && r.data.seesExits === false && r.data.counts.notice === null && r.data.counts.left === null && r.data.counts.probation === 1 && mk.includes('probation') && !mk.includes('no-manager') && !mk.includes('profiles'), JSON.stringify(r.body).slice(0, 300));
    r = await call(S.cara, 'GET', '/employees/lifecycle');
    check('Employee: just themselves, nothing to do', r.status === 200 && r.data.counts.all === 1 && r.data.attention.length === 0);

    // ── Probation ──
    check('Manager can’t confirm', [403, 404].includes((await call(S.mgr, 'POST', `/employees/${P.ana.id}/confirm`, {})).status));
    check('Extend: date must be ahead', (await call(S.hr, 'POST', `/employees/${P.ana.id}/extend-probation`, { until: today })).status === 400);
    r = await call(S.hr, 'POST', `/employees/${P.ana.id}/extend-probation`, { until: addDays(today, 40), note: 'More time on testing' });
    check('HR extends probation', r.status === 200 && r.data.confirmationDate === addDays(today, 40), JSON.stringify(r.body));
    r = await call(S.hr, 'POST', `/employees/${P.ana.id}/confirm`, {});
    check('HR confirms probation', r.status === 200 && r.data.employmentStatus === 'ACTIVE');
    check('Confirm twice → 400', (await call(S.hr, 'POST', `/employees/${P.ana.id}/confirm`, {})).status === 400);
    check('Ana is told', (await p.notification.count({ where: { userId: P.ana.user.id, type: 'employee.confirmed' } })) === 1);
    check('Nobody changes their own status', (await call(S.hr, 'POST', `/employees/${P.hr.id}/notice`, { lastDay: addDays(today, 30), reason: 'resigned' })).status === 403);
    r = await call(S.hr, 'GET', `/employees/${P.ana.id}/history`);
    const kinds = (r.data ?? []).map((x) => x.kind).join();
    check('History: joined, extended (with who), confirmed', r.status === 200 && kinds === 'joined,probation_extended,confirmed' && r.data[1].by === 'hr T' && r.data[1].note === 'More time on testing', kinds);

    // ── Notice period: who can see it ──
    check('Manager can’t start a notice period', (await call(S.mgr, 'POST', `/employees/${P.ben.id}/notice`, { lastDay: addDays(today, 20), reason: 'resigned' })).status === 403);
    check('Bad reason → 400', (await call(S.hr, 'POST', `/employees/${P.ben.id}/notice`, { lastDay: addDays(today, 20), reason: 'bored' })).status === 400);
    r = await call(S.hr, 'POST', `/employees/${P.ben.id}/notice`, { lastDay: addDays(today, 20), reason: 'resigned' });
    check('HR starts notice', r.status === 200 && r.data.employmentStatus === 'NOTICE_PERIOD');
    r = await call(S.hr, 'GET', `/employees/${P.ben.id}/checklist?kind=exit`);
    check('Exit checklist created (6 items)', r.status === 200 && r.data.length === 6);
    check('Manager can’t open checklists', (await call(S.mgr, 'GET', `/employees/${P.ben.id}/checklist?kind=exit`)).status === 403);
    r = await call(S.mgr, 'GET', '/employees?limit=50');
    const benM = r.data?.find((x) => x.firstName === 'ben');
    check('Manager list: Ben looks Active, no last day', benM?.employmentStatus === 'ACTIVE' && benM.terminationDate === null && benM.stage === 'active' && r.body.meta.seesExits === false, JSON.stringify(benM));
    check('Manager: stage=notice is empty', (await call(S.mgr, 'GET', '/employees?stage=notice')).data?.length === 0);
    check('Manager: status filter can’t find notice', (await call(S.mgr, 'GET', '/employees?status=NOTICE_PERIOD')).data?.length === 0);
    r = await call(S.mgr, 'GET', `/employees/${P.ben.id}`);
    check('Manager: Ben’s record hides the exit', r.data?.employmentStatus === 'ACTIVE' && !r.data.exitReason && !r.data.terminationDate);
    r = await call(S.mgr, 'GET', `/employees/${P.ben.id}/history`);
    check('Manager: history hides the notice', r.status === 200 && !r.data.some((x) => x.kind === 'notice' || x.title === 'Last day'));
    r = await call(S.ben, 'GET', `/employees/${P.ben.id}`);
    check('Ben sees his own notice period', r.data?.employmentStatus === 'NOTICE_PERIOD' && r.data.exitReason === 'resigned');
    r = await call(S.hr, 'GET', '/employees?stage=notice');
    check('HR: stage=notice', r.data?.length === 1 && r.data[0].checklist?.total === 6 && r.data[0].stage === 'notice');
    r = await call(S.mgr, 'GET', '/reports/people');
    check('Reports: manager gets no names of people leaving', r.status === 200 && Array.isArray(r.data.notice) && r.data.notice.length === 0, JSON.stringify(r.body).slice(0, 200));
    r = await call(S.hr, 'GET', '/reports/people');
    check('Reports: HR sees who is leaving', r.data?.notice?.length === 1);
    r = await call(S.cara, 'GET', '/org/chart');
    const benC = r.data?.employees?.find((x) => x.firstName === 'ben');
    check('Org chart (employee): Ben Active, Gus not there yet', benC?.employmentStatus === 'ACTIVE' && !r.data.employees.some((x) => x.firstName === 'gus'));
    r = await call(S.hr, 'GET', '/org/chart');
    check('Org chart (HR): notice shown, Gus flagged as joining', r.data?.employees?.find((x) => x.firstName === 'ben')?.employmentStatus === 'NOTICE_PERIOD' && r.data.employees.find((x) => x.firstName === 'gus')?.joinsOn === addDays(today, 7));

    r = await call(S.hr, 'POST', `/employees/${P.ben.id}/withdraw-notice`, { note: 'Changed his mind' });
    check('Withdraw notice → Active, checklist gone', r.status === 200 && r.data.employmentStatus === 'ACTIVE' && (await p.employeeChecklistItem.count({ where: { employeeId: P.ben.id } })) === 0);

    // ── Bulk ──
    check('Bulk: manager can’t', (await call(S.mgr, 'POST', '/employees/bulk', { ids: [P.cara.id], action: 'department', value: eng.id })).status === 403);
    r = await call(S.hr, 'POST', '/employees/bulk', { ids: [P.cara.id, P.dan.id], action: 'department', value: eng.id });
    check('Bulk: move two people to Engineering', r.status === 200 && r.data.updated === 2 && r.data.skipped.length === 0, JSON.stringify(r.body));
    r = await call(S.hr, 'POST', '/employees/bulk', { ids: [P.cara.id, P.hr.id], action: 'department', value: eng.id });
    check('Bulk: already set and self are skipped', r.data?.updated === 0 && r.data.skipped.length === 2);
    r = await call(S.hr, 'POST', '/employees/bulk', { ids: [P.cara.id], action: 'manager', value: P.dan.id });
    check('Bulk: change manager', r.data?.updated === 1 && (await p.employee.findUnique({ where: { id: P.cara.id } })).reportingManagerId === P.dan.id);
    check('Closure table follows', (await p.employeeHierarchy.count({ where: { ancestorId: P.dan.id, descendantId: P.cara.id } })) === 1);
    r = await call(S.hr, 'POST', '/employees/bulk', { ids: [P.dan.id], action: 'manager', value: P.cara.id });
    check('Bulk: a loop is skipped with a reason', r.data?.updated === 0 && r.data.skipped[0]?.reason.length > 0, JSON.stringify(r.body));
    r = await call(S.hr, 'POST', '/employees/bulk', { ids: [P.ana.id], action: 'remind' });
    check('Bulk: profile reminder', r.data?.updated === 1 && (await p.notification.count({ where: { userId: P.ana.user.id, type: 'profile.reminder' } })) === 1);
    r = await call(S.hr, 'GET', `/employees/${P.cara.id}/history`);
    const ch = (r.data ?? []).filter((x) => x.kind === 'manager' || x.kind === 'department');
    check('History records team and manager moves', ch.length === 2 && ch.some((x) => x.detail === 'mgr T → dan T'), JSON.stringify(ch));
    await call(S.hr, 'PATCH', `/employees/${P.cara.id}`, { employmentType: 'CONTRACT' });
    r = await call(S.hr, 'GET', `/employees/${P.cara.id}/history`);
    check('History records an edit (type)', r.data?.some((x) => x.kind === 'type' && x.detail === 'Full time → Contract'));
    check('PATCH: manager can’t set notice', (await call(S.mgr, 'PATCH', `/employees/${P.ben.id}`, { employmentStatus: 'NOTICE_PERIOD' })).status >= 403);

    // ── Leaving ──
    await call(S.hr, 'PATCH', `/employees/${P.dan.id}`, { reportingManagerId: P.ben.id });
    await call(S.hr, 'POST', `/employees/${P.ben.id}/notice`, { lastDay: addDays(today, 5), reason: 'resigned' });
    check('Left: last day still ahead → 400', (await call(S.hr, 'POST', `/employees/${P.ben.id}/left`, {})).status === 400);
    r = await call(S.hr, 'POST', `/employees/${P.ben.id}/left`, { lastDay: today });
    check('HR marks Ben as left', r.status === 200 && r.data.employmentStatus === 'TERMINATED');
    check('Manager: Ben is gone (404)', (await call(S.mgr, 'GET', `/employees/${P.ben.id}`)).status === 404);
    check('Manager list: Ben not listed', !(await call(S.mgr, 'GET', '/employees?limit=50')).data?.some((x) => x.firstName === 'ben'));
    r = await call(S.hr, 'GET', '/employees?stage=left');
    check('HR: stage=left', r.data?.length === 1 && r.data[0].firstName === 'ben' && r.data[0].exitReason === 'resigned');
    check('HR: default list leaves him out', !(await call(S.hr, 'GET', '/employees?limit=50')).data?.some((x) => x.firstName === 'ben'));
    r = await call(S.hr, 'GET', '/employees/lifecycle');
    check('HR: left in last 90 days = 1', r.data?.counts.left === 1);

    // ── Org health ──
    check('Org health needs org.manage', (await call(S.mgr, 'GET', '/org/health')).status === 403);
    r = await call(S.hr, 'GET', '/org/health');
    const hk = (r.data?.items ?? []).map((x) => x.key);
    check('Org health: reports to a leaver, no department head', r.status === 200 && hk.includes('manager-left') && hk.includes('no-head') && r.data.stats.headcount === 5, JSON.stringify(r.body).slice(0, 400));

    // ── Joining checklist, board, glance, export, next id ──
    r = await call(S.hr, 'GET', `/employees/${P.gus.id}/checklist?kind=joining`);
    check('Joining checklist (7 default items)', r.status === 200 && r.data.length === 7);
    r = await call(S.hr, 'PATCH', `/employees/${P.gus.id}/checklist/${r.data[0].id}`, { done: true });
    check('Tick an item (who + when)', r.data?.[0].doneAt && r.data[0].doneBy === 'hr T');
    r = await call(S.hr, 'POST', `/employees/${P.gus.id}/checklist`, { kind: 'joining', label: 'Parking pass' });
    check('Add an item', r.data?.length === 8 && r.data[7].label === 'Parking pass');
    r = await call(S.hr, 'GET', '/employees/board');
    const lane = (s) => r.data?.lanes.find((l) => l.stage === s);
    check('Board (HR): five lanes, Gus joining with checklist 1/8', r.data?.lanes.length === 5 && lane('joining').people[0]?.checklist?.done === 1 && lane('joining').people[0].checklist.total === 8 && lane('left').total === 1, JSON.stringify(lane('joining')));
    r = await call(S.mgr, 'GET', '/employees/board');
    check('Board (manager): no notice / left lanes', r.data?.lanes.map((l) => l.stage).join() === 'joining,probation,active');
    r = await call(S.hr, 'GET', `/employees/${P.ana.id}/glance`);
    check('Glance (HR): leave, attendance, projects, assets, profile', r.status === 200 && r.data.leave && r.data.attendance && r.data.projects && r.data.assets && r.data.completion?.percent >= 0, JSON.stringify(r.body));
    r = await call(S.cara, 'GET', `/employees/${P.ana.id}/glance`);
    check('Glance: outside reach → 404', r.status === 404);
    r = await call(S.hr, 'GET', '/employees?stage=all&limit=50');
    check('List: profile % for HR', r.data?.every((x) => typeof x.profilePercent === 'number'));
    r = await call(S.mgr, 'GET', '/employees?limit=50');
    check('List: no profile % for a manager (except self)', r.data?.filter((x) => x.firstName !== 'mgr').every((x) => x.profilePercent === null));
    const ex = await fetch(B + '/employees/export?stage=all', { headers: S.hr });
    const csv = await ex.text();
    check('Export (HR): CSV with last day', ex.status === 200 && csv.split('\n')[0].includes('Last day') && csv.includes('BEN,ben,T'), csv.slice(0, 200));
    check('Export needs employee.export', (await call(S.mgr, 'GET', '/employees/export')).status === 403);
    r = await call(S.hr, 'GET', '/employees/next-id');
    check('Next employee id', r.status === 200 && /^[A-Z]+\d{3,}$/.test(r.data.employeeId), JSON.stringify(r.body));

    // ── Create with probation ──
    check('New hire can’t start on notice', (await call(S.hr, 'POST', '/employees', { firstName: 'Zed', lastName: 'Q', email: `zed@${SLUG}.test`, joiningDate: today, employmentStatus: 'NOTICE_PERIOD' })).status === 400);
    r = await call(S.hr, 'POST', '/employees', { firstName: 'Zed', lastName: 'Q', email: `zed@${SLUG}.test`, joiningDate: addDays(today, 3), employmentStatus: 'PROBATION', confirmationDate: addDays(today, 183), departmentId: eng.id });
    check('Create on probation with an end date', r.status === 201 && r.data.employmentStatus === 'PROBATION' && r.data.confirmationDate?.startsWith(addDays(today, 183)), JSON.stringify(r.body).slice(0, 200));
    const zed = r.data;
    r = await call(S.hr, 'GET', `/employees/${zed.id}/history`);
    check('History: joined, added by HR, upcoming', r.data?.[0]?.kind === 'joined' && r.data[0].by === 'hr T' && r.data[0].upcoming === true, JSON.stringify(r.body).slice(0, 300));
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
