import type { BackdropLevel, BackdropPack, CompanyPersonalization } from '@hrms/types';
import type { UserPreferences } from '@/lib/company/queries';

// ============================================================
// Page backgrounds ("backdrops"): one living background per page
// family. A pack is a full set of moods; the level says how lively
// it is. Styles live in app/backdrops.css.
// ============================================================

export type BackdropMood =
  | 'base'
  | 'aurora'
  | 'constellation'
  | 'sweep'
  | 'horizon'
  | 'blueprint'
  | 'mesh'
  | 'studio'
  | 'rings'
  | 'floaters'
  | 'waves'
  | 'quiet'
  | 'pulse'
  | 'hero';

export const BACKDROP_PACK_INFO: Record<BackdropPack, { label: string; text: string }> = {
  signature: { label: 'Signature', text: 'Soft light and colour — a different mood for every section' },
  terra: { label: 'Terra', text: 'Nature — a real-time sky, fireflies, contour maps, a lighthouse' },
  prism: { label: 'Prism', text: 'Geometry — light beams, Bauhaus shapes, radar, equaliser' },
  simple: { label: 'Simple', text: 'Plain background, nothing moves — like before' },
};

export const BACKDROP_LEVEL_INFO: Record<BackdropLevel, { label: string; text: string }> = {
  lively: { label: 'Lively', text: 'Gently moving backgrounds' },
  calm: { label: 'Calm', text: 'Same look, nothing moves' },
  off: { label: 'Off', text: 'Plain background' },
};

/** Company-app routes → mood. First match wins; `/app` itself is Home. */
const ROUTES: Array<[RegExp, BackdropMood]> = [
  [/^\/app\/?$/, 'aurora'],
  [/^\/app\/(profile|people|employees|org)(\/|$)/, 'constellation'],
  [/^\/app\/attendance\/holidays(\/|$)/, 'horizon'],
  [/^\/app\/(attendance|timesheets)(\/|$)/, 'sweep'],
  [/^\/app\/leave(\/|$)/, 'horizon'],
  [/^\/app\/projects(\/|$)/, 'blueprint'],
  [/^\/app\/expenses(\/|$)/, 'mesh'],
  [/^\/app\/assets(\/|$)/, 'studio'],
  [/^\/app\/helpdesk(\/|$)/, 'rings'],
  [/^\/app\/(announcements|kudos)(\/|$)/, 'floaters'],
  [/^\/app\/reports(\/|$)/, 'waves'],
  [/^\/app\/(settings|users|roles|access-explorer|delegations)(\/|$)/, 'quiet'],
];

export function moodForPath(pathname: string): BackdropMood {
  if (pathname.startsWith('/super-admin')) return 'pulse';
  return ROUTES.find(([re]) => re.test(pathname))?.[1] ?? 'base';
}

/** The person's pick, else the company default, else Signature / Lively. Reduce motion makes Lively calm. */
export function effectiveBackdrop(prefs: UserPreferences | undefined, rules: CompanyPersonalization | undefined): { pack: BackdropPack; level: BackdropLevel } {
  const pack = prefs?.backdropPack ?? rules?.defaultBackdropPack ?? 'signature';
  let level = prefs?.backdropLevel ?? rules?.defaultBackdropLevel ?? 'lively';
  if (level === 'lively' && prefs?.reduceMotion) level = 'calm';
  return { pack: pack in BACKDROP_PACK_INFO ? pack : 'signature', level };
}
