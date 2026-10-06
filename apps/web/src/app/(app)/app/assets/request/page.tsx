'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, PackagePlus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Textarea, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ProductArt } from '@/components/assets/product-art';
import { useAccess } from '@/lib/access/use-access';
import { useAssetCatalog, useRequestAsset, useRequestPreview, type CatalogType } from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { DateInput, PersonSelect } from '@/components/ui/pickers';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDaysKey = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function RequestAssetPage() {
  const router = useRouter();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('ops.assets') && can('asset.request');
  const catalog = useAssetCatalog(allowed);
  const [typeId, setTypeId] = useState('');
  const [forId, setForId] = useState('');
  const [kind, setKind] = useState<'KEEP' | 'LOAN'>('KEEP');
  const [loanFrom, setLoanFrom] = useState(todayKey());
  const [loanUntil, setLoanUntil] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [reason, setReason] = useState('');
  const mePreview = useRequestPreview(undefined, allowed);
  const preview = useRequestPreview(forId || undefined, allowed);
  const request = useRequestAsset();

  const type = catalog.data?.find((t) => t.id === typeId);
  const team = mePreview.data?.team ?? [];
  const maxUntil = type?.maxLoanDays ? addDaysKey(loanFrom, type.maxLoanDays) : undefined;
  const loanDays = loanUntil ? Math.round((Date.parse(loanUntil) - Date.parse(loanFrom)) / 86_400_000) : 0;
  const loanBad = kind === 'LOAN' && (!loanUntil || loanUntil < loanFrom || (maxUntil !== undefined && loanUntil > maxUntil));

  const steps = useMemo(() => preview.data?.steps ?? [], [preview.data]);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="You can’t request assets" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;
    try {
      await request.mutateAsync({
        typeId,
        reason: reason.trim(),
        forEmployeeId: forId || null,
        kind,
        ...(kind === 'LOAN' ? { loanFrom, loanUntil } : { neededBy: neededBy || null }),
      });
      toast.success(`Request sent — ${steps[0] ? `${steps[0].label}${steps[0].person ? ` (${steps[0].person.firstName})` : ''} approves first` : 'it’s on its way'}`);
      router.push('/app/assets/mine');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send the request'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link href="/app/assets/mine" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft className="size-3" /> My assets</Link>}
        title="Request an asset"
        description="Pick what you need — to keep, or on loan for a few days. You’ll see who approves it before you send."
      />

      {catalog.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : catalog.isError ? (
        <ErrorState message={getApiErrorMessage(catalog.error, 'Could not load the catalogue')} onRetry={() => void catalog.refetch()} />
      ) : !catalog.data?.length ? (
        <EmptyState icon={<PackagePlus />} title="Nothing can be requested" description="IT hasn’t opened any asset types for requests yet." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {catalog.data.map((t) => <CatalogCard key={t.id} t={t} selected={t.id === typeId} onPick={() => { setTypeId(t.id); if (!t.loanable) setKind('KEEP'); }} />)}
        </div>
      )}

      {type && (
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="space-y-4 p-5">
            <p className="font-semibold">{type.name}{type.description && <span className="ml-1 font-normal text-muted-foreground">— {type.description}</span>}</p>

            {team.length > 0 && (
              <Field label="Who is it for?" htmlFor="rq-for">
                <PersonSelect id="rq-for" value={forId} onChange={setForId} emptyLabel="Me" people={team.map((p) => ({ ...p, sub: daysAhead(p.joiningDate) > 0 ? `Joins ${formatDate(p.joiningDate)}` : null }))} />
              </Field>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <KindCard active={kind === 'KEEP'} onClick={() => setKind('KEEP')} title="To keep" text="Yours until you return it or leave." />
              <KindCard active={kind === 'LOAN'} disabled={!type.loanable} onClick={() => setKind('LOAN')} title="On loan" text={type.loanable ? `For a few days${type.maxLoanDays ? ` — up to ${type.maxLoanDays}` : ''}, then it comes back.` : 'This type isn’t lent out.'} />
            </div>

            {kind === 'LOAN' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From" htmlFor="rq-from" required><DateInput id="rq-from" value={loanFrom} min={todayKey()} onChange={(e) => setLoanFrom(e.target.value)} required /></Field>
                <Field label="Back by" htmlFor="rq-until" required hint={loanUntil ? (maxUntil && loanUntil > maxUntil ? `Longest loan is ${type.maxLoanDays} days` : `${loanDays} day${loanDays === 1 ? '' : 's'}`) : undefined}>
                  <DateInput id="rq-until" value={loanUntil} min={loanFrom} max={maxUntil} onChange={(e) => setLoanUntil(e.target.value)} required />
                </Field>
              </div>
            ) : (
              <Field label="Needed by" htmlFor="rq-need" hint="Optional — helps IT plan"><DateInput id="rq-need" value={neededBy} min={todayKey()} onChange={(e) => setNeededBy(e.target.value)} className="sm:max-w-xs" /></Field>
            )}

            <Field label="Why do you need it?" htmlFor="rq-reason" required>
              <Textarea id="rq-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder={kind === 'LOAN' ? 'e.g. Client demo in Pune next week' : 'e.g. My current laptop is 5 years old and too slow for builds'} />
            </Field>
          </Card>

          <Card className="h-fit space-y-4 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Who approves</p>
            {preview.isLoading ? (
              <Skeleton className="h-28" />
            ) : preview.isError ? (
              <p className="text-sm text-destructive">{getApiErrorMessage(preview.error, 'Could not work out the approvers')}</p>
            ) : (
              <ol className="space-y-2.5">
                {steps.map((s, i) => (
                  <li key={s.stage} className="flex items-center gap-2.5">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                    <span className="min-w-0 flex-1 text-sm"><b className="font-semibold">{s.label}</b>{s.person && <span className="text-muted-foreground"> · {s.person.firstName} {s.person.lastName}</span>}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-success [&_svg]:size-3.5"><Check /></span>
                  <span className="text-sm"><b className="font-semibold">IT hands it over</b>{type.available > 0 ? <span className="text-muted-foreground"> · {type.available} in stock</span> : <span className="text-warning"> · none in stock — may take longer</span>}</span>
                </li>
              </ol>
            )}
            {forId && preview.data && <p className="flex items-center gap-2 text-xs text-muted-foreground"><PersonAvatar person={{ ...preview.data.for, avatarUrl: null }} size="xs" /> For {preview.data.for.firstName} — they’ll be told when it’s ready.</p>}
            <Button type="submit" className="w-full" loading={request.isPending} disabled={reason.trim().length < 5 || loanBad}>Send request <ArrowRight /></Button>
          </Card>
        </form>
      )}
    </div>
  );
}

function daysAhead(key: string) {
  return Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${todayKey()}T00:00:00Z`)) / 86_400_000);
}

function CatalogCard({ t, selected, onPick }: { t: CatalogType; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn('pa-hover group flex flex-col items-center gap-2 rounded-xl border-[1.5px] bg-surface p-4 text-center shadow-card transition-all hover:-translate-y-0.5', selected ? 'border-primary ring-2 ring-primary/20' : 'border-border')}
    >
      <ProductArt icon={t.icon} size="sm" play={selected} label={t.name.split(' ')[0]} />
      <span className="text-sm font-semibold">{t.name}</span>
      <span className="flex flex-wrap justify-center gap-1">
        <Badge tone={t.available > 0 ? 'success' : 'warning'}>{t.available > 0 ? `${t.available} in stock` : 'Out of stock'}</Badge>
        {t.loanable && <Badge tone="primary">Loan</Badge>}
      </span>
    </button>
  );
}

function KindCard({ active, disabled, onClick, title, text }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn('rounded-xl border-[1.5px] p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50', active ? 'border-primary bg-primary-soft/40' : 'border-border hover:bg-subtle')}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-xs text-muted-foreground">{text}</span>
    </button>
  );
}
