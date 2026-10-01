/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

/** Company logo, or initials on the company's brand color. */
export function CompanyAvatar({
  name,
  logoUrl,
  color,
  size = 'md',
  className,
}: {
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = { sm: 'h-8 w-8 text-[11px] rounded-lg', md: 'h-10 w-10 text-xs rounded-xl', lg: 'h-16 w-16 text-lg rounded-2xl' }[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn(dims, 'object-contain bg-white border border-slate-200 dark:border-slate-700 p-1', className)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(dims, 'flex shrink-0 items-center justify-center font-bold text-white shadow-sm', className)}
      style={{ backgroundColor: color || '#4F46E5' }}
    >
      {initials(name)}
    </div>
  );
}
