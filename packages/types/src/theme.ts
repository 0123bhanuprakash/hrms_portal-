// ============================================================
// Theme tokens — the contract shared by the API (validation +
// storage) and the web app (theme engine, editor, preview).
//
// Only hex colors and enumerated choices are allowed: themes are
// rendered into other users' pages, so no free-form CSS ever.
// ============================================================

/** #RRGGBB */
export type HexColor = string;

/** Colors for one mode (light or dark). Derived shades (hover, soft tints, rings) are computed. */
export interface ThemePalette {
  background: HexColor;
  surface: HexColor;
  foreground: HexColor;
  mutedForeground: HexColor;
  border: HexColor;
  primary: HexColor;
  primaryForeground: HexColor;
  sidebar: HexColor;
  sidebarForeground: HexColor;
  sidebarActive: HexColor;
  success: HexColor;
  warning: HexColor;
  danger: HexColor;
  info: HexColor;
}

export type ThemeFont = 'inter' | 'plus-jakarta-sans' | 'manrope' | 'dm-sans' | 'ibm-plex-sans' | 'system';
export type ThemeTextScale = 'sm' | 'md' | 'lg';
export type ThemeShadow = 'flat' | 'soft' | 'elevated';
export type ThemeDensity = 'compact' | 'comfortable';

export interface ThemeTokens {
  /** Schema version for future migrations */
  version: 1;
  light: ThemePalette;
  dark: ThemePalette;
  typography: {
    font: ThemeFont;
    scale: ThemeTextScale;
  };
  shape: {
    /** Base corner radius in px (0–20) */
    radius: number;
    shadow: ThemeShadow;
  };
  layout: {
    density: ThemeDensity;
  };
}

/** Where a theme comes from: a built-in preset (by key) or a saved custom theme (by id). */
export type ThemeRef = { kind: 'preset'; key: string } | { kind: 'custom'; id: string };

export interface CustomTheme {
  id: string;
  name: string;
  description: string | null;
  tokens: ThemeTokens;
  createdAt: string;
  updatedAt: string;
}

/** Platform-level theme assignments managed in the Theme Studio. */
export interface PlatformThemeSettings {
  /** Theme of the Super Admin portal itself */
  superAdminTheme: ThemeRef;
  /** Theme every newly onboarded company starts with */
  defaultCompanyTheme: ThemeRef;
}

// ─── Personalisation (per employee) ──────────────────────────

/** Built-in theme presets (keys of apps/web/src/lib/theme/presets.ts) an employee may pick. */
export const BUILTIN_THEME_KEYS = [
  'indigo', 'ocean', 'emerald', 'sunset', 'rose', 'violet-brand', 'slate-corporate', 'high-contrast',
  'aurora', 'obsidian-gold', 'nordic-frost', 'forest', 'lavender-mist', 'sandstone', 'carbon-mono', 'cobalt-pro',
] as const;
export type BuiltinThemeKey = (typeof BUILTIN_THEME_KEYS)[number];

/** Layouts of the main menu. `classic` is today's sidebar and the default. */
export const MENU_STYLES = ['classic', 'rail', 'floating', 'collapsible'] as const;
export type MenuStyle = (typeof MENU_STYLES)[number];

/** What a company lets its people change for themselves. */
export interface CompanyPersonalization {
  /** Employees may pick their own colour theme */
  personalThemes: boolean;
  /** Themes they may pick from; empty = all built-in themes */
  allowedThemes: string[];
  /** Employees may pick their own menu style */
  personalMenuStyle: boolean;
  /** Menu style for everyone who hasn't picked one */
  defaultMenuStyle: MenuStyle;
}
