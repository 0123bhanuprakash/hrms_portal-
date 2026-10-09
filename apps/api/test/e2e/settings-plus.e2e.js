// Settings round: seasonal themes, branding extras, delegation (pick approvals, away,
// suggestions, timeline, gaps, recap, reminder) and notification topics / quiet hours.
const path = require('path');
const { prisma: p, suite, call, makeCompany, dropCompany, todayIn, addDays } = require('./lib');
const dist = (m) => require(path.resolve('dist/apps/api/src/modules', m));

const SLUG = 'settings-plus-e2e';
const t = suite('settings-plus');
const { check } = t;
const D = (k) => new Date(`${k}T00:00:00Z`);

(async () => {
  await dropCompany(SLUG);
  try {
    const { company, roles, people: P, sessions: S } = await makeCompany(SLUG, [
      ['boss', ['company_admin']],
      ['hema', ['hr', 'employee']],
      ['karan', ['manager', 'employee'], 'boss'],
      ['priya', ['manager', 'employee'], 'boss'],
      ['ravi', ['employee'], 'karan'],
      ['neha', ['employee'], 'karan'],
    ]);
    const today = todayIn();

    // ── Seasonal themes
    let r = await call(S.hema, 'GET', '/seasons/presets');
    check('HR has the new permission (presets load)', r.status === 200, JSON.stringify(r.body).slice(0, 200));
    check('11 national presets with next dates', r.data?.length === 11 && r.data.every((x) => x.startsOn && x.endsOn >= today));
    check('Employee can’t manage seasons', (await call(S.ravi, 'GET', '/seasons')).status === 403);
    check('Nothing on today yet', (await call(S.ravi, 'GET', '/seasons/active')).data === null);

    const diwali = r.data.find((x) => x.key === 'diwali');
    r = await call(S.hema, 'POST', '/seasons', { preset: 'diwali', name: diwali.name, emoji: diwali.emoji, startsOn: diwali.startsOn, endsOn: diwali.endsOn, colors: diwali.colors, decoration: 'diyas', greeting: diwali.greeting });
    check('Add Diwali from the preset', r.status === 201 && r.data?.status === 'upcoming', JSON.stringify(r.body).slice(0, 300));
    r = await call(S.hema, 'POST', '/seasons', { name: 'Clash', emoji: '✨', startsOn: diwali.startsOn, endsOn: diwali.startsOn, colors: diwali.colors, decoration: 'none' });
    check('Overlapping season refused', r.status === 409, JSON.stringify(r.body).slice(0, 200));
    r = await call(S.hema, 'POST', '/seasons', { name: 'Too long', emoji: '✨', startsOn: '2027-06-01', endsOn: '2027-07-15', colors: diwali.colors, decoration: 'none' });
    check('Longer than 31 days refused', r.status === 400);
    r = await call(S.hema, 'POST', '/seasons', { name: 'Bad deco', emoji: '✨', startsOn: '2027-06-01', endsOn: '2027-06-02', colors: diwali.colors, decoration: 'lasers' });
    check('Unknown decoration refused', r.status === 400);

    // A season that is on today
    r = await call(S.boss, 'POST', '/seasons', { name: 'Company birthday', emoji: '🎉', startsOn: today, endsOn: addDays(today, 1), colors: { main: '#E9416A', accent: '#7A2BD9', deep: '#1B1530' }, decoration: 'confetti', greeting: '10 years of us!', everyYear: false });
    const bday = r.data;
    check('Own season added', r.status === 201 && bday?.status === 'live' && bday.daysLeft === 2, JSON.stringify(r.body).slice(0, 300));
    r = await call(S.ravi, 'GET', '/seasons/active');
    check('Everyone sees what is on today', r.data?.name === 'Company birthday' && r.data.colors.main === '#E9416A' && r.data.decoration === 'confetti');
    r = await call({}, 'GET', `/companies/branding/by-slug/${SLUG}`);
    check('Sign-in page gets the season', r.data?.season?.name === 'Company birthday', JSON.stringify(r.data?.season));
    await call(S.boss, 'PATCH', `/seasons/${bday.id}`, { onSignIn: false });
    r = await call({}, 'GET', `/companies/branding/by-slug/${SLUG}`);
    check('…unless switched off for sign-in', r.data?.season === null);
    r = await call(S.boss, 'PATCH', `/seasons/${bday.id}`, { enabled: false });
    check('Switch a season off', r.data?.status === 'off' && (await call(S.ravi, 'GET', '/seasons/active')).data === null);

    // Every-year season in the past rolls to next year
    const old = await p.seasonalTheme.create({ data: { companyId: company.id, name: 'Old one', emoji: '🎈', startsOn: '2024-02-10', endsOn: '2024-02-11', colors: { main: '#111111', accent: '#222222', deep: '#333333' } } });
    r = await call(S.hema, 'GET', '/seasons');
    const rolled = r.data?.seasons.find((s) => s.id === old.id);
    check('Every-year season rolls to its next dates', rolled && rolled.endsOn >= today && rolled.startsOn.endsWith('-02-10'), JSON.stringify(rolled));

    // Holiday list suggests a season
    const holiDay = addDays(today, 20);
    await p.publicHoliday.create({ data: { companyId: company.id, name: 'Holi', date: D(holiDay), year: +holiDay.slice(0, 4) } });
    r = await call(S.hema, 'GET', '/seasons');
    check('Holiday list suggests Holi', r.data?.suggestions.some((s) => s.preset === 'holi' && s.holiday === 'Holi'), JSON.stringify(r.data?.suggestions));
    check('…but not Diwali (already planned)', !r.data?.suggestions.some((s) => s.preset === 'diwali'));
    check('Delete a season', (await call(S.hema, 'DELETE', `/seasons/${old.id}`)).data?.deleted === true);

    // ── Branding extras
    r = await call(S.boss, 'PATCH', `/companies/${company.id}/branding`, { tagline: 'HR workspace', signInMessage: 'Good to see you 👋', signInBackground: 'plain' });
    check('Tagline + sign-in line saved', r.status === 200 && r.data?.tagline === 'HR workspace' && r.data.signInBackground === 'plain', JSON.stringify(r.body).slice(0, 300));
    r = await call({}, 'GET', `/companies/branding/by-slug/${SLUG}`);
    check('Sign-in page reads them', r.data?.branding?.signInMessage === 'Good to see you 👋' && r.data.branding.signInBackground === 'plain' && r.data.branding.tagline === 'HR workspace');
    r = await call(S.boss, 'PATCH', `/companies/${company.id}/branding`, { signInBackground: 'disco' });
    check('Unknown background refused', r.status === 400);
    r = await call(S.boss, 'PATCH', `/companies/${company.id}/branding`, { signInMessage: '' });
    check('Empty line clears it', r.data?.signInMessage === null);

    // ── Delegation: pick which approvals
    r = await call(S.karan, 'POST', '/delegations', { delegateId: P.priya.user.id, endsAt: new Date(Date.now() + 3 * 864e5).toISOString(), permissions: ['expense.approve'] });
    check('Hand over only expense approvals', r.status === 201 && r.data?.permissions.length === 1 && r.data.permissions[0].key === 'expense.approve', JSON.stringify(r.body).slice(0, 300));
    const only = r.data;
    r = await call(S.priya, 'GET', '/access/me');
    const cover = r.data?.delegations?.find((d) => d.fromUserId === P.karan.user.id);
    check('Priya covers only expenses', cover && cover.permissions.length === 1 && cover.permissions[0] === 'expense.approve', JSON.stringify(r.data?.delegations));
    check('Bad approval kind refused', (await call(S.karan, 'POST', '/delegations', { delegateId: P.hema.user.id, endsAt: new Date(Date.now() + 864e5 * 9).toISOString(), permissions: ['salary.view'] })).status === 400);
    await call(S.karan, 'DELETE', `/delegations/${only.id}`);
    r = await call(S.karan, 'GET', '/delegations');
    check('My list shows the chosen kind', r.data?.given.find((g) => g.id === only.id)?.permissions.join() === 'expense.approve');

    // ── Away: Karan's approved leave in 5 days, nobody covers
    const cl = await p.leaveType.create({ data: { companyId: company.id, name: 'Casual', code: 'CL', category: 'CASUAL' } });
    const from = addDays(today, 5), to = addDays(today, 7);
    await p.leaveRequest.create({ data: { companyId: company.id, employeeId: P.karan.id, leaveTypeId: cl.id, startDate: D(from), endDate: D(to), totalDays: 3, reason: 'Trip', status: 'APPROVED' } });
    // Priya is away for one of those days
    await p.leaveRequest.create({ data: { companyId: company.id, employeeId: P.priya.id, leaveTypeId: cl.id, startDate: D(to), endDate: D(to), totalDays: 1, reason: 'Away', status: 'APPROVED' } });
    r = await call(S.karan, 'GET', '/delegations/away');
    check('Away: leave found, not covered', r.data?.length === 1 && r.data[0].from === from && r.data[0].coveredBy === null && r.data[0].inDays === 5, JSON.stringify(r.body).slice(0, 300));
    r = await call(S.karan, 'GET', `/delegations/suggest?from=${from}&to=${to}`);
    check('Suggestions load', r.status === 200 && r.data?.length > 0, JSON.stringify(r.body).slice(0, 300));
    const pri = r.data?.find((x) => x.userId === P.priya.user.id);
    check('Peer is suggested, with reasons + days away', pri?.reasons.includes('Same manager as you') && pri.awayDays === 1 && /Away 1 of 3/.test(pri.available));
    check('Boss (my manager) ranks first', r.data?.[0]?.userId === P.boss.user.id && r.data[0].reasons.includes('Your manager'));
    check('Not myself', !r.data?.some((x) => x.userId === P.karan.user.id));

    r = await call(S.karan, 'GET', `/delegations/timeline?from=${today}&to=${addDays(today, 20)}`);
    const mine = r.data?.rows?.[0];
    check('Timeline: me first with my reports', mine?.isMe && r.data.rows.length === 3, JSON.stringify(r.data?.rows?.map((x) => x.firstName)));
    check('…my leave is a gap (no cover)', mine?.off.length === 1 && mine.gaps.length === 1);
    r = await call(S.hema, 'GET', '/delegations/gaps');
    check('Admins see approvers with no cover', r.data?.rows?.some((g) => g.userId === P.karan.user.id && g.from === from) && r.data.total >= 1, JSON.stringify(r.body).slice(0, 200));
    const allDel = await call(S.hema, 'GET', '/delegations/all?limit=1');
    check('Company hand-overs come a page at a time', allDel.status === 200 && Array.isArray(allDel.data?.rows) && allDel.data.rows.length <= 1 && allDel.data.meta.limit === 1, JSON.stringify(allDel.data?.meta));
    check('Employees can’t see the gaps list', (await call(S.ravi, 'GET', '/delegations/gaps')).status === 403);

    // Reminder 2 days before
    const { NotificationsService } = dist('notifications/notifications.service.js');
    const { RealtimeService } = dist('realtime/realtime.service.js');
    const { CoverService } = dist('delegations/cover.service.js');
    const emails = [];
    const config = { get: (k) => (k === 'webUrl' ? 'http://localhost:3000' : undefined) };
    const notifications = new NotificationsService(p, { queueNotification: async (d) => emails.push(d) }, config, new RealtimeService());
    const coverSvc = new CoverService(p, notifications, config);
    const in3 = new Date(Date.now() + 3 * 864e5); // "now" = 2 days before the leave
    let sent = await coverSvc.remindUncovered(in3, company.id);
    const rem = await p.notification.findMany({ where: { userId: P.karan.user.id, type: 'delegation.reminder' } });
    check('Reminder 2 days before, when nobody covers', sent >= 1 && rem.length === 1, `sent ${sent}`);
    sent = await coverSvc.remindUncovered(in3, company.id);
    check('…only once', (await p.notification.count({ where: { userId: P.karan.user.id, type: 'delegation.reminder' } })) === 1);

    // Cover it → covered + no gap
    r = await call(S.karan, 'POST', '/delegations', { delegateId: P.boss.user.id, startsAt: new Date(`${from}T00:00:00Z`).toISOString(), endsAt: new Date(`${to}T23:59:59Z`).toISOString(), reason: 'Trip' });
    check('Set up the cover', r.status === 201, JSON.stringify(r.body).slice(0, 200));
    r = await call(S.karan, 'GET', '/delegations/away');
    check('Away shows who covers', r.data?.[0]?.coveredBy?.id === P.boss.user.id);
    check('Gap is gone', !(await call(S.hema, 'GET', '/delegations/gaps')).data?.rows.some((g) => g.userId === P.karan.user.id));

    // ── Recap: an ended hand-over where Priya decided Ravi's leave for Karan
    const past = await p.approvalDelegation.create({ data: { companyId: company.id, delegatorId: P.karan.user.id, delegateId: P.priya.user.id, startsAt: new Date(Date.now() - 6 * 864e5), endsAt: new Date(Date.now() - 2 * 864e5), createdById: P.karan.user.id } });
    const lr = await p.leaveRequest.create({ data: { companyId: company.id, employeeId: P.ravi.id, leaveTypeId: cl.id, startDate: D(addDays(today, -4)), endDate: D(addDays(today, -4)), totalDays: 1, reason: 'Doctor', status: 'APPROVED' } });
    await p.leaveApproval.create({ data: { leaveRequestId: lr.id, level: 1, approverId: P.karan.user.id, approverIds: [P.karan.user.id], status: 'APPROVED', actedById: P.priya.user.id, onBehalfOfId: P.karan.user.id, actedAt: new Date(Date.now() - 4 * 864e5) } });
    r = await call(S.karan, 'GET', '/delegations/recap');
    const rc = r.data?.find((x) => x.id === past.id);
    check('Recap: Priya approved 1 for me', rc?.delegate.id === P.priya.user.id && rc.approved === 1 && rc.rejected === 0 && /Leave · ravi/.test(rc.items[0]?.title ?? ''), JSON.stringify(r.body).slice(0, 400));

    // ── Notifications: topics + quiet hours + summary
    r = await call(S.ravi, 'PATCH', '/users/me/preferences', { notificationTopics: { expenses: { app: false }, kudos: { app: false, email: false } }, quietHours: { on: true, from: '00:00', to: '23:59', weekends: true } });
    check('Save topics + quiet hours', r.status === 200 && r.data?.notificationTopics?.expenses?.app === false && r.data.quietHours?.on === true, JSON.stringify(r.body).slice(0, 300));
    r = await call(S.ravi, 'PATCH', '/users/me/preferences', { notificationTopics: { time: { email: false } } });
    check('Topics merge (earlier choices kept)', r.data?.notificationTopics?.expenses?.app === false && r.data.notificationTopics.time.email === false);
    emails.length = 0;
    const uid = P.ravi.user.id;
    await notifications.notify({ companyId: company.id, userIds: [uid], type: 'kudos.received', title: 'Kudos!' });
    check('Topic fully off → nothing created', (await p.notification.count({ where: { userId: uid, type: 'kudos.received' } })) === 0);
    await notifications.notify({ companyId: company.id, userIds: [uid], type: 'expense.approved', title: 'Your claim was approved' });
    await new Promise((res) => setTimeout(res, 300));
    const exp = await p.notification.findFirst({ where: { userId: uid, type: 'expense.approved' } });
    check('In-app off → arrives already read', exp && exp.readAt !== null);
    check('Quiet hours → email held, not sent', exp?.emailHeld === true && emails.length === 0);
    await notifications.notify({ companyId: company.id, userIds: [uid], type: 'leave.approved', title: 'Leave approved' });
    await new Promise((res) => setTimeout(res, 300));
    const lv = await p.notification.findFirst({ where: { userId: uid, type: 'leave.approved' } });
    check('Email off for a topic → not held, not sent', lv && !lv.emailHeld && !lv.emailedAt && lv.readAt === null);
    check('Still quiet → nothing released', (await notifications.releaseHeld(new Date(), company.id)) === 0 && emails.length === 0);
    await p.userPreferences.update({ where: { userId: uid }, data: { quietHours: { on: false, from: '20:00', to: '08:00', weekends: false } } });
    await notifications.notify({ companyId: company.id, userIds: [uid], type: 'profile.reminder', title: 'Complete your profile' });
    await new Promise((res) => setTimeout(res, 300));
    check('Not quiet → sent right away', emails.length === 1 && emails[0].title === 'Complete your profile');
    const released = await notifications.releaseHeld(new Date(), company.id);
    check('Quiet over → held email sent', released === 1 && emails.length === 2 && emails[1].title === 'Your claim was approved');
    check('…and marked sent', (await p.notification.findUnique({ where: { id: exp.id } })).emailHeld === false);

    // Daily summary: held until 09:00, then one email for everything before 09:00
    await p.userPreferences.update({ where: { userId: uid }, data: { dailySummary: true } });
    await notifications.notify({ companyId: company.id, userIds: [uid], type: 'ticket.reply', title: 'New reply A' });
    await notifications.notify({ companyId: company.id, userIds: [uid], type: 'ticket.reply', title: 'New reply B' });
    await new Promise((res) => setTimeout(res, 300));
    check('Daily summary → held', (await p.notification.count({ where: { userId: uid, type: 'ticket.reply', emailHeld: true } })) === 2 && emails.length === 2);
    await p.notification.updateMany({ where: { userId: uid, type: 'ticket.reply' }, data: { createdAt: new Date(Date.now() - 864e5) } });
    const tomorrow9 = new Date(`${addDays(today, 1)}T04:00:00Z`); // 09:30 IST tomorrow
    const early = new Date(`${addDays(today, 1)}T02:00:00Z`); // 07:30 IST
    check('Before 09:00 → waits', (await notifications.releaseHeld(early, company.id)) === 0);
    check('After 09:00 → one summary email', (await notifications.releaseHeld(tomorrow9, company.id)) === 1 && emails.length === 3 && /daily summary — 2 updates/.test(emails[2].title) && /New reply A/.test(emails[2].body));
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
