'use client';

import { Suspense } from 'react';
import { PlatformAuthShell } from '@/components/auth/auth-shells';
import { ChangePasswordStep } from '@/components/auth/change-password-page';

export default function PlatformChangePasswordPage() {
  return (
    <PlatformAuthShell>
      <Suspense>
        <ChangePasswordStep home="/super-admin" />
      </Suspense>
    </PlatformAuthShell>
  );
}
