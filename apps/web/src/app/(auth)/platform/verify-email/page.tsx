'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlatformAuthShell } from '@/components/auth/auth-shells';
import { VerifyEmailStatus } from '@/components/auth/auth-forms';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  return <VerifyEmailStatus token={token} loginHref="/platform/login" />;
}

export default function PlatformVerifyEmailPage() {
  return (
    <PlatformAuthShell>
      <Suspense>
        <Verify />
      </Suspense>
    </PlatformAuthShell>
  );
}
