import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AUTH_CONSTANTS } from '@hrms/types';

// ============================================================
// Database Seed Script
// Run: pnpm --filter @hrms/api prisma db seed
//
// Seeds only the platform Super Admin (from env vars).
//
// Everything else is created by the API on start-up
// (modules/access/access-bootstrap.service.ts), from the code catalog:
//   • permissions (module.action keys)    • role templates
//   • default plans                       • each company's own roles
// ============================================================

const prisma = new PrismaClient();

/** Global platform role held by Super Admins (outside company RBAC). */
async function seedSuperAdminRole(): Promise<string> {
  const existing = await prisma.role.findFirst({ where: { companyId: null, name: 'super_admin' } });
  const role =
    existing ??
    (await prisma.role.create({
      data: {
        companyId: null,
        name: 'super_admin',
        key: 'super_admin',
        description: 'Platform Super Administrator — manages all companies and the platform itself',
        isSystemRole: true,
      },
    }));
  return role.id;
}

// ─── Super Admin user ─────────────────────────────────────────

async function seedSuperAdmin(superAdminRoleId: string): Promise<void> {
  console.log('\n👤 Seeding Super Admin user...');

  const email = process.env['SUPER_ADMIN_EMAIL'];
  const password = process.env['SUPER_ADMIN_PASSWORD'];
  const firstName = process.env['SUPER_ADMIN_FIRST_NAME'] || 'Super';
  const lastName = process.env['SUPER_ADMIN_LAST_NAME'] || 'Admin';

  if (!email || !password) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env',
    );
  }

  const passwordHash = await bcrypt.hash(password, AUTH_CONSTANTS.BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName,
      lastName,
      isSuperAdmin: true,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      isSuperAdmin: true,
      companyId: null,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      preferences: {
        create: {
          theme: 'system',
          timezone: 'Asia/Kolkata',
          dateFormat: 'DD/MM/YYYY',
        },
      },
    },
    include: { preferences: true },
  });

  // Assign super_admin role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdminRoleId } },
    update: {},
    create: {
      userId: user.id,
      roleId: superAdminRoleId,
      companyId: null,
    },
  });

  console.log(`   ✅ Super Admin: ${email} (${user.id})`);
}

// ─── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 HRMS Portal — Database Seed Starting');
  console.log('══════════════════════════════════════════');

  await seedSuperAdmin(await seedSuperAdminRole());

  console.log('\n══════════════════════════════════════════');
  console.log('✅ Seed completed successfully!');
  console.log('   Sign in at /platform/login with SUPER_ADMIN_EMAIL from your .env');
  console.log('   Permissions, role templates and plans are created when the API starts.');
  console.log('\n🚀 Start the app: pnpm dev');
  console.log(`📚 Swagger UI:    http://localhost:${process.env['API_PORT'] ?? 4000}/api/docs\n`);
}

main()
  .catch((error: Error) => {
    console.error('\n❌ Seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
