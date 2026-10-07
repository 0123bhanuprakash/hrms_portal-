// resource requests & releases (Lead → PM → Delivery Director → PMO): run with test/e2e/run.js.
const { prisma: p, suite, call, makeCompany, dropCompany, todayIn, addDays, wait } = require('./lib');

const SLUG = 'resources-e2e';
const { check, done } = suite('resources');
const today = todayIn();
const start = addDays(today, 7);

(async () => {
  await dropCompany(SLUG);
  try {
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['admin', ['company_admin']],
      ['pmo', ['employee', 'pmo']],
      ['dd', ['employee']],
      ['pm', ['employee']],
      ['pm2', ['employee']],
      ['lead', ['employee']],
      ['dev', ['employee']],
      ['kavya', ['employee']],
      ['oscar', ['employee']],
      ['free', ['employee']],
      ['pmolead', ['employee']],
    ]);
    const cid = company.id;
    const notes = (who, where = {}) => p.notification.count({ where: { userId: P[who].user.id, ...where } });

    // "PMO lead" role, made by hand (as the user will in Roles & permissions)
    const perm = await p.permission.findUniqueOrThrow({ where: { key: 'project.pmo_lead' } });
    const view = await p.permission.findUniqueOrThrow({ where: { key: 'project.view' } });
    const role = await p.role.create({ data: { companyId: cid, key: 'pmo_lead_custom', name: 'PMO lead', rolePermissions: { create: [{ permissionId: perm.id }, { permissionId: view.id }] } } });
    await p.userRole.create({ data: { userId: P.pmolead.user.id, roleId: role.id, companyId: cid } });

    // ── Projects with people in charge (PM booked at 30% by default, DD a setting)
    const mk = async (code, name, pm) => call(S.pmo, 'POST', '/projects', { name, code, startDate: today, managerEmployeeId: P[pm].id, deliveryDirectorId: P.dd.id });
    const atlas = await mk('ATL', 'Atlas', 'pm');
    check('PMO creates Atlas with a PM and a Delivery Director', atlas.status === 201 && atlas.data.deliveryDirector?.id === P.dd.id, JSON.stringify(atlas.body).slice(0, 300));
    const atlasPm = atlas.data?.members?.find((m) => m.role === 'MANAGER');
    check('Picking the PM books 30% of their time', atlasPm?.employee.id === P.pm.id && atlasPm.allocation === 30, JSON.stringify(atlasPm));
    const helix = await mk('HLX', 'Helix', 'pm2');
    const orion = await mk('ORN', 'Orion', 'pm');
    const A = atlas.data.id, H = helix.data.id, O = orion.data.id;
    const add = (proj, who, role, allocation, extra = {}) => call(S.pmo, 'POST', `/projects/${proj}/members`, { employeeId: P[who].id, role, allocation, startDate: today, ...extra });
    check('One PM per project: a second PM → 409', (await add(A, 'pm2', 'MANAGER', 10)).status === 409);
    await add(A, 'lead', 'TEAM_LEAD', 100);
    const devM = await add(A, 'dev', 'MEMBER', 100, { leadEmployeeId: P.lead.id });
    const kavM = await add(H, 'kavya', 'MEMBER', 100);
    await add(O, 'oscar', 'MEMBER', 50);
    check('Team set up', devM.status === 201 && kavM.status === 201, `${devM.status} ${kavM.status}`);

    // ── Tech stack (leads) and skills (the person)
    check('Lead sets Atlas tech stack', (await call(S.lead, 'PUT', `/projects/${A}/tech-stack`, { techStack: ['React', 'Node.js', 'react'] })).data?.techStack?.length === 2);
    check('A member can’t change the tech stack → 403', (await call(S.dev, 'PUT', `/projects/${A}/tech-stack`, { techStack: ['X'] })).status === 403);
    check('Kavya adds her own skills', (await call(S.kavya, 'PUT', `/employees/${P.kavya.id}/skills`, { skills: ['React', 'TypeScript'] })).data?.skills?.length === 2);
    check('Someone else can’t edit her skills → 404/403', [403, 404].includes((await call(S.dev, 'PUT', `/employees/${P.kavya.id}/skills`, { skills: ['X'] })).status));

    // ── PMO reporting: "free" reports to the PMO → leave goes to the PMO lead
    const pmoFree = await call(S.admin, 'PATCH', `/employees/${P.free.id}`, { reportsToPmo: true });
    check('Admin sets "reports to the PMO"', pmoFree.status === 200, JSON.stringify(pmoFree.body).slice(0, 200));
    const types = (await call(S.free, 'GET', '/leave/types')).data ?? [];
    const cl = types.find((t) => t.code === 'CL') ?? types[0];
    const prev = await call(S.free, 'POST', '/leave/requests/preview', { leaveTypeId: cl?.id, startDate: addDays(today, 20), endDate: addDays(today, 20) });
    const lvl = prev.data?.route?.levels?.[0] ?? prev.data?.levels?.[0];
    check('Their leave goes to the PMO lead', lvl?.label === 'PMO lead' && (lvl.approvers ?? []).some((a) => a.id === P.pmolead.user.id), JSON.stringify(prev.data?.route ?? prev.data).slice(0, 300));

    // ── Request: Lead → PM
    const body = { projectId: A, title: 'React developer', skills: ['React'], allocation: 50, fromDate: start, reason: 'Payments screens need another pair of hands', preferredEmployeeId: P.free.id };
    check('A member can’t request people → 403', (await call(S.dev, 'POST', '/resources/requests', body)).status === 403);
    const r1 = await call(S.lead, 'POST', '/resources/requests', body);
    check('Lead raises a request → waits for the PM', r1.status === 201 && r1.data.step === 'PM' && r1.data.status === 'OPEN', JSON.stringify(r1.body).slice(0, 300));
    const id1 = r1.data.id;
    check('PM sees it waiting (badge 1)', (await call(S.pm, 'GET', '/resources/requests/count')).data?.count === 1);
    check('Delivery Director has nothing yet', (await call(S.dd, 'GET', '/resources/requests/count')).data?.count === 0);
    check('The preferred person isn’t told', (await notes('free', { type: { startsWith: 'resource' } })) === 0);

    // Hold → unhold
    check('Hold needs a reason → 400', (await call(S.pm, 'POST', `/resources/requests/${id1}/hold`, {})).status === 400);
    const held = await call(S.pm, 'POST', `/resources/requests/${id1}/hold`, { reason: 'Waiting for the client budget', remindAt: addDays(today, 3) });
    check('PM puts it on hold', held.data?.status === 'ON_HOLD' && held.data.hold?.reason === 'Waiting for the client budget', JSON.stringify(held.body).slice(0, 200));
    await wait(300);
    check('Lead told about the hold', (await notes('lead', { type: 'resource.hold' })) === 1);
    check('Can’t approve while on hold → 409', (await call(S.pm, 'POST', `/resources/requests/${id1}/forward`, {})).status === 409);
    check('PM unholds', (await call(S.pm, 'POST', `/resources/requests/${id1}/unhold`, { note: 'Budget approved' })).data?.status === 'OPEN');

    // PM can't assign someone not on their projects
    const notMine = await call(S.pm, 'POST', `/resources/requests/${id1}/fill`, { employeeId: P.free.id, allocation: 50 });
    check('PM can’t assign someone not on their projects → 403 (only the PMO)', notMine.status === 403 && /PMO/.test(notMine.body.detail ?? JSON.stringify(notMine.body)), JSON.stringify(notMine.body).slice(0, 200));
    const fwd = await call(S.pm, 'POST', `/resources/requests/${id1}/forward`, { note: 'Agree — nobody free on my side' });
    check('PM approves → Delivery Director', fwd.data?.step === 'DD', JSON.stringify(fwd.body).slice(0, 200));
    check('Delivery Director now sees it', (await call(S.dd, 'GET', '/resources/requests/count')).data?.count === 1);
    check('Lead can’t act on their own request → 403', (await call(S.lead, 'POST', `/resources/requests/${id1}/forward`, {})).status === 403);
    check('DD approves → PMO', (await call(S.dd, 'POST', `/resources/requests/${id1}/forward`, {})).data?.step === 'PMO');

    // PMO: candidates, lower % needs a note, taking time off another PM's project needs that PM
    const cands = await call(S.pmo, 'GET', `/resources/requests/${id1}/candidates`);
    check('Candidates: preferred person first', cands.data?.data?.[0]?.employee.id === P.free.id, JSON.stringify(cands.data?.data?.slice(0, 2)).slice(0, 300));
    const kav = cands.data?.data?.find((c) => c.employee.id === P.kavya.id);
    check('Kavya matches on React, 0% free', kav?.matchedSkills?.includes('React') && kav.free === 0, JSON.stringify(kav));
    check('Lower % without a note → 400', (await call(S.pmo, 'POST', `/resources/requests/${id1}/fill`, { employeeId: P.free.id, allocation: 40 })).status === 400);
    check('Over 100% → 400', (await call(S.pmo, 'POST', `/resources/requests/${id1}/fill`, { employeeId: P.kavya.id, allocation: 50 })).status === 400);
    const take = await call(S.pmo, 'POST', `/resources/requests/${id1}/fill`, { employeeId: P.kavya.id, allocation: 50, takeFrom: { memberId: kavM.data.id, allocation: 50 } });
    check('Taking her off Helix waits for Helix’s PM', take.data?.status === 'AWAITING_CONSENT' && take.data.pendingFill?.waitingFor?.id === P.pm2.user.id, JSON.stringify(take.body).slice(0, 300));
    check('Helix’s PM sees it waiting', (await call(S.pm2, 'GET', '/resources/requests/count')).data?.count === 1);
    const agree = await call(S.pm2, 'POST', `/resources/requests/${id1}/consent`, { agree: true, note: 'Fine from next week' });
    check('Helix’s PM agrees → filled', agree.data?.status === 'FILLED' && agree.data.filled?.employee?.id === P.kavya.id, JSON.stringify(agree.body).slice(0, 300));
    const kavRows = await p.projectMember.findMany({ where: { employeeId: P.kavya.id }, orderBy: { startDate: 'asc' } });
    check('Kavya: Atlas 50% + Helix 50% from the start date', kavRows.some((m) => m.projectId === A && m.allocation === 50) && kavRows.some((m) => m.projectId === H && m.allocation === 50), JSON.stringify(kavRows.map((m) => [m.projectId === A ? 'A' : 'H', m.allocation])));
    await wait(300);
    check('Kavya told only now she’s on Atlas', (await notes('kavya', { type: 'project.assigned' })) === 1);
    check('Lead told it’s filled', (await notes('lead', { type: 'resource.filled' })) === 1);
    const hist = await call(S.kavya, 'GET', `/resources/history/${P.kavya.id}`);
    check('Her assignment history: assigned (via the request) + Helix changed', hist.data?.data?.some((h) => h.action === 'assigned' && h.requestId === id1) && hist.data.data.some((h) => h.action === 'changed'), JSON.stringify(hist.data?.data?.map((h) => h.action)));
    check('A colleague can’t see her history → 404', (await call(S.dev, 'GET', `/resources/history/${P.kavya.id}`)).status === 404);
    const timeline = await call(S.lead, 'GET', `/resources/requests/${id1}`);
    check('Request history: raised, held, unheld, forwarded ×2, consent, filled', ['raised', 'held', 'unheld', 'forwarded', 'consent_asked', 'consent_given', 'filled'].every((k) => timeline.data?.events?.some((e) => e.kind === k)), JSON.stringify(timeline.data?.events?.map((e) => e.kind)));

    // ── Reject → raise again; withdraw
    const r2 = await call(S.lead, 'POST', '/resources/requests', { ...body, title: 'QA engineer', preferredEmployeeId: null });
    check('Reject needs a reason → 400', (await call(S.pm, 'POST', `/resources/requests/${r2.data.id}/reject`, {})).status === 400);
    const rej = await call(S.pm, 'POST', `/resources/requests/${r2.data.id}/reject`, { reason: 'QA is covered by the shared team' });
    check('PM rejects with a reason', rej.data?.status === 'REJECTED' && rej.data.outcomeNote === 'QA is covered by the shared team');
    const again = await call(S.lead, 'POST', '/resources/requests', { ...body, title: 'QA engineer', preferredEmployeeId: null, previousRequestId: r2.data.id });
    check('Lead raises it again (linked)', again.status === 201 && again.data.previousRequestId === r2.data.id && again.data.step === 'PM');
    check('Someone else can’t withdraw it → 403', (await call(S.pm, 'POST', `/resources/requests/${again.data.id}/withdraw`, {})).status === 403);
    check('Lead withdraws it', (await call(S.lead, 'POST', `/resources/requests/${again.data.id}/withdraw`, { note: 'Not needed after all' })).data?.status === 'WITHDRAWN');

    // ── PM fills directly from their own projects (Oscar is on Orion, PM's project)
    const r3 = await call(S.lead, 'POST', '/resources/requests', { ...body, title: 'Backend developer', allocation: 50, preferredEmployeeId: P.oscar.id });
    const direct = await call(S.pm, 'POST', `/resources/requests/${r3.data.id}/fill`, { employeeId: P.oscar.id, allocation: 50 });
    check('PM fills directly with someone on their project', direct.data?.status === 'FILLED', JSON.stringify(direct.body).slice(0, 200));

    // ── Release: Lead → PM / DD decide; PMO can only nudge
    const rel = await call(S.lead, 'POST', '/resources/releases', { memberId: devM.data.id, reason: 'Module done', lastDate: addDays(today, 10) });
    check('Lead asks to release Dev', rel.status === 201 && rel.data.kind === 'RELEASE', JSON.stringify(rel.body).slice(0, 200));
    await wait(300);
    check('Dev isn’t told yet', (await notes('dev', { type: { startsWith: 'resource' } })) === 0);
    check('A second release for the same assignment → 409', (await call(S.lead, 'POST', '/resources/releases', { memberId: devM.data.id, reason: 'again', lastDate: addDays(today, 10) })).status === 409);
    check('PMO can’t decide a release → 403', (await call(S.pmo, 'POST', `/resources/requests/${rel.data.id}/release-decision`, { outcome: 'pool' })).status === 403);
    const nudge = await call(S.pmo, 'POST', `/resources/requests/${rel.data.id}/nudge`);
    await wait(300);
    check('PMO nudges the PM and DD', nudge.status === 200 && (await notes('pm', { type: 'resource.nudge' })) === 1 && (await notes('dd', { type: 'resource.nudge' })) === 1);
    check('Keep needs a reason → 400', (await call(S.pm, 'POST', `/resources/requests/${rel.data.id}/release-decision`, { outcome: 'keep' })).status === 400);
    const move = await call(S.pm, 'POST', `/resources/requests/${rel.data.id}/release-decision`, { outcome: 'reassign', targetProjectId: O, allocation: 80 });
    check('PM moves Dev to Orion (their project)', move.data?.status === 'REASSIGNED', JSON.stringify(move.body).slice(0, 300));
    const devRows = await p.projectMember.findMany({ where: { employeeId: P.dev.id } });
    check('Dev: Atlas ends on the last day, Orion 80% the day after', devRows.some((m) => m.projectId === A && m.endDate?.toISOString().slice(0, 10) === addDays(today, 10)) && devRows.some((m) => m.projectId === O && m.allocation === 80 && m.startDate.toISOString().slice(0, 10) === addDays(today, 11)), JSON.stringify(devRows.map((m) => [m.projectId === A ? 'A' : 'O', m.allocation, m.startDate.toISOString().slice(0, 10), m.endDate?.toISOString().slice(0, 10)])));
    await wait(300);
    check('Dev told now (after the decision)', (await notes('dev', { type: 'project.assigned' })) === 1);

    const rel2 = await call(S.lead, 'POST', '/resources/releases', { memberId: (await p.projectMember.findFirst({ where: { employeeId: P.kavya.id, projectId: A } })).id, reason: 'Screens shipped', lastDate: addDays(today, 30) });
    const pool = await call(S.dd, 'POST', `/resources/requests/${rel2.data.id}/release-decision`, { outcome: 'pool', note: 'Great work' });
    check('Delivery Director sends Kavya to the PMO pool', pool.data?.status === 'RELEASED', JSON.stringify(pool.body).slice(0, 200));
    await wait(300);
    check('PMO told she joins the pool', (await notes('pmo', { type: 'resource.pool' })) === 1);

    const poolList = await call(S.pmo, 'GET', '/resources/pool');
    check('PMO pool lists the person who reports to the PMO', poolList.data?.data?.some((x) => x.employee.id === P.free.id && x.reportsToPmo), JSON.stringify(poolList.data?.counts));
    check('Only the PMO sees the pool → 403', (await call(S.lead, 'GET', '/resources/pool')).status === 403);
    const leadInbox = await call(S.lead, 'GET', '/resources/requests?view=mine');
    check('Lead’s “my requests” lists what they raised', leadInbox.body?.data?.length >= 5 && leadInbox.body.meta?.counts, JSON.stringify(leadInbox.body).slice(0, 400));
  } catch (err) {
    check('No crash', false, err.stack);
  } finally {
    await dropCompany(SLUG).catch((e) => console.log('cleanup failed', e.message));
    await p.$disconnect();
    process.exit(done() ? 0 : 1);
  }
})();
