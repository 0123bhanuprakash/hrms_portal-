'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, ArrowUpRight, Copy, Gift, LayoutGrid, Lock, MoreHorizontal, Pencil, Plus, Table2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { CompanyFaces, ImpactList, MovePlanMenu, PlanRing, Toggle, useDuplicatePlan } from '@/components/super-admin/plans-ui';
import { CountUp } from '@/components/motion/motion';
import { useAccessCatalog, type CatalogFeatureWithFlag } from '@/lib/access/use-access';
import { formatLimit, planColor, useDeletePlan, usePlanImpact, usePlans, usePlansOverview, useUpdatePlan, type Plan, type PlansOverview } from '@/lib/admin/plans';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

type View = 'cards' | 'compare';
const isView = (v: unknown): v is View => v === 'cards' || v === 'compare';
type PlanUse = PlansOverview['plans'][number];

export default function PlansPage() {
  const plans = usePlans();
  const overview = usePlansOverview();
  const catalog = useAccessCatalog();
  const remove = useDeletePlan();
  const [view, setView] = useUiState<View>('sa:plans-view', 'cards', isView);
  const [deleting, setDeleting] = useState<Plan | null>(null);

  const available = useMemo(() => (catalog.data ?? []).flatMap((m) => m.features).filter((f) => f.stage !== 'coming_soon'), [catalog.data]);
  const labels = useMemo(() => new Map(available.map((f) => [f.key, f.label])), [available]);
  const ordered = useMemo(() => [...(plans.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [plans.data]);
  const use = useMemo(() => new Map((overview.data?.plans ?? []).map((p) => [p.id, p])), [overview.data]);
  const mostUsed = ordered.reduce<Plan | null>((best, p) => (p.companyCount > (best?.companyCount ?? 0) ? p : best), null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Plans"
        description="Bundles of features and limits. Each company is on one plan; switch individual features per company on its Plan & features tab."
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="View">
              {([['cards', LayoutGrid, 'Cards'], ['compare', Table2, 'Compare']] as const).map(([v, Icon, l]) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold', view === v ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon className="h-3.5 w-3.5" /> {l}
                </button>
              ))}
            </div>
            <Button asChild>
              <Link href="/super-admin/plans/new">
                <Plus /> New plan
              </Link>
            </Button>
          </div>
        }
      />

      <Summary plans={ordered} overview={overview.data} featureCount={available.length} />

      {plans.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(plans.error, 'Could not load plans')} onRetry={() => plans.refetch()} />
      ) : plans.isLoading || catalog.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-96" />)}</div>
      ) : view === 'cards' ? (
        <div className="m-stagger grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((plan, i) => (
            <TierCard
              key={plan.id}
              plan={plan}
              index={i}
              total={ordered.length}
              previous={ordered.slice(0, i).reverse().find((p) => p.isActive && p.features.every((f) => plan.features.includes(f))) ?? null}
              use={use.get(plan.id)}
              labels={labels}
              availableCount={available.length}
              mostUsed={mostUsed?.id === plan.id && ordered.length > 1}
              onDelete={() => setDeleting(plan)}
            />
          ))}
        </div>
      ) : (
        <CompareGrid plans={ordered} modules={catalog.data ?? []} use={use} />
      )}

      {overview.data && (overview.data.candidates.length > 0 || overview.data.switches.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Candidates rows={overview.data.candidates} />
          <Switches rows={overview.data.switches} />
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        isDanger
        isLoading={remove.isPending}
        title={`Delete the “${deleting?.name}” plan?`}
        description="The plan is removed permanently. Companies can't be on a deleted plan, so only unused plans can be deleted."
        confirmText="Delete plan"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success(`“${deleting.name}” deleted`);
            setDeleting(null);
          } catch (e) {
            toast.error(getApiErrorMessage(e, 'Could not delete the plan'));
          }
        }}
      />
    </div>
  );
}

// ─── Summary row ────────────────────────────────────────────

