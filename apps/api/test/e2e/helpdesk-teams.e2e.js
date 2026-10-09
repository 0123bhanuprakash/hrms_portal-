// helpdesk teams (DevOps queue, team heads who assign, company-made teams): run with test/e2e/run.js (throwaway API on :4001).
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
const B = process.env.E2E_API ?? 'http://localhost:4001/api/v1';
const PW = 'Teams-E2E-2026!';
const SLUG = 'helpdesk-teams-e2e';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
const wait = (ms = 1000) => new Promise((r) => setTimeout(r, ms));
const call = async (h, m, u, b) => {
  const r = await fetch(B + u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, data: j.data, body: j };
};
async function login(email) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    if (r.status === 429) { await wait(15000); continue; }
    return { authorization: 'Bearer ' + (await r.json()).data.access_token, 'content-type': 'application/json' };
  }
  throw new Error('login throttled');
}
const dist = (m) => require(path.resolve('dist/apps/api/src/modules', m));
const D = (k) => new Date(k + 'T00:00:00Z');
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.ticketMessage.deleteMany({ where: { companyId: c.id } });
  await p.ticket.deleteMany({ where: { companyId: c.id } });
  await p.helpdeskTeam.deleteMany({ where: { companyId: c.id } });
  await p.ticketCategory.deleteMany({ where: { companyId: c.id } });
  await p.leaveRequest.deleteMany({ where: { companyId: c.id } });
  await p.leaveType.deleteMany({ where: { companyId: c.id } });
  await p.employeeHierarchy.deleteMany({ where: { companyId: c.id } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await p.auditLog.deleteMany({ where: { OR: [{ companyId: c.id }, { userId: { in: ids } }] } });
  await p.userRole.deleteMany({ where: { userId: { in: ids } } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.role.deleteMany({ where: { companyId: c.id } });
  await p.companySettings.deleteMany({ where: { companyId: c.id } });
  await p.company.delete({ where: { id: c.id } });
}

(async () => {
  await cleanup();
  try {
    const enterprise = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const company = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: enterprise.id, settings: { create: { timezone: 'Asia/Kolkata' } } } });
    const templates = await p.role.findMany({ where: { isTemplate: true }, include: { rolePermissions: { include: { permission: true } } } });
    check('DevOps role template works the DevOps queue', templates.find((t) => t.key === 'devops')?.rolePermissions.some((rp) => rp.permission.key === 'ticket.handle_devops'));
    const roles = {};
    for (const t of templates) roles[t.key] = (await p.role.create({ data: { companyId: company.id, key: t.key, name: t.name, isOwner: t.isOwner, isSystemRole: t.isOwner, rolePermissions: { create: t.rolePermissions.map((rp) => ({ permissionId: rp.permissionId, scope: rp.scope })) } } })).id;
    const hash = await bcrypt.hash(PW, 10);
    const P = {};
    const mk = async (name, keys) => {
      const u = await p.user.create({ data: { email: `${name}@${SLUG}.test`, passwordHash: hash, firstName: name, lastName: 'T', companyId: company.id, status: 'ACTIVE', emailVerifiedAt: new Date(), lastLoginAt: new Date(), userRoles: { create: keys.map((k) => ({ roleId: roles[k], companyId: company.id })) } } });
      const e = await p.employee.create({ data: { companyId: company.id, userId: u.id, employeeId: name.toUpperCase(), firstName: name, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01') } });
      await p.employeeHierarchy.create({ data: { companyId: company.id, ancestorId: e.id, descendantId: e.id, depth: 0 } });
      P[name] = { ...e, user: u };
    };
    await mk('admin', ['company_admin']);
    await mk('emp', ['employee']);
    await mk('head', ['employee', 'it_admin']);
    await mk('mem', ['employee', 'it_admin']);
    await mk('mem2', ['employee', 'it_admin']);
    await mk('dev', ['employee', 'devops']);
    await mk('hr', ['employee', 'hr']);
    await mk('fac1', ['employee']);
    await mk('fac2', ['employee']);
    const H = {};
    for (const n of Object.keys(P)) H[n] = await login(`${n}@${SLUG}.test`);
    const notes = (who, type) => p.notification.count({ where: { userId: P[who].user.id, type } });
    const newTicket = async (subject, extra = {}) => (await call(H.emp, 'POST', '/helpdesk/tickets', { queue: 'IT', subject, description: 'Please help with this', ...extra })).data;

    // ── Before any head: everyone in the queue takes tickets ──
    const t0 = await newTicket('Monitor flickers');
    check('No head yet: a member can reply (and takes it)', (await call(H.mem, 'POST', `/helpdesk/tickets/${t0.id}/messages`, { body: 'Looking' })).data?.assignee?.id === P.mem.user.id);
    await wait(400);
    check('No head yet: every agent heard about the new ticket', (await notes('head', 'ticket.created')) === 1 && (await notes('mem', 'ticket.created')) === 1);

    // ── Choosing heads ──
    check('A member can’t choose heads', (await call(H.head, 'PUT', '/helpdesk/teams/IT', { headId: P.head.user.id })).status === 403);
    check('Head must work the queue', (await call(H.admin, 'PUT', '/helpdesk/teams/IT', { headId: P.emp.user.id })).status === 400);
    check('Head and backup must differ', (await call(H.admin, 'PUT', '/helpdesk/teams/IT', { headId: P.head.user.id, backupId: P.head.user.id })).status === 400);
    const saved = await call(H.admin, 'PUT', '/helpdesk/teams/IT', { headId: P.head.user.id, backupId: P.mem2.user.id });
    const it = saved.data?.teams?.find((t) => t.queue === 'IT');
    check('Admin sets IT head + backup', saved.status === 200 && it?.headId === P.head.user.id && it?.backupId === P.mem2.user.id, saved.status);
    check('Teams list shows members with open counts', it?.members.some((m) => m.id === P.mem.user.id && m.open === 1) && it?.members.every((m) => m.id !== P.admin.user.id));
    const memTeams = await call(H.mem, 'GET', '/helpdesk/teams');
    check('A member sees only their teams, not as lead', memTeams.data?.teams.length === 1 && memTeams.data.teams[0].isLead === false && memTeams.data.canManage === false);
    check('Admin sees all 4 teams incl. DevOps', (await call(H.admin, 'GET', '/helpdesk/teams')).data?.teams.map((t) => t.queue).join() === 'IT,HR,FINANCE,DEVOPS');

    // ── New ticket goes to the head only ──
    const t1 = await newTicket('Laptop fan is loud', { priority: 'HIGH' });
    await wait(400);
    check('New ticket alerts the head', (await notes('head', 'ticket.created')) === 2);
    check('…not the members', (await notes('mem', 'ticket.created')) === 1 && (await notes('mem2', 'ticket.created')) === 1);

    // ── Members work only what is assigned to them ──
    const asMem = (await call(H.mem, 'GET', `/helpdesk/tickets/${t1.id}`)).data;
    check('Member sees the ticket (read + note only)', asMem?.canAssign === false && asMem?.canReply === false && asMem?.canNote === true && asMem?.canResolve === false);
    check('Member can’t reply to an unassigned ticket', (await call(H.mem, 'POST', `/helpdesk/tickets/${t1.id}/messages`, { body: 'Mine now' })).status === 403);
    check('Member can add an internal note', (await call(H.mem, 'POST', `/helpdesk/tickets/${t1.id}/messages`, { body: 'Seen this before', internal: true })).status === 200);
    check('Member can’t assign', (await call(H.mem, 'POST', `/helpdesk/tickets/${t1.id}/assign`, { assigneeId: P.mem.user.id })).status === 403);
    check('Member can’t resolve', (await call(H.mem, 'POST', `/helpdesk/tickets/${t1.id}/resolve`, { resolution: 'Done' })).status === 403);
    check('Member can’t change priority', (await call(H.mem, 'PATCH', `/helpdesk/tickets/${t1.id}`, { priority: 'LOW' })).status === 403);
    const memCounts = await call(H.mem, 'GET', '/helpdesk/counts');
    const headCounts = await call(H.head, 'GET', '/helpdesk/counts');
    check('Badge: member counts only their own, head counts unassigned too', memCounts.data?.queue === 1 && headCounts.data?.queue === 1, JSON.stringify([memCounts.data, headCounts.data]));

    // ── The head assigns ──
    const head = (await call(H.head, 'GET', `/helpdesk/tickets/${t1.id}`)).data;
    check('Head may assign', head?.canAssign === true && head?.teamHeadId === P.head.user.id);
    check('Can’t assign outside the queue', (await call(H.head, 'POST', `/helpdesk/tickets/${t1.id}/assign`, { assigneeId: P.dev.user.id })).status === 400);
    const a = await call(H.head, 'POST', `/helpdesk/tickets/${t1.id}/assign`, { assigneeId: P.mem.user.id });
    check('Head assigns to a member', a.data?.assignee?.id === P.mem.user.id, a.status);
    await wait(400);
    check('Member is told', (await notes('mem', 'ticket.assigned')) === 1);
    check('Backup may assign too', (await call(H.mem2, 'POST', `/helpdesk/tickets/${t1.id}/assign`, { assigneeId: P.mem.user.id })).status === 200);
    const r = await call(H.mem, 'POST', `/helpdesk/tickets/${t1.id}/messages`, { body: 'Cleaning the fan at 3 pm' });
    check('Assigned member replies', r.status === 200 && r.data?.canResolve === true, r.status);
    check('Backup (a lead) may reply too', (await call(H.mem2, 'GET', `/helpdesk/tickets/${t1.id}`)).data?.canReply === true);
    check('Assigned member resolves', (await call(H.mem, 'POST', `/helpdesk/tickets/${t1.id}/resolve`, { resolution: 'Fan cleaned' })).status === 200);
    check('Company Admin may assign as well', (await call(H.admin, 'GET', `/helpdesk/tickets/${t0.id}`)).data?.canAssign === true);

    // ── Bulk actions (same rules per ticket) ──
    const b1 = await newTicket('Printer jams');
    const b2 = await newTicket('Mouse broken');
    const asMember = await call(H.mem, 'POST', '/helpdesk/tickets/bulk', { ids: [b1.id, b2.id], action: 'assign', assigneeId: P.mem.user.id });
    check('Bulk: a member can’t assign — each ticket refused', asMember.status === 200 && asMember.data?.done === 0 && asMember.data?.failed.length === 2, JSON.stringify(asMember.data));
    const asHead = await call(H.head, 'POST', '/helpdesk/tickets/bulk', { ids: [b1.id, b2.id], action: 'assign', assigneeId: P.mem.user.id });
    check('Bulk: head assigns both', asHead.data?.done === 2 && !asHead.data?.failed.length, JSON.stringify(asHead.data));
    const pr = await call(H.mem, 'POST', '/helpdesk/tickets/bulk', { ids: [b1.id, b2.id, t0.id], action: 'priority', priority: 'HIGH' });
    check('Bulk: member changes priority on their own tickets', pr.data?.done === 3, JSON.stringify(pr.data));
    check('Bulk: bad action refused', (await call(H.head, 'POST', '/helpdesk/tickets/bulk', { ids: [b1.id], action: 'delete' })).status === 400);
    check('Bulk: more than 50 refused', (await call(H.head, 'POST', '/helpdesk/tickets/bulk', { ids: Array.from({ length: 51 }, () => crypto.randomUUID()), action: 'priority', priority: 'LOW' })).status === 400);
    const mv = await call(H.head, 'POST', '/helpdesk/tickets/bulk', { ids: [b2.id], action: 'move', queue: 'DEVOPS' });
    check('Bulk: move to DevOps', mv.data?.done === 1 && (await p.ticket.findUnique({ where: { id: b2.id } })).queue === 'DEVOPS');

    // ── Head on leave → backup gets the alerts ──
    const cl = await p.leaveType.create({ data: { companyId: company.id, name: 'Casual', code: 'CL', category: 'CASUAL' } });
    await p.leaveRequest.create({ data: { companyId: company.id, employeeId: P.head.id, leaveTypeId: cl.id, startDate: D(todayKey()), endDate: D(todayKey()), totalDays: 1, reason: 'Away', status: 'APPROVED' } });
    const away = (await call(H.admin, 'GET', '/helpdesk/teams')).data?.teams.find((t) => t.queue === 'IT');
    check('Teams list marks the head away today', away?.members.find((m) => m.id === P.head.user.id)?.awayToday === true);
    await newTicket('Wi-Fi drops in room 3');
    await wait(400);
    check('Head away → backup gets the new ticket', (await notes('mem2', 'ticket.created')) === 2 && (await notes('head', 'ticket.created')) === 4);

    // ── Reminder: Urgent / High still unowned after 30 min ──
    await p.leaveRequest.deleteMany({ where: { companyId: company.id } });
    const t3 = await newTicket('VPN down for everyone', { priority: 'HIGH' });
    await p.ticket.update({ where: { id: t3.id }, data: { createdAt: new Date(Date.now() - 45 * 60_000) } });
    const { HelpdeskRemindersService } = dist('helpdesk/helpdesk-reminders.service.js');
    const { HelpdeskTeamsService } = dist('helpdesk/teams.service.js');
    const { NotificationsService } = dist('notifications/notifications.service.js');
    const { RealtimeService } = dist('realtime/realtime.service.js');
    const rt = new RealtimeService();
    const ns = new NotificationsService(p, { queueNotification: async () => undefined }, { get: () => undefined }, rt);
    const rem = new HelpdeskRemindersService(p, ns, { get: () => 'false' }, { live: () => undefined }, new HelpdeskTeamsService(p, rt, ns));
    await rem.run();
    await rem.run();
    check('Head reminded once about the unowned High ticket', (await notes('head', 'ticket.unassigned')) === 1 && (await notes('mem', 'ticket.unassigned')) === 0);

    // ── DevOps queue ──
    const d = await call(H.emp, 'POST', '/helpdesk/tickets', { queue: 'DEVOPS', subject: 'Need access to staging DB', description: 'For the release on Friday' });
    check('Employee raises a DevOps ticket', d.status === 201 && d.data?.queue === 'DEVOPS', d.status);
    await wait(400);
    check('DevOps engineer is told', (await notes('dev', 'ticket.created')) === 1);
    check('IT people don’t see DevOps tickets', (await call(H.head, 'GET', `/helpdesk/tickets/${d.data?.id}`)).status === 404);
    check('DevOps agent lists the DevOps queue', (await call(H.dev, 'GET', '/helpdesk/tickets?view=queue&status=active')).data?.some((t) => t.id === d.data?.id));

    // ── Company-made teams (picked members, managed by Company Admin / HR) ──
    check('An employee can’t add a team', (await call(H.emp, 'POST', '/helpdesk/teams', { label: 'Facilities' })).status === 403);
    check('Names can’t clash with a built-in team', (await call(H.hr, 'POST', '/helpdesk/teams', { label: 'it' })).status === 409);
    check('Members must be people of this company', (await call(H.hr, 'POST', '/helpdesk/teams', { label: 'Facilities', memberIds: [company.id] })).status === 400);
    const made = await call(H.hr, 'POST', '/helpdesk/teams', { label: 'Facilities', emoji: '🏢', description: 'Desks, AC, parking, pantry', memberIds: [P.fac1.user.id, P.fac2.user.id] });
    const FAC = made.data?.queue;
    const facTeam = made.data?.teams?.find((t) => t.queue === FAC);
    check('HR adds a Facilities team', made.status === 201 && /^T[0-9A-F]{8}$/.test(FAC ?? '') && facTeam?.custom && facTeam.members.length === 2, JSON.stringify(made.body).slice(0, 300));
    check('Built-in teams can’t be renamed', (await call(H.admin, 'PUT', '/helpdesk/teams/HR', { label: 'People' })).status === 400);
    const empQueues = (await call(H.emp, 'GET', '/helpdesk/queues')).data;
    check('Everyone sees the new team; employees don’t work it', empQueues?.length === 5 && empQueues.find((q) => q.queue === FAC)?.label === 'Facilities' && empQueues.every((q) => !q.works));
    check('Members work it', (await call(H.fac1, 'GET', '/helpdesk/queues')).data?.find((q) => q.queue === FAC)?.works === true);
    check('A member gets the Ticket queue menu', (await call(H.fac2, 'GET', '/helpdesk/counts')).data?.works === true && (await call(H.emp, 'GET', '/helpdesk/counts')).data?.works === false);
    check('Head must be a member', (await call(H.hr, 'PUT', `/helpdesk/teams/${FAC}`, { headId: P.emp.user.id })).status === 400);
    check('HR sets a member as head', (await call(H.hr, 'PUT', `/helpdesk/teams/${FAC}`, { headId: P.fac1.user.id })).data?.teams.find((t) => t.queue === FAC)?.headId === P.fac1.user.id);
    const ac = await call(H.hr, 'POST', '/helpdesk/categories', { queue: FAC, name: 'Air conditioning', icon: '❄️' });
    check('HR adds a topic to the team', ac.status === 201 && ac.data?.queue === FAC, ac.status);
    check('A non-member can’t add topics to it', (await call(H.head, 'POST', '/helpdesk/categories', { queue: FAC, name: 'Parking' })).status === 403);
    const before = await notes('fac1', 'ticket.created');
    const ft = await call(H.emp, 'POST', '/helpdesk/tickets', { queue: FAC, categoryId: ac.data?.id, subject: 'AC not cooling on 3rd floor', description: 'Since this morning near the windows' });
    check('Employee raises a Facilities ticket', ft.status === 201 && ft.data?.queue === FAC && ft.data.queueLabel === 'Facilities' && ft.data.queueEmoji === '🏢', JSON.stringify(ft.body).slice(0, 300));
    await wait(400);
    check('The team head is told', (await notes('fac1', 'ticket.created')) === before + 1 && (await notes('fac2', 'ticket.created')) === 0);
    check('Members list the team’s tickets', (await call(H.fac2, 'GET', `/helpdesk/tickets?view=queue&queue=${FAC}`)).data?.some((t) => t.id === ft.data?.id));
    check('Other agents don’t see them', (await call(H.head, 'GET', `/helpdesk/tickets/${ft.data?.id}`)).status === 404);
    check('Only members can be assigned', (await call(H.fac1, 'POST', `/helpdesk/tickets/${ft.data?.id}/assign`, { assigneeId: P.mem.user.id })).status === 400);
    check('Head assigns a member', (await call(H.fac1, 'POST', `/helpdesk/tickets/${ft.data?.id}/assign`, { assigneeId: P.fac2.user.id })).data?.assignee?.id === P.fac2.user.id);
    const wrong = await newTicket('The AC in room 4 is leaking');
    await call(H.admin, 'PUT', '/helpdesk/teams/IT', { headId: null });
    const moved = await call(H.mem, 'PATCH', `/helpdesk/tickets/${wrong.id}`, { queue: FAC });
    check('IT moves a ticket to Facilities', moved.status === 200 && moved.data?.moved === true && (await p.ticket.findUnique({ where: { id: wrong.id } })).queue === FAC, moved.status);
    check('Archiving with open tickets asks first', (await call(H.hr, 'PUT', `/helpdesk/teams/${FAC}`, { archived: true })).status === 409);
    check('…and archives when told to', (await call(H.hr, 'PUT', `/helpdesk/teams/${FAC}`, { archived: true, force: true })).data?.teams.find((t) => t.queue === FAC)?.archived === true);
    check('An archived team takes no new tickets', (await call(H.emp, 'POST', '/helpdesk/tickets', { queue: FAC, subject: 'Parking pass please', description: 'Lost my parking pass' })).status === 400);
    check('…but its open tickets can still be finished', (await call(H.fac2, 'POST', `/helpdesk/tickets/${ft.data?.id}/resolve`, { resolution: 'Gas refilled' })).data?.status === 'RESOLVED');
    check('Archived teams stay listed (for old tickets)', (await call(H.emp, 'GET', '/helpdesk/queues')).data?.find((q) => q.queue === FAC)?.archived === true);
    await call(H.hr, 'PUT', `/helpdesk/teams/${FAC}`, { archived: false, memberIds: [P.fac1.user.id] });
    check('Taking someone off the team removes their access', (await call(H.fac2, 'GET', `/helpdesk/tickets/${ft.data?.id}`)).status === 404);

    // ── Removing the head brings back “anyone takes” ──
    await call(H.admin, 'PUT', '/helpdesk/teams/IT', { headId: null });
    check('Without a head, members reply again', (await call(H.mem, 'GET', `/helpdesk/tickets/${t3.id}`)).data?.canReply === true);
  } catch (err) {
    check('No crash', false, err.stack);
  } finally {
    await cleanup().catch((e) => console.error(e));
    await p.$disconnect();
    const failed = results.filter((r) => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();
