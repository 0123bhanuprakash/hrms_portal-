'use client';

import React from 'react';
import Link from 'next/link';
import { Briefcase, CalendarDays, CircleCheck, Circle, Mail, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import { AvatarEditor } from '@/components/profile/avatar-editor';
import type { ProfileCompletion } from '@/lib/company/profile';
import { formatDate } from '@/lib/format';

export interface HeaderPerson {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  joiningDate: string;
  employmentStatus?: string;
  designation: { name: string } | null;
  department: { name: string } | null;
  location: { name: string } | null;
}

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  PROBATION: 'info',
  NOTICE_PERIOD: 'warning',
  ON_LEAVE: 'info',
  TERMINATED: 'neutral',
};
export const prettyEnum = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

/** Photo, name, title and key facts — shared by My profile and the employee page. */
export function ProfileHeader({ person, canEditPhoto, action }: { person: HeaderPerson; canEditPhoto: boolean; action?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <AvatarEditor employeeId={person.id} person={person} canEdit={canEditPhoto} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">{person.firstName} {person.lastName}</h1>
            <Badge tone="outline" className="font-mono">{person.employeeId}</Badge>
            {person.employmentStatus && person.employmentStatus !== 'ACTIVE' && (
              <Badge tone={STATUS_TONE[person.employmentStatus] ?? 'neutral'} dot>{prettyEnum(person.employmentStatus)}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[person.designation?.name, person.department?.name].filter(Boolean).join(' · ') || 'No title yet'}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
            <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail /> {person.email}</a>
            {person.location && <span className="inline-flex items-center gap-1.5"><MapPin /> {person.location.name}</span>}
            <span className="inline-flex items-center gap-1.5"><CalendarDays /> Joined {formatDate(person.joiningDate)}</span>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </Card>
  );
}

/** "Complete your profile" checklist with a progress bar. */
export function CompletionCard({ completion, href, compact }: { completion: ProfileCompletion; href?: string; compact?: boolean }) {
  const missing = completion.items.filter((i) => !i.done);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{completion.percent === 100 ? 'Your profile is complete' : 'Complete your profile'}</p>
          <p className="text-xs text-muted-foreground">
            {completion.percent === 100 ? 'Thanks — HR has everything it needs.' : `${missing.length} thing${missing.length === 1 ? '' : 's'} left — HR and payroll use these details.`}
          </p>
        </div>
        <span className="text-lg font-semibold tabular-nums text-primary">{completion.percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${completion.percent}%` }} />
      </div>
      {!compact && missing.length > 0 && (
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {completion.items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 text-sm">
              {i.done ? <CircleCheck className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className={i.done ? 'text-muted-foreground line-through' : ''}>{i.label}</span>
            </li>
          ))}
        </ul>
      )}
      {href && missing.length > 0 && (
        <Link href={href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <Briefcase className="h-4 w-4" /> Go to my profile
        </Link>
      )}
    </Card>
  );
}
