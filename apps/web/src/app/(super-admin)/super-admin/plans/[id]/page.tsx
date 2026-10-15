'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Archive, ArchiveRestore, ArrowLeft, Copy, History, Layers, Lock, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { useUnsavedGuard } from '@/components/theme/theme-editor';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { HealthPill } from '@/components/super-admin/company-insights';
import { ImpactList, MovePlanMenu, Toggle, useDuplicatePlan } from '@/components/super-admin/plans-ui';
import { useAccessCatalog, type CatalogFeatureWithFlag } from '@/lib/access/use-access';
import { useCompanies } from '@/lib/admin/queries';
import { formatLimit, planColor, useCreatePlan, usePlan, usePlanHistory, usePlanImpact, usePlans, useUpdatePlan, type PlanHistoryItem } from '@/lib/admin/plans';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Draft {
  name: string;
  description: string;
  isActive: boolean;
  features: string[];
  maxEmployees: number | null;
}

type Tab = 'features' | 'companies' | 'history';
const EMPTY: Draft = { name: '', description: '', isActive: true, features: [], maxEmployees: 50 };
const snapshot = (d: Draft) => JSON.stringify({ ...d, features: [...d.features].sort() });

export default function PlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const plan = usePlan(isNew ? null : id);
  const plans = usePlans();
  const catalog = useAccessCatalog();
  const create = useCreatePlan();
  const update = useUpdatePlan(id);
  const { duplicate, isPending: copying } = useDuplicatePlan();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [baseline, setBaseline] = useState(snapshot(EMPTY));
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('features');
  const [find, setFind] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const features = useMemo(() => (catalog.data ?? []).flatMap((m) => m.features), [catalog.data]);
  const byKey = useMemo(() => new Map(features.map((f) => [f.key, f])), [features]);
  const coreKeys = useMemo(() => features.filter((f) => f.core).map((f) => f.key), [features]);
  const base = useMemo(() => JSON.parse(baseline) as Draft, [baseline]);
  const ordered = useMemo(() => [...(plans.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [plans.data]);
  const color = planColor(Math.max(0, ordered.findIndex((p) => p.id === id)));

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

  const added = draft.features.filter((k) => !base.features.includes(k) && byKey.has(k));
  const removed = base.features.filter((k) => !draft.features.includes(k) && byKey.has(k));
  const limitChanged = draft.maxEmployees !== base.maxEmployees;
  const shapeChanged = added.length > 0 || removed.length > 0 || limitChanged;
  const impact = usePlanImpact(!isNew && shapeChanged ? id : null, shapeChanged ? { features: draft.features, limits: { maxEmployees: draft.maxEmployees } } : null);
  const hurts = (impact.data?.companies ?? []).some((c) => c.loses.length || c.overLimit);

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
      toast.info(on ? `Also added: ${extra.join(', ')} (needed by ${byKey.get(key)?.label})` : `Also removed: ${extra.join(', ')} (they need ${byKey.get(key)?.label})`);
    }
  };

  const save = async () => {
    setError(null);
    if (draft.name.trim().length < 2) return setError('Give the plan a name');
    const body = { name: draft.name.trim(), description: draft.description.trim(), isActive: draft.isActive, features: draft.features, limits: { maxEmployees: draft.maxEmployees } };
    try {
      if (isNew) {
        const created = await create.mutateAsync(body);
        toast.success(`Plan “${created.name}” created`);
        setBaseline(snapshot(draft));
        router.replace(`/super-admin/plans/${created.id}`);
      } else {
        const r = await update.mutateAsync(body);
        const { added: a, removed: rm, affectedCompanies } = r.changes;
        const parts = [a.length && `${a.length} feature(s) added`, rm.length && `${rm.length} removed`].filter(Boolean);
        toast.success(`Saved${parts.length ? ` · ${parts.join(' · ')}` : ''}${affectedCompanies ? ` — applied to ${affectedCompanies} compan${affectedCompanies === 1 ? 'y' : 'ies'}` : ''}`);
        setBaseline(snapshot(draft));
        setReviewing(false);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not save the plan'));
      setReviewing(false);
    }
  };
  const reviewAndSave = () => (!isNew && hurts ? setReviewing(true) : void save());

  const toggleArchive = () =>
    update.mutate(
      { name: base.name, description: base.description, features: base.features, limits: { maxEmployees: base.maxEmployees }, isActive: !base.isActive },
      {
        onSuccess: () => toast.success(base.isActive ? `“${base.name}” archived — existing companies keep it` : `“${base.name}” restored`),
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update the plan')),
      },
    );

  if (plan.isLoadingError) return <ErrorState message={getApiErrorMessage(plan.error, 'Could not load the plan')} onRetry={() => plan.refetch()} />;
  const loading = catalog.isLoading || (!isNew && plan.isLoading);
  const selectedCount = draft.features.filter((k) => byKey.get(k) && byKey.get(k)!.stage !== 'coming_soon').length;
  const availableCount = features.filter((f) => f.stage !== 'coming_soon').length;
  const q = find.trim().toLowerCase();
  const modules = (catalog.data ?? []).map((m) => ({ ...m, features: q ? m.features.filter((f) => f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)) : m.features })).filter((m) => m.features.length);
  const companyCount = plan.data?.companyCount ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/super-admin/plans" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Plans
        </Link>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <span className="m-shine flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
            <Layers className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {isNew ? 'New plan' : plan.data?.name ?? <Skeleton className="h-7 w-40" />}
              {!isNew && plan.data && <Badge tone={plan.data.isActive ? 'success' : 'neutral'}>{plan.data.isActive ? 'Active' : 'Archived'}</Badge>}
            </h1>
            {!isNew && plan.data && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {plan.data.description || 'No description'} · key <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{plan.data.key}</code>
              </p>
            )}
          </div>
          {!isNew && plan.data && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void duplicate(plan.data!)} loading={copying}><Copy /> Duplicate</Button>
              <Button variant="secondary" size="sm" onClick={toggleArchive} disabled={dirty} title={dirty ? 'Save or discard your changes first' : undefined} loading={update.isPending && !dirty}>
                {plan.data.isActive ? <><Archive /> Archive</> : <><ArchiveRestore /> Restore</>}
              </Button>
            </div>
          )}
        </div>
      </div>

      {!isNew && (
        <div role="tablist" className="flex gap-6 border-b border-border text-sm">
          {([['features', 'Features', selectedCount], ['companies', 'Companies', companyCount], ['history', 'History', null]] as const).map(([key, label, n]) => (
            <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)} className={cn('-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 font-medium', tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {key === 'history' && <History className="h-3.5 w-3.5" />}
              {label}
              {n !== null && <span className="rounded-full bg-muted px-1.5 text-[11px] font-bold">{n}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === 'companies' && plan.data ? (
        <CompaniesTab planId={plan.data.id} planKey={plan.data.key} limit={plan.data.limits.maxEmployees ?? null} />
      ) : tab === 'history' && plan.data ? (
        <HistoryTab planId={plan.data.id} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plan name" htmlFor="plan-name" required>
                  <Input id="plan-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} placeholder="e.g. Growth" />
                </Field>
                <Field label="Description" htmlFor="plan-desc">
                  <Textarea id="plan-desc" rows={2} value={draft.description} maxLength={200} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </Field>
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a feature…" aria-label="Find a feature" className={cn(inputClass, 'h-9 pl-9 pr-8')} />
                {find && <button type="button" onClick={() => setFind('')} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <span className="flex-1 text-xs text-muted-foreground">Features that need another one switch it on with them.</span>
              <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, features: features.filter((f) => f.stage !== 'coming_soon').map((f) => f.key) })}>Turn all on</Button>
              <DropdownMenu
                label="Copy features from"
                trigger={({ toggle: open }) => <Button variant="ghost" size="sm" onClick={open}>Copy from ▾</Button>}
                items={ordered.filter((p) => p.id !== id).map((p) => ({ label: `${p.name} (${p.features.length})`, onSelect: () => setDraft({ ...draft, features: [...new Set([...coreKeys, ...p.features])] }) }))}
              />
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
            ) : (
              <div className="m-stagger grid items-start gap-4 md:grid-cols-2">
                {modules.map((m) => {
                  const on = m.features.filter((f) => f.stage !== 'coming_soon' && (f.core || draft.features.includes(f.key))).length;
                  const of = m.features.filter((f) => f.stage !== 'coming_soon').length;
                  return (
                    <Card key={m.key} className="p-3">
                      <p className="flex justify-between px-2 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <span>{m.label}</span>
                        <span className="tabular-nums">{on}/{of}</span>
                      </p>
                      <ul className="space-y-0.5">
                        {m.features.map((f) => (
                          <FeatureRow key={f.key} feature={f} checked={draft.features.includes(f.key)} change={added.includes(f.key) ? 'added' : removed.includes(f.key) ? 'removed' : null} onToggle={toggle} byKey={byKey} />
                        ))}
                      </ul>
                    </Card>
                  );
                })}
                {!modules.length && <p className="text-sm text-muted-foreground">No feature matches “{find}”.</p>}
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {!isNew && shapeChanged && (
              <Card className={cn('space-y-3 p-4', hurts ? 'border-destructive/30 bg-destructive-soft/30' : 'border-success/30')}>
                <h2 className={cn('flex items-center gap-2 text-sm font-semibold', hurts && 'text-destructive')}>
                  <AlertTriangle className="h-4 w-4" /> Before you save — who’s affected
                </h2>
                {impact.data ? <ImpactList impact={impact.data} compact /> : <Skeleton className="h-16" />}
                {hurts && <p className="text-xs text-muted-foreground">Their data stays — the menu and pages just hide. Turn it back on and everything returns.</p>}
              </Card>
            )}
            <Card className="space-y-4 p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-muted-foreground" /> Limits</h2>
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
                    <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={draft.maxEmployees === null} onChange={(e) => setDraft({ ...draft, maxEmployees: e.target.checked ? null : 50 })} />
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
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
                <i className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(selectedCount / Math.max(1, availableCount)) * 100}%`, background: color }} />
              </span>
              <p className="mt-2 text-xs text-muted-foreground">Core features are always included. Company Admins only see — and can only grant — the features of their plan.</p>
            </Card>
            {!isNew && plan.data && <RecentChanges planId={plan.data.id} onAll={() => setTab('history')} />}
          </aside>
        </div>
      )}

      {(dirty || isNew) && (
        <div className="m-pop sticky bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-xl">
          <span className="text-sm font-semibold">{error ? <span className="text-destructive-soft">{error}</span> : isNew ? 'New plan — not saved yet' : `${added.length + removed.length + (limitChanged ? 1 : 0) || 'Unsaved'} change${added.length + removed.length + (limitChanged ? 1 : 0) === 1 ? '' : 's'}`}</span>
          {!isNew && (added.length > 0 || removed.length > 0 || limitChanged) && (
            <span className="min-w-0 flex-1 truncate text-xs opacity-75">
              {[...added.map((k) => `+ ${byKey.get(k)?.label}`), ...removed.map((k) => `− ${byKey.get(k)?.label}`), ...(limitChanged ? [`Max employees ${formatLimit(base.maxEmployees)} → ${formatLimit(draft.maxEmployees)}`] : [])].join(' · ')}
            </span>
          )}
          <span className="ml-auto flex shrink-0 gap-2">
            {!isNew && (
              <Button variant="ghost" size="sm" className="text-background hover:bg-background/10 hover:text-background" onClick={() => { setDraft(base); setError(null); }}>
                Discard
              </Button>
            )}
            <Button size="sm" onClick={reviewAndSave} loading={create.isPending || (update.isPending && !reviewing)}>
              {isNew ? 'Create plan' : hurts ? 'Review & save' : 'Save changes'}
            </Button>
          </span>
        </div>
      )}

      {reviewing && impact.data && (
        <Modal
          open
          onClose={() => setReviewing(false)}
          busy={update.isPending}
          title={`Save ${draft.name}?`}
          description={`Applies straight away to the ${impact.data.companiesOnPlan} compan${impact.data.companiesOnPlan === 1 ? 'y' : 'ies'} on this plan.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setReviewing(false)} disabled={update.isPending}>Keep editing</Button>
              <Button variant="danger" onClick={() => void save()} loading={update.isPending}>Save anyway</Button>
            </>
          }
        >
          <ImpactList impact={impact.data} />
        </Modal>
      )}
    </div>
  );
}

