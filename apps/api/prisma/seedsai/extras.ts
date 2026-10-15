/*
 * The features added after the first SeedsAI cut: celebration wishes (and a
 * birthday + work anniversary on the day the seed runs), leave-type rules,
 * grants and grant requests, extra / lent days, year-end close, leave
 * questions and cancel requests, internship end dates and prior experience.
 */
import { closeYear, isEligible, proratedQuota, type EligibilityRules } from '../../src/modules/leave/leave-rules';
import { loadPeople } from '../../src/modules/leave/leave-eligibility';
import { type Ctx, type Row, employedOn, fullName, p } from './org';
import { D, K, PRIVATE, addDays, daysBetween, pdf, pick, rint, rnd, shuffle, stamp, uuid, writeFile } from './util';

/** Same lists as WISH_STICKERS in src/modules/engagement/dto.ts (not imported: its decorators need reflect-metadata) */
const WISH_STICKERS = { birthday: ['🎂', '🎉', '🥳', '🎈', '🎁', '💐'], anniversary: ['🏆', '🎉', '👏', '🌟', '🙌', '💐'] } as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (key: string) => `${+key.slice(8)} ${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
/** Never in the future (the seed can run early in the morning) */
const notAfterNow = (d: Date) => new Date(Math.min(d.getTime(), Date.now() - 60_000));

export async function seedExtras(ctx: Ctx) {
  await seedCelebrations(ctx);
  await seedLeaveRules(ctx);
  await seedGrantsAndExtra(ctx);
  await seedYearEnd(ctx);
  await seedLeaveConversations(ctx);
  await seedWfhWithoutCheckIn(ctx);
  await seedInterns(ctx);
  await seedExperience(ctx);
}

const current = (ctx: Ctx) => [...ctx.people.values()].filter((r) => employedOn(r, ctx.today) && r.status !== 'TERMINATED');

// ─── Celebrations ───────────────────────────────────────────

const BIRTHDAY_NOTES = ['Happy birthday! Have a great one 🎉', 'Many happy returns of the day!', 'Wishing you a fantastic year ahead.', 'Happy birthday — cake at the pantry?', 'Have a lovely day!'];
const ANNIVERSARY_NOTES = ['Congratulations on the milestone!', 'Thank you for everything you do here.', 'Here’s to many more years!', 'Happy work anniversary 👏', 'So glad to work with you.'];

async function seedCelebrations(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  const md = today.slice(5);
  const optedIn = new Set((await prisma.employee.findMany({ where: { companyId, showBirthday: true }, select: { id: true } })).map((e) => e.id));
  // Someone (not the admin, so they can try wishing) always celebrates on the day the seed runs
  const pool = shuffle('celebrate' + today, current(ctx).filter((r) => r.key !== 'admin' && r.type !== 'IN' && optedIn.has(r.id)));
  if (md !== '02-29') {
    const already = pool.filter((r) => r.dob.slice(5) === md).length;
    for (const r of pool.filter((x) => x.dob.slice(5) !== md).slice(0, Math.max(0, 2 - already))) {
      r.dob = `${r.dob.slice(0, 4)}-${md}`;
      await prisma.employee.update({ where: { id: r.id }, data: { dateOfBirth: D(r.dob) } });
    }
    // A work anniversary today: move a long-timer's joining day (before the history window, so nothing else shifts)
    if (!current(ctx).some((r) => r.join.slice(5) === md && r.join < today.slice(0, 4))) {
      const r = pool.find((x) => x.join < '2024-01-01' && !x.exit && x.dob.slice(5) !== md);
      if (r) {
        const join = `${r.join.slice(0, 4)}-${md}`;
        const delta = daysBetween(r.join, join);
        const e = await prisma.employee.findUniqueOrThrow({ where: { id: r.id }, select: { confirmationDate: true } });
        await prisma.employee.update({ where: { id: r.id }, data: { joiningDate: D(join), confirmationDate: e.confirmationDate ? D(addDays(K(e.confirmationDate), delta)) : null } });
        await prisma.employeeEvent.updateMany({ where: { employeeId: r.id, kind: 'joined' }, data: { effectiveOn: D(join) } });
        r.join = join;
      }
    }
  }

  const everyone = [...ctx.people.values()];
  const colleagues = (r: Row, day: string) => everyone.filter((x) => x.key !== r.key && employedOn(x, day) && (x.dept === r.dept || x.mgr === r.key || r.mgr === x.key || (x.mgr !== null && x.mgr === r.mgr)));
  const rows: object[] = [];
  const notes: object[] = [];
  const from = addDays(today, -365) > ctx.start ? addDays(today, -365) : ctx.start;
  for (const r of everyone) {
    const occasions: Array<{ kind: 'birthday' | 'anniversary'; day: string; years: number | null }> = [];
    for (const y of [+today.slice(0, 4) - 1, +today.slice(0, 4)]) {
      const b = `${y}-${r.dob.slice(5)}`;
      if (optedIn.has(r.id) && b >= from && b <= today && employedOn(r, b)) occasions.push({ kind: 'birthday', day: b, years: null });
      const a = `${y}-${r.join.slice(5)}`;
      if (y > +r.join.slice(0, 4) && a >= from && a <= today && employedOn(r, a)) occasions.push({ kind: 'anniversary', day: a, years: y - +r.join.slice(0, 4) });
    }
    for (const o of occasions) {
      if (o.day.endsWith('02-29')) continue;
      const isToday = o.day === today;
      const seed = `${r.key}:${o.kind}:${o.day}`;
      // Today: a handful so far, leaving plenty of people (and the admin) to still wish
      const n = isToday ? rint(seed + 'n', 3, 6) : rint(seed + 'n', 2, 9);
      const senders = shuffle(seed, colleagues(r, o.day).filter((x) => x.key !== 'admin')).slice(0, n);
      senders.forEach((s, i) => {
        const at = notAfterNow(stamp(o.day, 9 + Math.floor(i * 1.3), rint(seed + i, 0, 59)));
        rows.push({
          companyId, fromUserId: s.userId, employeeId: r.id, kind: o.kind, occasion: D(o.day), years: o.years,
          sticker: pick(seed + 's' + i, WISH_STICKERS[o.kind]), message: rnd(seed + 'm' + i) < 0.6 ? pick(seed + 'mt' + i, o.kind === 'birthday' ? BIRTHDAY_NOTES : ANNIVERSARY_NOTES) : null, createdAt: at,
        });
      });
      if (senders.length) {
        const last = senders[senders.length - 1]!;
        const others = senders.length - 1;
        const what = o.kind === 'birthday' ? 'a happy birthday 🎂' : `on your ${o.years}-year work anniversary 🏆`;
        notes.push({
          companyId, userId: r.userId, type: `celebration.${o.kind}`, dedupeKey: `wish:${r.id}:${o.kind}:${o.day}`,
          title: `${last.first}${others ? ` and ${others} other${others === 1 ? '' : 's'}` : ''} wished you ${what}`, body: null, link: '/app/wishes',
          createdAt: notAfterNow(stamp(o.day, 9 + Math.floor((senders.length - 1) * 1.3), 30)), readAt: isToday ? null : stamp(o.day, 20),
        });
      }
    }
  }
  await prisma.celebrationWish.createMany({ data: rows as never, skipDuplicates: true });
  await prisma.notification.createMany({ data: notes as never });
  ctx.count.celebrationWishes = rows.length;
}

// ─── Leave types with rules ─────────────────────────────────

async function seedLeaveRules(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  const all = current(ctx);
  const onNotice = all.find((r) => r.status === 'NOTICE_PERIOD');
  const contractor = all.find((r) => r.type === 'CT');
  const NEW_TYPES = [
    {
      code: 'MRG', name: 'Marriage Leave', category: 'OTHER', color: '#E11D48', accrual: 'UPFRONT', annualQuota: 5, allowHalfDay: false, minNoticeDays: 14, sortOrder: 82,
      availability: 'RULES', employmentTypes: ['FULL_TIME'], minServiceMonths: 6,
      description: 'For your own wedding. Full-time employees after 6 months of service.',
      members: [...(onNotice ? [{ employeeId: onNotice.id, mode: 'EXCLUDE' }] : []), ...(contractor ? [{ employeeId: contractor.id, mode: 'INCLUDE' }] : [])],
    },
    {
      code: 'RRD', name: 'Release Recovery Day', category: 'OTHER', color: '#2563EB', accrual: 'UPFRONT', annualQuota: 2, sortOrder: 84,
      availability: 'RULES', projectIds: [ctx.projectId!.HELIX!],
      description: 'Two days a year for the Helix team after the big retail releases.',
      members: [],
    },
    {
      code: 'INV', name: 'Innovation Day', category: 'OTHER', color: '#16A34A', accrual: 'UPFRONT', annualQuota: 2, sortOrder: 86,
      availability: 'RULES', managerIds: [p(ctx, 'dd3').id], managerDeep: true, locationIds: [ctx.loc.BLR!],
      description: 'Bengaluru teams under Farhan: two days a year to build anything you like.',
      members: [],
    },
    {
      code: 'SPL', name: 'Special Leave', category: 'OTHER', color: '#9333EA', accrual: 'UPFRONT', annualQuota: 0, allowHalfDay: false, sortOrder: 88,
      availability: 'GRANT_ONLY', employmentTypes: ['FULL_TIME', 'CONTRACT'],
      description: 'Given by HR for special situations — relocation, exams, a family emergency. Ask HR from My leave.',
      members: [],
    },
  ];
  const type: Record<string, string> = {};
  for (const { members, ...t } of NEW_TYPES) type[t.code] = (await prisma.leaveType.create({ data: { companyId, ...t, members: { create: members } } as never })).id;

  // 2026 balances for whoever the rules let in (the app would make these on first look)
  const people = await loadPeople(prisma as never, companyId, { employmentStatus: { not: 'TERMINATED' } });
  const balances: object[] = [];
  for (const { members, ...t } of NEW_TYPES) {
    if (t.availability === 'GRANT_ONLY') continue;
    const rules = { genders: [], departmentIds: [], locationIds: [], designationIds: [], employmentTypes: [], minServiceMonths: null, managerIds: [], managerDeep: false, projectIds: [], ...t, members } as unknown as EligibilityRules;
    for (const x of people) if (isEligible(rules, x, D(today))) balances.push({ companyId, employeeId: x.id, leaveTypeId: type[t.code], year: 2026, allocated: proratedQuota(t.annualQuota, 2026, x.joiningDate) });
  }
  await prisma.leaveBalance.createMany({ data: balances as never });
  ctx.count.ruleBalances = balances.length;
}

// ─── Grants, grant requests, extra / lent days ──────────────

async function seedGrantsAndExtra(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  const types = new Map((await prisma.leaveType.findMany({ where: { companyId }, select: { id: true, code: true } })).map((t) => [t.code, t.id]));
  const hr = p(ctx, 'hrm').userId;
  const staff = shuffle('grants', current(ctx).filter((r) => r.type !== 'IN' && r.status === 'ACTIVE' && r.mgr && !['ceo', 'coo', 'admin', 'hrm'].includes(r.key)));
  let n = 0;
  const next = () => staff[n++]!;
  const SPL = types.get('SPL')!;
  const doc = (who: Row, id: string, title: string, lines: string[]) => {
    const key = `${companyId}/leave-grants/${id}/${uuid()}.pdf`;
    const body = pdf(title, [`Name: ${fullName(who)}`, ...lines, '', '(sample document for testing)']);
    writeFile(PRIVATE, key, body);
    return { documentKey: key, documentName: `${title}.pdf`, documentMime: 'application/pdf', documentSize: body.length };
  };
  const grantBalance = new Set<string>();

  // Asked for → approved (the grant points back at the request)
  {
    const r = next();
    const id = uuid();
    const asked = stamp(addDays(today, -18), 11, 20);
    const decided = stamp(addDays(today, -16), 15, 5);
    const fromD = addDays(today, 9);
    const toD = addDays(today, 13);
    await prisma.leaveGrantRequest.create({ data: { id, companyId, employeeId: r.id, leaveTypeId: SPL, fromDate: D(fromD), toDate: D(toD), note: 'Moving my family from Hyderabad to Pune — need a few days for the house move and school admissions.', status: 'APPROVED', decidedById: hr, decidedAt: decided, decisionNote: 'Approved — all the best with the move!', createdAt: asked, updatedAt: decided } });
    await prisma.leaveGrant.create({ data: { companyId, employeeId: r.id, leaveTypeId: SPL, days: 4, validFrom: D(addDays(fromD, -3)), validTo: D(addDays(toD, 30)), reason: 'Relocation to Pune', grantedById: hr, requestId: id, createdAt: decided, events: { create: { kind: 'CREATED', days: 4, validTo: D(addDays(toD, 30)), note: 'Asked for by the employee', byId: hr, createdAt: decided } } } });
    grantBalance.add(r.id);
  }
  // Waiting for HR, with a document
  {
    const r = next();
    const id = uuid();
    await prisma.leaveGrantRequest.create({ data: { id, companyId, employeeId: r.id, leaveTypeId: SPL, fromDate: D(addDays(today, 21)), toDate: D(addDays(today, 26)), note: 'Final semester exams for my part-time MBA. Exam schedule attached.', ...doc(r, id, 'Exam schedule', ['Programme: MBA (Executive), Osmania University', `Exams: ${fmt(addDays(today, 21))} to ${fmt(addDays(today, 26))}`]), createdAt: stamp(addDays(today, -2), 10, 40) } });
  }
  {
    const r = next();
    await prisma.leaveGrantRequest.create({ data: { companyId, employeeId: r.id, leaveTypeId: SPL, fromDate: D(addDays(today, 3)), toDate: D(addDays(today, 4)), note: 'My father has a planned surgery and I need to be at the hospital.', createdAt: stamp(addDays(today, -1), 18, 5) } });
  }
  // Turned down, and one taken back by the employee
  {
    const r = next();
    const at = stamp(addDays(today, -40), 12);
    await prisma.leaveGrantRequest.create({ data: { companyId, employeeId: r.id, leaveTypeId: SPL, fromDate: D(addDays(today, -30)), toDate: D(addDays(today, -26)), note: 'Friend’s wedding in Jaipur.', status: 'REJECTED', decidedById: hr, decidedAt: stamp(addDays(today, -39), 16), decisionNote: 'Special leave is for emergencies and relocation — please use earned leave for this.', createdAt: at } });
  }
  {
    const r = next();
    await prisma.leaveGrantRequest.create({ data: { companyId, employeeId: r.id, leaveTypeId: SPL, fromDate: D(addDays(today, 14)), toDate: D(addDays(today, 15)), note: 'Passport appointment out of town.', status: 'CANCELLED', createdAt: stamp(addDays(today, -6), 9, 30) } });
  }
  // Given straight by HR and later changed; one revoked
  {
    const r = next();
    const at = stamp(addDays(today, -50), 14);
    const changed = stamp(addDays(today, -35), 11);
    await prisma.leaveGrant.create({
      data: {
        companyId, employeeId: r.id, leaveTypeId: SPL, days: 5, validFrom: D(addDays(today, -50)), validTo: D(addDays(today, 60)), reason: 'Family emergency — flood damage at home in Chennai', grantedById: hr, createdAt: at,
        events: { create: [{ kind: 'CREATED', days: 3, validTo: D(addDays(today, 30)), note: 'Family emergency — flood damage at home in Chennai', byId: hr, createdAt: at }, { kind: 'CHANGED', days: 5, validTo: D(addDays(today, 60)), note: 'Two more days and a longer window — repairs are taking longer', byId: hr, createdAt: changed }] },
      },
    });
    grantBalance.add(r.id);
  }
  {
    const r = next();
    const at = stamp(addDays(today, -70), 10);
    await prisma.leaveGrant.create({
      data: {
        companyId, employeeId: r.id, leaveTypeId: SPL, days: 2, validFrom: D(addDays(today, -70)), validTo: D(addDays(today, 20)), reason: 'Court hearing (property matter)', status: 'REVOKED', grantedById: hr, createdAt: at,
        events: { create: [{ kind: 'CREATED', days: 2, validTo: D(addDays(today, 20)), note: 'Court hearing (property matter)', byId: hr, createdAt: at }, { kind: 'REVOKED', note: 'Hearing moved to the weekend — not needed any more', byId: hr, createdAt: stamp(addDays(today, -60), 12) }] },
      },
    });
  }
  // Grant-only types keep a (usage-only) balance row for grant holders
  await prisma.leaveBalance.createMany({ data: [...grantBalance].map((employeeId) => ({ companyId, employeeId, leaveTypeId: SPL, year: 2026, allocated: 0 })) });

  // Asking the manager for more casual leave
  const CL = types.get('CL')!;
  const EL = types.get('EL')!;
  const year = +today.slice(0, 4);
  const asks: Array<{ status: string; type: string; days: number; decided?: number; reason: string; note?: string; ago: number; dates?: [number, number] }> = [
    { status: 'PENDING', type: CL, days: 2, reason: 'Sister’s wedding next month — I have used all my casual leave.', ago: 2, dates: [24, 25] },
    { status: 'PENDING', type: EL, days: 3, reason: 'Trip home for Diwali; my EL runs out a few days short.', ago: 1, dates: [27, 31] },
    { status: 'PENDING', type: CL, days: 1, reason: 'Need one more day for a house registration.', ago: 0 },
    { status: 'LENT', type: CL, days: 2, decided: 2, reason: 'Moving house at the end of the month.', ago: 25 },
    { status: 'GIVEN', type: CL, days: 2, decided: 1, reason: 'Worked through the weekend for the Orbit release.', note: 'One day as thanks for the release weekend — the other is covered by comp off.', ago: 40 },
    { status: 'DECLINED', type: EL, days: 4, reason: 'Long trip to Europe in December.', note: 'Please plan this within your balance — the December freeze is on.', ago: 30 },
    { status: 'CANCELLED', type: CL, days: 1, reason: 'Bank work.', ago: 12 },
  ];
  for (const [i, a] of asks.entries()) {
    const r = next();
    const mgr = p(ctx, r.mgr!);
    const id = uuid();
    const asked = notAfterNow(stamp(addDays(today, -a.ago), 10 + i, 15));
    const decidedAt = a.status === 'PENDING' || a.status === 'CANCELLED' ? null : stamp(addDays(today, -a.ago + 1), 16, 10);
    await prisma.extraLeaveRequest.create({
      data: {
        id, companyId, employeeId: r.id, leaveTypeId: a.type, year, days: a.days, reason: a.reason, status: a.status as never,
        startDate: a.dates ? D(addDays(today, a.dates[0])) : null, endDate: a.dates ? D(addDays(today, a.dates[1])) : null,
        decidedDays: a.decided ?? null, decidedById: decidedAt ? mgr.userId : null, decidedAt, decisionNote: a.note ?? null, createdAt: asked,
      },
    });
    if (a.status !== 'LENT' && a.status !== 'GIVEN') continue;
    const b = await prisma.leaveBalance.findFirst({ where: { companyId, employeeId: r.id, leaveTypeId: a.type, year } });
    if (!b) continue;
    await prisma.leaveBalance.update({
      where: { id: b.id },
      data: a.status === 'LENT'
        ? { lendLimit: { increment: a.decided! }, adjustments: { create: { kind: 'LEND', days: 0, lendLimit: a.decided, reason: a.reason, adjustedById: mgr.userId, requestId: id, createdAt: decidedAt! } } }
        : { adjusted: { increment: a.decided! }, adjustments: { create: { kind: 'EXTRA', days: a.decided!, reason: a.reason, adjustedById: mgr.userId, requestId: id, createdAt: decidedAt! } } },
    });
    await prisma.notification.create({
      data: {
        companyId, userId: r.userId, type: a.status === 'LENT' ? 'leave.lent' : 'leave.extra_given', link: '/app/leave', createdAt: decidedAt!, readAt: stamp(addDays(today, -a.ago + 2), 9),
        title: a.status === 'LENT' ? `You can take ${a.decided} more days of casual leave (lent)` : `${a.decided} extra day${a.decided === 1 ? '' : 's'} of casual leave added`,
        body: a.status === 'LENT' ? `Days you use below 0 will be taken from your ${year + 1} casual leave.\n${a.reason}` : `They're yours to keep.\n${a.reason}`,
      },
    });
  }
  ctx.count.extraLeaveRequests = asks.length;
}

