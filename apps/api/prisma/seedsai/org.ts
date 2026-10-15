/* Company, roles, structure, people and their profiles. */
import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { EXTRA_ROLE_TEMPLATES, ROLE_TEMPLATES, broader } from '../../src/modules/access/catalog';
import { COMPANY, DEPARTMENTS, HEADS, HISTORY, LEVELS, LOCATIONS, PEOPLE, TITLES, mailOf, type Person } from './roster';
import { API_URL, D, K, PRIVATE, UPLOADS, addDays, chunked, encryptPii, gauss, hash, pdf, pick, rint, rnd, stamp, uuid, writeFile } from './util';

export interface Row extends Person {
  id: string;
  userId: string;
  empNo: string;
  email: string;
  dob: string;
  phone: string;
  status: 'ACTIVE' | 'PROBATION' | 'NOTICE_PERIOD' | 'ON_LEAVE' | 'TERMINATED';
  /** Last working day (leavers) */
  lastDay: string | null;
  /** Annual CTC now, and before the April 2026 increment */
  ctc: number;
  ctcBefore: number | null;
  /** Personality for attendance: arrival offset (min), extra hours, reliability */
  habit: { arrive: number; spread: number; stay: number; wfh: number; sick: number; absent: number };
}

export interface Ctx {
  prisma: PrismaClient;
  companyId: string;
  today: string;
  /** First day of history (one year back) */
  start: string;
  people: Map<string, Row>;
  roles: Record<string, string>;
  dept: Record<string, string>;
  loc: Record<string, string>;
  shift: Record<string, string>;
  title: Record<string, string>;
  passwordHash: string;
  count: Record<string, number>;
  // Filled in by later steps
  projectId?: Record<string, string>;
  members?: Member[];
  route?: (r: Row, day: string) => { ids: string[]; label: string; first: string | null };
  delegations?: Array<{ from: string; to: string; a: string; b: string; reason: string; revoked?: string }>;
  leaveOn?: Map<string, { code: string; half: string | null; status: string }>;
  worked?: Map<string, { inMin: number; outMin: number; breakStart: number | null; breakEnd: number | null; wfh: boolean }>;
}

/** One assignment row, with its real dates */
export interface Member { code: string; key: string; role: 'MANAGER' | 'TEAM_LEAD' | 'MEMBER'; allocation: number; from: string; to: string | null; lead: string | null; billed: boolean }

export const p = (ctx: Ctx, key: string) => {
  const r = ctx.people.get(key);
  if (!r) throw new Error(`Unknown person '${key}'`);
  return r;
};
export const fullName = (r: { first: string; last: string }) => `${r.first} ${r.last === 'DSouza' ? 'D’Souza' : r.last}`;
/** Working on this day (joined, not yet left) */
export const employedOn = (r: Row, key: string) => key >= r.join && (!r.lastDay || key <= r.lastDay);

// ─── Reset ──────────────────────────────────────────────────

