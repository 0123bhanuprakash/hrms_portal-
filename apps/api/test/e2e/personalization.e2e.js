// Personal colour theme & menu style: company rules, employee choices, validation, tenant isolation.
const { prisma: p, suite, call, makeCompany, dropCompany } = require('./lib');

const SLUG = 'personal-e2e';
const OTHER = 'personal-e2e-other';
const t = suite('personalization');
const { check } = t;

(async () => {
  await dropCompany(SLUG);
  await dropCompany(OTHER);
  try {
    const { company, sessions: S } = await makeCompany(SLUG, [
      ['admin', ['employee', 'company_admin']],
      ['emp', ['employee']],
    ]);
    const other = await makeCompany(OTHER, [['admin', ['employee', 'company_admin']]]);
    const cid = company.id;

    // Defaults: everything allowed, classic menu
    const theme = await call(S.emp, 'GET', `/companies/${cid}/theme`);
    const rules = theme.data?.personalization;
    check('Theme carries personalisation rules', theme.status === 200 && rules?.personalThemes === true && rules?.personalMenuStyle === true);
    check('Defaults: all themes, classic menu', rules?.allowedThemes?.length === 0 && rules?.defaultMenuStyle === 'classic');

    // Employee picks a theme and a menu style
    let r = await call(S.emp, 'PATCH', '/users/me/preferences', { colorTheme: 'obsidian-gold', menuStyle: 'glide' });
    check('Employee saves own theme + menu', r.status === 200 && r.data?.colorTheme === 'obsidian-gold' && r.data?.menuStyle === 'glide', JSON.stringify(r.body));
    r = await call(S.emp, 'GET', '/users/me/preferences');
    check('Choices persist', r.data?.colorTheme === 'obsidian-gold' && r.data?.menuStyle === 'glide');

    // Validation
    check('Unknown theme → 400', (await call(S.emp, 'PATCH', '/users/me/preferences', { colorTheme: 'neon-pink' })).status === 400);
    check('Unknown menu style → 400', (await call(S.emp, 'PATCH', '/users/me/preferences', { menuStyle: 'sideways' })).status === 400);
    r = await call(S.emp, 'PATCH', '/users/me/preferences', { timezone: 'UTC' });
    check('Other changes keep the choices', r.status === 200 && r.data?.colorTheme === 'obsidian-gold' && r.data?.menuStyle === 'glide');

    // Only Company Admins set the rules
    check('Employee cannot change the rules → 403', (await call(S.emp, 'PUT', `/companies/${cid}/personalization`, { personalThemes: false })).status === 403);
    check('Bad allowed theme → 400', (await call(S.admin, 'PUT', `/companies/${cid}/personalization`, { allowedThemes: ['nope'] })).status === 400);
    check('Bad default menu → 400', (await call(S.admin, 'PUT', `/companies/${cid}/personalization`, { defaultMenuStyle: 'nope' })).status === 400);
    check('Unknown field → 400', (await call(S.admin, 'PUT', `/companies/${cid}/personalization`, { hack: true })).status === 400);
    check('Other company → 403', (await call(other.sessions.admin, 'PUT', `/companies/${cid}/personalization`, { personalThemes: false })).status === 403);

    r = await call(S.admin, 'PUT', `/companies/${cid}/personalization`, { allowedThemes: ['ocean', 'forest', 'ocean'], defaultMenuStyle: 'collapsible' });
    check('Admin limits themes + sets default menu', r.status === 200 && r.data?.allowedThemes?.length === 2 && r.data?.defaultMenuStyle === 'collapsible', JSON.stringify(r.body));
    check('Rules show on the theme', (await call(S.emp, 'GET', `/companies/${cid}/theme`)).data?.personalization?.defaultMenuStyle === 'collapsible');
    check('Change is audited', (await p.auditLog.count({ where: { companyId: cid, action: 'company:personalization:update' } })) >= 1);

    check('Theme not on offer → 400', (await call(S.emp, 'PATCH', '/users/me/preferences', { colorTheme: 'sunset' })).status === 400);
    check('Theme on offer → 200', (await call(S.emp, 'PATCH', '/users/me/preferences', { colorTheme: 'forest' })).status === 200);

    // Switch personal choices off
    await call(S.admin, 'PUT', `/companies/${cid}/personalization`, { personalThemes: false, personalMenuStyle: false });
    check('Themes off → own theme refused', (await call(S.emp, 'PATCH', '/users/me/preferences', { colorTheme: 'ocean' })).status === 400);
    check('Menu off → own menu refused', (await call(S.emp, 'PATCH', '/users/me/preferences', { menuStyle: 'glide' })).status === 400);
    r = await call(S.emp, 'PATCH', '/users/me/preferences', { colorTheme: null, menuStyle: null });
    check('Back to company defaults is always allowed', r.status === 200 && r.data?.colorTheme === null && r.data?.menuStyle === null, JSON.stringify(r.body));

    // Remembered views (chart styles, open menu sections…)
    r = await call(S.emp, 'PATCH', '/users/me/ui-state', { changes: { 'chart:by-department': 'donut', 'menu:open-groups': { Time: true } } });
    check('View choices saved', r.status === 200 && r.data?.['chart:by-department'] === 'donut', JSON.stringify(r.body));
    r = await call(S.emp, 'GET', '/users/me/preferences');
    check('View choices come back with preferences', r.data?.uiState?.['chart:by-department'] === 'donut' && r.data?.uiState?.['menu:open-groups']?.Time === true);
    r = await call(S.emp, 'PATCH', '/users/me/ui-state', { changes: { 'menu:open-groups': null } });
    check('null forgets one choice', r.status === 200 && !('menu:open-groups' in r.data) && r.data['chart:by-department'] === 'donut');
    check('Bad setting name → 400', (await call(S.emp, 'PATCH', '/users/me/ui-state', { changes: { 'no spaces!': 1 } })).status === 400);
    check('Huge value → 400', (await call(S.emp, 'PATCH', '/users/me/ui-state', { changes: { big: 'x'.repeat(3000) } })).status === 400);
    check('Admin choices are separate', !('chart:by-department' in ((await call(S.admin, 'GET', '/users/me/preferences')).data?.uiState ?? {})));
    r = await call(S.emp, 'DELETE', '/users/me/ui-state');
    check('Reset forgets everything', r.status === 200 && Object.keys((await call(S.emp, 'GET', '/users/me/preferences')).data?.uiState ?? {}).length === 0);

    // Company default views
    check('Employee cannot set company defaults → 403', (await call(S.emp, 'PUT', `/companies/${cid}/ui-defaults`, { values: { 'chart:by-department': 'donut' } })).status === 403);
    check('Other company → 403', (await call(other.sessions.admin, 'PUT', `/companies/${cid}/ui-defaults`, { values: {} })).status === 403);
    r = await call(S.admin, 'PUT', `/companies/${cid}/ui-defaults`, { values: { 'chart:by-department': 'blocks' } });
    check('Admin sets company default views', r.status === 200 && r.data?.['chart:by-department'] === 'blocks', JSON.stringify(r.body));
    check('Defaults travel with the theme', (await call(S.emp, 'GET', `/companies/${cid}/theme`)).data?.uiDefaults?.['chart:by-department'] === 'blocks');

    // Page background packs: Signature (default), Terra, Prism, Simple (plain)
    for (const pack of ['terra', 'prism', 'simple']) {
      r = await call(S.emp, 'PATCH', '/users/me/preferences', { backdropPack: pack });
      check(`Employee picks the ${pack} background`, r.status === 200 && r.data?.backdropPack === pack, JSON.stringify(r.body));
    }
    check('Unknown background pack → 400', (await call(S.emp, 'PATCH', '/users/me/preferences', { backdropPack: 'neon' })).status === 400);
    r = await call(S.emp, 'PATCH', '/users/me/preferences', { backdropPack: null });
    check('Back to the company background', r.status === 200 && r.data?.backdropPack === null);
    r = await call(S.admin, 'PUT', `/companies/${cid}/personalization`, { defaultBackdropPack: 'prism', defaultBackdropLevel: 'calm' });
    check('Admin sets Prism as the company background', r.status === 200 && r.data?.defaultBackdropPack === 'prism' && r.data?.defaultBackdropLevel === 'calm', JSON.stringify(r.body));
    check('Bad company background → 400', (await call(S.admin, 'PUT', `/companies/${cid}/personalization`, { defaultBackdropPack: 'neon' })).status === 400);
    r = await call(undefined, 'GET', `/companies/branding/by-slug/${SLUG}`);
    check('Sign-in page gets the company background', r.status === 200 && r.data?.backdrop?.pack === 'prism' && r.data?.backdrop?.level === 'calm', JSON.stringify(r.body));
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    await dropCompany(SLUG);
    await dropCompany(OTHER);
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
