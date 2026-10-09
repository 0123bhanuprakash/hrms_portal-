// Switch maternity to "only when granted" (document required) in the given companies,
// and give a grant to anyone who already has maternity leave without one.
// Run from apps/api: node prisma/scripts/switch-maternity-to-grants.cjs (safe to run twice: leave already on a grant is skipped)
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const SLUGS = ['aakash-portal', 'resources-demo', 'seedsai'];

(async () => {
  const types = await p.leaveType.findMany({ where: { category: 'MATERNITY', company: { slug: { in: SLUGS } } }, select: { id: true, companyId: true, company: { select: { slug: true } } } });
  await p.$transaction(async (tx) => {
    for (const t of types) {
      await tx.leaveType.update({
        where: { id: t.id },
        data: { availability: 'GRANT_ONLY', grantNeedsDocument: true, genders: ['FEMALE'], accrual: 'UPFRONT', carryForward: false, maxCarryForward: 0, carryExpiry: null, negativeBalance: 0 },
      });
      console.log(`${t.company.slug}: maternity is now only when granted (document required)`);

      // Maternity leave taken before grants existed → a grant that covers it
      const leaves = await tx.leaveRequest.findMany({
        where: { leaveTypeId: t.id, leaveGrantId: null, status: { in: ['PENDING', 'APPROVED'] } },
        select: { id: true, employeeId: true, startDate: true, endDate: true, totalDays: true, createdAt: true, documentKey: true, documentName: true, documentMime: true, documentSize: true, employee: { select: { firstName: true, lastName: true } }, approvals: { select: { actedById: true }, orderBy: { level: 'desc' }, take: 1 } },
      });
      for (const l of leaves) {
        const from = l.startDate;
        const to = new Date(Date.UTC(from.getUTCFullYear() + 1, from.getUTCMonth(), from.getUTCDate() - 1));
        const by = l.approvals[0]?.actedById ?? null;
        const days = Math.max(182, l.totalDays);
        const grant = await tx.leaveGrant.create({
          data: {
            companyId: t.companyId, employeeId: l.employeeId, leaveTypeId: t.id, days, validFrom: from, validTo: to < l.endDate ? l.endDate : to,
            reason: 'Maternity leave approved before grants were introduced — certificate already on file',
            grantedById: by, documentKey: l.documentKey, documentName: l.documentName, documentMime: l.documentMime, documentSize: l.documentSize,
            createdAt: l.createdAt,
            events: { create: { kind: 'CREATED', days, validTo: to < l.endDate ? l.endDate : to, note: 'Created when maternity switched to “only when granted”', byId: by } },
          },
        });
        await tx.leaveRequest.update({ where: { id: l.id }, data: { leaveGrantId: grant.id } });
        console.log(`  grant for ${l.employee.firstName} ${l.employee.lastName}: ${days} days, ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}, linked to her leave (${l.totalDays} days)`);
      }
    }
  });
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
