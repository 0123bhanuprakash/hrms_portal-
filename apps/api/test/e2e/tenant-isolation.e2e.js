// Access audit fixes (docs/audit/2026-10-11-api-access-audit.md):
//   #1–#2  a project office (PMO) or Company Admin of one company never reaches
//          another company's people on "someone's" project pages
//   #5, #7 the old org-chart route is gone; the company record, its settings and
//          the permission catalog stay with admins
const { suite, call, makeCompany, dropCompany, prisma: p } = require('./lib');

const A = 'tenant-iso-e2e-a';
const B = 'tenant-iso-e2e-b';
const t = suite('tenant-isolation');
const { check } = t;

(async () => {
  await dropCompany(A);
  await dropCompany(B);
  const a = await makeCompany(A, [['admin', ['company_admin', 'employee']]]);
  const b = await makeCompany(B, [['admin', ['company_admin', 'employee']], ['emp', ['employee'], 'admin']]);
  const other = b.people.emp.id;
  const missing = '00000000-0000-4000-8000-000000000000';

  for (const path of ['/resources/history', '/projects/billing', '/projects/capacity']) {
    const r = await call(a.sessions.admin, 'GET', `${path}/${other}`);
    check(`${path}: another company's admin → 404`, r.status === 404, `${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
    check(`${path}: nothing about the person in the answer`, !JSON.stringify(r.body).includes(b.people.emp.firstName), JSON.stringify(r.body).slice(0, 160));
    const own = await call(b.sessions.admin, 'GET', `${path}/${other}`);
    check(`${path}: their own company's admin still sees them`, own.status === 200, `${own.status} ${JSON.stringify(own.body).slice(0, 160)}`);
    const self = await call(b.sessions.emp, 'GET', `${path}/${other}`);
    check(`${path}: the person sees their own`, self.status === 200, `${self.status}`);
    const none = await call(b.sessions.admin, 'GET', `${path}/${missing}`);
    check(`${path}: unknown id → 404 (same as another company's)`, none.status === 404, `${none.status}`);
  }
  // The person's details come back only in their own company
  const h = await call(b.sessions.admin, 'GET', `/resources/history/${other}`);
  check('history shows the person to their own admin', h.data?.person?.firstName === b.people.emp.firstName, JSON.stringify(h.data?.person));

  // ── Admin-only details stay with admins (audit #5, #7)
  const cid = b.company.id;
  for (const path of [`/companies/${cid}`, `/companies/${cid}/settings`, '/access/catalog']) {
    check(`${path}: an employee → 403`, (await call(b.sessions.emp, 'GET', path)).status === 403);
    check(`${path}: the Company Admin → 200`, (await call(b.sessions.admin, 'GET', path)).status === 200);
  }
  for (const path of [`/companies/${cid}/branding`, `/companies/${cid}/theme`]) {
    check(`${path}: still open to employees (the portal needs it)`, (await call(b.sessions.emp, 'GET', path)).status === 200);
  }
  const oldChart = await call(b.sessions.emp, 'GET', '/employees/org-chart');
  check('old /employees/org-chart is gone', oldChart.status !== 200 && !Array.isArray(oldChart.data), `${oldChart.status}`);
  check('the org chart the app uses still works', (await call(b.sessions.emp, 'GET', '/org/chart')).status === 200);

  await dropCompany(A);
  await dropCompany(B);
  await p.$disconnect();
  process.exit(t.done() ? 0 : 1);
})().catch(async (e) => {
  console.error(e);
  await dropCompany(A).catch(() => undefined);
  await dropCompany(B).catch(() => undefined);
  process.exit(1);
});
