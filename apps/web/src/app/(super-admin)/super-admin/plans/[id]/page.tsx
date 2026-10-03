'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Check, Layers, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { useUnsavedGuard } from '@/components/theme/theme-editor';
import { useAccessCatalog, type CatalogFeatureWithFlag } from '@/lib/access/use-access';
import { useCreatePlan, usePlan, useUpdatePlan } from '@/lib/admin/plans';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

interface Draft {
  name: string;
  description: string;
  isActive: boolean;
  features: string[];
  maxEmployees: number | null;
}

const EMPTY: Draft = { name: '', description: '', isActive: true, features: [], maxEmployees: 50 };
const snapshot = (d: Draft) => JSON.stringify({ ...d, features: [...d.features].sort() });

export default function PlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const plan = usePlan(isNew ? null : id);
  const catalog = useAccessCatalog();
  const create = useCreatePlan();
  const update = useUpdatePlan(id);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [baseline, setBaseline] = useState(snapshot(EMPTY));
  const [error, setError] = useState<string | null>(null);

  const features = useMemo(() => (catalog.data ?? []).flatMap((m) => m.features), [catalog.data]);
  const byKey = useMemo(() => new Map(features.map((f) => [f.key, f])), [features]);
  const coreKeys = useMemo(() => features.filter((f) => f.core).map((f) => f.key), [features]);

  useEffect(() => {
    if (isNew && coreKeys.length) {
      const d = { ...EMPTY, features: coreKeys };
      setDraft(d);
      setBaseline(snapshot(d));
    }
  }, [isNew, coreKeys]);

  useEffect(() => {
    if (plan.data) {
      const d: Draft = {
        name: plan.data.name,
        description: plan.data.description,
        isActive: plan.data.isActive,
        features: plan.data.features,
        maxEmployees: plan.data.limits.maxEmployees ?? null,
      };
      setDraft(d);
      setBaseline(snapshot(d));
    }
  }, [plan.data]);

  const dirty = snapshot(draft) !== baseline;
  useUnsavedGuard(dirty);

  const toggle = (key: string, on: boolean) => {
    // Work out the change first, then update state and notify once
    // (side effects inside a state updater run twice in React dev mode)
    const set = new Set(draft.features);
    const touched: string[] = [];
    if (on) {
      const add = (k: string) => {
        if (set.has(k)) return;
        set.add(k);
        touched.push(k);
        byKey.get(k)?.dependsOn?.forEach(add);
      };
      add(key);
    } else {
      const drop = (k: string) => {
        if (!set.has(k)) return;
        set.delete(k);
        touched.push(k);
        features.filter((f) => f.dependsOn?.includes(k)).forEach((f) => drop(f.key));
      };
      drop(key);
    }
    setDraft({ ...draft, features: [...set] });
    const extra = touched.filter((k) => k !== key).map((k) => byKey.get(k)?.label);
    if (extra.length) {
      toast.info(
        on
          ? `Also added: ${extra.join(', ')} (needed by ${byKey.get(key)?.label})`
          : `Also removed: ${extra.join(', ')} (they need ${byKey.get(key)?.label})`,
      );
    }
  };

  const save = async () => {
    setError(null);
    if (draft.name.trim().length < 2) return setError('Give the plan a name');
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      isActive: draft.isActive,
      features: draft.features,
      limits: { maxEmployees: draft.maxEmployees },
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync(body);
        toast.success(`Plan “${created.name}” created`);
        setBaseline(snapshot(draft));
        router.replace(`/super-admin/plans/${created.id}`);
      } else {
        const r = await update.mutateAsync(body);
        const { added, removed, affectedCompanies } = r.changes;
        const parts = [added.length && `${added.length} feature(s) added`, removed.length && `${removed.length} removed`].filter(Boolean);
        toast.success(`Saved${parts.length ? ` · ${parts.join(' · ')}` : ''}${affectedCompanies ? ` — applied to ${affectedCompanies} compan${affectedCompanies === 1 ? 'y' : 'ies'}` : ''}`);
        setBaseline(snapshot(draft));
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not save the plan'));
    }
  };

  if (plan.isError) return <ErrorState message={getApiErrorMessage(plan.error, 'Could not load the plan')} onRetry={() => plan.refetch()} />;
  const loading = catalog.isLoading || (!isNew && plan.isLoading);
  const selectedCount = draft.features.filter((k) => byKey.get(k) && byKey.get(k)!.stage !== 'coming_soon').length;
  const availableCount = features.filter((f) => f.stage !== 'coming_soon').length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/super-admin/plans" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Plans
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Layers className="h-5 w-5 text-primary" />
          {isNew ? 'New plan' : plan.data?.name ?? <Skeleton className="h-7 w-40" />}
        </h1>
        {!isNew && plan.data && (
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.data.companyCount} compan{plan.data.companyCount === 1 ? 'y' : 'ies'} on this plan · key <code>{plan.data.key}</code>
          </p>
        )}
      </div>

      {!isNew && (plan.data?.companyCount ?? 0) > 0 && (
        <Card className="flex items-start gap-3 border-warning/30 bg-warning-soft/40 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <span className="font-medium">Changes apply immediately</span> to the {plan.data!.companyCount} compan
            {plan.data!.companyCount === 1 ? 'y' : 'ies'} on this plan. Removed features disappear for their users on the next click; their data is kept.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan name" htmlFor="plan-name" required>
                <Input id="plan-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} placeholder="e.g. Growth" />
              </Field>
              <Field label="Description" htmlFor="plan-desc">
                <Textarea id="plan-desc" rows={2} value={draft.description} maxLength={200} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
            </div>
          </Card>

          {loading
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36" />)
            : (catalog.data ?? []).map((m) => (
                <Card key={m.key} className="overflow-hidden">
                  <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                  <ul className="divide-y divide-border">
                    {m.features.map((f) => (
                      <FeatureRow key={f.key} feature={f} checked={draft.features.includes(f.key)} onToggle={toggle} byKey={byKey} />
                    ))}
                  </ul>
                </Card>
              ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold">Limits</h2>
            <Field label="Max employees" htmlFor="max-emp" hint="Terminated employees don't count. Companies can get a custom limit on their Plan & features tab.">
              <div className="flex items-center gap-2">
                <Input
                  id="max-emp"
                  type="number"
                  min={0}
                  value={draft.maxEmployees ?? ''}
                  disabled={draft.maxEmployees === null}
                  onChange={(e) => setDraft({ ...draft, maxEmployees: e.target.value === '' ? 0 : Math.max(0, Math.floor(Number(e.target.value))) })}
                  className="w-28"
                />
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="accent-[hsl(var(--primary))]"
                    checked={draft.maxEmployees === null}
                    onChange={(e) => setDraft({ ...draft, maxEmployees: e.target.checked ? null : 50 })}
                  />
                  Unlimited
                </label>
              </div>
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              <span>
                Available for new companies
                <span className="block text-xs text-muted-foreground">Unticked = archived: existing companies keep it.</span>
              </span>
            </label>
          </Card>
          <Card className="p-5 text-sm">
            <p className="font-semibold">{selectedCount} of {availableCount} features</p>
            <p className="mt-1 text-xs text-muted-foreground">Core features are always included. Company Admins only see — and can only grant — the features of their plan.</p>
          </Card>
        </aside>
      </div>

      {(dirty || isNew) && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-surface/95 backdrop-blur animate-in slide-in-from-bottom-2 sm:-mx-6 lg:-mx-8">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="truncate text-sm text-muted-foreground">
              {error ? <span className="text-destructive">{error}</span> : isNew ? 'New plan — not saved yet' : 'You have unsaved changes'}
            </p>
            <div className="flex shrink-0 gap-2">
              {!isNew && (
                <Button variant="ghost" onClick={() => setDraft(JSON.parse(baseline) as Draft)}>
                  Discard
                </Button>
              )}
              <Button onClick={save} loading={create.isPending || update.isPending}>
                {isNew ? 'Create plan' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureRow({
  feature,
  checked,
  onToggle,
  byKey,
}: {
  feature: CatalogFeatureWithFlag;
  checked: boolean;
  onToggle: (key: string, on: boolean) => void;
  byKey: Map<string, CatalogFeatureWithFlag>;
}) {
  const comingSoon = feature.stage === 'coming_soon';
  const locked = Boolean(feature.core) || comingSoon;
  const isOn = feature.core ? true : checked && !comingSoon;
  return (
    <li>
      <label className={cn('flex items-start gap-3 px-4 py-3', locked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/30', comingSoon && 'opacity-55')}>
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
          checked={isOn}
          disabled={locked}
          onChange={(e) => onToggle(feature.key, e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
            {feature.label}
            {feature.core && (
              <Badge tone="neutral">
                <Lock className="h-3 w-3" /> Core
              </Badge>
            )}
            {feature.stage === 'beta' && <Badge tone="info">Beta</Badge>}
            {comingSoon && <Badge tone="neutral">Coming soon</Badge>}
          </span>
          <span className="block text-xs text-muted-foreground">
            {feature.description}
            {feature.dependsOn?.length ? ` · Needs ${feature.dependsOn.map((d) => byKey.get(d)?.label ?? d).join(', ')}` : ''}
          </span>
          <span className="mt-1 block text-[11px] text-muted-foreground">{feature.permissions.length} permissions</span>
        </span>
        {isOn && !locked && <Check className="h-4 w-4 shrink-0 text-success" />}
      </label>
    </li>
  );
}
