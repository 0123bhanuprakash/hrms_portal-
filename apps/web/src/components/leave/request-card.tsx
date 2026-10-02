'use client';

import React from 'react';
import { Check, Circle, CircleDashed, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { LEAVE_STATUS_TONE, days, leaveRange, type LeaveRequest } from '@/lib/company/leave';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** A leave request with its approval chain; actions are passed in. */
export function LeaveRequestCard({ request: r, showEmployee, actions }: { request: LeaveRequest; showEmployee?: boolean; actions?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {showEmployee ? (
            <PersonAvatar person={r.employee} />
          ) : (
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.leaveType.color }} aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {showEmployee && <>{r.employee.firstName} {r.employee.lastName} <span className="font-normal text-muted-foreground">· </span></>}
              {r.leaveType.name}
              <span className="font-normal text-muted-foreground"> · {days(r.totalDays)}</span>
            </p>
            <p className="text-sm text-muted-foreground">{leaveRange(r)}</p>
            <p className="mt-1 text-sm">“{r.reason}”</p>
            {r.approvals.length > 0 && (
              <ol className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs" aria-label="Approvals">
                {r.approvals.map((a) => {
                  const who = a.actedBy ?? a.approver;
                  const icon =
                    a.status === 'APPROVED' ? <Check className="h-3.5 w-3.5 text-success" /> :
                    a.status === 'REJECTED' ? <X className="h-3.5 w-3.5 text-destructive" /> :
                    a.status === 'SKIPPED' ? <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" /> :
                    <Circle className={cn('h-3.5 w-3.5', a.level === r.currentLevel && r.status === 'PENDING' ? 'text-warning' : 'text-muted-foreground')} />;
                  return (
                    <li key={a.level} className="inline-flex items-center gap-1.5 text-muted-foreground" title={a.comments ?? undefined}>
                      {icon}
                      <span>
                        {who ? `${who.firstName} ${who.lastName}` : 'HR'}
                        {a.onBehalfOf && ` (for ${a.onBehalfOf.firstName})`}
                        {a.status === 'PENDING' && a.level === r.currentLevel && r.status === 'PENDING' && ' · waiting'}
                        {a.comments && ` — “${a.comments}”`}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {r.cancelReason && <p className="mt-1.5 text-xs text-muted-foreground">Cancelled: {r.cancelReason}</p>}
            <p className="mt-1.5 text-xs text-muted-foreground">Applied {formatRelative(r.createdAt)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <Badge tone={LEAVE_STATUS_TONE[r.status]}>{pretty(r.status)}</Badge>
          {actions}
        </div>
      </div>
    </Card>
  );
}
