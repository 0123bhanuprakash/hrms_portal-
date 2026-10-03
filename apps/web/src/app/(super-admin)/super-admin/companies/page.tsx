'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Eye,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Power,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { inputClass } from '@/components/ui/field';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { StatusChangeDialog } from '@/components/super-admin/status-change-dialog';
import { useCompanies, usePlatformStats } from '@/lib/admin/queries';
import type { CompaniesQuery, CompanyListItem, CompanyStatus } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 12;
type SortField = NonNullable<CompaniesQuery['sortBy']>;
type View = 'table' | 'grid';

export default function CompaniesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CompaniesView />
    </Suspense>
  );
}

/** Filters live in the URL so refresh / back / shared links keep them. */
function useUrlQuery(): [CompaniesQuery, (patch: Partial<CompaniesQuery>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query: CompaniesQuery = {
    page: Number(params.get('page')) || 1,
    limit: PAGE_SIZE,
    search: params.get('search') ?? undefined,
    status: (params.get('status') as CompanyStatus | null) ?? undefined,
    sortBy: (params.get('sortBy') as SortField | null) ?? 'createdAt',
    sortOrder: (params.get('sortOrder') as 'asc' | 'desc' | null) ?? 'desc',
  };

  const update = (patch: Partial<CompaniesQuery>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '' || (key === 'page' && value === 1)) next.delete(key);
      else next.set(key, String(value));
    }
    // Any filter change resets to page 1
    if (!('page' in patch)) next.delete('page');
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  return [query, update];
}

