'use client';

import React from 'react';
import Link from 'next/link';
import { FolderKanban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/feedback';
import { PROJECT_STATUS, useBilling, type Capacity } from '@/lib/company/projects';
import { BillingBar } from '@/components/projects/project-ui';
import { formatDate } from '@/lib/format';

/** Someone's projects: allocation bar + each assignment (role, lead, %). */
export function ProjectsPanel({ capacity }: { capacity: Capacity }) {
  const current = capacity.assignments.filter((a) => a.active || a.upcoming);
  const pct = Math.min(100, capacity.allocatedToday);
  const billing = useBilling(capacity.employeeId);
  return (
    <Card>
      <CardHeader icon={<FolderKanban />} title="Projects" description={`${capacity.allocatedToday}% allocated today · ${Math.max(0, 100 - capacity.allocatedToday)}% free`} />
      <div className="px-5">
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Allocation today">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        {billing.data && <BillingBar {...billing.data} className="mt-3" />}
      </div>
      {current.length ? (
        <ul className="divide-y divide-border px-5 py-2">
          {current.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/app/projects/${a.project.id}`} className="font-medium hover:text-primary hover:underline">{a.project.name}</Link>
                <p className="text-xs text-muted-foreground">
                  {a.roleLabel}
                  {a.lead && ` · team lead ${a.lead.firstName} ${a.lead.lastName}`} · {formatDate(a.startDate)} – {a.endDate ? formatDate(a.endDate) : 'ongoing'}
                </p>
              </div>
              {a.upcoming && <Badge tone="info">Upcoming</Badge>}
              {a.project.status !== 'ACTIVE' && <Badge tone={PROJECT_STATUS[a.project.status].tone}>{PROJECT_STATUS[a.project.status].label}</Badge>}
              <span className="w-12 text-right font-semibold tabular-nums">{a.allocation}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">Not on any project right now.</p>
      )}
    </Card>
  );
}
