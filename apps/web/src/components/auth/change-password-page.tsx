'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChangeTemporaryPasswordForm } from '@/components/auth/auth-forms';
import { loginPathFor, safeNext, useAuthHydrated } from '@/lib/auth/portal';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * "Choose your own password" step after signing in with a temporary one.
 * Shared by both portals; each page wraps it in its own shell.
 */
export function ChangePasswordStep({ home }: { home: '/app' | '/super-admin' }) {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const hydrated = useAuthHydrated();
  const { isAuthenticated, user, logout } = useAuthStore();

  const target = () => {
    const t = safeNext(next, home);
    return t.startsWith(home) ? t : home;
  };

  // Only for signed-in users who still have a temporary password
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) router.replace(loginPathFor(null));
    else if (!user.mustChangePassword) router.replace(target());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isAuthenticated, user, router]);

  if (!hydrated || !user?.mustChangePassword) return null;

  return (
    <ChangeTemporaryPasswordForm
      onDone={() => {
        toast.success('Password updated — welcome aboard!');
        router.replace(target());
      }}
      onSignOut={() => {
        const path = loginPathFor(user);
        logout();
        router.replace(path);
      }}
    />
  );
}