export async function wipe(prisma: PrismaClient, companyId: string) {
  const users = `(SELECT id FROM users WHERE company_id = '${companyId}')`;
  const children: Array<[string, string]> = [
    ['role_permissions', `role_id IN (SELECT id FROM roles WHERE company_id = '${companyId}')`],
    ['leave_balance_adjustments', `balance_id IN (SELECT id FROM leave_balances WHERE company_id = '${companyId}')`],
    ['leave_approvals', `leave_request_id IN (SELECT id FROM leave_requests WHERE company_id = '${companyId}')`],
    ['leave_comments', `leave_request_id IN (SELECT id FROM leave_requests WHERE company_id = '${companyId}')`],
    ['leave_type_members', `leave_type_id IN (SELECT id FROM leave_types WHERE company_id = '${companyId}')`],
    ['leave_grant_events', `grant_id IN (SELECT id FROM leave_grants WHERE company_id = '${companyId}')`],
    ['ticket_category_helps', `category_id IN (SELECT id FROM ticket_categories WHERE company_id = '${companyId}')`],
    ['announcement_reads', `announcement_id IN (SELECT id FROM announcements WHERE company_id = '${companyId}')`],
    ['announcement_reactions', `announcement_id IN (SELECT id FROM announcements WHERE company_id = '${companyId}')`],
    ['announcement_rsvps', `announcement_id IN (SELECT id FROM announcements WHERE company_id = '${companyId}')`],
    ['kudos_thanks', `kudos_id IN (SELECT id FROM kudos WHERE company_id = '${companyId}')`],
    ['kudos_recipients', `kudos_id IN (SELECT id FROM kudos WHERE company_id = '${companyId}')`],
    ['kudos_reactions', `kudos_id IN (SELECT id FROM kudos WHERE company_id = '${companyId}')`],
    ['expense_items', `claim_id IN (SELECT id FROM expense_claims WHERE company_id = '${companyId}')`],
    ['expense_comments', `claim_id IN (SELECT id FROM expense_claims WHERE company_id = '${companyId}')`],
    ['expense_approvals', `claim_id IN (SELECT id FROM expense_claims WHERE company_id = '${companyId}')`],
    ['asset_check_answers', `check_id IN (SELECT id FROM asset_checks WHERE company_id = '${companyId}')`],
    ['user_preferences', `user_id IN ${users}`],
    ['refresh_tokens', `user_id IN ${users}`],
    ['password_reset_tokens', `user_id IN ${users}`],
    ['email_verification_tokens', `user_id IN ${users}`],
    ['notifications', `user_id IN ${users}`],
  ];
  const tables: Array<{ table_name: string }> = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'company_id' AND table_name NOT IN ('users', 'companies')`,
  );
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
      for (const [t, where] of children) await tx.$executeRawUnsafe(`DELETE FROM "${t}" WHERE ${where}`);
      for (const { table_name } of tables) await tx.$executeRawUnsafe(`DELETE FROM "${table_name}" WHERE company_id = '${companyId}'`);
      await tx.$executeRawUnsafe(`DELETE FROM users WHERE company_id = '${companyId}'`);
      await tx.$executeRawUnsafe(`DELETE FROM companies WHERE id = '${companyId}'`);
    },
    { timeout: 300_000 },
  );
  for (const root of [UPLOADS, PRIVATE]) fs.rmSync(path.join(root, companyId), { recursive: true, force: true });
}

// ─── Company + access ───────────────────────────────────────

async function grantRows(prisma: PrismaClient, grants: Array<[string, string?]>) {
  const perms = await prisma.permission.findMany({ where: { key: { in: [...new Set(grants.map((g) => g[0]))] } }, select: { id: true, key: true } });
  const id = new Map(perms.map((x) => [x.key, x.id]));
  const rows = new Map<string, { permissionId: string; scope: string | null }>();
  for (const [key, scope] of grants) {
    if (!id.has(key)) throw new Error(`Permission '${key}' missing — start the API once so permissions are synced`);
    const prev = rows.get(key)?.scope;
    rows.set(key, { permissionId: id.get(key)!, scope: prev === undefined ? (scope ?? null) : (broader(prev as never, (scope ?? null) as never) as string | null) });
  }
  return [...rows.values()];
}

export async function seedCompany(ctx: Ctx) {
  const { prisma, companyId } = ctx;
  const plan = await prisma.plan.findUnique({ where: { key: 'enterprise' } });
  await prisma.company.create({
    data: { id: companyId, name: COMPANY.name, slug: COMPANY.slug, email: COMPANY.email, status: 'ACTIVE', planId: plan?.id ?? null, createdAt: stamp('2025-09-15', 11, 5), limits: { maxEmployees: 500 } },
  });
  await prisma.companySettings.create({
    data: { companyId, employeeIdPrefix: COMPANY.prefix, employeeIdSequence: 0, timezone: 'Asia/Kolkata', fiscalYearStart: 4, workingDaysPerWeek: 5, workingHoursPerDay: 8, defaultMenuStyle: 'classic', defaultBackdropPack: 'signature', defaultBackdropLevel: 'calm' },
  });
  // Logo: a sprouting seed
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#15803D"/><path d="M32 50V30" stroke="#ECFDF5" stroke-width="4" stroke-linecap="round"/><path d="M32 32c0-9 6-15 16-15 0 10-6 15-16 15z" fill="#86EFAC"/><path d="M32 36c0-8-5-13-14-13 0 9 5 13 14 13z" fill="#ECFDF5"/><ellipse cx="32" cy="51" rx="10" ry="3" fill="#14532D" opacity=".5"/></svg>`;
  const logoDark = logo.replace('fill="#15803D"', 'fill="#052E16"');
  writeFile(UPLOADS, `${companyId}/branding/logo.svg`, logo);
  writeFile(UPLOADS, `${companyId}/branding/logo-dark.svg`, logoDark);
  await prisma.companyBranding.create({
    data: {
      companyId, displayName: COMPANY.displayName, primaryColor: COMPANY.primary, secondaryColor: COMPANY.secondary, tagline: COMPANY.tagline,
      logoUrl: `${API_URL}/uploads/${companyId}/branding/logo.svg`, logoDarkUrl: `${API_URL}/uploads/${companyId}/branding/logo-dark.svg`,
      signInMessage: 'Welcome back to SeedsAI — sign in to see your day.', signInBackground: 'pack',
    },
  });

  // Template roles (the company's own editable copies) + the extra ready-made ones as custom roles
  for (const t of ROLE_TEMPLATES) {
    const role = await prisma.role.create({
      data: { companyId, key: t.key, name: t.name, description: t.description, isOwner: Boolean(t.isOwner), isSystemRole: Boolean(t.isOwner), rolePermissions: { create: await grantRows(prisma, t.grants as never) } },
    });
    ctx.roles[t.key] = role.id;
  }
  for (const t of EXTRA_ROLE_TEMPLATES) {
    const role = await prisma.role.create({ data: { companyId, name: t.name, description: t.description, rolePermissions: { create: await grantRows(prisma, t.grants as never) } } });
    ctx.roles[t.key] = role.id;
  }

  for (const l of LOCATIONS) {
    const row = await prisma.officeLocation.create({ data: { companyId, name: l.name, address: l.address, city: l.city, state: l.state, pincode: l.pincode, isDefault: l.isDefault, createdAt: stamp('2025-09-15', 11, 20) } });
    ctx.loc[l.code] = row.id;
  }
  for (const d of DEPARTMENTS) {
    const row = await prisma.department.create({ data: { companyId, code: d.code, name: d.name, parentDepartmentId: d.parent ? ctx.dept[d.parent] : null } });
    ctx.dept[d.code] = row.id;
  }
  const level: Record<string, string> = {};
  for (const l of LEVELS) level[l.name] = (await prisma.orgLevel.create({ data: { companyId, name: l.name, rank: l.rank, color: l.color } })).id;
  for (const [name, lvl] of Object.entries(TITLES)) {
    ctx.title[name] = (await prisma.designation.create({ data: { companyId, name, orgLevelId: level[lvl], level: LEVELS.find((x) => x.name === lvl)!.rank / 10 } })).id;
  }

  await prisma.attendancePolicy.create({
    data: { companyId, workDays: [1, 2, 3, 4, 5], shiftStart: '09:30', shiftEnd: '18:30', graceMinutes: 15, halfDayMinutes: 240, fullDayMinutes: 480, regularisationWindowDays: 30, correctionAlertAt: 5, lateAlertAt: 6, autoCloseAfterMinutes: 240, optionalHolidayLimit: 2 },
  });
  ctx.shift.US = (await prisma.workShift.create({ data: { companyId, name: 'US overlap', startTime: '13:00', endTime: '22:00', color: '#2563EB' } })).id;
  ctx.shift.NIGHT = (await prisma.workShift.create({ data: { companyId, name: 'Night support', startTime: '22:00', endTime: '07:00', color: '#7C3AED' } })).id;
}

