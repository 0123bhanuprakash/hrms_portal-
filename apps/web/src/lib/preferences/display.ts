// ============================================================
// Personal display preferences (density, text size, motion).
// Applied as attributes on <html>; the CSS lives in globals.css.
// "theme" = no attribute → the company / platform theme decides.
// ============================================================

export type DensityPref = 'theme' | 'compact' | 'normal' | 'spacious';
export type TextSizePref = 'theme' | 'sm' | 'md' | 'lg' | 'xl';

export interface DisplayPrefs {
  density: DensityPref;
  textSize: TextSizePref;
  reduceMotion: boolean;
}

export const DEFAULT_DISPLAY: DisplayPrefs = { density: 'theme', textSize: 'theme', reduceMotion: false };

const DENSITIES: DensityPref[] = ['theme', 'compact', 'normal', 'spacious'];
const TEXT_SIZES: TextSizePref[] = ['theme', 'sm', 'md', 'lg', 'xl'];

/** Tolerates missing / unknown values from older API responses or storage. */
export function toDisplayPrefs(value: Partial<Record<keyof DisplayPrefs, unknown>> | null | undefined): DisplayPrefs {
  return {
    density: DENSITIES.includes(value?.density as DensityPref) ? (value!.density as DensityPref) : 'theme',
    textSize: TEXT_SIZES.includes(value?.textSize as TextSizePref) ? (value!.textSize as TextSizePref) : 'theme',
    reduceMotion: value?.reduceMotion === true,
  };
}

export function applyDisplay(prefs: DisplayPrefs | null): void {
  const html = document.documentElement;
  const set = (name: string, value: string | null) => (value ? html.setAttribute(name, value) : html.removeAttribute(name));
  set('data-density', prefs && prefs.density !== 'theme' ? prefs.density : null);
  set('data-text-size', prefs && prefs.textSize !== 'theme' ? prefs.textSize : null);
  set('data-motion', prefs?.reduceMotion ? 'reduce' : null);
}

/** Cached per user so the next visit paints with the right settings at once. */
export const displayCacheKey = (userId: string) => `hrms-display-${userId}`;

export function cacheDisplay(userId: string, prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(displayCacheKey(userId), JSON.stringify(prefs));
  } catch {
    /* storage unavailable */
  }
}

export function cachedDisplay(userId: string): DisplayPrefs | null {
  try {
    const raw = localStorage.getItem(displayCacheKey(userId));
    return raw ? toDisplayPrefs(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Runs in <head> before first paint (portal pages only): reads the signed-in
 * user from the auth store and applies their cached settings, so pages never
 * flash at the wrong size. Keep in sync with applyDisplay().
 */
export const DISPLAY_BOOT_SCRIPT = `(function(){try{
var p=location.pathname;if(p.indexOf('/app')!==0&&p.indexOf('/super-admin')!==0)return;
var a=JSON.parse(localStorage.getItem('hrms-auth-storage')||'null');var id=a&&a.state&&a.state.user&&a.state.user.id;if(!id)return;
var d=JSON.parse(localStorage.getItem('hrms-display-'+id)||'null');if(!d)return;var h=document.documentElement;
if(/^(compact|normal|spacious)$/.test(d.density))h.setAttribute('data-density',d.density);
if(/^(sm|md|lg|xl)$/.test(d.textSize))h.setAttribute('data-text-size',d.textSize);
if(d.reduceMotion===true)h.setAttribute('data-motion','reduce');
}catch(e){}})();`;