// ─── Year end 2025: carried / lapsed, written once ──────────

async function seedYearEnd(ctx: Ctx) {
  const { prisma, companyId } = ctx;
  const rows = await prisma.leaveBalance.findMany({ where: { companyId, year: 2025 }, include: { leaveType: true } });
  const next = new Map((await prisma.leaveBalance.findMany({ where: { companyId, year: 2026 }, select: { id: true, employeeId: true, leaveTypeId: true } })).map((b) => [`${b.employeeId}:${b.leaveTypeId}`, b.id]));
  let closed = 0;
  for (const b of rows) {
    const t = b.leaveType;
    if (t.accrual === 'NONE' || t.availability === 'GRANT_ONLY') continue;
    const left = b.allocated + b.carriedForward + b.adjusted - b.usedDays - b.pendingDays;
    const c = closeYear({ left, carryForward: t.carryForward, maxCarry: t.maxCarryForward, lendLimit: b.lendLimit, recoverNegative: t.recoverNegative, owedLeft: b.owedLeft });
    await prisma.leaveBalance.update({ where: { id: b.id }, data: { closedAt: stamp('2026-01-01', 0, 5), carriedOut: c.carriedOut, lapsed: c.lapsed, owedOut: c.owedOut } });
    const n = next.get(`${b.employeeId}:${b.leaveTypeId}`);
    if (n && t.carryForward) await prisma.leaveBalance.update({ where: { id: n }, data: { carriedForward: c.carriedOut } });
    closed++;
  }
  ctx.count.balancesClosed2025 = closed;
}

