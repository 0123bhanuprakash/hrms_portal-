'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { HardDrive, MoreHorizontal, Pencil, RotateCcw, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { AssetFormDialog, AssignDialog, ReturnDialog, StatusDialog } from '@/components/assets/asset-dialogs';
import { ASSET_STATUS, CONDITION_LABEL, useAsset, type Asset } from '@/lib/company/assets';
import { money } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime } from '@/lib/format';

export default function AssetPage() {
  const { id } = useParams<{ id: string }>();
  const q = useAsset(id);
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [returning, setReturning] = useState(false);
  const [status, setStatus] = useState<'AVAILABLE' | 'IN_REPAIR' | 'LOST' | 'RETIRED' | null>(null);

  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isError) return (q.error as { response?: { status?: number } })?.response?.status === 404 ? <EmptyState icon={<HardDrive />} title="Asset not found" /> : <ErrorState message={getApiErrorMessage(q.error, 'Could not load the asset')} onRetry={() => void q.refetch()} />;
  const a = q.data!;
  const m = a.canManage;

  const more = [
    a.status !== 'AVAILABLE' && a.status !== 'ASSIGNED' && { label: 'Mark available', onSelect: () => setStatus('AVAILABLE') },
    a.status === 'AVAILABLE' && { label: 'Send for repair', onSelect: () => setStatus('IN_REPAIR') },
    a.status !== 'LOST' && a.status !== 'RETIRED' && { label: 'Mark as lost', onSelect: () => setStatus('LOST'), danger: true },
    (a.status === 'AVAILABLE' || a.status === 'IN_REPAIR' || a.status === 'LOST') && { label: 'Retire', onSelect: () => setStatus('RETIRED'), danger: true },
  ].filter(Boolean) as Array<{ label: string; onSelect: () => void; danger?: boolean }>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href="/app/assets" className="hover:underline">Assets</Link>}
        title={`${a.tag} · ${a.name}`}
        description={<Badge tone={ASSET_STATUS[a.status].tone}>{ASSET_STATUS[a.status].label}</Badge>}
        action={
          m && (
            <div className="flex flex-wrap gap-2">
              {a.status === 'AVAILABLE' && <Button onClick={() => setAssigning(true)}><UserPlus /> Hand over</Button>}
              {a.status === 'ASSIGNED' && <Button onClick={() => setReturning(true)}><RotateCcw /> Take back</Button>}
              <Button variant="secondary" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
              {more.length > 0 && (
                <DropdownMenu
                  trigger={() => <Button variant="secondary" size="icon" aria-label="More actions"><MoreHorizontal /></Button>}
                  items={more}
                />
              )}
            </div>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Item label="Type">{a.type.name}</Item>
            <Item label="Condition">{CONDITION_LABEL[a.condition]}</Item>
            <Item label="Brand / model">{[a.brand, a.model].filter(Boolean).join(' ') || '—'}</Item>
            <Item label="Serial number"><span className="font-mono">{a.serialNumber ?? '—'}</span></Item>
            {m && <Item label="Purchased">{formatDate(a.purchaseDate)}{a.vendor && ` · ${a.vendor}`}</Item>}
            {m && <Item label="Cost">{a.purchaseCostPaise !== null ? money(a.purchaseCostPaise) : '—'}</Item>}
            <Item label="Warranty until">{formatDate(a.warrantyUntil)}</Item>
            {a.notes && <Item label="Notes" wide>{a.notes}</Item>}
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">With</h2>
          {a.holder ? <Holder a={a} /> : <p className="text-sm text-muted-foreground">Nobody — {a.status === 'AVAILABLE' ? 'in stock' : ASSET_STATUS[a.status].label.toLowerCase()}.</p>}
        </Card>
      </div>

      {a.history && a.history.length > 0 && (
        <Card className="overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">History</h2>
          <ul className="divide-y divide-border">
            {a.history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <PersonAvatar person={h.employee} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/app/employees/${h.employee.id}`} className="font-medium hover:underline">{h.employee.firstName} {h.employee.lastName}</Link>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(h.assignedAt)} ({CONDITION_LABEL[h.conditionOut].toLowerCase()}) → {h.returnedAt ? `${formatDate(h.returnedAt)} (${h.conditionIn ? CONDITION_LABEL[h.conditionIn].toLowerCase() : '—'})` : 'now'}
                  </p>
                  {(h.notes || h.returnNotes) && <p className="text-xs text-muted-foreground">{[h.notes, h.returnNotes].filter(Boolean).join(' · ')}</p>}
                </div>
                {!h.returnedAt && <Badge tone="info">Current</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing && <AssetFormDialog value={a} onClose={() => setEditing(false)} />}
      <AssignDialog asset={assigning ? a : null} onClose={() => setAssigning(false)} />
      <ReturnDialog asset={returning ? a : null} onClose={() => setReturning(false)} />
      <StatusDialog value={status ? { asset: a, status } : null} onClose={() => setStatus(null)} />
    </div>
  );
}

function Item({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function Holder({ a }: { a: Asset }) {
  const h = a.holder!;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2.5">
        <PersonAvatar person={h.employee} />
        <div className="min-w-0">
          <Link href={`/app/employees/${h.employee.id}`} className="font-medium hover:underline">{h.employee.firstName} {h.employee.lastName}</Link>
          <p className="text-xs text-muted-foreground">{h.employee.designation?.name ?? h.employee.employeeId}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Since {formatDate(h.assignedAt)}{h.notes && ` · ${h.notes}`}</p>
      {h.acknowledgedAt ? <Badge tone="success" dot>Confirmed {formatDateTime(h.acknowledgedAt)}</Badge> : <Badge tone="warning" dot>Not confirmed yet</Badge>}
    </div>
  );
}
