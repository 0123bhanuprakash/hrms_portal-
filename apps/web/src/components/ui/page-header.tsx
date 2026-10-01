import React from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  /** Short explanation under the title (alias: subtitle) */
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Primary actions, right-aligned */
  action?: React.ReactNode;
  /** Small label above the title, e.g. a section name */
  eyebrow?: React.ReactNode;
  className?: string;
}

/** Standard page title block used at the top of every screen. */
export function PageHeader({ title, description, subtitle, action, eyebrow, className }: PageHeaderProps) {
  const text = description ?? subtitle;
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-medium text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {text && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{text}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
