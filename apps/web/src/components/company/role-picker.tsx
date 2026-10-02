'use client';

import React from 'react';
import { Check, Crown } from 'lucide-react';
import type { RoleSummary } from '@/lib/company/user-management';
import { Skeleton } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';

/** Multi-select list of the company's active roles (a user can hold several). */
export function RolePicker({
  roles,
  value,
  onChange,
  disabled,
  loading,
}: {
  roles: RoleSummary[] | undefined;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  if (loading || !roles) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  const active = roles.filter((r) => r.status === 'ACTIVE');
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div role="group" aria-label="Roles" className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
      {active.map((role) => {
        const selected = value.includes(role.id);
        return (
          <button
            key={role.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => toggle(role.id)}
            className={cn(
              'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
              selected ? 'border-primary bg-primary-soft/40 ring-1 ring-primary/25' : 'border-border hover:border-foreground/20 hover:bg-muted/40',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-surface',
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {role.isOwner && <Crown className="h-3.5 w-3.5 text-warning" />}
                {role.name}
                <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                  {role.isOwner ? 'All permissions' : `${role.permissionCount} permissions`}
                </span>
              </span>
              {role.description && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{role.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
