'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Download,
  Eye,
  LayoutGrid,
  List,
  MoreHorizontal,
  PanelRight,
  Plus,
  Power,
  Search,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input, Textarea, inputClass } from '@/components/ui/field';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { StatusChangeDialog } from '@/components/super-admin/status-change-dialog';
import { AttentionStrip, CompanyPanel, HealthPill, Pipeline, Spark, SummaryTiles } from '@/components/super-admin/company-insights';
import { useCompanies, useCompany } from '@/lib/admin/queries';
import { usePlans } from '@/lib/admin/plans';
import { useBulkCompanies, useCompaniesSummary, useCompanyTagList, type BulkAction } from '@/lib/admin/company-insights';
import { useUiState } from '@/lib/preferences/ui-state';
import type { CompaniesQuery, CompanyListItem, CompanyStatus } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 12;
type SortField = NonNullable<CompaniesQuery['sortBy']>;
type View = 'table' | 'grid';
const isView = (v: unknown): v is View => v === 'table' || v === 'grid';

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
    plan: params.get('plan') ?? undefined,
    tag: params.get('tag') ?? undefined,
    health: (params.get('health') as CompaniesQuery['health'] | null) ?? undefined,
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
  const summary = useCompaniesSummary();
  const plans = usePlans();
  const tags = useCompanyTagList();
  const [statusTarget, setStatusTarget] = useState<{ id: string; name: string; status: CompanyStatus } | null>(null);
  const [view, setView] = useUiState<View>('sa:companies-view', 'table', isView);
  const [search, setSearch] = useState(query.search ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelId, setPanelId] = useState<string | null>(null);

  // Debounced search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if ((query.search ?? '') !== search.trim()) update({ search: search.trim() || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Selection is per page
  const rows = data?.data ?? [];
  const pageKey = rows.map((r) => r.id).join();
  useEffect(() => setSelected(new Set()), [pageKey]);

  // The panel can open a company that isn't on this page (from attention / pipeline)
  const fromList = rows.find((r) => r.id === panelId);
  const fetched = useCompany(panelId && !fromList ? panelId : '');
  const panelCompany = fromList ?? (fetched.data ? { ...fetched.data.company, plan: null } : null);

  const counts = summary.data?.companies;
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

  const hasFilters = Boolean(query.search || query.status || query.plan || query.tag || query.health);
  const clearFilters = () => {
    setSearch('');
    update({ search: undefined, status: undefined, plan: undefined, tag: undefined, health: undefined });
  };
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">Every tenant on the platform — how they use it, how far they are with setup, and what needs a look.</p>
        </div>
        <Link href="/super-admin/companies/new">
          <Button icon={<Plus className="h-4 w-4" />}>Onboard company</Button>
        </Link>
      </div>

      <SummaryTiles data={summary.data} />
      {summary.data && <AttentionStrip items={summary.data.attention} total={summary.data.attentionTotal} onOpen={setPanelId} />}

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
              const active = query.status === chip.value;
              return (
                <button
                  key={chip.label}
                  onClick={() => update({ status: chip.value })}
                  className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', active ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-subtle')}
                >
                  {chip.label}
                  {chip.count !== undefined && <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/20' : 'bg-muted')}>{chip.count}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Plan" value={query.plan} onChange={(plan) => update({ plan })} options={(plans.data ?? []).map((p) => ({ value: p.key, label: p.name }))} />
            <FilterSelect
              label="Health"
              value={query.health}
              onChange={(health) => update({ health: health as CompaniesQuery['health'] })}
              options={[
                { value: 'healthy', label: 'Healthy' },
                { value: 'watch', label: 'Watch' },
                { value: 'at_risk', label: 'At risk' },
              ]}
            />
            <FilterSelect label="Tag" value={query.tag} onChange={(tag) => update({ tag })} options={(tags.data ?? []).map((t) => ({ value: t.label, label: `${t.label} (${t.count})` }))} />
            <div className="relative min-w-[200px] flex-1 lg:w-64 lg:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} data-page-search placeholder="Search name, slug or email…" aria-label="Search companies" className={cn(inputClass, 'h-9 pl-9 pr-8')} />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                Clear
              </button>
            )}
            <div className="flex rounded-lg border border-border p-0.5">
              {([['table', List], ['grid', LayoutGrid]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} aria-pressed={view === v} className={cn('rounded-md p-1.5', view === v ? 'bg-muted text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {selected.size > 0 && <BulkBar ids={[...selected]} rows={rows} onDone={() => setSelected(new Set())} />}

      {/* Results */}
      <Card className={cn('overflow-hidden transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {isError ? (
          <ErrorState message={getApiErrorMessage(error, 'Could not load companies')} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !rows.length ? (
          <EmptyState
            icon={<Building2 />}
            title={hasFilters ? 'No companies match these filters' : 'No companies yet'}
            description={hasFilters ? 'Try a different search or filter.' : 'Onboard your first tenant company to get started.'}
            action={
              hasFilters ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
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
                  <th className="w-10 py-3 pl-4">
                    <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  </th>
                  <SortHeader label="Company" field="name" query={query} onSort={toggleSort} />
                  <th className="px-3 py-3 font-semibold">Plan</th>
                  <SortHeader label="Employees" field="employees" query={query} onSort={toggleSort} />
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell">Users · 7 days</th>
                  <SortHeader label="Health" field="health" query={query} onSort={toggleSort} />
                  <th className="hidden px-3 py-3 font-semibold xl:table-cell">Setup</th>
                  <SortHeader label="Last active" field="lastActivity" query={query} onSort={toggleSort} className="hidden md:table-cell" />
                  <SortHeader label="Status" field="status" query={query} onSort={toggleSort} />
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="m-stagger divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => setPanelId(c.id)} className={cn('group cursor-pointer transition-colors hover:bg-muted/60', selected.has(c.id) && 'bg-primary/5')}>
                    <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-3">
                        <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} />
                        <span className="min-w-0">
                          <span className="block max-w-[220px] truncate font-medium group-hover:text-primary">{c.name}</span>
                          <span className="flex max-w-[220px] items-center gap-1 truncate text-xs text-muted-foreground">
                            {c.slug}
                            {c.insights?.tags.slice(0, 2).map((t) => <span key={t} className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-foreground">{t}</span>)}
                            {(c.insights?.tags.length ?? 0) > 2 && <span className="text-[10px]">+{c.insights!.tags.length - 2}</span>}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">{c.plan?.name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-3"><SeatMeter used={c.insights?.employees ?? c._count.employees} max={c.insights?.maxEmployees ?? null} /></td>
                    <td className="hidden px-3 py-3 lg:table-cell">
                      {c.insights && (
                        <span className="flex items-center gap-2 text-xs tabular-nums">
                          <Spark values={c.insights.trend} className="text-primary" />
                          {c.insights.activeUsers7d}/{c.insights.users}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">{c.insights && <HealthPill health={c.insights.health} />}</td>
                    <td className="hidden px-3 py-3 xl:table-cell">{c.insights && <SetupBar percent={c.insights.setup.percent} />}</td>
                    <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell" title={c.insights?.lastActivity ? formatDate(c.insights.lastActivity) : undefined}>
                      {c.insights?.lastActivity ? formatRelative(c.insights.lastActivity) : 'Never'}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActions company={c} onOpen={() => setPanelId(c.id)} onChangeStatus={() => setStatusTarget(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="m-stagger grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => (
              <div key={c.id} role="button" tabIndex={0} onClick={() => setPanelId(c.id)} onKeyDown={(e) => e.key === 'Enter' && setPanelId(c.id)} className={cn('m-lift group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface', selected.has(c.id) && 'ring-2 ring-primary')}>
                <div className="h-1.5" style={{ backgroundColor: c.branding?.primaryColor ?? '#4F46E5' }} />
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-3">
                      <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold group-hover:text-primary">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.plan?.name ?? 'No plan'} · {c.slug}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                      <RowActions company={c} onOpen={() => setPanelId(c.id)} onChangeStatus={() => setStatusTarget(c)} />
                    </span>
                  </div>
                  {c.insights && (
                    <>
                      <div className="flex items-center justify-between">
                        <HealthPill health={c.insights.health} />
                        <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                          <Spark values={c.insights.trend} className="text-primary" />
                          {c.insights.activeUsers7d}/{c.insights.users} this week
                        </span>
                      </div>
                      <SetupBar percent={c.insights.setup.percent} wide />
                    </>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <StatusBadge status={c.status} />
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.insights?.employees ?? c._count.employees} employees</span>
                    <span>{c.insights?.lastActivity ? formatRelative(c.insights.lastActivity) : 'Never active'}</span>
                  </div>
                  {!!c.insights?.tags.length && (
                    <div className="flex flex-wrap gap-1">
                      {c.insights.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} onPageChange={(page) => update({ page })} />}
      </Card>

      {view === 'grid' && <Pipeline data={summary.data} onOpen={setPanelId} />}

      {panelId && (
        <CompanyPanel
          company={panelCompany}
          onClose={() => setPanelId(null)}
          onChangeStatus={() => panelCompany && setStatusTarget(panelCompany)}
        />
      )}
      <StatusChangeDialog company={statusTarget} onClose={() => setStatusTarget(null)} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string | undefined) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select aria-label={`Filter by ${label.toLowerCase()}`} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className={cn(inputClass, 'h-9 w-auto pr-8 text-xs', value && 'border-primary text-primary')}>
      <option value="">{label}: all</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SeatMeter({ used, max }: { used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <span className="block min-w-[70px] text-xs tabular-nums" title={max ? `${used} of ${max} employees on this plan` : `${used} employees · no limit`}>
      <b className="font-semibold">{used}</b>
      <span className="text-muted-foreground">{max ? ` / ${max}` : ''}</span>
      {max ? (
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
          <i className={cn('m-fill-w block h-full', pct >= 90 ? 'bg-destructive' : pct >= 75 ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </span>
  );
}

function SetupBar({ percent, wide }: { percent: number; wide?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2 text-xs tabular-nums', !wide && 'min-w-[90px]')} title={`Setup ${percent}% done`}>
      {wide && <span className="text-muted-foreground">Setup</span>}
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <i className={cn('m-fill-w block h-full', percent === 100 ? 'bg-success' : percent >= 50 ? 'bg-primary' : 'bg-warning')} style={{ width: `${percent}%` }} />
      </span>
      {percent}%
    </span>
  );
}

function SortHeader({ label, field, query, onSort, className }: { label: string; field: SortField; query: CompaniesQuery; onSort: (field: SortField) => void; className?: string }) {
  const active = query.sortBy === field;
  const Icon = !active ? ArrowUpDown : query.sortOrder === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={cn('px-3 py-3 font-semibold', className)} aria-sort={active ? (query.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(field)} className={cn('flex items-center gap-1 whitespace-nowrap uppercase hover:text-foreground', active && 'text-primary')}>
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function RowActions({ company, onOpen, onChangeStatus }: { company: CompanyListItem; onOpen: () => void; onChangeStatus: () => void }) {
  const router = useRouter();
  return (
    <DropdownMenu
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-label={`Actions for ${company.name}`} className={cn('rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground', open && 'bg-muted')}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      )}
      items={[
        { label: 'Quick look', icon: <PanelRight />, onSelect: onOpen },
        { label: 'View details', icon: <Eye />, onSelect: () => router.push(`/super-admin/companies/${company.id}`) },
        { label: 'Manage admins', icon: <Users />, onSelect: () => router.push(`/super-admin/companies/${company.id}?tab=admins`) },
        'separator',
        { label: company.status === 'ACTIVE' ? 'Suspend / deactivate…' : 'Change status…', icon: <Power />, danger: company.status === 'ACTIVE', onSelect: onChangeStatus },
      ]}
    />
  );
}

// ─── Bulk actions ───────────────────────────────────────────

type BulkDialog = { kind: 'status'; status: CompanyStatus } | { kind: 'plan' } | { kind: 'addTag' | 'removeTag' } | null;

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: CompanyListItem[]) {
  const head = ['Name', 'Slug', 'Email', 'Status', 'Plan', 'Employees', 'Employee limit', 'Users', 'Signed in (7 days)', 'Health', 'Setup %', 'Last activity', 'Tags', 'Created'];
  const lines = rows.map((c) =>
    [c.name, c.slug, c.email, c.status, c.plan?.name, c.insights?.employees ?? c._count.employees, c.insights?.maxEmployees, c.insights?.users ?? c._count.users, c.insights?.activeUsers7d, c.insights?.health.score, c.insights?.setup.percent, c.insights?.lastActivity, c.insights?.tags.join('; '), c.createdAt]
      .map(csvCell)
      .join(','),
  );
  const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `companies-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function BulkBar({ ids, rows, onDone }: { ids: string[]; rows: CompanyListItem[]; onDone: () => void }) {
  const [dialog, setDialog] = useState<BulkDialog>(null);
  const plans = usePlans();
  const tagList = useCompanyTagList();
  const bulk = useBulkCompanies();
  const [reason, setReason] = useState('');
  const [planId, setPlanId] = useState('');
  const [tag, setTag] = useState('');
  const n = ids.length;
  const noun = `${n} compan${n === 1 ? 'y' : 'ies'}`;

  const close = () => {
    setDialog(null);
    setReason('');
    setPlanId('');
    setTag('');
  };
  const run = async (action: BulkAction, done: string) => {
    try {
      const r = await bulk.mutateAsync({ ids, ...action });
      toast.success(`${done} · ${r.updated} updated`);
      close();
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the companies'));
    }
  };

  const confirm = () => {
    if (!dialog) return;
    if (dialog.kind === 'status') return run({ action: 'status', status: dialog.status, reason: reason.trim() || undefined }, `Status changed to ${dialog.status.toLowerCase()}`);
    if (dialog.kind === 'plan') return planId && run({ action: 'plan', planId }, 'Plan changed');
    return tag.trim() && run({ action: dialog.kind, tag: tag.trim() }, dialog.kind === 'addTag' ? `Tagged “${tag.trim()}”` : `Removed “${tag.trim()}”`);
  };

  const title = !dialog ? '' : dialog.kind === 'status' ? `Make ${noun} ${dialog.status.toLowerCase()}?` : dialog.kind === 'plan' ? `Change the plan for ${noun}` : dialog.kind === 'addTag' ? `Tag ${noun}` : `Remove a tag from ${noun}`;

  return (
    <>
      <div className="m-pop sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-raised px-4 py-2.5 shadow-lg">
        <span className="mr-2 text-sm font-semibold">{noun} selected</span>
        <DropdownMenu
          align="left"
          trigger={({ toggle }) => <Button size="sm" variant="secondary" onClick={toggle}><Power /> Status</Button>}
          items={[
            { label: 'Make active', onSelect: () => setDialog({ kind: 'status', status: 'ACTIVE' }) },
            { label: 'Make inactive', onSelect: () => setDialog({ kind: 'status', status: 'INACTIVE' }) },
            { label: 'Suspend', danger: true, onSelect: () => setDialog({ kind: 'status', status: 'SUSPENDED' }) },
          ]}
        />
        <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'plan' })}>Change plan</Button>
        <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'addTag' })}><Tag /> Add tag</Button>
        <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: 'removeTag' })}>Remove tag</Button>
        <Button size="sm" variant="secondary" onClick={() => exportCsv(rows.filter((r) => ids.includes(r.id)))}><Download /> Export CSV</Button>
        <button type="button" onClick={onDone} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">Clear selection</button>
      </div>

      <Modal
        open={Boolean(dialog)}
        onClose={close}
        busy={bulk.isPending}
        title={title}
        description={dialog?.kind === 'status' && dialog.status !== 'ACTIVE' ? 'People in these companies won’t be able to sign in until they are made active again.' : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={bulk.isPending}>Cancel</Button>
            <Button variant={dialog?.kind === 'status' && dialog.status === 'SUSPENDED' ? 'danger' : 'primary'} loading={bulk.isPending} onClick={() => void confirm()} disabled={(dialog?.kind === 'plan' && !planId) || ((dialog?.kind === 'addTag' || dialog?.kind === 'removeTag') && !tag.trim())}>
              Apply to {noun}
            </Button>
          </>
        }
      >
        {dialog?.kind === 'status' && <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="Reason (optional) — saved in the audit log" aria-label="Reason" />}
        {dialog?.kind === 'plan' && (
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label="Plan" className={inputClass}>
            <option value="">Choose a plan…</option>
            {(plans.data ?? []).filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {(dialog?.kind === 'addTag' || dialog?.kind === 'removeTag') && (
          <div className="space-y-2">
            <Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={30} placeholder="Tag name" aria-label="Tag" list="sa-tag-list" autoFocus />
            <datalist id="sa-tag-list">{(tagList.data ?? []).map((t) => <option key={t.label} value={t.label} />)}</datalist>
            <div className="flex flex-wrap gap-1">
              {(tagList.data ?? []).slice(0, 12).map((t) => (
                <button key={t.label} type="button" onClick={() => setTag(t.label)} className={cn('rounded-full border px-2 py-0.5 text-2xs font-semibold', tag === t.label ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>{t.label}</button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
