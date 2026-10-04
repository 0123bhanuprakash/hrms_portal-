/* eslint-disable */
// ============================================================
// Illustrated profile pictures for a demo company (development only).
//
//   node prisma/seed-demo-avatars.cjs <company-slug>
//   (or: pnpm --filter @hrms/api db:seed-demo-avatars -- <company-slug>)
//
// Draws a simple portrait (SVG) for every employee WITHOUT a photo,
// saves it under uploads/<companyId>/avatars/ and links it to the
// employee and their user. Same name → same picture. People who
// uploaded a real photo are left alone. Local disk storage only.
// ============================================================
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const slug = process.argv[2];
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const UPLOADS = path.resolve(process.env.UPLOADS_DIR || 'uploads');

const SKIN = ['#F1C7A5', '#E8B48F', '#D9A07A', '#C98F67', '#B97B55', '#A86E48', '#8D5A3B'];
const HAIR = ['#16100C', '#2B1B14', '#3A2618', '#4A2A18', '#6B3E22', '#1C1410', '#0F0B08'];
const SHIRT = ['#B7791F', '#2C7A7B', '#2F5BAA', '#7A4E9E', '#B42318', '#157A4B', '#9E3B5C', '#4A4A52', '#C2560C'];
const BG = ['#F6D9C8', '#CFE6E3', '#E8DDF5', '#DCE6F7', '#F7E3C9', '#E2EAD9', '#F3D6DE', '#D9E2EC', '#FBEBC8'];

function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
const pick = (arr, h, shift) => arr[(h >>> shift) % arr.length];

/** A friendly portrait; `long` hair for some people, glasses for a few. */
function portrait(name, gender) {
  const h = hash(name);
  const skin = pick(SKIN, h, 0);
  const hair = pick(HAIR, h, 3);
  const shirt = pick(SHIRT, h, 6);
  const bg = pick(BG, h, 9);
  const long = gender === 'FEMALE' || (gender == null && (h >>> 12) % 2 === 0);
  const glasses = (h >>> 15) % 5 === 0;
  const smile = (h >>> 18) % 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<rect width="128" height="128" fill="${bg}"/>
${long ? `<path d="M30 70c0-30 14-46 34-46s34 16 34 46v34H30z" fill="${hair}"/>` : ''}
<path d="M16 128c4-24 22-36 48-36s44 12 48 36z" fill="${shirt}"/>
<path d="M50 96l14 12 14-12" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
<rect x="54" y="76" width="20" height="20" rx="8" fill="${skin}"/>
<ellipse cx="64" cy="58" rx="22" ry="25" fill="${skin}"/>
<path d="M40 54c0-18 10-28 24-28s24 10 24 28c-6-10-14-14-24-14s-18 4-24 14z" fill="${hair}"/>
<circle cx="56" cy="60" r="2.6" fill="#2A1A12"/><circle cx="72" cy="60" r="2.6" fill="#2A1A12"/>
${glasses ? '<g fill="none" stroke="#2A1A12" stroke-width="2"><circle cx="56" cy="60" r="7"/><circle cx="72" cy="60" r="7"/><path d="M63 60h2"/></g>' : ''}
<path d="${smile === 0 ? 'M57 71q7 6 14 0' : smile === 1 ? 'M58 71q6 4 12 0' : 'M56 70q8 8 16 0'}" stroke="#7A3E2A" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</svg>
`;
}

(async () => {
  if (!slug) throw new Error('Usage: node prisma/seed-demo-avatars.cjs <company-slug>');
  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) throw new Error(`No company with slug ${slug}`);
  const people = await prisma.employee.findMany({ where: { companyId: company.id, avatarUrl: null }, select: { id: true, userId: true, firstName: true, lastName: true, gender: true } });
  const dir = path.join(UPLOADS, company.id, 'avatars');
  fs.mkdirSync(dir, { recursive: true });
  for (const e of people) {
    const file = `demo-${e.id}.svg`;
    fs.writeFileSync(path.join(dir, file), portrait(`${e.firstName} ${e.lastName}`, e.gender));
    const url = `${API_URL}/uploads/${company.id}/avatars/${file}`;
    await prisma.employee.update({ where: { id: e.id }, data: { avatarUrl: url } });
    if (e.userId) await prisma.user.update({ where: { id: e.userId }, data: { avatarUrl: url } });
  }
  console.log(`Drew ${people.length} profile picture(s) for ${company.name}.`);
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
