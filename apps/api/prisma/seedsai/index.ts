/* eslint-disable no-console */
// ============================================================
// SeedsAI Technologies — a full year of realistic test data (development only).
//
//   pnpm --filter @hrms/api db:seed-seedsai            (creates the company)
//   pnpm --filter @hrms/api db:seed-seedsai -- --reset (wipes SeedsAI and rebuilds it)
//
// Needs: the API started once against this database (permissions + plans synced),
// SEEDSAI_PASSWORD in apps/api/.env (every account gets it), PII_ENCRYPTION_KEY.
// Writes photos / logos to uploads/<companyId> and PDFs to private-files/<companyId>.
// No emails or notifications are sent — everything is written straight to the DB.
// ============================================================
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { COMPANY } from './roster';
import { type Ctx, seedCareer, seedCompany, seedPeople, seedProfiles, wipe } from './org';
import { seedWork } from './work';
import { seedTime } from './time';
import { seedAssets, seedExpenses, seedHelpdesk, seedPayroll } from './ops';
import { seedEngagement, seedPlatform } from './engage';
import { todayKey, uuid } from './util';

async function main() {
  const prisma = new PrismaClient();
  const password = process.env.SEEDSAI_PASSWORD;
  if (!password) throw new Error('Set SEEDSAI_PASSWORD in apps/api/.env first');
  if (!(await prisma.permission.count())) throw new Error('No permissions in the database — start the API once first');
  const existing = await prisma.company.findUnique({ where: { slug: COMPANY.slug } });
  if (existing) {
    if (!process.argv.includes('--reset')) throw new Error(`'${COMPANY.slug}' already exists — run with --reset to rebuild it`);
    console.log('🧹 Removing the old SeedsAI data…');
    await wipe(prisma, existing.id);
  }
  const today = todayKey();
  const ctx: Ctx = {
    prisma, companyId: uuid(), today, start: '2025-10-01', people: new Map(), roles: {}, dept: {}, loc: {}, shift: {}, title: {},
    passwordHash: await bcrypt.hash(password, 12), count: {},
  };
  const step = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    process.stdout.write(`• ${name}… `);
    await fn();
    console.log(`${((Date.now() - t) / 1000).toFixed(1)}s`);
  };
  await step('Company, roles, structure', () => seedCompany(ctx));
  await step('People and reporting lines', () => seedPeople(ctx));
  await step('Profiles, documents, photos', () => seedProfiles(ctx));
  await step('Salaries and employment history', () => seedCareer(ctx));
  await step('Projects and resource requests', () => seedWork(ctx));
  await step('Holidays, leave, attendance, timesheets', () => seedTime(ctx));
  await step('Payroll (12 months)', () => seedPayroll(ctx));
  await step('Expenses', () => seedExpenses(ctx));
  await step('Assets', () => seedAssets(ctx));
  await step('Helpdesk', () => seedHelpdesk(ctx));
  await step('Announcements and kudos', () => seedEngagement(ctx));
  await step('Notifications, reports, activity, audit', () => seedPlatform(ctx));
  await prisma.$disconnect();
  console.log(`\n✅ SeedsAI ready (company id ${ctx.companyId}, today ${today})`);
  console.table(ctx.count);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
