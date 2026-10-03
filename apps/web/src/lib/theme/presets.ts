import type { ThemeRef, ThemeTokens } from '@hrms/types';
import { buildTheme } from './generate';

// ============================================================
// Built-in "Suggested themes". Keys are stored in theme settings
// ({ kind: 'preset', key }) — never rename a key once shipped.
// ============================================================

export type ThemeCollection = 'essentials' | 'premium';

export interface ThemePreset {
  key: string;
  name: string;
  description: string;
  tokens: ThemeTokens;
  collection?: ThemeCollection;
  /** Short mood tag shown on the card, e.g. "Luxury" */
  mood?: string;
}

const ESSENTIALS: ThemePreset[] = [
  {
    key: 'indigo',
    name: 'Indigo Classic',
    description: 'Balanced and modern. The platform default.',
    tokens: buildTheme({ primary: '#4F46E5' }),
  },
  {
    key: 'ocean',
    name: 'Ocean',
    description: 'Calm, trustworthy blues for finance-minded teams.',
    tokens: buildTheme({ primary: '#0369A1', radius: 8 }),
  },
  {
    key: 'emerald',
    name: 'Emerald',
    description: 'Fresh and optimistic green with a soft feel.',
    tokens: buildTheme({ primary: '#047857', font: 'dm-sans', radius: 12 }),
  },
  {
    key: 'sunset',
    name: 'Sunset',
    description: 'Warm orange energy for people-first companies.',
    tokens: buildTheme({ primary: '#C2410C', font: 'plus-jakarta-sans', radius: 12 }),
  },
  {
    key: 'rose',
    name: 'Rose',
    description: 'Elegant crimson with rounded, friendly shapes.',
    tokens: buildTheme({ primary: '#BE123C', font: 'manrope', radius: 14 }),
  },
  {
    key: 'violet-brand',
    name: 'Violet Studio',
    description: 'Bold violet with a brand-colored sidebar.',
    tokens: buildTheme({ primary: '#6D28D9', sidebar: 'brand', font: 'plus-jakarta-sans', radius: 12, shadow: 'elevated' }),
  },
  {
    key: 'slate-corporate',
    name: 'Slate Corporate',
    description: 'Understated graphite with a dark sidebar. Enterprise classic.',
    tokens: buildTheme({ primary: '#334155', sidebar: 'dark', font: 'ibm-plex-sans', radius: 6, shadow: 'flat' }),
  },
  {
    key: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum legibility: strong text, borders and focus.',
    tokens: buildTheme({
      primary: '#1D4ED8',
      radius: 6,
      shadow: 'flat',
      scale: 'lg',
      light: { foreground: '#000000', mutedForeground: '#3F3F46', border: '#A1A1AA' },
      dark: { foreground: '#FFFFFF', mutedForeground: '#D4D4D8', border: '#52525B' },
    }),
  },
];

/** Curated, more expressive themes with distinct moods. */
const PREMIUM: ThemePreset[] = [
  {
    key: 'aurora',
    name: 'Aurora',
    mood: 'Creative',
    description: 'Teal-to-violet glow with a brand sidebar. Modern and vivid.',
    tokens: buildTheme({
      primary: '#0F766E',
      sidebar: 'brand',
      font: 'plus-jakarta-sans',
      radius: 14,
      shadow: 'elevated',
      light: { info: '#7C3AED' },
      dark: { info: '#A78BFA' },
    }),
  },
  {
    key: 'obsidian-gold',
    name: 'Obsidian Gold',
    mood: 'Luxury',
    description: 'Near-black sidebar with a refined gold accent. Executive and timeless.',
    tokens: buildTheme({
      primary: '#B7791F',
      sidebar: 'dark',
      font: 'manrope',
      radius: 8,
      shadow: 'elevated',
      light: { background: '#FAF8F4', border: '#E7E1D6' },
      dark: { background: '#0B0A08', surface: '#15130F', border: '#2A261F' },
    }),
  },
  {
    key: 'nordic-frost',
    name: 'Nordic Frost',
    mood: 'Calm',
    description: 'Cool steel blue, airy surfaces and soft, generous corners.',
    tokens: buildTheme({
      primary: '#3B6E8F',
      font: 'manrope',
      radius: 16,
      shadow: 'soft',
      light: { background: '#F4F7FA', border: '#DCE4EC' },
    }),
  },
  {
    key: 'forest',
    name: 'Forest',
    mood: 'Grounded',
    description: 'Deep evergreen with a dark sidebar. Natural and steady.',
    tokens: buildTheme({ primary: '#166534', sidebar: 'dark', font: 'dm-sans', radius: 10 }),
  },
  {
    key: 'lavender-mist',
    name: 'Lavender Mist',
    mood: 'Gentle',
    description: 'Soft violet and very rounded shapes. Friendly and people-first.',
    tokens: buildTheme({
      primary: '#7C3AED',
      font: 'manrope',
      radius: 18,
      shadow: 'soft',
      light: { background: '#FAF8FF', border: '#E9E3F7' },
    }),
  },
  {
    key: 'sandstone',
    name: 'Sandstone',
    mood: 'Warm',
    description: 'Desert amber on warm neutrals. Inviting, hospitality-ready.',
    tokens: buildTheme({
      primary: '#9A3412',
      font: 'plus-jakarta-sans',
      radius: 12,
      light: { background: '#FBF8F3', border: '#EAE2D6', mutedForeground: '#78716C' },
      dark: { background: '#0E0C0A', surface: '#181512' },
    }),
  },
  {
    key: 'carbon-mono',
    name: 'Carbon Mono',
    mood: 'Minimal',
    description: 'Monochrome accent, flat depth and sharp corners. Pure focus.',
    tokens: buildTheme({ primary: '#18181B', sidebar: 'dark', font: 'ibm-plex-sans', radius: 4, shadow: 'flat' }),
  },
  {
    key: 'cobalt-pro',
    name: 'Cobalt Pro',
    mood: 'Corporate',
    description: 'Confident cobalt with a brand sidebar. Built for large enterprises.',
    tokens: buildTheme({ primary: '#1E40AF', sidebar: 'brand', font: 'ibm-plex-sans', radius: 8, shadow: 'soft' }),
  },
];

export const THEME_PRESETS: ThemePreset[] = [
  ...ESSENTIALS.map((p) => ({ ...p, collection: 'essentials' as const })),
  ...PREMIUM.map((p) => ({ ...p, collection: 'premium' as const })),
];

export const DEFAULT_PRESET = THEME_PRESETS[0]!;

export function findPreset(key: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.key === key);
}

/** Tokens for a theme reference; unknown presets / missing custom themes fall back to the default. */
export function resolveTheme(ref: ThemeRef | undefined, customTokens: Record<string, ThemeTokens> = {}): ThemeTokens {
  if (!ref) return DEFAULT_PRESET.tokens;
  if (ref.kind === 'preset') return findPreset(ref.key)?.tokens ?? DEFAULT_PRESET.tokens;
  return customTokens[ref.id] ?? DEFAULT_PRESET.tokens;
}
