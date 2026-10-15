'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Briefcase, SearchX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonRow } from '@/components/profile/person-avatar';
import { prettyEnum } from '@/components/profile/profile-header';
import { EmployeeHero, EmploymentHistory, ProfileChecklist } from '@/components/employees/employee-hero';
import { ChecklistDrawer, LifecycleDialog, type LifecycleAction } from '@/components/employees/lifecycle-ui';
import { EmployeeDrawer } from '@/components/employees/employee-drawer';
import type { Employee } from '@/lib/company/org';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { InfoGrid } from '@/components/profile/personal-section';
import { useAccess } from '@/lib/access/use-access';
import { useEmployeeRecord, useMyCard, type EmployeeRecord } from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { ViewingNow } from '@/components/live/viewing-now';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, scopeOf } = useAccess();
  const record = useEmployeeRecord(id);
  const me = useMyCard();
  const isSelf = me.data?.employee?.id === id;
  const [action, setAction] = useState<LifecycleAction | null>(null);
  const [editing, setEditing] = useState(false);
  const [checklist, setChecklist] = useState<'joining' | 'exit' | null>(null);

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/employees"><ArrowLeft /> Employees</Link>
    </Button>
  );

  if (record.isLoading) return <Skeleton className="h-40 w-full" />;
  if (record.isLoadingError) {
    const status = (record.error as { response?: { status?: number } })?.response?.status;
    return status === 404 ? (
      <EmptyState icon={<SearchX />} title="Employee not found" description="They don’t exist, or they’re outside the people you can see." action={back} />
    ) : (
      <ErrorState message={getApiErrorMessage(record.error, 'Could not load this employee')} onRetry={() => record.refetch()} />
    );
  }
  const e = record.data!;
  // Photo: self, or an employee.edit scope wider than "own" (the API re-checks the exact reach)
  const canEditOthers = can('employee.edit') && scopeOf('employee.edit') !== 'own';
  const canEditPhoto = isSelf || canEditOthers;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        {!isSelf && <ViewingNow kind="employee" id={e.id} />}
      </div>
      <EmployeeHero
        e={e}
        perms={{ canEditPhoto, canEdit: can('employee.edit') && (isSelf || canEditOthers), canEditOthers, seesExits: can('employee.terminate'), isSelf }}
        onAction={setAction}
        onEdit={() => setEditing(true)}
        onChecklist={setChecklist}
      />
      <ProfileTabs employeeId={e.id} isSelf={isSelf} overview={<Overview e={e} canRemind={canEditOthers && !isSelf} />} />
      <LifecycleDialog action={action} person={action ? e : null} onClose={() => setAction(null)} />
      <EmployeeDrawer state={editing ? { mode: 'edit', employee: e as unknown as Employee } : null} onClose={() => setEditing(false)} ownOnly={scopeOf('employee.edit') === 'own'} />
      {checklist && <ChecklistDrawer person={e} kind={checklist} onClose={() => setChecklist(null)} />}
    </div>
  );
}

function Overview({ e, canRemind }: { e: EmployeeRecord; canRemind: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <EmploymentHistory employeeId={e.id} />
      </div>
      <div className="space-y-4">
      <ProfileChecklist employeeId={e.id} firstName={e.firstName} canRemind={canRemind} />
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
            [e.employmentStatus === 'PROBATION' ? 'Probation ends' : 'Confirmed', e.confirmationDate && formatDate(e.confirmationDate)],
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
    </div>
  );
}
