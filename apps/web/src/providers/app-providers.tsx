'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MutationCache, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MotionVisibility, SuccessTick } from '@/components/motion/motion';
import { useAuthStore } from '@/store/useAuthStore';
import { reportUnhandledSaveError } from '@/lib/save-errors';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // A failed save always tells the user, even where the screen forgot to
        mutationCache: new MutationCache({ onError: (error, _vars, _ctx, mutation) => reportUnhandledSaveError(error, mutation) }),
        defaultOptions: {
          queries: {
            // Data older than a minute is re-fetched when a screen opens or you come back to the tab
            staleTime: 60_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ClearCacheOnUserChange />
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <MotionVisibility />
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
          {children}
        </TooltipProvider>
        <Toaster
          position="top-right"
          offset={64}
          duration={4000}
          closeButton
          icons={{ success: <SuccessTick size={20} /> }}
          toastOptions={{
            classNames: {
              toast:
                'group !rounded-lg !border !border-border !bg-raised !text-raised-foreground !shadow-menu !font-sans',
              description: '!text-muted-foreground',
              closeButton: '!border-border !bg-raised !text-muted-foreground',
            },
          }}
        />
      </NextThemesProvider>
    </QueryClientProvider>
  );
}

/**
 * Cached queries use keys like ['leave', 'requests', { view: 'mine' }], where
 * "mine" means whoever is signed in. When the signed-in user (or company)
 * changes, drop everything so the next person never sees the previous
 * person's data.
 */
function ClearCacheOnUserChange() {
  const queryClient = useQueryClient();
  const who = useAuthStore((s) => `${s.user?.id ?? ''}:${s.companyId ?? ''}`);
  const last = useRef(who);
  useEffect(() => {
    // Signing out, or one person replacing another. (Not the restore of a saved
    // session on page load: nobody → someone, with nothing to forget.)
    if (last.current !== who && last.current !== ':') queryClient.clear();
    last.current = who;
  }, [who, queryClient]);
  return null;
}
