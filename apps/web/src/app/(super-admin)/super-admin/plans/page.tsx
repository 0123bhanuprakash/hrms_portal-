'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Building2, Layers, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { useAccessCatalog } from '@/lib/access/use-access';
import { formatLimit, useDeletePlan, usePlans, useUpdatePlan, type Plan } from '@/lib/admin/plans';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

export default function PlansPage() {
  const router = useRouter();
  const plans = usePlans();
  const catalog = useAccessCatalog();
  const remove = useDeletePlan();
  const [deleting, setDeleting] = useState<Plan | null>(null);

  const available = (catalog.data ?? []).flatMap((m) => m.features).filter((f) => f.stage !== 'coming_soon');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Plans"
        description="Bundles of features and limits. Each company is on one plan; switch individual features per company on its Plan & features tab."
        action={
          <Button asChild>
            <Link href="/super-admin/plans/new">
              <Plus /> New plan
            </Link>
          </Button>
        }
      />

      {plans.isError ? (
        <ErrorState message={getApiErrorMessage(plans.error, 'Could not load plans')} onRetry={() => plans.refetch()} />
      ) : plans.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.data!.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              availableCount={available.length}
              featureLabels={new Map(available.map((f) => [f.key, f.label]))}
              onEdit={() => router.push(`/super-admin/plans/${plan.id}`)}
              onDelete={() => setDeleting(plan)}
            />
          ))}
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

function PlanCard({
  plan,
  availableCount,
  featureLabels,
  onEdit,
  onDelete,
}: {
  plan: Plan;
  availableCount: number;
  featureLabels: Map<string, string>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const update = useUpdatePlan(plan.id);
  const shown = plan.features.filter((f) => featureLabels.has(f));
  const toggleArchive = () =>
    update.mutate(
      { name: plan.name, description: plan.description, features: plan.features, limits: plan.limits, isActive: !plan.isActive },
      {
        onSuccess: () => toast.success(plan.isActive ? `“${plan.name}” archived — existing companies keep it` : `“${plan.name}” restored`),
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not update the plan')),
      },
    );

  const items: Array<MenuItem | 'separator'> = [
    { label: 'Edit', icon: <Pencil />, onSelect: onEdit },
    plan.isActive
      ? { label: 'Archive', icon: <Archive />, onSelect: toggleArchive, hint: 'Hide from onboarding; companies keep it' }
      : { label: 'Restore', icon: <ArchiveRestore />, onSelect: toggleArchive },
    'separator',
    {
      label: 'Delete',
      icon: <Trash2 />,
      danger: true,
      disabled: plan.companyCount > 0,
      hint: plan.companyCount > 0 ? 'Move its companies to another plan first' : undefined,
      onSelect: onDelete,
    },
  ];

  return (
    <Card className={cn('group flex flex-col p-5 transition-shadow hover:shadow-menu', !plan.isActive && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left focus-visible:outline-none">
          <p className="flex items-center gap-2 font-semibold text-foreground group-hover:text-primary">
            <Layers className="h-4 w-4 text-primary" />
            {plan.name}
            {!plan.isActive && <Badge tone="neutral">Archived</Badge>}
          </p>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{plan.description || 'No description'}</p>
        </button>
        <DropdownMenu
          label={`Actions for ${plan.name}`}
          items={items}
          trigger={() => (
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${plan.name}`}>
              <MoreHorizontal />
            </Button>
          )}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Features" value={`${shown.length}/${availableCount}`} />
        <Stat label="Employees" value={formatLimit(plan.limits.maxEmployees)} icon={<Users className="h-3 w-3" />} />
        <Stat label="Companies" value={String(plan.companyCount)} icon={<Building2 className="h-3 w-3" />} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1">
        {shown.slice(0, 8).map((f) => (
          <Badge key={f} tone="primary">
            {featureLabels.get(f)}
          </Badge>
        ))}
        {shown.length > 8 && <Badge tone="neutral">+{shown.length - 8} more</Badge>}
      </div>
    </Card>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-2">
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
      <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </p>
    </div>
  );
}
