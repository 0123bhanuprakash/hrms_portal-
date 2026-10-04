'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { companyKeys, type UserPreferences } from '@/lib/company/queries';
import { useAuthStore } from '@/store/useAuthStore';
import { Tooltip } from './tooltip';
import { cn } from '@/lib/cn';

/**
 * Light ↔ dark switch: one click flips it (the sun turns into a moon).
 * Until someone picks, the portal follows the device; after that their
 * choice is saved to their preferences (applied again at sign-in).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const [flipping, setFlipping] = useState<boolean | null>(null);

  useEffect(() => setMounted(true), []);
  // While flipping, show the new position first so the knob can move before the colours swap
  const dark = flipping ?? (mounted && resolvedTheme === 'dark');

  const flip = async () => {
    const mode = dark ? 'light' : 'dark';
    setFlipping(mode === 'dark');
    await new Promise((r) => setTimeout(r, 260));
    setTheme(mode);
    setFlipping(null);
    // Signed out (sign-in pages): local only — a 401 here would bounce to /login
    if (!signedIn) return;
    try {
      const res = await api.patch('/users/me/preferences', { theme: mode });
      queryClient.setQueryData<UserPreferences>(companyKeys.preferences, res.data.data);
    } catch {
      // Already persisted locally by next-themes
    }
  };

  return (
    <Tooltip content={dark ? 'Switch to light' : 'Switch to dark'}>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Dark mode"
        onClick={flip}
        className={cn('m-switch ml-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      >
        <span />
      </button>
    </Tooltip>
  );
}
