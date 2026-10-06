'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, CalendarRange, MapPin } from 'lucide-react';
import { inputClass } from '@/components/ui/field';
import { useDepartments, useLocations } from '@/lib/company/org';
import { addDays, todayKey } from '@/lib/company/timesheets';
import type { ReportFilters } from '@/lib/company/reports';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

export type Period = '7d' | 'month' | 'quarter' | 'year' | 'custom';
const PERIODS: Array<{ key: Exclude<Period, 'custom'>; label: string }> = [
  { key: '7d', label: '7 days' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

export interface ReportParams extends ReportFilters {
  tab: string | null;
  period: Period;
  from: string;
  to: string;
}

/** Period presets → dates (to = today). */
function rangeOf(period: Period, today: string, custom: { from?: string | null; to?: string | null }) {
  switch (period) {
    case '7d':
      return { from: addDays(today, -6), to: today };
    case 'quarter': {
      const m = Number(today.slice(5, 7));
      const q = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: `${today.slice(0, 4)}-${String(q).padStart(2, '0')}-01`, to: today };
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'custom': {
      const from = custom.from ?? `${today.slice(0, 7)}-01`;
      const to = custom.to && custom.to < today ? custom.to : today;
      return from <= to ? { from, to } : { from: to, to };
    }
    default:
      return { from: `${today.slice(0, 7)}-01`, to: today };
  }
}

/** Reports state lives in the URL, so every tab shares it and links can be shared. */
export function useReportParams(): [ReportParams, (patch: Partial<Record<'tab' | 'period' | 'from' | 'to' | 'dept' | 'loc', string | null>>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = todayKey();
  const period = (['7d', 'month', 'quarter', 'year', 'custom'].includes(params.get('period') ?? '') ? params.get('period') : 'month') as Period;
  const { from, to } = rangeOf(period, today, { from: params.get('from'), to: params.get('to') });
  const value: ReportParams = {
    tab: params.get('tab'),
    period,
    from,
    to,
    departmentId: params.get('dept') ?? undefined,
    locationId: params.get('loc') ?? undefined,
  };
  const update = (patch: Partial<Record<'tab' | 'period' | 'from' | 'to' | 'dept' | 'loc', string | null>>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '' || (k === 'period' && v === 'month')) next.delete(k);
      else next.set(k, v);
    }
    if (patch.period && patch.period !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };
  return [value, update];
}

const fmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const shortDate = (k: string) => fmt.format(new Date(`${k}T00:00:00Z`));

export function FilterBar({ value, onChange, showPeriod = true }: { value: ReportParams; onChange: ReturnType<typeof useReportParams>[1]; showPeriod?: boolean }) {
  const departments = useDepartments();
  const locations = useLocations();
  const today = todayKey();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showPeriod && (
        <>
          <div className="flex rounded-lg border border-border bg-surface p-0.5" role="radiogroup" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={value.period === p.key}
                onClick={() => onChange({ period: p.key })}
                className={cn('rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors', value.period === p.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className={cn('flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold', value.period === 'custom' ? 'border-primary/40 bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface text-muted-foreground')}>
            <CalendarRange className="h-3.5 w-3.5" />
            <input type="date" aria-label="From" value={value.from} max={value.to} onChange={(e) => onChange({ period: 'custom', from: e.target.value, to: value.to })} className="w-[112px] bg-transparent outline-none" />
            –
            <input type="date" aria-label="To" value={value.to} min={value.from} max={today} onChange={(e) => onChange({ period: 'custom', from: value.from, to: e.target.value })} className="w-[112px] bg-transparent outline-none" />
          </label>
        </>
      )}
      {departments.data && departments.data.length > 0 && (
        <label className="relative">
          <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Select aria-label="Department" value={value.departmentId ?? ''} onChange={(e) => onChange({ dept: e.target.value || null })} className={cn(inputClass, 'h-9 w-auto pl-8 text-xs font-semibold', value.departmentId && 'border-primary/40 text-primary')}>
            <option value="">All departments</option>
            {departments.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </label>
      )}
      {locations.data && locations.data.length > 0 && (
        <label className="relative">
          <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Select aria-label="Location" value={value.locationId ?? ''} onChange={(e) => onChange({ loc: e.target.value || null })} className={cn(inputClass, 'h-9 w-auto pl-8 text-xs font-semibold', value.locationId && 'border-primary/40 text-primary')}>
            <option value="">All locations</option>
            {locations.data.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </label>
      )}
      {(value.departmentId || value.locationId) && (
        <button type="button" onClick={() => onChange({ dept: null, loc: null })} className="text-xs font-medium text-muted-foreground hover:text-foreground">Clear</button>
      )}
    </div>
  );
}

/** "▲ +2 vs before" */
export function Delta({ change, unit = '', goodWhenUp = true, label = 'vs before' }: { change: number | null; unit?: string; goodWhenUp?: boolean; label?: string }) {
  if (change === null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = change > 0;
  const flat = change === 0;
  const good = flat ? null : up === goodWhenUp;
  return (
    <span className={cn('text-xs font-bold', good === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive')}>
      {flat ? '•' : up ? '▲' : '▼'} {up ? '+' : ''}{change}{unit} <span className="font-medium text-muted-foreground">{label}</span>
    </span>
  );
}
