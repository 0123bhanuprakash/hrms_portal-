'use client';

import React, { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';

/**
 * The page someone just clicked through to, until it has arrived.
 * Next keeps the old page on screen while the new one loads; this lets the
 * shell switch at once instead (menu highlight + placeholder page), so a click
 * never looks stuck on the page you are leaving.
 */
export function usePendingNav(pathname: string): string | null {
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      // Only pages inside this shell
      if (!url.pathname.startsWith('/app')) return;
      setPending(url.pathname);
    };
    // Capture phase: runs before Next's <Link> handler starts the navigation
    document.addEventListener('click', onClick, true);
    const back = () => setPending(null);
    window.addEventListener('popstate', back);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', back);
    };
  }, []);

  // Arrived (or went somewhere else)
  useEffect(() => setPending(null), [pathname]);

  // Never hold the placeholder forever if a navigation is cancelled
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 15_000);
    return () => clearTimeout(t);
  }, [pending]);

  return pending;
}

/** A thin bar that runs along the top while a page is on its way. */
export function NavProgress({ active }: { active: boolean }) {
  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden transition-opacity duration-300', active ? 'opacity-100' : 'opacity-0')}>
      {active && <div className="m-nav-progress h-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />}
    </div>
  );
}

/** Stand-in page: title, a row of tiles and two cards — the rough shape of most pages. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
