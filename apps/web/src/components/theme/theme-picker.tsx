'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { ThemeRef } from '@hrms/types';
import { ThemeArt } from './theme-art';
import { ThemeThumbnail } from './theme-card';
import { sameThemeRef, type ThemeLibraryItem } from '@/lib/theme/library';
import { cn } from '@/lib/cn';

const GROUP_LABELS: Record<ThemeLibraryItem['collection'], string> = {
  premium: 'Premium collection',
  essentials: 'Essentials',
  custom: 'Custom themes',
};

/** Selectable theme gallery, grouped by collection. */
export function ThemePicker({
  items,
  value,
  onChange,
  columns = 3,
}: {
  items: ThemeLibraryItem[];
  value: ThemeRef | null | undefined;
  onChange: (item: ThemeLibraryItem) => void;
  columns?: 2 | 3;
}) {
  const groups = (['premium', 'essentials', 'custom'] as const)
    .map((collection) => ({ collection, items: items.filter((i) => i.collection === collection) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.collection} role="radiogroup" aria-label={GROUP_LABELS[group.collection]}>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{GROUP_LABELS[group.collection]}</p>
          <div className={cn('grid gap-2.5', columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
            {group.items.map((item) => {
              const selected = sameThemeRef(value, item.ref);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(item)}
                  className={cn(
                    'group overflow-hidden rounded-lg border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-menu',
                  )}
                >
                  <ThemeArt tokens={item.tokens} seed={item.id} className="px-2.5 pt-2.5">
                    {selected && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <div className="mt-2 overflow-hidden rounded-t-md border border-b-0 border-white/40 shadow-[0_-4px_16px_-4px_rgb(0_0_0/0.3)]">
                      <ThemeThumbnail tokens={item.tokens} className="h-16" />
                    </div>
                  </ThemeArt>
                  <span className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-2">
                    <span className="truncate text-[13px] font-medium">{item.name}</span>
                    {item.mood && <span className="shrink-0 text-2xs text-muted-foreground">{item.mood}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
