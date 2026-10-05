'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlatformAuthShell } from '@/components/auth/auth-shells';
import { VerifyEmailStatus } from '@/components/auth/auth-forms';

function Verify() {
  const params = useSearchParams();
  const change = params.get('change');
  const token = change ?? params.get('token') ?? '';
  return <VerifyEmailStatus token={token} change={Boolean(change)} loginHref="/platform/login" />;
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