// ─── Questions on leave, cancel requests ────────────────────

async function seedLeaveConversations(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  const byEmp = new Map([...ctx.people.values()].map((r) => [r.id, r]));
  const comments: object[] = [];
  // Open questions on waiting leave — the employee has to answer
  const pending = await prisma.leaveRequest.findMany({ where: { companyId, status: 'PENDING', leaveType: { code: { in: ['EL', 'CL'] } } }, orderBy: { createdAt: 'asc' }, take: 3, select: { id: true, createdAt: true, approvals: { select: { approverIds: true } } } });
  const Q = ['Can you check with the team that someone covers the release on these days?', 'Is this the full trip, or might you need an extra day?', 'Could you move this by a week? The client demo is on these dates.'];
  for (const [i, l] of pending.entries()) {
    const asker = l.approvals[0]?.approverIds[0];
    if (!asker) continue;
    comments.push({ leaveRequestId: l.id, authorId: asker, kind: 'QUESTION', body: Q[i % Q.length], createdAt: notAfterNow(new Date(l.createdAt.getTime() + 5 * 3_600_000)) });
    await prisma.leaveRequest.update({ where: { id: l.id }, data: { questionOpenById: asker } });
  }
  // Answered questions on decided leave
  const decided = await prisma.leaveRequest.findMany({ where: { companyId, status: 'APPROVED', decidedAt: { not: null }, leaveType: { code: 'EL' } }, orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, employeeId: true, createdAt: true, decidedAt: true, approvals: { select: { actedById: true } } } });
  for (const l of decided) {
    const asker = l.approvals.find((a) => a.actedById)?.actedById;
    const who = byEmp.get(l.employeeId);
    if (!asker || !who) continue;
    const mid = (l.createdAt.getTime() + l.decidedAt!.getTime()) / 2;
    comments.push({ leaveRequestId: l.id, authorId: asker, kind: 'QUESTION', body: 'Who is covering your reviews while you’re away?', createdAt: new Date(mid - 1_800_000) });
    comments.push({ leaveRequestId: l.id, authorId: who.userId, kind: 'REPLY', body: pick(l.id, ['Lead has agreed to cover — handover doc is on the wiki.', 'My pair will take them; I’ve briefed her.', 'Nothing due that week, and I’ll be reachable for emergencies.']), createdAt: new Date(mid) });
  }
  await prisma.leaveComment.createMany({ data: comments as never });
  // Back early: asked to cancel leave that has already started
  const started = await prisma.leaveRequest.findMany({ where: { companyId, status: 'APPROVED', startDate: { lte: D(today), gte: D(addDays(today, -20)) }, leaveType: { code: { in: ['EL', 'CL'] } } }, orderBy: { startDate: 'desc' }, take: 2, select: { id: true, startDate: true, endDate: true } });
  for (const [i, l] of started.entries()) {
    const s = K(l.startDate);
    const e = K(l.endDate);
    const lastDay = e >= today ? (s < today ? addDays(today, -1) : null) : null;
    await prisma.leaveRequest.update({ where: { id: l.id }, data: { cancelRequestedAt: notAfterNow(stamp(e >= today ? today : addDays(e, 1), 9, 30 + i)), cancelRequestReason: i === 0 ? 'Came back early — the trip got cut short.' : 'Ended up working these days for the production issue.', cancelRequestLastDay: lastDay ? D(lastDay) : null } });
  }
  ctx.count.leaveComments = comments.length;
}

