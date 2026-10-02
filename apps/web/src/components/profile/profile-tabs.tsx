'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Landmark, LayoutList, UserRound } from 'lucide-react';
import { Skeleton, Tabs } from '@/components/ui/feedback';
import { PersonalSection } from '@/components/profile/personal-section';
import { BankIdsSection } from '@/components/profile/bank-ids-section';
import { DocumentsSection } from '@/components/profile/documents-section';
import { useAccess } from '@/lib/access/use-access';
import { useDocuments, usePrivateProfile } from '@/lib/company/profile';

type Tab = 'overview' | 'personal' | 'bank' | 'documents';

/**
 * Overview / Personal / Bank & IDs / Documents. A tab only appears when the
 * caller's permission reaches this employee (the API answers 404 otherwise).
 */
export function ProfileTabs({ employeeId, isSelf, overview }: { employeeId: string; isSelf: boolean; overview?: React.ReactNode }) {
  const { can, hasFeature } = useAccess();
  const privateData = usePrivateProfile(employeeId, can('employee.view_private'));
  const docs = useDocuments(employeeId, hasFeature('people.documents') && can('document.view'));

  const tabs = useMemo(() => {
    const list: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [];
    if (overview) list.push({ id: 'overview', label: 'Overview', icon: <LayoutList /> });
    if (privateData.isSuccess) {
      list.push({ id: 'personal', label: 'Personal', icon: <UserRound /> });
      list.push({ id: 'bank', label: 'Bank & IDs', icon: <Landmark /> });
    }
    if (docs.isSuccess) list.push({ id: 'documents', label: 'Documents', icon: <FolderOpen /> });
    return list;
  }, [overview, privateData.isSuccess, docs.isSuccess]);

  const [tab, setTab] = useState<Tab>(overview ? 'overview' : 'personal');
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === tab)) setTab(tabs[0]!.id);
  }, [tabs, tab]);

  const loading = privateData.isLoading || docs.isLoading;
  if (!tabs.length) return loading ? <Skeleton className="h-64 w-full" /> : null;

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'overview' && overview}
      {tab === 'personal' && privateData.data && <PersonalSection employeeId={employeeId} data={privateData.data} isSelf={isSelf} />}
      {tab === 'bank' && privateData.data && <BankIdsSection employeeId={employeeId} data={privateData.data} isSelf={isSelf} />}
      {tab === 'documents' && <DocumentsSection employeeId={employeeId} />}
    </div>
  );
}
