'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download, FileText, Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { inputClass } from '@/components/ui/field';
import { AuditEntryDrawer } from '@/components/super-admin/audit-entry-drawer';
import { useAuditActions, useAuditLogs, useCompanies, useCompany } from '@/lib/admin/queries';
import type { AuditLogEntry, AuditLogsQuery, Paginated } from '@/lib/admin/types';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative, humanizeAction } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SearchSelect, Select } from '@/components/ui/pickers';
import { useDebounced } from '@/components/ui/list-tools';

const PAGE_SIZE = 25;
const RANGES = [
  { id: 'all', label: 'All time', days: null },
  { id: '1', label: 'Today', days: 1 },
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
] as const;
type RangeId = (typeof RANGES)[number]['id'];

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <AuditLogsView />
    </Suspense>
  );
}

function rangeStart(range: RangeId): string | undefined {
  const r = RANGES.find((x) => x.id === range);
  if (!r?.days) return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (r.days - 1));
  return d.toISOString();
}

function AuditLogsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const range = (params.get('range') as RangeId | null) ?? 'all';
  const query: AuditLogsQuery = {
    page: Number(params.get('page')) || 1,
    limit: PAGE_SIZE,
    companyId: params.get('companyId') ?? undefined,
    action: params.get('action') ?? undefined,
    userEmail: params.get('userEmail') ?? undefined,
    dateFrom: rangeStart(range),
  };

  const update = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '' || value === 'all' || (key === 'page' && value === 1)) next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in patch)) next.delete('page');
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const { data, isLoading, isLoadingError, error, refetch, isFetching } = useAuditLogs(query);
  const actions = useAuditActions();
  // Companies are searched on the server (20 at a time); the chosen one is fetched by id
  const [companyQ, setCompanyQ] = useState('');
  const typedCompany = useDebounced(companyQ.trim(), 250);
  const companies = useCompanies({ limit: 20, sortBy: 'name', sortOrder: 'asc', search: typedCompany || undefined });
  const chosenCompany = useCompany(query.companyId ?? '');
  const companyOptions = [
    ...(chosenCompany.data && !companies.data?.data.some((c) => c.id === chosenCompany.data!.company.id) ? [{ value: chosenCompany.data.company.id, label: chosenCompany.data.company.name }] : []),
    ...(companies.data?.data ?? []).map((c) => ({ value: c.id, label: c.name, sub: c.slug })),
  ];
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const [email, setEmail] = useState(query.userEmail ?? '');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((query.userEmail ?? '') !== email.trim()) update({ userEmail: email.trim() || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const filtersActive = Boolean(query.companyId || query.action || query.userEmail || range !== 'all');

  /** Downloads every entry matching the current filters (up to 1000) as CSV. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: AuditLogEntry[] = [];
      for (let page = 1; page <= 10; page++) {
        const res = await api.get<Paginated<AuditLogEntry>>('/admin/audit-logs', {
          params: { ...query, page, limit: 100 },
        });
        rows.push(...res.data.data);
        if (page >= res.data.meta.totalPages) break;
      }
      const header = ['timestamp', 'action', 'actor_email', 'company', 'resource_type', 'resource_id', 'ip_address', 'request_id'];
      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        header.join(','),
        ...rows.map((r) =>
          [r.createdAt, r.action, r.user?.email, r.company?.name, r.resourceType, r.resourceId, r.ipAddress, r.requestId].map(escape).join(','),
        ),
      ].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit logs</h1>
          <p className="text-sm text-muted-foreground">Who did what, when and where — across every company.</p>
        </div>
        <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={exporting} disabled={!data?.meta.total} onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
          <SearchSelect
            aria-label="Filter by company"
            value={query.companyId ?? ''}
            onChange={(v) => update({ companyId: v || undefined })}
            options={companyOptions}
            emptyLabel="All companies"
            muteEmpty={false}
            searchPlaceholder="Search companies…"
            onSearch={setCompanyQ}
            searching={companies.isFetching}
            triggerClassName="h-9"
          />
          <Select
            aria-label="Filter by action"
            value={query.action ?? ''}
            onChange={(e) => update({ action: e.target.value || undefined })}
            className={cn(inputClass, 'h-9')}
          >
            <option value="">All actions</option>
            {actions.data?.map((a) => (
              <option key={a} value={a}>{humanizeAction(a)}</option>
            ))}
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} data-page-search placeholder="Actor email…" aria-label="Filter by actor email" className={cn(inputClass, 'h-9 pl-9')} />
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => update({ range: r.id })}
                className={cn('rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap', range === r.id ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-subtle')}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {filtersActive && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            {data ? `${data.meta.total} matching entr${data.meta.total === 1 ? 'y' : 'ies'}` : 'Filtering…'}
            <button
              onClick={() => { setEmail(''); update({ companyId: undefined, action: undefined, userEmail: undefined, range: undefined }); }}
              className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-primary hover:bg-primary-soft"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          </div>
        )}
      </Card>

      <Card className={cn('overflow-hidden transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {isLoadingError ? (
          <ErrorState message={getApiErrorMessage(error, 'Could not load audit logs')} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<FileText />} title={filtersActive ? 'No entries match these filters' : 'No audit entries yet'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Company</th>
                  <th className="px-4 py-3 font-semibold hidden lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.data.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(entry)}
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-primary-soft/40 focus:outline-none focus-visible:bg-primary-soft/60"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="block">{formatRelative(entry.createdAt)}</span>
                      <span className="block text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{humanizeAction(entry.action)}</span>
                      <code className="text-[11px] text-muted-foreground">{entry.action}</code>
                    </td>
                    <td className="px-4 py-3">
                      {entry.user ? (
                        <>
                          <span className="block">{entry.user.firstName} {entry.user.lastName}</span>
                          <span className="block text-xs text-muted-foreground">{entry.user.email}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{entry.company?.name ?? <span className="text-muted-foreground">Platform</span>}</td>
                    <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-muted-foreground">{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} onPageChange={(page) => update({ page })} />
        )}
      </Card>

      <AuditEntryDrawer entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
