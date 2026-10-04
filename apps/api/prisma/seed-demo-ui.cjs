/* eslint-disable */
// ============================================================
// Demo data for every new screen (development only).
//
//   DEMO_PASSWORD='…' node prisma/seed-demo-ui.cjs <company-slug>
//   (or: pnpm --filter @hrms/api db:seed-demo-ui -- <company-slug>)
//
// Run after db:seed-demo. Needs a built API (pnpm --filter @hrms/api build).
//
// 1. Straight into the database (history the API can't create):
//    more departments and people — joiners across the year, one joining
//    next month, two leavers, one on notice, two whose probation ends this
//    month — work anniversaries and birthdays (some today), festival
//    holidays, multi-session days with an early check-out, today's
//    sessions for Priya, and a night shift still running for Rahul.
// 2. Through the real API, as the demo people (a private API on :4001 with
//    console email — nobody is emailed; the console mails are deleted):
//    approved and pending leave (Who's off calendar, approvals), an
//    attendance correction, expense claims, kudos with reactions and
//    announcements.
// Safe to re-run: existing people / holidays / titles are kept.
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const slug = process.argv[2];
const password = process.env.DEMO_PASSWORD;
const PORT = process.env.SEED_API_PORT || '4001';
const API = `http://localhost:${PORT}/api/v1`;
const ROOT = path.resolve(__dirname, '..');
const log = (...a) => console.log('·', ...a);

const DAY = 86_400_000;
const keyIn = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const D = (key) => new Date(`${key}T00:00:00Z`);
/** Wall-clock minutes on a date in a time zone → instant. */
function zoned(dateKey, minutes, timeZone) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const offset = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - guess;
  return new Date(guess - offset);
}
const mins = (a, b) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));

// ─── 1 · Database ───────────────────────────────────────────

const NEW_DEPARTMENTS = [['DES', 'Design'], ['QA', 'Quality'], ['SUP', 'Support'], ['MKT', 'Marketing'], ['LEG', 'Legal'], ['DATA', 'Data'], ['SEC', 'Security'], ['DEVOPS', 'DevOps'], ['ADMIN', 'Admin']];
// [first, last, local, dept, joined, status, extra]
const NEW_PEOPLE = [
  ['Arjun', 'Nair', 'arjun', 'DES', '2026-02-09', 'ACTIVE', { dob: '1994-11-02' }],
  ['Tanvi', 'Shah', 'tanvi', 'QA', '2026-04-06', 'ACTIVE', { dob: '1996-10-09' }],
  ['Rohit', 'Singh', 'rohit', 'SUP', '2026-05-18', 'ACTIVE', {}],
  ['Ananya', 'Bose', 'ananya', 'MKT', '2026-07-01', 'PROBATION', { confirm: 'month-end' }],
  ['Kabir', 'Malhotra', 'kabir', 'DATA', '2026-08-17', 'PROBATION', { confirm: 'mid-month' }],
  ['Ishita', 'Kapoor', 'ishita', 'SEC', '2026-09-07', 'ACTIVE', { dob: '1997-10-04' }],
  ['Dev', 'Menon', 'dev', 'DEVOPS', 'today-3', 'ACTIVE', {}],
  ['Farah', 'Ali', 'farah', 'LEG', 'next-month', 'ACTIVE', {}],
  ['Nikhil', 'Jain', 'nikhil', 'ADMIN', '2025-03-03', 'TERMINATED', { left: '2026-03-31' }],
  ['Zoya', 'Siddiqui', 'zoya', 'SUP', '2025-06-02', 'TERMINATED', { left: '2026-08-14' }],
  ['Sameer', 'Gill', 'sameer', 'QA', '2025-11-03', 'NOTICE_PERIOD', { left: 'month-end' }],
];
// Work anniversaries: [local, joined] — Vikram's is today
const ANNIVERSARIES = [['vikram', 'today-5y'], ['ravi', 'in2-3y'], ['meena', 'in11-2y'], ['hema', 'in17-1y']];
// Birthdays: [local, yyyy, offset days]
const BIRTHDAYS = [['karan', 1992, 0], ['neha', 1994, 0], ['amit', 1996, 1], ['sara', 1993, 6], ['divya', 1995, 16], ['rahul', 1991, 24], ['pooja', 1990, 40]];
const FESTIVALS = [['Dussehra', '2026-10-20'], ['Diwali', '2026-11-08'], ['Holi', '2027-03-22'], ['New Year’s Day', '2027-01-01']];

