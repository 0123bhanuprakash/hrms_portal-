'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle, BellRing, ClipboardCheck, FileUp, HardDrive, IndianRupee, MapPin, PackageCheck, PackageOpen, Plus, QrCode, Search, ShieldAlert, Undo2, UserPlus, Users, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Card, EmptyState, ErrorState, LoadMore, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { AssetFormDialog, ImportDialog } from '@/components/assets/asset-dialogs';
import { LoanRing, ProductArt } from '@/components/assets/product-art';
import { useAccess } from '@/lib/access/use-access';
import { useLocations } from '@/lib/company/org';
import {
  ASSET_STATUS,
  useAssetPeople,
  useAssetReturns,
  useAssetSummary,
  useAssetTypes,
  useAssets,
  useBulkMove,
  useCheckOverview, useCheckReports,
  useCloseCheck,
  useRemindCheck,
  useStartCheck,
  type AssetQuery,
  type AssetStatus,
} from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { money } from '@/lib/company/expenses';
import { cn } from '@/lib/cn';
import { DateInput, Select } from '@/components/ui/pickers';

type Tab = 'register' | 'people' | 'checks';
type Attention = NonNullable<AssetQuery['attention']>;

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
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'register');
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [attention, setAttention] = useState<Attention | ''>('');

  // Employees without the register land on their own assets
  useEffect(() => {
    if (!accessLoading && hasFeature('ops.assets') && !seesRegister && can('asset.view')) router.replace('/app/assets/mine');
  }, [accessLoading, seesRegister, hasFeature, can, router]);
  const summary = useAssetSummary(seesRegister);

  if (!accessLoading && !seesRegister) return can('asset.view') ? <Skeleton className="h-64 w-full" /> : <EmptyState icon={<ShieldAlert />} title="No access" />;

  const s = summary.data;
  const att = s?.attention;
  const chips: Array<{ id: Attention; label: string; n: number | undefined; tone: string }> = [
    { id: 'warranty', label: 'Warranty ends in 30 days', n: att?.warranty, tone: 'warning' },
    { id: 'repair', label: 'In repair over 14 days', n: att?.repairLong, tone: 'warning' },
    { id: 'old', label: 'Due for replacement', n: att?.old, tone: 'info' },
    { id: 'unconfirmed', label: 'Not confirmed by holder', n: att?.unconfirmed, tone: 'info' },
    { id: 'loans', label: 'Loans due or overdue', n: att ? att.loansDue + att.loansOverdue : undefined, tone: att?.loansOverdue ? 'danger' : 'warning' },
  ];
  const showAttention = att && (chips.some((c) => c.n) || att.outOfStock.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assets"
        title="Asset register"
        description="Every laptop, phone and card the company owns, and who has it."
        action={
          manage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => toast.info('QR labels and phone scanning are coming soon')}><QrCode /> QR labels <Badge tone="primary" className="ml-1 px-1.5 py-0 text-2xs">Soon</Badge></Button>
              <Button variant="secondary" onClick={() => setImporting(true)}><FileUp /> Import</Button>
              <Button onClick={() => setAdding(true)}><Plus /> Add asset</Button>
            </div>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard title="Total assets" value={s?.total} description={s?.boughtPaise ? `${money(s.boughtPaise)} bought` : undefined} icon={<HardDrive />} tone="primary" />
        <StatCard title="Available" value={s ? s.byStatus.AVAILABLE ?? 0 : undefined} icon={<PackageOpen />} tone="success" />
        <StatCard title="With people" value={s ? s.byStatus.ASSIGNED ?? 0 : undefined} description={s?.unconfirmed ? `${s.unconfirmed} not confirmed yet` : undefined} icon={<PackageCheck />} tone="info" />
        <StatCard title="To hand over" value={s?.requestsToFulfil} description={s?.joinersToPrepare ? `${s.joinersToPrepare} for new joiners` : 'Approved requests'} icon={<UserPlus />} tone="primary" href="/app/assets/requests?view=fulfil" />
        <StatCard title="Lost this year" value={s?.lostThisYear.count} description={s?.lostThisYear.paise ? `${money(s.lostThisYear.paise)} written off` : undefined} icon={<IndianRupee />} tone="danger" />
      </div>

      {showAttention && (
        <Card className="space-y-2.5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-warning" /> Needs attention</p>
          <div className="flex flex-wrap gap-2">
            {chips.filter((c) => c.n).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setAttention(attention === c.id ? '' : c.id); setTab('register'); }}
                className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors', attention === c.id ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:bg-subtle')}
              >
                <b className={cn('tabular-nums', c.tone === 'danger' ? 'text-destructive' : c.tone === 'warning' ? 'text-warning' : 'text-info')}>{c.n}</b> {c.label}
              </button>
            ))}
            {att.outOfStock.map((o) => (
              <span key={o.name} className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive-soft px-3 py-1 text-xs font-medium text-destructive">
                {o.name}: {o.available} in stock (keep {o.minStock})
              </span>
            ))}
          </div>
        </Card>
      )}

      <Tabs
        tabs={[
          { id: 'register' as const, label: 'Register', icon: <HardDrive /> },
          { id: 'people' as const, label: 'By person', icon: <Users /> },
          ...(manage ? [{ id: 'checks' as const, label: 'Returns & checks', icon: <ClipboardCheck /> }] : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'register' && <AssetTable attention={attention} onClearAttention={() => setAttention('')} manage={manage} />}
      {tab === 'people' && <ByPerson />}
      {tab === 'checks' && manage && <ReturnsAndChecks />}

      {s && tab === 'register' && s.byType.some((t) => t.total > 0) && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Stock by type</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {s.byType.filter((t) => t.total > 0).map((t) => {
              const low = t.type.minStock > 0 && t.available < t.type.minStock;
              return (
                <div key={t.type.id} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', low ? 'border-destructive/40 bg-destructive-soft/40' : 'border-border')}>
                  <ProductArt icon={t.type.icon} size="xs" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.type.name}</p>
                    <p className={cn('text-xs', low ? 'text-destructive' : 'text-muted-foreground')}>{t.available} free of {t.total}{t.type.minStock ? ` · keep ${t.type.minStock}` : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {adding && <AssetFormDialog value="new" onClose={() => setAdding(false)} onSaved={(a) => router.push(`/app/assets/${a.id}`)} />}
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}

// ─── Register table ─────────────────────────────────────────

function AssetTable({ attention, onClearAttention, manage }: { attention: Attention | ''; onClearAttention: () => void; manage: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const employeeId = params.get('employeeId') ?? undefined;
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<AssetStatus | ''>('');
  const [typeId, setTypeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [attention]);

  const types = useAssetTypes(true);
  const locations = useLocations();
  const list = useAssets({ search: debounced || undefined, status: status || undefined, typeId: typeId || undefined, locationId: locationId || undefined, employeeId, attention: attention || undefined, page, limit: 25 });
  const rows = list.data?.data ?? [];
  const locName = (id: string | null) => locations.data?.find((l) => l.id === id)?.name;
  const holderName = employeeId && rows[0]?.holder?.employee;
  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r.id));

  return (
    <div className="space-y-3">
      {employeeId && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          Showing assets held by {holderName ? `${holderName.firstName} ${holderName.lastName}` : 'one employee'}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => router.replace('/app/assets')}><X /> Clear</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tag, name, serial or who has it…" className="pl-9" aria-label="Search assets" />
        </div>
        <Select className={cn(inputClass, "w-auto")} value={status} onChange={(e) => { setStatus(e.target.value as AssetStatus | ''); setPage(1); }} aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(ASSET_STATUS) as AssetStatus[]).map((k) => <option key={k} value={k}>{ASSET_STATUS[k].label}</option>)}
        </Select>
        <Select className={cn(inputClass, "w-auto")} value={typeId} onChange={(e) => { setTypeId(e.target.value); setPage(1); }} aria-label="Type">
          <option value="">All types</option>
          {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        {(locations.data?.length ?? 0) > 0 && (
          <Select className={cn(inputClass, "w-auto")} value={locationId} onChange={(e) => { setLocationId(e.target.value); setPage(1); }} aria-label="Location">
            <option value="">All locations</option>
            {locations.data!.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        )}
        {attention && <Button size="sm" variant="ghost" onClick={onClearAttention}><X /> Clear filter</Button>}
      </div>

      {manage && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft/40 px-3 py-2 text-sm">
          <b>{selected.length} selected</b>
          <Button size="sm" variant="secondary" onClick={() => setMoving(true)}><MapPin /> Move to a location</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
        </div>
      )}

      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : list.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load assets')} onRetry={() => void list.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon={<HardDrive />} title={debounced || status || typeId || attention || employeeId || locationId ? 'No assets match' : 'No assets yet'} description={manage && !debounced ? 'Add your laptops, phones and ID cards — or import a spreadsheet.' : undefined} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                {manage && <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select all on this page" className="accent-[hsl(var(--primary))]" checked={allOnPage} onChange={(e) => setSelected(e.target.checked ? [...new Set([...selected, ...rows.map((r) => r.id)])] : selected.filter((id) => !rows.some((r) => r.id === id)))} /></th>}
                <th className="px-4 py-2.5 font-medium">Asset</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">With</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Warranty</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((a) => (
                <tr key={a.id} className={cn('cursor-pointer hover:bg-subtle', selected.includes(a.id) && 'bg-primary-soft/30')} onClick={() => router.push(`/app/assets/${a.id}`)}>
                  {manage && (
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${a.tag}`} className="accent-[hsl(var(--primary))]" checked={selected.includes(a.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, a.id] : selected.filter((x) => x !== a.id))} />
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ProductArt icon={a.type.icon} size="xs" state={a.status === 'IN_REPAIR' ? 'repair' : a.holder?.dueBack ? 'loan' : a.status === 'LOST' ? 'lost' : null} />
                      <div className="min-w-0">
                        <Link href={`/app/assets/${a.id}`} className="font-mono font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{a.tag}</Link>
                        <p className="truncate text-xs text-muted-foreground">{a.name}{a.brand && ` · ${a.brand}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{a.type.name}</td>
                  <td className="px-4 py-2.5">
                    {a.holder ? (
                      <span className="flex items-center gap-2">
                        <PersonAvatar person={a.holder.employee} size="xs" />
                        {a.holder.employee.firstName} {a.holder.employee.lastName}
                        {!a.holder.acknowledgedAt && <Badge tone="warning" className="px-1.5 py-0 text-2xs">Unconfirmed</Badge>}
                        {a.overdue ? <Badge tone="danger" className="px-1.5 py-0 text-2xs">Loan overdue</Badge> : a.dueSoon ? <Badge tone="warning" className="px-1.5 py-0 text-2xs">Due {formatDate(a.holder.dueBack)}</Badge> : null}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{locName(a.locationId) ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{formatDate(a.warrantyUntil)}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={ASSET_STATUS[a.status].tone}>{ASSET_STATUS[a.status].label}</Badge>
                      {a.replaceDue && <Badge tone="info">Replace</Badge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {list.data && <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />}
      <MoveDialog ids={moving ? selected : null} onClose={() => setMoving(false)} onDone={() => { setMoving(false); setSelected([]); }} />
    </div>
  );
}

function MoveDialog({ ids, onClose, onDone }: { ids: string[] | null; onClose: () => void; onDone: () => void }) {
  const move = useBulkMove();
  const locations = useLocations();
  const [locationId, setLocationId] = useState('');
  if (!ids) return null;
  return (
    <Modal
      open
      onClose={onClose}
      busy={move.isPending}
      icon={<MapPin />}
      title={`Move ${ids.length} asset${ids.length === 1 ? '' : 's'}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={move.isPending} onClick={() => move.mutate({ ids, locationId: locationId || null }, { onSuccess: (r) => { toast.success(`Moved ${r.moved}`); onDone(); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not move')) })}>Move</Button>
        </>
      }
    >
      <Field label="Location" htmlFor="mv-loc">
        <Select id="mv-loc" className={inputClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">No location</option>
          {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      </Field>
    </Modal>
  );
}

// ─── By person ──────────────────────────────────────────────

function ByPerson() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const people = useAssetPeople({ search: debounced || undefined, page });
  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a person…" className="pl-9" aria-label="Search people" />
      </div>
      {people.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : people.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(people.error, 'Could not load')} onRetry={() => void people.refetch()} />
      ) : !people.data?.data.length ? (
        <EmptyState icon={<Users />} title={debounced ? 'Nobody matches' : 'Nobody holds anything yet'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {people.data.data.map((p) => (
            <Card key={p.employee.id} className="p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <PersonAvatar person={p.employee} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.employee.firstName} {p.employee.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.employee.designation?.name ?? p.employee.employeeId}{p.employee.department && ` · ${p.employee.department.name}`}</p>
                </div>
                {p.employee.terminationDate && <Badge tone="warning">Leaving {formatDate(p.employee.terminationDate)}</Badge>}
              </div>
              <ul className="space-y-1.5">
                {p.assets.map((a) => (
                  <li key={a.id}>
                    <Link href={`/app/assets/${a.asset.id}`} className="flex items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-subtle">
                      <ProductArt icon={a.asset.type.icon} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-sm"><b className="font-mono font-medium">{a.asset.tag}</b> · {a.asset.name}</span>
                      {!a.acknowledgedAt && <Badge tone="warning" className="px-1.5 py-0 text-2xs">Unconfirmed</Badge>}
                      {a.dueBack && <Badge tone="primary" className="px-1.5 py-0 text-2xs">Loan · {formatDate(a.dueBack)}</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      {people.data && <Pagination page={page} totalPages={people.data.meta.totalPages} total={people.data.meta.total} limit={people.data.meta.limit} onPageChange={setPage} />}
    </div>
  );
}

// ─── Returns (leavers + loans) and the yearly check ─────────

function ReturnsAndChecks() {
  const returns = useAssetReturns();
  const checks = useCheckOverview();
  const [allReports, setAllReports] = useState(false);
  const start = useStartCheck();
  const remind = useRemindCheck();
  const close = useCloseCheck();
  const [starting, setStarting] = useState(false);
  const year = new Date().getFullYear();
  const [name, setName] = useState(`Yearly check ${year}`);
  const [dueOn, setDueOn] = useState('');

  const r = returns.data;
  const c = checks.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Undo2 className="size-4 text-primary" /> To collect</h2>
        {returns.isLoading ? <Skeleton className="h-40" /> : returns.isLoadingError ? <ErrorState message={getApiErrorMessage(returns.error, 'Could not load')} onRetry={() => void returns.refetch()} /> : r && (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">People leaving · {r.leavers.length}</p>
            {!r.leavers.length ? <p className="text-sm text-muted-foreground">Nobody leaving holds company assets.</p> : (
              <ul className="space-y-2">
                {r.leavers.map((l) => (
                  <li key={l.employee.id} className="rounded-lg bg-subtle p-2.5">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <PersonAvatar person={l.employee} size="xs" /> {l.employee.firstName} {l.employee.lastName}
                      <span className="text-xs font-normal text-muted-foreground">{l.employee.terminationDate ? `last day ${formatDate(l.employee.terminationDate)}` : l.employee.employmentStatus.toLowerCase().replace('_', ' ')}</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {l.assets.map((a) => (
                        <Link key={a.id} href={`/app/assets/${a.asset.id}`} className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs hover:border-primary">
                          <ProductArt icon={a.asset.type.icon} size="xs" className="!h-5 !w-7" /> <span className="font-mono">{a.asset.tag}</span>
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Loans due in 14 days · {r.loans.length}</p>
            {!r.loans.length ? <p className="text-sm text-muted-foreground">No loans due soon.</p> : (
              <ul className="space-y-1.5">
                {r.loans.map((l) => (
                  <li key={l.id}>
                    <Link href={`/app/assets/${l.asset.id}`} className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-subtle">
                      <LoanRing dueBack={l.dueBack} />
                      <span className="min-w-0 flex-1 text-sm"><b className="font-medium">{l.asset.name}</b> <span className="font-mono text-xs text-muted-foreground">{l.asset.tag}</span><br /><span className="text-xs text-muted-foreground">{l.employee.firstName} {l.employee.lastName} · back by {formatDate(l.dueBack)}</span></span>
                      {l.overdue && <Badge tone="danger">Overdue</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="size-4 text-primary" /> Yearly “still have it?” check</h2>
        {checks.isLoading ? <Skeleton className="h-40" /> : checks.isLoadingError ? <ErrorState message={getApiErrorMessage(checks.error, 'Could not load')} onRetry={() => void checks.refetch()} /> : c && (
          c.open ? (
            <div className="space-y-3">
              <p className="text-sm"><b>{c.open.name}</b> · answers due {formatDate(c.open.dueOn)}</p>
              {c.progress && (
                <>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${c.progress.people ? (c.progress.done / c.progress.people) * 100 : 0}%` }} /></div>
                  <p className="text-xs text-muted-foreground">{c.progress.done} of {c.progress.people} people answered · {c.progress.notAnswered} waiting · {c.progress.reported} reported a problem</p>
                  {c.progress.reports.length > 0 && (
                    <ul className="space-y-1.5">
                      {c.progress.reports.map((rep, i) => (
                        <li key={i} className="rounded-lg bg-warning-soft/50 px-3 py-2 text-xs">
                          <b>{rep.employee?.firstName} {rep.employee?.lastName}</b> · {rep.asset ? <Link className="font-mono hover:underline" href={`/app/assets/${rep.asset.id}`}>{rep.asset.tag}</Link> : 'an asset'} · {rep.answer === 'PROBLEM' ? 'has a problem' : 'not with them'}{rep.note && ` — “${rep.note}”`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {c.progress.reportsTotal > c.progress.reports.length && (
                    <button type="button" onClick={() => setAllReports(true)} className="text-xs font-semibold text-primary hover:underline">See all {c.progress.reportsTotal} problems</button>
                  )}
                  {allReports && <CheckReportsDialog checkId={c.open.id} onClose={() => setAllReports(false)} />}
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" loading={remind.isPending} disabled={!c.progress?.notAnswered} onClick={() => remind.mutate(c.open!.id, { onSuccess: (x) => toast.success(`Reminded ${x.reminded} ${x.reminded === 1 ? 'person' : 'people'}`), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not remind')) })}><BellRing /> Remind the rest</Button>
                <Button size="sm" variant="ghost" loading={close.isPending} onClick={() => close.mutate(c.open!.id, { onSuccess: () => toast.success('Check closed'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not close')) })}>Close check</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Ask everyone holding company assets to confirm they still have them. Problems and missing items come straight to IT.</p>
              <Button onClick={() => setStarting(true)}><ClipboardCheck /> Start a check</Button>
              {c.past.length > 0 && (
                <ul className="space-y-1 pt-2 text-xs text-muted-foreground">
                  {c.past.slice(0, 4).map((p) => <li key={p.id}>{p.name} · closed {formatDate(p.closedAt)}</li>)}
                </ul>
              )}
            </div>
          )
        )}
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"><QrCode className="size-4" /> Scan-to-confirm with phone camera — <b>coming soon</b></div>
      </Card>

      <Modal
        open={starting}
        onClose={() => setStarting(false)}
        busy={start.isPending}
        icon={<ClipboardCheck />}
        title="Start a check"
        description="Everyone holding something gets a notification and a card on their My assets page."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStarting(false)}>Cancel</Button>
            <Button loading={start.isPending} disabled={!dueOn || name.trim().length < 3} onClick={() => start.mutate({ name: name.trim(), dueOn }, { onSuccess: () => { toast.success('Check started'); setStarting(false); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not start')) })}>Start</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" htmlFor="ck-name"><Input id="ck-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
          <Field label="Answer by" htmlFor="ck-due" required><DateInput id="ck-due" value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/** Every problem reported in the open check, 25 at a time. */
function CheckReportsDialog({ checkId, onClose }: { checkId: string; onClose: () => void }) {
  const q = useCheckReports(checkId);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  return (
    <Modal open onClose={onClose} title="Problems reported" icon={<ClipboardCheck />} size="sm">
      {q.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load')} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <ul className="space-y-1.5">
            {rows.map((rep, i) => (
              <li key={i} className="rounded-lg bg-warning-soft/50 px-3 py-2 text-xs">
                <b>{rep.employee?.firstName} {rep.employee?.lastName}</b> · {rep.asset ? <Link className="font-mono hover:underline" href={`/app/assets/${rep.asset.id}`}>{rep.asset.tag}</Link> : 'an asset'} · {rep.answer === 'PROBLEM' ? 'has a problem' : 'not with them'}{rep.note && ` — “${rep.note}”`}
              </li>
            ))}
          </ul>
          <LoadMore shown={rows.length} total={q.data.pages[0]?.meta.total ?? 0} loading={q.isFetchingNextPage} onMore={() => void q.fetchNextPage()} />
        </>
      )}
    </Modal>
  );
}
