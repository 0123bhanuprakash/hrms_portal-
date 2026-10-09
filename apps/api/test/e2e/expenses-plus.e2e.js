// Expenses, round 2: over-limit with a reason, monthly caps, flags, questions without sending back,
// rejecting single items, bulk approve, my summary, copy a claim, richer spend report.
const { B, prisma: p, suite, call, makeCompany, dropCompany, mailSnapshot, todayIn, addDays } = require('./lib');

const SLUG = 'expenses-plus-e2e';
const t = suite('expenses-plus');
const { check } = t;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
/** Notifications go out in the background — give them a moment */
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
      ['mem', ['employee'], 'boss'],
      ['peer', ['employee'], 'boss'],
      ['fin', ['employee', 'finance']],
      ['hr', ['employee', 'hr']],
    ]);
    const item = (s, claimId, fields, receipt = true) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.append(k, String(v));
      if (receipt) f.append('receipt', new Blob([PDF], { type: 'application/pdf' }), 'bill.pdf');
      return fetch(`${B}/expenses/claims/${claimId}/items`, { method: 'POST', headers: { authorization: s.authorization }, body: f }).then(async (r) => {
        const j = await r.json().catch(() => ({}));
        return { status: r.status, data: j.data, body: j };
      });
    };

    // ── Categories: a monthly cap
    const cats = Object.fromEntries((await call(S.mem, 'GET', '/expenses/categories')).data.map((c) => [c.name, c]));
    const food = cats.Food;
    const up = await call(S.hr, 'PATCH', `/expenses/categories/${food.id}`, { name: 'Food', description: food.description, maxPerItem: 1500, receiptRequiredAbove: 300, maxPerMonth: 2000 });
    check('HR sets a monthly cap', up.data?.maxPerMonthPaise === 200000, JSON.stringify(up.body).slice(0, 200));

    // ── Over the limit: allowed with a reason
    const c1 = (await call(S.mem, 'POST', '/expenses/claims', { title: 'Client dinner week' })).data;
    const no = await item(S.mem, c1.id, { categoryId: food.id, date: today, description: 'Team dinner', amount: 1800 });
    check('Over the per-item limit without a reason → 400', no.status === 400 && /add a reason/.test(no.body.detail), no.body.detail);
    const yes = await item(S.mem, c1.id, { categoryId: food.id, date: today, description: 'Team dinner', amount: 1800, overLimitReason: 'Client joined, 5 people' });
    const big = yes.data?.items.find((i) => i.description === 'Team dinner');
    check('…with a reason → saved and flagged', yes.status === 201 && big?.overLimit === true && big.overLimitReason === 'Client joined, 5 people', JSON.stringify(yes.body).slice(0, 300));
    const cap = await item(S.mem, c1.id, { categoryId: food.id, date: today, description: 'Snacks', amount: 250 }, false);
    check('Monthly cap reached → needs a reason', cap.status === 400 && /capped at ₹2,000 a month/.test(cap.body.detail), cap.body.detail);
    const capOk = await item(S.mem, c1.id, { categoryId: food.id, date: today, description: 'Snacks', amount: 250, overLimitReason: 'Late release night' }, false);
    check('…with a reason → saved', capOk.status === 201 && capOk.data.items.length === 2);
    await item(S.mem, c1.id, { categoryId: cats.Travel.id, date: today, description: 'Cab to client', amount: 600 });

    const sum0 = await call(S.mem, 'GET', '/expenses/claims/summary');
    check('Summary: caps used, drafts don’t count as claimed', sum0.data?.limits.find((l) => l.category.id === food.id)?.usedPaise === 205000 && sum0.data.thisMonth.paise === 0 && sum0.data.drafts === 1, JSON.stringify(sum0.data));

    check('Submit', (await call(S.mem, 'POST', `/expenses/claims/${c1.id}/submit`)).data?.status === 'PENDING');
    const queue = await call(S.boss, 'GET', '/expenses/claims?view=review');
    const inQueue = queue.body.data?.find((c) => c.id === c1.id);
    check('Approver sees the over-limit flag', inQueue?.flags.includes('over_limit'), JSON.stringify(inQueue?.flags));

    // ── Questions don't send the claim back
    check('Finance can’t ask before the manager step → 403', (await call(S.fin, 'POST', `/expenses/claims/${c1.id}/questions`, { body: 'Who joined?' })).status === 403);
    check('A colleague can’t ask → 403', [403, 404].includes((await call(S.peer, 'POST', `/expenses/claims/${c1.id}/questions`, { body: 'Who joined?' })).status));
    const q = await call(S.boss, 'POST', `/expenses/claims/${c1.id}/questions`, { body: 'Who was at the dinner?' });
    check('Manager asks — claim still waiting', q.data?.status === 'PENDING' && q.data.questionOpen && q.data.comments.length === 1 && q.data.comments[0].kind === 'QUESTION', JSON.stringify(q.body).slice(0, 300));
    check('Employee told', await eventually(async () => (await p.notification.count({ where: { userId: P.mem.user.id, type: 'expense.question' } })) === 1));
    check('“Needs me” for the employee', (await call(S.mem, 'GET', '/expenses/claims?view=mine&filter=needs_me')).body.data?.length === 1);
    check('“Questions I asked” for the manager', (await call(S.boss, 'GET', '/expenses/claims?view=review&filter=asked')).body.data?.length === 1);
    check('Someone else can’t reply → 404', (await call(S.peer, 'POST', `/expenses/claims/${c1.id}/replies`, { body: 'Me' })).status === 404);
    const rp = await call(S.mem, 'POST', `/expenses/claims/${c1.id}/replies`, { body: 'Northwind’s Anil and Sujata, plus our team of 3' });
    check('Employee replies — question closed', rp.data?.questionOpen === false && rp.data.comments.length === 2 && rp.data.comments[1].mine, JSON.stringify(rp.body).slice(0, 200));
    check('Manager told about the reply', await eventually(async () => (await p.notification.count({ where: { userId: P.boss.user.id, type: 'expense.reply' } })) === 1));

    // ── Reject single items
    const full = (await call(S.boss, 'GET', `/expenses/claims/${c1.id}`)).data;
    const snacks = full.items.find((i) => i.description === 'Snacks');
    check('Rejecting every item → 400 (send it back instead)', (await call(S.boss, 'POST', `/expenses/claims/${c1.id}/approve`, { rejectItems: full.items.map((i) => ({ itemId: i.id, reason: 'not allowed' })) })).status === 400);
    const ap = await call(S.boss, 'POST', `/expenses/claims/${c1.id}/approve`, { rejectItems: [{ itemId: snacks.id, reason: 'Snacks aren’t covered' }] });
    const rejected = ap.data?.items.find((i) => i.id === snacks.id);
    check('Manager approves, rejecting one item', ap.data?.steps[0].status === 'APPROVED' && rejected?.rejected && rejected.adjustReason === 'Snacks aren’t covered' && ap.data.totals.approvedPaise === 180000 + 60000, JSON.stringify(ap.data?.totals));

    // ── Bulk approve
    const mk = async (title, amount) => {
      const res = await call(S.mem, 'POST', '/expenses/claims', { title });
      const c = res.data;
      await item(S.mem, c.id, { categoryId: cats.Travel.id, date: today, description: title, amount });
      await call(S.mem, 'POST', `/expenses/claims/${c.id}/submit`);
      return c.id;
    };
    const c2 = await mk('Train to Pune', 900);
    const c3 = await mk('Airport cab', 700);
    const bulk = await call(S.boss, 'POST', '/expenses/claims/approve-bulk', { ids: [c2, c3, c1.id] });
    check('Bulk approve: two at my step, the third skipped', bulk.data?.approved === 2 && bulk.data.skipped.length === 1 && bulk.data.skipped[0].id === c1.id, JSON.stringify(bulk.body));
    check('Bulk approve can’t approve your own', (await call(S.mem, 'POST', '/expenses/claims/approve-bulk', { ids: [c2] })).data?.approved === 0);

    // ── Finance + HR (every claim) → approved
    await call(S.hr, 'POST', `/expenses/claims/${c1.id}/approve`, {});
    const done = await call(S.fin, 'POST', `/expenses/claims/${c1.id}/approve`, {});
    check('HR and Finance both approve → APPROVED, rejected item not paid', done.data?.status === 'APPROVED' && done.data.totals.approvedPaise === 240000, JSON.stringify(done.data?.totals));

    // ── Copy a claim (monthly bills)
    const cp = await call(S.mem, 'POST', `/expenses/claims/${c2}/copy`);
    check('Copy → new draft, same items, no receipts', cp.status === 201 && cp.data.status === 'DRAFT' && cp.data.items.length === 1 && !cp.data.items[0].hasReceipt && cp.data.id !== c2, JSON.stringify(cp.body).slice(0, 200));
    check('Can’t copy someone else’s claim → 404', (await call(S.peer, 'POST', `/expenses/claims/${c2}/copy`)).status === 404);

    const sum1 = await call(S.mem, 'GET', '/expenses/claims/summary');
    check('Summary: waiting, to be paid, this month', sum1.data?.waiting.claims === 2 && sum1.data.toBePaid.paise === 240000 && sum1.data.thisMonth.paise === 205000 + 60000 + 90000 + 70000 && sum1.data.needsMe === 0, JSON.stringify(sum1.data));

    // ── Report
    const rep = await call(S.fin, 'GET', `/expenses/report?from=${addDays(today, -30)}&to=${today}`);
    const r = rep.data;
    check('Report: exceptions', r?.exceptions.overLimit.items === 2 && r.exceptions.rejectedItems.items === 1 && r.exceptions.rejectedItems.paise === 25000, JSON.stringify(r?.exceptions));
    check('Report: month, department, pipeline, timing', r?.byMonth.length >= 1 && r.byDepartment.length >= 1 && r.pipeline.waitingPaise === 160000 && r.pipeline.toBePaidPaise === 240000 && typeof r.timing.avgDaysToApprove === 'number', JSON.stringify({ m: r?.byMonth, p: r?.pipeline, t: r?.timing }));
    check('Report: rows per breakdown counted', r?.breakdownCounts && r.breakdownCounts.employee >= 1 && r.byEmployee.filter((x) => x.key !== '__others').length === Math.min(10, r.breakdownCounts.employee), JSON.stringify(r?.breakdownCounts));
    const bd = await call(S.fin, 'GET', `/expenses/report/breakdown?from=${addDays(today, -30)}&to=${today}&by=employee&limit=1`);
    check('Report: "See all" one breakdown, a page at a time', bd.data?.rows.length === 1 && bd.data.meta.total === r.breakdownCounts.employee && bd.data.rows[0].approvedPaise === r.byEmployee[0].approvedPaise, JSON.stringify(bd.data?.meta));
    check('Report: unknown breakdown → 400', (await call(S.fin, 'GET', `/expenses/report/breakdown?from=${today}&to=${today}&by=salary`)).status === 400);
    const csv = await fetch(`${B}/expenses/export?from=${addDays(today, -30)}&to=${today}`, { headers: S.fin });
    check('CSV has the over-limit reason', (await csv.text()).includes('Client joined, 5 people'));
    void company;
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
