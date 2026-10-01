'use client';

import { PlatformAuthShell } from '@/components/auth/auth-shells';
import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export default function PlatformForgotPasswordPage() {
  return (
    <PlatformAuthShell>
      <ForgotPasswordForm loginHref="/platform/login" />
    </PlatformAuthShell>
  );
}
