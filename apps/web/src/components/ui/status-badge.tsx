import React from 'react';
import { clsx } from 'clsx';

export type StatusType = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING' | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status ? status.toUpperCase() : 'UNKNOWN';

  const styleMap: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    INACTIVE: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    SUSPENDED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
    LOCKED: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    PENDING: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  };

  const badgeStyle = styleMap[normalized] || 'bg-slate-500/15 text-slate-600 border-slate-500/30';

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase',
        badgeStyle,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {normalized}
    </span>
  );
}
