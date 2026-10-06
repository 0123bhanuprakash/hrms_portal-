// Administration round: Users insights, bulk actions, invite many, role-change preview,
// account history, role list extras + templates, explorer reach and the sensitive data check.
const { prisma: p, suite, call, makeCompany, dropCompany } = require('./lib');

const SLUG = 'admin-plus-e2e';
const t = suite('admin-plus');
const { check } = t;

(async () => {
  await dropCompany(SLUG);
  try {
    const { roles, people: P, sessions: S } = await makeCompany(SLUG, [
      ['boss', ['company_admin']],
      ['hema', ['hr', 'employee']],
      ['karan', ['manager', 'employee'], 'boss'],
      ['ravi', ['employee'], 'karan'],
      ['neha', ['employee'], 'karan'],
      ['old', ['finance', 'employee']],
    ]);
    const A = S.boss;
    const long = new Date(Date.now() - 45 * 86_400_000);
    await p.user.update({ where: { id: P.old.user.id }, data: { lastLoginAt: long } });

    // ── Invite many (each gets Employee + a basic profile)
    let r = await call(A, 'POST', '/company/users/invite-many', { emails: ['sana.khan@admin-plus-e2e.test', 'john@', 'sana.khan@admin-plus-e2e.test', 'meera.joshi2@admin-plus-e2e.test'] });
    check('Invite many works', r.status === 201, JSON.stringify(r.body).slice(0, 300));
    check('…2 invited, bad email reported', r.data?.invited === 2 && r.data.results.some((x) => x.email === 'john@' && !x.ok));
    const sana = await p.user.findUnique({ where: { email: 'sana.khan@admin-plus-e2e.test' }, include: { employee: true } });
    check('Name taken from the email', sana?.firstName === 'Sana' && sana.lastName === 'Khan');
    check('…and an employee profile', Boolean(sana?.employee));
    const meera = await p.user.findUnique({ where: { email: 'meera.joshi2@admin-plus-e2e.test' } });
    check('Digits dropped from names', meera?.firstName === 'Meera' && meera.lastName === 'Joshi');
    // Make one invite 9 days old
    await p.user.update({ where: { id: sana.id }, data: { createdAt: new Date(Date.now() - 9 * 86_400_000) } });

    // ── Insights
    r = await call(A, 'GET', '/company/users/insights');
    check('Insights load', r.status === 200, JSON.stringify(r.body).slice(0, 300));
    check('Counts: 8 active, 2 invited, 1 admin', r.data?.counts.active === 8 && r.data.counts.invited === 2 && r.data.counts.admins === 1, JSON.stringify(r.data?.counts));
    check('Old invite listed (Sana, 9 days)', r.data?.oldInvites.length === 1 && r.data.oldInvites[0].name === 'Sana Khan' && r.data.oldInvites[0].days >= 9);
    check('Dormant: old (Finance, 45 days)', r.data?.dormant.some((d) => d.name === 'old T' && d.roles.includes('Finance')) && r.data.dormantCount === 1);
    check('Private data: boss + HR', r.data?.privateData.people === 2 && r.data.privateData.roles.includes('HR'), JSON.stringify(r.data?.privateData));
    check('Employee can’t see insights', (await call(S.ravi, 'GET', '/company/users/insights')).status === 403);

    // ── Role preview
    r = await call(A, 'POST', `/company/users/${P.karan.user.id}/roles/preview`, { roleIds: [roles.manager, roles.employee, roles.hr] });
    check('Preview works', r.status === 200, JSON.stringify(r.body).slice(0, 300));
    check('…adds permissions incl. sensitive', r.data?.added.length > 10 && r.data.sensitiveAdded > 0);
    check('…widens employee.view to company', r.data?.widened.some((w) => w.key === 'employee.view' && w.from === 'all_reports' && w.scope === 'company'));
    check('…nothing removed', r.data?.removed.length === 0);
    r = await call(A, 'POST', `/company/users/${P.karan.user.id}/roles/preview`, { roleIds: [roles.employee] });
    check('Dropping Manager removes permissions', r.data?.removed.some((x) => x.key === 'leave.approve'));
    r = await call(A, 'POST', `/company/users/${P.karan.user.id}/roles/preview`, { roleIds: [roles.company_admin] });
    check('Becomes Company Admin flagged', r.data?.becomesOwner === true);

    // ── Bulk
    r = await call(A, 'POST', '/company/users/bulk', { ids: [P.ravi.user.id, P.neha.user.id, P.boss.user.id], action: 'add_role', roleId: roles.team_lead });
    check('Bulk add role', r.status === 200 && r.data?.done === 2 && r.data.failed.length === 1, JSON.stringify(r.body).slice(0, 300));
    check('…own roles can’t change', /own roles/.test(r.data?.failed[0]?.error ?? ''));
    check('…Ravi is a Team Lead now', (await p.userRole.count({ where: { userId: P.ravi.user.id, roleId: roles.team_lead } })) === 1);
    r = await call(A, 'POST', '/company/users/bulk', { ids: [P.ravi.user.id], action: 'remove_role', roleId: roles.team_lead });
    check('Bulk remove role', r.data?.done === 1 && (await p.userRole.count({ where: { userId: P.ravi.user.id, roleId: roles.team_lead } })) === 0);
    r = await call(A, 'POST', '/company/users/bulk', { ids: [P.neha.user.id], action: 'remove_role', roleId: roles.employee });
    r = await call(A, 'POST', '/company/users/bulk', { ids: [P.neha.user.id], action: 'remove_role', roleId: roles.team_lead });
    check('Can’t remove the only role', r.data?.failed.length === 1 && /only role/.test(r.data.failed[0].error));
    r = await call(A, 'POST', '/company/users/bulk', { ids: [P.old.user.id], action: 'deactivate' });
    check('Bulk deactivate', r.data?.done === 1 && (await p.user.findUnique({ where: { id: P.old.user.id } })).status === 'INACTIVE');
    r = await call(A, 'POST', '/company/users/bulk', { ids: [sana.id, P.ravi.user.id], action: 'resend_invite' });
    check('Bulk resend: invited one done, signed-in one reported', r.data?.done === 1 && r.data.failed[0]?.id === P.ravi.user.id);
    check('HR can’t bulk-assign roles', (await call(S.hema, 'POST', '/company/users/bulk', { ids: [P.ravi.user.id], action: 'add_role', roleId: roles.finance })).status === 403);
    check('Bulk add role needs a role', (await call(A, 'POST', '/company/users/bulk', { ids: [P.ravi.user.id], action: 'add_role' })).status === 400);

    // ── History (audit log of role changes)
    await call(A, 'PUT', `/company/users/${P.ravi.user.id}/roles`, { roleIds: [roles.employee, roles.finance] });
    r = await call(A, 'GET', `/company/users/${P.ravi.user.id}/history`);
    check('History lists the role change', r.status === 200 && r.data?.some((h) => h.action === 'user:roles:update' && h.added.includes('Finance') && h.by === 'boss T'), JSON.stringify(r.body).slice(0, 400));

    // ── Roles list extras + templates
    r = await call(A, 'GET', '/company/roles');
    const hr = r.data?.find((x) => x.key === 'hr');
    check('Role list has module counts', hr?.modules?.people > 0 && hr.modules.time > 0, JSON.stringify(hr?.modules));
    check('…sensitive count and holders', hr?.sensitiveCount > 0 && hr.holders.some((h) => h.firstName === 'hema'));
    r = await call(A, 'GET', `/company/roles/${roles.manager}`);
    check('Role detail has holders', r.data?.holders.some((h) => h.firstName === 'karan'));
    r = await call(A, 'GET', '/company/roles/templates');
    check('5 templates', r.status === 200 && r.data?.length === 5 && r.data.some((x) => x.key === 'auditor'), JSON.stringify(r.body).slice(0, 200));
    const auditor = r.data.find((x) => x.key === 'auditor');
    r = await call(A, 'POST', '/company/roles', { name: 'Auditor E2E', grants: auditor.grants.map((g) => (g.scope ? g : { key: g.key })) });
    check('A template saves as a role', r.status === 201, JSON.stringify(r.body).slice(0, 300));

    // ── Explorer: reach + sensitive check
    r = await call(A, 'GET', `/access/explain/users/${P.karan.user.id}`);
    check('Reach numbers', r.data?.reach?.direct === 2 && r.data.reach.team === 2 && r.data.reach.company >= 8 && r.data.reach.widest === 'all_reports', JSON.stringify(r.data?.reach));
    r = await call(A, 'GET', '/access/explain/sensitive');
    check('Sensitive check loads', r.status === 200 && Array.isArray(r.data), JSON.stringify(r.body).slice(0, 200));
    const salary = r.data?.find((x) => x.key === 'salary.view');
    check('Salary: boss + HR, not employees', salary?.holders.some((h) => h.name === 'boss T') && salary.holders.some((h) => h.name === 'hema T') && !salary.holders.some((h) => h.name === 'neha T'));
    check('…with sources', salary?.holders.find((h) => h.name === 'hema T')?.sources.some((s) => s.name === 'HR'));
    check('Employee can’t run the check', (await call(S.ravi, 'GET', '/access/explain/sensitive')).status === 403);
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
