import React from 'react';

// Each sign-in portal brings its own shell:
//   /platform/*  → PlatformAuthShell (Super Admins)
//   /login etc.  → CompanyAuthShell (company workspace theme)
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
