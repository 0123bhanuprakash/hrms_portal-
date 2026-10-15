/* Announcements, kudos, notifications, report schedules, sign-ins, activity, preferences. */
import { type Ctx, employedOn, fullName, p } from './org';
import { D, addDays, chunked, daysBetween, eachDay, pick, rint, rnd, stamp, weekday } from './util';

const VALUES: Array<[string, string, string, string]> = [
  ['Grow together', '🌱', '#16A34A', 'Helped someone else get better.'],
  ['Own it', '🎯', '#F59E0B', 'Took responsibility and saw it through.'],
  ['Client first', '💙', '#2563EB', 'Went out of their way for a client.'],
  ['Build smart', '💡', '#7C3AED', 'Found a simpler, smarter way.'],
  ['Extra mile', '🚀', '#EC4899', 'Did more than anyone asked.'],
];

export async function seedEngagement(ctx: Ctx) {
  const { prisma, companyId, today, start } = ctx;
  const u = (k: string) => p(ctx, k).userId;
  const people = [...ctx.people.values()];

  // ── Announcements ──
  type A = { by: string; day: string; h: number; title: string; body: string; category: string; pinned?: boolean; ack?: boolean; ackDue?: string; audience?: 'COMPANY' | 'DEPARTMENTS' | 'LOCATIONS' | 'TEAM'; depts?: string[]; locs?: string[]; team?: string; event?: [string, number, string]; cover?: string; emoji?: string; scene?: string; status?: string; expires?: string };
  const posts: A[] = [
    { by: 'hrm', day: '2025-10-06', h: 10, title: 'Welcome to the SeedsAI people portal', body: 'Leave, attendance, timesheets, payslips and your profile all live here from today.\n\nPlease add your emergency contact and check your bank details by 31 October.', category: 'update', ack: true, ackDue: '2025-10-31', cover: 'indigo', emoji: '🌱' },
    { by: 'hrm', day: '2025-10-13', h: 11, title: 'Diwali celebrations — 17 October', body: 'Rangoli competition at 3 pm, lamp lighting and sweets at 5 pm in every office. Ethnic wear encouraged!\n\nThe office is closed on 20 October for Diwali.', category: 'celebrate', event: ['2025-10-17', 15 * 60, 'Cafeteria, all offices'], cover: 'sunset', emoji: '🪔', scene: 'diyas' },
    { by: 'ith', day: '2025-11-07', h: 17, title: 'Planned outage: email migration Saturday night', body: 'Email will be unavailable from 11 pm Saturday to 3 am Sunday while we move to the new tenant. Nothing to do on your side.', category: 'urgent', cover: 'slate', emoji: '🛠️', expires: '2025-11-10' },
    { by: 'hr1', day: '2025-11-20', h: 12, title: 'Health insurance renewal — add parents by 5 Dec', body: 'Our group policy renews on 1 January. You can add parents (top-up, paid by you) until 5 December from the Medi Assist link in your email.', category: 'policy', cover: 'teal', emoji: '🩺' },
    { by: 'ceo', day: '2025-12-12', h: 16, title: 'Year-end town hall', body: 'Join me and Meera for our year-end town hall: how 2025 went, our three bets for 2026, and an open Q&A.', category: 'event', event: ['2025-12-19', 16 * 60, 'Hyderabad HQ, Level 9 + Teams'], cover: 'indigo', emoji: '🎤' },
    { by: 'hrm', day: '2025-12-22', h: 10, title: 'Christmas & New Year party 🎄', body: 'Secret Santa reveal, carols and dinner on 23 December. Plus-ones welcome for the dinner.', category: 'celebrate', event: ['2025-12-23', 18 * 60, 'The Park, Hyderabad'], cover: 'rose', emoji: '🎄', scene: 'snow' },
    { by: 'hrm', day: '2026-01-08', h: 11, title: 'Updated POSH policy — please read and confirm', body: 'We have updated our Prevention of Sexual Harassment policy and the Internal Committee members for 2026. Please read and confirm by 31 January.', category: 'policy', pinned: true, ack: true, ackDue: '2026-01-31', cover: 'slate', emoji: '📘' },
    { by: 'fih', day: '2026-01-12', h: 15, title: 'Investment proofs due by 31 January', body: 'Upload rent receipts, 80C and 80D proofs by 31 January. Without proofs, TDS for Feb–Mar will be worked out without the exemptions.', category: 'policy', cover: 'teal', emoji: '🧾', ack: false },
    { by: 'hrm', day: '2026-03-02', h: 10, title: 'Holi celebrations on 3 March', body: 'Organic colours, thandai and music on the terrace from 4 pm. Bring a change of clothes!', category: 'celebrate', event: ['2026-03-03', 16 * 60, 'Terrace, all offices'], cover: 'sunset', emoji: '🎨', scene: 'confetti' },
    { by: 'hrm', day: '2026-03-16', h: 11, title: 'Appraisal cycle 2026 — timelines', body: 'Self-reviews open on 16 March and close on 27 March. Manager reviews by 3 April. Revised salaries apply from 1 April.', category: 'update', cover: 'indigo', emoji: '📈' },
    { by: 'dvh', day: '2026-04-06', h: 12, title: 'New CI runners are live', body: 'Builds should be ~40% faster. If your pipeline fails on the new runners, raise a DevOps ticket under “Repo & CI/CD access”.', category: 'update', audience: 'DEPARTMENTS', depts: ['DEL', 'DEVOPS'], cover: 'sky', emoji: '🚀' },
    { by: 'ceo', day: '2026-05-04', h: 10, title: 'Helix is live in all 340 Northstar stores', body: 'Huge congratulations to Rahul, Varun, Priya, Naveen and the whole Helix team. Northstar’s CEO called it “the smoothest rollout we have had”.', category: 'celebrate', cover: 'sunset', emoji: '🏆', scene: 'fireworks' },
    { by: 'hr2', day: '2026-05-25', h: 11, title: 'Bengaluru office: new floor from 1 June', body: 'We are moving to the 4th floor (B wing) over the weekend of 30–31 May. Desk numbers are in the floor plan attached to your email.', category: 'update', audience: 'LOCATIONS', locs: ['BLR'], cover: 'teal', emoji: '🏢' },
    { by: 'hrm', day: '2026-06-01', h: 10, title: 'Welcome, summer interns!', body: 'A warm welcome to our 2026 interns joining across Delivery, IT, DevOps, Finance, UI/UX and Cyber Security this month. Say hi when you see them!', category: 'celebrate', cover: 'rose', emoji: '👋', scene: 'balloons' },
    { by: 'sch', day: '2026-06-22', h: 12, title: 'Phishing drill results — and what to look for', body: '14% of us clicked last week’s test phishing email (down from 22%). Always check the sender domain and never approve MFA prompts you didn’t start.', category: 'update', ack: true, ackDue: '2026-07-06', cover: 'slate', emoji: '🛡️' },
    { by: 'pmo', day: '2026-07-01', h: 11, title: 'Atlas is complete — thank you!', body: 'Atlas went live for Swiftline across 18 cities. Madhuri’s team moves to Ledger; Sudhir joins the PMO pool for his next project.', category: 'celebrate', audience: 'DEPARTMENTS', depts: ['DEL', 'PMO'], cover: 'sky', emoji: '🎉' },
    { by: 'pm1', day: '2026-08-18', h: 10, title: 'Helix: festive-season freeze from 20 Oct', body: 'No production releases to Northstar from 20 October to 5 November. Plan your PRs accordingly.', category: 'update', audience: 'TEAM', team: 'pm1', cover: 'indigo', emoji: '🧊' },
    { by: 'ith', day: '2026-09-15', h: 10, title: 'Yearly asset check is open', body: 'Please confirm the laptop, monitor and other items with you under My assets → Yearly check. It takes a minute.', category: 'update', ack: false, cover: 'teal', emoji: '💻' },
    { by: 'hrm', day: '2026-09-28', h: 10, title: 'Annual Day 2026 — save the date', body: 'Annual Day is on 14 November at the HICC, Hyderabad. Teams from Bengaluru and Pune travel on the 13th; travel desk will reach out.', category: 'event', event: ['2026-11-14', 17 * 60, 'HICC, Hyderabad'], cover: 'sunset', emoji: '🎊', scene: 'confetti' },
    { by: 'hrm', day: addDays(today, -3), h: 10, title: 'Diwali 2026 — celebrations on 6 November', body: 'Rangoli, diyas and a sweets counter in every office from 3 pm. Office closed on 9 November.\n\nMany of you are taking leave in the Diwali week — please apply by 20 October so leads can plan.', category: 'celebrate', event: ['2026-11-06', 15 * 60, 'All offices'], cover: 'sunset', emoji: '🪔', scene: 'diyas', pinned: false },
    { by: 'coo', day: addDays(today, -1), h: 17, title: 'Q3 business update', body: 'Revenue grew 18% over Q2. We signed Lexora Legal (Quill starts 2 November) and Sprout’s beta waitlist crossed 40 companies. Thank you all.', category: 'update', cover: 'indigo', emoji: '📊' },
    { by: 'hrm', day: addDays(today, 6), h: 9, title: 'Open enrolment: health insurance 2027', body: 'Add or remove dependants for 2027 between 15 and 30 October.', category: 'policy', status: 'scheduled', cover: 'teal', emoji: '🩺' },
    { by: 'hr1', day: today, h: 11, title: 'Draft — Hybrid work guidelines (v2)', body: 'Proposed: three office days a week for teams with client overlap, two for others. Comments welcome before we publish.', category: 'policy', status: 'draft', cover: 'slate', emoji: '🏠' },
  ];
  const audienceOf = (a: A) => people.filter((r) => {
    const d = a.day;
    if (!employedOn(r, d) && !(r.join <= today && a.day <= r.join)) return false;
    if (a.audience === 'DEPARTMENTS') return a.depts!.includes(r.dept);
    if (a.audience === 'LOCATIONS') return a.locs!.includes(r.loc);
    if (a.audience === 'TEAM') { let m = r.mgr; while (m) { if (m === a.team) return true; m = p(ctx, m).mgr; } return false; }
    return true;
  });
  const reads: object[] = [];
  const reactions: object[] = [];
  const rsvps: object[] = [];
  for (const [i, a] of posts.entries()) {
    const publishedAt = stamp(a.day, a.h, rint(a.title, 0, 50));
    const live = (a.status ?? 'published') === 'published';
    const ann = await prisma.announcement.create({
      data: {
        companyId, authorId: u(a.by), title: a.title, body: a.body, audience: a.audience ?? 'COMPANY', departmentIds: (a.depts ?? []).map((d) => ctx.dept[d]!), locationIds: (a.locs ?? []).map((l) => ctx.loc[l]!),
        teamManagerId: a.team ? p(ctx, a.team).id : null, pinned: Boolean(a.pinned), requiresAck: Boolean(a.ack), ackDueAt: a.ackDue ? D(a.ackDue) : null, sendEmail: i % 3 === 0,
        expiresAt: a.expires ? stamp(a.expires, 23) : null, publishedAt, category: a.category, cover: a.cover, coverEmoji: a.emoji, coverScene: a.scene ?? null, status: a.status ?? 'published',
        notifiedAt: live ? publishedAt : null, eventAt: a.event ? stamp(a.event[0], Math.floor(a.event[1] / 60), a.event[1] % 60) : null, eventPlace: a.event?.[2] ?? null,
      },
    });
    if (!live) continue;
    const ageDays = daysBetween(a.day, today);
    for (const r of audienceOf(a)) {
      const s = r.key + i;
      const readP = ageDays > 10 ? 0.93 : ageDays > 2 ? 0.7 : 0.35;
      if (rnd(s + 'r') > readP) continue;
      const readAt = new Date(publishedAt.getTime() + rnd(s + 't') * Math.min(ageDays + 0.5, 6) * 86_400_000);
      if (readAt.getTime() > Date.now()) continue;
      reads.push({ announcementId: ann.id, userId: r.userId, readAt, acknowledgedAt: a.ack && rnd(s + 'a') < 0.88 ? new Date(readAt.getTime() + 60_000) : null });
      if (rnd(s + 'x') < (a.category === 'celebrate' ? 0.45 : 0.12)) reactions.push({ announcementId: ann.id, userId: r.userId, emoji: pick(s + 'e', a.category === 'celebrate' ? ['🎉', '❤️', '🔥', '👏', '🪔'] : ['👍', '👀', '🙏', '✅']), createdAt: readAt });
      if (a.event && rnd(s + 'v') < 0.75) rsvps.push({ announcementId: ann.id, userId: r.userId, response: pick(s + 'rv', ['going', 'going', 'going', 'maybe', 'no']) });
    }
  }
  await chunked(reads, 2000, (x) => prisma.announcementRead.createMany({ data: x as never, skipDuplicates: true }));
  await chunked(reactions, 2000, (x) => prisma.announcementReaction.createMany({ data: x as never, skipDuplicates: true }));
  await chunked(rsvps, 2000, (x) => prisma.announcementRsvp.createMany({ data: x as never, skipDuplicates: true }));
  ctx.count.announcements = posts.length;

  // ── Kudos ──
  await prisma.kudosValue.createMany({ data: VALUES.map(([name, emoji, color, description], i) => ({ companyId, name, emoji, color, description, sortOrder: (i + 1) * 10 })) });
  const value = Object.fromEntries((await prisma.kudosValue.findMany({ where: { companyId } })).map((v) => [v.name, v.id]));
  const MSG: Record<string, string[]> = {
    'Grow together': ['Thanks for patiently walking me through the Kafka setup — saved me a week.', 'Your pairing sessions made onboarding so much easier.', 'Loved how you reviewed my first PR — kind and thorough.', 'Thank you for mentoring the interns every Friday.'],
    'Own it': ['Picked up the production incident at midnight and stayed till it was fixed.', 'Took the UAT feedback list and closed every single item before the deadline.', 'Owned the release checklist end to end — zero rollbacks.', 'Drove the RBI audit fixes without anyone having to chase.'],
    'Client first': ['Stayed back to demo the dashboards to Northstar’s regional heads. They loved it.', 'Turned around the bank’s security questionnaire in a day.', 'Calm and clear on a tough client call — we kept the account because of you.'],
    'Build smart': ['Your caching change cut the planner load time from 6s to 900ms!', 'The test-data generator you built saves the QA team hours every sprint.', 'Brilliant idea to reuse the Nimbus metrics layer for Ledger reports.', 'Automated the onboarding checklist — HR loves it.'],
    'Extra mile': ['Came in on a Saturday to help with the go-live. Thank you!', 'Organised the whole Holi celebration on top of a release week.', 'Covered for me during my leave and kept everything moving.', 'Fixed the VPN issue for the whole Pune office before the client call.'],
  };
  const kudosRows: Array<{ from: string; to: string[]; val: string; msg: string; at: Date }> = [];
  const colleagues = (k: string) => {
    const r = p(ctx, k);
    const mine = ctx.members!.filter((m) => m.key === k).map((m) => m.code);
    return people.filter((x) => x.key !== k && (x.mgr === k || r.mgr === x.key || x.mgr === r.mgr || ctx.members!.some((m) => m.key === x.key && mine.includes(m.code))));
  };
  const span = daysBetween(start, today);
  for (let i = 0; i < 190; i++) {
    const s = 'kd' + i;
    let day = addDays(start, rint(s + 'd', 0, span));
    while (weekday(day) === 0 || weekday(day) === 6) day = addDays(day, 1);
    if (day > today) day = today;
    const from = pick(s + 'f', people.filter((x) => employedOn(x, day)));
    const pool = colleagues(from.key).filter((x) => employedOn(x, day));
    if (!pool.length) continue;
    const n = rnd(s + 'n') < 0.8 ? 1 : rint(s + 'nn', 2, 3);
    const to = [...new Set(Array.from({ length: n }, (_, j) => pick(s + 't' + j, pool).key))];
    const val = pick(s + 'v', Object.keys(MSG));
    kudosRows.push({ from: from.key, to, val, msg: pick(s + 'm', MSG[val]!), at: stamp(day, 10 + rint(s + 'h', 0, 8), rint(s + 'mm', 0, 59)) });
  }
  // A few hand-written ones tied to real events
  kudosRows.push({ from: 'pm1', to: ['l1', 'l2', 'l3'], val: 'Own it', msg: 'Helix in all 340 stores, on time and calm. Proud of this team.', at: stamp('2026-05-04', 12) });
  kudosRows.push({ from: 'dd2', to: ['l9', 'e34', 'e36'], val: 'Extra mile', msg: 'Atlas hypercare done and straight into Ledger without missing a beat. Thank you!', at: stamp('2026-07-08', 11) });
  kudosRows.push({ from: 'pm2', to: ['l5', 'e19', 'e20'], val: 'Client first', msg: 'RBI audit closed with zero open findings. Kaveri Bank’s CISO sent a thank-you note.', at: stamp('2026-08-31', 16) });
  for (const k of kudosRows) {
    const ageDays = (Date.now() - k.at.getTime()) / 86_400_000;
    const kd = await prisma.kudos.create({ data: { companyId, fromUserId: u(k.from), valueId: value[k.val], message: k.msg, createdAt: k.at, recipients: { create: k.to.map((t) => ({ employeeId: p(ctx, t).id })) } } });
    const fans = people.filter((x) => employedOn(x, k.at.toISOString().slice(0, 10)) && rnd(kd.id + x.key) < (ageDays > 2 ? 0.08 : 0.03));
    if (fans.length) await prisma.kudosReaction.createMany({ data: fans.map((x) => ({ kudosId: kd.id, userId: x.userId, emoji: pick(kd.id + x.key + 'e', ['👏', '🎉', '❤️', '🙌', '🔥']), createdAt: new Date(k.at.getTime() + 3_600_000) })), skipDuplicates: true });
    const thanks = fans.filter((x) => rnd(x.key + kd.id + 't') < 0.3 && !k.to.includes(x.key) && x.key !== k.from);
    if (thanks.length) await prisma.kudosThanks.createMany({ data: thanks.map((x) => ({ kudosId: kd.id, userId: x.userId, createdAt: new Date(k.at.getTime() + 7_200_000) })), skipDuplicates: true });
  }
  ctx.count.kudos = kudosRows.length;
}

