'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, MapPin, Search, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { useDepartments } from '@/lib/company/org';
import { useDirectory } from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';

export default function PeopleDirectoryPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = can('org.view') && hasFeature('people.directory');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, departmentId]);

  const list = useDirectory({ search: debounced || undefined, departmentId: departmentId || undefined, page, limit: 24 }, allowed);
  const departments = useDepartments();
  // Full records only for people who can see beyond themselves (the API re-checks each one)
  const viewScope = scopeOf('employee.view');
  const linkable = Boolean(viewScope && viewScope !== 'own');

  if (!accessLoading && !allowed) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="The people directory isn’t available to you." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Directory" description="Find colleagues — names, roles, teams and work email." />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, ID or title" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search people" />
        </div>
        <select className={`${inputClass} sm:w-56`} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {list.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load the directory')} onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState icon={<Users />} title="No one found" description={debounced ? 'Try another name or clear the filters.' : undefined} />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.data.data.map((p) => {
              const body = (
                <Card className="flex h-full items-start gap-3 p-4 transition-colors hover:border-foreground/20">
                  <PersonAvatar person={p} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.firstName} {p.lastName}</p>
                    <p className="truncate text-sm text-muted-foreground">{p.designation?.name ?? '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.department?.name}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground [&_svg]:size-3.5">
                      <span className="inline-flex min-w-0 items-center gap-1"><Mail /> <span className="truncate">{p.email}</span></span>
                      {p.location && <span className="inline-flex items-center gap-1"><MapPin /> {p.location.name}</span>}
                    </div>
                    {p.reportingManager && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">Reports to {p.reportingManager.firstName} {p.reportingManager.lastName}</p>
                    )}
                  </div>
                </Card>
              );
              return (
                <li key={p.id}>
                  {linkable ? <Link href={`/app/employees/${p.id}`} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link> : body}
                </li>
              );
            })}
          </ul>
          <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
