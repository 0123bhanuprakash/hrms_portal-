'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { FileText, HardDrive, MoreHorizontal, Pencil, QrCode, RotateCcw, Trash2, Upload, UserPlus, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { AssetFormDialog, AssignDialog, ReturnDialog, StatusDialog } from '@/components/assets/asset-dialogs';
import { LoanRing, ProductArt } from '@/components/assets/product-art';
import { ASSET_STATUS, CONDITION_LABEL, daysUntil, openAssetDocument, useAsset, useRemoveAssetDocument, useUploadAssetDocument, type Asset } from '@/lib/company/assets';
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
    a.status === 'IN_REPAIR' && { label: 'Back from repair', onSelect: () => setStatus('AVAILABLE') },
    a.status !== 'AVAILABLE' && a.status !== 'ASSIGNED' && a.status !== 'IN_REPAIR' && { label: 'Mark available', onSelect: () => setStatus('AVAILABLE') },
    a.status === 'AVAILABLE' && { label: 'Send for repair', onSelect: () => setStatus('IN_REPAIR') },
    a.status !== 'LOST' && a.status !== 'RETIRED' && { label: 'Mark as lost', onSelect: () => setStatus('LOST'), danger: true },
    (a.status === 'AVAILABLE' || a.status === 'IN_REPAIR' || a.status === 'LOST') && { label: 'Retire', onSelect: () => setStatus('RETIRED'), danger: true },
  ].filter(Boolean) as Array<{ label: string; onSelect: () => void; danger?: boolean }>;

  const state = a.status === 'IN_REPAIR' ? 'repair' : a.status === 'LOST' ? 'lost' : a.holder?.dueBack ? 'loan' : null;
  const specs = Object.entries(a.specs ?? {}).filter(([, v]) => v);
  const warrantyLeft = a.warrantyUntil ? daysUntil(a.warrantyUntil) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href="/app/assets" className="hover:underline">Assets</Link>}
        title={`${a.tag} · ${a.name}`}
        description={
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={ASSET_STATUS[a.status].tone}>{ASSET_STATUS[a.status].label}</Badge>
            {a.replaceDue && <Badge tone="info">Due for replacement</Badge>}
            {a.overdue && <Badge tone="danger">Loan overdue</Badge>}
          </span>
        }
        action={
          m && (
            <div className="flex flex-wrap gap-2">
              {a.status === 'AVAILABLE' && <Button onClick={() => setAssigning(true)}><UserPlus /> Hand over</Button>}
              {a.status === 'ASSIGNED' && <Button onClick={() => setReturning(true)}><RotateCcw /> Take back</Button>}
              {a.status === 'IN_REPAIR' && <Button onClick={() => setStatus('AVAILABLE')}><Wrench /> Back from repair</Button>}
              <Button variant="secondary" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
              {more.length > 0 && <DropdownMenu trigger={() => <Button variant="secondary" size="icon" aria-label="More actions"><MoreHorizontal /></Button>} items={more} />}
            </div>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex flex-col gap-5 p-5 sm:flex-row">
            <div className="flex h-40 shrink-0 items-center justify-center rounded-xl bg-subtle px-6 sm:w-56">
              <ProductArt icon={a.type.icon} size="md" play hover state={state} label={a.name.split(' ')[0]} />
            </div>
            <dl className="grid flex-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item label="Type">{a.type.name}</Item>
              <Item label="Condition">{CONDITION_LABEL[a.condition]}</Item>
              <Item label="Brand / model">{[a.brand, a.model].filter(Boolean).join(' ') || '—'}</Item>
              <Item label="Serial number"><span className="font-mono">{a.serialNumber ?? '—'}</span></Item>
              {m && <Item label="Purchased">{formatDate(a.purchaseDate)}{a.vendor && ` · ${a.vendor}`}</Item>}
              {m && <Item label="Cost">{a.purchaseCostPaise !== null ? money(a.purchaseCostPaise) : '—'}</Item>}
              <Item label="Warranty until">
                {formatDate(a.warrantyUntil)}
                {warrantyLeft !== null && (warrantyLeft < 0 ? <span className="text-muted-foreground"> · ended</span> : warrantyLeft <= 30 ? <span className="text-warning"> · {warrantyLeft} days left</span> : null)}
              </Item>
              {specs.map(([k, v]) => <Item key={k} label={k}>{v}</Item>)}
              {a.notes && <Item label="Notes" wide>{a.notes}</Item>}
            </dl>
          </div>
          {a.openRepair && (
            <p className="flex items-center gap-2 border-t border-border bg-warning-soft/50 px-5 py-2.5 text-sm">
              <Wrench className="size-4 text-warning" /> In repair since {formatDate(a.openRepair.startedAt)} — {a.openRepair.issue}{a.openRepair.vendor && ` · ${a.openRepair.vendor}`}
            </p>
          )}
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">With</h2>
            {a.holder ? <Holder a={a} /> : <p className="text-sm text-muted-foreground">Nobody — {a.status === 'AVAILABLE' ? 'in stock' : ASSET_STATUS[a.status].label.toLowerCase()}.</p>}
          </Card>
          <Card className="flex items-center gap-3 border-dashed p-4 text-sm text-muted-foreground">
            <QrCode className="size-8 shrink-0" />
            <span><b className="text-foreground">QR label</b> — print a sticker and scan it with a phone to open this page. <Badge tone="primary" className="ml-1">Coming soon</Badge></span>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Repairs</h2>
          {!a.repairs?.length ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">No repairs so far.</p>
          ) : (
            <ul className="divide-y divide-border">
              {a.repairs.map((r) => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <p className="font-medium">{r.issue}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.startedAt)} → {r.endedAt ? formatDate(r.endedAt) : 'still in repair'}
                    {r.vendor && ` · ${r.vendor}`}
                    {m && r.costPaise !== null && ` · ${money(r.costPaise)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Documents a={a} />
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
                    {h.dueBack && ` · loan until ${formatDate(h.dueBack)}`}
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

function Documents({ a }: { a: Asset }) {
  const upload = useUploadAssetDocument(a.id);
  const remove = useRemoveAssetDocument(a.id);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-2">
        <h2 className="text-sm font-semibold">Documents</h2>
        {a.canManage && (
          <>
            <Button size="sm" variant="ghost" loading={upload.isPending} onClick={() => input.current?.click()}><Upload /> Add</Button>
            <input
              ref={input}
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) upload.mutate(f, { onSuccess: () => toast.success('Document added'), onError: (err) => toast.error(getApiErrorMessage(err, 'Could not upload')) });
              }}
            />
          </>
        )}
      </div>
      {!a.documents?.length ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">Invoices, warranty cards and photos go here.</p>
      ) : (
        <ul className="divide-y divide-border">
          {a.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <FileText className="size-4 text-muted-foreground" />
              <button type="button" className="min-w-0 flex-1 truncate text-left font-medium hover:underline" onClick={() => void openAssetDocument(a.id, d).catch(() => toast.error('Could not open the file'))}>{d.name}</button>
              <span className="text-xs text-muted-foreground">{Math.max(1, Math.round(d.size / 1024))} KB · {formatDate(d.createdAt)}</span>
              {a.canManage && (
                <Button size="icon" variant="ghost" aria-label={`Remove ${d.name}`} loading={remove.isPending && remove.variables === d.id} onClick={() => remove.mutate(d.id, { onSuccess: () => toast.success('Removed'), onError: (err) => toast.error(getApiErrorMessage(err, 'Could not remove')) })}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
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
        <div className="min-w-0 flex-1">
          <Link href={`/app/employees/${h.employee.id}`} className="font-medium hover:underline">{h.employee.firstName} {h.employee.lastName}</Link>
          <p className="text-xs text-muted-foreground">{h.employee.designation?.name ?? h.employee.employeeId}</p>
        </div>
        {h.dueBack && <LoanRing dueBack={h.dueBack} from={h.assignedAt.slice(0, 10)} />}
      </div>
      <p className="text-xs text-muted-foreground">Since {formatDate(h.assignedAt)}{h.dueBack && ` · loan until ${formatDate(h.dueBack)}`}</p>
      {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
      {h.acknowledgedAt ? <Badge tone="success" dot>Confirmed {formatDateTime(h.acknowledgedAt)}</Badge> : <Badge tone="warning" dot>Not confirmed yet</Badge>}
    </div>
  );
}
