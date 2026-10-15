/* Holidays, leave, attendance (+ punches, corrections) and timesheets for the whole year. */
import { type Ctx, type Row, employedOn, fullName, p } from './org';
import { PROJECTS } from './work';
import { D, PRIVATE, addDays, at, chunked, daysBetween, eachDay, gauss, mondayOf, nowMinutesIST, pdf, pick, rint, rnd, stamp, uuid, weekday, writeFile } from './util';

// ─── Holidays ───────────────────────────────────────────────
// [date, name, optional, locations ([] = all)]
const HOLIDAYS: Array<[string, string, boolean, string[]]> = [
  ['2025-10-02', 'Gandhi Jayanti & Dussehra', false, []], ['2025-10-20', 'Diwali', false, []], ['2025-10-21', 'Diwali (Govardhan Puja)', true, []],
  ['2025-11-05', 'Guru Nanak Jayanti', true, []], ['2025-12-25', 'Christmas', false, []],
  ['2026-01-01', 'New Year’s Day', true, []], ['2026-01-14', 'Makar Sankranti / Pongal', false, ['HYD', 'BLR']], ['2026-01-26', 'Republic Day', false, []],
  ['2026-03-04', 'Holi', false, []], ['2026-03-19', 'Ugadi / Gudi Padwa', false, []], ['2026-03-20', 'Eid-ul-Fitr', true, []], ['2026-04-03', 'Good Friday', true, []],
  ['2026-05-01', 'May Day / Maharashtra Day', false, []], ['2026-05-27', 'Bakrid / Eid al-Adha', true, []], ['2026-06-02', 'Telangana Formation Day', false, ['HYD']],
  ['2026-08-15', 'Independence Day', false, []], ['2026-08-28', 'Raksha Bandhan', true, []], ['2026-09-14', 'Ganesh Chaturthi', false, []],
  ['2026-10-02', 'Gandhi Jayanti', false, []], ['2026-10-20', 'Dussehra', false, []], ['2026-11-09', 'Diwali', false, []], ['2026-11-24', 'Guru Nanak Jayanti', true, []],
  ['2026-12-25', 'Christmas', false, []],
  ['2027-01-01', 'New Year’s Day', true, []], ['2027-01-14', 'Makar Sankranti / Pongal', false, ['HYD', 'BLR']], ['2027-01-26', 'Republic Day', false, []], ['2027-03-22', 'Holi', false, []],
];

const OFFICE_IP: Record<string, string> = { HYD: '103.21.58.12', BLR: '49.207.183.40', PUN: '115.112.92.7' };

interface Leave { id: string; r: Row; code: string; from: string; to: string; half: 'FIRST_HALF' | 'SECOND_HALF' | null; days: number; status: string; reason: string; createdAt: Date; decidedAt: Date | null; decider: string | null; onBehalfOf: string | null; comment: string | null; cancelReason?: string; doc?: boolean }

