'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { CountUp } from '@/components/motion/motion';

// ============================================================
// Dashboard building blocks. Colours come from theme tokens only
// (Tailwind classes / currentColor), so every theme and dark mode work.
// ============================================================

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TEXT: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
  neutral: 'text-muted-foreground',
};
const FILL: Record<Tone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  neutral: 'bg-muted-foreground/50',
};
const SOFT: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
  info: 'bg-info-soft text-info',
  neutral: 'bg-muted text-muted-foreground',
};

/** A headline number with a label and an optional hint underneath. `value === undefined` shows a placeholder. */
export function Kpi({ label, value, hint, tone, href, icon }: { label: string; value: React.ReactNode | undefined; hint?: React.ReactNode; tone?: Tone; href?: string; icon?: React.ReactNode }) {
  const body = (
    <Card className={cn('flex h-full flex-col gap-2 p-4 transition-colors', href && 'hover:border-foreground/20')}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      {value === undefined ? (
        <span className="h-8 w-16 animate-pulse rounded-md bg-muted" aria-hidden />
      ) : (
        <span className={cn('text-[28px] font-bold leading-none tracking-tight tabular-nums', tone && TEXT[tone])}>{typeof value === 'number' ? <CountUp value={value} /> : value}</span>
      )}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Thin progress bar. */
export function Meter({ value, max, tone = 'primary', label }: { value: number; max: number; tone?: Tone; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className={cn('m-fill-w m-shine-once h-full rounded-full', FILL[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Progress ring with a value in the middle. */
export function Ring({ value, max, size = 112, stroke = 12, children, tone = 'primary', label }: { value: number; max: number; size?: number; stroke?: number; children?: React.ReactNode; tone?: Tone; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn(TEXT[tone], 'm-draw transition-[stroke-dasharray] duration-700')}
        />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
  tone: Tone;
}

/** Donut chart with a legend; segments in theme tones. */
export function Donut({ slices, total, size = 132, center, label }: { slices: Slice[]; total?: number; size?: number; center?: React.ReactNode; label: string }) {
  const sum = total ?? slices.reduce((n, s) => n + s.value, 0);
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
          {sum > 0 &&
            slices.map((s) => {
              const len = (s.value / sum) * c;
              // Slices sweep round one after another
              const delay = 0.15 + (offset / c) * 0.7;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${c}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  className={cn(TEXT[s.tone], 'm-sweep')}
                  style={{ animationDelay: `${delay}s`, animationDuration: `${Math.max(0.25, (len / c) * 0.8)}s` }}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center ?? <span className="text-2xl font-bold tabular-nums"><CountUp value={sum} /></span>}</div>
      </div>
      <ul className="m-legend min-w-[180px] flex-1 space-y-2 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2.5" style={{ ['--i' as string]: i }}>
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', FILL[s.tone])} aria-hidden />
            <span className="flex-1 text-muted-foreground">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Simple vertical bars with labels underneath (values are drawn to one scale). */
export function MiniBars({ bars, height = 110, label }: { bars: Array<{ label: string; value: number; tone?: Tone; title?: string }>; height?: number; label: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex items-end gap-2" style={{ height: height + 20 }} role="img" aria-label={label}>
      {bars.map((b, i) => (
        <div key={`${b.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={b.title}>
          <div className="flex w-full justify-center" style={{ height }}>
            <div className={cn('m-grow-y mt-auto w-full max-w-[34px] rounded-t-md rounded-b-sm', FILL[b.tone ?? 'primary'], b.value === 0 && 'opacity-30')} style={{ height: Math.max(3, (b.value / max) * height), animationDelay: `${i * 50}ms` }} />
          </div>
          <span className="w-full truncate text-center text-2xs text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A row in a “Needs your action” list. */
export function ActionRow({ tone, icon, title, detail, href, cta }: { tone: Tone; icon: React.ReactNode; title: string; detail?: string; href: string; cta: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4', SOFT[tone])}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
      <Link href={href} className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-3 text-xs font-semibold transition-colors hover:bg-subtle">
        {cta}
      </Link>
    </li>
  );
}

/** Coloured square for list icons. */
export function IconTile({ tone = 'primary', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4', SOFT[tone], className)}>{children}</span>;
}

export type { Tone };