// ─── People ─────────────────────────────────────────────────

const AGE: Record<string, [number, number]> = {
  Executive: [44, 52], Director: [38, 47], 'Head of Department': [35, 46], 'Senior Manager': [34, 41], Manager: [30, 38], Lead: [29, 37],
  Senior: [27, 34], Professional: [24, 30], Associate: [22, 26], Intern: [20, 23],
};
/** Annual CTC ranges (₹) by level; interns: monthly stipend × 12 */
const PAY: Record<string, [number, number]> = {
  Executive: [8_500_000, 12_000_000], Director: [5_200_000, 6_800_000], 'Head of Department': [3_000_000, 4_600_000], 'Senior Manager': [3_000_000, 3_700_000],
  Manager: [2_200_000, 3_000_000], Lead: [2_100_000, 3_000_000], Senior: [1_450_000, 2_200_000], Professional: [850_000, 1_400_000], Associate: [520_000, 800_000], Intern: [180_000, 360_000],
};
const PROMOTED = new Set(HISTORY.filter((h) => h[1] === 'title' && h[4] === '2026-04-01').map((h) => h[0]));

function habitFor(key: string) {
  return {
    arrive: Math.round(gauss(key + 'arr') * 22), // minutes vs 09:20
    spread: 8 + rint(key + 'spr', 0, 22),
    stay: Math.round(gauss(key + 'stay') * 18) + 10,
    wfh: [0.02, 0.05, 0.08, 0.12, 0.2][rint(key + 'wfh', 0, 4)]!,
    sick: rnd(key + 'sick') * 0.8 + 0.4,
    absent: rnd(key + 'abs') < 0.15 ? 0.012 : 0.002,
  };
}

