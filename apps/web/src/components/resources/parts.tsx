'use client';

import React, { useState } from 'react';
import { Check, Pause, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { statusLabel, type ResFace, type ResourceRequest } from '@/lib/company/resources';
import { cn } from '@/lib/cn';

/** Lead → PM → Delivery Director → PMO, with where it is now (the current dot breathes). */
export function StepPath({ r, size = 'md' }: { r: Pick<ResourceRequest, 'kind' | 'status' | 'step' | 'path' | 'raisedBy'>; size?: 'sm' | 'md' }) {
  if (r.kind === 'RELEASE') return null;
  const closed = !['OPEN', 'ON_HOLD', 'AWAITING_CONSENT'].includes(r.status);
  const steps = [{ key: 'LEAD', label: 'Lead', person: r.raisedBy ? { firstName: r.raisedBy.firstName } : null }, ...r.path.map((p) => ({ key: p.step, label: p.label === 'Project manager' ? 'PM' : p.label, person: p.person }))];
  const at = steps.findIndex((s) => s.key === r.step);
  const done = (i: number) => (closed ? r.status === 'FILLED' || i <= at : i < at);
  return (
    <ol className={cn('flex items-center', size === 'sm' ? 'gap-1' : 'gap-1.5')} aria-label="Approval path">
      {steps.map((s, i) => {
        const current = !closed && i === at;
        const failed = closed && r.status !== 'FILLED' && i === at;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            {i > 0 && <span className={cn('h-0.5 rounded-full', size === 'sm' ? 'w-3' : 'w-6', done(i) || current ? 'bg-primary' : 'bg-border')} />}
            <span className="flex items-center gap-1.5" title={`${s.label}${s.person ? ` · ${s.person.firstName}` : ''}`}>
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                  size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5',
                  failed ? 'bg-destructive text-white' : current ? (r.status === 'ON_HOLD' ? 'bg-warning text-white' : 'bg-primary text-primary-foreground motion-safe:animate-[pulse_7s_ease-in-out_infinite]') : done(i) ? 'bg-primary/80 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {failed ? <X className="h-3 w-3" /> : current && r.status === 'ON_HOLD' ? <Pause className="h-2.5 w-2.5" /> : done(i) ? <Check className="h-3 w-3" /> : null}
              </span>
              {size === 'md' && (
                <span className="leading-tight">
                  <span className={cn('block text-[11px] font-semibold', current ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
                  {s.person && <span className="block text-[10px] text-muted-foreground">{s.person.firstName}</span>}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusPill({ r }: { r: Pick<ResourceRequest, 'status' | 'step' | 'kind'> }) {
  const s = statusLabel(r);
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

/** "56% booked" bar for a person (green → amber → red). */
export function LoadBar({ booked, className }: { booked: number; className?: string }) {
  const v = Math.max(0, Math.min(100, booked));
  return (
    <span className={cn('block h-1.5 overflow-hidden rounded-full bg-muted', className)} aria-label={`${v}% booked`}>
      <span className={cn('m-fill-w block h-full rounded-full', v >= 100 ? 'bg-destructive' : v >= 70 ? 'bg-warning' : 'bg-success')} style={{ width: `${v}%` }} />
    </span>
  );
}

export function Who({ face, note, className }: { face: ResFace | { firstName: string; lastName: string; avatarUrl: string | null; id: string } | null; note?: React.ReactNode; className?: string }) {
  if (!face) return null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs', className)}>
      <PersonAvatar person={face} size="xs" />
      {note && <span className="text-muted-foreground">{note}</span>}
      <b className="truncate font-semibold">{face.firstName} {face.lastName}</b>
    </span>
  );
}

/** Chips with type-to-add and suggestions (skills, tech stack). */
export function TagInput({ value, onChange, suggestions = [], placeholder = 'Add…', max = 15, id }: { value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string; max?: number; id?: string }) {
  const [text, setText] = useState('');
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());
  const add = (t: string) => {
    const clean = t.trim().replace(/\s+/g, ' ');
    if (!clean || has(clean) || value.length >= max) return setText('');
    onChange([...value, clean]);
    setText('');
  };
  const hints = text.trim() ? suggestions.filter((s) => s.toLowerCase().includes(text.trim().toLowerCase()) && !has(s)).slice(0, 6) : [];
  return (
    <div>
      <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border border-input bg-surface px-2 py-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-foreground">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="rounded hover:bg-primary/15">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(hints[0] && hints[0].toLowerCase().startsWith(text.trim().toLowerCase()) ? hints[0] : text);
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length >= max ? '' : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      {hints.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {hints.map((h) => (
            <button key={h} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(h)} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
              + {h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
