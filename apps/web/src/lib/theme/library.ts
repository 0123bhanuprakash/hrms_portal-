'use client';

import { useMemo } from 'react';
import type { ThemeRef, ThemeTokens } from '@hrms/types';
import { useCustomThemes } from '@/lib/admin/queries';
import { THEME_PRESETS, type ThemeCollection } from './presets';

/** One selectable theme: a built-in preset or a saved custom theme. */
export interface ThemeLibraryItem {
  ref: ThemeRef;
  /** Stable id: "preset:<key>" or the custom theme id (also the art seed) */
  id: string;
  name: string;
  description: string | null;
  tokens: ThemeTokens;
  collection: ThemeCollection | 'custom';
  mood?: string;
}

export function sameThemeRef(a: ThemeRef | null | undefined, b: ThemeRef | null | undefined): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return a.kind === 'preset' ? a.key === (b as { key: string }).key : a.id === (b as { id: string }).id;
}

/** Presets + the platform's custom themes, in display order (premium, essentials, custom). */
export function useThemeLibrary() {
  const custom = useCustomThemes();

  const items = useMemo<ThemeLibraryItem[]>(() => {
    const presets = THEME_PRESETS.map<ThemeLibraryItem>((p) => ({
      ref: { kind: 'preset', key: p.key },
      id: `preset:${p.key}`,
      name: p.name,
      description: p.description,
      tokens: p.tokens,
      collection: p.collection ?? 'essentials',
      mood: p.mood,
    }));
    const customs = (custom.data ?? []).map<ThemeLibraryItem>((t) => ({
      ref: { kind: 'custom', id: t.id },
      id: t.id,
      name: t.name,
      description: t.description,
      tokens: t.tokens,
      collection: 'custom',
    }));
    const order = { premium: 0, essentials: 1, custom: 2 } as const;
    return [...presets, ...customs].sort((a, b) => order[a.collection] - order[b.collection]);
  }, [custom.data]);

  const find = (ref: ThemeRef | null | undefined) => items.find((i) => sameThemeRef(i.ref, ref));

  return { items, find, isLoading: custom.isLoading };
}