export async function seedPeople(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  // Employee numbers follow joining order (SAI001 = the founder)
  const ordered = [...PEOPLE].sort((a, b) => a.join.localeCompare(b.join) || a.key.localeCompare(b.key));
  ordered.forEach((x, i) => {
    const lvl = TITLES[x.title]!;
    const [a1, a2] = AGE[lvl]!;
    const age = rint(x.key + 'age', a1, a2);
    const dob = `${Number(today.slice(0, 4)) - age}-${String(rint(x.key + 'm', 1, 12)).padStart(2, '0')}-${String(rint(x.key + 'd', 1, 28)).padStart(2, '0')}`;
    const [c1, c2] = PAY[lvl]!;
    let ctc = Math.round((c1 + rnd(x.key + 'ctc') * (c2 - c1)) / 10_000) * 10_000;
    if (x.key === 'ceo') ctc = 12_000_000;
    const raise = PROMOTED.has(x.key) ? 0.2 + rnd(x.key + 'pr') * 0.06 : 0.06 + rnd(x.key + 'inc') * 0.08;
    const ctcBefore = x.type !== 'IN' && x.join < '2026-01-01' ? Math.round(ctc / (1 + raise) / 10_000) * 10_000 : null;
    const lastDay = x.exit?.last ?? null;
    const left = lastDay && lastDay < today;
    const sixMonths = addDays(x.join, 182);
    const probationEnd = x.key === 'e27' ? '2026-10-31' : sixMonths;
    const status: Row['status'] = left ? 'TERMINATED' : x.exit ? 'NOTICE_PERIOD' : x.onLeave ? 'ON_LEAVE' : x.type !== 'IN' && probationEnd > today ? 'PROBATION' : 'ACTIVE';
    ctx.people.set(x.key, {
      ...x, id: '', userId: '', empNo: `${COMPANY.prefix}${String(i + 1).padStart(3, '0')}`, email: mailOf(x.first, x.last), dob,
      phone: `+91 ${pick(x.key + 'ph', ['98', '99', '97', '96', '95', '91', '90', '88', '87', '81', '80', '79', '70'])}${String(hash(x.key + 'phone') % 100_000_000).padStart(8, '0')}`,
      status, lastDay, ctc, ctcBefore, habit: habitFor(x.key),
    });
  });

  // Users + employees, managers first
  const done = new Set<string>();
  const order: Row[] = [];
  const visit = (r: Row) => {
    if (done.has(r.key)) return;
    if (r.mgr) visit(p(ctx, r.mgr));
    done.add(r.key);
    order.push(r);
  };
  for (const r of ctx.people.values()) visit(r);

  for (const r of order) {
    const roleKeys = [...new Set([...(r.type === 'IN' ? [] : ['employee']), ...r.roles])];
    const recentLogin = r.status === 'TERMINATED' ? stamp(r.lastDay!, 18, 2) : stamp(addDays(today, -rint(r.key + 'll', 0, 3)), 9, rint(r.key + 'lm', 5, 55));
    const user = await prisma.user.create({
      data: {
        email: r.email, passwordHash: ctx.passwordHash, mustChangePassword: false, firstName: r.first, lastName: fullName(r).slice(r.first.length + 1), companyId,
        status: r.status === 'TERMINATED' ? 'INACTIVE' : 'ACTIVE', emailVerifiedAt: stamp(r.join < ctx.start ? '2025-09-16' : r.join, 10, 0),
        lastLoginAt: recentLogin, passwordChangedAt: stamp(r.join < ctx.start ? addDays(ctx.start, rint(r.key + 'pw', 0, 120)) : r.join, 10, 30),
        createdAt: stamp(r.join < ctx.start ? '2025-09-16' : addDays(r.join, -5), 12, 0),
        userRoles: { create: roleKeys.map((k) => ({ roleId: ctx.roles[k]!, companyId, assignedAt: stamp(r.join < ctx.start ? '2025-09-16' : r.join, 12, 5) })) },
      },
    });
    const confirmed = r.type !== 'IN' && r.status !== 'PROBATION' ? addDays(r.join, 182) : r.key === 'e27' ? '2026-10-31' : r.type !== 'IN' ? addDays(r.join, 182) : null;
    const emp = await prisma.employee.create({
      data: {
        companyId, userId: user.id, employeeId: r.empNo, firstName: r.first, lastName: user.lastName, email: r.email, phone: r.phone,
        gender: r.g === 'M' ? 'MALE' : 'FEMALE', dateOfBirth: D(r.dob), showBirthday: rnd(r.key + 'bd') < 0.7,
        employmentType: r.type === 'IN' ? 'INTERN' : r.type === 'CT' ? 'CONTRACT' : 'FULL_TIME', employmentStatus: r.status,
        departmentId: ctx.dept[r.dept], designationId: ctx.title[r.title], locationId: ctx.loc[r.loc],
        reportingManagerId: r.mgr ? p(ctx, r.mgr).id : null, reportsToPmo: Boolean(r.pool), skills: r.skills ?? [],
        shiftId: r.shift ? ctx.shift[r.shift] : null,
        joiningDate: D(r.join), confirmationDate: confirmed ? D(confirmed) : null,
        terminationDate: r.lastDay ? D(r.lastDay) : null, exitReason: r.exit?.reason ?? null,
        createdAt: user.createdAt,
      },
    });
    r.id = emp.id;
    r.userId = user.id;
  }
  await prisma.companySettings.update({ where: { companyId }, data: { employeeIdSequence: PEOPLE.length } });
  for (const [code, key] of Object.entries(HEADS)) await prisma.department.update({ where: { id: ctx.dept[code] }, data: { headEmployeeId: p(ctx, key).id } });
  await rebuildHierarchy(prisma, companyId);
  ctx.count.people = PEOPLE.length;
}

export async function rebuildHierarchy(prisma: PrismaClient, companyId: string) {
  const emps = await prisma.employee.findMany({ where: { companyId }, select: { id: true, reportingManagerId: true } });
  const mgr = new Map(emps.map((e) => [e.id, e.reportingManagerId]));
  const rows: Array<{ companyId: string; ancestorId: string; descendantId: string; depth: number }> = [];
  for (const e of emps) {
    rows.push({ companyId, ancestorId: e.id, descendantId: e.id, depth: 0 });
    const seen = new Set([e.id]);
    let cur = mgr.get(e.id);
    let depth = 1;
    while (cur) {
      if (seen.has(cur)) throw new Error('Reporting loop found');
      rows.push({ companyId, ancestorId: cur, descendantId: e.id, depth: depth++ });
      seen.add(cur);
      cur = mgr.get(cur);
    }
  }
  const depts = await prisma.department.findMany({ where: { companyId }, select: { id: true, parentDepartmentId: true } });
  const parent = new Map(depts.map((d) => [d.id, d.parentDepartmentId]));
  const drows: typeof rows = [];
  for (const d of depts) {
    drows.push({ companyId, ancestorId: d.id, descendantId: d.id, depth: 0 });
    let cur = parent.get(d.id);
    let depth = 1;
    while (cur) {
      drows.push({ companyId, ancestorId: cur, descendantId: d.id, depth: depth++ });
      cur = parent.get(cur);
    }
  }
  await prisma.employeeHierarchy.deleteMany({ where: { companyId } });
  await prisma.departmentHierarchy.deleteMany({ where: { companyId } });
  await chunked(rows, 2000, (part) => prisma.employeeHierarchy.createMany({ data: part }));
  await prisma.departmentHierarchy.createMany({ data: drows });
  await prisma.company.update({ where: { id: companyId }, data: { hierarchyVersion: { increment: 1 } } });
}

// ─── Profiles: personal, bank, statutory, documents, photos ─

