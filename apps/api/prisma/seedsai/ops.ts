/* Payroll, expenses, assets and the helpdesk. */
import { type Ctx, type Row, employedOn, fullName, p, salaryParts } from './org';
import { D, PRIVATE, addDays, chunked, daysBetween, eachDay, pdf, pick, rint, rnd, stamp, uuid, weekday, writeFile } from './util';

// ─── Payroll ────────────────────────────────────────────────

function annualTax(taxable: number, regime: 'NEW' | 'OLD') {
  if (regime === 'NEW') {
    const t = taxable - 75_000;
    if (t <= 1_200_000) return 0;
    const slabs: Array<[number, number]> = [[400_000, 0], [800_000, 0.05], [1_200_000, 0.1], [1_600_000, 0.15], [2_000_000, 0.2], [2_400_000, 0.25], [Infinity, 0.3]];
    let tax = 0, prev = 0;
    for (const [cap, rate] of slabs) { if (t > prev) tax += (Math.min(t, cap) - prev) * rate; prev = cap; }
    return tax * 1.04;
  }
  const t = taxable - 50_000 - 150_000 - 25_000; // standard deduction, 80C, 80D
  if (t <= 500_000) return 0;
  let tax = 0;
  if (t > 250_000) tax += (Math.min(t, 500_000) - 250_000) * 0.05;
  if (t > 500_000) tax += (Math.min(t, 1_000_000) - 500_000) * 0.2;
  if (t > 1_000_000) tax += (t - 1_000_000) * 0.3;
  return tax * 1.04;
}

