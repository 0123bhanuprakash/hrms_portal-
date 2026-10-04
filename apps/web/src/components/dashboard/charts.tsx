'use client';

import React, { useEffect } from 'react';
import { ArrowDownUp, BarChart3, ChartPie, CircleDot, LayoutGrid, LineChart, List, AreaChart, CalendarDays, Rows3, TrendingUp, Users } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useUiState, useUiStateReady } from '@/lib/preferences/ui-state';
import { Donut, MiniBars, Ring, type Slice, type Tone } from '@/components/dashboard/widgets';
import { cn } from '@/lib/cn';

// ============================================================
// "View as": every chart card can be shown in a few styles. The
// choice is remembered per chart for the signed-in person (this
// browser). Colours come from theme tones, so every theme works.
// ============================================================

export type ChartStyle = 'bars' | 'line' | 'area' | 'donut' | 'rings' | 'list' | 'lollipop' | 'blocks' | 'tiles' | 'calendar' | 'mirror' | 'bridge' | 'faces';

const STYLE_META: Record<ChartStyle, { label: string; icon: React.ElementType }> = {
  bars: { label: 'Bars', icon: BarChart3 },
  line: { label: 'Line', icon: LineChart },
  area: { label: 'Area', icon: AreaChart },
  donut: { label: 'Donut', icon: ChartPie },
  rings: { label: 'Rings', icon: CircleDot },
  list: { label: 'Bars', icon: List },
  lollipop: { label: 'Lollipop', icon: Rows3 },
  blocks: { label: 'Blocks', icon: LayoutGrid },
  tiles: { label: 'Tiles', icon: LayoutGrid },
  calendar: { label: 'Calendar', icon: CalendarDays },
  mirror: { label: 'Joined vs left', icon: ArrowDownUp },
  bridge: { label: 'Headcount bridge', icon: TrendingUp },
  faces: { label: 'Faces', icon: Users },
};

/** The person's chosen style for one chart — saved on their account (falls back to the company default, then `initial`). */
export function useChartStyle<T extends ChartStyle>(chart: string, options: readonly T[], initial: T): [T, (s: T) => void] {
  const userId = useAuthStore((s) => s.user?.id);
  const [style, setStyle] = useUiState<T>(`chart:${chart}`, initial, (v): v is T => typeof v === 'string' && (options as readonly string[]).includes(v));
  const ready = useUiStateReady();
  // Choices made before they were saved on the account lived in this browser: move them over once
  useEffect(() => {
    if (!ready || !userId) return;
    const legacy = `chart-style-${userId}-${chart}`;
    try {
      const old = localStorage.getItem(legacy) as T | null;
      if (old && (options as readonly string[]).includes(old) && old !== style) setStyle(old);
      if (old) localStorage.removeItem(legacy);
    } catch {
      /* storage unavailable */
    }
    // run once per chart when settings arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, chart]);
  return [style, setStyle];
}

/** Small segmented "View as" control. */
export function ViewAs<T extends ChartStyle>({ options, value, onChange, label = 'View as' }: { options: readonly T[]; value: T; onChange: (s: T) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5">
      {options.map((o) => {
        const Icon = STYLE_META[o].icon;
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={STYLE_META[o].label}
            title={STYLE_META[o].label}
            onClick={() => onChange(o)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5',
              on ? 'bg-surface text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

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

export interface Point {
  label: string;
  value: number;
  title?: string;
}

/** Line or area over time; the line draws itself in. */
export function TrendChart({ points, area, tone = 'primary', height = 120, label }: { points: Point[]; area?: boolean; tone?: Tone; height?: number; label: string }) {
  const w = 600;
  const h = height;
  const pad = 14;
  const vals = points.map((p) => p.value);
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const xy = points.map((p, i) => [pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1), pad + (1 - (p.value - min) / (max - min || 1)) * (h - pad * 2)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('w-full', TEXT[tone])} style={{ height: h }} role="img" aria-label={`${label}: ${points.map((p) => `${p.label} ${p.value}`).join(', ')}`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={w} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke="currentColor" strokeOpacity={0.08} vectorEffect="non-scaling-stroke" />)}
        {area && <path className="m-fade" d={`${d} L${xy.at(-1)![0]} ${h} L${xy[0]![0]} ${h} Z`} fill="currentColor" fillOpacity={0.14} />}
        <path className="m-line" style={{ ['--m-len' as string]: 1400 }} d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-2xs text-muted-foreground">
        {points.map((p, i) => <span key={i} title={p.title}>{p.label}</span>)}
      </div>
    </div>
  );
}

/** Labelled horizontal bars. */
export function HBars({ rows, tone = 'primary' }: { rows: Array<{ label: string; value: number; max?: number; right?: string; tone?: Tone }>; tone?: Tone }) {
  const top = Math.max(1, ...rows.map((r) => r.max ?? r.value));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('m-fill-w h-full rounded-full', FILL[r.tone ?? tone])} style={{ width: `${((r.value / (r.max ?? top)) * 100).toFixed(1)}%`, animationDelay: `${i * 60}ms` }} />
          </div>
          <span className="text-right text-xs font-semibold tabular-nums">{r.right ?? r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Lollipop: a thin stem with a dot at the value. */
export function Lollipop({ rows, tone = 'primary' }: { rows: Array<{ label: string; value: number }>; tone?: Tone }) {
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3.5">
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{r.label}</span>
          <div className="relative h-0.5 bg-border">
            <div className={cn('m-fill-w absolute inset-y-0 left-0', FILL[tone])} style={{ width: `${(r.value / top) * 100}%`, animationDelay: `${i * 60}ms` }}>
              <span className={cn('absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ring-4 ring-primary-soft', FILL[tone])} />
            </div>
          </div>
          <span className="text-right text-xs font-semibold tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const BLOCK_TONES = ['bg-primary', 'bg-info', 'bg-success', 'bg-warning', 'bg-muted-foreground/70', 'bg-destructive'];
/** Blocks sized by share (a simple treemap). */
export function Blocks({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const total = rows.reduce((n, r) => n + r.value, 0) || 1;
  return (
    <div className="flex h-40 flex-wrap gap-1.5 overflow-hidden">
      {rows.map((r, i) => (
        <div
          key={r.label}
          title={`${r.label} · ${r.value}`}
          className={cn('m-pop flex min-w-[64px] flex-col justify-end rounded-lg p-2 text-xs font-semibold text-white', BLOCK_TONES[i % BLOCK_TONES.length])}
          style={{ flexGrow: r.value, flexBasis: `${Math.max(14, (r.value / total) * 100 - 2)}%`, animationDelay: `${i * 60}ms` }}
        >
          <span className="truncate">{r.label}</span>
          <span className="text-base tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** One ring per item. */
export function RingsRow({ items }: { items: Array<{ label: string; value: number; max: number; tone?: Tone; center?: React.ReactNode }> }) {
  return (
    <div className="flex flex-wrap justify-around gap-4">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center gap-1.5">
          <Ring value={it.value} max={it.max} size={84} stroke={9} tone={it.tone} label={`${it.label}: ${it.value} of ${it.max}`}>
            <span className="text-base font-bold tabular-nums">{it.center ?? it.value}</span>
          </Ring>
          <span className="max-w-[7rem] truncate text-xs text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export { Donut, MiniBars, type Slice };
