'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './button';

/** Shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-md bg-[length:200%_100%]',
        'bg-[linear-gradient(90deg,hsl(var(--muted))_25%,hsl(var(--subtle))_50%,hsl(var(--muted))_75%)]',
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface text-surface-foreground shadow-card', className)}>
      {children}
    </div>
  );
}

/** Card header row: title + description on the left, actions on the right. */
export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pb-3 pt-4', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 -m-3 rounded-full bg-primary/5 blur-xl" aria-hidden />
        <div className="m-layers absolute" aria-hidden><i /><i /><i /></div>
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground shadow-card [&_svg]:size-5">
          {icon}
        </div>
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-balance text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="text-destructive" />}
      title="Something went wrong"
      description={message}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" icon={<RefreshCw />} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      <span>
        <span className="font-medium tabular-nums text-foreground">
          {from}–{to}
        </span>{' '}
        of <span className="font-medium tabular-nums text-foreground">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <span className="mr-2 tabular-nums">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="secondary" size="icon-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/** Underline tabs with a sliding indicator. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string; icon?: React.ReactNode; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${value}"]`);
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, tabs.length]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn(
        'relative flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap rounded-t-md px-3 pb-2.5 pt-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn(active ? 'text-primary' : '')}>{tab.icon}</span>
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-2xs font-semibold tabular-nums',
                  active ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
      {indicator && (
        <span
          aria-hidden
          className="absolute bottom-0 h-0.5 rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ left: indicator.left + 8, width: indicator.width - 16 }}
        />
      )}
    </div>
  );
}
