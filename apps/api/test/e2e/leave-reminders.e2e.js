// leave-reminders: run with test/e2e/run.js (throwaway API on :4001, console email).
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const dist = (m) => require(require('path').resolve('dist/apps/api/src/modules', m));
const { AttendanceRemindersService } = dist('attendance/attendance-reminders.service.js');
const { AttendancePolicyService } = dist('attendance/policy.service.js');
const { NotificationsService } = dist('notifications/notifications.service.js');
const SLUG = 'reminder-test';
const results = [];
const check = (n, ok, x = '') => { results.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${!ok && x !== '' ? '  — ' + x : ''}`); };
async function cleanup() {
  const c = await p.company.findUnique({ where: { slug: SLUG } });
  if (!c) return;
  const ids = (await p.user.findMany({ where: { companyId: c.id }, select: { id: true } })).map((u) => u.id);
  await p.notification.deleteMany({ where: { userId: { in: ids } } });
  await p.attendanceRecord.deleteMany({ where: { companyId: c.id } });
  await p.employee.deleteMany({ where: { companyId: c.id } });
  await p.user.deleteMany({ where: { id: { in: ids } } });
  await p.companySettings.deleteMany({ where: { companyId: c.id } });
  await p.company.delete({ where: { id: c.id } });
}
(async () => {
  await cleanup();
  try {
    const plan = await p.plan.findUniqueOrThrow({ where: { key: 'enterprise' } });
    const c = await p.company.create({ data: { name: SLUG, slug: SLUG, email: `x@${SLUG}.test`, planId: plan.id, settings: { create: { timezone: 'Asia/Kolkata' } } } });
    const mk = async (n) => {
      const u = await p.user.create({ data: { email: `${n}@${SLUG}.test`, passwordHash: 'x', firstName: n, lastName: 'T', companyId: c.id, status: 'ACTIVE' } });
      return p.employee.create({ data: { companyId: c.id, userId: u.id, employeeId: n, firstName: n, lastName: 'T', email: u.email, joiningDate: new Date('2025-01-01') } });
    };
    const forgot = await mk('forgot'), fine = await mk('fine');
    // "Now" = 2026-10-06 10:30 IST → yesterday = 2026-10-05
    const now = new Date('2026-10-06T05:00:00.000Z');
    const early = new Date('2026-10-06T03:00:00.000Z'); // 08:30 IST
    const day = new Date('2026-10-05T00:00:00.000Z');
    await p.attendanceRecord.create({ data: { companyId: c.id, employeeId: forgot.id, date: day, checkIn: new Date('2026-10-05T04:00:00Z'), status: 'PRESENT' } });
    await p.attendanceRecord.create({ data: { companyId: c.id, employeeId: fine.id, date: day, checkIn: new Date('2026-10-05T04:00:00Z'), checkOut: new Date('2026-10-05T13:00:00Z'), workingMinutes: 540, status: 'PRESENT' } });
    const emails = [];
    const config = { get: (k) => (k === 'webUrl' ? 'http://localhost:3000' : undefined) };
    const notifications = new NotificationsService(p, { queueNotification: async (d) => emails.push(d) }, config);
    const job = new AttendanceRemindersService(p, new AttendancePolicyService(p), notifications, config);
    const before = await job.run(early);
    const mine = () => p.notification.findMany({ where: { user: { companyId: c.id } } });
    check('Before 10:00 local → nothing sent', (await mine()).length === 0, before);
    await job.run(now);
    await new Promise((r) => setTimeout(r, 500));
    const n1 = await mine();
    check('Reminder only for the person who forgot', n1.length === 1 && n1[0].userId === forgot.userId && n1[0].type === 'attendance.missing_checkout', JSON.stringify(n1));
    check('Reminder emailed with a link to attendance', emails.length === 1 && emails[0].actionUrl === 'http://localhost:3000/app/attendance');
    await job.run(new Date(now.getTime() + 15 * 60_000));
    check('Next run the same day → no duplicate', (await mine()).length === 1);
  } catch (e) { console.error('ERROR', e.stack); results.push(false); }
  finally {
    await cleanup();
    console.log(`\n${results.filter(Boolean).length}/${results.length} passed — test company removed`);
    process.exitCode = results.length && results.every(Boolean) ? 0 : 1;
    await p.$disconnect();
  }
})();