async function seedDatabase(company, tz) {
  const companyId = company.id;
  const today = keyIn(new Date(), tz);
  const email = (local) => `${local}.${slug.split('-')[0]}@yopmail.com`;
  const byLocal = async (local) => prisma.employee.findFirst({ where: { companyId, email: email(local) } });

  // Departments
  const dept = {};
  for (const [code, name] of NEW_DEPARTMENTS) {
    const d = (await prisma.department.findFirst({ where: { companyId, name } })) ?? (await prisma.department.create({ data: { companyId, code, name } }));
    dept[code] = d.id;
  }
  log(`${NEW_DEPARTMENTS.length} extra departments ready`);

  // People
  const vikram = await byLocal('vikram');
  const role = await prisma.role.findFirst({ where: { companyId, key: 'employee' } });
  const hash = password ? await bcrypt.hash(password, 12) : await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 12);
  const settings = await prisma.companySettings.findUnique({ where: { companyId } });
  let seq = settings?.employeeIdSequence ?? 0;
  const prefix = settings?.employeeIdPrefix ?? 'EMP';
  const monthEnd = (() => { const [y, m] = today.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); })();
  const resolve = (v) => v === 'today-3' ? addDays(today, -3) : v === 'next-month' ? addDays(monthEnd, 2) : v === 'month-end' ? addDays(monthEnd, -2) : v === 'mid-month' ? `${today.slice(0, 7)}-15` : v;
  let added = 0;
  for (const [first, last, local, d, joined, status, extra] of NEW_PEOPLE) {
    if (await byLocal(local)) continue;
    seq++;
    const user = await prisma.user.create({
      data: {
        email: email(local), passwordHash: hash, firstName: first, lastName: last, companyId,
        status: status === 'TERMINATED' ? 'INACTIVE' : 'ACTIVE', emailVerifiedAt: new Date(), mustChangePassword: false,
        userRoles: role ? { create: [{ roleId: role.id, companyId }] } : undefined,
      },
    });
    const emp = await prisma.employee.create({
      data: {
        companyId, userId: user.id, employeeId: `${prefix}${String(seq).padStart(3, '0')}`, firstName: first, lastName: last, email: email(local),
        departmentId: dept[d], reportingManagerId: vikram?.id ?? null, joiningDate: D(resolve(joined)), employmentStatus: status,
        dateOfBirth: extra.dob ? D(extra.dob) : null,
        confirmationDate: extra.confirm ? D(resolve(extra.confirm)) : null,
        terminationDate: extra.left ? D(resolve(extra.left)) : null,
      },
    });
    await prisma.employeeHierarchy.createMany({
      data: [{ companyId, ancestorId: emp.id, descendantId: emp.id, depth: 0 }, ...(vikram ? [{ companyId, ancestorId: vikram.id, descendantId: emp.id, depth: 1 }] : [])],
      skipDuplicates: true,
    });
    added++;
  }
  await prisma.companySettings.update({ where: { companyId }, data: { employeeIdSequence: seq } });
  log(`${added} people added (joiners, a future joiner, leavers, notice, probation)`);

  // Anniversaries and birthdays
  for (const [local, when] of ANNIVERSARIES) {
    const m = when.match(/^(today|in(\d+))-(\d+)y$/);
    const day = m[1] === 'today' ? today : addDays(today, Number(m[2]));
    const joined = `${Number(day.slice(0, 4)) - Number(m[3])}${day.slice(4)}`;
    await prisma.employee.updateMany({ where: { companyId, email: email(local) }, data: { joiningDate: D(joined) } });
  }
  for (const [local, year, offset] of BIRTHDAYS) {
    const day = addDays(today, offset);
    await prisma.employee.updateMany({ where: { companyId, email: email(local) }, data: { dateOfBirth: D(`${year}${day.slice(4)}`) } });
  }
  log('work anniversaries (Vikram today) and birthdays (Karan and Neha today) set');

  // Festival holidays (for the Coming up card and atmosphere moments)
  for (const [name, date] of FESTIVALS) {
    const exists = await prisma.publicHoliday.findFirst({ where: { companyId, name, date: D(date) } });
    if (!exists) await prisma.publicHoliday.create({ data: { companyId, name, date: D(date), year: Number(date.slice(0, 4)) } });
  }
  log('festival holidays added: ' + FESTIVALS.map((f) => f[0]).join(', '));

  // Multi-session days this week (lunch break), one early check-out with a reason
  const policy = await prisma.attendancePolicy.findUnique({ where: { companyId } });
  const full = policy?.fullDayMinutes ?? 480;
  const half = policy?.halfDayMinutes ?? 240;
  const status = (w) => (w >= full ? 'PRESENT' : w >= half ? 'HALF_DAY' : 'ABSENT');
  let reshaped = 0;
  for (const local of ['priya', 'amit', 'neha', 'sara']) {
    const e = await byLocal(local);
    if (!e) continue;
    const records = await prisma.attendanceRecord.findMany({ where: { companyId, employeeId: e.id, date: { gte: D(addDays(today, -7)), lt: D(today) }, checkIn: { not: null }, checkOut: { not: null } } });
    for (const r of records) {
      const key = r.date.toISOString().slice(0, 10);
      const lunchOut = zoned(key, 13 * 60 + 5, tz);
      const lunchIn = zoned(key, 13 * 60 + 45, tz);
      if (!(r.checkIn < lunchOut && r.checkOut > lunchIn)) continue;
      const early = local === 'amit' && key === addDays(today, -3);
      const out = early ? zoned(key, 15 * 60 + 30, tz) : r.checkOut;
      const worked = mins(r.checkIn, lunchOut) + mins(lunchIn, out);
      await prisma.attendancePunch.deleteMany({ where: { recordId: r.id } });
      await prisma.attendancePunch.createMany({
        data: [
          { companyId, employeeId: e.id, recordId: r.id, date: r.date, kind: 'IN', at: r.checkIn },
          { companyId, employeeId: e.id, recordId: r.id, date: r.date, kind: 'OUT', at: lunchOut },
          { companyId, employeeId: e.id, recordId: r.id, date: r.date, kind: 'IN', at: lunchIn },
          { companyId, employeeId: e.id, recordId: r.id, date: r.date, kind: 'OUT', at: out, early: worked < full, note: early ? 'Doctor’s appointment' : null },
        ],
      });
      await prisma.attendanceRecord.update({ where: { id: r.id }, data: { checkOut: out, sessions: 2, breakMinutes: 40, workingMinutes: worked, openSince: null, earlyCheckout: worked < full, status: status(worked) } });
      reshaped++;
    }
  }
  log(`${reshaped} past days now have two sessions (one early check-out with a reason)`);

  // Today for Priya: one finished session and one still running
  const priya = await byLocal('priya');
  const now = new Date();
  const nowMin = Math.floor((now.getTime() - zoned(today, 0, tz).getTime()) / 60_000);
  if (priya && nowMin > 90) {
    const existing = await prisma.attendanceRecord.findFirst({ where: { companyId, employeeId: priya.id, date: D(today) } });
    if (!existing) {
      const in1 = new Date(now.getTime() - 85 * 60_000);
      const out1 = new Date(now.getTime() - 50 * 60_000);
      const in2 = new Date(now.getTime() - 30 * 60_000);
      const rec = await prisma.attendanceRecord.create({ data: { companyId, employeeId: priya.id, date: D(today), checkIn: in1, checkOut: null, openSince: in2, sessions: 2, breakMinutes: 20, workingMinutes: mins(in1, out1), status: 'PRESENT', checkInSource: 'WEB', earlyCheckout: false } });
      await prisma.attendancePunch.createMany({
        data: [
          { companyId, employeeId: priya.id, recordId: rec.id, date: D(today), kind: 'IN', at: in1 },
          { companyId, employeeId: priya.id, recordId: rec.id, date: D(today), kind: 'OUT', at: out1, early: true, note: 'Quick errand' },
          { companyId, employeeId: priya.id, recordId: rec.id, date: D(today), kind: 'IN', at: in2 },
        ],
      });
      log('Priya: two sessions today (second still running)');
    }
  }

  // Night shift: Rahul on a night project, checked in since last night
  const rahul = await byLocal('rahul');
  if (rahul) {
    let project = await prisma.project.findFirst({ where: { companyId, code: 'NIGHT' } });
    if (!project) project = await prisma.project.create({ data: { companyId, code: 'NIGHT', name: 'Night ops', clientName: 'Northwind Bank', startDate: D(addDays(today, -30)) } });
    const member = await prisma.projectMember.findFirst({ where: { projectId: project.id, employeeId: rahul.id } });
    if (!member) await prisma.projectMember.create({ data: { companyId, projectId: project.id, employeeId: rahul.id, role: 'MEMBER', allocation: 50, nightShift: true, startDate: D(addDays(today, -30)) } });
    const yesterday = addDays(today, -1);
    const since = zoned(yesterday, 21 * 60 + 30, tz);
    const y = await prisma.attendanceRecord.findFirst({ where: { companyId, employeeId: rahul.id, date: D(yesterday) } });
    if (!y && now.getTime() - since.getTime() < 20 * 3600_000) {
      const rec = await prisma.attendanceRecord.create({ data: { companyId, employeeId: rahul.id, date: D(yesterday), checkIn: since, openSince: since, sessions: 1, status: 'PRESENT', checkInSource: 'WEB' } });
      await prisma.attendancePunch.create({ data: { companyId, employeeId: rahul.id, recordId: rec.id, date: D(yesterday), kind: 'IN', at: since } });
      log('Rahul: night shift running since 9:30 PM yesterday');
    }
  }
}

