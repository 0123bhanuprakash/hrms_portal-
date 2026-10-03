'use client';

import { useEffect } from 'react';
import type { ThemeTokens } from '@hrms/types';
import { fontStylesheetUrl, themeToCss } from '@/lib/theme/engine';

const STYLE_ID = 'hrms-theme';
const FONT_ID = 'hrms-theme-font';

/**
 * Applies a theme to the whole document by injecting a <style> tag
 * (and the theme's web font). Removing the component restores the
 * defaults from globals.css.
 */
export function ThemeStyle({ tokens }: { tokens: ThemeTokens | null | undefined }) {
  useEffect(() => {
    if (!tokens) return;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = themeToCss(tokens);

    const href = fontStylesheetUrl(tokens.typography.font);
    let link = document.getElementById(FONT_ID) as HTMLLinkElement | null;
    if (href) {
      if (!link) {
        link = document.createElement('link');
        link.id = FONT_ID;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      if (link.href !== href) link.href = href;
    } else {
      link?.remove();
    }
  }, [tokens]);

  useEffect(
    () => () => {
      document.getElementById(STYLE_ID)?.remove();
      document.getElementById(FONT_ID)?.remove();
    },
    [],
  );

  return null;
}
