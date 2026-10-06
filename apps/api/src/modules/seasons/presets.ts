// Ready-made national seasons. Fixed festivals use month-day; moving ones
// (Holi, Eid, Ganesh Chaturthi, Navratri, Diwali) have their dates per year,
// in line with the INDIA holiday preset.

export type Decoration =
  | 'fireworks'
  | 'kites'
  | 'ribbon'
  | 'splash'
  | 'lanterns'
  | 'marigold'
  | 'dandiya'
  | 'diyas'
  | 'snow'
  | 'sparkles'
  | 'petals'
  | 'confetti'
  | 'none';

export const DECORATIONS: Decoration[] = ['fireworks', 'kites', 'ribbon', 'splash', 'lanterns', 'marigold', 'dandiya', 'diyas', 'snow', 'sparkles', 'petals', 'confetti', 'none'];

export interface SeasonPreset {
  key: string;
  name: string;
  emoji: string;
  colors: { main: string; accent: string; deep: string };
  decoration: Decoration;
  greeting: string;
  /** Holiday-list names that suggest this season */
  matches: string[];
  /** Fixed dates: [startMMDD, endMMDD] (end may be in the next year) */
  fixed?: [string, string];
  /** Moving dates per year: [startYYYY-MM-DD, endYYYY-MM-DD] */
  byYear?: Record<number, [string, string]>;
}

export const SEASON_PRESETS: SeasonPreset[] = [
  {
    key: 'new_year',
    name: 'New Year',
    emoji: '🎆',
    colors: { main: '#5B3DF5', accent: '#E8458B', deep: '#0B0726' },
    decoration: 'fireworks',
    greeting: 'Happy New Year! Thank you for a wonderful year together ✨',
    matches: ['new year'],
    fixed: ['12-31', '01-01'],
  },
  {
    key: 'sankranti',
    name: 'Sankranti · Pongal · Lohri',
    emoji: '🪁',
    colors: { main: '#F59E0B', accent: '#0EA5E9', deep: '#14532D' },
    decoration: 'kites',
    greeting: 'Happy Sankranti, Pongal and Lohri — may the year fly high 🪁',
    matches: ['sankranti', 'pongal', 'lohri'],
    fixed: ['01-13', '01-15'],
  },
  {
    key: 'republic_day',
    name: 'Republic Day',
    emoji: '🎖️',
    colors: { main: '#EA580C', accent: '#16A34A', deep: '#1E3A8A' },
    decoration: 'ribbon',
    greeting: 'Happy Republic Day 🎖️',
    matches: ['republic day'],
    fixed: ['01-26', '01-26'],
  },
  {
    key: 'holi',
    name: 'Holi',
    emoji: '🌸',
    colors: { main: '#DB2777', accent: '#7C3AED', deep: '#15803D' },
    decoration: 'splash',
    greeting: 'Happy Holi — have a colourful day 🌸',
    matches: ['holi'],
    byYear: { 2026: ['2026-03-03', '2026-03-04'], 2027: ['2027-03-21', '2027-03-22'], 2028: ['2028-03-10', '2028-03-11'] },
  },
  {
    key: 'eid',
    name: 'Eid',
    emoji: '🌙',
    colors: { main: '#0F766E', accent: '#D97706', deep: '#134E4A' },
    decoration: 'lanterns',
    greeting: 'Eid Mubarak 🌙',
    matches: ['eid', 'id-ul-fitr', 'ramzan'],
    byYear: { 2026: ['2026-03-20', '2026-03-21'], 2027: ['2027-03-09', '2027-03-10'], 2028: ['2028-02-26', '2028-02-27'] },
  },
  {
    key: 'independence_day',
    name: 'Independence Day',
    emoji: '🕊️',
    colors: { main: '#EA580C', accent: '#16A34A', deep: '#1E3A8A' },
    decoration: 'ribbon',
    greeting: 'Happy Independence Day 🕊️',
    matches: ['independence day'],
    fixed: ['08-15', '08-15'],
  },
  {
    key: 'ganesh_chaturthi',
    name: 'Ganesh Chaturthi',
    emoji: '🐘',
    colors: { main: '#EA580C', accent: '#CA8A04', deep: '#991B1B' },
    decoration: 'marigold',
    greeting: 'Happy Ganesh Chaturthi 🐘',
    matches: ['ganesh'],
    byYear: { 2026: ['2026-09-14', '2026-09-15'], 2027: ['2027-09-04', '2027-09-05'], 2028: ['2028-08-23', '2028-08-24'] },
  },
  {
    key: 'gandhi_jayanti',
    name: 'Gandhi Jayanti',
    emoji: '👓',
    colors: { main: '#57534E', accent: '#16A34A', deep: '#292524' },
    decoration: 'none',
    greeting: '“Be the change you wish to see in the world.” — Gandhi Jayanti',
    matches: ['gandhi'],
    fixed: ['10-02', '10-02'],
  },
  {
    key: 'navratri',
    name: 'Navratri · Dussehra',
    emoji: '💃',
    colors: { main: '#C026D3', accent: '#F59E0B', deep: '#7F1D1D' },
    decoration: 'dandiya',
    greeting: 'Happy Navratri and Dussehra 💃',
    matches: ['navratri', 'dussehra', 'durga'],
    byYear: { 2026: ['2026-10-11', '2026-10-20'], 2027: ['2027-09-30', '2027-10-09'], 2028: ['2028-09-18', '2028-09-27'] },
  },
  {
    key: 'diwali',
    name: 'Diwali glow',
    emoji: '🪔',
    colors: { main: '#EA580C', accent: '#F59E0B', deep: '#7C2D12' },
    decoration: 'diyas',
    greeting: 'Happy Diwali from all of us 🪔',
    matches: ['diwali', 'deepavali'],
    byYear: { 2026: ['2026-11-05', '2026-11-11'], 2027: ['2027-10-26', '2027-11-01'], 2028: ['2028-10-14', '2028-10-20'] },
  },
  {
    key: 'christmas',
    name: 'Christmas · Year end',
    emoji: '🎄',
    colors: { main: '#B91C1C', accent: '#15803D', deep: '#14532D' },
    decoration: 'snow',
    greeting: 'Merry Christmas and happy holidays 🎄',
    matches: ['christmas'],
    fixed: ['12-22', '12-30'],
  },
];

export const PRESET_BY_KEY = new Map(SEASON_PRESETS.map((p) => [p.key, p]));

/** The preset's dates for a given year (null if a moving festival has no dates that year). */
export function presetDates(p: SeasonPreset, year: number): [string, string] | null {
  if (p.byYear) return p.byYear[year] ?? null;
  const [a, b] = p.fixed!;
  return [`${year}-${a}`, `${b < a ? year + 1 : year}-${b}`];
}

/** Next dates of a preset that haven't ended before `todayKey`. */
export function nextPresetDates(p: SeasonPreset, todayKey: string): [string, string] | null {
  const year = +todayKey.slice(0, 4);
  for (const y of [year - 1, year, year + 1, year + 2]) {
    const d = presetDates(p, y);
    if (d && d[1] >= todayKey) return d;
  }
  return null;
}

/** Same season one year later: preset dates if known, else the same days next year. */
export function shiftYear(preset: SeasonPreset | undefined, startsOn: string, endsOn: string): [string, string] {
  const y = +startsOn.slice(0, 4) + 1;
  const fromPreset = preset ? presetDates(preset, y) : null;
  if (fromPreset) return fromPreset;
  const bump = (k: string) => `${+k.slice(0, 4) + 1}${k.slice(4)}`;
  return [bump(startsOn), bump(endsOn)];
}
