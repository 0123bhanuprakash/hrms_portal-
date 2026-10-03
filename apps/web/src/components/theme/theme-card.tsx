'use client';

import React from 'react';
import type { ThemeTokens } from '@hrms/types';
import { themeToInlineStyle } from '@/lib/theme/engine';
import { cn } from '@/lib/cn';

/** Miniature portal rendered in the theme's own tokens (scoped via inline CSS variables). */
export function ThemeThumbnail({ tokens, mode = 'light', className }: { tokens: ThemeTokens; mode?: 'light' | 'dark'; className?: string }) {
  return (
    <div
      style={themeToInlineStyle(tokens, mode)}
      className={cn('pointer-events-none flex h-32 select-none overflow-hidden bg-background font-sans text-foreground', className)}
      aria-hidden
    >
      <div className="flex w-14 shrink-0 flex-col gap-1.5 border-r border-sidebar-border bg-sidebar p-2">
        <span className="mb-1 h-4 w-4 rounded bg-primary" />
        <span className="h-2 w-full rounded-sm bg-sidebar-active" />
        <span className="h-2 w-9 rounded-sm bg-sidebar-muted/40" />
        <span className="h-2 w-8 rounded-sm bg-sidebar-muted/40" />
        <span className="h-2 w-10 rounded-sm bg-sidebar-muted/40" />
      </div>
      <div className="flex-1 space-y-2 p-2.5">
        <div className="flex items-center justify-between">
          <span className="h-2.5 w-16 rounded-sm bg-foreground/80" />
          <span className="h-4 w-10 rounded-md bg-primary" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-1.5 shadow-card">
              <span className="block h-1.5 w-8 rounded-sm bg-muted-foreground/40" />
              <span className="mt-1.5 block h-2.5 w-6 rounded-sm bg-foreground/80" />
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <span className="h-2.5 w-8 rounded-full bg-success-soft" />
          <span className="h-2.5 w-8 rounded-full bg-warning-soft" />
          <span className="h-2.5 w-8 rounded-full bg-primary-soft" />
        </div>
      </div>
    </div>
  );
}

/** Color dots summarising a theme. */
export function ThemeSwatches({ tokens }: { tokens: ThemeTokens }) {
  const p = tokens.light;
  return (
    <div className="flex -space-x-1">
      {[p.primary, p.sidebar, p.background, tokens.dark.background, p.success].map((c, i) => (
        <span key={i} className="h-4 w-4 rounded-full border-2 border-surface shadow-card" style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}