export async function seedTime(ctx: Ctx) {
  const { prisma, companyId, today, start } = ctx;
  const MEMBERS = ctx.members!;
  const people = [...ctx.people.values()];
  const loc = (k: string) => ctx.loc[k]!;

  // Holidays + optional picks (2 a year)
  const holidayId: Record<string, string> = {};
  for (const [date, name, isOptional, locs] of HOLIDAYS) {
    holidayId[date] = (await prisma.publicHoliday.create({ data: { companyId, name, date: D(date), isOptional, year: +date.slice(0, 4), locationIds: locs.map(loc) } })).id;
  }
  const off = new Map<string, Set<string>>(); // person → holiday dates that apply to them
  const choices: object[] = [];
  for (const r of people) {
    const mine = new Set<string>();
    for (const [date, , isOptional, locs] of HOLIDAYS) {
      if (locs.length && !locs.includes(r.loc)) continue;
      if (!isOptional) mine.add(date);
    }
    for (const year of ['2025', '2026']) {
      const opts = HOLIDAYS.filter(([d, , o]) => o && d.startsWith(year) && d >= r.join);
      const picks = opts.filter(([d]) => rnd(r.key + d) < (/Eid|Bakrid/.test(opts.find((x) => x[0] === d)![1]) && ['Zubair', 'Irfan', 'Sana', 'Faisal', 'Imran', 'Fatima', 'Ayesha', 'Zoya', 'Ehsan', 'Farhan'].includes(r.first) ? 0.95 : 0.3)).slice(0, 2);
      for (const [d] of picks) {
        mine.add(d);
        choices.push({ companyId, employeeId: r.id, holidayId: holidayId[d], createdAt: stamp(addDays(d, -rint(r.key + d, 10, 60)) < start ? start : addDays(d, -rint(r.key + d, 10, 60)), 12) });
      }
    }
    off.set(r.key, mine);
  }
  await prisma.holidayChoice.createMany({ data: choices as never });
  const isWorkday = (r: Row, k: string) => weekday(k) !== 0 && weekday(k) !== 6 && !off.get(r.key)!.has(k);

  // Leave types
  const TYPES = [
    { code: 'CL', name: 'Casual Leave', category: 'CASUAL', color: '#0EA5E9', accrual: 'UPFRONT', annualQuota: 12, minNoticeDays: 1, maxConsecutiveDays: 3, sortOrder: 10, description: 'Short personal needs.' },
    { code: 'SL', name: 'Sick Leave', category: 'SICK', color: '#F43F5E', accrual: 'UPFRONT', annualQuota: 12, documentAfterDays: 2, sortOrder: 20, description: 'Illness or medical appointments. Can be applied after the fact; a doctor’s note for more than 2 days.' },
    { code: 'EL', name: 'Earned Leave', category: 'EARNED', color: '#10B981', accrual: 'MONTHLY', annualQuota: 18, carryForward: true, maxCarryForward: 30, minNoticeDays: 7, blockDuringProbation: true, sandwichRule: true, sortOrder: 30, description: 'Planned vacations. Builds up monthly; up to 30 unused days carry forward.' },
    { code: 'WFH', name: 'Work From Home', category: 'WORK_FROM_HOME', color: '#8B5CF6', accrual: 'NONE', annualQuota: 0, countsAsPresent: true, sortOrder: 40, description: 'Working remotely — counts as a working day.' },
    { code: 'LOP', name: 'Unpaid Leave', category: 'UNPAID', color: '#64748B', accrual: 'NONE', annualQuota: 0, isPaid: false, sortOrder: 50, description: 'Leave without pay (loss of pay).' },
    { code: 'ML', name: 'Maternity Leave', category: 'MATERNITY', color: '#EC4899', accrual: 'UPFRONT', annualQuota: 182, allowHalfDay: false, includeNonWorkingDays: true, availability: 'GRANT_ONLY', genders: ['FEMALE'], grantNeedsDocument: true, sortOrder: 60, description: '26 weeks under the Maternity Benefit Act. Ask HR with a supporting document; HR grants it.' },
    { code: 'PL', name: 'Paternity Leave', category: 'PATERNITY', color: '#F59E0B', accrual: 'UPFRONT', annualQuota: 5, allowHalfDay: false, availability: 'RULES', genders: ['MALE'], sortOrder: 70, description: 'Time off around the birth or adoption of a child.' },
    { code: 'BL', name: 'Bereavement Leave', category: 'OTHER', color: '#475569', accrual: 'UPFRONT', annualQuota: 3, allowHalfDay: false, sortOrder: 80, description: 'Loss of a close family member.' },
    { code: 'CO', name: 'Comp Off', category: 'COMPENSATORY', color: '#14B8A6', accrual: 'NONE', annualQuota: 0, sortOrder: 90, description: 'A day off for working on a weekend or holiday (release nights, go-lives).' },
  ];
  const typeId: Record<string, string> = {};
  for (const t of TYPES) typeId[t.code] = (await prisma.leaveType.create({ data: { companyId, ...t } as never })).id;

  // ── Who approves (mirrors ApprovalRouterService) ──
  const memberships = (r: Row, k: string) => MEMBERS.filter((m) => m.key === r.key && m.from <= k && (!m.to || m.to >= k));
  const pmOf = (code: string, k: string) => MEMBERS.find((m) => m.code === code && m.role === 'MANAGER' && m.from <= k && (!m.to || m.to >= k))?.key ?? null;
  const live = (key: string | null, k: string) => (key && employedOn(p(ctx, key), k) ? key : null);
  function route(r: Row, k: string): { ids: string[]; label: string; first: string | null } {
    const line = live(r.mgr, k);
    const pool: Array<[string, string]> = [];
    for (const m of memberships(r, k)) {
      if (m.role === 'MANAGER') continue;
      const name = PROJECTS.find((x) => x.code === m.code)!.name;
      if (m.role === 'MEMBER' && live(m.lead, k)) pool.push([m.lead!, `Team lead · ${name}`]);
      const pm = live(pmOf(m.code, k), k);
      if (pm && pm !== r.key) pool.push([pm, `Project manager · ${name}`]);
    }
    if (pool.length) {
      if (line) pool.push([line, 'Line manager']);
      const ids = [...new Set(pool.map((x) => x[0]))].filter((x) => x !== r.key);
      return { ids: ids.map((x) => p(ctx, x).userId), label: [...new Set(pool.map((x) => x[1]))].join(', '), first: ids[0] ?? null };
    }
    if (line) return { ids: [p(ctx, line).userId], label: 'Line manager', first: line };
    if (r.pool) return { ids: [p(ctx, 'pmo').userId], label: 'PMO lead', first: 'pmo' };
    return { ids: [], label: 'HR', first: 'hrm' };
  }
  ctx.route = route;

  // Approval delegations: who covers for whom, when (approver on leave)
  const delegations: Array<{ from: string; to: string; a: string; b: string; reason: string; revoked?: string }> = [
    { from: 'pm1', to: 'l1', a: '2025-12-22', b: '2026-01-02', reason: 'Year-end vacation' },
    { from: 'l6', to: 'e23', a: '2026-05-11', b: '2026-05-22', reason: 'Family trip to Kerala' },
    { from: 'hrm', to: 'hr1', a: '2026-06-08', b: '2026-06-12', reason: 'SHRM conference, Singapore' },
    { from: 'dd2', to: 'pm3', a: '2026-08-24', b: '2026-08-28', reason: 'Client visit — MediCore, Mumbai', revoked: '2026-08-26' },
    { from: 'l2', to: 'e01', a: addDays(today, -2), b: addDays(today, 4), reason: 'Sister’s wedding' },
    { from: 'pm5', to: 'l10', a: addDays(today, 10), b: addDays(today, 19), reason: 'Paternity break' },
  ];
  const covering = (key: string, k: string) => delegations.find((d) => d.from === key && d.a <= k && (d.revoked ? d.revoked : d.b) >= k);
  ctx.delegations = delegations;

  // ── Leave plan ──
  const leaves: Leave[] = [];
  const busy = new Map<string, Set<string>>(); // person → days taken by any leave
  const horizon = '2026-12-31';
  const taken = new Map<string, number>(); // `${key}|${code}|${year}` → days asked (any status but rejected/cancelled is close enough)
  const mark = (r: Row, days: string[]) => { const s = busy.get(r.key) ?? new Set(); days.forEach((d) => s.add(d)); busy.set(r.key, s); };
  const free = (r: Row, days: string[]) => days.every((d) => !busy.get(r.key)?.has(d));
  const workdaysIn = (r: Row, a: string, b: string) => [...eachDay(a, b)].filter((d) => isWorkday(r, d));
  const firstWorkdayFrom = (r: Row, k: string, dir = 1) => { let d = k; for (let i = 0; i < 10 && !isWorkday(r, d); i++) d = addDays(d, dir); return d; };

  const REASONS: Record<string, string[]> = {
    CL: ['Personal work', 'Bank and passport office visit', 'Family function', 'House shifting', 'Parent–teacher meeting at school', 'Vehicle registration at the RTO', 'Attending a friend’s wedding', 'Personal errand', 'Visiting grandparents', 'Property registration'],
    SL: ['Fever and body ache', 'Viral fever', 'Migraine', 'Food poisoning', 'Dental procedure', 'Severe cold and cough', 'Doctor’s appointment', 'Back pain — doctor advised rest', 'Eye infection', 'Dengue — hospitalised'],
    EL: ['Family vacation', 'Trip to Goa with family', 'Visiting hometown for the festival', 'Vacation — Himachal trek', 'Sister’s wedding', 'Annual family trip', 'Pilgrimage with parents', 'Year-end break', 'Kerala trip', 'Diwali at home'],
    WFH: ['Waiting for a delivery / technician at home', 'Not feeling great, can work from home', 'Heavy rain, waterlogging on the way', 'Plumber visit at home', 'Child unwell, need to be home', 'Late client call', 'Car service — no commute today', 'Internet installation at home', 'Focus day for the release'],
    LOP: ['Extended trip — out of leave balance', 'Personal emergency, no balance left'],
    BL: ['Grandfather passed away', 'Loss in the family'],
    CO: ['Comp off for the Saturday go-live', 'Comp off for weekend release support'],
  };
  const SEASON_VACATIONS = [['2025-10-15', '2025-10-31'], ['2025-12-18', '2026-01-09'], ['2026-04-20', '2026-06-12'], ['2026-10-12', '2026-10-30'], ['2026-11-02', '2026-11-20'], ['2026-12-18', '2026-12-31']];

  function addLeave(r: Row, code: string, from: string, to: string, half: Leave['half'], opts: { createdBefore?: number; after?: boolean; reason?: string; forceStatus?: string; doc?: boolean } = {}) {
    const days = code === 'ML' ? [...eachDay(from, to)] : workdaysIn(r, from, to);
    if (!days.length || !free(r, days)) return null;
    const total = code === 'ML' ? days.length : half ? 0.5 : days.length;
    if (['CL', 'SL', 'EL'].includes(code) && !opts.forceStatus) {
      const year = from.slice(0, 4);
      const t = TYPES.find((x) => x.code === code)!;
      const frac = r.join > `${year}-01-01` ? Math.max(0, daysBetween(r.join, `${year}-12-31`) + 1) / 365 : 1;
      const carried = code === 'EL' && year === '2026' && r.join < '2025-01-01' && r.type !== 'IN' ? Math.min(30, rint(r.key + 'cf', 2, 16)) : 0;
      const quota = Math.round(t.annualQuota * frac * 2) / 2 + carried;
      const usedKey = `${r.key}|${code}|${year}`;
      if ((taken.get(usedKey) ?? 0) + total > quota) return null;
      taken.set(usedKey, (taken.get(usedKey) ?? 0) + total);
    }
    const seed = r.key + code + from;
    const created = opts.after ? addDays(from, rint(seed + 'af', 0, 2)) : addDays(from, -(opts.createdBefore ?? 2));
    const createdKey = created > today ? today : created < addDays(start, -40) ? addDays(start, -40) : created;
    const createdAt = stamp(createdKey, 9 + rint(seed + 'h', 0, 9), rint(seed + 'm', 0, 59));
    // Status
    let status = opts.forceStatus ?? 'APPROVED';
    const rr = rnd(seed + 'st');
    if (!opts.forceStatus) {
      if (to < today) status = rr < 0.035 ? 'REJECTED' : rr < 0.085 ? 'CANCELLED' : 'APPROVED';
      else if (from > today) status = createdKey >= addDays(today, -4) ? (rr < 0.6 ? 'PENDING' : 'APPROVED') : rr < 0.12 ? 'PENDING' : rr < 0.16 ? 'CANCELLED' : rr < 0.19 ? 'WITHDRAWN' : 'APPROVED';
      else status = createdKey >= addDays(today, -2) ? 'PENDING' : 'APPROVED';
      if (code === 'WFH' && status === 'REJECTED' && rr < 0.02) status = 'APPROVED';
    }
    const rt = route(r, from);
    let decider: string | null = null;
    let onBehalfOf: string | null = null;
    let decidedAt: Date | null = null;
    if (status === 'APPROVED' || status === 'REJECTED' || (status === 'CANCELLED' && rnd(seed + 'ca') < 0.5)) {
      const dk = addDays(createdKey, rint(seed + 'dk', 0, code === 'EL' ? 3 : 1));
      const decideKey = dk > today ? today : dk;
      const who = rt.first && rnd(seed + 'who') < 0.8 ? rt.first : rt.ids.length > 1 ? [...ctx.people.values()].find((x) => x.userId === pick(seed + 'ap', rt.ids))!.key : rt.first ?? 'hrm';
      const cover = covering(who, decideKey);
      decider = cover ? cover.to : who;
      onBehalfOf = cover ? who : null;
      decidedAt = new Date(Math.max(createdAt.getTime() + 25 * 60_000, stamp(decideKey, 10 + rint(seed + 'dh', 0, 8), rint(seed + 'dm', 0, 59)).getTime()));
    }
    const leave: Leave = {
      id: uuid(), r, code, from, to, half, days: total, status, reason: opts.reason ?? pick(seed + 'rs', REASONS[code] ?? ['Personal']), createdAt, decidedAt, decider, onBehalfOf,
      comment: status === 'REJECTED' ? pick(seed + 'rc', ['Release week — can you move this by a week?', 'Two people from the team are already off these days.', 'Client demo on the 2nd day, please reschedule.', 'Please apply as CL, not EL, for a single day.']) : status === 'APPROVED' && rnd(seed + 'cm') < 0.2 ? pick(seed + 'ac', ['Enjoy!', 'Approved. Please share the handover note.', 'Take care, get well soon.', 'Ok', 'Approved — have fun!']) : null,
      cancelReason: status === 'CANCELLED' ? pick(seed + 'cr', ['Plans changed', 'Trip postponed', 'Not needed any more', 'Feeling better, will come to office']) : undefined,
      doc: opts.doc,
    };
    leaves.push(leave);
    if (!['REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(status)) mark(r, days);
    return leave;
  }

  // Special cases first
  const esha = p(ctx, 'e26');
  addLeave(esha, 'ML', '2026-08-03', '2027-01-31', null, { createdBefore: 45, reason: 'Maternity leave — due date 10 August', forceStatus: 'APPROVED', doc: true });
  addLeave(p(ctx, 'e03'), 'PL', '2026-03-09', '2026-03-13', null, { createdBefore: 20, reason: 'Wife’s delivery — baby girl due 8 March', forceStatus: 'APPROVED' });
  addLeave(p(ctx, 'e45'), 'PL', '2026-01-19', '2026-01-23', null, { createdBefore: 10, reason: 'Birth of our son', forceStatus: 'APPROVED' });
  addLeave(p(ctx, 'pm5'), 'PL', addDays(today, 13), addDays(today, 17), null, { createdBefore: 5, reason: 'Second child due mid-October', forceStatus: 'APPROVED' });
  addLeave(p(ctx, 'it3'), 'BL', '2026-02-16', '2026-02-18', null, { after: true, reason: 'Grandfather passed away', forceStatus: 'APPROVED' });
  addLeave(p(ctx, 'e25'), 'LOP', '2026-06-15', '2026-06-19', null, { createdBefore: 12, reason: 'Extended trip — out of leave balance', forceStatus: 'APPROVED' });
  addLeave(p(ctx, 'e12'), 'LOP', '2026-01-05', '2026-01-06', null, { createdBefore: 3, reason: 'Personal emergency, no balance left', forceStatus: 'APPROVED' });
  addLeave(p(ctx, 'e08'), 'CO', '2026-06-01', '2026-06-01', null, { createdBefore: 4, reason: 'Comp off for the Saturday 30 May go-live', forceStatus: 'APPROVED' });
  addLeave(p(ctx, 'dv3'), 'CO', '2026-09-18', '2026-09-18', null, { createdBefore: 2, reason: 'Comp off for weekend release support', forceStatus: 'APPROVED' });
  addLeave(p(ctx, 'l2'), 'EL', addDays(today, -2), addDays(today, 4), null, { createdBefore: 30, reason: 'Sister’s wedding in Jaipur', forceStatus: 'APPROVED' });
  // Diwali week rush: lots of future EL around 9 Nov (some pending → busy approvers)
  for (const r of people) {
    if (!employedOn(r, '2026-11-13') || r.status === 'ON_LEAVE' || r.type === 'IN' || addDays(r.join, 182) > '2026-11-10') continue;
    const seed = r.key + 'diwali';
    if (rnd(seed) < 0.28) addLeave(r, 'EL', '2026-11-10', addDays('2026-11-10', rint(seed + 'n', 0, 3)), null, { createdBefore: rint(seed + 'c', 1, 30), forceStatus: undefined });
  }

  for (const r of people) {
    const from = r.join > start ? r.join : start;
    const until = r.lastDay && r.lastDay < horizon ? r.lastDay : horizon;
    if (from > until) continue;
    const months = Math.max(1, daysBetween(from, until) / 30.4);
    const intern = r.type === 'IN';
    const seedBase = r.key;
    // Earned leave blocks (not during probation, not interns)
    if (!intern) {
      const probationEnd = addDays(r.join, 182);
      const blocks = months > 9 ? rint(seedBase + 'elb', 1, 3) : months > 4 ? rint(seedBase + 'elb', 0, 1) : 0;
      for (let i = 0; i < blocks; i++) {
        for (let tries = 0; tries < 6; tries++) {
          const [a, b] = pick(`${seedBase}elw${i}${tries}`, SEASON_VACATIONS);
          if (b < from || a > until) continue;
          const span = daysBetween(a < from ? from : a, b > until ? until : b);
          if (span < 3) continue;
          const s0 = firstWorkdayFrom(r, addDays(a < from ? from : a, rint(`${seedBase}els${i}${tries}`, 0, span - 2)));
          if (s0 < probationEnd) continue;
          const len = rint(`${seedBase}ell${i}${tries}`, 2, 7);
          let e0 = s0;
          for (let n = 1, d = s0; n < len; ) { d = addDays(d, 1); if (isWorkday(r, d)) { e0 = d; n++; } }
          if (addLeave(r, 'EL', s0, e0, null, { createdBefore: rint(`${seedBase}elc${i}`, 8, 40) })) break;
        }
      }
    }
    const soon = addDays(today, 21) < until ? addDays(today, 21) : until;
    // Casual leave: single days, often Monday / Friday, some half days
    const cl = Math.round((intern ? 0.35 : 0.65) * months * (0.6 + rnd(seedBase + 'clr') * 0.8));
    for (let i = 0; i < cl; i++) {
      let d = addDays(from, rint(`${seedBase}cl${i}`, 0, Math.max(0, daysBetween(from, soon))));
      if (rnd(`${seedBase}clf${i}`) < 0.45) d = addDays(d, (weekday(d) <= 2 ? 1 : 5) - weekday(d)); // nudge to Mon / Fri
      d = firstWorkdayFrom(r, d);
      if (d > soon || d < from) continue;
      const half = rnd(`${seedBase}clh${i}`) < 0.18 ? (rnd(`${seedBase}clhs${i}`) < 0.5 ? 'FIRST_HALF' : 'SECOND_HALF') : null;
      const two = !half && rnd(`${seedBase}cl2${i}`) < 0.15;
      let to = d;
      if (two) { to = addDays(d, 1); if (!isWorkday(r, to)) to = d; }
      addLeave(r, 'CL', d, to, half, { createdBefore: rint(`${seedBase}clc${i}`, 1, 7) });
    }
    // Sick leave, more in monsoon / winter, applied after the fact
    const sick = Math.round(r.habit.sick * months * 0.55);
    for (let i = 0; i < sick; i++) {
      let d = addDays(from, rint(`${seedBase}sl${i}`, 0, Math.max(0, daysBetween(from, until < today ? until : today))));
      const m = +d.slice(5, 7);
      if (![7, 8, 9, 12, 1].includes(m) && rnd(`${seedBase}slm${i}`) < 0.4) continue;
      d = firstWorkdayFrom(r, d);
      if (d > today || d < from) continue;
      const len = rnd(`${seedBase}sll${i}`) < 0.65 ? 1 : rnd(`${seedBase}sll2${i}`) < 0.75 ? 2 : rint(`${seedBase}sll3${i}`, 3, 5);
      let to = d;
      for (let n = 1, x = d; n < len; ) { x = addDays(x, 1); if (isWorkday(r, x)) { to = x; n++; } }
      if (to > today) to = d;
      const half = len === 1 && rnd(`${seedBase}slh${i}`) < 0.12 ? 'SECOND_HALF' : null;
      addLeave(r, 'SL', d, to, half, { after: true, doc: len > 2 });
    }
    // Work from home: habit-driven, single days, often Fridays / rainy Mondays
    const wfh = Math.round(r.habit.wfh * Math.max(0, daysBetween(from, soon)) * 0.71);
    for (let i = 0; i < wfh; i++) {
      let d = addDays(from, rint(`${seedBase}wf${i}`, 0, Math.max(0, daysBetween(from, soon))));
      if (rnd(`${seedBase}wff${i}`) < 0.35) d = addDays(d, 5 - weekday(d));
      d = firstWorkdayFrom(r, d);
      if (d > soon || d < from) continue;
      addLeave(r, 'WFH', d, d, null, { createdBefore: rint(`${seedBase}wfc${i}`, 0, 3) });
    }
  }

  // Leave requests + approvals
  const reqRows: object[] = [];
  const apprRows: object[] = [];
  for (const l of leaves) {
    const rt = route(l.r, l.from);
    const docName = l.doc ? (l.code === 'ML' ? 'Maternity certificate.pdf' : 'Medical certificate.pdf') : null;
    reqRows.push({
      id: l.id, companyId, employeeId: l.r.id, leaveTypeId: typeId[l.code], startDate: D(l.from), endDate: D(l.to), halfDay: l.half, totalDays: l.days, reason: l.reason, status: l.status,
      currentLevel: 1, requiredLevels: 1, decidedAt: l.status === 'APPROVED' || l.status === 'REJECTED' ? l.decidedAt : null,
      cancelledAt: l.status === 'CANCELLED' ? new Date(Math.min(stamp(addDays(l.from, -1), 20).getTime(), Date.now())) : l.status === 'WITHDRAWN' ? new Date(l.createdAt.getTime() + 3 * 3600_000) : null,
      cancelledById: l.status === 'CANCELLED' || l.status === 'WITHDRAWN' ? l.r.userId : null, cancelReason: l.cancelReason ?? null,
      documentKey: null, documentName: docName, documentMime: docName ? 'application/pdf' : null, documentSize: null,
      createdAt: l.createdAt, updatedAt: l.decidedAt ?? l.createdAt,
    });
    const decided = l.status === 'APPROVED' || l.status === 'REJECTED' || (l.status === 'CANCELLED' && l.decidedAt);
    apprRows.push({
      leaveRequestId: l.id, level: 1, approverId: rt.ids[0] ?? null, approverIds: rt.ids, label: rt.label,
      status: l.status === 'APPROVED' || (l.status === 'CANCELLED' && l.decidedAt) ? 'APPROVED' : l.status === 'REJECTED' ? 'REJECTED' : l.status === 'PENDING' ? 'PENDING' : 'SKIPPED',
      actedById: decided && l.decider ? p(ctx, l.decider).userId : null, onBehalfOfId: decided && l.onBehalfOf ? p(ctx, l.onBehalfOf).userId : null,
      comments: l.comment, actedAt: decided ? l.decidedAt : null,
    });
  }
  // Supporting documents for the requests that have them
  for (const row of reqRows as Array<Record<string, unknown>>) {
    if (!row.documentName) continue;
    const key = `${companyId}/leave/${row.id}/${uuid()}.pdf`;
    const body = pdf(row.documentName === 'Maternity certificate.pdf' ? 'Certificate of expected confinement' : 'Medical certificate', [`Patient: ${fullName([...ctx.people.values()].find((x) => x.id === row.employeeId)!)}`, `Advised rest from ${(row.startDate as Date).toISOString().slice(0, 10)} to ${(row.endDate as Date).toISOString().slice(0, 10)}.`, '', 'Dr. S. Raghunath, MBBS, MD', 'Apollo Clinic (sample document for testing)']);
    writeFile(PRIVATE, key, body);
    row.documentKey = key;
    row.documentSize = body.length;
  }
  // Maternity is given by HR grant: one grant per maternity leave, sharing its certificate
  for (const row of reqRows as Array<Record<string, unknown>>) {
    if (row.leaveTypeId !== typeId.ML) continue;
    const from = row.startDate as Date;
    const to = new Date(Date.UTC(from.getUTCFullYear() + 1, from.getUTCMonth(), from.getUTCDate() - 1));
    const grant = await prisma.leaveGrant.create({
      data: {
        companyId, employeeId: row.employeeId as string, leaveTypeId: typeId.ML, days: 182, validFrom: from, validTo: to,
        reason: 'Maternity leave — certificate of expected confinement received', grantedById: p(ctx, 'hrm').userId,
        documentKey: row.documentKey as string | null, documentName: row.documentName as string | null, documentMime: row.documentMime as string | null, documentSize: row.documentSize as number | null,
        createdAt: new Date((row.createdAt as Date).getTime() - 2 * 86_400_000),
        events: { create: { kind: 'CREATED', days: 182, validTo: to, note: 'Certificate received', byId: p(ctx, 'hrm').userId, createdAt: new Date((row.createdAt as Date).getTime() - 2 * 86_400_000) } },
      },
    });
    row.leaveGrantId = grant.id;
  }
  await chunked(reqRows, 1000, (part) => prisma.leaveRequest.createMany({ data: part as never }));
  await chunked(apprRows, 1000, (part) => prisma.leaveApproval.createMany({ data: part as never }));
  ctx.count.leaveRequests = reqRows.length;

  // Leave balances (2025 and 2026), consistent with the requests
  const balances: object[] = [];
  const adjustments: Array<{ key: string; type: string; year: number; days: number; reason: string; by: string; at: Date; kind?: string }> = [
    { key: 'e08', type: 'CL', year: 2026, days: 1, reason: 'Extra day for covering the 30 May go-live (management approval)', by: 'hrm', at: stamp('2026-06-03', 15), kind: 'EXTRA' },
    { key: 'e14', type: 'EL', year: 2026, days: -3, reason: 'Notice-period recovery — EL encashed instead', by: 'hr5', at: stamp('2026-09-20', 12), kind: 'DEDUCTION' },
    { key: 'dv3', type: 'SL', year: 2026, days: 2, reason: 'Hospitalisation — approved by HR Manager', by: 'hrm', at: stamp('2026-04-15', 11) },
    { key: 'e25', type: 'EL', year: 2026, days: -1, reason: 'Correction: leave on 2 Jan was missed in the old system', by: 'hr1', at: stamp('2026-01-20', 16) },
  ];
  for (const r of people) {
    for (const year of [2025, 2026]) {
      const yStart = `${year}-01-01`;
      const yEnd = `${year}-12-31`;
      if (r.join > yEnd) continue;
      if (r.lastDay && r.lastDay < yStart) continue;
      const frac = r.join > yStart ? Math.max(0, daysBetween(r.join, yEnd) + 1) / 365 : 1;
      for (const t of TYPES) {
        const only = (t as { genders?: string[] }).genders;
        if (only?.length && !only.includes(r.g === 'M' ? 'MALE' : 'FEMALE')) continue;
        // Grant-only (maternity): a balance row only where the person actually has a grant
        const grantOnly = (t as { availability?: string }).availability === 'GRANT_ONLY';
        if (grantOnly && !leaves.some((l) => l.r === r && l.code === t.code)) continue;
        if (t.accrual === 'NONE' && t.code !== 'WFH') { /* still record usage */ }
        const mine = leaves.filter((l) => l.r === r && l.code === t.code && l.from.startsWith(String(year)));
        const used = mine.filter((l) => l.status === 'APPROVED').reduce((n, l) => n + l.days, 0);
        const pending = mine.filter((l) => l.status === 'PENDING').reduce((n, l) => n + l.days, 0);
        if (t.accrual === 'NONE' && !used && !pending) continue;
        const allocated = t.accrual === 'NONE' || grantOnly ? 0 : r.type === 'IN' && t.code === 'EL' ? 0 : Math.round(t.annualQuota * frac * 2) / 2;
        const carried = t.code === 'EL' && year === 2026 && r.join < '2025-01-01' && r.type !== 'IN' ? Math.min(30, rint(r.key + 'cf', 2, 16)) : 0;
        const adj = adjustments.filter((a) => a.key === r.key && a.type === t.code && a.year === year);
        balances.push({ id: uuid(), companyId, employeeId: r.id, leaveTypeId: typeId[t.code], year, allocated, carriedForward: carried, adjusted: adj.reduce((n, a) => n + a.days, 0), usedDays: used, pendingDays: pending, _adj: adj });
      }
    }
  }
  const adjRows: object[] = [];
  for (const b of balances as Array<Record<string, unknown>>) {
    for (const a of b._adj as typeof adjustments) adjRows.push({ balanceId: b.id, kind: a.kind ?? 'CORRECTION', days: a.days, reason: a.reason, adjustedById: p(ctx, a.by).userId, createdAt: a.at });
    delete b._adj;
  }
  await chunked(balances, 1000, (part) => prisma.leaveBalance.createMany({ data: part as never }));
  await prisma.leaveBalanceAdjustment.createMany({ data: adjRows as never });

  // Delegations
  for (const d of delegations) {
    await prisma.approvalDelegation.create({
      data: {
        companyId, delegatorId: p(ctx, d.from).userId, delegateId: p(ctx, d.to).userId, startsAt: stamp(d.a, 0), endsAt: stamp(d.b, 23, 59), reason: d.reason,
        createdById: p(ctx, d.from).userId, revokedAt: d.revoked ? stamp(d.revoked, 14, 10) : null, revokedById: d.revoked ? p(ctx, d.from).userId : null,
        createdAt: stamp(addDays(d.a, -rint(d.from + d.a, 1, 6)), 17, 30),
      },
    });
  }

  // ── Attendance ──
  const leaveOn = new Map<string, Leave>(); // `${key}|${day}` → approved leave
  for (const l of leaves) {
    if (l.status !== 'APPROVED') continue;
    for (const d of eachDay(l.from, l.to)) leaveOn.set(`${l.r.key}|${d}`, l);
  }
  ctx.leaveOn = leaveOn;
  const milestoneCrunch = new Set(['2025-11-26', '2025-11-27', '2026-02-18', '2026-02-19', '2026-05-27', '2026-05-28', '2026-08-26', '2026-08-27', '2026-09-23', '2026-09-24']);
  const records: Array<Record<string, unknown>> = [];
  const punches: object[] = [];
  const worked = new Map<string, { inMin: number; outMin: number; breakStart: number | null; breakEnd: number | null; wfh: boolean }>();
  const nowMin = nowMinutesIST();
  const corrections: object[] = [];
  const correctionCandidates: Array<{ r: Row; d: string; kind: 'forgot' | 'late' | 'visit'; rec?: Record<string, unknown>; inMin: number; outMin: number }> = [];

  for (const r of people) {
    const from = r.join > start ? r.join : start;
    const until = r.lastDay && r.lastDay < today ? r.lastDay : today;
    const shiftStart = r.shift === 'US' ? 13 * 60 : r.shift === 'NIGHT' ? 22 * 60 : 9 * 60 + 30;
    for (const d of eachDay(from, until)) {
      if (!isWorkday(r, d)) continue;
      const l = leaveOn.get(`${r.key}|${d}`);
      if (l && l.code !== 'WFH' && !l.half) continue;
      const seed = r.key + d;
      if (!l && rnd(seed + 'abs') < r.habit.absent) {
        if (rnd(seed + 'visit') < 0.5 && d < addDays(today, -1)) correctionCandidates.push({ r, d, kind: 'visit', inMin: 9 * 60 + 30, outMin: 18 * 60 + 45 });
        continue;
      }
      const wfh = l?.code === 'WFH';
      const wd = weekday(d);
      const monsoon = ['07', '08', '09'].includes(d.slice(5, 7));
      let inMin: number;
      let len: number;
      if (r.shift === 'NIGHT') {
        inMin = 21 * 60 + 50 + Math.round(gauss(seed + 'in') * 10);
        len = 9 * 60 - 20 + Math.round(gauss(seed + 'len') * 25);
      } else if (r.shift === 'US') {
        inMin = 12 * 60 + 55 + Math.round(gauss(seed + 'in') * 15);
        len = 9 * 60 + Math.round(gauss(seed + 'len') * 30);
      } else {
        inMin = 9 * 60 + 20 + r.habit.arrive + Math.round(gauss(seed + 'in') * r.habit.spread) + (wd === 1 ? 6 : 0) + (monsoon && wd === 1 ? 8 : 0) + (wfh ? -15 : 0);
        if (rnd(seed + 'vlate') < 0.02) inMin += rint(seed + 'vl', 40, 110); // traffic / appointment
        inMin = Math.max(8 * 60 + 5, Math.min(11 * 60 + 45, inMin));
        len = 8 * 60 + 58 + r.habit.stay + Math.round(gauss(seed + 'len') * 24) - (wd === 5 ? 15 : 0);
        if (r.type === 'IN') len -= 20;
        if (['ceo', 'coo', 'dd1', 'dd2', 'dd3'].includes(r.key)) len += 30;
      }
      if (milestoneCrunch.has(d) && r.dept === 'DEL') len += rint(seed + 'crunch', 50, 140);
      if (rnd(seed + 'early') < 0.03) len -= rint(seed + 'el', 120, 220); // left early (doctor, school pick-up)
      if (l?.half === 'FIRST_HALF') { inMin = 13 * 60 + 40 + rint(seed + 'h1', 0, 20); len = 4 * 60 + 50 + rint(seed + 'h1l', 0, 40); }
      if (l?.half === 'SECOND_HALF') len = 4 * 60 + 20 + rint(seed + 'h2l', 0, 40);
      // Lunch out (a second session) on some days
      const lunch = !wfh && !l?.half && r.shift !== 'NIGHT' && rnd(seed + 'lunch') < 0.32;
      const breakLen = lunch ? rint(seed + 'bl', 25, 65) : 0;
      const breakStart = lunch ? 13 * 60 + rint(seed + 'bs', -15, 30) : null;
      let outMin = inMin + len + breakLen;
      const isToday = d === today;
      if (isToday && nowMin < inMin + 3) continue; // not in yet
      const open = isToday && nowMin < outMin;
      if (open) outMin = nowMin;
      const forgot = !isToday && !wfh && rnd(seed + 'forgot') < 0.007;
      const net = outMin - inMin - (breakStart !== null && breakStart + breakLen <= outMin ? breakLen : 0);
      const lateMinutes = Math.max(0, inMin - (shiftStart + 15));
      const fullDay = 480, halfDay = 240;
      const status = net >= fullDay ? 'PRESENT' : net >= halfDay ? 'HALF_DAY' : 'ABSENT';
      const ip = wfh ? `${pick(seed + 'isp', ['106.51', '49.37', '183.82', '122.172', '157.47'])}.${rint(seed + 'ip3', 1, 254)}.${rint(seed + 'ip4', 1, 254)}` : OFFICE_IP[r.loc]!;
      const id = uuid();
      const checkIn = at(d, inMin);
      const realOut = at(d, outMin);
      const autoOut = at(d, 18 * 60 + 30);
      const checkOut = open ? null : forgot ? autoOut : realOut;
      const rec: Record<string, unknown> = {
        id, companyId, employeeId: r.id, date: D(d), checkIn, checkOut,
        workingMinutes: open ? null : forgot ? Math.max(0, 18 * 60 + 30 - inMin) : net,
        status: open ? 'PRESENT' : forgot ? (18 * 60 + 30 - inMin >= fullDay ? 'PRESENT' : 'HALF_DAY') : status,
        lateMinutes: lateMinutes || null, checkInSource: 'WEB', checkOutSource: open ? null : forgot ? 'AUTO' : 'WEB', checkInIp: ip, checkOutIp: open || forgot ? null : ip,
        sessions: lunch && (!open || nowMin > (breakStart ?? 0) + breakLen) ? 2 : 1, breakMinutes: lunch && !(open && nowMin < (breakStart ?? 0) + breakLen) ? breakLen : null,
        openSince: open ? (lunch && nowMin > (breakStart ?? 0) + breakLen ? at(d, (breakStart ?? 0) + breakLen) : checkIn) : null,
        earlyCheckout: !open && !forgot && net < fullDay && !l?.half, autoClosed: forgot,
        notes: wfh ? 'Working from home' : null, createdAt: checkIn, updatedAt: checkOut ?? checkIn,
      };
      records.push(rec);
      worked.set(`${r.key}|${d}`, { inMin, outMin, breakStart: lunch ? breakStart : null, breakEnd: lunch ? (breakStart ?? 0) + breakLen : null, wfh });
      // Punch trail
      const src = 'WEB';
      const P = (kind: 'IN' | 'OUT', m: number, extra: object = {}) => punches.push({ companyId, employeeId: r.id, recordId: id, date: D(d), kind, at: at(d, m), source: src, ip, deviceId: wfh ? 'home-laptop' : null, createdAt: at(d, m), ...extra });
      P('IN', inMin);
      if (lunch && breakStart !== null && (!open || nowMin > breakStart)) {
        P('OUT', breakStart);
        if (!open || nowMin > breakStart + breakLen) P('IN', breakStart + breakLen);
      }
      if (!open && !forgot) P('OUT', outMin, net < fullDay && !l?.half ? { early: true, note: pick(seed + 'en', ['Doctor’s appointment', 'Picking up my kid from school', 'Not feeling well', 'Bank work before closing', 'Will complete the rest from home']) } : {});
      if (forgot) {
        punches.push({ companyId, employeeId: r.id, recordId: id, date: D(d), kind: 'OUT', at: autoOut, source: 'AUTO', ip: null, createdAt: at(d, 22 * 60 + 30) });
        if (rnd(seed + 'fix') < 0.65) correctionCandidates.push({ r, d, kind: 'forgot', rec, inMin, outMin });
      }
      if (!open && !forgot && lateMinutes > 30 && rnd(seed + 'lc') < 0.12) correctionCandidates.push({ r, d, kind: 'late', rec, inMin: 9 * 60 + 25 + rint(seed + 'lci', 0, 15), outMin });
    }
  }

  // Attendance corrections (regularisations)
  const regReasons = {
    forgot: ['Forgot to check out — left at the usual time', 'Laptop died before I could check out', 'Checked out from the phone but it didn’t go through', 'Left in a hurry for a client call, forgot to check out'],
    late: ['Reached on time — the office Wi-Fi was down so check-in failed', 'Was in the 9:30 client call from the meeting room, checked in after', 'Portal was slow in the morning, check-in went through late'],
    visit: ['Full day at the client office (Northstar HQ)', 'Client workshop at Kaveri Bank, Gachibowli', 'Visa appointment + worked from the consulate lounge', 'Offsite planning session at the Novotel', 'Campus hiring drive at JNTU'],
  };
  for (const c of correctionCandidates) {
    const seed = c.r.key + c.d + 'reg';
    const createdKey = addDays(c.d, rint(seed + 'c', 0, 3));
    if (createdKey > today) continue;
    const recent = createdKey >= addDays(today, -6);
    const rr = rnd(seed + 's');
    const status = recent ? (rr < 0.7 ? 'PENDING' : 'APPROVED') : rr < 0.84 ? 'APPROVED' : rr < 0.95 ? 'REJECTED' : 'CANCELLED';
    const rt = route(c.r, c.d);
    const deciderKey = rt.first ?? 'hrm';
    const cover = covering(deciderKey, createdKey);
    const decided = status === 'APPROVED' || status === 'REJECTED';
    const checkIn = at(c.d, c.inMin);
    const checkOut = at(c.d, c.outMin);
    corrections.push({
      companyId, employeeId: c.r.id, date: D(c.d), checkIn, checkOut, reason: pick(seed + 'r', regReasons[c.kind]), status, approverIds: rt.ids,
      reviewedById: decided ? p(ctx, cover ? cover.to : deciderKey).userId : null, onBehalfOfId: decided && cover ? p(ctx, deciderKey).userId : null,
      reviewedAt: decided ? stamp(addDays(createdKey, rint(seed + 'd', 0, 2)) > today ? today : addDays(createdKey, rint(seed + 'd', 0, 2)), 11, rint(seed + 'm', 0, 59)) : null,
      reviewNote: status === 'REJECTED' ? pick(seed + 'n', ['No record of you in office that day — please talk to me.', 'Times don’t match the gate log.', 'Please apply WFH for this day instead.']) : null,
      createdAt: stamp(createdKey, 10, rint(seed + 'cm', 0, 59)),
    });
    if (status === 'APPROVED') {
      if (c.rec) {
        const net = c.outMin - c.inMin - (Number(c.rec.breakMinutes) || 0);
        Object.assign(c.rec, { checkIn, checkOut, workingMinutes: net, status: net >= 480 ? 'PRESENT' : net >= 240 ? 'HALF_DAY' : 'ABSENT', checkOutSource: 'REGULARISED', autoClosed: false, lateMinutes: Math.max(0, c.inMin - (9 * 60 + 45)) || null, isManualEntry: true, ...(c.kind === 'late' && { checkInSource: 'REGULARISED' }) });
      } else {
        const id = uuid();
        records.push({ id, companyId, employeeId: c.r.id, date: D(c.d), checkIn, checkOut, workingMinutes: c.outMin - c.inMin, status: 'PRESENT', lateMinutes: null, checkInSource: 'REGULARISED', checkOutSource: 'REGULARISED', isManualEntry: true, sessions: 1, notes: 'Client visit', createdAt: checkIn, updatedAt: checkOut });
        punches.push({ companyId, employeeId: c.r.id, recordId: id, date: D(c.d), kind: 'IN', at: checkIn, source: 'REGULARISED', createdAt: checkIn }, { companyId, employeeId: c.r.id, recordId: id, date: D(c.d), kind: 'OUT', at: checkOut, source: 'REGULARISED', createdAt: checkOut });
        worked.set(`${c.r.key}|${c.d}`, { inMin: c.inMin, outMin: c.outMin, breakStart: null, breakEnd: null, wfh: false });
      }
    }
  }
  // Too many corrections in one month for one person (triggers the alert on the approvals page)
  const bharat = p(ctx, 'sc4');
  for (const [i, d] of ['2026-09-07', '2026-09-09', '2026-09-14', '2026-09-16', '2026-09-21', '2026-09-23'].entries()) {
    if (!isWorkday(bharat, d)) continue;
    corrections.push({ companyId, employeeId: bharat.id, date: D(d), checkIn: at(d, 9 * 60 + 35), checkOut: at(d, 18 * 60 + 50), reason: pick('bh' + i, ['Night VAPT window for Ledger — checked in late after sleeping in', 'Worked from the SOC room, check-in failed', 'On-call incident at 2 am, came in late']), status: i < 4 ? 'APPROVED' : 'PENDING', approverIds: [p(ctx, 'sl2').userId], reviewedById: i < 4 ? p(ctx, 'sl2').userId : null, reviewedAt: i < 4 ? stamp(addDays(d, 1), 12) : null, createdAt: stamp(addDays(d, 1), 10) });
  }

  await chunked(records, 2000, (part) => prisma.attendanceRecord.createMany({ data: part as never }));
  await chunked(punches, 4000, (part) => prisma.attendancePunch.createMany({ data: part as never }));
  await chunked(corrections, 1000, (part) => prisma.attendanceRegularisation.createMany({ data: part as never }));
  ctx.count.attendanceDays = records.length;
  ctx.count.punches = punches.length;
  ctx.count.corrections = corrections.length;
  ctx.worked = worked;

  await seedTimesheets(ctx, worked, route);
}

// ─── Timesheets ─────────────────────────────────────────────

const TASKS: Record<string, string[]> = {
  HELIX: ['Forecast service API', 'Store dashboard filters', 'Kafka consumer for POS events', 'Planner grid UI', 'Snowflake cost tuning', 'Pricing API integration', 'Bug fixes from UAT', 'Stock-out alerts'],
  ORBIT: ['Video KYC flow', 'UPI collect requests', 'Cards module — EMI conversion', 'RBI audit fixes', 'Biometric login', 'Push notifications', 'Statement download', 'App performance (cold start)'],
  PULSE: ['Consult room (WebRTC)', 'e-Prescription templates', 'ABDM consent flow', 'Doctor app v3 calendar', 'Regression automation', 'Pharmacy delivery API', 'FHIR export'],
  ATLAS: ['Driver app offline mode', 'Proof-of-delivery photos', 'Route ETA service', 'Hypercare tickets', 'Hand-over documentation'],
  LEDGER: ['OCR pipeline', 'Fraud rules engine', 'Camunda claim workflow', 'Motor STP rules', 'Health STP discovery', 'Agent portal wireframes', 'Claims dashboard'],
  BEACON: ['Hand-over to Sunrise IT', 'Bug fixes', 'Release notes'],
  NIMBUS: ['Iceberg table migration', 'Airflow DAG refactor', 'Data contracts', 'Metrics layer API (Go)', 'FinOps cost dashboard', 'dbt model tests', 'Pipeline on-call'],
  SPROUT: ['RAG retrieval tuning', 'Evaluation harness', 'SSO + audit trail', 'Beta admin console', 'Prompt library', 'Document ingestion (SharePoint)', 'Answer citations UI'],
  VERTEX: ['SCORM player', 'Assessments module', 'Phase 2 estimates', 'Client calls', 'Knowledge transfer docs'],
  QUILL: ['Discovery with Lexora'],
};
const INTERNAL = ['Team stand-up', 'Hiring interview', 'Learning — AWS certification', 'Town hall', 'Knowledge-sharing session', '1:1 with manager', 'Internal tooling'];

function workTypeFor(title: string, role: string, seed: string) {
  if (role === 'MANAGER') return pick(seed, ['Meeting', 'Planning', 'Client call', 'Review', 'Reporting']);
  if (/QA/.test(title)) return pick(seed, ['Testing', 'Testing', 'Test automation', 'Meeting', 'Bug triage']);
  if (/Analyst/.test(title)) return pick(seed, ['Analysis', 'Meeting', 'Documentation', 'Client call']);
  if (/Design|UX|UI/.test(title)) return pick(seed, ['Design', 'Design', 'Research', 'Review', 'Meeting']);
  if (role === 'TEAM_LEAD') return pick(seed, ['Development', 'Code review', 'Meeting', 'Planning', 'Development']);
  if (/DevOps/.test(title)) return pick(seed, ['DevOps', 'Support', 'Development']);
  return pick(seed, ['Development', 'Development', 'Development', 'Code review', 'Bug fix', 'Meeting', 'Testing']);
}

async function seedTimesheets(ctx: Ctx, worked: Map<string, { inMin: number; outMin: number; breakStart: number | null; breakEnd: number | null; wfh: boolean }>, route: (r: Row, k: string) => { ids: string[]; label: string; first: string | null }) {
  const { prisma, companyId, today } = ctx;
  const MEMBERS = ctx.members!;
  const sheets = new Map<string, { id: string; r: Row; week: string; entries: Array<Record<string, unknown>> }>();
  const lastWeek = addDays(mondayOf(today), -7);
  const thisWeek = mondayOf(today);
  const lateSubmitters = new Set(['e16', 'e47', 'e33']);
  const rejectedWeeks = new Set(['e03|2026-03-30', 'e21|2026-07-20', 'e43|2026-09-07', 'e29|2026-09-21']);
  const projectName = (code: string) => PROJECTS.find((x) => x.code === code)!.name;
  const projectIds: Record<string, string> = ctx.projectId!;

  for (const r of ctx.people.values()) {
    const mine = MEMBERS.filter((m) => m.key === r.key);
    if (!mine.length) continue;
    for (const [k, w] of worked) {
      if (!k.startsWith(r.key + '|')) continue;
      const d = k.slice(r.key.length + 1);
      if (d === today && w.outMin > nowMinutesIST() - 5) {
        // still working today: log the morning only
      }
      const active = mine.filter((m) => m.from <= d && (!m.to || m.to >= d) && PROJECTS.find((x) => x.code === m.code)!.start <= d);
      if (!active.length) continue;
      const seed = r.key + d + 'ts';
      // Logged time ≈ time at work minus breaks and a little slack
      const breakMin = w.breakStart !== null && w.breakEnd !== null ? w.breakEnd - w.breakStart : 0;
      let total = Math.round((w.outMin - w.inMin - breakMin - rint(seed + 'slack', 20, 70)) / 15) * 15;
      if (total < 60) continue;
      const internal = rnd(seed + 'int') < 0.35 ? Math.min(total - 60, rint(seed + 'intm', 1, 4) * 15) : 0;
      const totalAlloc = active.reduce((n, m) => n + m.allocation, 0);
      const parts: Array<{ code: string | null; minutes: number; role: string }> = active.map((m) => ({ code: m.code, minutes: Math.round(((total - internal) * m.allocation) / totalAlloc / 15) * 15, role: m.role }));
      if (internal) parts.push({ code: null, minutes: internal, role: 'MEMBER' });
      // Split project time into 1–3 blocks
      const blocks: Array<{ code: string | null; minutes: number; role: string }> = [];
      for (const part of parts) {
        if (part.minutes <= 0) continue;
        const n = part.minutes >= 300 ? rint(seed + part.code + 'n', 2, 3) : part.minutes >= 150 ? rint(seed + part.code + 'n', 1, 2) : 1;
        let left = part.minutes;
        for (let i = 0; i < n; i++) {
          const m = i === n - 1 ? left : Math.round((left / (n - i)) * (0.7 + rnd(seed + part.code + i) * 0.6) / 15) * 15;
          if (m > 0) blocks.push({ ...part, minutes: m });
          left -= m;
        }
      }
      // Lay blocks out in time from check-in, skipping the lunch break
      let cursor = Math.ceil(w.inMin / 15) * 15;
      const week = mondayOf(d);
      const sheetKey = `${r.key}|${week}`;
      const sheet = sheets.get(sheetKey) ?? { id: uuid(), r, week, entries: [] };
      sheets.set(sheetKey, sheet);
      for (const [i, b] of shuffle(seed, blocks).entries()) {
        if (w.breakStart !== null && cursor < w.breakEnd! && cursor + b.minutes > w.breakStart) cursor = Math.max(cursor, Math.ceil(w.breakEnd! / 15) * 15);
        const startMin = cursor;
        const endMin = cursor + b.minutes;
        cursor = endMin + (rnd(seed + 'gap' + i) < 0.3 ? 15 : 0);
        const task = b.code ? pick(seed + 'task' + i, TASKS[b.code]!) : pick(seed + 'itask' + i, INTERNAL);
        sheet.entries.push({
          id: uuid(), companyId, timesheetId: sheet.id, employeeId: r.id, date: D(d), projectId: b.code ? projectIds[b.code] : null, task,
          billable: Boolean(b.code) && PROJECTS.find((x) => x.code === b.code)!.type === 'CLIENT' && (active.find((m) => m.code === b.code)?.billed ?? true),
          minutes: b.minutes, line: i, startMin, endMin, workType: b.code ? workTypeFor(r.title, b.role, seed + 'wt' + i) : 'Meeting',
          description: b.code ? pick(seed + 'desc' + i, [`${task} — continued`, `${task}: review comments addressed`, `${task} — pairing with the team`, `${task}; raised PR`, `Worked on ${task.toLowerCase()}`]) : null,
          _code: b.code, _day: d,
        });
      }
    }
  }

  // Statuses per block, then roll up to the week
  const entries: object[] = [];
  const weekRows: object[] = [];
  for (const s of sheets.values()) {
    const r = s.r;
    const seed = r.key + s.week;
    let weekStatus: 'APPROVED' | 'SUBMITTED' | 'DRAFT' | 'REJECTED' =
      s.week >= thisWeek ? (rnd(seed + 'tw') < 0.25 ? 'SUBMITTED' : 'DRAFT')
        : s.week >= lastWeek ? (rnd(seed + 'lw') < 0.28 ? 'APPROVED' : rnd(seed + 'lw2') < 0.9 ? 'SUBMITTED' : 'DRAFT')
          : 'APPROVED';
    if (lateSubmitters.has(r.key) && s.week >= addDays(lastWeek, -14)) weekStatus = 'DRAFT';
    if (rejectedWeeks.has(`${r.key}|${s.week}`)) weekStatus = 'REJECTED';
    if (r.lastDay && r.lastDay < today && s.week >= mondayOf(r.lastDay)) weekStatus = 'APPROVED';
    const submittedAt = weekStatus === 'DRAFT' ? null : stamp(addDays(s.week, 4) > today ? today : addDays(s.week, 4), 18, rint(seed + 'sm', 0, 59));
    let total = 0;
    let decidedAt: Date | null = null;
    let decidedBy: string | null = null;
    const labels = new Set<string>();
    const approverSet = new Set<string>();
    for (const e of s.entries) {
      const code = e._code as string | null;
      const day = e._day as string;
      delete e._code;
      delete e._day;
      const m = code ? MEMBERS.find((x) => x.key === r.key && x.code === code && x.from <= day && (!x.to || x.to >= day)) : null;
      // Block route: members → their lead on that project; leads → the PM; PMs and internal work → line manager
      let ids: string[];
      let label: string;
      if (m && m.role === 'MEMBER' && m.lead && employedOn(p(ctx, m.lead), day)) { ids = [p(ctx, m.lead).userId]; label = `Team lead · ${projectName(code!)}`; }
      else if (m && m.role === 'TEAM_LEAD') { const pm = MEMBERS.find((x) => x.code === code && x.role === 'MANAGER' && x.from <= day && (!x.to || x.to >= day)); ids = pm ? [p(ctx, pm.key).userId] : []; label = `Project manager · ${projectName(code!)}`; }
      else { const rt = route(r, day); ids = rt.label === 'Line manager' || rt.label === 'PMO lead' || rt.label === 'HR' ? rt.ids : r.mgr ? [p(ctx, r.mgr).userId] : rt.ids; label = r.mgr ? 'Line manager' : rt.label; }
      let status = weekStatus;
      if (weekStatus === 'REJECTED' && rnd(String(e.id)) < 0.6) status = 'APPROVED';
      if (weekStatus === 'SUBMITTED' && s.week >= lastWeek && rnd(String(e.id) + 'p') < 0.15) status = 'APPROVED';
      const decided = status === 'APPROVED' || status === 'REJECTED';
      const decKey = addDays(s.week, 7 + rint(String(e.id), 0, 3)) > today ? today : addDays(s.week, 7 + rint(String(e.id), 0, 3));
      const deciderUser = ids[0] ?? p(ctx, 'hrm').userId;
      const at_ = decided ? stamp(decKey, 10 + rint(String(e.id) + 'h', 0, 7), rint(String(e.id) + 'm', 0, 59)) : null;
      Object.assign(e, {
        status, approverIds: status === 'DRAFT' ? [] : ids, approverLabel: status === 'DRAFT' ? null : label, submittedAt,
        submitNote: submittedAt && rnd(String(e.id) + 'note') < 0.01 ? 'Thursday includes the late release call.' : null,
        decidedById: decided ? deciderUser : null, decidedAt: at_,
        decisionNote: status === 'REJECTED' ? pick(String(e.id) + 'rn', ['Split this between Helix and internal — the hiring panel isn’t project time.', 'Hours on Friday don’t match your attendance.', 'Please add a description for this block.', 'This should be non-billable — it was shadowing.']) : null,
        createdAt: stamp((e.date as Date).toISOString().slice(0, 10), 19, 0), updatedAt: at_ ?? submittedAt ?? stamp((e.date as Date).toISOString().slice(0, 10), 19, 0),
      });
      total += e.minutes as number;
      if (status === 'SUBMITTED') ids.forEach((x) => approverSet.add(x));
      if (status !== 'DRAFT') labels.add(label);
      if (at_ && (!decidedAt || at_ > decidedAt)) { decidedAt = at_; decidedBy = deciderUser; }
      entries.push(e);
    }
    const sts = s.entries.map((e) => e.status as string);
    const roll = sts.includes('REJECTED') ? 'REJECTED' : sts.includes('DRAFT') ? 'DRAFT' : sts.includes('SUBMITTED') ? 'SUBMITTED' : 'APPROVED';
    weekRows.push({
      id: s.id, companyId, employeeId: r.id, weekStart: D(s.week), status: roll, totalMinutes: total, approverIds: [...approverSet], approverLabel: [...labels].join(', ') || null,
      submittedAt, decidedById: decidedBy, decidedAt, decisionNote: roll === 'REJECTED' ? (s.entries.find((e) => e.status === 'REJECTED')!.decisionNote as string) : null,
      createdAt: stamp(s.week, 19, 0),
    });
  }
  await chunked(weekRows, 1000, (part) => prisma.timesheet.createMany({ data: part as never }));
  await chunked(entries, 3000, (part) => prisma.timesheetEntry.createMany({ data: part as never }));
  ctx.count.timesheetWeeks = weekRows.length;
  ctx.count.timesheetBlocks = entries.length;
}

function shuffle<T>(seed: string, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(`${seed}:${i}`) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
