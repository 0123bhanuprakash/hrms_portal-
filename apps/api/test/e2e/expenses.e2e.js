// expenses: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Expense-E2E-2026!';
const SLUG = 'expenses-e2e';
const TZ = 'Asia/Kolkata';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const call = async (h, m, u, b) => {
  const isForm = b instanceof FormData;
  const headers = { ...h }; if (isForm) delete headers['content-type'];
  const r = await fetch(B + u, { method: m, headers, body: b ? (isForm ? b : JSON.stringify(b)) : undefined });
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('json')) return { status: r.status, raw: Buffer.from(await r.arrayBuffer()), text: '' };
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
const wait = (ms = 1000) => new Promise((r) => setTimeout(r, ms));
async function login(email) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (r.status === 429) { await wait(15000); continue; }
    return { authorization: 'Bearer ' + (await r.json()).data.access_token, 'content-type': 'application/json' };
  }
  throw new Error('login throttled');
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const addDays = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const itemForm = (fields, withReceipt) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
  if (withReceipt) f.append('receipt', new Blob([PDF], { type: 'application/pdf' }), 'bill.pdf');
  return f;
};

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.expenseClaim.deleteMany({ where: { companyId: c.id } });
  await p.expenseCategory.deleteMany({ where: { companyId: c.id } });
  await p.projectMember.deleteMany({ where: { companyId: c.id } });
  await p.project.deleteMany({ where: { companyId: c.id } });
  await p.employeeHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.employee.updateMany({ where: { companyId: c.id }, data: { reportingManagerId: null } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await p.auditLog.deleteMany({ where: { OR: [{ companyId: c.id }, { userId: { in: ids } }] } });
  await p.userRole.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.role.deleteMany({ where: { companyId: c.id } });
  await p.companySettings.deleteMany({ where: { companyId: c.id } });
  await p.company.delete({ where: { id: c.id } });
  fs.rmSync(path.resolve('private-files', c.id), { recursive: true, force: true });
}

(async () => {
  await cleanup();
  const mailDir = path.resolve('.mail');
  const mailBefore = new Set(fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []);
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: TZ } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: true } });
    check('Finance role template exists', templates.some((t) => t.key === 'finance'));
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys, manager) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01'), reportingManagerId: manager ? P[manager].id : null } });
      P[name] = { ...e, user: u };
      await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 } });
      if (manager) await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: P[manager].id, descendantId: e.id, depth: 1 } });
    };
    await mk('head', ['employee', 'manager']);
    await mk('lead', ['employee'], 'head');
    await mk('mem', ['employee'], 'head');
    await mk('other', ['employee'], 'head');
    await mk('fin', ['employee', 'finance']);
    await mk('hr', ['employee', 'hr']);
    await mk('both', ['employee', 'finance', 'hr']);
    const proj = await p.project.create({ data: { companyId: company.id, code: 'APL', name: 'Apollo', startDate: new Date('2025-01-01') } });
    await p.projectMember.create({ data: { companyId: company.id, projectId: proj.id, employeeId: P.lead.id, role: 'TEAM_LEAD', allocation: 100, startDate: new Date('2025-01-01') } });
    await p.projectMember.create({ data: { companyId: company.id, projectId: proj.id, employeeId: P.mem.id, role: 'MEMBER', leadEmployeeId: P.lead.id, allocation: 100, startDate: new Date('2025-01-01') } });
    const S = {};
    for (const n of ['mem', 'lead', 'other', 'fin', 'hr', 'both', 'head']) S[n] = await login(P[n].email);

    const cats = Object.fromEntries((await call(S.mem, 'GET', '/expenses/categories')).data.map((c) => [c.name, c]));
    check('Default categories', Object.keys(cats).length === 7 && cats.Food.maxPerItemPaise === 150000);
    check('Employee cannot add categories → 403', (await call(S.mem, 'POST', '/expenses/categories', { name: 'Gym' })).status === 403);

    // ── Draft
    const c1 = (await call(S.mem, 'POST', '/expenses/claims', { title: 'Client visit — Mumbai', projectId: proj.id })).data;
    check('Create a draft claim with project', c1?.status === 'DRAFT' && c1.project?.code === 'APL', JSON.stringify(c1));
    const y = addDays(today, -2);
    check('Over the category limit without a reason → 400', (await call(S.mem, 'POST', `/expenses/claims/${c1.id}/items`, itemForm({ categoryId: cats.Food.id, date: y, description: 'Dinner', amount: 2000 }))).status === 400);
    check('Future date → 400', (await call(S.mem, 'POST', `/expenses/claims/${c1.id}/items`, itemForm({ categoryId: cats.Food.id, date: addDays(today, 1), description: 'Dinner', amount: 400 }))).status === 400);
    check('Older than 90 days → 400', (await call(S.mem, 'POST', `/expenses/claims/${c1.id}/items`, itemForm({ categoryId: cats.Food.id, date: addDays(today, -100), description: 'Dinner', amount: 400 }))).status === 400);
    const food = await call(S.mem, 'POST', `/expenses/claims/${c1.id}/items`, itemForm({ categoryId: cats.Food.id, date: y, description: 'Dinner with client', amount: '400.50' }));
    check('Add item (no receipt yet)', food.status === 201 && food.data.items[0].amountPaise === 40050, JSON.stringify(food.body).slice(0, 200));
    check('Submit without required receipt → 400', /needs a receipt/.test((await call(S.mem, 'POST', `/expenses/claims/${c1.id}/submit`)).body.detail || ''));
    const foodId = food.data.items[0].id;
    await call(S.mem, 'PATCH', `/expenses/claims/${c1.id}/items/${foodId}`, itemForm({ categoryId: cats.Food.id, date: y, description: 'Dinner with client', amount: '400.50' }, true));
    const travel = await call(S.mem, 'POST', `/expenses/claims/${c1.id}/items`, itemForm({ categoryId: cats.Travel.id, date: y, description: 'Train BLR–BOM', amount: 5000 }, true));
    check('Add item with receipt', travel.data?.items.length === 2 && travel.data.items.every((i) => i.hasReceipt));
    check('Finance can’t see a draft → 404', (await call(S.fin, 'GET', `/expenses/claims/${c1.id}`)).status === 404);

    // ── Submit → manager (project lead / line manager) → Finance + HR
    const sub = await call(S.mem, 'POST', `/expenses/claims/${c1.id}/submit`);
    check('Submit → PENDING, manager step = lead + line manager', sub.data?.status === 'PENDING' && sub.data.steps[0].approvers.map((a) => a.firstName).sort().join() === 'head,lead', JSON.stringify(sub.data?.steps?.[0]));
    await wait();
    check('Lead notified', (await p.notification.count({ where: { userId: P.lead.user.id, type: 'expense.submitted' } })) === 1);
    check('Editing after submit → 400', (await call(S.mem, 'PATCH', `/expenses/claims/${c1.id}`, { title: 'X y z' })).status === 400);
    check('Finance must wait for the manager → 403', (await call(S.fin, 'POST', `/expenses/claims/${c1.id}/approve`, {})).status === 403);
    check('Unrelated colleague can’t see it → 404', (await call(S.other, 'GET', `/expenses/claims/${c1.id}`)).status === 404);
    check('Lead’s queue has it', (await call(S.lead, 'GET', '/expenses/claims/pending-count')).data.count === 1);
    check('Manager can’t change amounts → 400', (await call(S.lead, 'POST', `/expenses/claims/${c1.id}/approve`, { adjustments: [{ itemId: foodId, approvedAmount: 100, reason: 'too much' }] })).status === 400);
    const m1 = await call(S.lead, 'POST', `/expenses/claims/${c1.id}/approve`, { note: 'Valid visit' });
    check('Lead approves (no special role needed)', m1.data?.steps[0].status === 'APPROVED' && m1.data.status === 'PENDING', JSON.stringify(m1.body).slice(0, 200));
    await wait();
    check('Finance and HR notified together', (await p.notification.count({ where: { userId: { in: [P.fin.user.id, P.hr.user.id] }, type: 'expense.submitted' } })) === 2);
    const travelId = travel.data.items.find((i) => i.description.startsWith('Train')).id;
    check('Raising an amount → 400', (await call(S.fin, 'POST', `/expenses/claims/${c1.id}/approve`, { adjustments: [{ itemId: travelId, approvedAmount: 6000, reason: 'more' }] })).status === 400);
    const f1 = await call(S.hr, 'POST', `/expenses/claims/${c1.id}/approve`, { adjustments: [{ itemId: travelId, approvedAmount: 4500, reason: '2nd AC, not 1st AC' }] });
    check('HR approves first (parallel), lowers travel to 4500', f1.data?.status === 'PENDING' && f1.data.items.find((i) => i.id === travelId).approvedPaise === 450000, JSON.stringify(f1.body).slice(0, 200));
    const f2 = await call(S.fin, 'POST', `/expenses/claims/${c1.id}/approve`, { adjustments: [{ itemId: travelId, approvedAmount: 4800, reason: 'fare cap' }] });
    check('Finance approves → APPROVED; lower amount wins (4500)', f2.data?.status === 'APPROVED' && f2.data.totals.approvedPaise === 450000 + 40050 && f2.data.totals.claimedPaise === 500000 + 40050, JSON.stringify(f2.data?.totals));
    await wait();
    check('Employee told it was approved', (await p.notification.count({ where: { userId: P.mem.user.id, type: 'expense.approved' } })) === 1);
    check('Receipt viewable by Finance', (await call(S.fin, 'GET', `/expenses/claims/${c1.id}/items/${travelId}/receipt`)).raw?.equals(PDF));
    check('Receipt not visible to a colleague → 404', (await call(S.other, 'GET', `/expenses/claims/${c1.id}/items/${travelId}/receipt`)).status === 404);

    // ── Pay
    check('Payable list (Finance)', (await call(S.fin, 'GET', '/expenses/claims?view=payable')).body.data.length === 1);
    check('HR can’t mark paid → 403', (await call(S.hr, 'POST', `/expenses/claims/${c1.id}/pay`, { paymentDate: today, reference: 'UTR123' })).status === 403);
    check('Future payment date → 400', (await call(S.fin, 'POST', `/expenses/claims/${c1.id}/pay`, { paymentDate: addDays(today, 3), reference: 'UTR123' })).status === 400);
    const paid = await call(S.fin, 'POST', `/expenses/claims/${c1.id}/pay`, { paymentDate: today, reference: 'UTR123456' });
    check('Finance marks paid', paid.data?.status === 'PAID' && paid.data.paymentReference === 'UTR123456');
    await wait();
    check('Employee told it was paid (₹4,900.50)', (await p.notification.findFirst({ where: { userId: P.mem.user.id, type: 'expense.paid' } }))?.title.includes('₹4900.50'));

    // ── Reject + resubmit
    const c2 = (await call(S.mem, 'POST', '/expenses/claims', { title: 'Internet — September' })).data;
    await call(S.mem, 'POST', `/expenses/claims/${c2.id}/items`, itemForm({ categoryId: cats['Internet / phone'].id, date: y, description: 'Fibre bill', amount: 999 }, true));
    await call(S.mem, 'POST', `/expenses/claims/${c2.id}/submit`);
    await call(S.head, 'POST', `/expenses/claims/${c2.id}/approve`, {});
    const rj = await call(S.hr, 'POST', `/expenses/claims/${c2.id}/reject`, { reason: 'Attach the full bill, not page 2' });
    check('HR sends it back', rj.data?.status === 'REJECTED' && rj.data.rejectionReason.includes('full bill'));
    check('Finance step skipped on rejection', rj.data.steps.find((s) => s.stage === 'FINANCE').status === 'SKIPPED');
    check('Employee can edit a sent-back claim', (await call(S.mem, 'PATCH', `/expenses/claims/${c2.id}`, { title: 'Internet — September (full bill)' })).status === 200);
    const rs = await call(S.mem, 'POST', `/expenses/claims/${c2.id}/submit`);
    check('Resubmit → round 2, fresh steps', rs.data?.round === 2 && rs.data.steps.every((s) => s.status === 'PENDING'), JSON.stringify(rs.data?.steps));

    // ── One person never decides two steps
    await call(S.lead, 'POST', `/expenses/claims/${c2.id}/approve`, {});
    const b1 = await call(S.both, 'POST', `/expenses/claims/${c2.id}/approve`, {});
    check('Finance+HR person approves one step', b1.data?.steps.filter((s) => s.status === 'APPROVED').length === 2);
    check('…but not the second one → 403', (await call(S.both, 'POST', `/expenses/claims/${c2.id}/approve`, {})).status === 403);

    // ── Duplicates, cancel, own approval
    const c3 = (await call(S.mem, 'POST', '/expenses/claims', { title: 'Dup test' })).data;
    const dup = await call(S.mem, 'POST', `/expenses/claims/${c3.id}/items`, itemForm({ categoryId: cats.Food.id, date: y, description: 'Dinner again', amount: '400.50' }, true));
    check('Possible duplicate flagged', dup.data?.items[0].possibleDuplicate?.claimId === c1.id, JSON.stringify(dup.data?.items?.[0]?.possibleDuplicate));
    await call(S.mem, 'POST', `/expenses/claims/${c3.id}/submit`);
    check('Employee cancels a pending claim', (await call(S.mem, 'POST', `/expenses/claims/${c3.id}/cancel`)).data?.status === 'CANCELLED');
    const own = (await call(S.fin, 'POST', '/expenses/claims', { title: 'My own' })).data;
    await call(S.fin, 'POST', `/expenses/claims/${own.id}/items`, itemForm({ categoryId: cats.Other.id, date: y, description: 'Stationery', amount: 250 }, true));
    await call(S.fin, 'POST', `/expenses/claims/${own.id}/submit`);
    check('Nobody approves their own claim → 404', (await call(S.fin, 'POST', `/expenses/claims/${own.id}/approve`, {})).status === 404);

    // ── Reports
    const rep = await call(S.fin, 'GET', `/expenses/report?from=${addDays(today, -30)}&to=${today}`);
    check('Report: totals + by category / project', rep.data?.totals.paidPaise === 490050 && rep.data.byProject.some((r) => r.label === 'Apollo'), JSON.stringify(rep.data?.totals));
    check('Employee can’t see reports → 403', (await call(S.mem, 'GET', `/expenses/report?from=${today}&to=${today}`)).status === 403);
    const csv = await fetch(`${B}/expenses/export?from=${addDays(today, -30)}&to=${today}`, { headers: S.fin });
    const text = await csv.text();
    check('CSV export', csv.status === 200 && text.includes('Train BLR–BOM') && text.includes('2nd AC'), text.slice(0, 200));
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    for (const f of fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []) if (!mailBefore.has(f)) fs.rmSync(path.join(mailDir, f));
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company and test emails removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
