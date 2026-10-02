'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { PlatformAuthShell } from '@/components/auth/auth-shells';
import { FormHeading, LoginForm } from '@/components/auth/auth-forms';
import { changePasswordPath, safeNext, useAuthHydrated } from '@/lib/auth/portal';
import { useAuthStore } from '@/store/useAuthStore';

function PlatformLogin() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const hydrated = useAuthHydrated();
  const { isAuthenticated, user } = useAuthStore();

  // Already signed in as a Super Admin → straight to the console
  useEffect(() => {
    if (hydrated && isAuthenticated && user?.isSuperAdmin) router.replace(user.mustChangePassword ? changePasswordPath(user) : '/super-admin');
  }, [hydrated, isAuthenticated, user, router]);

  return (
    <PlatformAuthShell>
      <FormHeading title="Platform sign in" description="Manage companies, themes and platform settings." />
      <LoginForm
        portal="platform"
        forgotHref="/platform/forgot-password"
        emailPlaceholder="admin@yourplatform.com"
        onSuccess={(u) => {
          if (u.mustChangePassword) return router.replace(changePasswordPath(u, next));
          toast.success(`Welcome back, ${u.firstName}`);
          const target = safeNext(next, '/super-admin');
          router.replace(target.startsWith('/super-admin') ? target : '/super-admin');
        }}
      />
    </PlatformAuthShell>
  );
}

export default function PlatformLoginPage() {
  return (
    <Suspense>
      <PlatformLogin />
    </Suspense>
  );
}
