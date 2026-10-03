'use client';

import { useSearchParams } from 'next/navigation';
import { CompanyAuthPage } from '@/components/auth/company-auth-page';
import { ResetPasswordForm } from '@/components/auth/auth-forms';

function Reset({ href }: { href: (path: string) => string }) {
  const token = useSearchParams().get('token') ?? '';
  return <ResetPasswordForm token={token} loginHref={href('/login')} forgotHref={href('/forgot-password')} />;
}

export default function ResetPasswordPage() {
  return <CompanyAuthPage>{({ href }) => <Reset href={href} />}</CompanyAuthPage>;
}
