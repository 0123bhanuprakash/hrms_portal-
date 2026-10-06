'use client';

import React from 'react';
import type { AccessScope } from '@hrms/types';
import { Crown, Lock } from 'lucide-react';
import { SCOPE_LABELS } from '@/lib/access/use-access';
import { cn } from '@/lib/cn';

// ─── Automatic role colours ─────────────────────────────────
// Each role gets one hue, used everywhere (Users chips, role cards, explorer sources).
const KNOWN: Record<string, number> = {
  company_admin: 38, // amber
  hr: 330, // pink
  manager: 243, // indigo
  team_lead: 173, // teal
  it_admin: 199, // sky
  finance: 88, // lime
  devops: 262, // violet
  pmo: 22, // orange
  employee: 215, // slate (low saturation)
};
const SPARE = [350, 280, 140, 190, 55, 300, 160, 10, 230, 110];

export function roleHue(role: { key?: string | null; name: string; isOwner?: boolean }): { h: number; s: number } {
  if (role.isOwner) return { h: 38, s: 92 };
  if (role.key && role.key in KNOWN) return { h: KNOWN[role.key]!, s: role.key === 'employee' ? 18 : 72 };
  let hash = 0;
  for (const c of role.name.toLowerCase()) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return { h: SPARE[hash % SPARE.length]!, s: 68 };
}

/** CSS variables for a role colour; use with the `role-*` utility classes below. */
export function roleStyle(role: { key?: string | null; name: string; isOwner?: boolean }): React.CSSProperties {
  const { h, s } = roleHue(role);
  return { ['--rh' as string]: String(h), ['--rs' as string]: `${s}%` };
}

/** Text / soft background / border in the role colour, readable in light and dark. */
export const roleText = 'text-[hsl(var(--rh)_var(--rs)_36%)] dark:text-[hsl(var(--rh)_var(--rs)_72%)]';
export const roleSoft = 'bg-[hsl(var(--rh)_var(--rs)_50%/0.12)]';
export const roleBorder = 'border-[hsl(var(--rh)_var(--rs)_50%/0.35)]';
export const roleSolid = 'bg-[hsl(var(--rh)_var(--rs)_46%)]';

export function RoleChip({
  role,
  className,
  children,
  onClick,
  active,
  dashed,
}: {
  role: { key?: string | null; name: string; isOwner?: boolean; status?: string };
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dashed?: boolean;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      style={roleStyle(role)}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-all',
        roleText,
        dashed ? cn('border-dashed bg-transparent', roleBorder) : cn('border-transparent', roleSoft),
        role.status && role.status !== 'ACTIVE' && 'opacity-50',
        onClick && 'hover:-translate-y-px',
        active && cn('ring-2 ring-offset-1 ring-offset-surface', 'ring-[hsl(var(--rh)_var(--rs)_50%/0.5)]'),
        className,
      )}
    >
      {role.isOwner && <Crown className="h-3 w-3" />}
      {role.name}
      {children}
    </Tag>
  );
}

// ─── Scope ladder ───────────────────────────────────────────

export const SCOPE_ORDER: AccessScope[] = ['own', 'direct_reports', 'all_reports', 'department', 'department_tree', 'location', 'company'];
export const SCOPE_SHORT: Record<AccessScope, string> = {
  own: 'Self',
  direct_reports: 'Direct',
  all_reports: 'Team',
  department: 'Dept',
  department_tree: 'Dept+',
  location: 'Office',
  company: 'Company',
};

/**
 * Scope as a ladder (Self → Company) instead of a dropdown. Steps the
 * permission doesn't support are hidden; ones you can't give are faded + locked.
 */
export function ScopeLadder({
  scopes,
  value,
  onChange,
  allowed = () => true,
  disabled,
  label,
}: {
  scopes: AccessScope[];
  value: AccessScope | null;
  onChange?: (s: AccessScope) => void;
  allowed?: (s: AccessScope) => boolean;
  disabled?: boolean;
  label: string;
}) {
  const at = value ? scopes.indexOf(value) : -1;
  return (
    <span role="radiogroup" aria-label={`Scope for ${label}`} className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
      {scopes.map((s, i) => {
        const ok = allowed(s);
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === value}
            title={`${SCOPE_LABELS[s].label} — ${SCOPE_LABELS[s].hint}${ok ? '' : ' (more than you have yourself)'}`}
            disabled={disabled || !ok}
            onClick={() => onChange?.(s)}
            className={cn(
              'flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-all duration-300',
              s === value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : i < at
                  ? 'bg-primary-soft text-primary-soft-foreground'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground',
              !ok && 'opacity-40',
              disabled && s !== value && 'hover:bg-transparent',
            )}
          >
            {!ok && <Lock className="h-2.5 w-2.5" />}
            {SCOPE_SHORT[s]}
          </button>
        );
      })}
    </span>
  );
}

/** Tiny read-only ladder (7 squares) for lists. */
export function MiniLadder({ scope }: { scope: AccessScope | null }) {
  const at = scope ? SCOPE_ORDER.indexOf(scope) : -1;
  return (
    <span className="inline-flex gap-0.5" title={scope ? `${SCOPE_LABELS[scope].label} — ${SCOPE_LABELS[scope].hint}` : 'No scope (a company setting)'} aria-label={scope ? SCOPE_LABELS[scope].label : 'Company setting'}>
      {SCOPE_ORDER.map((s, i) => (
        <i key={s} className={cn('h-2.5 w-3 rounded-[3px]', i === at ? 'bg-primary' : i < at ? 'bg-primary/35' : 'bg-muted')} />
      ))}
    </span>
  );
}

/** Catalog modules in a fixed order with short names (role heat strips, grid). */
export const ADMIN_MODULES: Array<{ key: string; short: string }> = [
  { key: 'people', short: 'People' },
  { key: 'time', short: 'Time' },
  { key: 'engage', short: 'Engage' },
  { key: 'work', short: 'Work' },
  { key: 'pay', short: 'Pay' },
  { key: 'insights', short: 'Reports' },
  { key: 'admin', short: 'Admin' },
];

/** Heat strip: how much of each module a role touches (0–1 per module). */
export function HeatStrip({
  role,
  modules,
  totals,
  labels = true,
  onPick,
}: {
  role: { key?: string | null; name: string; isOwner?: boolean };
  modules: Record<string, number> | undefined;
  totals: Record<string, number>;
  labels?: boolean;
  onPick?: (module: string) => void;
}) {
  return (
    <div style={roleStyle(role)}>
      <div className="grid grid-cols-7 gap-1">
        {ADMIN_MODULES.map((m, i) => {
          const share = role.isOwner ? 1 : (modules?.[m.key] ?? 0) / Math.max(1, totals[m.key] ?? 1);
          const n = role.isOwner ? 'all' : (modules?.[m.key] ?? 0);
          return (
            <button
              key={m.key}
              type="button"
              disabled={!onPick}
              onClick={() => onPick?.(m.key)}
              title={`${m.short}: ${n} of ${totals[m.key] ?? 0} permissions`}
              className={cn('m-cell h-5 rounded-[5px]', roleSolid, onPick && 'hover:ring-2 hover:ring-ring/40')}
              style={{ opacity: share ? 0.15 + share * 0.85 : 0.06, ['--i' as string]: i * 4 }}
            />
          );
        })}
      </div>
      {labels && (
        <div className="mt-1 grid grid-cols-7 gap-1">
          {ADMIN_MODULES.map((m) => (
            <span key={m.key} className="truncate text-center text-[9px] text-muted-foreground">{m.short}</span>
          ))}
        </div>
      )}
    </div>
  );
}
