// ============================================================
// Small, dependency-free color utilities for the theme engine.
// All inputs/outputs are #RRGGBB hex strings unless noted.
// ============================================================

type RGB = [number, number, number];

export function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** "#4F46E5" → "243 75% 59%" (CSS variable triplet used by Tailwind tokens) */
export function hexToHslTriplet(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as RGB;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
}

/** Linear blend: amount 0 → a, 1 → b */
export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => ca[i]! + (cb[i]! - ca[i]!) * amount) as RGB);
}

/** WCAG relative luminance (0–1). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.2;
}

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: string, dark = '#0A0A0B', light = '#FFFFFF'): string {
  return contrast(background, light) >= contrast(background, dark) ? light : dark;
}

/** Contrast rating for UI badges. */
export function contrastGrade(ratio: number): 'AAA' | 'AA' | 'AA Large' | 'Fail' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

/**
 * Moves `color` toward black/white until it reaches `target` contrast on `background`
 * (used by the editor's "Fix contrast" action).
 */
export function ensureContrast(color: string, background: string, target = 4.5): string {
  if (contrast(color, background) >= target) return color;
  const toward = isDark(background) ? '#FFFFFF' : '#000000';
  for (let step = 0.05; step <= 1; step += 0.05) {
    const candidate = mix(color, toward, step);
    if (contrast(candidate, background) >= target) return candidate;
  }
  return toward;
}
