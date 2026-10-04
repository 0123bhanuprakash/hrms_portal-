// Super Admin → Plans: usage per plan, custom switches & trials, upgrade candidates, "who's affected" preview, history.
const bcrypt = require('bcryptjs');
const { prisma: p, suite, call, login, makeCompany, dropCompany } = require('./lib');

const A = 'plans-insights-e2e-a';
const SA_EMAIL = 'sa-plans-e2e@platform.test';
const PW = 'Sa-Plans-2026!';
const PLAN_KEY = 'e2e-small';
const t = suite('plans-insights');
const { check } = t;

async function dropPlan() {
  const plan = await p.plan.findUnique({ where: { key: PLAN_KEY } });
  if (!plan) return;
  await p.auditLog.deleteMany({ where: { resourceType: 'plan', resourceId: plan.id } });
  await p.company.updateMany({ where: { planId: plan.id }, data: { planId: null } });
  await p.plan.delete({ where: { id: plan.id } });
}

(async () => {
  await dropCompany(A);
  await dropPlan();
  await p.user.deleteMany({ where: { email: SA_EMAIL } });
  try {
    await p.user.create({ data: { email: SA_EMAIL, passwordHash: await bcrypt.hash(PW, 10), firstName: 'Plan', lastName: 'Owner', isSuperAdmin: true, status: 'ACTIVE', emailVerifiedAt: new Date() } });
    const SA = await login(SA_EMAIL, PW);
    const a = await makeCompany(A, [['admin', ['employee', 'company_admin']], ['emp', ['employee']]]);

    // A small plan with two employees allowed; company A (2 employees) goes on it
    let r = await call(SA, 'POST', '/admin/plans', { name: 'E2E Small', key: PLAN_KEY, features: ['time.attendance', 'time.leave'], limits: { maxEmployees: 2 } });
    const planId = r.data?.id;
    check('Create a plan', r.status === 201 && planId, JSON.stringify(r.body));
    r = await call(SA, 'PUT', `/admin/companies/${a.company.id}/plan`, { planId });
    check('Move the company onto it', r.status === 200);

    // A leave request so "used it" has something to count
    await p.leaveType.findFirst({ where: { companyId: a.company.id } }).then(async (lt) => {
      const type = lt ?? (await p.leaveType.create({ data: { companyId: a.company.id, name: 'Casual', code: 'CL', category: 'CASUAL' } }));
      await p.leaveRequest.create({ data: { companyId: a.company.id, employeeId: a.people.emp.id, leaveTypeId: type.id, startDate: new Date(), endDate: new Date(), totalDays: 1, reason: 'e2e' } });
    });

    // A trial of Kudos ending in 5 days (outside the plan)
    const ends = new Date(Date.now() + 5 * 86_400_000).toISOString();
    r = await call(SA, 'PUT', `/admin/companies/${a.company.id}/features/engage.kudos`, { mode: 'ON', reason: 'Trial', expiresAt: ends });
    check('Start a feature trial', r.status === 200, JSON.stringify(r.body));

    check('Company admins can’t see plan insights → 403', (await call(a.sessions.admin, 'GET', '/admin/plans/overview')).status === 403);
    r = await call(SA, 'GET', '/admin/plans/overview');
    const row = r.data?.plans?.find((x) => x.id === planId);
    check('Overview: per-plan employees and companies', r.status === 200 && row?.employees === 2 && row.companies.some((c) => c.id === a.company.id), JSON.stringify(row));
    check('Overview: near-limit count', row?.nearLimit === 1);
    check('Overview: feature use', row?.featureUse?.['time.leave'] === 100 && row.featureUse['time.attendance'] === 0, JSON.stringify(row?.featureUse));
    check('Overview: trial listed and counted', r.data.switches.some((s) => s.company.id === a.company.id && s.featureKey === 'engage.kudos' && s.mode === 'ON') && r.data.totals.trialsEndingSoon >= 1);
    const cand = r.data.candidates.find((c) => c.company.id === a.company.id);
    check('Overview: upgrade candidate with reasons', cand?.employees === 2 && cand.limit === 2 && cand.extras.some((x) => x.key === 'engage.kudos'), JSON.stringify(cand));

    // Preview: dropping Leave and lowering the limit
    r = await call(SA, 'POST', `/admin/plans/${planId}/impact`, { features: ['time.attendance'], limits: { maxEmployees: 1 } });
    const hit = r.data?.companies?.find((c) => c.company.id === a.company.id);
    check('Impact: removed features listed', r.status === 200 && r.data.removed.some((f) => f.key === 'time.leave'), JSON.stringify(r.body));
    check('Impact: company loses Leave, with its use', hit?.loses?.some((f) => f.key === 'time.leave' && f.uses === 1), JSON.stringify(hit));
    check('Impact: over the new limit', hit?.overLimit === true);
    r = await call(SA, 'POST', `/admin/plans/${planId}/impact`, { features: ['time.attendance', 'time.leave'] });
    check('Impact: no change → nobody affected', r.status === 200 && r.data.companies.length === 0 && r.data.removed.length === 0);
    check('Impact: unknown feature → 400', (await call(SA, 'POST', `/admin/plans/${planId}/impact`, { features: ['nope'] })).status === 400);

    // Save and read the history
    r = await call(SA, 'PUT', `/admin/plans/${planId}`, { name: 'E2E Small', features: ['time.attendance'], limits: { maxEmployees: 3 } });
    check('Save records limit changes', r.status === 200 && r.data?.changes?.limits?.maxEmployees?.join() === '2,3', JSON.stringify(r.data?.changes));
    await new Promise((res) => setTimeout(res, 300)); // audit writes are fire-and-forget
    r = await call(SA, 'GET', `/admin/plans/${planId}/history`);
    const latest = r.data?.[0];
    check('History: newest change first', r.status === 200 && latest?.removed?.includes('Leave') && latest.limits?.maxEmployees?.join() === '2,3' && latest.by === 'Plan Owner', JSON.stringify(r.data));
    check('History: creation recorded', r.data?.some((h) => h.action === 'plan:create'));
    check('History: unknown plan → 404', (await call(SA, 'GET', '/admin/plans/00000000-0000-4000-8000-000000000000/history')).status === 404);
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    await dropCompany(A);
    await dropPlan();
    await p.auditLog.deleteMany({ where: { user: { email: SA_EMAIL } } });
    await p.user.deleteMany({ where: { email: SA_EMAIL } });
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
