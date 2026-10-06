// Everyone in a company is an employee: the Company Admin gets employee #1 when the
// Super Admin creates the company; invited users always get a profile; an account
// without one can create its own basic profile (once).
const bcrypt = require('bcryptjs');
const { prisma: p, suite, call, login, dropCompany } = require('./lib');

const SLUG = 'everyone-employee-e2e';
const SA_EMAIL = 'sa-everyone-e2e@platform.test';
const ADMIN_EMAIL = `admin@${SLUG}.test`;
const PW = 'Everyone-E2E-2026!';
const t = suite('everyone-employee');
const { check } = t;

(async () => {
  await dropCompany(SLUG);
  await p.user.deleteMany({ where: { email: SA_EMAIL } });
  try {
    await p.user.create({ data: { email: SA_EMAIL, passwordHash: await bcrypt.hash(PW, 10), firstName: 'Platform', lastName: 'Owner', isSuperAdmin: true, status: 'ACTIVE', emailVerifiedAt: new Date() } });
    const SA = await login(SA_EMAIL, PW);

    // ── The Super Admin creates a company: nothing extra to type
    let r = await call(SA, 'POST', '/companies', { name: 'Everyone Co', slug: SLUG, email: `hello@${SLUG}.test`, adminEmail: ADMIN_EMAIL, adminFirstName: 'Asha', adminLastName: 'Admin', employeeIdPrefix: 'EVE' });
    check('Company created', r.status === 201, JSON.stringify(r.body).slice(0, 300));
    check('Admin is employee #1 (EVE001)', r.data?.adminUser?.employeeId === 'EVE001', JSON.stringify(r.data?.adminUser));
    const company = await p.company.findUnique({ where: { slug: SLUG } });
    const adminUser = await p.user.findUnique({ where: { email: ADMIN_EMAIL }, include: { employee: true } });
    check('Admin profile uses their name and email', adminUser?.employee?.firstName === 'Asha' && adminUser.employee.email === ADMIN_EMAIL);
    check('Admin profile is in the org chart', (await p.employeeHierarchy.count({ where: { descendantId: adminUser.employee.id, depth: 0 } })) === 1);

    // The admin signs in (set a known password; the real one is emailed)
    await p.user.update({ where: { id: adminUser.id }, data: { passwordHash: await bcrypt.hash(PW, 10), mustChangePassword: false } });
    const A = await login(ADMIN_EMAIL, PW);
    r = await call(A, 'GET', '/people/me');
    check('Admin has an employee card', r.data?.employee?.employeeId === 'EVE001', JSON.stringify(r.body).slice(0, 200));
    check('…with job title / department still to complete', r.data?.employee?.designation === null && r.data.employee.department === null);
    check('Admin keeps full access', (await call(A, 'GET', '/company/users')).status === 200);

    // ── Invited without job details → still an employee
    r = await call(A, 'POST', '/company/users', { email: `ravi@${SLUG}.test`, firstName: 'Ravi', lastName: 'K' });
    check('Invite works', r.status === 201 && !r.data?.employeeError, JSON.stringify(r.body).slice(0, 300));
    const ravi = await p.user.findUnique({ where: { email: `ravi@${SLUG}.test` }, include: { employee: true } });
    check('Invited person gets a basic profile (EVE002)', ravi?.employee?.employeeId === 'EVE002');

    // ── An older account without a profile creates its own, once
    const old = await p.user.create({ data: { email: `old@${SLUG}.test`, passwordHash: await bcrypt.hash(PW, 10), firstName: 'Old', lastName: 'Account', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date() } });
    const role = await p.role.findFirst({ where: { companyId: company.id, key: 'employee' } });
    await p.userRole.create({ data: { userId: old.id, roleId: role.id, companyId: company.id } });
    const O = await login(old.email, PW);
    check('No profile yet', (await call(O, 'GET', '/people/me')).data?.employee === null);
    r = await call(O, 'POST', '/employees/me');
    check('Creates my own basic profile (EVE003)', r.status === 201 && r.data?.employeeId === 'EVE003', JSON.stringify(r.body).slice(0, 200));
    check('Only once → 409', (await call(O, 'POST', '/employees/me')).status === 409);
    check('Now it shows on my card', (await call(O, 'GET', '/people/me')).data?.employee?.employeeId === 'EVE003');
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    await dropCompany(SLUG);
    await p.user.deleteMany({ where: { email: SA_EMAIL } });
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
