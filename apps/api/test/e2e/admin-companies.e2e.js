// Super Admin → Companies: list with health / setup / activity, summary and attention, tags, notes, bulk actions.
const bcrypt = require('bcryptjs');
const { prisma: p, suite, call, login, makeCompany, dropCompany } = require('./lib');

const A = 'sa-companies-e2e-a';
const B = 'sa-companies-e2e-b';
const SA_EMAIL = 'sa-companies-e2e@platform.test';
const PW = 'Sa-Companies-2026!';
const t = suite('admin-companies');
const { check } = t;

(async () => {
  await dropCompany(A);
  await dropCompany(B);
  await p.user.deleteMany({ where: { email: SA_EMAIL } });
  try {
    await p.user.create({ data: { email: SA_EMAIL, passwordHash: await bcrypt.hash(PW, 10), firstName: 'Platform', lastName: 'Owner', isSuperAdmin: true, status: 'ACTIVE', emailVerifiedAt: new Date() } });
    const SA = await login(SA_EMAIL, PW);
    const a = await makeCompany(A, [['admin', ['employee', 'company_admin']], ['emp', ['employee']]]);
    const b = await makeCompany(B, [['admin', ['employee', 'company_admin']]]);
    await p.department.create({ data: { companyId: a.company.id, name: 'Engineering', code: 'ENG' } });

    // Signing in records today's activity
    const today = new Date(new Date().toISOString().slice(0, 10));
    check('Sign-in records an active day', (await p.userActivityDay.count({ where: { companyId: a.company.id, day: today } })) === 2);

    check('Company admins can’t see the platform list → 403', (await call(a.sessions.admin, 'GET', '/admin/companies')).status === 403);

    let r = await call(SA, 'GET', `/admin/companies?search=${A}`);
    const row = r.data?.[0];
    check('List carries usage and health', r.status === 200 && row?.insights?.users === 2 && row.insights.activeUsers7d === 2 && row.insights.trend.length === 7, JSON.stringify(row?.insights));
    check('Setup checklist reflects what exists', row?.insights?.setup?.items?.find((i) => i.key === 'departments')?.done === true && row.insights.setup.items.find((i) => i.key === 'holidays')?.done === false);
    check('Health score and label', typeof row?.insights?.health?.score === 'number' && ['healthy', 'watch', 'at_risk'].includes(row.insights.health.label));
    check('Bad sort → 400', (await call(SA, 'GET', '/admin/companies?sortBy=salary')).status === 400);
    r = await call(SA, 'GET', '/admin/companies?sortBy=health&sortOrder=desc&limit=100');
    const scores = (r.data ?? []).map((c) => c.insights.health.score);
    check('Sort by health', r.status === 200 && scores.every((s, i) => i === 0 || scores[i - 1] >= s));

    // Tags
    r = await call(SA, 'PUT', `/admin/companies/${a.company.id}/tags`, { tags: ['Pilot', 'Enterprise deal'] });
    check('Set tags', r.status === 200 && r.data?.tags?.join() === 'Enterprise deal,Pilot', JSON.stringify(r.body));
    check('Too-long tag → 400', (await call(SA, 'PUT', `/admin/companies/${a.company.id}/tags`, { tags: ['x'.repeat(31)] })).status === 400);
    r = await call(SA, 'GET', '/admin/companies?tag=Pilot&limit=100');
    check('Filter by tag', r.data?.some((c) => c.id === a.company.id) && !r.data?.some((c) => c.id === b.company.id));
    check('All tags with counts', (await call(SA, 'GET', '/admin/companies/tags')).data?.some((x) => x.label === 'Pilot' && x.count >= 1));

    // Notes
    r = await call(SA, 'POST', `/admin/companies/${a.company.id}/notes`, { body: 'Called HR — importing employees next week.' });
    const noteId = r.data?.id;
    check('Add a note', r.status === 201 && r.data?.author?.firstName === 'Platform', JSON.stringify(r.body));
    check('Empty note → 400', (await call(SA, 'POST', `/admin/companies/${a.company.id}/notes`, { body: '   ' })).status === 400);
    r = await call(SA, 'GET', `/admin/companies/${a.company.id}/insights`);
    check('Panel: daily active users, modules, notes', r.status === 200 && r.data?.dailyActive?.length === 30 && r.data.modules.length >= 5 && r.data.notes.some((n) => n.id === noteId), JSON.stringify(Object.keys(r.data ?? {})));
    check('Company can’t read the panel → 403', (await call(a.sessions.admin, 'GET', `/admin/companies/${a.company.id}/insights`)).status === 403);
    check('Remove a note', (await call(SA, 'DELETE', `/admin/companies/${a.company.id}/notes/${noteId}`)).status === 200);
    check('Removed note is gone → 404', (await call(SA, 'DELETE', `/admin/companies/${a.company.id}/notes/${noteId}`)).status === 404);

    // Bulk
    const ids = [a.company.id, b.company.id];
    r = await call(SA, 'POST', '/admin/companies/bulk', { ids, action: 'addTag', tag: 'Q4 review' });
    check('Bulk: add a tag to two companies', r.status === 200 && (await p.companyTag.count({ where: { companyId: { in: ids }, label: 'Q4 review' } })) === 2, JSON.stringify(r.body));
    await call(SA, 'POST', '/admin/companies/bulk', { ids, action: 'removeTag', tag: 'Q4 review' });
    check('Bulk: remove it again', (await p.companyTag.count({ where: { companyId: { in: ids }, label: 'Q4 review' } })) === 0);
    r = await call(SA, 'POST', '/admin/companies/bulk', { ids: [b.company.id], action: 'status', status: 'INACTIVE', reason: 'Trial ended' });
    check('Bulk: change status', r.status === 200 && (await p.company.findUnique({ where: { id: b.company.id } }))?.status === 'INACTIVE');
    check('Bulk: unknown company → 400', (await call(SA, 'POST', '/admin/companies/bulk', { ids: ['00000000-0000-4000-8000-000000000000'], action: 'addTag', tag: 'x' })).status === 400);
    check('Bulk: unknown action → 400', (await call(SA, 'POST', '/admin/companies/bulk', { ids, action: 'delete' })).status === 400);

    // Summary and attention
    r = await call(SA, 'GET', '/admin/companies/summary');
    check('Summary numbers', r.status === 200 && r.data?.companies?.total >= 2 && r.data.companies.growth.length === 6 && typeof r.data.users.activeThisWeek === 'number', JSON.stringify(r.data?.companies));
    check('Inactive company needs attention', r.data?.attention?.some((x) => x.companyId === b.company.id && x.kind === 'inactive'));
    check('Pipeline places each company', Object.values(r.data?.stages ?? {}).flat().some((x) => x.id === a.company.id) && r.data.stages.paused.some((x) => x.id === b.company.id && x.name === B));
    r = await call(SA, 'GET', `/admin/companies?health=at_risk&limit=100`);
    check('Filter by health', r.status === 200 && r.data.every((c) => c.insights.health.label === 'at_risk') && r.data.some((c) => c.id === b.company.id));
    await call(SA, 'POST', '/admin/companies/bulk', { ids: [b.company.id], action: 'status', status: 'ACTIVE' });
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    await dropCompany(A);
    await dropCompany(B);
    await p.auditLog.deleteMany({ where: { user: { email: SA_EMAIL } } });
    await p.user.deleteMany({ where: { email: SA_EMAIL } });
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
