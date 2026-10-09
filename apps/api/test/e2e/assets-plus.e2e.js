// Assets, round 2: type settings & catalog, team lead → manager → HR → IT head, requests for my team,
// loans, hand-over matches & checklist, repairs, documents, register views, import, report a problem,
// starter kits (joiners & promotions), returns, yearly check, loan reminders.
const path = require('path');
const { B, prisma: p, suite, call, makeCompany, dropCompany, mailSnapshot, todayIn, addDays } = require('./lib');

const SLUG = 'assets-plus-e2e';
const t = suite('assets-plus');
const { check } = t;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const eventually = async (fn) => {
  for (let i = 0; i < 30; i++) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

(async () => {
  await dropCompany(SLUG);
  const restoreMail = mailSnapshot();
  try {
    const today = todayIn();
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['boss', ['employee', 'manager']],
      ['lead', ['employee', 'team_lead'], 'boss'],
      ['emp', ['employee'], 'boss'],
      ['peer', ['employee'], 'boss'],
      ['it', ['employee', 'it_admin']],
      ['hr', ['employee', 'hr']],
    ]);
    const cid = company.id;
    // emp works on Apollo under lead
    const apollo = await p.project.create({ data: { companyId: cid, code: 'APO', name: 'Apollo', status: 'ACTIVE', startDate: new Date('2026-01-01') } });
    await p.projectMember.createMany({
      data: [
        { companyId: cid, projectId: apollo.id, employeeId: P.lead.id, role: 'TEAM_LEAD', allocation: 100, startDate: new Date('2026-01-01') },
        { companyId: cid, projectId: apollo.id, employeeId: P.emp.id, role: 'MEMBER', leadEmployeeId: P.lead.id, allocation: 100, startDate: new Date('2026-01-01') },
      ],
    });

    // ── Types: settings & catalog
    const types = Object.fromEntries((await call(S.it, 'GET', '/assets/types?all=true')).data.map((x) => [x.name, x]));
    check('Default types carry pictures and settings', types.Laptop.icon === 'laptop' && types.Laptop.loanable && types.Laptop.fields.includes('Memory') && types.Monitor.warrantyMonths === 36);
    const ty = await call(S.it, 'PATCH', `/assets/types/${types.Laptop.id}`, { name: 'Laptop', prefix: 'LAP', minStock: 2, maxLoanDays: 14, checklist: ['Charger', 'Sleeve'] });
    check('IT edits a type (stock, loan days, checklist)', ty.data?.minStock === 2 && ty.data.maxLoanDays === 14 && ty.data.checklist.length === 2);
    const mk = (typeId, name, extra = {}) => call(S.it, 'POST', '/assets', { typeId, name, ...extra });
    const lapNew = (await mk(types.Laptop.id, 'MacBook Air', { condition: 'NEW', purchaseDate: addDays(today, -10), specs: { Memory: '16 GB', Processor: 'M3' } })).data;
    const lapOld = (await mk(types.Laptop.id, 'ThinkPad', { condition: 'FAIR', purchaseDate: '2020-01-15' })).data;
    check('Warranty filled from the type; specs saved', Boolean(lapNew?.warrantyUntil) && lapNew.specs.Memory === '16 GB', JSON.stringify(lapNew).slice(0, 200));
    check('Old laptop flagged for replacement', lapOld?.replaceDue === true);
    const mon = (await mk(types.Monitor.id, 'Dell 27"')).data;
    const cat = await call(S.emp, 'GET', '/assets/types/catalog');
    check('Catalog shows stock', cat.data?.find((x) => x.name === 'Laptop').available === 2 && cat.data.find((x) => x.name === 'Monitor').available === 1);

    // ── Approval chain: team lead → manager → HR → IT head
    const pv = await call(S.emp, 'GET', '/assets/requests/preview');
    check('Preview: lead, manager, HR, IT head', pv.data?.steps.map((s) => s.stage).join() === 'LEAD,MANAGER,HR,IT' && pv.data.steps[0].person.id === P.lead.user.id, JSON.stringify(pv.data?.steps));
    const r1 = await call(S.emp, 'POST', '/assets/requests', { typeId: types.Monitor.id, reason: 'Second screen for design reviews' });
    check('Request waits for the team lead', r1.data?.stage === 'LEAD');
    check('Lead told', await eventually(async () => (await p.notification.count({ where: { userId: P.lead.user.id, type: 'asset.requested' } })) === 1));
    check('Manager can’t jump ahead → 403', (await call(S.boss, 'POST', `/assets/requests/${r1.data.id}/approve`, {})).status === 403);
    check('Lead approves → manager', (await call(S.lead, 'POST', `/assets/requests/${r1.data.id}/approve`, {})).data?.stage === 'MANAGER');
    check('Manager approves → HR', (await call(S.boss, 'POST', `/assets/requests/${r1.data.id}/approve`, {})).data?.stage === 'HR');
    check('HR approves → IT head', (await call(S.hr, 'POST', `/assets/requests/${r1.data.id}/approve`, {})).data?.stage === 'IT');
    const done = await call(S.it, 'POST', `/assets/requests/${r1.data.id}/approve`, {});
    check('IT head approves → approved, all four steps', done.data?.status === 'APPROVED' && done.data.steps.every((s) => s.status === 'APPROVED'), JSON.stringify(done.data?.steps));

    // ── Hand-over: best match + checklist
    const m = await call(S.it, 'GET', `/assets/requests/${r1.data.id}/matches`);
    check('Matches: the available monitor', m.data?.length === 1 && m.data[0].id === mon.id);
    const ho = await call(S.it, 'POST', `/assets/${mon.id}/assign`, { employeeId: P.emp.id, requestId: r1.data.id, checklist: ['Power and display cables'] });
    check('Hand over with the checklist noted', ho.data?.holder?.notes?.includes('✓ Power and display cables'));

    // ── Manager asks for their team (skips the manager step)
    const team = await call(S.boss, 'GET', '/assets/requests/preview');
    check('Manager sees their team to ask for', team.data?.team.some((x) => x.id === P.emp.id) && team.data.team.some((x) => x.id === P.peer.id));
    const r2 = await call(S.boss, 'POST', '/assets/requests', { typeId: types.Headset.id, reason: 'For Peer’s client calls', forEmployeeId: P.peer.id });
    check('Request for a team member → straight to HR (no lead, manager asked)', r2.status === 201 && r2.data.stage === 'HR' && r2.data.requestedBy.id === P.boss.id, JSON.stringify(r2.body).slice(0, 200));
    check('Not someone in my team → 403', (await call(S.emp, 'POST', '/assets/requests', { typeId: types.Headset.id, reason: 'For my colleague', forEmployeeId: P.peer.id })).status === 403);
    check('The asker sees it under “mine”', (await call(S.boss, 'GET', '/assets/requests?view=mine')).body.data?.some((x) => x.id === r2.data.id));
    const rj = await call(S.hr, 'POST', `/assets/requests/${r2.data.id}/reject`, { reason: 'Use the meeting room headsets' });
    check('HR rejects → later step skipped', rj.data?.status === 'REJECTED' && rj.data.steps.find((s) => s.stage === 'IT').status === 'SKIPPED');

    // ── Loans
    check('Type not lendable → 400', (await call(S.peer, 'POST', '/assets/requests', { typeId: types['ID card'].id, reason: 'Visitor card for a week', kind: 'LOAN', loanUntil: addDays(today, 5) })).status === 400);
    check('Longer than the type allows → 400', (await call(S.peer, 'POST', '/assets/requests', { typeId: types.Laptop.id, reason: 'Laptop for a workshop', kind: 'LOAN', loanUntil: addDays(today, 30) })).status === 400);
    const loan = await call(S.peer, 'POST', '/assets/requests', { typeId: types.Laptop.id, reason: 'Laptop for a workshop', kind: 'LOAN', loanUntil: addDays(today, 7) });
    check('Loan request (peer → manager first)', loan.data?.kind === 'LOAN' && loan.data.loanUntil === addDays(today, 7) && loan.data.stage === 'MANAGER');
    for (const s of [S.boss, S.hr, S.it]) await call(s, 'POST', `/assets/requests/${loan.data.id}/approve`, {});
    const ml = await call(S.it, 'GET', `/assets/requests/${loan.data.id}/matches`);
    check('Best match first: the new laptop', ml.data?.[0]?.id === lapNew.id, JSON.stringify(ml.data?.map((x) => x.tag)));
    const lo = await call(S.it, 'POST', `/assets/${lapNew.id}/assign`, { employeeId: P.peer.id, requestId: loan.data.id });
    check('Loan handed over with a return date', lo.data?.holder?.dueBack === addDays(today, 7));

    // ── Register views & attention
    const sum = await call(S.it, 'GET', '/assets/summary');
    check('Summary: attention (old, unconfirmed, loans due, out of stock)', sum.data?.attention.old === 1 && sum.data.attention.unconfirmed === 2 && sum.data.attention.loansDue === 1 && sum.data.attention.outOfStock.some((o) => o.name === 'Laptop'), JSON.stringify(sum.data?.attention));
    check('Attention filter: old', (await call(S.it, 'GET', '/assets?attention=old')).body.data?.[0]?.id === lapOld.id);
    check('Search by holder name', (await call(S.it, 'GET', '/assets?search=peer')).body.data?.some((a) => a.id === lapNew.id));
    const people = await call(S.it, 'GET', '/assets/people');
    check('By person', people.body.data?.length === 2 && people.body.data.find((x) => x.employee.id === P.peer.id).assets[0].dueBack === addDays(today, 7));
    const loc = await p.officeLocation.create({ data: { companyId: cid, name: 'Bengaluru' } });
    check('Bulk move to a location', (await call(S.it, 'POST', '/assets/bulk/move', { ids: [lapOld.id, mon.id], locationId: loc.id })).data?.moved === 2);

    // ── Import
    const bad = await call(S.it, 'POST', '/assets/import', { csv: 'type,name,tag\nLaptop,Dell XPS,\nPrinter,HP,\nMonitor,LG,MON-0001\n' });
    check('Import: errors reported, nothing saved', bad.data?.created === 0 && bad.data.errors.length === 2, JSON.stringify(bad.data));
    const good = await call(S.it, 'POST', '/assets/import', { csv: 'type,name,tag,brand,model,serial,purchase date,cost\nLaptop,Dell XPS,,Dell,XPS 13,SN1,2026-01-10,95000\nKBM,"Logitech set, wireless",,Logitech,MK270,,,\n' });
    check("Import: rows created (quoted commas too)", good.data?.created === 2, JSON.stringify(good.data));

    // ── Repairs & documents
    const back = await call(S.it, 'POST', `/assets/${lapOld.id}/status`, { status: 'IN_REPAIR', issue: 'Keyboard not working', vendor: 'Lenovo service' });
    check('Send for repair → repair job open', back.data?.status === 'IN_REPAIR' && back.data.openRepair?.issue === 'Keyboard not working');
    const fixed = await call(S.it, 'POST', `/assets/${lapOld.id}/status`, { status: 'AVAILABLE', repairCost: 4500 });
    check('Back from repair → job closed with the cost', fixed.data?.status === 'AVAILABLE' && fixed.data.repairs[0].endedAt && fixed.data.repairs[0].costPaise === 450000);
    const form = new FormData();
    form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'invoice.pdf');
    const up = await fetch(`${B}/assets/${lapOld.id}/documents`, { method: 'POST', headers: { authorization: S.it.authorization }, body: form }).then((r) => r.json());
    const doc = up.data?.documents?.[0];
    check('Upload a document', doc?.name === 'invoice.pdf');
    const dl = await fetch(`${B}/assets/${lapOld.id}/documents/${doc.id}`, { headers: { authorization: S.it.authorization } });
    check('Open the document', dl.status === 200 && Buffer.from(await dl.arrayBuffer()).equals(PDF));
    check('Employee can’t open documents → 404', (await fetch(`${B}/assets/${lapOld.id}/documents/${doc.id}`, { headers: { authorization: S.emp.authorization } })).status === 404);
    check('Remove the document', (await call(S.it, 'DELETE', `/assets/${lapOld.id}/documents/${doc.id}`)).data?.documents.length === 0);

    // ── My assets: problem & return
    const mine = (await call(S.emp, 'GET', '/assets/mine')).data.current[0];
    const pr = await call(S.emp, 'POST', `/assets/assignments/${mine.id}/problem`, { description: 'Flickers every few minutes after waking up' });
    check('Report a problem → IT ticket linked to the asset', pr.data?.ticket?.number >= 1 && (await p.ticket.findFirst({ where: { companyId: cid } }))?.assetId === mon.id, JSON.stringify(pr.body));
    check('Open ticket shows on My assets', (await call(S.emp, 'GET', '/assets/mine')).data.current[0].openTickets.length === 1);
    check('Not my asset → 404', (await call(S.peer, 'POST', `/assets/assignments/${mine.id}/problem`, { description: 'Something is wrong here' })).status === 404);
    check('Ask to return it → IT told', (await call(S.emp, 'POST', `/assets/assignments/${mine.id}/return-request`, { note: 'Moving to remote work' })).data?.sent && (await eventually(async () => (await p.notification.count({ where: { userId: P.it.user.id, type: 'asset.return_requested' } })) === 1)));

    // ── Starter kits
    const kits = await call(S.it, 'GET', '/assets/kits');
    check('Default kits: everyone + managers & senior leads', kits.data?.length === 2 && kits.data[0].isBase && kits.data[0].items.map((i) => i.type.name).sort().join() === 'ID card,Laptop');
    const eng = await p.department.create({ data: { companyId: cid, name: 'Engineering', code: 'ENG' } });
    const sr = await p.designation.create({ data: { companyId: cid, name: 'Senior Engineer' } });
    check('A kit rule needs someone to apply to → 400', (await call(S.it, 'POST', '/assets/kits', { name: 'Nobody', items: [{ typeId: types.Phone.id, qty: 1 }] })).status === 400);
    check('Add an Engineering rule', (await call(S.it, 'POST', '/assets/kits', { name: 'Engineering', departmentIds: [eng.id], items: [{ typeId: types['Keyboard & mouse'].id, qty: 1 }] })).status === 201);
    const prev = await call(S.hr, 'GET', `/assets/kits/preview?departmentId=${eng.id}`);
    check('Preview for an engineer', prev.data?.items.map((i) => i.name).sort().join() === 'ID card,Keyboard & mouse,Laptop', JSON.stringify(prev.data));
    const hire = await call(S.hr, 'POST', '/employees', { firstName: 'Ishaan', lastName: 'V', email: `ishaan@${SLUG}.test`, joiningDate: addDays(today, 7), departmentId: eng.id });
    check('HR adds an engineer', hire.status === 201, JSON.stringify(hire.body).slice(0, 200));
    const ishaan = hire.data?.id ?? hire.data?.employee?.id;
    check('Kit created straight away (approved, for IT)', await eventually(async () => (await p.assetRequest.count({ where: { employeeId: ishaan, source: 'KIT', status: 'APPROVED' } })) === 3));
    const joiners = await call(S.it, 'GET', '/assets/requests?view=joiners');
    check('Joiners to prepare (needed by the joining date)', joiners.body.data?.length === 3 && joiners.body.data.every((r) => r.neededBy === addDays(today, 7) && r.steps.length === 0));
    check('IT told to prepare it', await eventually(async () => (await p.notification.count({ where: { userId: P.it.user.id, type: 'asset.kit' } })) === 1));
    const promo = await call(S.hr, 'PATCH', `/employees/${P.peer.id}`, { designationId: sr.id });
    check('Promotion to “Senior …” → monitor', promo.status === 200 && (await eventually(async () => (await p.assetRequest.count({ where: { employeeId: P.peer.id, source: 'KIT', typeId: types.Monitor.id } })) === 1)));

    // ── Returns
    await p.employee.update({ where: { id: P.emp.id }, data: { employmentStatus: 'NOTICE_PERIOD', terminationDate: new Date(`${addDays(today, 20)}T00:00:00Z`) } });
    const ret = await call(S.hr, 'GET', '/assets/returns');
    check('Returns: leaver with assets, loans due', ret.data?.leavers[0]?.employee.id === P.emp.id && ret.data.leavers[0].assets.length === 1 && ret.data.loans.length === 1, JSON.stringify(ret.data).slice(0, 300));

    // ── Yearly check
    check('Only IT starts a check → 403', (await call(S.hr, 'POST', '/assets/checks', { name: 'Check 2026', dueOn: addDays(today, 10) })).status === 403);
    const st = await call(S.it, 'POST', '/assets/checks', { name: 'Check 2026', dueOn: addDays(today, 10) });
    check('IT starts the yearly check', st.data?.open?.name === 'Check 2026' && st.data.progress.people === 2, JSON.stringify(st.data));
    check('A second one at the same time → 409', (await call(S.it, 'POST', '/assets/checks', { name: 'Again', dueOn: addDays(today, 10) })).status === 409);
    const my = await call(S.peer, 'GET', '/assets/checks/mine');
    check('Peer sees their item to confirm', my.data?.items.length === 1 && my.data.done === false);
    check('A problem needs a note → 400', (await call(S.peer, 'POST', '/assets/checks/answers', { answers: [{ assignmentId: my.data.items[0].assignmentId, answer: 'PROBLEM' }] })).status === 400);
    const ans = await call(S.peer, 'POST', '/assets/checks/answers', { answers: [{ assignmentId: my.data.items[0].assignmentId, answer: 'PROBLEM', note: 'Battery swollen' }] });
    check('Peer answers → done', ans.data?.done === true);
    check('Can’t answer for someone else’s asset → 404', (await call(S.peer, 'POST', '/assets/checks/answers', { answers: [{ assignmentId: mine.id, answer: 'HAVE' }] })).status === 404);
    const ov = await call(S.hr, 'GET', '/assets/checks');
    check('Progress: 1 reported, 1 not answered', ov.data?.progress.reported === 1 && ov.data.progress.notAnswered === 1 && ov.data.progress.reports[0].note === 'Battery swollen' && ov.data.progress.reportsTotal === 1, JSON.stringify(ov.data?.progress));
    const cr = await call(S.hr, 'GET', `/assets/checks/${st.data.open.id}/reports?limit=1`);
    check('"See all" problems, a page at a time', cr.data?.rows.length === 1 && cr.data.rows[0].note === 'Battery swollen' && cr.data.meta.total === 1, JSON.stringify(cr.data?.meta));
    check('Problems of an unknown check → 404', (await call(S.hr, 'GET', '/assets/checks/00000000-0000-4000-8000-000000000000/reports')).status === 404);
    check('Remind the rest', (await call(S.it, 'POST', `/assets/checks/${st.data.open.id}/remind`)).data?.reminded === 1);
    check('Close the check', (await call(S.it, 'POST', `/assets/checks/${st.data.open.id}/close`)).data?.open === null);

    // ── Loan reminders
    const { AssetRemindersService } = require(path.resolve('dist/apps/api/src/modules/assets/asset-reminders.service.js'));
    const sent = [];
    const notifications = { companyWideApprovers: async () => [P.it.user.id], notify: async (n) => { if (n.companyId === cid) sent.push(n); return n.userIds.length; } };
    const rem = new AssetRemindersService(p, notifications, { get: () => 'false' });
    await rem.run(new Date(`${addDays(today, 6)}T06:00:00Z`));
    check('Loan: reminder 2 days before', sent.some((n) => n.type === 'asset.loan_due' && n.userIds.includes(P.peer.user.id)));
    sent.length = 0;
    await rem.run(new Date(`${addDays(today, 9)}T06:00:00Z`));
    check('Loan overdue: holder and IT', sent.some((n) => n.type === 'asset.loan_overdue' && n.userIds.includes(P.peer.user.id) && n.userIds.includes(P.it.user.id)));
  } catch (e) {
    console.error('ERROR', e.stack);
    t.results.push(false);
  } finally {
    restoreMail();
    await dropCompany(SLUG);
    const ok = t.done();
    await p.$disconnect();
    process.exitCode = ok ? 0 : 1;
  }
})();
