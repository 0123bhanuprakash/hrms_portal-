'use client';

import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';

// ============================================================
// Small building blocks for long lists that page on the server:
// a debounced value, a search box and quick-filter chips with counts.
// ============================================================

/** `value`, but only after it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Search input with the magnifier icon. */
export function SearchField({ value, onChange, placeholder, label, className }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="h-8 pl-8 text-xs" />
    </div>
  );
}

/** One-choice chips, each with an optional count ("Bench 4"). */
export function FilterChips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Array<{ key: T; label: string; count?: number; hidden?: boolean }>; label: string }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
      {options
        .filter((o) => !o.hidden)
        .map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={value === o.key}
            onClick={() => onChange(o.key)}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors', value === o.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted')}
          >
            {o.label}
            {o.count !== undefined && <span className={cn('tabular-nums', value === o.key ? 'opacity-80' : 'text-foreground/70')}>{o.count}</span>}
          </button>
        ))}
    </div>
  );
}
