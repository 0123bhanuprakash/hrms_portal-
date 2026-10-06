'use client';

import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { companyKeys, type UserPreferences } from '@/lib/company/queries';
import { useAuthStore } from '@/store/useAuthStore';
import { Tooltip } from './tooltip';
import { cn } from '@/lib/cn';

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

type ViewTransitionDoc = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void>; ready: Promise<void>; skipTransition: () => void } };

/**
 * Light ↔ dark switch. The sun folds its rays into a crescent moon, and the
 * new theme spreads out from the switch in a soft glowing circle (where the
 * browser supports view transitions; elsewhere it simply swaps).
 * Until someone picks, the portal follows the device; after that their
 * choice is saved to their preferences (applied again at sign-in).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const button = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);

  const [flipping, setFlipping] = useState<boolean | null>(null);

  useEffect(() => setMounted(true), []);
  // While flipping, show the new position first so the knob can move before the colours swap
  const dark = flipping ?? (mounted && resolvedTheme === 'dark');

  const save = async (mode: 'light' | 'dark') => {
    // Signed out (sign-in pages): local only — a 401 here would bounce to /login
    if (!signedIn) return;
    try {
      const res = await api.patch('/users/me/preferences', { theme: mode });
      queryClient.setQueryData<UserPreferences>(companyKeys.preferences, res.data.data);
    } catch {
      // Already persisted locally by next-themes
    }
  };

  const flip = async () => {
    if (busy.current) return;
    busy.current = true;
    const mode = dark ? 'light' : 'dark';
    const doc = document as ViewTransitionDoc;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-motion') === 'reduce';

    if (doc.startViewTransition && !calm && button.current) {
      // Circle grows from the middle of the switch to the farthest corner
      const r = button.current.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const root = document.documentElement;
      root.style.setProperty('--vt-x', `${x}px`);
      root.style.setProperty('--vt-y', `${y}px`);
      root.style.setProperty('--vt-max', `${far + 60}px`);
      root.classList.add('m-reveal');

      const glow = document.createElement('div');
      glow.className = 'm-reveal-glow';
      root.style.setProperty('--vt-tint', mode === 'dark' ? '150 170 255' : '255 200 110');

      let started = false;
      const vt = doc.startViewTransition(() => {
        started = true;
        flushSync(() => setFlipping(mode === 'dark'));
        root.classList.toggle('dark', mode === 'dark');
        root.classList.toggle('light', mode === 'light');
        root.style.colorScheme = mode;
        document.body.appendChild(glow);
      });
      // If the page is not drawing (hidden window), don't leave the switch waiting
      const stuck = setTimeout(() => !started && vt.skipTransition(), 1500);
      try {
        await vt.finished;
      } catch {
        // Skipped transitions reject; the theme is still switched below
      } finally {
        clearTimeout(stuck);
        glow.remove();
        root.classList.remove('m-reveal');
        setTheme(mode);
        setFlipping(null);
        busy.current = false;
      }
    } else {
      setFlipping(mode === 'dark');
      await new Promise((r) => setTimeout(r, 260));
      setTheme(mode);
      setFlipping(null);
      busy.current = false;
    }
    void save(mode);
  };

  return (
    <Tooltip content={dark ? 'Switch to light' : 'Switch to dark'}>
      <button
        ref={button}
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Dark mode"
        onClick={flip}
        className={cn('m-switch ml-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      >
        <span className="m-switch-stars" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="m-switch-knob" aria-hidden>
          {RAYS.map((a) => (
            <i key={a} style={{ ['--a' as string]: `${a}deg` }} />
          ))}
          <b />
        </span>
      </button>
    </Tooltip>
  );
}
