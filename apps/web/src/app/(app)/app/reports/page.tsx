'use client';

import React, { Suspense, useState } from 'react';
import { CalendarCheck, Gauge, HardDrive, Headset, LayoutGrid, LayoutDashboard, Mail, Receipt, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton, Tabs } from '@/components/ui/feedback';
import { FilterBar, useReportParams } from '@/components/reports/filters';
import { OverviewTab } from '@/components/reports/overview-tab';
import { PeopleTab } from '@/components/reports/people-tab';
import { AttendanceTab } from '@/components/reports/attendance-tab';
import { UtilisationTab } from '@/components/reports/utilisation-tab';
import { ReportLibrary, usePinnedReports, type LibraryItem } from '@/components/reports/library';
import { ScheduleDialog } from '@/components/reports/schedules';
import { useAccess } from '@/lib/access/use-access';
import type { ScheduleReport } from '@/lib/company/reports';

type Tab = 'overview' | 'people' | 'attendance' | 'utilisation' | 'library';

export default function ReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const { can, scopeOf, hasFeature, isLoading } = useAccess();
  const [params, update] = useReportParams();
  const [pinned] = usePinnedReports();
  const [scheduling, setScheduling] = useState(false);
  const reportsOn = hasFeature('insights.reports') && can('report.view');
  const utilOn = hasFeature('work.projects') && (can('project.manage') || can('report.view'));

  const library: LibraryItem[] = [
    ...(reportsOn
      ? [
          { key: 'overview', tab: 'overview', title: 'Overview', text: 'Headline numbers vs before, and what changed', icon: <LayoutDashboard />, tone: 'bg-primary-soft text-primary-soft-foreground' },
          { key: 'people', tab: 'people', title: 'People', text: 'Headcount, joiners & leavers, attrition, levels', icon: <Users />, tone: 'bg-primary-soft text-primary-soft-foreground' },
          { key: 'attendance', tab: 'attendance', title: 'Attendance & leave', text: 'Attendance rate, late arrivals, leave taken & left', icon: <CalendarCheck />, tone: 'bg-success-soft text-success' },
        ]
      : []),
    ...(utilOn ? [{ key: 'utilisation', tab: 'utilisation', title: 'Utilisation', text: 'Allocation, logged & billable hours by week', icon: <Gauge />, tone: 'bg-info-soft text-info' }] : []),
    ...([
      hasFeature('ops.expenses') && (can('expense.finance') || can('expense.hr')) && { key: 'expenses', href: '/app/expenses/payments', icon: <Receipt />, title: 'Expense spend', text: 'Claimed, approved and paid — by category, person and project.', tone: 'bg-warning-soft text-warning' },
      hasFeature('ops.helpdesk') && ['ticket.handle_it', 'ticket.handle_hr', 'ticket.handle_finance', 'ticket.handle_devops'].some(can) && { key: 'helpdesk', href: '/app/helpdesk/queue', icon: <Headset />, title: 'Helpdesk performance', text: 'Open, overdue, on-time % and ratings per queue.', tone: 'bg-destructive-soft text-destructive' },
      hasFeature('ops.assets') && (can('asset.manage') || scopeOf('asset.view') === 'company') && { key: 'assets', href: '/app/assets', icon: <HardDrive />, title: 'Asset register', text: 'What the company owns, who has it, warranties.', tone: 'bg-muted text-foreground' },
    ] as Array<LibraryItem | false>).filter((x): x is LibraryItem => Boolean(x)),
  ];

  const tabs = [
    ...(reportsOn ? [{ id: 'overview' as const, label: 'Overview', icon: <LayoutDashboard /> }, { id: 'people' as const, label: 'People', icon: <Users /> }, { id: 'attendance' as const, label: 'Attendance & leave', icon: <CalendarCheck /> }] : []),
    ...(utilOn ? [{ id: 'utilisation' as const, label: 'Utilisation', icon: <Gauge /> }] : []),
    ...(library.length ? [{ id: 'library' as const, label: 'All reports', icon: <LayoutGrid /> }] : []),
  ];
  // Old links used ?tab=more
  const asked = params.tab === 'more' ? 'library' : params.tab;
  const firstPinned = pinned.map((k) => tabs.find((t) => t.id === k)).find(Boolean)?.id;
  const tab: Tab | undefined = tabs.find((t) => t.id === asked)?.id ?? firstPinned ?? tabs[0]?.id;

  if (!isLoading && !tabs.length) return <EmptyState icon={<ShieldCheck />} title="No reports for you" description="Reports are available to HR, managers, the PMO and Finance." />;
  const scopeText = tab === 'utilisation' && can('project.manage') ? 'Everyone in the company' : scopeOf('report.view') === 'company' ? 'Everyone in the company' : 'People in your team';
  const schedulable: ScheduleReport[] = [...(reportsOn ? (['overview', 'people', 'attendance'] as const) : []), ...(utilOn ? (['utilisation'] as const) : [])];
  const scheduleReport: ScheduleReport = tab && tab !== 'library' && schedulable.includes(tab as ScheduleReport) ? (tab as ScheduleReport) : schedulable[0] ?? 'overview';
  const filters = { departmentId: params.departmentId, locationId: params.locationId };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insights"
        title="Reports & analytics"
        description={tab === 'library' ? 'Every report you can open. ★ pin the ones you use most.' : scopeText}
        action={reportsOn ? <Button variant="secondary" onClick={() => setScheduling(true)}><Mail /> Schedule</Button> : undefined}
      />
      {tab && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs tabs={tabs} value={tab} onChange={(t) => update({ tab: t })} />
          {tab !== 'library' && <FilterBar value={params} onChange={update} showPeriod={tab !== 'people'} />}
        </div>
      )}
      {tab === 'overview' && <OverviewTab params={params} onTab={(t) => update({ tab: t })} />}
      {tab === 'people' && <PeopleTab filters={filters} canExport={can('report.export')} />}
      {tab === 'attendance' && <AttendanceTab params={params} />}
      {tab === 'utilisation' && <UtilisationTab params={params} canExport={can('project.manage') || can('report.export')} />}
      {tab === 'library' && <ReportLibrary items={library} onTab={(t) => update({ tab: t })} canSchedule={reportsOn} />}
      {reportsOn && <ScheduleDialog open={scheduling} onClose={() => setScheduling(false)} report={scheduleReport} available={schedulable} filters={filters} />}
    </div>
  );
}
