'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, Layers, Lock, RotateCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  formatLimit,
  useClearFeatureOverride,
  useCompanyEntitlements,
  usePlans,
  useSetCompanyLimits,
  useSetCompanyPlan,
  useSetFeatureOverride,
  type CompanyFeatureState,
} from '@/lib/admin/plans';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { DateInput, Select } from '@/components/ui/pickers';

/** Super Admin → company → Plan & features. */
export function CompanyPlanTab({ companyId }: { companyId: string }) {
  const ent = useCompanyEntitlements(companyId);
  const plans = usePlans();
  const setPlan = useSetCompanyPlan(companyId);
  const clear = useClearFeatureOverride(companyId);
  const [planChoice, setPlanChoice] = useState('');
  const [confirmPlan, setConfirmPlan] = useState(false);
  const [overriding, setOverriding] = useState<CompanyFeatureState | null>(null);

  useEffect(() => {
    if (ent.data?.plan) setPlanChoice(ent.data.plan.id);
  }, [ent.data?.plan]);

  if (ent.isLoadingError) return <ErrorState message={getApiErrorMessage(ent.error, 'Could not load features')} onRetry={() => ent.refetch()} />;
  if (ent.isLoading || !ent.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const d = ent.data;
  const chosen = plans.data?.find((p) => p.id === planChoice);
  const all = d.modules.flatMap((m) => m.features);
  const enabledCount = all.filter((f) => f.enabled).length;
  const overrideCount = all.filter((f) => f.override && !f.override.expired).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {d.modules
          .filter((m) => m.features.some((f) => f.stage !== 'coming_soon'))
          .map((m) => (
            <Card key={m.key} className="overflow-hidden">
              <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <ul className="divide-y divide-border">
                {m.features
                  .filter((f) => f.stage !== 'coming_soon')
                  .map((f) => (
                    <FeatureRow
                      key={f.key}
                      feature={f}
                      labels={new Map(all.map((x) => [x.key, x.label]))}
                      onToggle={() => setOverriding(f)}
                      onReset={() =>
                        clear.mutate(f.key, {
                          onSuccess: () => toast.success(`${f.label}: back to the plan`),
                          onError: (e) => toast.error(getApiErrorMessage(e, 'Could not reset')),
                        })
                      }
                      busy={clear.isPending}
                    />
                  ))}
              </ul>
            </Card>
          ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader title="Plan" icon={<Layers />} action={<Link href="/super-admin/plans" className="text-xs font-medium text-primary hover:underline">Manage plans</Link>} />
          <div className="space-y-3 px-5 pb-5">
            <Select value={planChoice} onChange={(e) => setPlanChoice(e.target.value)} className={inputClass} aria-label="Plan">
              {plans.data
                ?.filter((p) => p.isActive || p.id === d.plan?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {!p.isActive ? ' (archived)' : ''}
                  </option>
                ))}
            </Select>
            {chosen && chosen.id !== d.plan?.id && (
              <Button className="w-full" onClick={() => setConfirmPlan(true)}>
                Switch to {chosen.name}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {enabledCount} features enabled{overrideCount ? ` · ${overrideCount} override${overrideCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        </Card>
        <LimitsCard companyId={companyId} limits={d.limits} />
      </aside>

      <ConfirmDialog
        isOpen={confirmPlan}
        onClose={() => setConfirmPlan(false)}
        isLoading={setPlan.isPending}
        title={`Move ${d.company.name} to ${chosen?.name}?`}
        description="Features follow the new plan right away (their overrides stay). Users lose features the new plan doesn't include on their next click; their data is kept."
        confirmText="Switch plan"
        onConfirm={async () => {
          try {
            await setPlan.mutateAsync(planChoice);
            toast.success(`${d.company.name} is now on ${chosen?.name}`);
            setConfirmPlan(false);
          } catch (e) {
            toast.error(getApiErrorMessage(e, 'Could not change the plan'));
          }
        }}
      />
      <OverrideDialog companyId={companyId} feature={overriding} onClose={() => setOverriding(null)} />
    </div>
  );
}

function FeatureRow({
  feature: f,
  labels,
  onToggle,
  onReset,
  busy,
}: {
  feature: CompanyFeatureState;
  labels: Map<string, string>;
  onToggle: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  const activeOverride = f.override && !f.override.expired ? f.override : null;
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {f.label}
          {f.core && (
            <Badge tone="neutral">
              <Lock className="h-3 w-3" /> Core
            </Badge>
          )}
          {f.stage === 'beta' && <Badge tone="info">Beta</Badge>}
          {!f.core && !activeOverride && <Badge tone="outline">{f.inPlan ? 'From plan' : 'Not in plan'}</Badge>}
          {activeOverride?.mode === 'ON' && (
            <Badge tone="success">
              {activeOverride.expiresAt ? <><CalendarClock className="h-3 w-3" /> Trial until {formatDate(activeOverride.expiresAt)}</> : 'Forced on'}
            </Badge>
          )}
          {activeOverride?.mode === 'OFF' && <Badge tone="danger">Forced off{activeOverride.expiresAt ? ` until ${formatDate(activeOverride.expiresAt)}` : ''}</Badge>}
          {f.override?.expired && <Badge tone="neutral">Override expired</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          {activeOverride?.reason ? `“${activeOverride.reason}” · ` : ''}
          {f.blockedBy.length ? (
            <span className="text-warning">
              <AlertTriangle className="mr-0.5 inline h-3 w-3" />
              Off because {f.blockedBy.map((b) => labels.get(b) ?? b).join(', ')} is off
            </span>
          ) : (
            f.description
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {f.override && !f.core && (
          <Button variant="ghost" size="sm" onClick={onReset} disabled={busy} title="Remove the override and follow the plan">
            <RotateCcw /> Reset
          </Button>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={f.enabled}
          aria-label={`${f.label}: ${f.enabled ? 'on' : 'off'}`}
          disabled={f.core}
          onClick={onToggle}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
            f.enabled ? 'bg-success' : 'bg-input',
          )}
        >
          <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-card transition-transform', f.enabled ? 'translate-x-5' : 'translate-x-0.5')} />
        </button>
      </div>
    </li>
  );
}

function OverrideDialog({ companyId, feature, onClose }: { companyId: string; feature: CompanyFeatureState | null; onClose: () => void }) {
  const set = useSetFeatureOverride(companyId);
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [error, setError] = useState<string | null>(null);
  const turningOn = feature ? !feature.enabled : false;

  useEffect(() => {
    setReason('');
    setUntil('');
    setError(null);
  }, [feature]);

  const save = async () => {
    if (!feature) return;
    setError(null);
    try {
      await set.mutateAsync({
        feature: feature.key,
        mode: turningOn ? 'ON' : 'OFF',
        ...(reason.trim() && { reason: reason.trim() }),
        ...(until && { expiresAt: new Date(`${until}T23:59:59`).toISOString() }),
      });
      toast.success(`${feature.label} ${turningOn ? 'switched on' : 'switched off'}${until ? ` until ${formatDate(until)}` : ''}`);
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not change the feature'));
    }
  };

  const minDate = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  return (
    <Modal
      open={Boolean(feature)}
      onClose={onClose}
      busy={set.isPending}
      title={feature ? `${turningOn ? 'Switch on' : 'Switch off'} ${feature.label}` : ''}
      description={
        turningOn
          ? 'The company gets this feature even though its plan doesn’t include it. Add an end date for a trial.'
          : 'The feature disappears for everyone in this company, including their Company Admin. Data and role settings are kept.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={set.isPending}>Cancel</Button>
          <Button variant={turningOn ? 'primary' : 'danger'} onClick={save} loading={set.isPending}>
            {turningOn ? 'Switch on' : 'Switch off'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError>{error}</FormError>
        <Field label="Reason" htmlFor="ov-reason" hint="Shown to other Super Admins and in the audit log.">
          <Input id="ov-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={turningOn ? 'e.g. 30-day payroll trial' : 'e.g. Uses an external payroll tool'} />
        </Field>
        <Field label={turningOn ? 'Trial ends' : 'Until'} htmlFor="ov-until" hint="Optional. Afterwards the company follows its plan again automatically.">
          <DateInput id="ov-until" min={minDate} value={until} onChange={(e) => setUntil(e.target.value)} className="w-48" />
        </Field>
      </div>
    </Modal>
  );
}

function LimitsCard({ companyId, limits }: { companyId: string; limits: import('@/lib/admin/plans').CompanyLimitState[] }) {
  const set = useSetCompanyLimits(companyId);
  const emp = limits.find((l) => l.key === 'maxEmployees');
  const [mode, setMode] = useState<'plan' | 'custom' | 'unlimited'>('plan');
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!emp) return;
    if (emp.override === undefined) setMode('plan');
    else if (emp.override === null) setMode('unlimited');
    else {
      setMode('custom');
      setValue(emp.override);
    }
  }, [emp]);

  if (!emp) return null;
  const usage = emp.usage ?? 0;
  const pct = emp.effective ? Math.min(100, Math.round((usage / emp.effective) * 100)) : 0;
  const currentMode = emp.override === undefined ? 'plan' : emp.override === null ? 'unlimited' : 'custom';
  const changed = mode !== currentMode || (mode === 'custom' && value !== emp.override);

  const save = () =>
    set.mutate(mode === 'plan' ? {} : { maxEmployees: mode === 'unlimited' ? null : value }, {
      onSuccess: () => toast.success('Limit updated'),
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update the limit')),
    });

  return (
    <Card>
      <CardHeader title="Employee limit" icon={<Users />} />
      <div className="space-y-3 px-5 pb-5">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold tabular-nums">{usage.toLocaleString()}</span>
            <span className="text-muted-foreground">of {formatLimit(emp.effective)}</span>
          </div>
          {emp.effective !== null && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-destructive' : pct >= 75 ? 'bg-warning' : 'bg-success')} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={inputClass} aria-label="Employee limit">
          <option value="plan">Use plan ({formatLimit(emp.plan)})</option>
          <option value="custom">Custom limit</option>
          <option value="unlimited">Unlimited</option>
        </Select>
        {mode === 'custom' && (
          <Input type="number" min={0} value={value} onChange={(e) => setValue(Math.max(0, Math.floor(Number(e.target.value) || 0)))} aria-label="Custom employee limit" />
        )}
        {changed && (
          <Button className="w-full" onClick={save} loading={set.isPending}>
            Save limit
          </Button>
        )}
      </div>
    </Card>
  );
}
