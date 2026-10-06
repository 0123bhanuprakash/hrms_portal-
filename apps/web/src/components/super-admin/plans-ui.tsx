'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { useBulkCompanies } from '@/lib/admin/company-insights';
import { useCreatePlan, usePlans, type CompanyBrief, type Plan, type PlanImpact } from '@/lib/admin/plans';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

/** Progress ring in the plan's own colour. */
export function PlanRing({ value, max, color, size = 52, children }: { value: number; max: number; color: string; size?: number; children?: React.ReactNode }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size, color }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="m-draw" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{children}</span>
    </span>
  );
}

/** On / off switch. */
export function Toggle({ on, onChange, disabled, label, className }: { on: boolean; onChange?: (on: boolean) => void; disabled?: boolean; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={cn(
        'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55',
        on ? 'bg-primary' : 'bg-muted-foreground/30',
        className,
      )}
    >
      <span className={cn('absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200', on ? 'left-[19px]' : 'left-[3px]')} />
    </button>
  );
}

export function CompanyFaces({ companies, total, max = 5 }: { companies: CompanyBrief[]; total: number; max?: number }) {
  return (
    <span className="flex items-center">
      {companies.slice(0, max).map((c, i) => (
        <span key={c.id} title={c.name} className={cn('rounded-lg ring-2 ring-surface', i > 0 && '-ml-1.5')}>
          <CompanyAvatar name={c.name} logoUrl={c.logoUrl} color={c.color ?? undefined} size="sm" className="!h-7 !w-7 !rounded-lg text-[10px]" />
        </span>
      ))}
      {total > max && <span className="-ml-1.5 flex h-7 min-w-7 items-center justify-center rounded-lg bg-muted px-1 text-[10px] font-bold ring-2 ring-surface">+{total - max}</span>}
    </span>
  );
}

/** Which companies lose what if the plan is saved — and who's kept by a custom switch. */
export function ImpactList({ impact, compact }: { impact: PlanImpact; compact?: boolean }) {
  const hit = impact.companies.filter((c) => c.loses.length || c.overLimit);
  const kept = impact.companies.filter((c) => !c.loses.length && !c.overLimit && c.keeps.length);
  if (!impact.companies.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-success" />
        {impact.companiesOnPlan ? `None of the ${impact.companiesOnPlan} compan${impact.companiesOnPlan === 1 ? 'y' : 'ies'} on this plan lose anything.` : 'No companies are on this plan yet.'}
      </p>
    );
  }
  return (
    <ul className={cn('space-y-2', !compact && 'max-h-80 overflow-y-auto')}>
      {[...hit, ...kept].map((row) => (
        <li key={row.company.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
          <CompanyAvatar name={row.company.name} logoUrl={row.company.logoUrl} color={row.company.color ?? undefined} size="sm" className="!h-8 !w-8 !rounded-lg text-[10px]" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block truncate font-semibold">{row.company.name}</span>
            {row.loses.map((f) => (
              <span key={f.key} className="block text-xs text-destructive">
                Loses {f.label}
                {f.uses === null ? '' : f.uses ? ` · used ${f.uses} time${f.uses === 1 ? '' : 's'} in 30 days` : ' · not used in 30 days'}
              </span>
            ))}
            {row.overLimit && <span className="block text-xs text-destructive">Has {row.employees} employees — over the new limit</span>}
            {row.keeps.map((f) => (
              <span key={f.key} className="flex items-center gap-1 text-xs text-success">
                <ShieldCheck className="h-3 w-3" /> Keeps {f.label} — switched on just for them
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "Move to plan ▾" for one or more companies. */
export function MovePlanMenu({ companyIds, currentPlanId, suggestedId, label = 'Move plan', onDone }: { companyIds: string[]; currentPlanId?: string; suggestedId?: string; label?: string; onDone?: () => void }) {
  const plans = usePlans();
  const bulk = useBulkCompanies();
  const options = (plans.data ?? []).filter((p) => p.isActive && p.id !== currentPlanId).sort((a, b) => (a.id === suggestedId ? -1 : b.id === suggestedId ? 1 : a.sortOrder - b.sortOrder));
  const move = async (plan: Plan) => {
    try {
      await bulk.mutateAsync({ ids: companyIds, action: 'plan', planId: plan.id });
      toast.success(`Moved ${companyIds.length === 1 ? 'the company' : `${companyIds.length} companies`} to ${plan.name}`);
      onDone?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not change the plan'));
    }
  };
  return (
    <DropdownMenu
      label={label}
      trigger={({ toggle }) => (
        <Button size="sm" variant="secondary" onClick={toggle} loading={bulk.isPending} disabled={!companyIds.length}>
          <ArrowRight /> {label}
        </Button>
      )}
      items={options.map((p) => ({ label: p.id === suggestedId ? `${p.name} (suggested)` : p.name, onSelect: () => void move(p) }))}
    />
  );
}

/** Copy a plan under a free name and open it. */
export function useDuplicatePlan() {
  const router = useRouter();
  const plans = usePlans();
  const create = useCreatePlan();
  const duplicate = async (plan: Plan) => {
    const names = new Set((plans.data ?? []).map((p) => p.name.toLowerCase()));
    let name = `${plan.name} copy`.slice(0, 40);
    for (let i = 2; names.has(name.toLowerCase()); i++) name = `${plan.name} copy ${i}`.slice(0, 40);
    try {
      const created = await create.mutateAsync({ name, description: plan.description, features: plan.features, limits: plan.limits, isActive: true });
      toast.success(`“${created.name}” created — adjust it and save`);
      router.push(`/super-admin/plans/${created.id}`);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not copy the plan'));
    }
  };
  return { duplicate, isPending: create.isPending };
}
