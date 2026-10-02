'use client';

import { CompanyAuthPage } from '@/components/auth/company-auth-page';
import { ChangePasswordStep } from '@/components/auth/change-password-page';

export default function ChangePasswordPage() {
  return <CompanyAuthPage>{() => <ChangePasswordStep home="/app" />}</CompanyAuthPage>;
}
