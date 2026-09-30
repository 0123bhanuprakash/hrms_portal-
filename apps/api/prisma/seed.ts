import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  AUTH_CONSTANTS,
} from '@hrms/types';

// ============================================================
// Database Seed Script
// Run: pnpm --filter @hrms/api prisma db seed
//
// Seeds:
//   1. All permission keys (from @hrms/types PERMISSIONS)
//   2. System roles: super_admin, company_admin, hr, manager, employee
//   3. Role → Permission mappings
//   4. Super Admin user (from env vars)
// ============================================================

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────

function parsePermissionKey(key: string): { module: string; action: string } {
  const [module, action] = key.split(':');
  if (!module || !action) {
    throw new Error(`Invalid permission key format: "${key}". Expected "module:action"`);
  }
  return { module, action };
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ─── Step 1: Seed Permissions ─────────────────────────────────

async function seedPermissions(): Promise<Map<string, string>> {
  console.log('\n📋 Seeding permissions...');
  const permissionMap = new Map<string, string>(); // key → id

  const permissionKeys = Object.values(PERMISSIONS) as string[];

  for (const key of permissionKeys) {
    const { module, action } = parsePermissionKey(key);

    const permission = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        module,
        action,
        key,
        description: `${action.replace(/_/g, ' ')} ${module.replace(/_/g, ' ')}`,
      },
    });

    permissionMap.set(key, permission.id);
  }

  console.log(`   ✅ ${permissionKeys.length} permissions upserted`);
  return permissionMap;
}

// ─── Step 2: Seed System Roles ────────────────────────────────

type RoleName = 'super_admin' | 'company_admin' | 'hr' | 'manager' | 'employee';

const SYSTEM_ROLES: Array<{
  name: RoleName;
  description: string;
}> = [
  {
    name: 'super_admin',
    description: 'Platform Super Administrator — manages all companies and the platform itself',
  },
  {
    name: 'company_admin',
    description: 'Company Administrator — full access to all company features',
  },
  {
    name: 'hr',
    description: 'HR Manager — manages employees, attendance, leave, payroll, recruitment',
  },
  {
    name: 'manager',
    description: 'Team Manager — manages direct reports, approves leaves and attendance',
  },
  {
    name: 'employee',
    description: 'Regular Employee — self-service access to own data',
  },
];

async function seedSystemRoles(): Promise<Map<RoleName, string>> {
  console.log('\n🎭 Seeding system roles...');
  const roleMap = new Map<RoleName, string>(); // name → id

  for (const roleData of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        companyId_name: {
          companyId: null as unknown as string,
          name: roleData.name,
        },
      },
      update: { description: roleData.description },
      create: {
        companyId: null,
        name: roleData.name,
        description: roleData.description,
        isSystemRole: true,
      },
    });

    roleMap.set(roleData.name, role.id);
    console.log(`   ✅ Role "${roleData.name}" (${role.id})`);
  }

  return roleMap;
}

// ─── Step 3: Assign Permissions to Roles ─────────────────────

async function seedRolePermissions(
  roleMap: Map<RoleName, string>,
  permissionMap: Map<string, string>,
): Promise<void> {
  console.log('\n🔗 Assigning permissions to roles...');

  for (const [roleName, permissionKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName as RoleName);
    if (!roleId) {
      console.warn(`   ⚠️  Role "${roleName}" not found — skipping permissions`);
      continue;
    }

    // Clear existing permissions for this role first (idempotent)
    await prisma.rolePermission.deleteMany({ where: { roleId } });

    const validPermissions = permissionKeys
      .map((key: string) => ({ roleId, permissionId: permissionMap.get(key) }))
      .filter((rp): rp is { roleId: string; permissionId: string } =>
        rp.permissionId !== undefined,
      );

    if (validPermissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: validPermissions,
        skipDuplicates: true,
      });
    }

    console.log(`   ✅ Role "${roleName}": ${validPermissions.length} permissions assigned`);
  }
}

// ─── Step 4: Seed Super Admin User ────────────────────────────

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

  // 1. Permissions
  const permissionMap = await seedPermissions();

  // 2. System roles
  const roleMap = await seedSystemRoles();

  // 3. Role → Permission mappings
  await seedRolePermissions(roleMap, permissionMap);

  // 4. Super Admin user
  const superAdminRoleId = roleMap.get('super_admin');
  if (!superAdminRoleId) throw new Error('super_admin role not found after seeding');
  await seedSuperAdmin(superAdminRoleId);

  console.log('\n══════════════════════════════════════════');
  console.log('✅ Seed completed successfully!\n');
  console.log('🔑 Super Admin credentials:');
  console.log(`   Email:    ${process.env['SUPER_ADMIN_EMAIL']}`);
  console.log(`   Password: ${process.env['SUPER_ADMIN_PASSWORD']}`);
  console.log('\n🚀 Start the app: pnpm --filter @hrms/api dev');
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
