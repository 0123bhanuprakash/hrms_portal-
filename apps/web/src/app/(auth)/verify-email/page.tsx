'use client';

import { useSearchParams } from 'next/navigation';
import { CompanyAuthPage } from '@/components/auth/company-auth-page';
import { VerifyEmailStatus } from '@/components/auth/auth-forms';

function Verify({ loginHref }: { loginHref: string }) {
  const token = useSearchParams().get('token') ?? '';
  return <VerifyEmailStatus token={token} loginHref={loginHref} />;
}

export default function VerifyEmailPage() {
  return <CompanyAuthPage>{({ href }) => <Verify loginHref={href('/login')} />}</CompanyAuthPage>;
}