function Summary({ plans, overview, featureCount }: { plans: Plan[]; overview?: PlansOverview; featureCount: number }) {
  if (!overview || !plans.length) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const active = plans.filter((p) => p.isActive).length;
  const total = Math.max(1, overview.totals.companies);
  const nextTrial = overview.switches.find((s) => s.mode === 'ON' && s.expiresAt);
  const tile = 'm-lift flex flex-col gap-1 p-4';
  return (
    <div className="m-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Plans</span>
        <span className="text-[26px] font-bold leading-none tracking-tight">
          <CountUp value={active} /> <span className="text-sm font-semibold text-muted-foreground">active · {plans.length - active} archived</span>
        </span>
        <span className="text-xs text-muted-foreground">{featureCount} features in the catalog</span>
      </Card>
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Companies by plan</span>
        <span className="text-[26px] font-bold leading-none tracking-tight"><CountUp value={overview.totals.companies} /></span>
        <span className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
          {plans.map((p, i) => <i key={p.id} className="m-fill-w block h-full" style={{ width: `${(p.companyCount / total) * 100}%`, background: planColor(i) }} title={`${p.name}: ${p.companyCount}`} />)}
        </span>
        <span className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          {plans.map((p, i) => (
            <span key={p.id}><span style={{ color: planColor(i) }}>●</span> {p.name} {p.companyCount}</span>
          ))}
        </span>
      </Card>
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Custom switches</span>
        <span className="text-[26px] font-bold leading-none tracking-tight"><CountUp value={overview.totals.withSwitches} /></span>
        <span className="text-xs text-muted-foreground">companies with a feature on or off outside their plan</span>
      </Card>
      <Card className={cn(tile, overview.totals.trialsEndingSoon > 0 && 'border-warning/40')}>
        <span className="text-xs text-muted-foreground">Trials ending soon</span>
        <span className={cn('text-[26px] font-bold leading-none tracking-tight', overview.totals.trialsEndingSoon > 0 && 'text-warning')}><CountUp value={overview.totals.trialsEndingSoon} /></span>
        <span className="truncate text-xs text-muted-foreground">{nextTrial ? `${nextTrial.featureLabel} for ${nextTrial.company.name} · ends ${formatDate(nextTrial.expiresAt)}` : 'within the next 14 days'}</span>
      </Card>
    </div>
  );
}

// ─── Tier card ──────────────────────────────────────────────

