'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from './feedback';

/** Counts up from 0 to `value` (respects reduced motion). */
export function AnimatedNumber({ value, durationMs = 700 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const initial = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(initial + (value - initial) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{display.toLocaleString()}</>;
}

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const TONE: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
  info: 'bg-info-soft text-info',
  neutral: 'bg-muted text-muted-foreground',
};

interface StatCardProps {
  title: string;
  value: string | number | undefined;
  description?: string;
  icon: React.ReactNode;
  trend?: string;
  tone?: Tone;
  href?: string;
  className?: string;
}

/** KPI card: label, animated value, optional trend + link. `value === undefined` shows a skeleton. */
export function StatCard({ title, value, description, icon, trend, tone = 'primary', href, className }: StatCardProps) {
  const body = (
    <div
      className={cn(
        'group relative h-full rounded-xl border border-border bg-surface p-4 shadow-card transition-all duration-200',
        href && 'hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-menu',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-muted-foreground">{title}</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5', TONE[tone])}>{icon}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </span>
        )}
        {trend && <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-xs font-medium text-success">{trend}</span>}
      </div>
      {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
      {href && (
        <ArrowUpRight className="absolute right-4 bottom-4 h-4 w-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:opacity-100" />
      )}
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}