export async function seedPayroll(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  const regime = new Map((await prisma.employeeStatutory.findMany({ where: { companyId }, select: { employeeId: true, taxRegime: true, isEsiEnabled: true } })).map((s) => [s.employeeId, s]));
  const months: Array<[number, number]> = [];
  for (let y = 2025, m = 10; y < 2026 || (y === 2026 && m <= 9); m === 12 ? (y++, (m = 1)) : m++) months.push([y, m]);
  const runner = p(ctx, 'hr5').userId;
  const lop = new Map<string, number>(); // `${key}|${yyyy-mm}` → unpaid days
  for (const [k, l] of ctx.leaveOn!) {
    if (l.code !== 'LOP') continue;
    const [key, day] = k.split('|') as [string, string];
    lop.set(`${key}|${day.slice(0, 7)}`, (lop.get(`${key}|${day.slice(0, 7)}`) ?? 0) + (l.half ? 0.5 : 1));
  }
  let slips = 0;
  for (const [y, m] of months) {
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`, -1);
    const days = daysBetween(first, last) + 1;
    let processed = last;
    while (weekday(processed) === 0 || weekday(processed) === 6) processed = addDays(processed, -1);
    processed = addDays(processed, -2);
    const run = await prisma.payrollRun.create({ data: { companyId, month: m, year: y, status: 'COMPLETED', processedAt: stamp(processed, 16, 30), processedBy: runner, createdAt: stamp(addDays(processed, -4), 11) } });
    const rows: object[] = [];
    let gross = 0, ded = 0, net = 0;
    for (const r of ctx.people.values()) {
      if (r.join > last || (r.lastDay && r.lastDay < first)) continue;
      const ctc = r.ctcBefore && first < '2026-04-01' ? r.ctcBefore : r.ctc;
      const intern = r.type === 'IN';
      const parts = salaryParts(ctc, intern);
      const startK = r.join > first ? r.join : first;
      const endK = r.lastDay && r.lastDay < last ? r.lastDay : last;
      const paidDays = daysBetween(startK, endK) + 1 - (lop.get(`${r.key}|${first.slice(0, 7)}`) ?? 0);
      const f = paidDays / days;
      const basic = Math.round(parts.basicSalary * f), hra = Math.round(parts.hra * f), special = Math.round(parts.specialAllowance * f), other = Math.round(parts.otherAllowances * f);
      const bonus = m === 10 && y === 2025 && !intern ? 5_000 : m === 4 && y === 2026 && !intern && rnd(r.key + 'bonus') < 0.35 ? Math.round(parts.basicSalary * 0.5) : 0;
      const grossE = basic + hra + special + other + bonus;
      const st = regime.get(r.id);
      const pf = intern ? 0 : Math.round(Math.min(basic, 15_000) * 0.12);
      const esi = st?.isEsiEnabled ? Math.round(grossE * 0.0075) : 0;
      const pt = grossE > 20_000 ? (r.loc === 'PUN' && m === 2 ? 300 : 200) : grossE > 15_000 ? 150 : 0;
      const tds = intern ? 0 : Math.round(annualTax(ctc - (Math.min(0.4 * ctc / 12, 15_000) * 0.12 * 12), (st?.taxRegime ?? 'NEW') as 'NEW' | 'OLD') / 12 * f);
      const loan = ['e15', 'it3'].includes(r.key) && first >= '2026-02-01' && first <= '2026-11-01' ? 5_000 : 0;
      const totalD = pf + esi + pt + tds + loan;
      const viewed = rnd(r.key + first) < 0.7;
      rows.push({
        companyId, payrollRunId: run.id, employeeId: r.id, month: m, year: y, status: viewed ? 'VIEWED' : 'PUBLISHED',
        basicSalary: basic, hra, specialAllowance: special, otherAllowances: other, bonus, grossEarnings: grossE,
        employeePf: pf, employeeEsi: esi, professionalTax: pt, tds, loanEmi: loan, totalDeductions: totalD, netSalary: grossE - totalD,
        employerPf: pf, employerEsi: st?.isEsiEnabled ? Math.round(grossE * 0.0325) : 0, ctc: Math.round(ctc / 12),
        taxRegime: st?.taxRegime ?? 'NEW', publishedAt: stamp(addDays(processed, 1), 10), createdAt: stamp(processed, 16, 30),
      });
      gross += grossE; ded += totalD; net += grossE - totalD;
    }
    await prisma.payslip.createMany({ data: rows as never });
    await prisma.payrollRun.update({ where: { id: run.id }, data: { totalEmployees: rows.length, totalGross: gross, totalDeductions: ded, totalNet: net } });
    slips += rows.length;
  }
  ctx.count.payslips = slips;
  void today;
}

// ─── Expenses ───────────────────────────────────────────────

const CATS: Array<[string, string, number | null, number | null, number | null]> = [
  // name, description, max per item, receipt above, max per month (₹)
  ['Local travel', 'Cabs and autos for client visits and late nights', 3_000, 500, 8_000],
  ['Outstation travel', 'Flights and trains for client travel', 25_000, 0, null],
  ['Hotel stay', 'Per night, for outstation travel', 6_000, 0, null],
  ['Client meals', 'Lunch or dinner with clients', 4_000, 1_000, 10_000],
  ['Internet & phone', 'Home broadband / mobile bill (monthly)', 1_500, 0, 1_500],
  ['Training & certifications', 'Courses and exam fees approved by your manager', 40_000, 0, null],
  ['WFH setup & supplies', 'Chairs, keyboards, stationery', 5_000, 500, null],
  ['Team outing', 'Team lunches and celebrations (per event)', 15_000, 0, null],
];

export async function seedExpenses(ctx: Ctx) {
  const { prisma, companyId, today, start } = ctx;
  const cat: Record<string, string> = {};
  for (const [i, [name, description, max, receipt, month]] of CATS.entries()) {
    cat[name] = (await prisma.expenseCategory.create({ data: { companyId, name, description, maxPerItemPaise: max === null ? null : max * 100, receiptRequiredAbovePaise: receipt === null ? null : receipt * 100, maxPerMonthPaise: month === null ? null : month * 100, sortOrder: (i + 1) * 10 } })).id;
  }
  const finance = ['fi1', 'fi2', 'fi4'];
  const hr = ['hr1', 'hr2', 'hrm'];
  const claims: Array<{ r: Row; title: string; project: string | null; day: string; items: Array<[string, string, number, string?]> }> = [];
  const people = [...ctx.people.values()];
  // Monthly internet claims for a handful of people
  for (const k of ['e01', 'e07', 'e15', 'e23', 'e32', 'e39', 'e45', 'l1', 'l4', 'l6', 'dv1', 'dv3', 'ux5', 'sc1']) {
    const r = p(ctx, k);
    for (let m = 0; m < 12; m++) {
      const day = addDays('2025-10-05', m * 30 + rint(k + m, 0, 6));
      if (!employedOn(r, day) || day > today || rnd(k + 'skip' + m) < 0.15) continue;
      const amount = pick(k + 'isp', [799, 999, 1_179, 1_499, 1_299]);
      const monthName = D(addDays(day, -10)).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });
      claims.push({ r, title: `Internet — ${monthName}`, project: null, day, items: [['Internet & phone', `${pick(k + 'isp2', ['ACT Fibernet', 'Airtel Xstream', 'JioFiber', 'Hathway'])} bill — ${monthName}`, amount]] });
    }
  }
  // Client travel and meals
  const trips: Array<[string, string | null, string, string, Array<[string, string, number, string?]>]> = [
    ['pm1', 'HELIX', '2025-11-19', 'Northstar HQ visit — Mumbai', [['Outstation travel', 'Flight HYD → BOM (IndiGo 6E 5218)', 6_480], ['Hotel stay', 'Trident BKC, 2 nights', 11_200], ['Client meals', 'Dinner with Northstar merchandising team', 3_850], ['Local travel', 'Airport and office cabs', 2_140]]],
    ['l1', 'HELIX', '2026-02-11', 'UAT workshop — Northstar Mumbai', [['Outstation travel', 'Flight HYD → BOM return', 9_120], ['Hotel stay', 'Hotel Sahara Star, 3 nights', 17_400], ['Local travel', 'Cabs during the workshop', 2_960]]],
    ['pm2', 'ORBIT', '2026-07-08', 'RBI audit review at Kaveri Bank, Chennai', [['Outstation travel', 'Flight HYD → MAA return', 8_740], ['Hotel stay', 'ITC Grand Chola, 1 night', 9_900, 'Only hotel near the bank with a room — city was full for the Formula 4 race.'], ['Client meals', 'Working lunch with the bank CISO', 2_200]]],
    ['dd1', 'ORBIT', '2026-03-24', 'Quarterly review — Kaveri Bank', [['Outstation travel', 'Flight HYD → MAA return', 7_960], ['Client meals', 'Dinner with Kaveri Bank leadership', 6_400, 'Dinner for 6 (bank CTO, CDO and team) after the QBR.']]],
    ['pm3', 'PULSE', '2026-01-21', 'MediCore clinic rollout — Nagpur', [['Outstation travel', 'Train PUNE → NGP (2A)', 2_315], ['Hotel stay', 'Radisson Blu Nagpur, 2 nights', 9_800], ['Local travel', 'Clinic visits (Ola)', 1_870]]],
    ['l9', 'ATLAS', '2026-04-08', 'Driver training — Swiftline Delhi hub', [['Outstation travel', 'Flight PNQ → DEL return', 11_360], ['Hotel stay', 'Lemon Tree Aerocity, 2 nights', 8_600], ['Client meals', 'Lunch with hub managers', 1_950]]],
    ['pm4', 'LEDGER', '2026-08-26', 'Motor STP go-live at Trident, Mumbai', [['Outstation travel', 'Train PUNE → CSMT (Deccan Queen)', 1_120], ['Local travel', 'Cabs in Mumbai', 1_560], ['Client meals', 'Go-live celebration lunch with Trident', 4_800, 'Celebration lunch for 8 — go-live of motor STP.']]],
    ['dd3', 'SPROUT', '2026-05-14', 'Sprout pilot demo — Bengaluru clients', [['Local travel', 'Cabs to two client offices', 1_740], ['Client meals', 'Lunch with pilot client team', 3_200]]],
    ['pm6', 'VERTEX', '2026-06-17', 'Phase 2 scoping — BrightPath Hyderabad', [['Outstation travel', 'Flight BLR → HYD return', 6_220], ['Hotel stay', 'Novotel HICC, 1 night', 6_900, 'Client asked for an early 8 am workshop at HICC.'], ['Local travel', 'Airport cabs', 1_480]]],
    ['ceo', null, '2026-02-03', 'NASSCOM Technology & Leadership Forum', [['Outstation travel', 'Flight HYD → BOM return', 12_400], ['Hotel stay', 'Jio World Convention Centre hotel, 2 nights', 23_000, 'Conference hotel — speaker accommodation not covered.']]],
    ['hr3', null, '2026-03-11', 'Campus hiring — NIT Warangal', [['Local travel', 'Car hire HYD ↔ Warangal', 5_400, 'Round trip by road, three of us in one car.'], ['Client meals', 'Lunch with the placement cell', 2_100]]],
    ['hr4', null, '2026-04-22', 'Campus hiring — PES University', [['Local travel', 'Cabs to campus (2 days)', 1_960], ['Client meals', 'Lunch with placement officers', 1_450]]],
  ];
  for (const [k, project, day, title, items] of trips) claims.push({ r: p(ctx, k), title, project, day, items });
  // Training, WFH setup, team outings, late-night cabs
  for (const [k, title, items, day] of [
    ['e39', 'AWS Data Engineer — Associate exam', [['Training & certifications', 'AWS certification exam fee', 12_800]], '2026-02-27'],
    ['dv2', 'CKA certification', [['Training & certifications', 'Certified Kubernetes Administrator exam', 34_500]], '2026-05-08'],
    ['sc1', 'OSCP course', [['Training & certifications', 'Offensive Security PEN-200 + exam', 46_000, 'Approved by Rhea — over the limit; company policy exception for security staff.']], '2026-06-19'],
    ['ux1', 'Config 2026 online pass', [['Training & certifications', 'Figma Config virtual pass', 8_300]], '2026-04-30'],
    ['e46', 'Deep learning specialisation', [['Training & certifications', 'Coursera Plus annual', 33_299]], '2025-11-10'],
    ['e20', 'Ergonomic chair for WFH days', [['WFH setup & supplies', 'Green Soul chair', 6_499, 'Doctor advised a lumbar-support chair.']], '2026-01-14'],
    ['e43', 'Keyboard and mouse', [['WFH setup & supplies', 'Logitech MK470 combo', 3_495]], '2026-07-03'],
    ['l2', 'Helix team lunch — store rollout done', [['Team outing', 'Lunch for 9 at Barbeque Nation', 13_950]], '2026-06-05'],
    ['l12', 'Sprout pilot celebration', [['Team outing', 'Team dinner — Toit, Indiranagar', 14_200]], '2026-02-06'],
    ['l13', 'Beacon hand-over dinner', [['Team outing', 'Dinner for the Beacon team', 9_800]], '2025-10-31'],
    ['l5', 'Payments squad offsite lunch', [['Team outing', 'Lunch at Ohri’s, Banjara Hills', 16_800, 'Squad of 6 plus two from the bank joined.']], '2026-09-04'],
  ] as Array<[string, string, Array<[string, string, number, string?]>, string]>) claims.push({ r: p(ctx, k), title, project: null, day, items });
  // Late-night cabs after release nights
  for (const k of ['e07', 'e08', 'l2', 'e11', 'e34', 'e36', 'l9', 'e45', 'dv3', 'dv1', 'e19', 'l5']) {
    for (let i = 0; i < rint(k + 'cabs', 1, 3); i++) {
      const day = addDays(start, rint(k + 'cab' + i, 15, Math.max(20, daysBetween(start, today) - 2)));
      const r = p(ctx, k);
      if (!employedOn(r, day)) continue;
      const n = rint(k + 'cabn' + i, 1, 3);
      claims.push({ r, title: `Late-night cabs — ${D(day).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}`, project: null, day, items: Array.from({ length: n }, (_, j) => ['Local travel', `Uber home after the release (${addDays(day, -j * 2)})`, rint(k + i + j, 320, 940)] as [string, string, number]) });
    }
  }

  const projectIds = ctx.projectId!;
  let made = 0;
  for (const c of claims.sort((a, b) => a.day.localeCompare(b.day))) {
    const seed = c.r.key + c.day + c.title;
    const age = daysBetween(c.day, today);
    const rr = rnd(seed + 'st');
    let status = age > 40 ? (rr < 0.07 ? 'REJECTED' : rr < 0.1 ? 'CANCELLED' : 'PAID') : age > 18 ? (rr < 0.55 ? 'PAID' : rr < 0.8 ? 'APPROVED' : rr < 0.9 ? 'PENDING' : 'REJECTED') : age > 4 ? (rr < 0.5 ? 'PENDING' : rr < 0.8 ? 'APPROVED' : 'DRAFT') : rr < 0.7 ? 'PENDING' : 'DRAFT';
    if (c.items.some((i) => i[3]) && status === 'REJECTED') status = 'PAID';
    const resubmitted = status === 'PAID' && rnd(seed + 'rs') < 0.06;
    const id = uuid();
    const submitted = addDays(c.day, rint(seed + 'sub', 1, 6));
    const submittedAt = status === 'DRAFT' ? null : stamp(submitted > today ? today : submitted, 18, rint(seed + 'sm', 0, 59));
    const route = ctx.route!(c.r, c.day);
    const mgr = route.first ?? 'hrm';
    const mgrAt = submittedAt ? stamp(addDays(submitted, rint(seed + 'ma', 0, 2)), 11, rint(seed + 'mm', 0, 59)) : null;
    const finAt = mgrAt ? stamp(addDays(submitted, rint(seed + 'fa', 2, 5)), 15, rint(seed + 'fm', 0, 59)) : null;
    const hrAt = mgrAt ? stamp(addDays(submitted, rint(seed + 'ha', 2, 6)), 12, rint(seed + 'hm', 0, 59)) : null;
    const pendingStage = status === 'PENDING' ? (rnd(seed + 'ps') < 0.5 ? 'MANAGER' : 'PARALLEL') : null;
    const finKey = pick(seed + 'fin', finance), hrKey = pick(seed + 'hr', hr);
    const paidAt = status === 'PAID' ? stamp(addDays(submitted, rint(seed + 'pd', 7, 14)), 14) : null;
    const lowered = (status === 'PAID' || status === 'APPROVED') && rnd(seed + 'low') < 0.08;
    const items = c.items.map(([category, description, amount, over], i) => {
      const receipt = rnd(seed + 'rc' + i) < 0.9 || category === 'Outstation travel';
      const rid = uuid();
      const key = receipt ? `${companyId}/expenses/${id}/${rid}.pdf` : null;
      if (key) writeFile(PRIVATE, key, pdf(pick(seed + 'vendor' + i, ['Tax invoice', 'Receipt', 'Booking confirmation']), [description, `Date: ${c.day}`, `Amount: Rs. ${amount.toLocaleString('en-IN')}`, `GSTIN 36AAACS${rint(seed + i, 1000, 9999)}Q1Z${rint(seed + i + 'z', 1, 9)}`, '', 'Sample receipt for testing']));
      return {
        id: rid, claimId: id, categoryId: cat[category], date: D(addDays(c.day, -i % 3)), description, amountPaise: amount * 100,
        approvedPaise: lowered && i === 0 ? Math.round(amount * 0.8) * 100 : null, adjustReason: lowered && i === 0 ? 'Capped at the policy rate for this city' : null, adjustedById: lowered && i === 0 ? p(ctx, finKey).userId : null,
        overLimitReason: over ?? null, receiptKey: key, receiptName: key ? `${description.slice(0, 40).replace(/[^\w\- ().]+/g, '')}.pdf` : null, receiptMime: key ? 'application/pdf' : null, receiptSize: key ? 900 : null,
        createdAt: stamp(c.day, 20, i),
      };
    });
    const round = status === 'DRAFT' ? 0 : resubmitted ? 2 : 1;
    const approvals: object[] = [];
    const mk = (r: number, stage: string, st: string, actor: string | null, at: Date | null, comments: string | null = null) => approvals.push({ claimId: id, round: r, stage, approverIds: stage === 'MANAGER' ? route.ids : [], label: stage === 'MANAGER' ? route.label : stage === 'FINANCE' ? 'Finance' : 'HR', status: st, actedById: actor ? p(ctx, actor).userId : null, comments, actedAt: at });
    if (resubmitted) {
      mk(1, 'MANAGER', 'APPROVED', mgr, mgrAt);
      mk(1, 'FINANCE', 'REJECTED', finKey, finAt, 'Receipt is unreadable — please upload a clearer copy.');
      mk(1, 'HR', 'PENDING', null, null);
    }
    if (round >= 1) {
      const rr2 = round;
      const mgrSt = status === 'PENDING' && pendingStage === 'MANAGER' ? 'PENDING' : status === 'REJECTED' && rnd(seed + 'rj') < 0.5 ? 'REJECTED' : status === 'CANCELLED' ? 'PENDING' : 'APPROVED';
      mk(rr2, 'MANAGER', route.ids.length ? mgrSt : 'SKIPPED', mgrSt === 'APPROVED' || mgrSt === 'REJECTED' ? mgr : null, mgrSt === 'APPROVED' || mgrSt === 'REJECTED' ? mgrAt : null, mgrSt === 'REJECTED' ? 'This should go on the Helix client bill, not internal — please raise it under the project.' : null);
      const parallelDone = status === 'PAID' || status === 'APPROVED';
      const finSt = parallelDone ? 'APPROVED' : status === 'REJECTED' && mgrSt !== 'REJECTED' ? 'REJECTED' : 'PENDING';
      mk(rr2, 'FINANCE', finSt, finSt !== 'PENDING' ? finKey : null, finSt !== 'PENDING' ? finAt : null, finSt === 'REJECTED' ? 'Personal expense — not reimbursable under the policy.' : null);
      const hrSt = parallelDone ? 'APPROVED' : status === 'PENDING' && pendingStage === 'PARALLEL' && rnd(seed + 'hrp') < 0.5 ? 'APPROVED' : 'PENDING';
      mk(rr2, 'HR', hrSt, hrSt === 'APPROVED' ? hrKey : null, hrSt === 'APPROVED' ? hrAt : null);
    }
    const question = status === 'PENDING' && rnd(seed + 'q') < 0.25;
    const total = c.items.reduce((n, i) => n + i[2], 0);
    await prisma.expenseClaim.create({
      data: {
        id, companyId, employeeId: c.r.id, title: c.title, projectId: c.project ? projectIds[c.project] : null, status: status as never, round, submittedAt,
        approvedAt: status === 'PAID' || status === 'APPROVED' ? new Date(Math.max(finAt!.getTime(), hrAt!.getTime())) : null,
        rejectionReason: status === 'REJECTED' ? 'See the approver’s comment.' : null,
        paidAt, paidById: paidAt ? p(ctx, pick(seed + 'payer', ['fi1', 'fi4'])).userId : null, paymentDate: paidAt ? D(paidAt.toISOString().slice(0, 10)) : null,
        paymentReference: paidAt ? `NEFT/${paidAt.toISOString().slice(2, 10).replace(/-/g, '')}/${rint(seed + 'ref', 100_000, 999_999)}` : null,
        questionOpenById: question ? p(ctx, finKey).userId : null,
        createdAt: stamp(c.day, 20, 15), updatedAt: paidAt ?? finAt ?? submittedAt ?? stamp(c.day, 20, 15),
        items: { create: items.map(({ claimId: _c, ...x }) => x) as never },
        approvals: { create: (approvals as Array<Record<string, unknown>>).map(({ claimId: _c, ...x }) => x) as never },
        comments: question ? { create: [{ authorId: p(ctx, finKey).userId, kind: 'QUESTION', body: total > 5_000 ? 'Can you share the boarding pass / booking confirmation as well?' : 'Was this for a client visit or an internal meeting?', createdAt: stamp(addDays(submitted, 1), 12) }] } : undefined,
      },
    });
    made++;
  }
  ctx.count.expenseClaims = made;
}

// ─── Assets ─────────────────────────────────────────────────

const TYPES: Array<[string, string, string, string, number | null, number | null, number, boolean, boolean, number | null, string[], string[]]> = [
  // name, prefix, icon, description, warranty months, replace after yrs, min stock, requestable, loanable, max loan days, fields, checklist
  ['Laptop', 'LAP', 'laptop', 'Work laptop (one per person)', 36, 4, 4, true, false, null, ['Processor', 'Memory', 'Storage'], ['Charger', 'Asset sticker', 'Disk encrypted', 'MDM enrolled']],
  ['Monitor', 'MON', 'monitor', 'Second screen for your desk', 36, 6, 3, true, false, null, ['Size'], ['Power cable', 'HDMI / USB-C cable']],
  ['Headset', 'HDS', 'headset', 'For calls and stand-ups', 12, 3, 5, true, false, null, [], []],
  ['Keyboard & mouse', 'KBM', 'keyboard', 'Wireless keyboard and mouse', 12, 3, 5, true, false, null, [], []],
  ['Phone', 'PHN', 'phone', 'Company phone (leaders, on-call)', 12, 3, 1, true, false, null, ['IMEI'], ['Charger', 'MDM enrolled']],
  ['Test device', 'TST', 'phone', 'Phones and tablets for app testing — borrow for a few days', 12, 3, 2, true, true, 14, ['OS version'], ['Charger']],
  ['SIM card', 'SIM', 'sim', 'Company SIM for on-call', null, null, 2, false, false, null, ['Number'], []],
  ['ID card', 'IDC', 'idcard', 'Office access card', null, null, 10, false, false, null, [], []],
  ['Projector', 'PRJ', 'box', 'Portable projector for workshops', 24, 5, 0, true, true, 7, [], ['Remote', 'HDMI cable']],
];

export async function seedAssets(ctx: Ctx) {
  const { prisma, companyId, today, start } = ctx;
  const typeId: Record<string, string> = {};
  for (const [i, [name, prefix, icon, description, warrantyMonths, replaceAfterYears, minStock, requestable, loanable, maxLoanDays, fields, checklist]] of TYPES.entries()) {
    typeId[name] = (await prisma.assetType.create({ data: { companyId, name, prefix, icon, description, warrantyMonths, replaceAfterYears, minStock, requestable, loanable, maxLoanDays, fields, checklist, sortOrder: (i + 1) * 10 } })).id;
  }
  const counters: Record<string, number> = {};
  const it = ['it1', 'it2', 'it3', 'it4', 'it5'];
  const itFor = (r: Row) => p(ctx, r.loc === 'BLR' ? 'it2' : r.loc === 'PUN' ? 'it4' : pick(r.key + 'it', ['it1', 'it3', 'it5']));
  const assets: object[] = [];
  const assigns: object[] = [];
  const repairs: object[] = [];
  const docs: object[] = [];
  const newAsset = (type: string, name: string, brand: string, model: string, bought: string, costRs: number, vendor: string, specs: object | null, status: string, condition: string, locKey: string, notes: string | null = null) => {
    const prefix = TYPES.find((t) => t[0] === type)![1];
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const tag = `${prefix}-${String(counters[prefix]).padStart(4, '0')}`;
    const id = uuid();
    const months = TYPES.find((t) => t[0] === type)![4];
    assets.push({ id, companyId, typeId: typeId[type], tag, name, brand, model, serialNumber: brand === '—' ? null : `${prefix.slice(0, 2)}${(hashStr(tag) % 10 ** 9).toString(36).toUpperCase()}`, purchaseDate: D(bought), purchaseCostPaise: costRs * 100, vendor, warrantyUntil: months ? D(addDays(bought, Math.round(months * 30.4))) : null, condition, status, locationId: ctx.loc[locKey], notes, specs, createdAt: stamp(bought < start ? addDays(start, -10) : bought, 12) });
    return { id, tag };
  };
  const give = (assetId: string, r: Row, from: string, back: string | null, cond = 'GOOD', extra: object = {}) => {
    const by = itFor(r);
    assigns.push({ companyId, assetId, employeeId: r.id, assignedById: by.userId, assignedAt: stamp(from, 10, rint(assetId, 0, 59)), conditionOut: cond, acknowledgedAt: from >= addDays(today, -3) && rnd(assetId + 'ack') < 0.5 ? null : stamp(addDays(from, rint(assetId + 'a', 0, 2)), 17), returnedAt: back ? stamp(back, 16) : null, returnedToId: back ? by.userId : null, conditionIn: back ? (rnd(assetId + 'ci') < 0.8 ? 'GOOD' : 'FAIR') : null, returnNotes: back ? 'Returned at exit — wiped and re-imaged' : null, ...extra });
  };
  // Laptops for everyone
  for (const r of ctx.people.values()) {
    const design = r.dept === 'UX' || ['ceo', 'coo', 'dd3', 'l12', 'e45'].includes(r.key);
    const bought = r.join < '2023-01-01' ? pick(r.key + 'buy', ['2023-02-14', '2023-06-20', '2024-01-10', '2022-08-05']) : addDays(r.join, -rint(r.key + 'lb', 5, 25));
    const [name, brand, model, cost, specs] = design
      ? ['MacBook Pro 14"', 'Apple', 'M3 Pro, 2023', 199_900, { Processor: 'Apple M3 Pro', Memory: '18 GB', Storage: '512 GB SSD' }]
      : r.dept === 'DEL' || r.dept === 'DEVOPS' || r.dept === 'SEC'
        ? pick(r.key + 'lm', [['ThinkPad T14 Gen 4', 'Lenovo', '21HD', 112_500, { Processor: 'Intel Core i7-1365U', Memory: '32 GB', Storage: '1 TB SSD' }], ['Latitude 7440', 'Dell', '7440', 118_900, { Processor: 'Intel Core i7-1365U', Memory: '32 GB', Storage: '512 GB SSD' }]] as const)
        : ['ThinkPad E14 Gen 5', 'Lenovo', '21JK', 72_800, { Processor: 'Intel Core i5-1335U', Memory: '16 GB', Storage: '512 GB SSD' }];
    const old = bought < '2023-01-01';
    const a = newAsset('Laptop', name as string, brand as string, model as string, bought, cost as number, pick(r.key + 'v', ['Redington India', 'Ingram Micro', 'Croma Business']), specs as object, r.status === 'TERMINATED' ? 'AVAILABLE' : 'ASSIGNED', old ? 'FAIR' : 'GOOD', r.loc);
    if (r.key === 'b4') continue; // Riya: laptop not handed over yet (asset request pending with IT)
    give(a.id, r, r.join < start ? (bought > r.join ? bought : r.join) : r.join, r.status === 'TERMINATED' ? r.lastDay : null);
  }
  // Monitors, headsets, ID cards, phones
  for (const r of ctx.people.values()) {
    if (r.key === 'b4') continue;
    const back = r.status === 'TERMINATED' ? r.lastDay : null;
    const idc = newAsset('ID card', 'Access card', '—', 'HID iCLASS', r.join < start ? '2024-01-01' : r.join, 350, 'HID Global', null, back ? 'RETIRED' : 'ASSIGNED', 'GOOD', r.loc);
    give(idc.id, r, r.join < start ? start : r.join, back);
    if (rnd(r.key + 'mon') < 0.62 || r.dept === 'UX') {
      const m = newAsset('Monitor', pick(r.key + 'mn', ['Dell U2723QE 27"', 'LG 27UP850 27"', 'Dell P2422H 24"']), pick(r.key + 'mb', ['Dell', 'LG']), 'IPS', addDays(r.join < start ? '2024-03-01' : r.join, -10), pick(r.key + 'mc', [21_500, 38_900, 44_200]), 'Redington India', { Size: '27 inch' }, back ? 'AVAILABLE' : 'ASSIGNED', 'GOOD', r.loc);
      give(m.id, r, r.join < start ? addDays(start, -rint(r.key + 'mg', 30, 400)) : addDays(r.join, rint(r.key + 'md', 0, 20)), back);
    }
    if (rnd(r.key + 'hds') < 0.7) {
      const h = newAsset('Headset', 'Jabra Evolve2 40', 'Jabra', 'Evolve2 40 UC', '2025-06-10', 8_900, 'Ingram Micro', null, back ? 'AVAILABLE' : 'ASSIGNED', 'GOOD', r.loc);
      give(h.id, r, r.join < '2025-06-15' ? '2025-06-15' : r.join, back);
    }
    if (['ceo', 'coo', 'dd1', 'dd2', 'dd3', 'hrm', 'ith', 'dvh', 'fih', 'pmo', 'sch', 'dv3', 'dv1'].includes(r.key)) {
      const ph = newAsset('Phone', 'iPhone 15', 'Apple', 'A3090', '2025-09-25', 79_900, 'Apple Business', { IMEI: `35${hashStr(r.key) % 10 ** 9}` }, 'ASSIGNED', 'GOOD', r.loc);
      give(ph.id, r, '2025-10-01', null);
    }
  }
  // Spare stock + special cases
  for (let i = 0; i < 6; i++) newAsset('Laptop', 'ThinkPad T14 Gen 5', 'Lenovo', '21ML', '2026-08-20', 121_400, 'Redington India', { Processor: 'Intel Core Ultra 7 155U', Memory: '32 GB', Storage: '1 TB SSD' }, 'AVAILABLE', 'NEW', i < 3 ? 'HYD' : i < 5 ? 'BLR' : 'PUN', 'New batch for the October joiners');
  for (let i = 0; i < 4; i++) newAsset('Monitor', 'Dell P2422H 24"', 'Dell', 'P2422H', '2026-08-20', 14_900, 'Redington India', { Size: '24 inch' }, 'AVAILABLE', 'NEW', i < 2 ? 'HYD' : 'BLR');
  for (let i = 0; i < 3; i++) newAsset('Headset', 'Jabra Evolve2 40', 'Jabra', 'Evolve2 40 UC', '2026-07-01', 8_900, 'Ingram Micro', null, 'AVAILABLE', 'NEW', 'HYD');
  const old = newAsset('Laptop', 'ThinkPad T480', 'Lenovo', '20L5', '2019-07-15', 84_000, 'Redington India', { Processor: 'Intel Core i5-8250U', Memory: '8 GB', Storage: '256 GB SSD' }, 'RETIRED', 'POOR', 'HYD', 'Battery swollen — e-waste via Attero, Feb 2026');
  void old;
  const lost = newAsset('Phone', 'Samsung Galaxy A54', 'Samsung', 'SM-A546E', '2024-03-02', 34_999, 'Croma Business', { IMEI: '358912345678901' }, 'LOST', 'GOOD', 'BLR', 'Lost in an Uber on 12 May 2026 — FIR filed, IMEI blocked');
  give(lost.id, p(ctx, 'dv1'), '2025-10-01', '2026-05-12', 'GOOD', { returnNotes: 'Reported lost', conditionIn: null });
  // In repair right now + repair history
  const inRepair = newAsset('Laptop', 'Latitude 7440', 'Dell', '7440', '2024-05-02', 118_900, 'Ingram Micro', { Processor: 'Intel Core i7-1365U', Memory: '32 GB', Storage: '512 GB SSD' }, 'IN_REPAIR', 'DAMAGED', 'PUN', 'Keyboard + screen hinge');
  repairs.push({ companyId, assetId: inRepair.id, issue: 'Coffee spill — keyboard dead, hinge cracked', vendor: 'Dell ProSupport', costPaise: 1_850_000, startedAt: stamp(addDays(today, -6), 12), notes: 'Accidental damage cover — claim DLP-55821', createdById: p(ctx, 'it4').userId });
  const fixed = (assets as Array<{ id: string; typeId: string; status: string }>).filter((a) => a.typeId === typeId.Laptop && a.status === 'ASSIGNED').slice(10, 14);
  for (const [i, a] of fixed.entries()) repairs.push({ companyId, assetId: a.id, issue: pick('rp' + i, ['Battery draining fast', 'Fan noise / overheating', 'Trackpad not clicking', 'Display flicker']), vendor: pick('rv' + i, ['Lenovo service centre', 'Dell ProSupport']), costPaise: i === 0 ? null : rint('rc' + i, 2_500, 9_000) * 100, startedAt: stamp(addDays(start, 40 + i * 70), 11), endedAt: stamp(addDays(start, 44 + i * 70), 17), notes: i === 0 ? 'Under warranty' : null, createdById: p(ctx, 'it1').userId });
  // Test devices (loanable) with a few loans, one overdue
  const devices = [['iPhone 13 (iOS 18)', 'Apple', 'A2633', 54_900, { 'OS version': 'iOS 18.6' }], ['Pixel 8 (Android 15)', 'Google', 'GKWS6', 59_999, { 'OS version': 'Android 15' }], ['Samsung Galaxy Tab S9', 'Samsung', 'SM-X710', 72_999, { 'OS version': 'Android 14' }], ['Redmi Note 13', 'Xiaomi', '23124RA7EO', 17_999, { 'OS version': 'Android 14' }]] as const;
  const loanIds: string[] = [];
  for (const [name, brand, model, cost, specs] of devices) loanIds.push(newAsset('Test device', name, brand, model, '2025-07-10', cost, 'Croma Business', specs as object, 'AVAILABLE', 'GOOD', 'HYD').id);
  give(loanIds[0]!, p(ctx, 'e22'), addDays(today, -5), null, 'GOOD', { dueBack: D(addDays(today, 5)) });
  give(loanIds[1]!, p(ctx, 'e16'), addDays(today, -20), null, 'GOOD', { dueBack: D(addDays(today, -6)) }); // overdue
  give(loanIds[2]!, p(ctx, 'ux7'), '2026-05-04', '2026-05-15', 'GOOD', { dueBack: D('2026-05-15') });
  for (const id of [loanIds[0], loanIds[1]]) (assets.find((a) => (a as { id: string }).id === id) as { status: string }).status = 'ASSIGNED';
  const prj = newAsset('Projector', 'Epson EB-FH06', 'Epson', 'EB-FH06', '2025-04-01', 54_000, 'Croma Business', null, 'AVAILABLE', 'GOOD', 'HYD');
  give(prj.id, p(ctx, 'hr3'), '2026-03-10', '2026-03-12', 'GOOD', { dueBack: D('2026-03-13') });
  // SIMs for on-call
  for (const k of ['dv1', 'dv3']) { const s = newAsset('SIM card', 'Airtel postpaid', 'Airtel', 'eSIM', '2025-02-01', 0, 'Bharti Airtel', { Number: `+91 98${hashStr(k) % 10 ** 8}` }, 'ASSIGNED', 'GOOD', p(ctx, k).loc); give(s.id, p(ctx, k), '2025-10-01', null); }
  // Invoices for some assets
  for (const a of (assets as Array<{ id: string; tag: string; name: string; purchaseCostPaise: number; vendor: string }>).filter((_, i) => i % 9 === 0).slice(0, 40)) {
    const key = `${companyId}/assets/${a.id}/${uuid()}.pdf`;
    const body = pdf(`Tax invoice — ${a.vendor}`, [`Item: ${a.name}`, `Asset tag: ${a.tag}`, `Amount: Rs. ${(a.purchaseCostPaise / 100).toLocaleString('en-IN')} + GST`, 'Bill to: SeedsAI Technologies Pvt. Ltd., Hyderabad', '', 'Sample invoice for testing']);
    writeFile(PRIVATE, key, body);
    docs.push({ companyId, assetId: a.id, name: 'Purchase invoice', fileKey: key, mime: 'application/pdf', size: body.length, uploadedById: p(ctx, 'it1').userId });
  }
  await chunked(assets, 500, (part) => prisma.asset.createMany({ data: part as never }));
  await chunked(assigns, 500, (part) => prisma.assetAssignment.createMany({ data: part as never }));
  await prisma.assetRepair.createMany({ data: repairs as never });
  await prisma.assetDocument.createMany({ data: docs as never });

  // Requests at every step
  const reqs: Array<Record<string, unknown>> = [];
  const R = (who: string, type: string, reason: string, status: string, stage: string | null, day: string, x: Record<string, unknown> = {}) => reqs.push({ companyId, employeeId: p(ctx, who).id, typeId: typeId[type], reason, status, stage, createdAt: stamp(day, 11, rint(who + day, 0, 59)), ...x });
  const u = (k: string) => p(ctx, k).userId;
  const e = (k: string) => p(ctx, k).id;
  R('b4', 'Laptop', 'Joined on 21 Sep — laptop not handed over yet', 'APPROVED', 'IT', '2026-09-18', { source: 'KIT', itStatus: 'PENDING', hrStatus: 'APPROVED', hrById: u('hr6'), hrAt: stamp('2026-09-18', 12), neededBy: D('2026-09-21') });
  R('e09', 'Monitor', 'Second screen for the planner grid work', 'PENDING', 'LEAD', addDays(today, -1), { leadApproverId: e('l2'), leadStatus: 'PENDING', managerApproverId: e('pm1'), managerStatus: 'PENDING' });
  R('e13', 'Headset', 'Old one’s mic stopped working', 'PENDING', 'MANAGER', addDays(today, -3), { leadApproverId: e('l3'), leadStatus: 'APPROVED', leadById: u('l3'), leadAt: stamp(addDays(today, -3), 15), managerApproverId: e('pm1'), managerStatus: 'PENDING' });
  R('e27', 'Monitor', 'Working on two codebases side by side', 'PENDING', 'HR', addDays(today, -4), { leadApproverId: e('l6'), leadStatus: 'APPROVED', leadById: u('l6'), leadAt: stamp(addDays(today, -4), 14), managerApproverId: e('pm3'), managerStatus: 'APPROVED', managerById: u('pm3'), managerAt: stamp(addDays(today, -3), 10) });
  R('ux6', 'Monitor', 'Need a colour-accurate screen for visual design', 'PENDING', 'IT', addDays(today, -6), { hrStatus: 'APPROVED', hrById: u('hr1'), hrAt: stamp(addDays(today, -5), 12), managerApproverId: e('ul2'), managerStatus: 'APPROVED', managerById: u('ul2'), managerAt: stamp(addDays(today, -6), 16) });
  R('e44', 'Laptop', 'Spark jobs locally need 32 GB — intern laptop has 16 GB', 'REJECTED', null, '2026-07-01', { managerApproverId: e('l10'), managerStatus: 'REJECTED', managerById: u('l10'), managerAt: stamp('2026-07-02', 11), managerNote: 'Use the shared dev cluster instead — I’ll get you access.' });
  R('e21', 'Keyboard & mouse', 'Wrist pain with the laptop keyboard', 'FULFILLED', null, '2026-03-02', { hrStatus: 'APPROVED', hrById: u('hr1'), hrAt: stamp('2026-03-02', 15), itStatus: 'APPROVED', itById: u('it3'), itAt: stamp('2026-03-03', 11), managerApproverId: e('l5'), managerStatus: 'APPROVED', managerById: u('l5'), managerAt: stamp('2026-03-02', 13) });
  R('e16', 'Test device', 'Testing the Android 15 edge-to-edge layout', 'FULFILLED', null, addDays(today, -21), { kind: 'LOAN', loanFrom: D(addDays(today, -20)), loanUntil: D(addDays(today, -6)), itStatus: 'APPROVED', itById: u('it1'), itAt: stamp(addDays(today, -20), 10), hrStatus: 'SKIPPED' });
  R('e22', 'Test device', 'iOS regression for the cards release', 'FULFILLED', null, addDays(today, -6), { kind: 'LOAN', loanFrom: D(addDays(today, -5)), loanUntil: D(addDays(today, 5)), itStatus: 'APPROVED', itById: u('it1'), itAt: stamp(addDays(today, -5), 10), hrStatus: 'SKIPPED' });
  R('l4', 'Test device', 'For Nitin — Flutter build on a low-end phone', 'PENDING', 'IT', addDays(today, -2), { requestedById: e('l4'), kind: 'LOAN', loanFrom: D(addDays(today, 1)), loanUntil: D(addDays(today, 8)), hrStatus: 'SKIPPED' });
  R('pm2', 'Headset', 'For the whole payments squad — new Jabra headsets (team request)', 'CANCELLED', null, '2026-06-10', { requestedById: e('pm2') });
  R('e48', 'Monitor', 'Second screen', 'APPROVED', 'IT', addDays(today, -9), { hrStatus: 'APPROVED', hrById: u('hr2'), hrAt: stamp(addDays(today, -8), 11), itStatus: 'PENDING', managerApproverId: e('l12'), managerStatus: 'APPROVED', managerById: u('l12'), managerAt: stamp(addDays(today, -9), 15) });
  await prisma.assetRequest.createMany({ data: reqs as never });

  // Starter kits
  await prisma.starterKitRule.createMany({
    data: [
      { companyId, name: 'Everyone', isBase: true, items: [{ typeId: typeId.Laptop, qty: 1 }, { typeId: typeId['ID card'], qty: 1 }, { typeId: typeId.Headset, qty: 1 }], sortOrder: 10 },
      { companyId, name: 'Designers', departmentIds: [ctx.dept.UX], items: [{ typeId: typeId.Monitor, qty: 1 }], sortOrder: 20 },
      { companyId, name: 'Managers and directors', roleKeys: ['manager'], items: [{ typeId: typeId.Phone, qty: 1 }, { typeId: typeId.Monitor, qty: 1 }], sortOrder: 30 },
      { companyId, name: 'On-call DevOps', designationContains: 'DevOps', items: [{ typeId: typeId['SIM card'], qty: 1 }], onPromotion: false, sortOrder: 40 },
    ] as never,
  });

  // Yearly check: running now
  const check = await prisma.assetCheck.create({ data: { companyId, name: 'Yearly asset check 2026', dueOn: D(addDays(today, 8)), startedAt: stamp(addDays(today, -22), 10), startedById: u('ith') } });
  const lastYear = await prisma.assetCheck.create({ data: { companyId, name: 'Yearly asset check 2025', dueOn: D('2025-10-31'), startedAt: stamp('2025-10-06', 10), closedAt: stamp('2025-11-03', 18), startedById: u('ith') } });
  const live = await prisma.assetAssignment.findMany({ where: { companyId, returnedAt: null }, select: { id: true, assetId: true, employeeId: true, assignedAt: true } });
  const answers: object[] = [];
  for (const a of live) {
    const sd = String(a.id);
    if (a.assignedAt > stamp(addDays(today, -22), 10)) continue;
    if (rnd(sd + 'ans') < 0.64) answers.push({ checkId: check.id, assignmentId: a.id, assetId: a.assetId, employeeId: a.employeeId, answer: rnd(sd + 'a') < 0.94 ? 'HAVE' : rnd(sd + 'b') < 0.7 ? 'PROBLEM' : 'NOT_WITH_ME', note: null, answeredAt: stamp(addDays(today, -rint(sd, 1, 21)), 10 + rint(sd + 'h', 0, 8)) });
    if (a.assignedAt < stamp('2025-10-06', 10) && rnd(sd + 'ly') < 0.97) answers.push({ checkId: lastYear.id, assignmentId: a.id, assetId: a.assetId, employeeId: a.employeeId, answer: 'HAVE', answeredAt: stamp(addDays('2025-10-07', rint(sd + 'l', 0, 20)), 11) });
  }
  for (const a of answers as Array<Record<string, unknown>>) if (a.answer === 'PROBLEM') a.note = pick(String(a.assignmentId), ['Battery health at 71%', 'Screen has a dead pixel line', 'Charger is fraying']);
  for (const a of answers as Array<Record<string, unknown>>) if (a.answer === 'NOT_WITH_ME') a.note = 'Left it at my hometown during Dussehra — will bring it back next week';
  await chunked(answers, 1000, (part) => prisma.assetCheckAnswer.createMany({ data: part as never, skipDuplicates: true }));
  ctx.count.assets = assets.length;
  void it;
}

function hashStr(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

// ─── Helpdesk ───────────────────────────────────────────────

const CATEGORIES: Array<[string, string, string, string | null, string | null, string | null]> = [
  // queue, name, icon, description, default priority, quick answer
  ['IT', 'Laptop / hardware', '💻', 'Slow laptop, battery, screen, keyboard', 'MEDIUM', null],
  ['IT', 'Software & installs', '🧩', 'Licences and new tools', 'LOW', 'Most tools (VS Code, Postman, Docker Desktop) install from Company Portal without a ticket.'],
  ['IT', 'Access & passwords', '🔑', 'Locked out, MFA, shared drives', 'HIGH', 'Locked out of Microsoft 365? Use aka.ms/sspr to reset it yourself in two minutes.'],
  ['IT', 'Network / VPN', '📶', 'Wi-Fi, VPN, slow internet', 'MEDIUM', 'VPN dropping? Update FortiClient to 7.4 from Company Portal and reconnect.'],
  ['IT', 'Email & accounts', '✉️', 'Mailbox, distribution lists, calendars', 'LOW', null],
  ['IT', 'Other', '🛠️', null, null, null],
  ['HR', 'Leave & attendance', '🗓️', 'Balances, corrections, holidays', 'MEDIUM', 'Missed a check-in? Ask for an attendance correction from My attendance — your lead approves it.'],
  ['HR', 'Letters & documents', '📄', 'Employment, address and visa letters', 'MEDIUM', null],
  ['HR', 'Policies', '📘', 'Questions about any HR policy', 'LOW', null],
  ['HR', 'Benefits & insurance', '🩺', 'Health insurance, claims, add a dependant', 'MEDIUM', 'Insurance e-cards are in the Medi Assist app — sign in with your work email.'],
  ['HR', 'Profile changes', '🪪', 'Name, bank, address changes', 'LOW', null],
  ['HR', 'Other', '💬', null, null, null],
  ['FINANCE', 'Salary & payslip', '💰', 'Payslip questions, salary credit', 'HIGH', null],
  ['FINANCE', 'Reimbursements', '🧾', 'Expense claims and payments', 'MEDIUM', 'Approved claims are paid every Tuesday and Friday.'],
  ['FINANCE', 'Tax & investment proofs', '📊', 'Form 16, TDS, proofs', 'MEDIUM', 'Investment proofs for FY 2026-27 open on 1 January.'],
  ['FINANCE', 'Other', '💼', null, null, null],
  ['DEVOPS', 'Cloud access', '☁️', 'AWS / GCP roles and accounts', 'HIGH', null],
  ['DEVOPS', 'Deployments & releases', '🚀', 'Pipelines, rollbacks, release windows', 'HIGH', null],
  ['DEVOPS', 'Repo & CI/CD access', '🔧', 'GitHub teams, runners, secrets', 'MEDIUM', null],
  ['DEVOPS', 'Servers & databases', '🗄️', 'DB access, environments, logs', 'MEDIUM', null],
  ['DEVOPS', 'Other', '⚙️', null, null, null],
];
const SLA: Record<string, [number, number]> = { URGENT: [1, 8], HIGH: [4, 24], MEDIUM: [8, 72], LOW: [24, 120] };

const TICKET_TEMPLATES: Array<[string, string, string, string, string[]]> = [
  // queue, category, subject, description, agent replies
  ['IT', 'Laptop / hardware', 'Laptop battery drains in two hours', 'My laptop goes from full to empty in about two hours with just the IDE and browser open.', ['Battery health is at 68% — we’ll swap the battery. Can you drop it at the IT desk tomorrow at 11?', 'Battery replaced. Please check and close the ticket.']],
  ['IT', 'Laptop / hardware', 'External monitor not detected over USB-C', 'The Dell monitor stopped detecting my laptop after the latest Windows update.', ['Please update the Thunderbolt driver from Company Portal and restart.', 'Driver pushed remotely — try now?']],
  ['IT', 'Software & installs', 'Figma editor seat', 'I review designs with the UX team and need edit access in Figma.', ['Added you to the SeedsAI Figma team with an editor seat.']],
  ['IT', 'Software & installs', 'JetBrains licence for IntelliJ', 'Need IntelliJ Ultimate for the Spring Boot services on Helix.', ['Licence assigned — sign in with your work email in the JetBrains Toolbox.']],
  ['IT', 'Access & passwords', 'Locked out after password change', 'Changed my password this morning and now Outlook and Teams keep asking for it.', ['Cleared your cached credentials — please sign out and in on all devices.']],
  ['IT', 'Access & passwords', 'MFA on new phone', 'Got a new phone; the Authenticator app didn’t move over.', ['Reset your MFA — you’ll be asked to set it up at the next sign-in.']],
  ['IT', 'Network / VPN', 'VPN disconnects every 10 minutes', 'FortiClient drops the connection every few minutes when working from home.', ['Can you share a screenshot of the error? Also which version of FortiClient?', 'You were on 7.0 — pushed 7.4. Should be stable now.']],
  ['IT', 'Network / VPN', 'Wi-Fi slow on the 9th floor', 'Calls keep breaking on the 9th floor near the pantry since Monday.', ['One access point had failed — replaced it this morning.']],
  ['IT', 'Email & accounts', 'Add me to helix-team distribution list', 'I joined Helix last week but don’t get the team emails.', ['Done — you’re on helix-team@ now.']],
  ['HR', 'Leave & attendance', 'Leave balance looks wrong', 'My EL balance shows 4 days but I think I carried 9 days from last year.', ['Checked — 5 carried-forward days had not been added. Fixed now.']],
  ['HR', 'Letters & documents', 'Employment verification letter for home loan', 'My bank needs an employment verification letter with joining date and current CTC.', ['Sure — does the bank need the CTC broken down or just the annual figure?', 'Letter is attached. Please collect the signed copy from the front desk.']],
  ['HR', 'Letters & documents', 'Address proof letter for passport', 'Need an address proof letter on the letterhead for my passport renewal.', ['Shared on email. All the best with the appointment!']],
  ['HR', 'Policies', 'Is Diwali week a shutdown?', 'Are we shutting down between 9 and 13 November or is it only the 9th?', ['Only 9 November is a holiday. Many people are taking EL — please plan with your lead.']],
  ['HR', 'Benefits & insurance', 'Add newborn to health insurance', 'Our baby was born last week — how do I add her to the policy?', ['Congratulations! Please share the birth certificate; we add dependants within 30 days of birth.', 'Added. The e-card will show in Medi Assist in 2–3 working days.']],
  ['HR', 'Profile changes', 'Surname change after marriage', 'I’d like to update my surname on my profile and payslips.', ['Please upload the marriage certificate; we’ll change it from next month’s payroll.']],
  ['FINANCE', 'Salary & payslip', 'TDS higher this month', 'My TDS jumped by ₹4,000 in the September payslip — why?', ['Your declared rent receipts expired in August, so HRA exemption stopped. Please re-submit proofs.']],
  ['FINANCE', 'Salary & payslip', 'Salary not credited', 'It’s the 2nd and I haven’t received my salary yet.', ['Your bank details changed on the 28th — the transfer bounced. Re-sent today; it should reach you by evening.']],
  ['FINANCE', 'Reimbursements', 'Travel claim approved but not paid', 'My Mumbai trip claim was approved two weeks ago but I haven’t received the money.', ['Could you share the claim title? I can’t find an approved claim under your name for that month.']],
  ['FINANCE', 'Tax & investment proofs', 'Form 16 for FY 2025-26', 'Where can I download my Form 16?', ['Form 16 Part A and B are on the TRACES-generated PDF — emailed to you today.']],
  ['DEVOPS', 'Cloud access', 'AWS read access for the Nimbus account', 'Need read-only access to the nimbus-prod AWS account for debugging pipeline failures.', ['Added you to NimbusReadOnly via IAM Identity Center. Access expires in 30 days.']],
  ['DEVOPS', 'Deployments & releases', 'Rollback Orbit API to 4.12.1', 'The 4.13.0 release broke statement downloads for some accounts — need an urgent rollback.', ['Rolled back to 4.12.1 at 21:42. Error rate back to normal.', 'Post-mortem doc shared in #orbit-incidents.']],
  ['DEVOPS', 'Repo & CI/CD access', 'GitHub Actions runner stuck', 'Our self-hosted runner has been queued for 40 minutes on the ledger repo.', ['Runner disk was full — cleaned the Docker cache, jobs are picking up again.']],
  ['DEVOPS', 'Servers & databases', 'Read replica for the Pulse reporting DB', 'Reporting queries are slowing down the primary. Can we get a read replica?', ['Replica is up — connection string is in Vault under pulse/reporting.']],
  ['DEVOPS', 'Servers & databases', 'Staging DB refresh for Ledger', 'Please refresh ledger-staging from last night’s prod snapshot (masked).', ['Refreshed with the masked snapshot from 02:00.']],
];

export async function seedHelpdesk(ctx: Ctx) {
  const { prisma, companyId, today, start } = ctx;
  const cat = new Map<string, string>();
  for (const [i, [queue, name, icon, description, defaultPriority, quickAnswer]] of CATEGORIES.entries()) {
    cat.set(`${queue}:${name}`, (await prisma.ticketCategory.create({ data: { companyId, queue: queue as never, name, icon, description, defaultPriority: defaultPriority as never, quickAnswer, helpedCount: quickAnswer ? rint(name, 4, 60) : 0, sortOrder: name === 'Other' ? 90 : (i + 1) * 10 } })).id);
  }
  const teams: Record<string, [string, string]> = { IT: ['ith', 'it1'], HR: ['hrm', 'hr1'], FINANCE: ['fih', 'fi1'], DEVOPS: ['dvh', 'dv1'] };
  for (const [queue, [head, backup]] of Object.entries(teams)) await prisma.helpdeskTeam.create({ data: { companyId, queue: queue as never, headId: p(ctx, head).userId, backupId: p(ctx, backup).userId } });
  const agents: Record<string, string[]> = { IT: ['it1', 'it2', 'it3', 'it4', 'it5'], HR: ['hr1', 'hr2', 'hr5', 'hr6'], FINANCE: ['fi1', 'fi2', 'fi4'], DEVOPS: ['dv1', 'dv2', 'dv3', 'dv4'] };
  const people = [...ctx.people.values()].filter((r) => r.type !== 'IN' || rnd(r.key + 'tk') < 0.5);
  let number = 0;
  const span = daysBetween(start, today);
  for (let i = 0; i < 140; i++) {
    const seed = 'tk' + i;
    const [queue, category, subject, description, replies] = pick(seed + 't', TICKET_TEMPLATES);
    const who = pick(seed + 'w', people);
    let day = addDays(start, Math.floor(Math.pow(rnd(seed + 'd'), 0.8) * span));
    if (day < who.join) day = who.join;
    if (who.lastDay && day > who.lastDay) day = who.lastDay;
    while (weekday(day) === 0 || weekday(day) === 6) day = addDays(day, 1);
    if (day > today) day = today;
    const createdAt = stamp(day, 9 + rint(seed + 'h', 0, 9), rint(seed + 'm', 0, 59));
    const ageH = (Date.now() - createdAt.getTime()) / 3_600_000;
    const priority = queue === 'DEVOPS' && /Rollback/.test(subject) ? 'URGENT' : pick(seed + 'p', ['LOW', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'HIGH']);
    const [frH, resH] = SLA[priority]!;
    const agentKey = pick(seed + 'ag', agents[queue]!);
    const agent = p(ctx, agentKey).userId;
    const requester = who.userId;
    // Lifecycle by age
    const rr = rnd(seed + 's');
    const status = ageH > 240 ? (rr < 0.8 ? 'CLOSED' : 'RESOLVED') : ageH > 72 ? (rr < 0.55 ? 'RESOLVED' : rr < 0.75 ? 'CLOSED' : rr < 0.9 ? 'WAITING' : 'IN_PROGRESS') : ageH > 8 ? (rr < 0.35 ? 'IN_PROGRESS' : rr < 0.55 ? 'WAITING' : rr < 0.8 ? 'RESOLVED' : 'OPEN') : rr < 0.6 ? 'OPEN' : 'IN_PROGRESS';
    const slow = rnd(seed + 'slow') < 0.15; // breached SLA
    const firstReplyH = status === 'OPEN' ? null : slow ? frH * (1.2 + rnd(seed + 'fr')) : frH * rnd(seed + 'fr') * 0.8;
    const msgs: Array<{ authorId: string | null; kind: string; body: string; createdAt: Date }> = [{ authorId: requester, kind: 'REPLY', body: description, createdAt }];
    let t = createdAt.getTime();
    if (status !== 'OPEN') {
      t += 0.2 * 3_600_000;
      msgs.push({ authorId: agent, kind: 'EVENT', body: 'Took the ticket', createdAt: new Date(t) });
      t = createdAt.getTime() + firstReplyH! * 3_600_000;
      const n = status === 'IN_PROGRESS' || status === 'WAITING' ? 1 : replies.length;
      for (let j = 0; j < n; j++) {
        msgs.push({ authorId: agent, kind: 'REPLY', body: replies[j]!, createdAt: new Date(t) });
        if (j < n - 1) { t += rnd(seed + 'g' + j) * 6 * 3_600_000 + 1_800_000; msgs.push({ authorId: requester, kind: 'REPLY', body: pick(seed + 'er' + j, ['Thanks, trying now.', 'Done — shared it.', 'Here you go.', 'Will drop it tomorrow.']), createdAt: new Date(t) }); t += 3_600_000; }
      }
      if (rnd(seed + 'note') < 0.2) msgs.push({ authorId: agent, kind: 'NOTE', body: pick(seed + 'nt', ['Same issue as last month — recurring, check the warranty.', 'Vendor ticket raised: INC-882134.', 'Escalated to the head for approval.']), createdAt: new Date(t - 600_000) });
    }
    const resolvedAt = status === 'RESOLVED' || status === 'CLOSED' ? new Date(Math.min(t + 1_200_000, Date.now() - 60_000)) : null;
    if (status === 'WAITING') msgs.push({ authorId: agent, kind: 'EVENT', body: 'Asked the employee for more information', createdAt: new Date(t + 1000) });
    if (resolvedAt) msgs.push({ authorId: agent, kind: 'EVENT', body: 'Marked as resolved', createdAt: resolvedAt });
    const closedAt = status === 'CLOSED' && resolvedAt ? new Date(resolvedAt.getTime() + 3 * 86_400_000) : null;
    if (closedAt) msgs.push({ authorId: null, kind: 'EVENT', body: 'Closed automatically after 3 days', createdAt: closedAt });
    const rated = resolvedAt && rnd(seed + 'rate') < 0.6;
    const ticket = await prisma.ticket.create({
      data: {
        companyId, number: ++number, queue: queue as never, categoryId: cat.get(`${queue}:${category}`) ?? null, employeeId: who.id, subject, description, priority: priority as never, status: status as never,
        assigneeId: status === 'OPEN' ? null : agent, createdAt, lastActivityAt: msgs[msgs.length - 1]!.createdAt,
        firstResponseDueAt: new Date(createdAt.getTime() + frH * 3_600_000), resolutionDueAt: new Date(createdAt.getTime() + resH * 3_600_000),
        firstRespondedAt: firstReplyH !== null ? new Date(createdAt.getTime() + firstReplyH * 3_600_000) : null, resolvedAt, closedAt,
        reopenCount: resolvedAt && rnd(seed + 'reo') < 0.06 ? 1 : 0,
        rating: rated ? (slow ? rint(seed + 'r', 2, 4) : rint(seed + 'r', 4, 5)) : null, ratingComment: rated && rnd(seed + 'rc') < 0.3 ? (slow ? 'Took a while but sorted.' : 'Super quick, thanks!') : null,
      },
    });
    await prisma.ticketMessage.createMany({ data: msgs.map((m) => ({ companyId, ticketId: ticket.id, ...m })) as never });
    void ageH;
  }
  ctx.count.tickets = number;
  void eachDay;
  void fullName;
}
