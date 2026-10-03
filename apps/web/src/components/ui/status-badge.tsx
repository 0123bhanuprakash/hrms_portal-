import React from 'react';
import { Badge, type BadgeProps } from './badge';

export type StatusType = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING' | string;

const TONES: Record<string, NonNullable<BadgeProps['tone']>> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUSPENDED: 'danger',
  LOCKED: 'warning',
  PENDING: 'info',
  PENDING_VERIFICATION: 'info',
};

/** Status pill with a dot, e.g. ACTIVE → green "Active". */
export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  const normalized = status ? status.toUpperCase() : 'UNKNOWN';
  const label = normalized.charAt(0) + normalized.slice(1).toLowerCase().replace(/_/g, ' ');
  return (
    <Badge tone={TONES[normalized] ?? 'neutral'} dot className={className}>
      {label}
    </Badge>
  );
}
