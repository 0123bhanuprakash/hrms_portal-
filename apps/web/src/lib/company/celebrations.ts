'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { profileKeys } from '@/lib/company/profile';

// ============================================================
// Birthday and work-anniversary wishes (Home → Celebrations).
// A celebration thing, not kudos: private between the two
// people, one per occasion, only on the day, never to yourself.
// ============================================================

export type WishKind = 'birthday' | 'anniversary';

/** Same lists as the API (engagement/dto.ts WISH_STICKERS). */
export const WISH_STICKERS: Record<WishKind, string[]> = {
  birthday: ['🎂', '🎉', '🥳', '🎈', '🎁', '💐'],
  anniversary: ['🏆', '🎉', '👏', '🌟', '🙌', '💐'],
};

/** Ready-made lines to tap instead of typing. */
export const WISH_LINES: Record<WishKind, string[]> = {
  birthday: ['Happy birthday! Have a wonderful year ahead.', 'Wishing you a fantastic day!', 'Many happy returns of the day!'],
  anniversary: ['Congratulations on the milestone!', 'Thank you for everything you do — here’s to many more years!', 'Happy work anniversary!'],
};

export interface WishFrom {
  id: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  designation: { name: string } | null;
}

export interface Wish {
  id: string;
  sticker: string;
  message: string | null;
  createdAt: string;
  from: WishFrom;
}

export interface WishOccasion {
  kind: WishKind;
  /** YYYY-MM-DD */
  date: string;
  years: number | null;
  wishes: Wish[];
}

export interface CelebrationsToday {
  date: string;
  /** People I've wished today */
  wished: Array<{ employeeId: string; kind: WishKind }>;
  /** My own occasions today, with the wishes so far */
  received: WishOccasion[];
}

export const celebrationKeys = {
  all: ['celebrations'] as const,
  today: ['celebrations', 'today'] as const,
  mine: ['celebrations', 'mine'] as const,
};

const unwrap = <T,>(r: { data: { data: T } }) => r.data.data;

export function useCelebrationsToday(enabled = true) {
  return useQuery({ queryKey: celebrationKeys.today, queryFn: async () => unwrap<CelebrationsToday>(await api.get('/celebrations/today')), enabled, staleTime: 60_000 });
}

export function useMyWishes(enabled = true) {
  return useQuery({ queryKey: celebrationKeys.mine, queryFn: async () => unwrap<WishOccasion[]>(await api.get('/celebrations/wishes/mine')), enabled });
}

export function useSendWish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { employeeIds: string[]; kind: WishKind; sticker: string; message?: string }) =>
      unwrap<{ sent: string[]; alreadyWished: string[] }>(await api.post('/celebrations/wishes', body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: celebrationKeys.all });
      void qc.invalidateQueries({ queryKey: profileKeys.spotlight });
    },
  });
}
