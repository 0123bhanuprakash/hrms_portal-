import type { BackdropLevel, BackdropPack, MenuStyle } from '@hrms/types';

// Runtime copies of the shared lists in @hrms/types (that package is
// types-only at runtime for the API). personalization.spec.ts fails if
// they ever drift apart.

/** Built-in theme keys an employee may pick (apps/web/src/lib/theme/presets.ts). */
export const BUILTIN_THEME_KEYS = [
  'indigo', 'ocean', 'emerald', 'sunset', 'rose', 'violet-brand', 'slate-corporate', 'high-contrast',
  'aurora', 'obsidian-gold', 'nordic-frost', 'forest', 'lavender-mist', 'sandstone', 'carbon-mono', 'cobalt-pro',
] as const;

/** Main-menu layouts; `classic` is the default. */
export const MENU_STYLES: readonly MenuStyle[] = ['classic', 'glide', 'peek', 'floating', 'collapsible'];

/** Page background packs; `signature` is the default. */
export const BACKDROP_PACKS: readonly BackdropPack[] = ['signature', 'terra', 'prism', 'simple'];
/** Page background liveliness; `lively` is the default. */
export const BACKDROP_LEVELS: readonly BackdropLevel[] = ['lively', 'calm', 'off'];
