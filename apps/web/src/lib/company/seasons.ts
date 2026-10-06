'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

export type Decoration = 'fireworks' | 'kites' | 'ribbon' | 'splash' | 'lanterns' | 'marigold' | 'dandiya' | 'diyas' | 'snow' | 'sparkles' | 'petals' | 'confetti' | 'none';
export const DECORATIONS: Array<{ value: Decoration; label: string; emoji: string }> = [
  { value: 'fireworks', label: 'Fireworks', emoji: '🎆' },
  { value: 'diyas', label: 'Diyas', emoji: '🪔' },
  { value: 'sparkles', label: 'Sparkles', emoji: '✨' },
  { value: 'snow', label: 'Light snow', emoji: '❄️' },
  { value: 'kites', label: 'Kites', emoji: '🪁' },
  { value: 'ribbon', label: 'Tricolour ribbon', emoji: '🎗️' },
  { value: 'splash', label: 'Colour splash', emoji: '🎨' },
  { value: 'lanterns', label: 'Lanterns', emoji: '🏮' },
  { value: 'marigold', label: 'Marigold garland', emoji: '🌼' },
  { value: 'dandiya', label: 'Dandiya', emoji: '🥢' },
  { value: 'petals', label: 'Falling petals', emoji: '🌸' },
  { value: 'confetti', label: 'Confetti', emoji: '🎉' },
  { value: 'none', label: 'None', emoji: '—' },
];

export interface SeasonColors {
  main: string;
  accent: string;
  deep: string;
}

export interface Season {
  id: string;
  preset: string | null;
  name: string;
  emoji: string;
  startsOn: string;
  endsOn: string;
  everyYear: boolean;
  colors: SeasonColors;
  decoration: Decoration;
  greeting: string | null;
  onSignIn: boolean;
  enabled: boolean;
  status: 'live' | 'upcoming' | 'ended' | 'off';
  startsInDays: number;
  daysLeft: number | null;
}

export interface SeasonPreset {
  key: string;
  name: string;
  emoji: string;
  colors: SeasonColors;
  decoration: Decoration;
  greeting: string;
  startsOn: string | null;
  endsOn: string | null;
  planned: boolean;
}

export interface SeasonInput {
  preset?: string;
  name: string;
  emoji: string;
  startsOn: string;
  endsOn: string;
  everyYear?: boolean;
  colors: SeasonColors;
  decoration: Decoration;
  greeting?: string;
  onSignIn?: boolean;
  enabled?: boolean;
}

const keys = {
  active: ['seasons', 'active'] as const,
  list: ['seasons', 'list'] as const,
  presets: ['seasons', 'presets'] as const,
};

/** What is on today (everyone). Refreshed every 15 minutes so a season starts on its own. */
export const useActiveSeason = (enabled = true) =>
  useQuery({ queryKey: keys.active, queryFn: async () => unwrap<Season | null>(await api.get('/seasons/active')), enabled, staleTime: 5 * 60_000, refetchInterval: 15 * 60_000 });

export const useSeasons = (enabled = true) =>
  useQuery({ queryKey: keys.list, queryFn: async () => unwrap<{ today: string; seasons: Season[]; suggestions: Array<{ preset: string; name: string; emoji: string; holiday: string; startsOn: string; endsOn: string }> }>(await api.get('/seasons')), enabled });

export const useSeasonPresets = (enabled = true) =>
  useQuery({ queryKey: keys.presets, queryFn: async () => unwrap<SeasonPreset[]>(await api.get('/seasons/presets')), enabled, staleTime: 5 * 60_000 });

function useSeasonMutation<TVars, TResult>(fn: (v: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['seasons'] }),
  });
}
export const useSaveSeason = () =>
  useSeasonMutation(async ({ id, ...body }: Partial<SeasonInput> & { id?: string }) =>
    unwrap<Season>(id ? await api.patch(`/seasons/${id}`, body) : await api.post('/seasons', body)),
  );
export const useDeleteSeason = () => useSeasonMutation(async (id: string) => unwrap<{ id: string }>(await api.delete(`/seasons/${id}`)));

// ─── "Try it on me for 10 minutes" (this browser tab only) ─────────────

const PREVIEW_KEY = 'season-preview';
type Preview = { season: Season; until: number };
let listeners: Array<() => void> = [];
let cached: Preview | null | undefined;

function readPreview(): Preview | null {
  if (cached !== undefined) return cached && cached.until > Date.now() ? cached : null;
  try {
    const raw = sessionStorage.getItem(PREVIEW_KEY);
    cached = raw ? (JSON.parse(raw) as Preview) : null;
  } catch {
    cached = null;
  }
  return cached && cached.until > Date.now() ? cached : null;
}

export function startSeasonPreview(season: Season, minutes = 10) {
  cached = { season, until: Date.now() + minutes * 60_000 };
  try {
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(cached));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
  setTimeout(() => stopSeasonPreview(), minutes * 60_000);
}

export function stopSeasonPreview() {
  cached = null;
  try {
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useSeasonPreview(): Preview | null {
  return useSyncExternalStore(
    (l) => {
      listeners.push(l);
      return () => {
        listeners = listeners.filter((x) => x !== l);
      };
    },
    readPreview,
    () => null,
  );
}

/** A Season-shaped value from a preset / form, for previews. */
export function seasonFromInput(v: SeasonInput, id = 'preview'): Season {
  return {
    id,
    preset: v.preset ?? null,
    name: v.name,
    emoji: v.emoji,
    startsOn: v.startsOn,
    endsOn: v.endsOn,
    everyYear: v.everyYear ?? true,
    colors: v.colors,
    decoration: v.decoration,
    greeting: v.greeting ?? null,
    onSignIn: v.onSignIn ?? true,
    enabled: true,
    status: 'live',
    startsInDays: 0,
    daysLeft: null,
  };
}
