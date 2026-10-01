import type { ThemeFont, ThemePalette, ThemeShadow, ThemeTextScale, ThemeTokens } from '@hrms/types';
import { ensureContrast, mix, readableOn } from './color';

// ============================================================
// Palette generator — a complete, readable light + dark palette
// from one brand color. Used for presets and the editor's
// "Generate from brand color".
// ============================================================

export type SidebarStyle = 'light' | 'dark' | 'brand';

const STATUS = {
  light: { success: '#16A34A', warning: '#D97706', danger: '#DC2626', info: '#0284C7' },
  dark: { success: '#4ADE80', warning: '#FBBF24', danger: '#F87171', info: '#38BDF8' },
};

function sidebarColors(style: SidebarStyle, mode: 'light' | 'dark', primary: string, surface: string, foreground: string) {
  if (style === 'dark' || (style === 'light' && mode === 'dark')) {
    const sidebar = mode === 'dark' ? mix(surface, '#000000', 0.25) : '#0F0F12';
    return { sidebar, sidebarForeground: '#A1A1AA', sidebarActive: mix(sidebar, '#FFFFFF', 0.08) };
  }
  if (style === 'brand') {
    const sidebar = mix(primary, '#000000', mode === 'dark' ? 0.7 : 0.55);
    return {
      sidebar,
      sidebarForeground: mix('#FFFFFF', primary, 0.22),
      sidebarActive: mix(sidebar, '#FFFFFF', 0.12),
    };
  }
  return {
    sidebar: surface,
    sidebarForeground: mix(foreground, surface, 0.25),
    sidebarActive: mix(surface, primary, 0.07),
  };
}

export function generatePalette(primary: string, mode: 'light' | 'dark', sidebarStyle: SidebarStyle = 'light'): ThemePalette {
  if (mode === 'light') {
    const background = mix('#FAFAFB', primary, 0.012);
    const surface = '#FFFFFF';
    const foreground = '#18181B';
    return {
      background,
      surface,
      foreground,
      mutedForeground: '#71717A',
      border: mix('#E4E4E7', primary, 0.03),
      primary,
      primaryForeground: readableOn(primary),
      ...sidebarColors(sidebarStyle, mode, primary, surface, foreground),
      ...STATUS.light,
    };
  }

  // Dark: lift the brand color so it stays visible on dark surfaces
  const darkPrimary = ensureContrast(mix(primary, '#FFFFFF', 0.12), '#141417', 3);
  const background = mix('#0B0B0D', primary, 0.015);
  const surface = mix('#141417', primary, 0.01);
  const foreground = '#EDEDEF';
  return {
    background,
    surface,
    foreground,
    mutedForeground: '#A1A1AA',
    border: mix('#26262B', primary, 0.03),
    primary: darkPrimary,
    primaryForeground: readableOn(darkPrimary),
    ...sidebarColors(sidebarStyle, mode, darkPrimary, surface, foreground),
    ...STATUS.dark,
  };
}

export interface BuildThemeOptions {
  primary: string;
  sidebar?: SidebarStyle;
  font?: ThemeFont;
  scale?: ThemeTextScale;
  radius?: number;
  shadow?: ThemeShadow;
  /** Fine-tune individual colors after generation */
  light?: Partial<ThemePalette>;
  dark?: Partial<ThemePalette>;
}

export function buildTheme(o: BuildThemeOptions): ThemeTokens {
  const sidebar = o.sidebar ?? 'light';
  return {
    version: 1,
    light: { ...generatePalette(o.primary, 'light', sidebar), ...o.light },
    dark: { ...generatePalette(o.primary, 'dark', sidebar), ...o.dark },
    typography: { font: o.font ?? 'inter', scale: o.scale ?? 'md' },
    shape: { radius: o.radius ?? 10, shadow: o.shadow ?? 'soft' },
    layout: { density: 'comfortable' },
  };
}
