'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Cake, Award, Sparkles, CloudRain, Snowflake, Sunset, Building2 } from 'lucide-react';
import { useReducedMotion } from '@/components/motion/motion';
import { useUiState } from '@/lib/preferences/ui-state';
import type { Spotlight } from '@/lib/company/profile';

// ============================================================
// Atmosphere moments in the hero. One wins, by priority:
//   1. your birthday / work anniversary
//   2. a company holiday or festival (from the company's holiday list)
//   3. the season (monsoon, Jun – Sep)
//   4. Friday afternoon
//   5. office lights (people who look after the company)
//   default: the sky by time of day
// The full animation plays once a day, then settles into a calm loop.
// People can switch moments off in Preferences; admins can set the default.
// ============================================================

export const MOMENT_KINDS = ['birthday', 'anniversary', 'diwali', 'holi', 'christmas', 'newyear', 'monsoon', 'friday', 'office'] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

/** Groups people can switch off (Preferences → Moments). */
export const MOMENT_GROUPS: Array<{ key: string; label: string; kinds: MomentKind[] }> = [
  { key: 'personal', label: 'Your birthday and work anniversary', kinds: ['birthday', 'anniversary'] },
  { key: 'festivals', label: 'Festivals and holidays (Diwali, Holi, Christmas, New Year)', kinds: ['diwali', 'holi', 'christmas', 'newyear'] },
  { key: 'season', label: 'Monsoon rain (June – September)', kinds: ['monsoon'] },
  { key: 'friday', label: 'Friday wind-down', kinds: ['friday'] },
  { key: 'office', label: 'Office lights (who’s in, for admins)', kinds: ['office'] },
];

export interface Moment {
  kind: MomentKind;
  /** Sky override (CSS data-part) */
  sky?: string;
  pill: string;
  icon: React.ReactNode;
  /** Office lights: how many of how many are in */
  lit?: { present: number; total: number };
}

const isGroupList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** The groups this person has switched off (saved on their account; company default first). */
export function useMomentsOff(): [string[], (v: string[]) => void] {
  return useUiState<string[]>('moments:off', [], isGroupList);
}

const ICONS: Record<MomentKind, React.ReactNode> = {
  birthday: <Cake />,
  anniversary: <Award />,
  diwali: <Sparkles />,
  holi: <Sparkles />,
  christmas: <Snowflake />,
  newyear: <Sparkles />,
  monsoon: <CloudRain />,
  friday: <Sunset />,
  office: <Building2 />,
};

/** Which moment (if any) the hero shows right now. `?moment=diwali` previews one. */
export function useMoment(opts: {
  spotlight?: Spotlight;
  myEmployeeId?: string;
  firstName?: string;
  companyName?: string;
  shiftEnd?: string;
  office?: { present: number; total: number };
}): Moment | null {
  const [off] = useMomentsOff();
  const [preview, setPreview] = useState<MomentKind | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('moment');
    setPreview(p && (MOMENT_KINDS as readonly string[]).includes(p) ? (p as MomentKind) : null);
  }, []);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => {
    const disabled = new Set(MOMENT_GROUPS.filter((g) => off.includes(g.key)).flatMap((g) => g.kinds));
    const make = (kind: MomentKind, pill: string, extra: Partial<Moment> = {}): Moment => ({ kind, pill, icon: ICONS[kind], ...extra });
    const name = opts.firstName ?? '';
    const sp = opts.spotlight;

    const candidates: Array<Moment | null> = [];
    // 1 · personal
    const myAnniv = sp?.anniversaries.find((a) => a.id === opts.myEmployeeId && a.inDays === 0);
    if (sp?.birthdays.some((b) => b.id === opts.myEmployeeId && b.inDays === 0) || preview === 'birthday') candidates.push(make('birthday', `Happy birthday, ${name}! From everyone at ${opts.companyName ?? 'work'}`, { sky: 'birthday' }));
    if (myAnniv || preview === 'anniversary') candidates.push(make('anniversary', `${myAnniv?.years ?? 3} year${(myAnniv?.years ?? 3) === 1 ? '' : 's'} with us today — thank you, ${name}`, { sky: 'night' }));
    // 2 · festivals: the holiday itself and the two days before it
    const soon = (re: RegExp) => sp?.holidays.find((h) => re.test(h.name) && Math.round((new Date(h.date).getTime() - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000) <= 2);
    const festival = (kind: MomentKind, re: RegExp, pill: (h: string) => string, sky: string) => {
      const h = soon(re);
      if (h || preview === kind) candidates.push(make(kind, pill(h?.name ?? ''), { sky }));
    };
    festival('diwali', /diwali|deepavali/i, () => 'Happy Diwali — wishing you light and joy', 'diwali');
    festival('holi', /\bholi\b/i, () => 'Happy Holi!', 'holi');
    festival('christmas', /christmas/i, () => 'Season’s greetings', 'snow');
    const m = now.getMonth();
    const d = now.getDate();
    if ((m === 11 && d === 31) || (m === 0 && d === 1) || preview === 'newyear') candidates.push(make('newyear', m === 0 ? 'Happy New Year!' : 'See you next year!', { sky: 'night' }));
    // 3 · season
    if ((m >= 5 && m <= 8) || preview === 'monsoon') candidates.push(make('monsoon', 'Monsoon mode — drive safe', { sky: 'rain' }));
    // 4 · Friday afternoon
    if ((now.getDay() === 5 && now.getHours() >= 14) || preview === 'friday') {
      const [eh, em] = (opts.shiftEnd ?? '18:30').split(':').map(Number);
      const left = (eh ?? 18) * 60 + (em ?? 30) - (now.getHours() * 60 + now.getMinutes());
      candidates.push(make('friday', left > 0 ? `Weekend in ${Math.floor(left / 60)}h ${String(left % 60).padStart(2, '0')}m` : 'Have a great weekend!', { sky: 'evening' }));
    }
    // 5 · office lights
    if (opts.office && opts.office.total > 0) candidates.push(make('office', `${opts.office.present} of ${opts.office.total} are in`, { lit: opts.office }));
    if (preview === 'office' && !opts.office) candidates.push(make('office', '9 of 13 are in', { lit: { present: 9, total: 13 } }));

    const shown = candidates.filter((c): c is Moment => Boolean(c) && (c!.kind === preview || !disabled.has(c!.kind)));
    return (preview && shown.find((c) => c.kind === preview)) || shown[0] || null;
  }, [opts.spotlight, opts.myEmployeeId, opts.firstName, opts.companyName, opts.shiftEnd, opts.office, off, preview, now]);
}

