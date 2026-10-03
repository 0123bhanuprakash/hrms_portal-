'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, HardDrive, PackageCheck, PackageOpen, Plus, Search, ShieldAlert, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { AssetFormDialog } from '@/components/assets/asset-dialogs';
import { useAccess } from '@/lib/access/use-access';
import { ASSET_STATUS, useAssetSummary, useAssetTypes, useAssets, type AssetStatus } from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

export default function AssetRegisterPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <Register />
    </Suspense>
  );
}

function Register() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const seesRegister = hasFeature('ops.assets') && (can('asset.manage') || (can('asset.view') && scopeOf('asset.view') === 'company'));
  const manage = can('asset.manage');

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<AssetStatus | ''>('');
  const [typeId, setTypeId] = useState('');
  const [warranty, setWarranty] = useState(false);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const employeeId = params.get('employeeId') ?? undefined;

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  // Employees without the register land on their own assets
  useEffect(() => {
    if (!accessLoading && hasFeature('ops.assets') && !seesRegister && can('asset.view')) router.replace('/app/assets/mine');
  }, [accessLoading, seesRegister, hasFeature, can, router]);

  const types = useAssetTypes(true, seesRegister);
  const summary = useAssetSummary(seesRegister);
  const list = useAssets({ search: debounced || undefined, status: status || undefined, typeId: typeId || undefined, employeeId, warrantyWithinDays: warranty ? 30 : undefined, page, limit: 25 }, seesRegister);

  if (!accessLoading && !seesRegister) return can('asset.view') ? <Skeleton className="h-64 w-full" /> : <EmptyState icon={<ShieldAlert />} title="No access" />;

  const s = summary.data;
  const holderName = employeeId && list.data?.data[0]?.holder?.employee;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assets"
        title="Asset register"
        description="Every laptop, phone and card the company owns, and who has it."
        action={manage && <Button onClick={() => setAdding(true)}><Plus /> Add asset</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Available" value={s ? s.byStatus.AVAILABLE ?? 0 : undefined} icon={<PackageOpen />} tone="success" />
        <StatCard title="With people" value={s ? s.byStatus.ASSIGNED ?? 0 : undefined} description={s?.unconfirmed ? `${s.unconfirmed} not confirmed yet` : undefined} icon={<PackageCheck />} tone="info" />
        <StatCard title="To hand over" value={s?.requestsToFulfil} description="Approved requests" icon={<HardDrive />} tone="primary" href="/app/assets/requests" />
        <StatCard title="Warranty ending" value={s?.warrantyEndingSoon} description="In the next 30 days" icon={<AlertTriangle />} tone="warning" />
      </div>

      {employeeId && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          Showing assets held by {holderName ? `${holderName.firstName} ${holderName.lastName}` : 'one employee'}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => router.replace('/app/assets')}><X /> Clear</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tag, name, brand, serial…" className="pl-9" aria-label="Search assets" />
        </div>
        <select className={`${inputClass} w-auto`} value={status} onChange={(e) => { setStatus(e.target.value as AssetStatus | ''); setPage(1); }} aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(ASSET_STATUS) as AssetStatus[]).map((k) => <option key={k} value={k}>{ASSET_STATUS[k].label}</option>)}
        </select>
        <select className={`${inputClass} w-auto`} value={typeId} onChange={(e) => { setTypeId(e.target.value); setPage(1); }} aria-label="Type">
          <option value="">All types</option>
          {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={warranty} onChange={(e) => { setWarranty(e.target.checked); setPage(1); }} /> Warranty ending</label>
      </div>

      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load assets')} onRetry={() => void list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState icon={<HardDrive />} title={debounced || status || typeId || warranty || employeeId ? 'No assets match' : 'No assets yet'} description={manage && !debounced ? 'Add your laptops, phones and ID cards to start tracking them.' : undefined} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Asset</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Serial</th>
                <th className="px-4 py-2.5 font-medium">With</th>
                <th className="px-4 py-2.5 font-medium">Warranty</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.data.map((a) => (
                <tr key={a.id} className="cursor-pointer hover:bg-subtle" onClick={() => router.push(`/app/assets/${a.id}`)}>
                  <td className="px-4 py-2.5">
                    <Link href={`/app/assets/${a.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{a.tag}</Link>
                    <p className="text-xs text-muted-foreground">{a.name}{a.brand && ` · ${a.brand}`}</p>
                  </td>
                  <td className="px-4 py-2.5">{a.type.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.serialNumber ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {a.holder ? (
                      <span className="flex items-center gap-2">
                        <PersonAvatar person={a.holder.employee} size="xs" />
                        {a.holder.employee.firstName} {a.holder.employee.lastName}
                        {!a.holder.acknowledgedAt && <Badge tone="warning" className="px-1.5 py-0 text-2xs">Unconfirmed</Badge>}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{formatDate(a.warrantyUntil)}</td>
                  <td className="px-4 py-2.5"><Badge tone={ASSET_STATUS[a.status].tone}>{ASSET_STATUS[a.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />}

      {s && s.byType.some((t) => t.total > 0) && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">By type</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {s.byType.filter((t) => t.total > 0).map((t) => (
              <button key={t.type.id} type="button" onClick={() => { setTypeId(t.type.id); setPage(1); }} className="rounded-md border border-border px-3 py-2 text-left hover:bg-subtle">
                <p className="text-sm font-medium">{t.type.name}</p>
                <p className="text-xs text-muted-foreground">{t.available} free of {t.total}</p>
              </button>
            ))}
          </div>
        </Card>
      )}
      {adding && <AssetFormDialog value="new" onClose={() => setAdding(false)} onSaved={(a) => router.push(`/app/assets/${a.id}`)} />}
    </div>
  );
}