function CompaniesView() {
  const [query, update] = useUrlQuery();
  const { data, isLoading, isError, error, refetch, isFetching } = useCompanies(query);
  const stats = usePlatformStats();
  const [statusTarget, setStatusTarget] = useState<CompanyListItem | null>(null);
  const [view, setView] = useState<View>('table');
  const [search, setSearch] = useState(query.search ?? '');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sa-companies-view');
      if (saved === 'grid' || saved === 'table') setView(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('sa-companies-view', v);
    } catch {
      /* storage unavailable */
    }
  };

  // Debounced search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if ((query.search ?? '') !== search.trim()) update({ search: search.trim() || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const counts = stats.data?.companies;
  const chips = useMemo(
    () => [
      { label: 'All', value: undefined, count: counts?.total },
      { label: 'Active', value: 'ACTIVE' as const, count: counts?.active },
      { label: 'Inactive', value: 'INACTIVE' as const, count: counts?.inactive },
      { label: 'Suspended', value: 'SUSPENDED' as const, count: counts?.suspended },
    ],
    [counts],
  );

  const toggleSort = (field: SortField) => {
    if (query.sortBy === field) update({ sortBy: field, sortOrder: query.sortOrder === 'asc' ? 'desc' : 'asc' });
    else update({ sortBy: field, sortOrder: field === 'name' ? 'asc' : 'desc' });
  };

  const hasFilters = Boolean(query.search || query.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">Every tenant on the platform, their status and usage.</p>
        </div>
        <Link href="/super-admin/companies/new">
          <Button icon={<Plus className="h-4 w-4" />}>Onboard company</Button>
        </Link>
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const active = query.status === chip.value;
              return (
                <button
                  key={chip.label}
                  onClick={() => update({ status: chip.value })}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-subtle',
                  )}
                >
                  {chip.label}
                  {chip.count !== undefined && (
                    <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/20' : 'bg-muted')}>
                      {chip.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-page-search
                placeholder="Search name, slug or email…"
                aria-label="Search companies"
                className={cn(inputClass, 'h-9 pl-9 pr-8')}
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex rounded-lg border border-border p-0.5">
              {([['table', List], ['grid', LayoutGrid]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  onClick={() => changeView(v)}
                  aria-label={`${v} view`}
                  aria-pressed={view === v}
                  className={cn('rounded-md p-1.5', view === v ? 'bg-muted text-primary' : 'text-muted-foreground hover:text-foreground')}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      <Card className={cn('overflow-hidden transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {isError ? (
          <ErrorState message={getApiErrorMessage(error, 'Could not load companies')} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={<Building2 />}
            title={hasFilters ? 'No companies match these filters' : 'No companies yet'}
            description={hasFilters ? 'Try a different search or status.' : 'Onboard your first tenant company to get started.'}
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={() => { setSearch(''); update({ search: undefined, status: undefined }); }}>
                  Clear filters
                </Button>
              ) : (
                <Link href="/super-admin/companies/new"><Button size="sm" icon={<Plus className="h-4 w-4" />}>Onboard company</Button></Link>
              )
            }
          />
        ) : view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <SortHeader label="Company" field="name" query={query} onSort={toggleSort} />
                  <SortHeader label="Status" field="status" query={query} onSort={toggleSort} />
                  <th className="px-4 py-3 font-semibold">Users</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">ID prefix</th>
                  <SortHeader label="Created" field="createdAt" query={query} onSort={toggleSort} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.data.map((c) => (
                  <tr key={c.id} className="group transition-colors hover:bg-muted/60">
                    <td className="px-4 py-3">
                      <Link href={`/super-admin/companies/${c.id}`} className="flex items-center gap-3">
                        <span className="h-9 w-1 rounded-full" style={{ backgroundColor: c.branding?.primaryColor ?? '#4F46E5' }} />
                        <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:text-primary">{c.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.slug} · {c.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" />{c._count.users}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.settings?.employeeIdPrefix ?? '—'}</code>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground" title={formatDate(c.createdAt)}>{formatRelative(c.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <RowActions company={c} onChangeStatus={() => setStatusTarget(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.map((c, i) => (
              <div key={c.id} className="group relative overflow-hidden rounded-xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:shadow-lg animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="h-1.5" style={{ backgroundColor: c.branding?.primaryColor ?? '#4F46E5' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/super-admin/companies/${c.id}`} className="flex min-w-0 items-center gap-3">
                      <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold group-hover:text-primary">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.slug}</span>
                      </span>
                    </Link>
                    <RowActions company={c} onChangeStatus={() => setStatusTarget(c)} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <StatusBadge status={c.status} />
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c._count.users} user{c._count.users === 1 ? '' : 's'}</span>
                    <span>{formatRelative(c.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {data && (
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            limit={data.meta.limit}
            onPageChange={(page) => update({ page })}
          />
        )}
      </Card>

      <StatusChangeDialog company={statusTarget} onClose={() => setStatusTarget(null)} />
    </div>
  );
}

function SortHeader({
  label,
  field,
  query,
  onSort,
}: {
  label: string;
  field: SortField;
  query: CompaniesQuery;
  onSort: (field: SortField) => void;
}) {
  const active = query.sortBy === field;
  const Icon = !active ? ArrowUpDown : query.sortOrder === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className="px-4 py-3 font-semibold" aria-sort={active ? (query.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(field)} className={cn('flex items-center gap-1 uppercase hover:text-foreground', active && 'text-primary')}>
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function RowActions({ company, onChangeStatus }: { company: CompanyListItem; onChangeStatus: () => void }) {
  const router = useRouter();
  return (
    <DropdownMenu
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          aria-label={`Actions for ${company.name}`}
          className={cn('rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground', open && 'bg-muted')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
      items={[
        { label: 'View details', icon: <Eye />, onSelect: () => router.push(`/super-admin/companies/${company.id}`) },
        { label: 'Manage admins', icon: <Users />, onSelect: () => router.push(`/super-admin/companies/${company.id}?tab=admins`) },
        'separator',
        {
          label: company.status === 'ACTIVE' ? 'Suspend / deactivate…' : 'Change status…',
          icon: <Power />,
          danger: company.status === 'ACTIVE',
          onSelect: onChangeStatus,
        },
      ]}
    />
  );
}