// ─── 2 · Through the API ────────────────────────────────────

async function call(token, method, url, body) {
  const r = await fetch(API + url, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  const err = j.detail ?? j.error?.message ?? j.message ?? j.error;
  return { status: r.status, data: j.data, error: Array.isArray(err) ? err.join('; ') : typeof err === 'object' ? JSON.stringify(err) : err ?? `HTTP ${r.status}` };
}
const tokens = {};
async function as(local) {
  if (tokens[local]) return tokens[local];
  let r;
  for (let i = 0; i < 8; i++) {
    r = await call(null, 'POST', '/auth/login', { email: `${local}.${slug.split('-')[0]}@yopmail.com`, password });
    if (r.status !== 429) break;
    await new Promise((res) => setTimeout(res, 15_000)); // sign-in is rate limited
  }
  if (!r.data?.access_token) throw new Error(`Sign-in failed for ${local}: ${r.error}`);
  return (tokens[local] = r.data.access_token);
}

async function seedThroughApi(company, tz) {
  const today = keyIn(new Date(), tz);
  const companyId = company.id;
  const types = Object.fromEntries((await prisma.leaveType.findMany({ where: { companyId } })).map((t) => [t.code, t.id]));
  const weekday = (offset) => { let k = addDays(today, offset); while ([0, 6].includes(new Date(`${k}T00:00:00Z`).getUTCDay())) k = addDays(k, 1); return k; };

  // Leave: approved (Who's off calendar) and pending (approvals, swipe-away)
  const leaves = [
    ['sara', 'WFH', 2, 3, 'approve', 'Plumber visit at home'],
    ['divya', 'CL', 4, 4, 'approve', 'Family function'],
    ['pooja', 'SL', 5, 5, 'approve', 'Fever'],
    ['meena', 'EL', 9, 10, 'approve', 'Short trip'],
    ['karan', 'WFH', 15, 15, 'approve', 'Internet installation'],
    ['divya', 'CL', 18, 18, 'pending', 'Bank work'],
    ['sara', 'CL', 23, 23, 'pending', 'Personal'],
  ];
  for (const [who, code, from, to, decision, reason] of leaves) {
    const start = weekday(from);
    const end = to > from ? weekday(to) : start;
    const r = await call(await as(who), 'POST', '/leave/requests', { leaveTypeId: types[code], startDate: start, endDate: end < start ? start : end, reason });
    if (r.status >= 300) { log(`leave for ${who} skipped (${r.error})`); continue; }
    if (decision === 'approve') {
      const a = await call(await as('hema'), 'POST', `/leave/requests/${r.data.id}/approve`, { note: 'Enjoy' });
      log(`leave ${who} ${code} ${start} → ${a.status < 300 ? a.data.status : 'approve failed: ' + a.error}`);
    } else log(`leave ${who} ${code} ${start} → pending`);
  }

  // Attendance correction waiting for Priya (Amit forgot to check out)
  // The most recent working day at least two days ago
  let day = addDays(today, -2);
  while ([0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())) day = addDays(day, -1);
  const amitId = (await prisma.employee.findFirst({ where: { companyId, email: { startsWith: 'amit.' } } }))?.id;
  const already = await prisma.attendanceRegularisation.findFirst({ where: { companyId, employeeId: amitId, status: 'PENDING' } });
  const corr = already ? { status: 200 } : await call(await as('amit'), 'POST', '/attendance/regularisations', { date: day, checkIn: '09:20', checkOut: '18:40', reason: 'Forgot to check out — was in the office till 6:40' });
  log(`correction from Amit → ${corr.status < 300 ? 'pending' : corr.error}`);

  // Expense claims waiting for approval
  const cats = Object.fromEntries((await prisma.expenseCategory.findMany({ where: { companyId } })).map((c) => [c.name, c.id]));
  const claims = [
    ['amit', 'Client visit — Mumbai', [['Travel', 4250, 'Flight BLR → BOM'], ['Food', 860, 'Team lunch with client']]],
    ['neha', 'Internet — September', [['Internet / phone', 999, 'Home broadband']]],
    ['rahul', 'Night shift cab rides', [['Local conveyance', 1460, 'Cabs home after 2 AM']]],
  ];
  for (const [who, title, items] of claims) {
    const exists = await prisma.expenseClaim.findFirst({ where: { companyId, title } });
    if (exists && exists.status !== 'DRAFT') continue;
    if (exists) await prisma.expenseClaim.delete({ where: { id: exists.id } }); // an earlier run's draft without receipts
    let id;
    {
      const c = await call(await as(who), 'POST', '/expenses/claims', { title });
      if (c.status >= 300) { log(`claim ${title} skipped (${c.error})`); continue; }
      id = c.data.id;
      for (const [cat, amount, description] of items) await addItem(await as(who), id, { categoryId: cats[cat], date: addDays(today, -4), description, amount });
    }
    const s = await call(await as(who), 'POST', `/expenses/claims/${id}/submit`);
    log(`claim "${title}" → ${s.status < 300 ? 'submitted' : s.error}`);
  }

  // Kudos with reactions (the moving Kudos card)
  const values = Object.fromEntries((await prisma.kudosValue.findMany({ where: { companyId } })).map((v) => [v.name, v.id]));
  const ids = Object.fromEntries((await prisma.employee.findMany({ where: { companyId }, select: { id: true, email: true } })).map((e) => [e.email.split('.')[0], e.id]));
  const kudos = [
    ['hema', ['karan', 'neha'], 'Happy birthday, both of you! Thanks for making this team so much fun.', 'Teamwork'],
    ['ravi', ['priya'], 'Brilliant sprint planning — every story was ready before Monday.', 'Ownership'],
    ['meena', ['rahul'], 'Closed the Northwind renewal while covering night shifts. Legend.', 'Extra mile'],
    ['priya', ['amit'], 'Your code reviews make everyone better. Thank you!', 'Innovation'],
    ['vikram', ['hema'], 'Onboarded three new joiners in one week without a hitch.', 'Ownership'],
    ['neha', ['sara'], 'Thanks for pairing on the payments bug — patient and sharp.', 'Teamwork'],
  ];
  const reactors = ['vikram', 'ravi', 'priya', 'amit', 'neha', 'divya'];
  for (const [from, to, message, value] of kudos) {
    if (await prisma.kudos.findFirst({ where: { companyId, message } })) continue;
    const k = await call(await as(from), 'POST', '/kudos', { recipientIds: to.map((x) => ids[x]).filter(Boolean), message, valueId: values[value] ?? null });
    if (k.status >= 300) { log(`kudos skipped (${k.error})`); continue; }
    for (const [i, r] of reactors.filter((x) => x !== from).slice(0, 3).entries()) await call(await as(r), 'POST', `/kudos/${k.data.id}/reactions`, { emoji: ['👏', '🎉', '❤️'][i] });
  }
  log(`${kudos.length} kudos with reactions`);

  // Announcements
  const posts = [
    { title: 'Diwali celebration — 6 November', body: 'Lunch and rangoli competition at 1 PM in the cafeteria. Wear something festive!', audience: 'COMPANY', pinned: true },
    { title: 'Updated leave policy for 2027', body: 'Carry-forward of earned leave changes from January. Please read and confirm.', audience: 'COMPANY', requiresAck: true },
  ];
  for (const p of posts) {
    if (await prisma.announcement.findFirst({ where: { companyId, title: p.title } })) continue;
    const a = await call(await as('hema'), 'POST', '/announcements', { ...p, sendEmail: false });
    log(`announcement "${p.title}" → ${a.status < 300 ? 'posted' : a.error}`);
  }
}

/** A tiny PNG "receipt" (claims need one per item). */
const RECEIPT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
async function addItem(token, claimId, fields) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  form.append('receipt', new Blob([RECEIPT], { type: 'image/png' }), 'receipt.png');
  const r = await fetch(`${API}/expenses/claims/${claimId}/items`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return r.status;
}

// ─── Run ────────────────────────────────────────────────────

async function healthy() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/health`)).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

(async () => {
  if (!slug) throw new Error('Usage: DEMO_PASSWORD=… node prisma/seed-demo-ui.cjs <company-slug>');
  if (!password) throw new Error('Set DEMO_PASSWORD (the demo accounts’ password) so the script can sign in as them.');
  const company = await prisma.company.findUnique({ where: { slug }, include: { settings: true } });
  if (!company) throw new Error(`No company with slug ${slug}`);
  const tz = company.settings?.timezone || 'Asia/Kolkata';

  console.log(`Demo data for ${company.name}\n1 · database`);
  await seedDatabase(company, tz);

  const main = path.join(ROOT, 'dist', 'apps', 'api', 'src', 'main.js');
  if (!fs.existsSync(main)) throw new Error('No API build — run pnpm --filter @hrms/api build first.');
  const mailDir = path.join(ROOT, '.mail');
  const mailBefore = new Set(fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []);
  const api = spawn(process.execPath, [main], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, API_PORT: PORT, PORT, EMAIL_PROVIDER: 'console', REMINDERS_ENABLED: 'false' } });
  let stderr = '';
  api.stderr.on('data', (d) => (stderr += d));
  try {
    if (!(await healthy())) throw new Error(`The private API didn’t start on :${PORT}\n${stderr.slice(-1500)}`);
    console.log('2 · through the API (console email)');
    await seedThroughApi(company, tz);
  } finally {
    if (api.exitCode === null) api.kill();
    for (const f of fs.existsSync(mailDir) ? fs.readdirSync(mailDir) : []) if (!mailBefore.has(f)) fs.rmSync(path.join(mailDir, f));
  }

  // Pictures for the new people
  await new Promise((resolve) => spawn(process.execPath, [path.join(__dirname, 'seed-demo-avatars.cjs'), slug], { cwd: ROOT, stdio: 'inherit' }).on('exit', resolve));
  console.log('Done.');
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