const AREAS: Record<string, Array<[string, string]>> = {
  HYD: [['Gachibowli', '500032'], ['Kondapur', '500084'], ['Madhapur', '500081'], ['Kukatpally', '500072'], ['Miyapur', '500049'], ['Manikonda', '500089'], ['Banjara Hills', '500034'], ['Begumpet', '500016'], ['Tolichowki', '500008'], ['Nallagandla', '500019']],
  BLR: [['Whitefield', '560066'], ['HSR Layout', '560102'], ['Koramangala', '560034'], ['Bellandur', '560103'], ['Marathahalli', '560037'], ['Indiranagar', '560038'], ['JP Nagar', '560078'], ['Electronic City', '560100'], ['BTM Layout', '560076']],
  PUN: [['Baner', '411045'], ['Wakad', '411057'], ['Hinjewadi', '411057'], ['Kharadi', '411014'], ['Viman Nagar', '411014'], ['Aundh', '411007'], ['Kothrud', '411038'], ['Magarpatta', '411028'], ['Pimple Saudagar', '411027']],
};
const CITY = { HYD: ['Hyderabad', 'Telangana'], BLR: ['Bengaluru', 'Karnataka'], PUN: ['Pune', 'Maharashtra'] } as const;
const HOMETOWNS: Array<[string, string, string]> = [
  ['Vijayawada', 'Andhra Pradesh', '520010'], ['Warangal', 'Telangana', '506002'], ['Mysuru', 'Karnataka', '570009'], ['Mangaluru', 'Karnataka', '575001'], ['Nagpur', 'Maharashtra', '440010'],
  ['Nashik', 'Maharashtra', '422005'], ['Kochi', 'Kerala', '682016'], ['Thiruvananthapuram', 'Kerala', '695014'], ['Chennai', 'Tamil Nadu', '600040'], ['Coimbatore', 'Tamil Nadu', '641018'],
  ['Lucknow', 'Uttar Pradesh', '226010'], ['Kanpur', 'Uttar Pradesh', '208002'], ['Jaipur', 'Rajasthan', '302017'], ['Indore', 'Madhya Pradesh', '452010'], ['Bhopal', 'Madhya Pradesh', '462016'],
  ['Patna', 'Bihar', '800001'], ['Kolkata', 'West Bengal', '700029'], ['Bhubaneswar', 'Odisha', '751007'], ['Chandigarh', 'Chandigarh', '160017'], ['Ludhiana', 'Punjab', '141001'],
  ['Dehradun', 'Uttarakhand', '248001'], ['Ahmedabad', 'Gujarat', '380015'], ['Surat', 'Gujarat', '395007'], ['Visakhapatnam', 'Andhra Pradesh', '530017'], ['Guwahati', 'Assam', '781006'], ['Panaji', 'Goa', '403001'],
];
const BANKS: Array<[string, string]> = [['HDFC Bank', 'HDFC'], ['ICICI Bank', 'ICIC'], ['State Bank of India', 'SBIN'], ['Axis Bank', 'UTIB'], ['Kotak Mahindra Bank', 'KKBK'], ['IDFC FIRST Bank', 'IDFB']];
const MALE = ['Ravi', 'Suresh', 'Mohan', 'Prakash', 'Rajendra', 'Venkatesh', 'Ashok', 'Anil', 'Srinivas', 'Vijay', 'Krishna', 'Ramesh'];
const FEMALE = ['Lakshmi', 'Sunita', 'Padma', 'Geeta', 'Usha', 'Kamala', 'Saroja', 'Rekha', 'Anita', 'Meena', 'Radha', 'Shobha'];
const COLLEGES = ['JNTU Hyderabad', 'Osmania University', 'VIT Vellore', 'BITS Pilani', 'NIT Warangal', 'PES University', 'RV College of Engineering', 'College of Engineering Pune', 'Anna University', 'IIIT Hyderabad', 'Manipal Institute of Technology', 'SRM University'];
const PREV = ['Infosys', 'TCS', 'Wipro', 'Accenture', 'Cognizant', 'Tech Mahindra', 'Deloitte', 'Capgemini', 'LTIMindtree', 'Mphasis', 'ThoughtWorks', 'Freshworks', 'Zoho', 'Persistent Systems'];

