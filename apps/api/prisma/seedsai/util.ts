/* Shared helpers for the SeedsAI seed: stable randomness, dates in IST, files. */
import { createCipheriv, randomBytes, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const TZ = 'Asia/Kolkata';

// ─── Stable randomness ──────────────────────────────────────
/** FNV-1a hash of a string → 32-bit unsigned */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** 0..1, the same for the same seed on every run */
export function rnd(seed: string): number {
  // mulberry32 step on the hash so nearby seeds don't correlate
  let t = (hash(seed) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rint = (seed: string, min: number, max: number) => min + Math.floor(rnd(seed) * (max - min + 1));
export const pick = <T>(seed: string, xs: readonly T[]): T => xs[Math.floor(rnd(seed) * xs.length)]!;
/** Roughly normal (sum of 3 uniforms), mean 0, sd ≈ 1 */
export const gauss = (seed: string) => (rnd(seed + 'a') + rnd(seed + 'b') + rnd(seed + 'c') - 1.5) * 2;
export function shuffle<T>(seed: string, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(`${seed}:${i}`) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ─── Dates (keys are YYYY-MM-DD, wall-clock in IST) ─────────
export const D = (key: string) => new Date(`${key}T00:00:00Z`);
export const K = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(key: string, n: number): string {
  const d = D(key);
  d.setUTCDate(d.getUTCDate() + n);
  return K(d);
}
export const weekday = (key: string) => D(key).getUTCDay();
export function daysBetween(a: string, b: string): number {
  return Math.round((D(b).getTime() - D(a).getTime()) / 86_400_000);
}
export function* eachDay(from: string, to: string) {
  for (let k = from; k <= to; k = addDays(k, 1)) yield k;
}
export const mondayOf = (key: string) => addDays(key, -((weekday(key) + 6) % 7));
/** IST is a fixed +05:30 (no DST) */
export function at(key: string, minutes: number): Date {
  return new Date(D(key).getTime() + (minutes - 330) * 60_000);
}
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export function nowMinutesIST(): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return +p.hour! * 60 + +p.minute!;
}
/** A moment on a day, e.g. stamp('2026-03-04', 11, 20) */
export const stamp = (key: string, h: number, m = 0) => at(key, h * 60 + m);

// ─── PII encryption (same format as PiiCryptoService) ───────
export function encryptPii(plain: string): string {
  const key = Buffer.from(process.env.PII_ENCRYPTION_KEY ?? '', 'base64');
  if (key.length !== 32) throw new Error('PII_ENCRYPTION_KEY must be set (32 bytes, base64)');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}

// ─── Files ──────────────────────────────────────────────────
export const API_ROOT = path.resolve(__dirname, '..', '..');
export const UPLOADS = path.resolve(API_ROOT, process.env.UPLOADS_DIR || 'uploads');
export const PRIVATE = path.resolve(API_ROOT, process.env.PRIVATE_FILES_DIR || 'private-files');
export const API_URL = (process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');

export function writeFile(root: string, key: string, body: Buffer | string) {
  const file = path.join(root, key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

/** A one-page PDF with a heading and lines of text (Helvetica, no dependencies). */
export function pdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7E]/g, '-');
  const body = [
    'BT /F2 18 Tf 56 780 Td (' + esc(title) + ') Tj ET',
    '0.85 0.85 0.85 RG 56 768 m 539 768 l S',
    ...lines.map((l, i) => `BT /F1 11 Tf 56 ${740 - i * 18} Td (${esc(l)}) Tj ET`),
  ].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

export const uuid = () => randomUUID();

/** Insert in chunks (createMany has a parameter limit) */
export async function chunked<T>(rows: T[], size: number, fn: (part: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

export const inr = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
