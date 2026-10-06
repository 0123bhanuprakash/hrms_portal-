/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { BrandMedia } from '@/components/brand/brand-media';

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
      <span className={cn(dims, 'flex shrink-0 overflow-hidden bg-white border border-border p-1', className)}>
        <BrandMedia src={logoUrl} alt={`${name} logo`} className="h-full w-full" />
      </span>
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
