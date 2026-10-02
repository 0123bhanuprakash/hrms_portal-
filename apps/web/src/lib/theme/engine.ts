import type { ThemeDensity, ThemeFont, ThemePalette, ThemeShadow, ThemeTextScale, ThemeTokens } from '@hrms/types';
import { hexToHslTriplet as hsl, isDark, mix, readableOn } from './color';

// ============================================================
// Theme engine: ThemeTokens → CSS custom properties.
//
// The same function feeds the live portal (<ThemeStyle>), the
// Theme Studio preview iframe and the small preset cards, so a
// preview always matches what users will actually see.
// ============================================================

export const FONTS: Record<ThemeFont, { label: string; stack: string; google?: string }> = {
  inter: { label: 'Inter', stack: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' },
  'plus-jakarta-sans': {
    label: 'Plus Jakarta Sans',
    stack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    google: 'Plus+Jakarta+Sans:wght@400;500;600;700',
  },
  manrope: { label: 'Manrope', stack: 'Manrope, ui-sans-serif, system-ui, sans-serif', google: 'Manrope:wght@400;500;600;700' },
  'dm-sans': { label: 'DM Sans', stack: '"DM Sans", ui-sans-serif, system-ui, sans-serif', google: 'DM+Sans:wght@400;500;600;700' },
  'ibm-plex-sans': {
    label: 'IBM Plex Sans',
    stack: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    google: 'IBM+Plex+Sans:wght@400;500;600;700',
  },
  system: { label: 'System UI', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
};

export const TEXT_SCALES: Record<ThemeTextScale, { label: string; rootSize: string }> = {
  sm: { label: 'Small', rootSize: '93.75%' },
  md: { label: 'Default', rootSize: '100%' },
  lg: { label: 'Large', rootSize: '106.25%' },
};

/** Theme density → spacing multiplier (matches globals.css user overrides). */
export const DENSITY_SPACE: Record<ThemeDensity, string> = {
  compact: '0.85',
  comfortable: '1',
};

const SHADOWS: Record<ThemeShadow, { label: string; card: string; menu: string; dialog: string }> = {
  flat: {
    label: 'Flat',
    card: '0 0 0 0 transparent',
    menu: '0 2px 8px -2px rgb(0 0 0 / 0.12)',
    dialog: '0 12px 32px -8px rgb(0 0 0 / 0.25)',
  },
  soft: {
    label: 'Soft',
    card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
    menu: '0 4px 6px -2px rgb(0 0 0 / 0.05), 0 12px 24px -4px rgb(0 0 0 / 0.12)',
    dialog: '0 8px 16px -4px rgb(0 0 0 / 0.08), 0 24px 48px -12px rgb(0 0 0 / 0.25)',
  },
  elevated: {
    label: 'Elevated',
    card: '0 2px 4px -1px rgb(0 0 0 / 0.06), 0 6px 16px -4px rgb(0 0 0 / 0.1)',
    menu: '0 8px 12px -4px rgb(0 0 0 / 0.08), 0 20px 36px -8px rgb(0 0 0 / 0.18)',
    dialog: '0 16px 24px -8px rgb(0 0 0 / 0.12), 0 32px 64px -16px rgb(0 0 0 / 0.35)',
  },
};
export const SHADOW_OPTIONS = SHADOWS;

/** Mode-specific color variables (derived shades computed here). */
export function paletteVars(p: ThemePalette): Record<string, string> {
  const dark = isDark(p.background);
  const soft = (c: string) => mix(p.surface, c, dark ? 0.16 : 0.09);
  const sidebarActiveFg = readableOn(p.sidebarActive, p.foreground === '#FFFFFF' ? '#0A0A0B' : p.foreground, '#FFFFFF');

  return {
    '--background': hsl(p.background),
    '--foreground': hsl(p.foreground),
    '--surface': hsl(p.surface),
    '--surface-foreground': hsl(p.foreground),
    '--raised': hsl(dark ? mix(p.surface, p.foreground, 0.03) : p.surface),
    '--raised-foreground': hsl(p.foreground),
    '--muted': hsl(mix(p.surface, p.foreground, dark ? 0.05 : 0.035)),
    '--muted-foreground': hsl(p.mutedForeground),
    '--subtle': hsl(mix(p.surface, p.foreground, dark ? 0.08 : 0.06)),
    '--border': hsl(p.border),
    '--input': hsl(mix(p.border, p.foreground, 0.08)),
    '--primary': hsl(p.primary),
    '--primary-foreground': hsl(p.primaryForeground),
    '--primary-soft': hsl(soft(p.primary)),
    '--primary-soft-foreground': hsl(dark ? mix(p.primary, '#FFFFFF', 0.35) : mix(p.primary, p.foreground, 0.2)),
    '--ring': hsl(p.primary),
    '--success': hsl(p.success),
    '--success-soft': hsl(soft(p.success)),
    '--warning': hsl(p.warning),
    '--warning-soft': hsl(soft(p.warning)),
    '--destructive': hsl(p.danger),
    '--destructive-foreground': hsl(readableOn(p.danger)),
    '--destructive-soft': hsl(soft(p.danger)),
    '--info': hsl(p.info),
    '--info-soft': hsl(soft(p.info)),
    '--sidebar': hsl(p.sidebar),
    '--sidebar-foreground': hsl(p.sidebarForeground),
    '--sidebar-muted': hsl(mix(p.sidebar, p.sidebarForeground, 0.62)),
    '--sidebar-active': hsl(p.sidebarActive),
    '--sidebar-active-foreground': hsl(sidebarActiveFg),
    '--sidebar-border': hsl(mix(p.sidebar, p.sidebarForeground, 0.12)),
  };
}

/** Mode-independent variables: font, radius, shadows. */
export function sharedVars(t: ThemeTokens): Record<string, string> {
  const shadow = SHADOWS[t.shape.shadow];
  return {
    '--font-sans': FONTS[t.typography.font].stack,
    '--radius': `${t.shape.radius / 16}rem`,
    '--shadow-card': shadow.card,
    '--shadow-menu': shadow.menu,
    '--shadow-dialog': shadow.dialog,
  };
}

const block = (selector: string, vars: Record<string, string>) =>
  `${selector}{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`;

/**
 * Global stylesheet for a theme. `html:root` / `html.dark` outrank the
 * defaults in globals.css and next/font's class on <html>.
 */
export function themeToCss(t: ThemeTokens): string {
  return [
    block('html:root', {
      ...paletteVars(t.light),
      ...sharedVars(t),
      'font-size': TEXT_SCALES[t.typography.scale].rootSize,
      // Density scales every spacing step (tailwind.config.ts); users can override it
      '--space': DENSITY_SPACE[t.layout?.density ?? 'comfortable'],
    }),
    block('html.dark', paletteVars(t.dark)),
  ].join('\n');
}

/** Inline style that themes just one element and its children (preset cards). */
export function themeToInlineStyle(t: ThemeTokens, mode: 'light' | 'dark'): React.CSSProperties {
  return { ...paletteVars(mode === 'dark' ? t.dark : t.light), ...sharedVars(t) } as React.CSSProperties;
}

/** Google Fonts stylesheet URL for the theme's font (null for bundled/system fonts). */
export function fontStylesheetUrl(font: ThemeFont): string | null {
  const family = FONTS[font].google;
  return family ? `https://fonts.googleapis.com/css2?family=${family}&display=swap` : null;
}
