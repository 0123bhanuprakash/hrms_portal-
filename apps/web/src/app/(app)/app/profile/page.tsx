'use client';

import React from 'react';
import Link from 'next/link';
import { Briefcase, IdCard, Users } from 'lucide-react';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonRow } from '@/components/profile/person-avatar';
import { CompletionCard, ProfileHeader, prettyEnum } from '@/components/profile/profile-header';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { InfoGrid } from '@/components/profile/personal-section';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard, type MyCard } from '@/lib/company/profile';
import { useCapacity } from '@/lib/company/projects';
import { ProjectsPanel } from '@/components/projects/projects-panel';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { NoProfile } from '@/components/profile/no-profile';

export default function MyProfilePage() {
  const { can } = useAccess();
  const me = useMyCard();

  if (me.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (me.isLoadingError) return <ErrorState message={getApiErrorMessage(me.error, 'Could not load your profile')} onRetry={() => me.refetch()} />;
  const employee = me.data?.employee;
  if (!employee) {
    return (
      <NoProfile icon={<IdCard />} what="Your account can sign in, but it isn’t linked to an employee record." />
    );
  }

  return (
    <div className="space-y-4">
      <ProfileHeader person={employee} canEditPhoto={can('employee.edit')} />
      {me.data?.completion && me.data.completion.percent < 100 && <CompletionCard completion={me.data.completion} />}
      <ProfileTabs employeeId={employee.id} isSelf overview={<JobOverview employee={employee} />} />
    </div>
  );
}

function JobOverview({ employee }: { employee: NonNullable<MyCard['employee']> }) {
  const { can, hasFeature } = useAccess();
  const projects = useCapacity(employee.id, {}, hasFeature('work.projects') && can('project.view'));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {projects.data && projects.data.assignments.length > 0 && (
        <div className="lg:col-span-2"><ProjectsPanel capacity={projects.data} /></div>
      )}
      <Card>
        <CardHeader icon={<Briefcase />} title="Job" />
        <InfoGrid
          rows={[
            ['Employee ID', <span key="id" className="font-mono">{employee.employeeId}</span>],
            ['Title', employee.designation?.name],
            ['Department', employee.department?.name],
            ['Location', employee.location?.name],
            ['Employment type', prettyEnum(employee.employmentType)],
            ['Status', prettyEnum(employee.employmentStatus)],
            ['Joined', formatDate(employee.joiningDate)],
            ['Work email', employee.email],
          ]}
        />
      </Card>
      <Card>
        <CardHeader icon={<Users />} title="Reporting line" />
        <div className="space-y-4 px-5 pb-5">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Reports to</p>
            {employee.reportingManager ? <PersonRow person={employee.reportingManager} /> : <p className="text-sm text-muted-foreground">No manager set</p>}
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Direct reports ({employee.directReportCount})</p>
            {employee.subordinates.length ? (
              <ul className="space-y-2">
                {employee.subordinates.map((s) => <li key={s.id}><PersonRow person={s} /></li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None</p>
            )}
            {employee.directReportCount > employee.subordinates.length && (
              <Link href="/app/org" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                See all in the org chart
              </Link>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
