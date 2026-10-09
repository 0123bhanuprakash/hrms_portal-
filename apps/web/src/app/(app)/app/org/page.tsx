'use client';

import React, { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Activity, Building2, GitBranch, Layers, ListTree, MapPin, Network, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { OrgChart } from '@/components/org/org-chart';
import { HealthCard, OrgVisual } from '@/components/org/org-visual';
import { MoveDialog, type MoveRequest } from '@/components/org/move-dialog';
import { DepartmentsPanel, LevelsPanel, LocationsPanel } from '@/components/org/structure';
import { useAccess } from '@/lib/access/use-access';
import { useOrgHealth } from '@/lib/company/lifecycle';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Tab = 'chart' | 'departments' | 'levels' | 'locations' | 'insights';
const TABS: Tab[] = ['chart', 'departments', 'levels', 'locations', 'insights'];
type ChartView = 'chart' | 'list';
const isChartView = (v: unknown): v is ChartView => v === 'chart' || v === 'list';

function OrganisationContent() {
  const { can, isLoading } = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canManage = can('org.manage');
  const requested = params.get('tab') as Tab;
  const tab = (TABS.includes(requested) && (requested !== 'insights' || canManage) ? requested : 'chart') as Tab;
  const setTab = (t: Tab) => router.replace(t === 'chart' ? pathname : `${pathname}?tab=${t}`, { scroll: false });
  const [chartView, setChartView] = useUiState<ChartView>('org:chart-view', 'chart', isChartView);
  const health = useOrgHealth(canManage);

  if (!isLoading && !can('org.view')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="You don't have permission to view the organisation." />;
  }

  const issues = health.data?.items.length ?? 0;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="Organisation"
        description="Who reports to whom, how departments nest, and your company’s levels. Reporting lines drive “my team” access in roles."
        action={
          tab === 'chart' ? (
            <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Chart style">
              {([['chart', 'Chart', <Network key="c" />], ['list', 'List', <ListTree key="l" />]] as const).map(([id, l, icon]) => (
                <button key={id} type="button" onClick={() => setChartView(id)} aria-pressed={chartView === id} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors [&_svg]:size-3.5', chartView === id ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {icon} {l}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'chart', label: 'Org chart', icon: <Network /> },
          { id: 'departments', label: 'Departments', icon: <Building2 /> },
          { id: 'levels', label: 'Levels & titles', icon: <Layers /> },
          { id: 'locations', label: 'Locations', icon: <MapPin /> },
          ...(canManage ? [{ id: 'insights' as const, label: issues ? `Insights · ${issues}` : 'Insights', icon: <Activity /> }] : []),
        ]}
      />
      {/* The chart waits for permissions: until then an Insights link would briefly fall back to it */}
      <div key={tab} className="animate-fade-up">
        {tab === 'chart' && (isLoading ? <Skeleton className="h-96" /> : chartView === 'chart' ? <OrgVisual canManage={canManage} onOpenDepartments={() => setTab('departments')} /> : <OrgChart canManage={canManage} />)}
        {tab === 'departments' && <DepartmentsPanel canManage={canManage} />}
        {tab === 'levels' && <LevelsPanel canManage={canManage} />}
        {tab === 'locations' && <LocationsPanel canManage={canManage} />}
        {tab === 'insights' && canManage && <Insights onDepartments={() => setTab('departments')} />}
      </div>
    </div>
  );
}

function Insights({ onDepartments }: { onDepartments: () => void }) {
  const health = useOrgHealth();
  const [move, setMove] = useState<MoveRequest | null>(null);
  if (health.isError) return <ErrorState message={getApiErrorMessage(health.error, 'Could not load insights')} onRetry={() => health.refetch()} />;
  if (health.isLoading || !health.data) return <Skeleton className="h-80" />;
  const s = health.data.stats;
  // How many direct reports each manager has (counted on the server)
  const bucketCounts = (['1–2', '3–5', '6–8', '9+'] as const).map((l) => ({ l, n: s.spans[l] }));
  const maxB = Math.max(1, ...bucketCounts.map((b) => b.n));
  const open = (id: string) => {
    const e = health.data?.items.flatMap((i) => i.people ?? []).find((x) => x.id === id);
    if (e) setMove({ employee: e });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['People', s.headcount, <Users key="p" />],
          ['Managers', s.managers, <GitBranch key="m" />],
          ['Avg. team size', s.avgSpan, <Users key="a" />],
          ['Biggest team', s.widestSpan, <Users key="w" />],
          ['Levels deep', s.levels, <Layers key="l" />],
          ['Departments', s.departments, <Building2 key="d" />],
        ].map(([l, v, icon]) => (
          <Card key={l as string} className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{l}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{v as number}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <HealthCard health={health.data} onPerson={open} onFocus={open} onDepartments={onDepartments} />
        <Card className="p-5">
          <p className="text-sm font-semibold">Team sizes</p>
          <p className="text-xs text-muted-foreground">Direct reports per manager — more than 8 is flagged</p>
          <div className="mt-4 flex h-40 items-end gap-3">
            {bucketCounts.map((b) => (
              <div key={b.l} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-semibold tabular-nums">{b.n}</span>
                <div className="flex w-full flex-1 items-end"><div className={cn('w-full rounded-t-md transition-[height] duration-500', b.l === '9+' ? 'bg-warning' : 'bg-primary/80')} style={{ height: `${(b.n / maxB) * 100}%`, minHeight: b.n ? 6 : 2 }} /></div>
                <span className="text-xs text-muted-foreground">{b.l}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <MoveDialog request={move} onClose={() => setMove(null)} />
    </div>
  );
}

export default function OrganisationPage() {
  return (
    <Suspense>
      <OrganisationContent />
    </Suspense>
  );
}