// ─── Work from home without a check-in (shown as "WFH, not checked in") ─

async function seedWfhWithoutCheckIn(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  const wfhType = await prisma.leaveType.findFirstOrThrow({ where: { companyId, code: 'WFH' }, select: { id: true } });
  const holidays = new Set((await prisma.publicHoliday.findMany({ where: { companyId, isOptional: false }, select: { date: true } })).map((h) => K(h.date)));
  const days: string[] = [];
  for (let k = addDays(today, -1); days.length < 6; k = addDays(k, -1)) if (D(k).getUTCDay() % 6 !== 0 && !holidays.has(k)) days.push(k);
  // Days with no leave, no timesheet and no correction become approved WFH the person forgot to check in on
  // (any punches that day are cleared, so timesheets still sit inside attendance)
  const [records, sheets, fixes, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { companyId, date: { in: days.map(D) } }, select: { id: true, employeeId: true, date: true } }),
    prisma.timesheetEntry.findMany({ where: { companyId, date: { in: days.map(D) } }, select: { employeeId: true, date: true }, distinct: ['employeeId', 'date'] }),
    prisma.attendanceRegularisation.findMany({ where: { companyId, date: { in: days.map(D) } }, select: { employeeId: true, date: true } }),
    prisma.leaveRequest.findMany({ where: { companyId, status: { in: ['APPROVED', 'PENDING'] }, startDate: { lte: D(days[0]!) }, endDate: { gte: D(days[days.length - 1]!) } }, select: { employeeId: true, startDate: true, endDate: true } }),
  ]);
  const busy = new Set([...sheets, ...fixes].map((r) => `${r.employeeId}|${K(r.date)}`));
  const recordOf = new Map(records.map((r) => [`${r.employeeId}|${K(r.date)}`, r.id]));
  const onLeave = (id: string, k: string) => leaves.some((l) => l.employeeId === id && K(l.startDate) <= k && K(l.endDate) >= k);
  const picked: Array<{ r: Row; day: string }> = [];
  for (const day of [days[0]!, days[0]!, days[2]!, days[4]!]) {
    const r = shuffle('wfhmiss' + day + picked.length, current(ctx).filter((x) => x.mgr && x.join < day && !busy.has(`${x.id}|${day}`) && !onLeave(x.id, day) && !picked.some((y) => y.r.key === x.key)))[0];
    if (r) picked.push({ r, day });
  }
  for (const { r, day } of picked) {
    const rec = recordOf.get(`${r.id}|${day}`);
    if (rec) {
      await prisma.attendancePunch.deleteMany({ where: { recordId: rec } });
      await prisma.attendanceRecord.delete({ where: { id: rec } });
    }
    const rt = ctx.route!(r, day);
    const asked = stamp(addDays(day, -1), 18, 20);
    const decided = stamp(addDays(day, -1), 20, 5);
    await prisma.leaveRequest.create({
      data: {
        companyId, employeeId: r.id, leaveTypeId: wfhType.id, startDate: D(day), endDate: D(day), totalDays: 1, reason: 'Waiting for a technician at home', status: 'APPROVED', decidedAt: decided, createdAt: asked, updatedAt: decided,
        approvals: { create: { level: 1, approverId: rt.ids[0] ?? null, approverIds: rt.ids, label: rt.label, status: rt.ids.length ? 'APPROVED' : 'SKIPPED', actedById: rt.ids[0] ?? null, actedAt: rt.ids.length ? decided : null } },
      },
    });
    await prisma.leaveBalance.updateMany({ where: { companyId, employeeId: r.id, leaveTypeId: wfhType.id, year: +day.slice(0, 4) }, data: { usedDays: { increment: 1 } } });
  }
  ctx.count.wfhWithoutCheckIn = picked.length;
}

