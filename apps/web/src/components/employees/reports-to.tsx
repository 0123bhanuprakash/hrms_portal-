'use client';

import React from 'react';
import { Network, UserRound } from 'lucide-react';
import { PersonSelect } from '@/components/ui/pickers';
import { cn } from '@/lib/cn';

/**
 * "Reports to: a person — or the PMO". The PMO is the central pool: the PMO
 * assigns their projects, and the PMO lead approves their leave, attendance
 * corrections and timesheets. Applies to every employee, any department or title.
 */
export function ReportsTo({
  id,
  managerId,
  pmo,
  onChange,
  people,
  disabled,
}: {
  id: string;
  managerId: string;
  pmo: boolean;
  onChange: (v: { managerId: string; pmo: boolean }) => void;
  people: Array<{ id: string; firstName: string; lastName: string; avatarUrl: string | null; sub?: string | null }>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Reports to">
        {([[false, 'A person', <UserRound key="p" />], [true, 'The PMO', <Network key="o" />]] as const).map(([v, label, icon]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={pmo === v}
            disabled={disabled}
            onClick={() => onChange({ managerId: v ? '' : managerId, pmo: v })}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors [&_svg]:size-3.5 disabled:opacity-50', pmo === v ? 'bg-surface text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground')}
          >
            {icon} {label}
          </button>
        ))}
      </div>
      {pmo ? (
        <p className="rounded-lg border border-primary/25 bg-primary-soft/40 px-3 py-2 text-xs text-foreground/80">
          They join the <b>PMO pool</b>: the PMO assigns their projects, and the <b>PMO lead</b> approves their leave, attendance corrections and timesheets.
        </p>
      ) : (
        <PersonSelect id={id} value={managerId} onChange={(v) => onChange({ managerId: v, pmo: false })} disabled={disabled} emptyLabel="— Nobody (top of the organisation)" people={people} />
      )}
    </div>
  );
}
