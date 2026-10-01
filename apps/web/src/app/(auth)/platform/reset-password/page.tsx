'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlatformAuthShell } from '@/components/auth/auth-shells';
import { ResetPasswordForm } from '@/components/auth/auth-forms';

function Reset() {
  const token = useSearchParams().get('token') ?? '';
  return <ResetPasswordForm token={token} loginHref="/platform/login" forgotHref="/platform/forgot-password" />;
}

export default function PlatformResetPasswordPage() {
  return (
    <PlatformAuthShell>
      <Suspense>
        <Reset />
      </Suspense>
    </PlatformAuthShell>
  );
}