// ─── Interns: end dates, an extension, one never auto-converted ─

async function seedInterns(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  // The company setting stays on its default 'remind' (HR decides each one); the last intern never auto-converts, for testing 'convert'
  const interns = current(ctx).filter((r) => r.type === 'IN').sort((a, b) => a.join.localeCompare(b.join));
  const events: object[] = [];
  for (const [i, r] of interns.entries()) {
    // Most are six months; a few short summer ones are due or overdue now
    const months = i === 1 ? 4 : i === 2 ? 4 : 6;
    let end = addDays(K(new Date(Date.UTC(+r.join.slice(0, 4), +r.join.slice(5, 7) - 1 + months, +r.join.slice(8)))), -1);
    if (i === 3) end = addDays(today, 2); // ends in two days
    if (i === 0) {
      // Was three months, extended by HR
      const first = addDays(K(new Date(Date.UTC(+r.join.slice(0, 4), +r.join.slice(5, 7) - 1 + 3, +r.join.slice(8)))), -1);
      end = addDays(first, 92);
      events.push({ companyId, employeeId: r.id, kind: 'internship_extended', fromLabel: fmt(first), toLabel: fmt(end), effectiveOn: D(end), note: 'Extending to finish the Helix reporting module', actorUserId: p(ctx, 'hrm').userId, createdAt: stamp(addDays(first, -5), 15) });
    }
    await prisma.employee.update({ where: { id: r.id }, data: { internshipEndDate: D(end), skipAutoConvert: i === interns.length - 1 } });
  }
  if (events.length) await prisma.employeeEvent.createMany({ data: events as never });
  ctx.count.internsWithEndDate = interns.length;
}

