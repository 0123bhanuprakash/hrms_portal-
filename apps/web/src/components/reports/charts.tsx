'use client';

import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { CountUp, WhenSeen } from '@/components/motion/motion';

// Recharts draws on mount and glides to new values when data changes;
// WhenSeen holds the first draw until the chart is on screen.
const BAR_IN = { animationDuration: 800, animationEasing: 'ease-out' } as const;
const LINE_IN = { animationDuration: 1200, animationEasing: 'ease-in-out' } as const;

export const tooltipStyle = {
  contentStyle: { border: '1px solid hsl(var(--border))', background: 'hsl(var(--raised))', color: 'hsl(var(--foreground))', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: 'hsl(var(--foreground))' },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
  cursor: { fill: 'rgba(127, 127, 127, 0.12)' },
};
const axis = { stroke: '#8a8f98', fontSize: 11, tickLine: false, axisLine: false };

const TOKENS = ['primary', 'success', 'destructive', 'warning', 'border'] as const;
type Palette = Record<(typeof TOKENS)[number], string>;
const FALLBACK: Palette = { primary: '#6366f1', success: '#16a34a', destructive: '#dc2626', warning: '#d97706', border: '#e5e7eb' };

/** SVG attributes can't read CSS variables, so resolve the theme tokens to real colours (and follow theme switches). */
function usePalette(): Palette {
  const [p, setP] = useState<Palette>(FALLBACK);
  useEffect(() => {
    const read = () => {
      const css = getComputedStyle(document.documentElement);
      setP(Object.fromEntries(TOKENS.map((t) => {
        const v = css.getPropertyValue(`--${t}`).trim();
        return [t, v ? `hsl(${v.replace(/s+/g, ' ')})` : FALLBACK[t]];
      })) as Palette);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    obs.observe(document.head, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return p;
}

export function Kpi({ label, value, sub, icon, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; tone?: 'danger' | 'success' }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', tone === 'danger' && 'text-destructive', tone === 'success' && 'text-success')}>{typeof value === 'number' ? <CountUp value={value} /> : value}</p>
      {sub && <p className="mt-0.5 truncate text-2xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

/** Horizontal bars for a breakdown (department, location…). */
export function Breakdown({ title, rows, total, format = (n) => String(n) }: { title: string; rows: Array<{ label: string; count: number }>; total?: number; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const sum = total ?? rows.reduce((n, r) => n + r.count, 0);
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {format(r.count)}
                  {sum > 0 && <span className="ml-1.5 text-2xs">{Math.round((r.count / sum) * 100)}%</span>}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="m-fill-w h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%`, animationDelay: `${i * 60}ms` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No data</p>
      )}
    </Card>
  );
}

/** Joiners / leavers bars with a headcount line. */
export function TrendChart({ data }: { data: Array<{ label: string; joiners: number; leavers: number; headcount: number }> }) {
  const c = usePalette();
  return (
    <WhenSeen className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={c.border} />
          <XAxis dataKey="label" {...axis} />
          <YAxis yAxisId="moves" allowDecimals={false} {...axis} />
          <YAxis yAxisId="hc" orientation="right" allowDecimals={false} {...axis} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="moves" dataKey="joiners" name="Joined" fill={c.success} radius={[3, 3, 0, 0]} maxBarSize={18} {...BAR_IN} />
          <Bar yAxisId="moves" dataKey="leavers" name="Left" fill={c.destructive} radius={[3, 3, 0, 0]} maxBarSize={18} {...BAR_IN} />
          <Line yAxisId="hc" dataKey="headcount" name="Headcount" stroke={c.primary} strokeWidth={2} dot={false} type="linear" {...LINE_IN} animationBegin={300} />
        </ComposedChart>
      </ResponsiveContainer>
    </WhenSeen>
  );
}

/** Daily present / on leave / absent stacked bars. */
export function DailyChart({ data }: { data: Array<{ label: string; present: number; leave: number; absent: number }> }) {
  const c = usePalette();
  return (
    <WhenSeen className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={c.border} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="present" name="Present / WFH" stackId="a" fill={c.primary} maxBarSize={22} {...BAR_IN} />
          <Bar dataKey="leave" name="On leave" stackId="a" fill={c.warning} maxBarSize={22} {...BAR_IN} />
          <Bar dataKey="absent" name="Absent" stackId="a" fill={c.destructive} radius={[3, 3, 0, 0]} maxBarSize={22} {...BAR_IN} />
        </BarChart>
      </ResponsiveContainer>
    </WhenSeen>
  );
}
