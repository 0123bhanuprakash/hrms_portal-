'use client';

import { useEffect } from 'react';
import { useUiState } from '@/lib/preferences/ui-state';

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Personal accessibility choices (Preferences → Accessibility) as <html> attributes. */
export function useA11yPrefs() {
  const [contrast, setContrast] = useUiState<boolean>('a11y.contrast', false, isBool);
  const [focus, setFocus] = useUiState<boolean>('a11y.focus', false, isBool);
  const [underline, setUnderline] = useUiState<boolean>('a11y.underline', false, isBool);
  const [decorations, setDecorations] = useUiState<boolean>('season.decorations', true, isBool);
  return { contrast, setContrast, focus, setFocus, underline, setUnderline, decorations, setDecorations };
}

export function A11yPrefs() {
  const { contrast, focus, underline, decorations } = useA11yPrefs();
  useEffect(() => {
    const el = document.documentElement;
    const set = (k: string, on: boolean, value = 'on') => (on ? el.setAttribute(k, value) : el.removeAttribute(k));
    set('data-contrast', contrast, 'more');
    set('data-focus', focus, 'always');
    set('data-links', underline, 'underline');
    set('data-decor', !decorations, 'off');
  }, [contrast, focus, underline, decorations]);
  return null;
}
