'use client';

import { CompanyAuthPage } from '@/components/auth/company-auth-page';
import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export default function ForgotPasswordPage() {
  return <CompanyAuthPage>{({ href }) => <ForgotPasswordForm loginHref={href('/login')} />}</CompanyAuthPage>;
}
