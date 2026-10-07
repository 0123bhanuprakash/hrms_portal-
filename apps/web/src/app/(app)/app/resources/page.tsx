'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Inbox, PackageOpen, Pause, Send, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { getApiErrorMessage } from '@/lib/errors';
import { Drawer } from '@/components/ui/modal';
import { Select } from '@/components/ui/pickers';
import { Kpi } from '@/components/dashboard/widgets';
import { useAccess } from '@/lib/access/use-access';
import { useProjects } from '@/lib/company/projects';
import { refOf, useResourceContext, useResourceRequests, type InboxView, type RequestKind, type ResourceRequest } from '@/lib/company/resources';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { StatusPill, StepPath, Who } from '@/components/resources/parts';
import { RequestView } from '@/components/resources/request-view';
import { RequestPersonDialog } from '@/components/resources/dialogs';

/** Work → Resource requests: what waits for me, what I raised, on hold, done. */
export default function ResourceRequestsPage() {
  const { hasFeature } = useAccess();
  const router = useRouter();
  const params = useSearchParams();
  const ctx = useResourceContext();
  const c = ctx.data;
  const decides = Boolean(c && (c.pmo || c.pmProjects.length || c.ddProjects.length));
  const [view, setView] = useState<InboxView>((params.get('view') as InboxView) || 'waiting');
  const [projectId, setProjectId] = useState('');
  const [kind, setKind] = useState<RequestKind | ''>('');
  const [open, setOpen] = useState<string | null>(params.get('open'));
  const [asking, setAsking] = useState(false);
  const effectiveView: InboxView = !decides && (view === 'waiting' || view === 'hold') ? 'mine' : view;
  const q = useResourceRequests({ view: effectiveView, projectId: projectId || undefined, kind: kind || undefined }, Boolean(c?.involved));
  const projects = useProjects({}, Boolean(c?.involved));
  const mineIds = useMemo(() => new Set([...(c?.leadProjects ?? []), ...(c?.pmProjects ?? []), ...(c?.ddProjects ?? [])]), [c]);
  const myProjects = (projects.data?.data ?? []).filter((p) => c?.pmo || mineIds.has(p.id));
  const raisable = (projects.data?.data ?? []).filter((p) => (c?.leadProjects ?? []).includes(p.id) || (c?.pmProjects ?? []).includes(p.id));
  const counts = q.data?.meta.counts;

  if (!hasFeature('work.projects')) return <EmptyState icon={<ShieldCheck />} title="Projects aren’t switched on for your company" />;
  if (ctx.isLoading) return <Skeleton className="h-[60vh] rounded-xl" />;
  if (ctx.isLoadingError) return <ErrorState message={getApiErrorMessage(ctx.error, 'Could not load your projects')} onRetry={() => void ctx.refetch()} />;
  if (!c?.involved) {
    return (
      <Card>
        <EmptyState icon={<Users />} title="Resource requests are for project leads, managers and the PMO" description="When you lead or manage a project, you can ask for people and release them here." />
      </Card>
    );
  }

  const who = c.pmo ? 'PMO' : c.ddProjects.length ? 'Delivery Director' : c.pmProjects.length ? 'Project manager' : 'Team lead';
  const tabs = [
    ...(decides ? [{ id: 'waiting' as const, label: 'Waiting for me', count: counts?.waiting }, { id: 'hold' as const, label: 'On hold', count: counts?.hold }] : []),
    { id: 'mine' as const, label: 'Raised by me', count: counts?.mine },
    { id: 'done' as const, label: 'Done', count: counts?.done },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work"
        title={<span className="inline-flex items-center gap-2">Resource requests <Badge tone="success">New</Badge></span>}
        description={`${who} — ${decides ? 'requests and releases waiting for you on your projects, and the ones you raised.' : 'ask for people and release them; follow every step here.'}`}
        action={
          raisable.length > 0 ? (
            <Button onClick={() => setAsking(true)}><UserPlus /> Request a person</Button>
          ) : c.pmo ? (
            <Button variant="secondary" onClick={() => router.push('/app/pmo-pool')}><PackageOpen /> PMO pool</Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {decides && <Kpi label="Waiting for me" icon={<Inbox />} value={counts?.waiting} tone={counts?.waiting ? 'primary' : undefined} hint={q.data && view === 'waiting' && q.data.data[0] ? `oldest ${q.data.data[0].ageDays} day${q.data.data[0].ageDays === 1 ? '' : 's'}` : undefined} />}
        {decides && <Kpi label="On hold" icon={<Pause />} value={counts?.hold} tone={counts?.hold ? 'warning' : undefined} />}
        <Kpi label="Raised by me (open)" icon={<Send />} value={counts?.mine} />
        <Kpi label="Done" icon={<UserMinus />} value={counts?.done} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 pt-3">
          <Tabs tabs={tabs} value={effectiveView} onChange={(v) => setView(v)} />
          <span className="flex-1" />
          <div className="flex gap-2 pb-2">
            <Select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-8 w-44 text-xs">
              <option value="">{c.pmo ? 'All projects' : 'All my projects'}</option>
              {myProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as RequestKind | '')} className="h-8 w-40 text-xs">
              <option value="">Requests + releases</option>
              <option value="REQUEST">Requests</option>
              <option value="RELEASE">Releases</option>
            </Select>
          </div>
        </div>
        {q.isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : q.isLoadingError ? (
          <ErrorState message={getApiErrorMessage(q.error, 'Could not load requests')} onRetry={() => void q.refetch()} />
        ) : !q.data?.data.length ? (
          <EmptyState icon={<Inbox />} title={effectiveView === 'waiting' ? 'Nothing waiting for you' : effectiveView === 'hold' ? 'Nothing on hold' : effectiveView === 'mine' ? 'You haven’t raised anything yet' : 'Nothing done yet'} description={effectiveView === 'mine' && raisable.length ? 'Use “Request a person”, or “Release” on a member of your project.' : undefined} />
        ) : (
          <ul className="m-stagger divide-y divide-border">
            {q.data.data.map((r) => <RequestRow key={r.id} r={r} onOpen={() => setOpen(r.id)} />)}
          </ul>
        )}
      </Card>

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title="Resource request" description="Every step is kept in the history." icon={<Users />} className="sm:max-w-2xl" guard={false}>
        {open && <RequestView id={open} compact onDone={() => setOpen(null)} />}
      </Drawer>
      {asking && <ProjectThenRequest projects={raisable.map((p) => ({ id: p.id, name: p.name, pm: p.managers?.[0] ?? null }))} onClose={() => setAsking(false)} />}
    </div>
  );
}

function RequestRow({ r, onOpen }: { r: ResourceRequest; onOpen: () => void }) {
  const release = r.kind === 'RELEASE';
  const subject = release ? r.releaseEmployee : r.filled?.employee ?? r.preferred;
  return (
    <li>
      <button type="button" onClick={onOpen} className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-subtle sm:flex-nowrap">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', r.canAct ? 'bg-primary' : 'bg-transparent')} aria-label={r.canAct ? 'Waiting for you' : undefined} />
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4', release ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary')}>{release ? <UserMinus /> : <UserPlus />}</span>
        <span className="min-w-0 flex-1 basis-60">
          <span className="flex flex-wrap items-center gap-1.5 text-2xs">
            <span className="font-mono text-muted-foreground">{refOf(r)}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-px font-semibold"><i className="h-1.5 w-1.5 rounded-full" style={{ background: r.project.color ?? 'hsl(var(--primary))' }} />{r.project.name}</span>
          </span>
          <b className="block truncate text-sm">{release ? `Release · ${r.releaseEmployee?.firstName} ${r.releaseEmployee?.lastName}` : r.title}</b>
          <span className="block truncate text-xs text-muted-foreground">
            {release ? `last day ${r.lastDate ? formatDate(r.lastDate) : '—'}` : `${r.allocation}% · from ${r.fromDate ? formatDate(r.fromDate) : '—'}`}
            {r.hold && ` · on hold: ${r.hold.reason}`}
            {r.status === 'REJECTED' && r.outcomeNote && ` · “${r.outcomeNote}”`}
          </span>
        </span>
        <span className="hidden w-40 shrink-0 lg:block">{r.raisedBy && <Who face={r.raisedBy} note="from" />}</span>
        <span className="hidden w-40 shrink-0 md:block">{subject && <Who face={subject} note={release ? '' : r.filled ? 'filled ·' : 'wants'} />}</span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill r={r} />
          {!release && <StepPath r={r} size="sm" />}
        </span>
        <span className="w-20 shrink-0 text-right text-2xs text-muted-foreground">{formatRelative(r.updatedAt)}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    </li>
  );
}

/** "Request a person" from the inbox: pick which of my projects first. */
function ProjectThenRequest({ projects, onClose }: { projects: Array<{ id: string; name: string; pm: { firstName: string; lastName: string } | null }>; onClose: () => void }) {
  const [pid, setPid] = useState(projects.length === 1 ? projects[0]!.id : '');
  const chosen = projects.find((p) => p.id === pid);
  if (chosen) return <RequestPersonDialog project={chosen} onClose={onClose} />;
  return (
    <Drawer open onClose={onClose} title="Which project?" description="Requests go to that project’s PM first." icon={<UserPlus />} guard={false}>
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setPid(p.id)} className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-subtle">
              <b className="flex-1 text-sm">{p.name}</b>
              {p.pm && <span className="text-xs text-muted-foreground">PM {p.pm.firstName}</span>}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}