const COLORS = ['#E9416A', '#F2B65A', '#5FD39B', '#5EB8B0', '#B07CF0', '#FF8A5C'];

/** The decoration for a moment (behind the hero text). The first view each day is the full show. */
export function MomentLayer({ moment }: { moment: Moment }) {
  const reduced = useReducedMotion();
  const [full, setFull] = useState(false);
  useEffect(() => {
    const key = `moment-${moment.kind}-${new Date().toDateString()}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      /* storage unavailable: calm version */
      return;
    }
    setFull(true);
    const t = setTimeout(() => setFull(false), 12_000);
    return () => clearTimeout(t);
  }, [moment.kind]);
  if (reduced) return null;
  const n = (calm: number, show: number) => (full ? show : calm);

  switch (moment.kind) {
    case 'birthday':
      return (
        <div className="m-layer" aria-hidden>
          {Array.from({ length: n(5, 12) }, (_, i) => (
            <i key={i} className="m-balloon" style={{ left: `${6 + ((i * 41) % 88)}%`, background: COLORS[i % COLORS.length], animationDelay: `${((i * 0.9) % 7).toFixed(1)}s`, animationDuration: `${(full ? 6 : 10) + (i % 3)}s` }} />
          ))}
        </div>
      );
    case 'anniversary':
    case 'newyear':
      return (
        <div className="m-layer" aria-hidden>
          {Array.from({ length: n(2, 4) }, (_, k) => (
            <span key={k} className="m-firework" style={{ left: `${45 + k * 14}%`, top: `${18 + (k % 2) * 22}%`, animationDelay: `${k * 0.7}s`, animationDuration: full ? '2.2s' : '3.6s' }}>
              {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 30}deg`, background: ['#F2B65A', '#FFE3A8', '#FF8A5C', '#E9416A'][(i + k) % 4], animationDelay: 'inherit', animationDuration: 'inherit' }} />)}
            </span>
          ))}
        </div>
      );
    case 'diwali':
      return (
        <div className="m-layer" aria-hidden>
          {Array.from({ length: 18 }, (_, i) => <i key={i} className="m-bulb" style={{ left: `${i * 5.6}%`, top: `${8 + Math.sin(i / 2.4) * 6}%`, background: ['#FFD27A', '#FF8A5C', '#E9416A', '#5FD39B'][i % 4], color: ['#FFD27A', '#FF8A5C', '#E9416A', '#5FD39B'][i % 4], animationDelay: `${(i % 4) * 0.25}s` }} />)}
          {Array.from({ length: 5 }, (_, i) => <span key={i} className="m-diya" style={{ right: `${4 + i * 7}%`, animationDelay: `${i * 0.3}s` }}><b /></span>)}
        </div>
      );
    case 'holi':
      return (
        <div className="m-layer" aria-hidden>
          {Array.from({ length: n(5, 9) }, (_, i) => <i key={i} className="m-puff" style={{ left: `${40 + ((i * 23) % 55)}%`, top: `${15 + ((i * 37) % 60)}%`, background: ['#E9416A', '#F2B65A', '#5FD39B', '#2F9BEA', '#B07CF0'][i % 5], animationDelay: `${(i * 0.55).toFixed(2)}s` }} />)}
        </div>
      );
    case 'christmas':
      return (
        <div className="m-layer" aria-hidden>
          {Array.from({ length: n(25, 45) }, (_, i) => <i key={i} className="m-snow" style={{ left: `${(i * 37) % 100}%`, width: 2 + (i % 3), height: 2 + (i % 3), animationDelay: `${((i * 0.41) % 7).toFixed(2)}s`, animationDuration: `${6 + (i % 5)}s` }} />)}
        </div>
      );
    case 'monsoon':
      return (
        <div className="m-layer" aria-hidden>
          {Array.from({ length: n(30, 55) }, (_, i) => <i key={i} className="m-rain" style={{ left: `${(i * 29) % 100}%`, animationDelay: `${((i * 0.13) % 1.2).toFixed(2)}s` }} />)}
        </div>
      );
    case 'office': {
      const lit = moment.lit!;
      const windows = Math.min(24, Math.max(6, lit.total));
      const on = Math.round((lit.present / Math.max(1, lit.total)) * windows);
      return (
        <div className="m-layer" aria-hidden>
          <div className="m-building">
            {Array.from({ length: windows }, (_, i) => <i key={i} className={i < on ? 'on' : undefined} style={{ animationDelay: `${(i * 0.15).toFixed(2)}s` }} />)}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