const addr = (line1: string, line2: string, city: string, state: string, postalCode: string) => ({ line1, line2, city, state, postalCode, country: 'India' });
const fmtDate = (k: string) => D(k).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export async function seedProfiles(ctx: Ctx) {
  const { prisma, companyId, today } = ctx;
  const personal: object[] = [];
  const bank: object[] = [];
  const stat: object[] = [];
  const docs: object[] = [];
  const hrUser = p(ctx, 'hr1').userId;
  const photos = { M: 0, F: 0 };
  for (const r of ctx.people.values()) {
    const age = Number(today.slice(0, 4)) - Number(r.dob.slice(0, 4));
    const married = age >= 29 ? rnd(r.key + 'mar') < 0.8 : age >= 26 ? rnd(r.key + 'mar') < 0.35 : false;
    const [area, pin] = pick(r.key + 'area', AREAS[r.loc]!);
    const [city, state] = CITY[r.loc];
    const home = pick(r.key + 'home', HOMETOWNS);
    const flat = `${pick(r.key + 'blk', ['A', 'B', 'C', 'D'])}-${rint(r.key + 'flat', 101, 1408)}`;
    const society = pick(r.key + 'soc', ['Green Meadows', 'Sri Sai Residency', 'Lake View Apartments', 'Prestige Shantiniketan', 'My Home Avatar', 'Aparna Sarovar', 'Kolte Patil Life Republic', 'Brigade Lakefront', 'Sobha Dream Acres', 'Rohan Mithila', 'Vasavi Paradise', 'Purva Highland']);
    const spouse = r.g === 'M' ? pick(r.key + 'sp', FEMALE.concat(['Priya', 'Deepa', 'Swetha', 'Kavya'])) : pick(r.key + 'sp', MALE.concat(['Arun', 'Kiran', 'Manish', 'Rohit']));
    const father = rnd(r.key + 'par') < 0.6;
    const parent = `${father ? pick(r.key + 'pf', MALE) : pick(r.key + 'pm', FEMALE)} ${fullName(r).split(' ').slice(1).join(' ')}`;
    const recent = r.join >= addDays(today, -30);
    personal.push({
      companyId, employeeId: r.id,
      personalEmail: `${r.first}.${r.last}.home`.toLowerCase().replace(/[^a-z.]/g, '') + '@yopmail.com',
      bloodGroup: pick(r.key + 'bg', ['O+', 'O+', 'B+', 'B+', 'A+', 'A+', 'AB+', 'O-', 'B-', 'A-']),
      maritalStatus: married ? 'Married' : 'Single',
      currentAddress: addr(`${flat}, ${society}`, area, city, state, pin),
      permanentAddress: rnd(r.key + 'same') < 0.25 ? addr(`${flat}, ${society}`, area, city, state, pin) : addr(`${rint(r.key + 'hn', 2, 48)}-${rint(r.key + 'hn2', 1, 299)}, ${pick(r.key + 'st', ['Gandhi Nagar', 'Nehru Colony', 'Shivaji Road', 'MG Road', 'Station Road', 'Temple Street', 'Vidya Nagar', 'Saraswati Colony'])}`, home[0], home[0], home[1], home[2]),
      emergencyContactName: married ? `${spouse} ${fullName(r).split(' ').slice(1).join(' ')}` : parent,
      emergencyContactRelation: married ? 'Spouse' : father ? 'Father' : 'Mother',
      emergencyContactPhone: `+91 9${String(hash(r.key + 'ec') % 1_000_000_000).padStart(9, '0')}`,
    });
    // The two people who joined on 21 Sep haven't added bank / PAN yet
    if (!['b3', 'b4'].includes(r.key)) {
      const [bankName, code] = pick(r.key + 'bank', BANKS);
      const acct = String(10 ** 11 + (hash(r.key + 'acct') % 9 * 10 ** 11) + (hash(r.key + 'acct2') % 10 ** 11)).slice(0, code === 'SBIN' ? 11 : 12 + (hash(r.key) % 3));
      bank.push({ companyId, employeeId: r.id, accountHolderName: fullName(r).toUpperCase(), accountNumber: encryptPii(acct), accountLast4: acct.slice(-4), ifscCode: `${code}0${String(hash(r.key + 'ifsc') % 1_000_000).padStart(6, '0')}`, bankName, branchName: `${area}, ${city}` });
      const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
      const pan = `${L[hash(r.key + 'p1') % 23]}${L[hash(r.key + 'p2') % 23]}${L[hash(r.key + 'p3') % 23]}P${r.last[0]!.toUpperCase()}${String(hash(r.key + 'pn') % 10_000).padStart(4, '0')}${L[hash(r.key + 'p4') % 23]}`;
      const lowPay = r.type === 'IN' && r.ctc / 12 <= 21_000;
      stat.push({
        companyId, employeeId: r.id, pan: encryptPii(pan), aadhaarLast4: String(hash(r.key + 'aad') % 10_000).padStart(4, '0'),
        uan: r.type === 'IN' ? null : `10${String(hash(r.key + 'uan') % 10_000_000_000).padStart(10, '0')}`,
        pfAccountNo: r.type === 'IN' ? null : `TSHYD00${String(1_480_000 + 1)}000${String(hash(r.key + 'pf') % 10_000_000).padStart(7, '0')}`,
        esicNumber: lowPay ? `${String(hash(r.key + 'esi') % 10 ** 10).padStart(10, '0')}` : null,
        taxRegime: rnd(r.key + 'tax') < (r.ctc > 2_500_000 ? 0.45 : 0.15) ? 'OLD' : 'NEW',
        isPfEnabled: r.type !== 'IN', isEsiEnabled: lowPay,
      });
    }

    // Documents (PDFs on private storage)
    const add = (category: string, name: string, title: string, lines: string[], when: string) => {
      const id = uuid();
      const key = `${companyId}/documents/${r.id}/${id}.pdf`;
      const body = pdf(title, lines);
      writeFile(PRIVATE, key, body);
      docs.push({ id, companyId, employeeId: r.id, category, name, fileName: `${name.replace(/[^\w ]+/g, '').replace(/ +/g, '_')}.pdf`, mimeType: 'application/pdf', sizeBytes: body.length, storageKey: key, uploadedById: hrUser, createdAt: stamp(when < ctx.start ? ctx.start : when, 11, rint(r.key + name, 0, 59)) });
    };
    const ctcLine = r.type === 'IN' ? `Monthly stipend: Rs. ${(r.ctc / 12).toLocaleString('en-IN')}` : `Annual CTC: Rs. ${(r.ctcBefore ?? r.ctc).toLocaleString('en-IN')}`;
    add(r.type === 'IN' ? 'OFFER_LETTER' : 'OFFER_LETTER', r.type === 'IN' ? 'Internship offer letter' : 'Offer letter', 'SeedsAI Technologies Pvt. Ltd.', [
      fmtDate(addDays(r.join, -21)), '', `Dear ${fullName(r)},`, '', `We are pleased to offer you the position of ${r.title}`, `in our ${r.dept === 'DEL' ? 'Delivery' : r.dept} team at our ${LOCATIONS.find((l) => l.code === r.loc)!.name}.`,
      `Your date of joining will be ${fmtDate(r.join)}.`, ctcLine, '', 'Please sign and return a copy of this letter to confirm your acceptance.', '', 'Kavitha Reddy', 'HR Manager, SeedsAI Technologies',
    ], r.join);
    if (!recent || rnd(r.key + 'docr') < 0.5) add('ID_PROOF', 'PAN card', 'Permanent Account Number Card', ['Income Tax Department, Govt. of India', '', `Name: ${fullName(r).toUpperCase()}`, `Date of birth: ${fmtDate(r.dob)}`, '', '(Scanned copy — sample data for testing)'], r.join);
    if (!recent) add('ADDRESS_PROOF', 'Aadhaar card (masked)', 'Aadhaar — masked copy', [`Name: ${fullName(r)}`, `Aadhaar: XXXX XXXX ${String(hash(r.key + 'aad') % 10_000).padStart(4, '0')}`, `Address: ${flat}, ${society}, ${area}, ${city}`, '', '(Sample data for testing)'], r.join);
    const college = pick(r.key + 'col', COLLEGES);
    if (r.type === 'IN') add('EDUCATION', 'College ID card', `${college}`, [`Student: ${fullName(r)}`, `Programme: ${pick(r.key + 'deg', ['B.Tech Computer Science', 'B.E. Information Technology', 'B.Des Interaction Design', 'MBA (HR)', 'B.Com (Hons)', 'M.Sc Cyber Security'])}`, `Valid till: June ${Number(today.slice(0, 4)) + 1}`], r.join);
    else if (!recent) add('EDUCATION', 'Degree certificate', college, ['This is to certify that', fullName(r), `has been awarded the degree of ${pick(r.key + 'deg', ['Bachelor of Technology', 'Bachelor of Engineering', 'Master of Computer Applications', 'Master of Business Administration', 'Bachelor of Design', 'Master of Technology'])}`, `in the year ${Number(r.dob.slice(0, 4)) + 22}.`], r.join);
    const level = TITLES[r.title]!;
    if (r.type !== 'IN' && !['Associate'].includes(level) && !recent) add('EMPLOYMENT', 'Relieving letter — previous employer', `${pick(r.key + 'prev', PREV)} — Relieving letter`, [`${fullName(r)} worked with us until ${fmtDate(addDays(r.join, -rint(r.key + 'gap', 3, 30)))}.`, 'All dues have been settled. We wish them the very best.'], r.join);
    if (r.type === 'CT') add('CONTRACT', 'Contract — Coreforce Staffing', 'Contractor agreement', [`Contractor: ${fullName(r)}`, `Through: Coreforce Staffing Solutions LLP`, `Term: ${fmtDate(r.join)} to ${fmtDate(addDays(r.join, 364))} (renewable)`], r.join);
    if (PROMOTED.has(r.key)) add('OTHER', 'Promotion letter — April 2026', 'Promotion letter', [`Dear ${r.first},`, `Congratulations! Effective 1 April 2026 you are promoted to ${r.title}.`, `Revised annual CTC: Rs. ${r.ctc.toLocaleString('en-IN')}`], '2026-04-01');

    // Photo: two newest joiners haven't uploaded one (shows initials)
    if (!['b3', 'b4', 'hr8'].includes(r.key)) {
      const n = photos[r.g]++;
      const src = path.join(__dirname, '..', 'seed-assets', 'seedsai-photos', `${r.g === 'M' ? 'men' : 'women'}-${n % 80}.jpg`);
      if (fs.existsSync(src)) {
        const key = `${companyId}/avatars/${r.id}.jpg`;
        writeFile(UPLOADS, key, fs.readFileSync(src));
        const url = `${API_URL}/uploads/${key}`;
        await prisma.employee.update({ where: { id: r.id }, data: { avatarUrl: url } });
        await prisma.user.update({ where: { id: r.userId }, data: { avatarUrl: url } });
      }
    }
  }
  await prisma.employeePersonal.createMany({ data: personal as never });
  await prisma.employeeBankDetails.createMany({ data: bank as never });
  await prisma.employeeStatutory.createMany({ data: stat as never });
  await prisma.employeeDocument.createMany({ data: docs as never });
  ctx.count.documents = docs.length;
}

