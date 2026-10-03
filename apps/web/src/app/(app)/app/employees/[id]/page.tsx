'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Briefcase, SearchX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonRow } from '@/components/profile/person-avatar';
import { ProfileHeader, prettyEnum } from '@/components/profile/profile-header';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { InfoGrid } from '@/components/profile/personal-section';
import { useAccess } from '@/lib/access/use-access';
import { useEmployeeRecord, useMyCard, type EmployeeRecord } from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, scopeOf } = useAccess();
  const record = useEmployeeRecord(id);
  const me = useMyCard();
  const isSelf = me.data?.employee?.id === id;

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/employees"><ArrowLeft /> Employees</Link>
    </Button>
  );

  if (record.isLoading) return <Skeleton className="h-40 w-full" />;
  if (record.isError) {
    const status = (record.error as { response?: { status?: number } })?.response?.status;
    return status === 404 ? (
      <EmptyState icon={<SearchX />} title="Employee not found" description="They don’t exist, or they’re outside the people you can see." action={back} />
    ) : (
      <ErrorState message={getApiErrorMessage(record.error, 'Could not load this employee')} onRetry={() => record.refetch()} />
    );
  }
  const e = record.data!;
  // Photo: self, or an employee.edit scope wider than "own" (the API re-checks the exact reach)
  const canEditPhoto = isSelf || (can('employee.edit') && scopeOf('employee.edit') !== 'own');

  return (
    <div className="space-y-4">
      <div>{back}</div>
      <ProfileHeader person={e} canEditPhoto={canEditPhoto} />
      <ProfileTabs employeeId={e.id} isSelf={isSelf} overview={<Overview e={e} />} />
    </div>
  );
}

function Overview({ e }: { e: EmployeeRecord }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader icon={<Briefcase />} title="Employment" />
        <InfoGrid
          rows={[
            ['Title', e.designation?.name],
            ['Department', e.department?.name],
            ['Location', e.location?.name],
            ['Employment type', prettyEnum(e.employmentType)],
            ['Status', prettyEnum(e.employmentStatus)],
            ['Joined', formatDate(e.joiningDate)],
            ['Confirmed', e.confirmationDate && formatDate(e.confirmationDate)],
            ['Work phone', e.phone],
            ['Last sign-in', e.user?.lastLoginAt ? formatRelative(e.user.lastLoginAt) : 'Never'],
          ]}
        />
      </Card>
      <Card>
        <CardHeader icon={<Users />} title="Reporting line" />
        <div className="space-y-4 px-5 pb-5">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Reports to</p>
            {e.reportingManager ? (
              <Link href={`/app/employees/${e.reportingManager.id}`} className="block rounded-md hover:bg-subtle">
                <PersonRow person={e.reportingManager} />
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No manager set</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Direct reports ({e.subordinates.length})</p>
            {e.subordinates.length ? (
              <ul className="space-y-1">
                {e.subordinates.map((s) => (
                  <li key={s.id}>
                    <Link href={`/app/employees/${s.id}`} className="block rounded-md hover:bg-subtle">
                      <PersonRow person={s} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