// ─── Experience before joining ──────────────────────────────

async function seedExperience(ctx: Ctx) {
  const { prisma, today } = ctx;
  const senior = /Chief|Director|Head|Manager|Principal|Architect|Lead/;
  const mid = /Senior/;
  const staff = current(ctx).filter((r) => r.type !== 'IN');
  const pending = new Set(shuffle('xp', staff.filter((r) => r.join >= '2025-06-01')).slice(0, 3).map((r) => r.key));
  for (const r of staff) {
    const fresher = !senior.test(r.title) && !mid.test(r.title) && rnd(r.key + 'fresh') < 0.35;
    const months = fresher ? 0 : senior.test(r.title) ? rint(r.key + 'xp', 72, 180) : mid.test(r.title) ? rint(r.key + 'xp', 36, 84) : rint(r.key + 'xp', 6, 36);
    if (pending.has(r.key)) {
      // Said so themselves; waiting for HR to check the relieving letters
      await prisma.employee.update({ where: { id: r.id }, data: { priorExperiencePendingMonths: months || 18, priorExperienceSubmittedAt: notAfterNow(stamp(addDays(today, -rint(r.key, 1, 6)), 11)) } });
      continue;
    }
    if (rnd(r.key + 'xpnone') < 0.1) continue; // never recorded
    const verified = addDays(r.join < ctx.start ? ctx.start : r.join, 20);
    await prisma.employee.update({ where: { id: r.id }, data: { priorExperienceMonths: months, priorExperienceVerifiedAt: stamp(verified > today ? today : verified, 12), priorExperienceVerifiedById: p(ctx, 'hr1').userId } });
  }
}