// ─── Salary structures, employment history, checklists ─────

export function salaryParts(ctc: number, intern: boolean) {
  const monthly = ctc / 12;
  if (intern) return { basicSalary: Math.round(monthly), hra: 0, specialAllowance: 0, otherAllowances: 0 };
  const employerPf = Math.min(0.4 * monthly, 15_000) * 0.12;
  const gross = monthly - employerPf;
  const basic = Math.round(0.4 * monthly);
  const hra = Math.round(basic * 0.5);
  const other = 1_600 + 1_250; // conveyance + medical
  return { basicSalary: basic, hra, specialAllowance: Math.round(gross - basic - hra - other), otherAllowances: other };
}

export async function seedCareer(ctx: Ctx) {
  const { prisma, companyId, today, start } = ctx;
  const hr = p(ctx, 'hrm').userId;
  const salaries: object[] = [];
  const events: object[] = [];
  const checklist: object[] = [];
  const name = (k: string) => fullName(p(ctx, k));
  for (const r of ctx.people.values()) {
    const intern = r.type === 'IN';
    if (r.ctcBefore) {
      salaries.push({ companyId, employeeId: r.id, ctc: r.ctcBefore, ...salaryParts(r.ctcBefore, false), effectiveFrom: D(r.join < '2025-04-01' ? '2025-04-01' : r.join), effectiveTo: D('2026-03-31'), createdBy: hr, createdAt: stamp(r.join < '2025-04-01' ? start : r.join, 10) });
      salaries.push({ companyId, employeeId: r.id, ctc: r.ctc, ...salaryParts(r.ctc, false), effectiveFrom: D('2026-04-01'), effectiveTo: r.lastDay && r.lastDay < today ? D(r.lastDay) : null, createdBy: hr, createdAt: stamp('2026-03-27', 16, 40) });
    } else {
      salaries.push({ companyId, employeeId: r.id, ctc: r.ctc, ...salaryParts(r.ctc, intern), effectiveFrom: D(r.join), effectiveTo: r.lastDay && r.lastDay < today ? D(r.lastDay) : null, createdBy: hr, createdAt: stamp(r.join < start ? start : r.join, 10) });
    }

    // History
    const ev = (kind: string, from: string | null, to: string | null, on: string, note: string | null = null, actor: string | null = hr) =>
      events.push({ companyId, employeeId: r.id, kind, fromLabel: from, toLabel: to, effectiveOn: D(on), note, actorUserId: actor, createdAt: stamp(on < start ? start : on, 10, rint(r.key + kind, 0, 59)) });
    const firstTitle = HISTORY.find((h) => h[0] === r.key && h[1] === 'title')?.[2] ?? r.title;
    ev('joined', null, firstTitle, r.join, null, r.join < start ? null : p(ctx, 'hr6').join <= r.join ? p(ctx, 'hr6').userId : hr);
    const confirmOn = addDays(r.join, 182);
    if (!intern && r.key !== 'e27' && confirmOn <= today && confirmOn >= start) ev('confirmed', fmtDate(confirmOn), null, confirmOn, 'Probation completed');
    for (const [k, kind, from, to, on, actor, note] of HISTORY) if (k === r.key) ev(kind, from, to, on, note ?? null, p(ctx, actor).userId);
    if (r.exit) {
      ev('notice', null, 'Resigned', r.exit.last, pick(r.key + 'why', ['Moving to a product company', 'Relocating to be closer to family', 'Pursuing higher studies (MS)', 'Better opportunity']), hr);
      if (r.lastDay! < today) ev('left', null, 'Resigned', r.exit.last, null, hr);
    }

    // Checklists: recent joiners (joining) and leavers (exit)
    const joinedRecently = r.join >= addDays(today, -60);
    if (joinedRecently) {
      const items = ['Laptop and accessories ready', 'Work email and tool access set up', 'Desk or seat assigned', 'Buddy assigned', 'ID and address proof collected', 'Bank details and PAN added', 'First-week plan shared by the manager'];
      items.forEach((label, i) => {
        const doneish = r.join <= addDays(today, -21) ? i !== 4 || rnd(r.key + 'cl') < 0.5 : i < 3 || (i === 3 && rnd(r.key + 'cl3') < 0.5);
        const missingBank = ['b3', 'b4'].includes(r.key) && i === 5;
        checklist.push({ companyId, employeeId: r.id, kind: 'joining', label, sortOrder: i, doneAt: doneish && !missingBank ? stamp(addDays(r.join, i < 3 ? -1 : rint(r.key + i, 0, 6)), 11) : null, doneByUserId: doneish && !missingBank ? (i < 2 ? p(ctx, 'it1').userId : hr) : null, createdAt: stamp(addDays(r.join, -7), 10) });
      });
    }
    if (r.exit) {
      const items = ['Resignation or exit letter on file', 'Handover plan agreed with the manager', 'Company assets returned', 'Email and tool access removed on the last day', 'Final settlement sent to payroll', 'Exit interview done'];
      const left = r.lastDay! < today;
      items.forEach((label, i) => {
        const done = left || i < 2;
        checklist.push({ companyId, employeeId: r.id, kind: 'exit', label, sortOrder: i, doneAt: done ? stamp(left ? addDays(r.exit!.last, i < 2 ? -40 : i - 2) : addDays(r.exit!.notice, 3 + i), 15) : null, doneByUserId: done ? (i === 2 || i === 3 ? p(ctx, 'it1').userId : hr) : null, createdAt: stamp(addDays(r.exit!.notice, 1), 10) });
      });
    }
  }
  // Notice withdrawn once (Sachin resigned in March, stayed after a counter-offer)
  const sachin = p(ctx, 'e19');
  events.push(
    { companyId, employeeId: sachin.id, kind: 'notice', fromLabel: null, toLabel: 'Resigned', effectiveOn: D('2026-05-08'), note: 'Offer from a fintech startup', actorUserId: hr, createdAt: stamp('2026-03-09', 12) },
    { companyId, employeeId: sachin.id, kind: 'notice_withdrawn', fromLabel: null, toLabel: null, effectiveOn: null, note: `Stayed after a talk with ${name('pm2')} — moved to the payments squad`, actorUserId: hr, createdAt: stamp('2026-03-20', 17, 10) },
  );
  await prisma.employeeSalary.createMany({ data: salaries as never });
  await chunked(events, 500, (part) => prisma.employeeEvent.createMany({ data: part as never }));
  await prisma.employeeChecklistItem.createMany({ data: checklist as never });
  ctx.count.salaryRows = salaries.length;
  ctx.count.historyEvents = events.length;
}

export { K };