function FeatureRow({
  feature,
  checked,
  change,
  onToggle,
  byKey,
}: {
  feature: CatalogFeatureWithFlag;
  checked: boolean;
  change: 'added' | 'removed' | null;
  onToggle: (key: string, on: boolean) => void;
  byKey: Map<string, CatalogFeatureWithFlag>;
}) {
  const comingSoon = feature.stage === 'coming_soon';
  const locked = Boolean(feature.core) || comingSoon;
  const isOn = feature.core ? true : checked && !comingSoon;
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors',
        !locked && 'hover:bg-muted/40',
        comingSoon && 'opacity-55',
        change === 'added' && 'bg-success-soft/40 outline-dashed outline-1 outline-success/40',
        change === 'removed' && 'bg-destructive-soft/40 outline-dashed outline-1 outline-destructive/40',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {feature.label}
          {feature.core && <Badge tone="neutral"><Lock className="h-3 w-3" /> Core</Badge>}
          {feature.stage === 'beta' && <Badge tone="info">Beta</Badge>}
          {comingSoon && <Badge tone="neutral">Coming soon</Badge>}
          {change && <Badge tone={change === 'added' ? 'success' : 'danger'}>{change === 'added' ? 'Added' : 'Removed'}</Badge>}
        </span>
        <span className="block truncate text-xs text-muted-foreground" title={feature.description}>
          {feature.dependsOn?.length ? `Needs ${feature.dependsOn.map((d) => byKey.get(d)?.label ?? d).join(', ')}` : feature.description}
        </span>
      </span>
      <Toggle on={isOn} disabled={locked} onChange={(on) => onToggle(feature.key, on)} label={`${feature.label} ${isOn ? 'on' : 'off'}`} />
    </li>
  );
}

