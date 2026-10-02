/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
} as const;

/** Profile photo, or initials on a soft tint. */
export function PersonAvatar({
  person,
  size = 'md',
  className,
}: {
  person: { firstName: string; lastName: string; avatarUrl?: string | null };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const name = `${person.firstName} ${person.lastName}`;
  if (person.avatarUrl) {
    return <img src={person.avatarUrl} alt={name} className={cn(SIZES[size], 'shrink-0 rounded-full border border-border object-cover', className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(SIZES[size], 'flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-soft-foreground', className)}
    >
      {initials(name)}
    </span>
  );
}

/** Avatar + name + title, one line each. */
export function PersonRow({
  person,
}: {
  person: { firstName: string; lastName: string; email: string; avatarUrl?: string | null; designation?: { name: string } | null };
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PersonAvatar person={person} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{person.firstName} {person.lastName}</p>
        <p className="truncate text-xs text-muted-foreground">{person.designation?.name ?? person.email}</p>
      </div>
    </div>
  );
}