function TierCard({
  plan,
  index,
  total,
  previous,
  use,
  labels,
  availableCount,
  mostUsed,
  onDelete,
}: {
  plan: Plan;
  index: number;
  total: number;
  previous: Plan | null;
  use?: PlanUse;
  labels: Map<string, string>;
  availableCount: number;
  mostUsed: boolean;
  onDelete: () => void;
}) {
  const router = useRouter();
  const update = useUpdatePlan(plan.id);
  const { duplicate, isPending: copying } = useDuplicatePlan();
  const color = planColor(index);
  const shown = plan.features.filter((f) => labels.has(f));
  const added = (previous ? shown.filter((f) => !previous.features.includes(f)) : shown).sort((a, b) => (labels.get(a) ?? '').localeCompare(labels.get(b) ?? ''));
  const edit = () => router.push(`/super-admin/plans/${plan.id}`);
  const toggleArchive = () =>
    update.mutate(
      { name: plan.name, description: plan.description, features: plan.features, limits: plan.limits, isActive: !plan.isActive },
      {
        onSuccess: () => toast.success(plan.isActive ? `“${plan.name}” archived — existing companies keep it` : `“${plan.name}” restored`),
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update the plan')),
      },
    );
  const items: Array<MenuItem | 'separator'> = [
    { label: 'Edit', icon: <Pencil />, onSelect: edit },
    { label: 'Duplicate', icon: <Copy />, onSelect: () => void duplicate(plan) },
    plan.isActive
      ? { label: 'Archive', icon: <Archive />, onSelect: toggleArchive, hint: 'Hide from onboarding; companies keep it' }
      : { label: 'Restore', icon: <ArchiveRestore />, onSelect: toggleArchive },
    'separator',
    { label: 'Delete', icon: <Trash2 />, danger: true, disabled: plan.companyCount > 0, hint: plan.companyCount > 0 ? 'Move its companies to another plan first' : undefined, onSelect: onDelete },
  ];

  return (
    <Card className={cn('m-lift group flex flex-col overflow-hidden', !plan.isActive && 'opacity-75')}>
      <button type="button" onClick={edit} className="m-shine relative h-24 text-left text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }} aria-label={`Edit ${plan.name}`}>
        {mostUsed && <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-foreground shadow">★ Most used</span>}
        <span className="absolute bottom-0 left-5 flex items-end gap-1" aria-hidden>
          {Array.from({ length: Math.min(total, 6) }, (_, s) => (
            <i key={s} className={cn('block w-4 rounded-t', s <= index ? 'bg-white' : 'bg-white/40')} style={{ height: 14 + s * 10 }} />
          ))}
        </span>
        <span className="absolute bottom-3 right-5 text-right leading-tight">
          <span className="block text-[10px] font-bold uppercase tracking-widest opacity-85">Tier {index + 1}</span>
          <span className="block text-xl font-extrabold">{plan.limits.maxEmployees == null ? 'Unlimited' : `up to ${formatLimit(plan.limits.maxEmployees)}`}</span>
          <span className="block text-[11px] opacity-85">employees</span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold">
              {plan.name}
              {!plan.isActive && <Badge tone="neutral">Archived</Badge>}
              {plan.features.some((f) => labels.has(f) && f === 'time.shifts') && <Badge tone="info">incl. beta</Badge>}
            </h2>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{plan.description || 'No description'}</p>
          </div>
          <DropdownMenu label={`Actions for ${plan.name}`} items={items} trigger={() => <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${plan.name}`}><MoreHorizontal /></Button>} />
        </div>

        <div className="flex items-center gap-3">
          <PlanRing value={shown.length} max={availableCount} color={color}>{shown.length}</PlanRing>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{shown.length} of {availableCount} features</p>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
              <i className="m-fill-w block h-full rounded-full" style={{ width: `${(shown.length / Math.max(1, availableCount)) * 100}%`, background: color }} />
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground">{previous ? `Everything in ${previous.name}, plus` : 'Includes'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {added.slice(0, 7).map((f) => (
              <Badge key={f} tone={previous ? 'success' : 'primary'}>{previous ? '+ ' : ''}{labels.get(f)}</Badge>
            ))}
            {added.length > 7 && <Badge tone="outline">+{added.length - 7} more</Badge>}
            {!added.length && <span className="text-xs text-muted-foreground">Nothing extra</span>}
          </div>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2 text-center">
          <Stat label="companies" value={plan.companyCount} />
          <Stat label="employees" value={use?.employees} />
          <Stat label="near limit" value={plan.limits.maxEmployees == null ? undefined : use?.nearLimit} warn={(use?.nearLimit ?? 0) > 0} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-5 py-3">
        {plan.companyCount ? <CompanyFaces companies={use?.companies ?? []} total={plan.companyCount} /> : null}
        <span className="flex-1 truncate text-xs text-muted-foreground">{plan.companyCount ? `${plan.companyCount} compan${plan.companyCount === 1 ? 'y' : 'ies'}` : 'No companies yet'}</span>
        <Button size="sm" variant="secondary" onClick={() => void duplicate(plan)} loading={copying}><Copy /> Duplicate</Button>
        <Button size="sm" onClick={edit}>Edit</Button>
      </div>
    </Card>
  );
}

function Stat({ label, value, warn }: { label: string; value?: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2 py-2">
      <p className={cn('text-base font-bold tabular-nums', warn && 'text-warning')}>{value === undefined ? '—' : <CountUp value={value} />}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Compare grid ───────────────────────────────────────────

function CompareGrid({ plans, modules, use }: { plans: Plan[]; modules: Array<{ key: string; label: string; features: CatalogFeatureWithFlag[] }>; use: Map<string, PlanUse> }) {
  const [diffOnly, setDiffOnly] = useState(false);
  const [pending, setPending] = useState<{ plan: Plan; feature: CatalogFeatureWithFlag; on: boolean } | null>(null);
  const features = modules.flatMap((m) => m.features);
  const byKey = new Map(features.map((f) => [f.key, f]));
  const groups = modules
    .map((m) => ({ ...m, features: m.features.filter((f) => f.stage !== 'coming_soon') }))
    .map((m) => ({ ...m, features: diffOnly ? m.features.filter((f) => new Set(plans.map((p) => p.features.includes(f.key))).size > 1) : m.features }))
    .filter((m) => m.features.length);
  const limitsDiffer = new Set(plans.map((p) => p.limits.maxEmployees ?? null)).size > 1;

  return (
    <>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[30%] border-b border-border bg-surface px-4 py-4 text-left align-bottom">
                <span className="block text-xs font-medium text-muted-foreground">{features.filter((f) => f.stage !== 'coming_soon').length} features · {modules.filter((m) => m.features.some((f) => f.stage !== 'coming_soon')).length} groups</span>
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
                  <Toggle on={diffOnly} onChange={setDiffOnly} label="Only show differences" className="scale-90" /> Only show differences
                </label>
              </th>
              {plans.map((p, i) => (
                <th key={p.id} className={cn('border-b border-border px-4 py-4 align-bottom', !p.isActive && 'opacity-60')}>
                  <span className="mb-3 block h-1 rounded-full" style={{ background: planColor(i) }} />
                  <Link href={`/super-admin/plans/${p.id}`} className="block text-base font-bold hover:underline">{p.name}</Link>
                  <span className="block text-xs font-medium text-muted-foreground">{p.features.filter((f) => byKey.get(f)?.stage !== 'coming_soon').length} features · {formatLimit(p.limits.maxEmployees)} employees</span>
                  <span className="block text-xs text-muted-foreground">{p.companyCount} compan{p.companyCount === 1 ? 'y' : 'ies'}{!p.isActive && ' · archived'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(!diffOnly || limitsDiffer) && (
              <>
                <GroupRow label="Limits" span={plans.length + 1} />
                <tr className={cn(limitsDiffer && 'bg-warning-soft/20')}>
                  <td className="sticky left-0 border-b border-border bg-inherit px-4 py-2.5 font-medium">Max employees<span className="block text-[11px] font-normal text-muted-foreground">active employees per company</span></td>
                  {plans.map((p) => <td key={p.id} className="border-b border-border px-4 py-2.5 text-center font-bold tabular-nums">{p.limits.maxEmployees == null ? '∞' : p.limits.maxEmployees.toLocaleString()}</td>)}
                </tr>
              </>
            )}
            {groups.map((m) => (
              <React.Fragment key={m.key}>
                <GroupRow label={m.label} span={plans.length + 1} />
                {m.features.map((f) => {
                  const differs = new Set(plans.map((p) => p.features.includes(f.key))).size > 1;
                  return (
                    <tr key={f.key} className={cn('hover:bg-muted/30', differs && 'bg-warning-soft/20')}>
                      <td className="sticky left-0 border-b border-border bg-inherit px-4 py-2.5">
                        <span className="font-medium">{f.label}</span>
                        {f.stage === 'beta' && <Badge tone="info" className="ml-1.5">Beta</Badge>}
                        {f.core && <Badge tone="neutral" className="ml-1.5"><Lock className="h-3 w-3" /> Always on</Badge>}
                      </td>
                      {plans.map((p, i) => {
                        const has = p.features.includes(f.key);
                        const pct = use.get(p.id)?.featureUse[f.key];
                        return (
                          <td key={p.id} className="border-b border-border px-4 py-2 text-center">
                            <button
                              type="button"
                              disabled={Boolean(f.core)}
                              onClick={() => setPending({ plan: p, feature: f, on: !has })}
                              aria-label={`${has ? 'Remove' : 'Add'} ${f.label} ${has ? 'from' : 'to'} ${p.name}`}
                              title={f.core ? 'Always included' : has ? `Remove from ${p.name}` : `Add to ${p.name}`}
                              className="group/cell inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
                            >
                              {has ? (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: planColor(i) }}>✓</span>
                              ) : (
                                <span className="h-0.5 w-3.5 rounded-full bg-muted-foreground/40 group-hover/cell:hidden" />
                              )}
                              {!has && <Plus className="hidden h-4 w-4 text-muted-foreground group-hover/cell:block" />}
                            </button>
                            {has && pct !== null && pct !== undefined && p.companyCount > 0 && <span className="block text-[10.5px] text-muted-foreground">{pct}% use it</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">Click a tick to add or remove a feature — you’ll see who’s affected first. “% use it” = share of the plan’s companies that used the feature in the last 30 days. Highlighted rows differ between plans.</p>
      {pending && <QuickToggle {...pending} byKey={byKey} all={features} onClose={() => setPending(null)} />}
    </>
  );
}

function GroupRow({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <td colSpan={span} className="border-b border-border bg-muted/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</td>
    </tr>
  );
}

/** Add / remove one feature from a plan, with dependencies and a "who's affected" preview. */
function QuickToggle({ plan, feature, on, byKey, all, onClose }: { plan: Plan; feature: CatalogFeatureWithFlag; on: boolean; byKey: Map<string, CatalogFeatureWithFlag>; all: CatalogFeatureWithFlag[]; onClose: () => void }) {
  const update = useUpdatePlan(plan.id);
  const next = useMemo(() => {
    const set = new Set(plan.features);
    const touched: string[] = [];
    const add = (k: string) => {
      if (set.has(k)) return;
      set.add(k);
      touched.push(k);
      byKey.get(k)?.dependsOn?.forEach(add);
    };
    const drop = (k: string) => {
      if (!set.has(k)) return;
      set.delete(k);
      touched.push(k);
      all.filter((f) => f.dependsOn?.includes(k)).forEach((f) => drop(f.key));
    };
    if (on) add(feature.key);
    else drop(feature.key);
    return { features: [...set], extra: touched.filter((k) => k !== feature.key).map((k) => byKey.get(k)?.label ?? k) };
  }, [plan.features, feature.key, on, byKey, all]);
  const impact = usePlanImpact(plan.id, { features: next.features });

  const save = async () => {
    try {
      const r = await update.mutateAsync({ name: plan.name, description: plan.description, features: next.features, limits: plan.limits, isActive: plan.isActive });
      toast.success(`${on ? 'Added' : 'Removed'} ${feature.label} ${on ? 'to' : 'from'} ${plan.name}${r.changes.affectedCompanies ? ` — applied to ${r.changes.affectedCompanies} compan${r.changes.affectedCompanies === 1 ? 'y' : 'ies'}` : ''}`);
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the plan'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={update.isPending}
      title={`${on ? 'Add' : 'Remove'} ${feature.label} ${on ? 'to' : 'from'} ${plan.name}?`}
      description={next.extra.length ? `${on ? 'Also adds' : 'Also removes'} ${next.extra.join(', ')} (${on ? `needed by ${feature.label}` : `they need ${feature.label}`}).` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button variant={on ? 'primary' : 'danger'} onClick={() => void save()} loading={update.isPending}>{on ? 'Add feature' : 'Remove feature'}</Button>
        </>
      }
    >
      {on ? (
        <p className="text-sm text-muted-foreground">{plan.companyCount ? `The ${plan.companyCount} compan${plan.companyCount === 1 ? 'y' : 'ies'} on ${plan.name} get it straight away.` : `No companies are on ${plan.name} yet.`}</p>
      ) : impact.data ? (
        <ImpactList impact={impact.data} />
      ) : (
        <Skeleton className="h-16" />
      )}
    </Modal>
  );
}

// ─── Upgrade candidates and custom switches ─────────────────

function Candidates({ rows }: { rows: PlansOverview['candidates'] }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ArrowUpRight className="h-4 w-4 text-primary" /> Upgrade candidates
        <span className="ml-auto text-xs font-normal text-muted-foreground">companies outgrowing their plan</span>
      </h2>
      {rows.length ? (
        <ul className="m-stagger space-y-2">
          {rows.map((c) => {
            const pct = c.limit ? Math.min(100, Math.round((c.employees / c.limit) * 100)) : 0;
            return (
              <li key={c.company.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <CompanyAvatar name={c.company.name} logoUrl={c.company.logoUrl} color={c.company.color ?? undefined} size="sm" />
                <span className="min-w-0 flex-1 text-sm">
                  <Link href={`/super-admin/companies/${c.company.id}?tab=plan`} className="block truncate font-semibold hover:underline">
                    {c.company.name} <span className="text-xs font-medium text-muted-foreground">· on {c.plan.name}{c.suggested ? ` → ${c.suggested.name}` : ''}</span>
                  </Link>
                  {c.limit !== null && pct >= 80 && <span className="block text-xs text-muted-foreground">At {c.employees} of {c.limit} employees</span>}
                  {c.extras.length > 0 && <span className="block truncate text-xs text-muted-foreground">Uses {c.extras.map((x) => x.label).join(', ')} outside its plan</span>}
                  {c.limit !== null && (
                    <span className="mt-1.5 block h-1.5 w-2/3 overflow-hidden rounded-full bg-muted">
                      <i className={cn('m-fill-w block h-full rounded-full', pct >= 95 ? 'bg-destructive' : 'bg-warning')} style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </span>
                <MovePlanMenu companyIds={[c.company.id]} currentPlanId={c.plan.id} suggestedId={c.suggested?.id} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">No company is near its limit or using features outside its plan.</p>
      )}
    </Card>
  );
}

function Switches({ rows }: { rows: PlansOverview['switches'] }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Gift className="h-4 w-4 text-primary" /> Custom switches &amp; trials
      </h2>
      {rows.length ? (
        <ul className="m-stagger max-h-[360px] space-y-2 overflow-y-auto">
          {rows.map((s) => {
            const days = s.expiresAt ? Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / 86_400_000) : null;
            return (
              <li key={`${s.company.id}-${s.featureKey}`}>
                <Link href={`/super-admin/companies/${s.company.id}?tab=plan`} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/60">
                  <CompanyAvatar name={s.company.name} logoUrl={s.company.logoUrl} color={s.company.color ?? undefined} size="sm" />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-semibold">{s.company.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.expiresAt ? `${s.mode === 'ON' ? 'Trial' : 'Off'} · ends in ${days} day${days === 1 ? '' : 's'}` : s.mode === 'ON' ? 'On · no end date' : 'Turned off'}
                      {s.reason ? ` · “${s.reason}”` : ''}
                    </span>
                  </span>
                  <Badge tone={s.mode === 'ON' ? 'success' : 'danger'}>{s.featureLabel} {s.mode}</Badge>
                  {days !== null && days <= 14 && <span className="h-2 w-2 shrink-0 rounded-full bg-warning" title="Ends soon" />}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">Every company follows its plan exactly.</p>
      )}
    </Card>
  );
}
