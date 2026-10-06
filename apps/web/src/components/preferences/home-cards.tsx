'use client';

import { useMemo } from 'react';
import { useUiState } from '@/lib/preferences/ui-state';

/** Home cards a person can hide (Preferences → Home & views). */
export const HOME_CARDS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'whosoff', label: 'Who’s off', hint: 'People away today' },
  { id: 'celebrations', label: 'Celebrations', hint: 'Birthdays and work anniversaries' },
  { id: 'comingup', label: 'Coming up', hint: 'Holidays and events soon' },
  { id: 'joiners', label: 'New joiners', hint: 'Who joined recently' },
  { id: 'kudos', label: 'Kudos', hint: 'The latest thank-yous' },
  { id: 'announcements', label: 'Announcements', hint: 'Company news at the bottom of Home' },
];

const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function useHomeHiddenState() {
  return useUiState<string[]>('home.hidden', [], isList);
}

export function useHomeHidden(): Set<string> {
  const [list] = useHomeHiddenState();
  return useMemo(() => new Set(list), [list]);
}
