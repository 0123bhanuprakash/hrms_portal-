'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FolderKanban, FolderOpen, Landmark, LayoutList, PackageCheck, Plane, UserRound } from 'lucide-react';
import { Skeleton, Tabs } from '@/components/ui/feedback';
import { PersonalSection } from '@/components/profile/personal-section';
import { BankIdsSection } from '@/components/profile/bank-ids-section';
import { DocumentsSection } from '@/components/profile/documents-section';
import { useAccess } from '@/lib/access/use-access';
import { useDocuments, usePrivateProfile } from '@/lib/company/profile';
import { useLeaveBalances } from '@/lib/company/leave';
import { BalanceCards } from '@/components/leave/balance-cards';
import { ProjectsPanel } from '@/components/projects/projects-panel';
import { useCapacity } from '@/lib/company/projects';
import { useEmployeeAssets } from '@/lib/company/assets';
import { HeldAssets } from '@/components/assets/asset-lists';

type Tab = 'overview' | 'personal' | 'bank' | 'documents' | 'leave' | 'projects' | 'assets';

/**
 * Overview / Personal / Bank & IDs / Documents. A tab only appears when the
 * caller's permission reaches this employee (the API answers 404 otherwise).
 */
export function ProfileTabs({ employeeId, isSelf, overview }: { employeeId: string; isSelf: boolean; overview?: React.ReactNode }) {
  const { can, hasFeature, scopeOf } = useAccess();
  const privateData = usePrivateProfile(employeeId, can('employee.view_private'));
  const docs = useDocuments(employeeId, hasFeature('people.documents') && can('document.view'));
  const year = new Date().getFullYear();
  // Someone else's leave balances (my own live on My leave)
  const leave = useLeaveBalances(employeeId, year, !isSelf && hasFeature('time.leave') && can('leave.view'));
  const projects = useCapacity(employeeId, {}, hasFeature('work.projects') && can('project.view'));
  // My own assets live on My assets
  const assets = useEmployeeAssets(employeeId, !isSelf && hasFeature('ops.assets') && can('asset.view'));

  const tabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [];
    if (overview) list.push({ id: 'overview', label: 'Overview', icon: <LayoutList /> });
    if (privateData.isSuccess) {
      list.push({ id: 'personal', label: 'Personal', icon: <UserRound /> });
      list.push({ id: 'bank', label: 'Bank & IDs', icon: <Landmark /> });
    }
    if (docs.isSuccess) list.push({ id: 'documents', label: 'Documents', icon: <FolderOpen /> });
    if (leave.isSuccess) list.push({ id: 'leave', label: 'Leave', icon: <Plane /> });
    if (projects.isSuccess) list.push({ id: 'projects', label: 'Projects', icon: <FolderKanban /> });
    if (assets.isSuccess) list.push({ id: 'assets', label: 'Assets', icon: <PackageCheck /> });
    return list;
  }, [overview, privateData.isSuccess, docs.isSuccess, leave.isSuccess, projects.isSuccess, assets.isSuccess]);

  const [tab, setTab] = useState<Tab>(overview ? 'overview' : 'personal');
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === tab)) setTab(tabs[0]!.id);
  }, [tabs, tab]);

  const loading = privateData.isLoading || docs.isLoading || leave.isLoading || projects.isLoading || assets.isLoading;
  if (!tabs.length) return loading ? <Skeleton className="h-64 w-full" /> : null;

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'overview' && overview}
      {tab === 'personal' && privateData.data && <PersonalSection employeeId={employeeId} data={privateData.data} isSelf={isSelf} />}
      {tab === 'bank' && privateData.data && <BankIdsSection employeeId={employeeId} data={privateData.data} isSelf={isSelf} />}
      {tab === 'documents' && <DocumentsSection employeeId={employeeId} />}
      {tab === 'leave' && <BalanceCards employeeId={employeeId} year={year} canAdjust={can('leave.adjust_balance')} />}
      {tab === 'projects' && projects.data && <ProjectsPanel capacity={projects.data} />}
      {tab === 'assets' && assets.data && <HeldAssets data={assets.data} linkToAsset={can('asset.manage') || scopeOf('asset.view') === 'company'} />}
    </div>
  );
}
