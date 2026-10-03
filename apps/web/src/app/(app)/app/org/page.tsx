'use client';

import React, { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Layers, MapPin, Network, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, Tabs } from '@/components/ui/feedback';
import { OrgChart } from '@/components/org/org-chart';
import { DepartmentsPanel, LevelsPanel, LocationsPanel } from '@/components/org/structure';
import { useAccess } from '@/lib/access/use-access';

type Tab = 'chart' | 'departments' | 'levels' | 'locations';
const TABS: Tab[] = ['chart', 'departments', 'levels', 'locations'];

function OrganisationContent() {
  const { can, isLoading } = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'chart') as Tab;
  const setTab = (t: Tab) => router.replace(t === 'chart' ? pathname : `${pathname}?tab=${t}`, { scroll: false });
  const canManage = can('org.manage');

  if (!isLoading && !can('org.view')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="You don't have permission to view the organisation." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="Organisation"
        description="Who reports to whom, how departments nest, and your company’s levels. Reporting lines drive “my team” access in roles."
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'chart', label: 'Org chart', icon: <Network /> },
          { id: 'departments', label: 'Departments', icon: <Building2 /> },
          { id: 'levels', label: 'Levels & titles', icon: <Layers /> },
          { id: 'locations', label: 'Locations', icon: <MapPin /> },
        ]}
      />
      <div key={tab} className="animate-fade-up">
        {tab === 'chart' && <OrgChart canManage={canManage} />}
        {tab === 'departments' && <DepartmentsPanel canManage={canManage} />}
        {tab === 'levels' && <LevelsPanel canManage={canManage} />}
        {tab === 'locations' && <LocationsPanel canManage={canManage} />}
      </div>
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