function CompaniesTab({ planId, planKey, limit }: { planId: string; planKey: string; limit: number | null }) {
  const [page, setPage] = useState(1);
  const list = useCompanies({ plan: planKey, page, limit: 25, sortBy: 'name', sortOrder: 'asc' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rows = list.data?.data ?? [];
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  if (list.isLoading) return <Skeleton className="h-60" />;
  if (!rows.length) return <Card className="p-10 text-center text-sm text-muted-foreground">No companies are on this plan yet.</Card>;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all" />
          {selected.size ? `${selected.size} selected` : `${list.data?.meta.total ?? rows.length} compan${(list.data?.meta.total ?? rows.length) === 1 ? 'y' : 'ies'}`}
        </label>
        <span className="flex-1" />
        {selected.size > 0 && <MovePlanMenu companyIds={[...selected]} currentPlanId={planId} label="Move to plan" onDone={() => setSelected(new Set())} />}
      </div>
      <ul className="m-stagger divide-y divide-border">
        {rows.map((c) => {
          const used = c.insights?.employees ?? c._count.employees;
          const max = c.insights?.maxEmployees ?? limit;
          const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
          return (
            <li key={c.id} className={cn('flex items-center gap-3 px-4 py-3', selected.has(c.id) && 'bg-primary/5')}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                checked={selected.has(c.id)}
                aria-label={`Select ${c.name}`}
                onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
              />
              <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} size="sm" />
              <Link href={`/super-admin/companies/${c.id}?tab=plan`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold hover:underline">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{c.slug}</span>
              </Link>
              <span className="hidden w-32 text-xs tabular-nums sm:block">
                <b>{used}</b> <span className="text-muted-foreground">{max ? `/ ${max}` : '· no limit'}</span>
                {max ? <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted"><i className={cn('m-fill-w block h-full', pct >= 90 ? 'bg-destructive' : pct >= 75 ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} /></span> : null}
              </span>
              <span className="hidden md:block">{c.insights && <HealthPill health={c.insights.health} />}</span>
            </li>
          );
        })}
      </ul>
      {list.data && <Pagination page={list.data.meta.page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={(p) => { setPage(p); setSelected(new Set()); }} />}
    </Card>
  );
}

function describe(h: PlanHistoryItem): string[] {
  if (h.action === 'plan:create') return ['Plan created'];
  if (h.action === 'plan:delete') return ['Plan deleted'];
  const lines = [
    h.added.length ? `+ ${h.added.join(', ')}` : '',
    h.removed.length ? `− ${h.removed.join(', ')}` : '',
    ...Object.entries(h.limits).map(([k, [a, b]]) => `${k === 'maxEmployees' ? 'Max employees' : k} ${formatLimit(a)} → ${formatLimit(b)}`),
    h.archived === true ? 'Archived' : h.archived === false ? 'Restored' : '',
  ].filter(Boolean);
  return lines.length ? lines : ['Name or description updated'];
}

function Timeline({ items }: { items: PlanHistoryItem[] }) {
  return (
    <ol className="space-y-3">
      {items.map((h) => {
        const lines = describe(h);
        const tone = h.removed.length ? 'bg-destructive' : h.added.length ? 'bg-success' : h.action === 'plan:create' ? 'bg-muted-foreground' : 'bg-primary';
        return (
          <li key={h.id} className="flex gap-3 text-sm">
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', tone)} />
            <span className="min-w-0">
              {lines.map((l) => <span key={l} className="block font-medium">{l}</span>)}
              <span className="block text-xs text-muted-foreground">
                {h.by} · {formatRelative(h.createdAt)}
                {h.affectedCompanies ? ` · applied to ${h.affectedCompanies} compan${h.affectedCompanies === 1 ? 'y' : 'ies'}` : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RecentChanges({ planId, onAll }: { planId: string; onAll: () => void }) {
  const history = usePlanHistory(planId);
  const items = history.data ?? [];
  return (
    <Card className="space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" /> Recent changes
        {items.length > 3 && <button type="button" onClick={onAll} className="ml-auto text-xs font-medium text-primary hover:underline">See all</button>}
      </h2>
      {history.isLoading ? <Skeleton className="h-16" /> : items.length ? <Timeline items={items.slice(0, 3)} /> : <p className="text-xs text-muted-foreground">No changes recorded yet.</p>}
    </Card>
  );
}

function HistoryTab({ planId }: { planId: string }) {
  const history = usePlanHistory(planId);
  if (history.isLoading) return <Skeleton className="h-60" />;
  return (
    <Card className="p-5">
      {history.data?.length ? <Timeline items={history.data} /> : <p className="py-6 text-center text-sm text-muted-foreground">No changes recorded yet. Changes made from now on show up here.</p>}
    </Card>
  );
}