export async function seedPlatform(ctx: Ctx) {
  const { prisma, companyId, today, start } = ctx;
  const u = (k: string) => p(ctx, k).userId;
  const people = [...ctx.people.values()];

  // Notifications: recent, so every inbox has a mix of read / unread
  const notes: object[] = [];
  const add = (k: string, type: string, title: string, body: string | null, link: string | null, at: Date, read: boolean) => notes.push({ companyId, userId: u(k), type, title, body, link, createdAt: at, readAt: read ? new Date(at.getTime() + 2 * 3_600_000) : null });
  const pending = await prisma.leaveRequest.findMany({ where: { companyId, status: 'PENDING' }, select: { id: true, employeeId: true, startDate: true, totalDays: true, createdAt: true, approvals: { select: { approverIds: true } }, leaveType: { select: { name: true } } } });
  const byEmp = new Map(people.map((r) => [r.id, r]));
  const byUser = new Map(people.map((r) => [r.userId, r]));
  for (const l of pending) {
    const r = byEmp.get(l.employeeId)!;
    for (const a of l.approvals[0]?.approverIds ?? []) {
      const ap = byUser.get(a);
      if (ap) add(ap.key, 'leave.submitted', `${fullName(r)} asked for ${l.leaveType.name.toLowerCase()}`, `${l.totalDays} day${l.totalDays === 1 ? '' : 's'} from ${l.startDate.toISOString().slice(0, 10)}`, '/app/leave/approvals', l.createdAt, false);
    }
  }
  const decided = await prisma.leaveRequest.findMany({ where: { companyId, status: { in: ['APPROVED', 'REJECTED'] }, decidedAt: { gte: stamp(addDays(today, -14), 0) } }, select: { employeeId: true, status: true, decidedAt: true, startDate: true, leaveType: { select: { name: true } } } });
  for (const l of decided) {
    const r = byEmp.get(l.employeeId)!;
    add(r.key, l.status === 'APPROVED' ? 'leave.approved' : 'leave.rejected', `Your ${l.leaveType.name.toLowerCase()} was ${l.status === 'APPROVED' ? 'approved' : 'rejected'}`, `From ${l.startDate.toISOString().slice(0, 10)}`, '/app/leave', l.decidedAt!, rnd(r.key + l.decidedAt!.toISOString()) < 0.6);
  }
  const regs = await prisma.attendanceRegularisation.findMany({ where: { companyId, status: 'PENDING' }, select: { employeeId: true, approverIds: true, createdAt: true, date: true } });
  for (const g of regs) for (const a of g.approverIds) { const ap = byUser.get(a); if (ap) add(ap.key, 'attendance.correction', `${fullName(byEmp.get(g.employeeId)!)} asked for an attendance correction`, `For ${g.date.toISOString().slice(0, 10)}`, '/app/attendance/approvals', g.createdAt, false); }
  const reqs = await prisma.resourceRequest.findMany({ where: { companyId, status: { in: ['OPEN', 'ON_HOLD'] } }, select: { id: true, title: true, kind: true, step: true, createdAt: true, raisedByUserId: true } });
  for (const r of reqs) {
    const to = r.step === 'PMO' ? ['pmo', 'pmo1', 'pmo2'] : [];
    for (const k of to) add(k, 'resource.request', `${r.title ?? 'A release'} is waiting for the PMO`, null, `/app/resources/${r.id}`, r.createdAt, false);
  }
  // Birthdays / anniversaries / kudos / timesheet reminders
  for (const r of people.filter((x) => x.status !== 'TERMINATED')) {
    if (['e16', 'e47', 'e33'].includes(r.key)) add(r.key, 'timesheet.reminder', 'You have days that aren’t sent for approval', 'Send your time for the last two weeks', '/app/timesheets', stamp(addDays(today, -1), 17), false);
    if (rnd(r.key + 'gen') < 0.5) add(r.key, 'announcement.published', 'Q3 business update', 'From Meera Krishnan', '/app/announcements', stamp(addDays(today, -1), 17, 5), rnd(r.key + 'q3') < 0.4);
  }
  await chunked(notes, 2000, (x) => prisma.notification.createMany({ data: x as never }));
  ctx.count.notifications = notes.length;

  // Report schedules
  const next = (days: number, h: number) => stamp(addDays(today, days), h);
  await prisma.reportSchedule.createMany({
    data: [
      { companyId, ownerId: u('ceo'), report: 'overview', frequency: 'WEEKLY', dayOfWeek: 1, hour: 8, recipientIds: [u('ceo'), u('coo')], attachCsv: false, nextRunAt: next(((8 - new Date(today).getUTCDay()) % 7) || 7, 8), lastSentAt: stamp(addDays(today, -((new Date(today).getUTCDay() + 6) % 7)), 8) },
      { companyId, ownerId: u('hrm'), report: 'people', frequency: 'MONTHLY', dayOfMonth: 1, hour: 9, recipientIds: [u('hrm'), u('hr1'), u('hr2')], attachCsv: true, nextRunAt: stamp('2026-11-01', 9), lastSentAt: stamp('2026-10-01', 9) },
      { companyId, ownerId: u('pmo'), report: 'utilisation', frequency: 'WEEKLY', dayOfWeek: 5, hour: 18, recipientIds: [u('pmo'), u('dd1'), u('dd2'), u('dd3')], attachCsv: true, nextRunAt: next(2, 18), lastSentAt: stamp(addDays(today, -5), 18) },
      { companyId, ownerId: u('hrm'), report: 'attendance', frequency: 'DAILY', hour: 10, recipientIds: [u('hrm')], attachCsv: false, active: false, nextRunAt: next(1, 10), filters: { locationId: ctx.loc.PUN } },
    ] as never,
  });

  // Seasonal look for Diwali
  await prisma.seasonalTheme.create({ data: { companyId, preset: 'diwali', name: 'Diwali', emoji: '🪔', startsOn: '2026-11-05', endsOn: '2026-11-11', everyYear: true, colors: { main: '#F59E0B', accent: '#DC2626', deep: '#7C2D12' }, decoration: 'diyas', greeting: 'Happy Diwali from all of us at SeedsAI!', createdById: u('admin') } });

  // Sign-ins and active days (last 90 days)
  const activity: object[] = [];
  const attempts: object[] = [];
  const from = addDays(today, -89) < start ? start : addDays(today, -89);
  for (const r of people) {
    for (const d of eachDay(from, today)) {
      if (!employedOn(r, d)) continue;
      const worked = ctx.worked!.has(`${r.key}|${d}`);
      const weekend = weekday(d) === 0 || weekday(d) === 6;
      if (!(worked || (!weekend && rnd(r.key + d + 'act') < 0.15) || (weekend && rnd(r.key + d + 'we') < 0.05))) continue;
      activity.push({ userId: r.userId, companyId, day: D(d) });
      if (d >= addDays(today, -29)) {
        const ua = pick(r.key + 'ua', ['Chrome 129 on Windows', 'Chrome 129 on macOS', 'Edge 129 on Windows', 'Safari 18 on iPhone', 'Chrome on Android']);
        if (rnd(r.key + d + 'fail') < 0.03) attempts.push({ at: stamp(d, 9, 1), success: false, userId: r.userId, companyId, ipAddress: '103.21.58.12', userAgent: ua });
        attempts.push({ at: stamp(d, 9, rint(r.key + d, 2, 59)), success: true, userId: r.userId, companyId, ipAddress: '103.21.58.12', userAgent: ua });
      }
    }
  }
  // Someone hammering a wrong password (locked once)
  for (let i = 0; i < 6; i++) attempts.push({ at: stamp(addDays(today, -4), 22, 10 + i), success: false, userId: u('e48'), companyId, ipAddress: '49.37.212.18', userAgent: 'Chrome on Android' });
  await chunked(activity, 5000, (x) => prisma.userActivityDay.createMany({ data: x as never, skipDuplicates: true }));
  await chunked(attempts, 5000, (x) => prisma.signInAttempt.createMany({ data: x as never }));

  // Personal preferences: some people pick their own look
  const prefs: object[] = [];
  for (const r of people) {
    const s = r.key + 'pref';
    if (rnd(s) < 0.45) continue;
    prefs.push({ userId: r.userId, theme: pick(s + 't', ['system', 'system', 'light', 'dark']), menuStyle: rnd(s + 'm') < 0.3 ? pick(s + 'ms', ['glide', 'peek', 'collapsible']) : null, density: pick(s + 'd', ['theme', 'theme', 'compact', 'spacious']), dailySummary: rnd(s + 'ds') < 0.15, emailNotifications: rnd(s + 'en') < 0.8 });
  }
  // skipDuplicates: someone may sign in (and get default preferences) while the seed is still running
  await prisma.userPreferences.createMany({ data: prefs as never, skipDuplicates: true });

  // Audit trail (key actions)
  const audit: object[] = [];
  const A = (k: string | null, action: string, resourceType: string, resourceId: string | null, at: Date, after: object | null = null) => audit.push({ companyId, userId: k ? u(k) : null, action, resourceType, resourceId, afterState: after, ipAddress: '103.21.58.12', userAgent: 'Chrome 129 on Windows', createdAt: at });
  A('admin', 'company.updated', 'company', companyId, stamp('2025-09-16', 11), { displayName: 'SeedsAI' });
  A('admin', 'branding.logo.uploaded', 'branding', companyId, stamp('2025-09-16', 11, 20));
  A('admin', 'settings.updated', 'settings', companyId, stamp('2025-09-16', 12), { employeeIdPrefix: 'SAI' });
  for (const r of people) {
    if (r.join >= start) A('hr1', 'employee.created', 'employee', r.id, stamp(addDays(r.join, -3), 15), { employeeId: r.empNo, name: fullName(r) });
    if (r.status === 'TERMINATED') A('hrm', 'employee.terminated', 'employee', r.id, stamp(r.lastDay!, 18));
    if (r.ctcBefore) A('hr5', 'employee.salary.updated', 'employee', r.id, stamp('2026-03-27', 16, 40), { effectiveFrom: '2026-04-01' });
  }
  const runs = await prisma.payrollRun.findMany({ where: { companyId }, select: { id: true, processedAt: true } });
  for (const run of runs) { A('hr5', 'payroll.run.created', 'payroll_run', run.id, new Date(run.processedAt!.getTime() - 3 * 86_400_000)); A('hr5', 'payroll.run.completed', 'payroll_run', run.id, run.processedAt!); A('hr5', 'payroll.payslip.published', 'payroll_run', run.id, new Date(run.processedAt!.getTime() + 86_400_000)); }
  A('admin', 'role.created', 'role', ctx.roles.pmo_lead!, stamp('2025-09-16', 12, 30), { name: 'PMO lead' });
  await chunked(audit, 2000, (x) => prisma.auditLog.createMany({ data: x as never }));

  // One finished bulk import (history)
  await prisma.importJob.create({ data: { companyId, entityType: 'EMPLOYEE', status: 'COMPLETED', fileName: 'seedsai-employees-sep-2025.xlsx', totalRows: 108, validRows: 106, invalidRows: 2, processedRows: 106, errorSummary: { rows: [{ row: 41, error: 'Duplicate email' }, { row: 87, error: 'Joining date missing' }] }, initiatedBy: u('admin'), confirmedAt: stamp('2025-09-16', 14, 5), completedAt: stamp('2025-09-16', 14, 7), createdAt: stamp('2025-09-16', 13, 50) } });
}
