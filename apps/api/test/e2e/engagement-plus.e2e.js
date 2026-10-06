// Announcements & kudos, part 2: who may post where (HR, IT Admin, managers'
// own teams), one pinned post, drafts and scheduling, confirm-by reminders,
// nudges, reactions, RSVP, overview; kudos "add my thanks", filters, most
// thanked, suggestions, HR insights and manager hints.
const path = require('path');
const { prisma: p, suite, call, upload, makeCompany, dropCompany, todayIn, addDays } = require('./lib');
const dist = (m) => require(path.resolve('dist/apps/api/src/modules', m));
const { AnnouncementsService } = dist('engagement/announcements.service.js');
const { NotificationsService } = dist('notifications/notifications.service.js');

const SLUG = 'engage-plus-e2e';
const t = suite('engagement-plus');
const { check } = t;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (body) => ({ title: 'Team update', body: 'Hello **team**', audience: 'COMPANY', ...body });

(async () => {
  await dropCompany(SLUG);
  try {
    const today = todayIn();
    const { company, people: P, sessions: S } = await makeCompany(SLUG, [
      ['hr', ['employee', 'hr']],
      ['it', ['employee', 'it_admin']],
      ['mgr', ['employee', 'manager']],
      ['ana', ['employee'], 'mgr'],
      ['ben', ['employee'], 'mgr'],
      ['lead', ['employee', 'team_lead'], 'mgr'],
      ['cara', ['employee'], 'lead'],
      ['eva', ['employee']],
    ]);
    const cid = company.id;
    const notes = (who, type) => p.notification.count({ where: { userId: P[who].user.id, type } });

    // ── Who may post where ──
    let r = await call(S.eva, 'POST', '/announcements', post({}));
    check('Employee can’t post', r.status === 403);
    r = await call(S.mgr, 'POST', '/announcements', post({}));
    check('Manager can’t post to everyone', r.status === 403);
    r = await call(S.mgr, 'POST', '/announcements/audience', { audience: 'TEAM' });
    check('Manager: team preview counts everyone below them', r.status === 200 && r.data.count === 4, JSON.stringify(r.body));
    r = await call(S.mgr, 'POST', '/announcements', post({ audience: 'TEAM', title: 'Sprint demo Friday', requiresAck: true, ackDueAt: addDays(today, 5) }));
    check('Manager posts to their team', r.status === 201 && r.data.audience === 'TEAM' && r.data.canEdit === true, JSON.stringify(r.body).slice(0, 200));
    const teamPost = r.data;
    await wait(400);
    check('Whole reporting line told (incl. the lead’s report)', (await notes('ana', 'announcement.posted')) === 1 && (await notes('cara', 'announcement.posted')) === 1 && (await notes('eva', 'announcement.posted')) === 0);
    check('Outside the team: not visible', (await call(S.eva, 'GET', `/announcements/${teamPost.id}`)).status === 404);
    check('Inside the team: visible', (await call(S.cara, 'GET', `/announcements/${teamPost.id}`)).status === 200);
    r = await call(S.lead, 'POST', '/announcements', post({ audience: 'TEAM', title: 'Lead note' }));
    check('Team lead posts to their own team', r.status === 201);
    check('…only their reports see it', (await call(S.ana, 'GET', `/announcements/${r.data.id}`)).status === 404 && (await call(S.cara, 'GET', `/announcements/${r.data.id}`)).status === 200);
    r = await call(S.ana, 'POST', '/announcements/audience', { audience: 'TEAM' });
    check('Employee can’t preview audiences', r.status === 403);

    r = await call(S.it, 'POST', '/announcements', post({ title: 'VPN maintenance tonight', category: 'urgent', pinned: true }));
    check('IT Admin posts to everyone', r.status === 201 && r.data.audience === 'COMPANY');
    check('…but can’t pin', r.data.pinned === false);
    const itPost = r.data;
    r = await call(S.hr, 'POST', '/announcements', post({ title: 'Leave policy 2027', category: 'policy', pinned: true, requiresAck: true, ackDueAt: addDays(today, 1), sendEmail: false }));
    check('HR posts and pins', r.status === 201 && r.data.pinned === true && r.data.canPin === true);
    const policy = r.data;
    check('IT Admin can’t edit HR’s post', (await call(S.it, 'PATCH', `/announcements/${policy.id}`, post({ title: 'Changed' }))).status === 403);
    check('IT Admin edits their own', (await call(S.it, 'PATCH', `/announcements/${itPost.id}`, post({ title: 'VPN maintenance tonight 11 pm', category: 'urgent' }))).status === 200);
    check('HR edits anyone’s post', (await call(S.hr, 'PATCH', `/announcements/${itPost.id}`, post({ title: 'VPN maintenance tonight 11 pm', category: 'urgent' }))).status === 200);
    check('Pin: IT Admin → 403', (await call(S.it, 'PUT', `/announcements/${itPost.id}/pin`, { pinned: true })).status === 403);
    r = await call(S.hr, 'PUT', `/announcements/${itPost.id}/pin`, { pinned: true });
    const pins = await p.announcement.findMany({ where: { companyId: cid, pinned: true }, select: { id: true } });
    check('One pinned post at a time', r.status === 200 && pins.length === 1 && pins[0].id === itPost.id, JSON.stringify(pins));

    // ── Drafts and scheduling ──
    r = await call(S.hr, 'POST', '/announcements', post({ title: 'Draft: holiday list', action: 'draft' }));
    check('Save a draft (nobody told)', r.status === 201 && r.data.status === 'draft');
    const draft = r.data;
    await wait(300);
    check('Draft: no notification, not in the feed', (await p.notification.count({ where: { link: `/app/announcements/${draft.id}` } })) === 0 && !(await call(S.eva, 'GET', '/announcements')).data?.some((a) => a.id === draft.id));
    check('Draft: others get 404', (await call(S.eva, 'GET', `/announcements/${draft.id}`)).status === 404);
    r = await call(S.hr, 'GET', '/announcements?view=drafts');
    check('Drafts tab', r.data?.length === 1 && r.body.meta.drafts === 1);
    check('Employees have no drafts tab', (await call(S.eva, 'GET', '/announcements?view=drafts')).status === 403);
    r = await call(S.hr, 'PATCH', `/announcements/${draft.id}`, post({ title: 'Holiday list 2027', action: 'publish' }));
    await wait(400);
    check('Publish a draft → everyone told', r.data?.status === 'published' && (await p.notification.count({ where: { link: `/app/announcements/${draft.id}` } })) >= 7);
    check('Can’t move a published post back to draft', (await call(S.hr, 'PATCH', `/announcements/${draft.id}`, post({ title: 'x x x', action: 'draft' }))).status === 400);
    check('Schedule in the past → 400', (await call(S.hr, 'POST', '/announcements', post({ action: 'schedule', publishAt: new Date(Date.now() - 60_000).toISOString() }))).status === 400);
    r = await call(S.hr, 'POST', '/announcements', post({ title: 'Diwali party', category: 'event', action: 'schedule', publishAt: new Date(Date.now() + 3600_000).toISOString(), eventAt: new Date(Date.now() + 3 * 86400_000).toISOString(), eventPlace: 'Cafeteria' }));
    check('Schedule for later', r.status === 201 && r.data.status === 'scheduled');
    const party = r.data;
    check('Scheduled: hidden from the feed', !(await call(S.eva, 'GET', '/announcements')).data?.some((a) => a.id === party.id));

    // The minute job: publish due posts, send confirm-by reminders
    const job = new AnnouncementsService(p, new NotificationsService(p, { queueNotification: async () => undefined }, { get: () => undefined }, new (require(require('path').resolve('dist/apps/api/src/modules/realtime/realtime.service.js')).RealtimeService)()), null);
    await p.announcement.update({ where: { id: party.id }, data: { publishedAt: new Date(Date.now() - 1000) } });
    await call(S.ana, 'POST', `/announcements/${policy.id}/acknowledge`);
    let res = await job.runDue();
    await wait(400);
    check('Due post published and announced', res.published === 1 && (await call(S.eva, 'GET', '/announcements')).data?.some((a) => a.id === party.id) && (await p.notification.count({ where: { link: `/app/announcements/${party.id}` } })) >= 7);
    check('Confirm-by reminder to people who haven’t confirmed', res.reminded === 1 && (await notes('ben', 'announcement.reminder')) === 1 && (await notes('ana', 'announcement.reminder')) === 0, JSON.stringify(res));
    await job.runDue();
    await wait(200);
    check('…only once', (await notes('ben', 'announcement.reminder')) === 1);

    // ── Nudge, report ──
    check('Nudge: not the poster → 403', (await call(S.ana, 'POST', `/announcements/${teamPost.id}/nudge`)).status === 403);
    await call(S.ana, 'POST', `/announcements/${teamPost.id}/acknowledge`);
    r = await call(S.mgr, 'POST', `/announcements/${teamPost.id}/nudge`);
    check('Manager nudges the 3 who haven’t confirmed', r.status === 200 && r.data.nudged === 3, JSON.stringify(r.body));
    check('Nudge again too soon → 400', (await call(S.mgr, 'POST', `/announcements/${teamPost.id}/nudge`)).status === 400);
    r = await call(S.mgr, 'GET', `/announcements/${teamPost.id}/report`);
    check('Manager sees their post’s report', r.status === 200 && r.data.total === 4 && r.data.acknowledged === 1 && r.data.people.some((x) => x.employee?.department !== undefined));
    check('Manager can’t see HR’s report', (await call(S.mgr, 'GET', `/announcements/${policy.id}/report`)).status === 403);
    check('IT Admin can’t see HR’s report', (await call(S.it, 'GET', `/announcements/${policy.id}/report`)).status === 403);
    check('HR sees the manager’s report', (await call(S.hr, 'GET', `/announcements/${teamPost.id}/report`)).status === 200);

    // ── Reactions, RSVP ──
    r = await call(S.ana, 'POST', `/announcements/${policy.id}/reactions`, { emoji: '👍' });
    check('React', r.status === 200 && r.data.reactions[0]?.emoji === '👍' && r.data.reactions[0].mine === true);
    r = await call(S.ana, 'POST', `/announcements/${policy.id}/reactions`, { emoji: '👍' });
    check('React again → off', r.data?.reactions.length === 0);
    check('Unknown emoji → 400', (await call(S.ana, 'POST', `/announcements/${policy.id}/reactions`, { emoji: '💩' })).status === 400);
    await call(S.hr, 'PATCH', `/announcements/${itPost.id}`, post({ title: 'VPN maintenance tonight 11 pm', category: 'urgent', allowReactions: false }));
    check('Reactions turned off → 400', (await call(S.ana, 'POST', `/announcements/${itPost.id}/reactions`, { emoji: '👍' })).status === 400);
    r = await call(S.ana, 'PUT', `/announcements/${party.id}/rsvp`, { response: 'going' });
    check('RSVP going', r.status === 200 && r.data.rsvp.going === 1 && r.data.rsvp.mine === 'going');
    r = await call(S.ana, 'PUT', `/announcements/${party.id}/rsvp`, { response: null });
    check('RSVP cleared', r.data?.rsvp.going === 0 && r.data.rsvp.mine === null);
    check('RSVP on a non-event → 400', (await call(S.ana, 'PUT', `/announcements/${policy.id}/rsvp`, { response: 'going' })).status === 400);
    await call(S.ben, 'PUT', `/announcements/${party.id}/rsvp`, { response: 'going' });

    // ── Feed filters, overview ──
    r = await call(S.eva, 'GET', '/announcements?category=policy');
    check('Filter by type', r.data?.length === 1 && r.data[0].id === policy.id);
    r = await call(S.eva, 'GET', '/announcements?search=' + encodeURIComponent('vpn tonight'));
    check('Search title words', r.data?.length === 1 && r.data[0].id === itPost.id);
    r = await call(S.ben, 'GET', '/announcements/overview');
    check('Overview: to confirm + events', r.status === 200 && r.data.toConfirm.some((a) => a.id === policy.id) && r.data.events[0]?.id === party.id && r.data.events[0].going === 1 && r.data.mine === null, JSON.stringify(r.body).slice(0, 300));
    r = await call(S.hr, 'GET', '/announcements/overview');
    check('Overview: poster stats', r.data?.mine?.posts >= 3 && r.data.mine.lagging?.id === policy.id, JSON.stringify(r.data?.mine));

    // ── Feed extras: seen on scroll, read all, overview, detail ──
    r = await call(S.eva, 'POST', '/announcements/seen', { ids: [itPost.id, teamPost.id] });
    check('Seen on scroll: only what I can see', r.status === 200 && r.data.seen === 1, JSON.stringify(r.body));
    r = await call(S.eva, 'GET', '/announcements/overview');
    check('Overview: reading progress + streak', r.data?.reading.read >= 1 && r.data.reading.total >= 3 && r.data.reading.streak === 1, JSON.stringify(r.data?.reading));
    check('Overview: featured (pinned, next event)', r.data?.featured[0]?.id === itPost.id && r.data.featured.some((x) => x.id === party.id && x.goingFaces?.length === 1), JSON.stringify(r.data?.featured?.map((x) => x.title)));
    r = await call(S.eva, 'POST', '/announcements/read-all');
    check('Mark all read', r.status === 200 && (await call(S.eva, 'GET', '/announcements')).body.meta.unread === 0);
    r = await call(S.ben, 'GET', '/announcements');
    check('List: company-wide confirm % on posts that ask', typeof r.data?.find((x) => x.id === policy.id)?.confirmedPct === 'number');
    await call(S.ben, 'POST', `/announcements/${policy.id}/reactions`, { emoji: '👋' });
    r = await call(S.ben, 'GET', '/announcements/overview');
    check('Most loved this week', r.data?.mostLoved[0]?.id === policy.id && r.data.mostLoved[0].reactions >= 1);
    r = await call(S.ben, 'GET', `/announcements/${policy.id}`);
    check('Detail: seen count, no faces for readers', r.data?.seen.count >= 2 && r.data.seen.faces.length === 0, JSON.stringify(r.data?.seen));
    r = await call(S.hr, 'GET', `/announcements/${policy.id}`);
    check('Detail: faces for the poster', r.data?.seen.faces.length >= 1);
    // ── Covers ──
    r = await call(S.hr, 'POST', '/announcements', post({ title: 'Launch day', coverScene: 'confetti', coverArt: 'rocket', coverMotion: 'lively', coverDim: 40 }));
    check('Scene, 3D art and motion saved', r.status === 201 && r.data.coverScene === 'confetti' && r.data.coverArt === 'rocket' && r.data.coverMotion === 'lively' && r.data.coverDim === 40);
    const launch = r.data;
    check('Unknown scene → 400', (await call(S.hr, 'POST', '/announcements', post({ coverScene: 'lava' }))).status === 400);
    const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    r = await upload(S.hr, `/announcements/${launch.id}/cover`, {}, { buf: PNG, type: 'image/png', name: 'c.png' });
    check('Upload an image cover', r.status === 201 && r.data.coverMediaKind === 'image' && r.data.coverMediaUrl.split('?')[0].endsWith('.png'), JSON.stringify(r.body));
    r = await upload(S.hr, `/announcements/${launch.id}/cover`, {}, { buf: Buffer.from('GIF89a........'), type: 'image/gif', name: 'c.gif' });
    check('GIF cover', r.data?.coverMediaKind === 'image' && r.data.coverMediaUrl.split('?')[0].endsWith('.gif'));
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(16)]);
    r = await upload(S.hr, `/announcements/${launch.id}/cover`, {}, { buf: mp4, type: 'video/mp4', name: 'c.mp4' });
    check('Video cover', r.data?.coverMediaKind === 'video');
    r = await upload(S.hr, `/announcements/${launch.id}/cover`, {}, { buf: Buffer.from(JSON.stringify({ v: '5.7.4', w: 100, h: 100, layers: [] })), type: 'application/json', name: 'a.json' });
    check('Lottie cover', r.data?.coverMediaKind === 'lottie');
    check('Not a cover → 400', (await upload(S.hr, `/announcements/${launch.id}/cover`, {}, { buf: Buffer.from('hello'), type: 'image/png', name: 'x.png' })).status === 400);
    check('Someone else’s post → 403', (await upload(S.it, `/announcements/${launch.id}/cover`, {}, { buf: PNG, type: 'image/png', name: 'c.png' })).status === 403);
    r = await call(S.hr, 'DELETE', `/announcements/${launch.id}/cover`);
    check('Remove the uploaded cover', r.status === 200 && (await p.announcement.findUnique({ where: { id: launch.id } })).coverMediaUrl === null);

    // ── Kudos ──
    await p.employee.update({ where: { id: P.eva.id }, data: { joiningDate: new Date(`${addDays(today, -5)}T00:00:00Z`) } });
    r = await call(S.ana, 'POST', '/kudos', { recipientIds: [P.ben.id], message: 'Thanks for covering my on-call!' });
    check('Give kudos', r.status === 201 && r.data.canThank === false);
    const k = r.data;
    await wait(400);
    check('The manager hears about it', (await notes('mgr', 'kudos.team')) === 1);
    check('Giver can’t add thanks', (await call(S.ana, 'POST', `/kudos/${k.id}/thanks`)).status === 400);
    check('Recipient can’t add thanks', (await call(S.ben, 'POST', `/kudos/${k.id}/thanks`)).status === 400);
    r = await call(S.cara, 'POST', `/kudos/${k.id}/thanks`);
    check('Add my thanks', r.status === 200 && r.data.thanks.count === 1 && r.data.thanks.mine === true && r.data.thanks.names[0] === 'cara T');
    await wait(300);
    check('Recipient is told', (await notes('ben', 'kudos.thanks')) === 1);
    r = await call(S.cara, 'POST', `/kudos/${k.id}/thanks`);
    check('Add my thanks again → off', r.data?.thanks.count === 0);
    check('Filter: for me', (await call(S.ben, 'GET', '/kudos?filter=for-me')).data?.length === 1 && (await call(S.ana, 'GET', '/kudos?filter=for-me')).data?.length === 0);
    check('Filter: from me', (await call(S.ana, 'GET', '/kudos?filter=from-me')).data?.length === 1);
    check('Filter: my team', (await call(S.lead, 'GET', '/kudos?filter=team')).data?.length === 1 && (await call(S.eva, 'GET', '/kudos?filter=team')).data?.length === 0);
    r = await call(S.eva, 'GET', '/kudos/leaderboard');
    check('Most thanked this month', r.data?.people[0]?.employee.id === P.ben.id && r.data.people[0].count === 1);
    r = await call(S.ben, 'GET', '/kudos/me');
    check('My kudos', r.data?.received === 1 && r.data.thisMonth === 1 && r.data.given === 0);
    r = await call(S.hr, 'GET', '/kudos/suggestions');
    check('Suggestions include the new joiner', r.status === 200 && r.data.some((x) => x.employee.id === P.eva.id && x.reason.startsWith('New')), JSON.stringify(r.body));
    check('Insights: HR only', (await call(S.ana, 'GET', '/kudos/insights')).status === 403);
    r = await call(S.hr, 'GET', '/kudos/insights?months=3');
    check('Insights: sent, thanked, givers, monthly, not thanked', r.status === 200 && r.data.sent === 1 && r.data.peopleThanked === 1 && r.data.givers === 1 && r.data.monthly.length === 3 && r.data.notThanked.some((x) => x.employee.id === P.cara.id) && !r.data.notThanked.some((x) => x.employee.id === P.ben.id), JSON.stringify(r.body).slice(0, 300));
    r = await call(S.hr, 'POST', '/kudos/insights/hint', { employeeIds: [P.cara.id, P.eva.id] });
    await wait(300);
    check('Hint managers (privately; no manager → skipped)', r.data?.hinted === 1 && r.data.skipped[0] === 'eva T' && (await notes('lead', 'kudos.hint')) === 1);
    check('Hints: once a month per person', (await call(S.hr, 'POST', '/kudos/insights/hint', { employeeIds: [P.cara.id] })).status === 200 && (await notes('lead', 'kudos.hint')) === 1);
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
