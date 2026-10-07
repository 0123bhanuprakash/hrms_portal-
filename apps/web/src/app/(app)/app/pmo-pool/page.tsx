'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarRange, Inbox, PackageOpen, Search, ShieldCheck, Sparkles, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { getApiErrorMessage } from '@/lib/errors';
import { Kpi } from '@/components/dashboard/widgets';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { usePmoPool, type PoolPerson } from '@/lib/company/resources';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { LoadBar } from '@/components/resources/parts';
import { AssignDialog } from '@/components/projects/assign-dialog';

/** Work → PMO pool: who's free now or soon, and who reports to the PMO. PMO only. */
export default function PmoPoolPage() {
  const { can, hasFeature } = useAccess();
  const pmo = can('project.manage');
  const q = usePmoPool(pmo && hasFeature('work.projects'));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'pmo'>('all');
  const [assign, setAssign] = useState<PoolPerson | null>(null);
  const rows = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (q.data?.data ?? []).filter((r) => (filter === 'free' ? r.free === 100 : filter === 'pmo' ? r.reportsToPmo : true) && words.every((w) => `${r.employee.firstName} ${r.employee.lastName} ${r.skills.join(' ')} ${r.employee.designation?.name ?? ''}`.toLowerCase().includes(w)));
  }, [q.data, search, filter]);

  if (!pmo) return <Card><EmptyState icon={<ShieldCheck />} title="The PMO pool is for the PMO" description="It shows who’s free to assign. Ask your PMO if you need someone." /></Card>;
  const c = q.data?.counts;
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work"
        title={<span className="inline-flex items-center gap-2">PMO pool <Badge tone="success">New</Badge></span>}
        description="People free now or in the next 4 weeks, and everyone who reports to the PMO."
        action={<Button variant="secondary" asChild><Link href="/app/projects/planner"><CalendarRange /> Resource planner</Link></Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="In the pool" icon={<Users />} value={c?.people} />
        <Kpi label="Fully free" icon={<Sparkles />} value={c?.fullyFree} tone={c?.fullyFree ? 'primary' : undefined} />
        <Kpi label="Report to the PMO" icon={<PackageOpen />} value={c?.reportsToPmo} />
        <Kpi label="Requests waiting for the PMO" icon={<Inbox />} value={c?.waitingRequests} href="/app/resources" tone={c?.waitingRequests ? 'warning' : undefined} />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Show">
            {([['all', 'Everyone'], ['free', 'Fully free'], ['pmo', 'Reports to PMO']] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={filter === v} onClick={() => setFilter(v)} className={cn('rounded-md px-3 py-1', filter === v ? 'bg-surface shadow-card' : 'text-muted-foreground')}>{l}</button>
            ))}
          </div>
          <label className="ml-auto flex h-8 w-64 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 focus-within:border-ring">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, skill or title" aria-label="Search the pool" className="w-full bg-transparent text-xs outline-none" />
          </label>
        </div>
        {q.isLoading ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 w-full" />)}</div>
        ) : q.isLoadingError ? (
          <ErrorState message={getApiErrorMessage(q.error, 'Could not load the pool')} onRetry={() => void q.refetch()} />
        ) : !rows.length ? (
          <EmptyState icon={<Users />} title="Nobody here" description="Everyone is fully booked for the next 4 weeks." />
        ) : (
          <div className="m-stagger grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => <PoolCard key={r.employee.id} r={r} onAssign={() => setAssign(r)} />)}
          </div>
        )}
      </Card>
      {assign && <AssignDialog person={{ id: assign.employee.id, firstName: assign.employee.firstName, lastName: assign.employee.lastName }} allocation={assign.free || 100} onClose={() => setAssign(null)} />}
    </div>
  );
}

function PoolCard({ r, onAssign }: { r: PoolPerson; onAssign: () => void }) {
  return (
    <div className="m-lift flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <PersonAvatar person={r.employee} size="md" />
        <div className="min-w-0 flex-1">
          <Link href={`/app/employees/${r.employee.id}`} className="block truncate font-semibold hover:underline">{r.employee.firstName} {r.employee.lastName}</Link>
          <p className="truncate text-xs text-muted-foreground">{[r.employee.designation?.name, r.employee.department?.name].filter(Boolean).join(' · ') || '—'}</p>
        </div>
        {r.reportsToPmo && <Badge tone="primary">PMO</Badge>}
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Booked now {r.nowBooked}%</span><b className={cn(r.free === 100 ? 'text-success' : 'text-warning')}>{r.free}% free</b></div>
        <LoadBar booked={100 - r.free} />
      </div>
      <div className="flex flex-wrap gap-1">{r.skills.length ? r.skills.slice(0, 6).map((s) => <Badge key={s} tone="neutral">{s}</Badge>) : <span className="text-xs text-muted-foreground">No skills listed yet</span>}</div>
      <p className="text-xs text-muted-foreground">
        {r.freeSince ? `Free since ${formatDate(r.freeSince)}` : 'Partly booked'}
        {r.lastProject && ` · last on ${r.lastProject}`}
      </p>
      {r.bestFit && (
        <Link href={`/app/resources/${r.bestFit.id}`} className="rounded-lg bg-success-soft px-2.5 py-1.5 text-xs hover:underline">
          Best fit: <b>{r.bestFit.title}</b> on {r.bestFit.project} · {r.bestFit.match}% match
        </Link>
      )}
      <Button size="sm" className="mt-auto" onClick={onAssign}><UserPlus /> Assign to project</Button>
    </div>
  );
}
