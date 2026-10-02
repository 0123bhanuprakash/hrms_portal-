'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, GitBranch, Pencil, SearchX, Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ProjectDialog } from '@/components/projects/project-dialog';
import { MemberDialog } from '@/components/projects/member-dialog';
import { useAccess } from '@/lib/access/use-access';
import { PROJECT_STATUS, useProject, useRemoveMember, type Assignment } from '@/lib/company/projects';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAccess();
  const q = useProject(id);
  const remove = useRemoveMember(id);
  const [editingProject, setEditingProject] = useState(false);
  const [member, setMember] = useState<Assignment | 'new' | null>(null);
  const [removing, setRemoving] = useState<Assignment | null>(null);
  const pmo = can('project.manage');

  const groups = useMemo(() => {
    const members = q.data?.members ?? [];
    const current = members.filter((m) => m.active || m.upcoming);
    const leads = current.filter((m) => m.role === 'TEAM_LEAD');
    return {
      managers: current.filter((m) => m.role === 'MANAGER'),
      teams: leads.map((l) => ({ lead: l, members: current.filter((m) => m.role === 'MEMBER' && m.lead?.id === l.employee.id) })),
      direct: current.filter((m) => m.role === 'MEMBER' && (!m.lead || !leads.some((l) => l.employee.id === m.lead!.id))),
      past: members.filter((m) => !m.active && !m.upcoming),
    };
  }, [q.data]);

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/projects"><ArrowLeft /> Projects</Link>
    </Button>
  );
  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    return status === 404 ? <EmptyState icon={<SearchX />} title="Project not found" action={back} /> : <ErrorState message={getApiErrorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const p = q.data!;

  const row = (m: Assignment, indent = false) => (
    <li key={m.id} className={cn('flex items-center gap-3 py-2.5', indent && 'pl-6 sm:pl-10')}>
      <PersonAvatar person={m.employee} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.employee.firstName} {m.employee.lastName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {m.employee.designation?.name ?? m.employee.employeeId} · {formatDate(m.startDate)} – {m.endDate ? formatDate(m.endDate) : 'ongoing'}
        </p>
      </div>
      {m.upcoming && <Badge tone="info">Starts {formatDate(m.startDate)}</Badge>}
      <span className="w-12 text-right text-sm font-semibold tabular-nums">{m.allocation}%</span>
      {pmo && (
        <div className="flex">
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${m.employee.firstName}`} onClick={() => setMember(m)}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${m.employee.firstName}`} onClick={() => setRemoving(m)}><Trash2 /></Button>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      <div>{back}</div>
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{p.name}</h1>
              <Badge tone="outline" className="font-mono">{p.code}</Badge>
              <Badge tone={PROJECT_STATUS[p.status].tone} dot>{PROJECT_STATUS[p.status].label}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.clientName ?? 'Internal'} · {formatDate(p.startDate)} – {p.endDate ? formatDate(p.endDate) : 'ongoing'}
            </p>
            {p.description && <p className="mt-2 max-w-2xl text-sm">{p.description}</p>}
          </div>
          {pmo && (
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => setEditingProject(true)}><Pencil /> Edit</Button>
              <Button onClick={() => setMember('new')}><UserPlus /> Assign</Button>
            </div>
          )}
        </div>
      </Card>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-subtle/60 px-4 py-3 text-xs text-muted-foreground">
        <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Leave and attendance corrections: members → their team lead or the project manager · team leads → the project manager · project managers →
        their reporting manager. Line managers and HR can always approve too.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<Users />} title="Team" description={`${p.members.filter((m) => m.active).length} people on the project today`} />
          <div className="space-y-5 px-5 pb-5">
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project manager</h3>
              {groups.managers.length ? <ul className="divide-y divide-border">{groups.managers.map((m) => row(m))}</ul> : <p className="py-2 text-sm text-warning">No project manager yet — assign one so approvals have somewhere to go.</p>}
            </section>
            {groups.teams.map(({ lead, members }) => (
              <section key={lead.id}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team lead · {members.length} member{members.length === 1 ? '' : 's'}</h3>
                <ul className="divide-y divide-border">
                  {row(lead)}
                  {members.map((m) => row(m, true))}
                </ul>
              </section>
            ))}
            {groups.direct.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members without a team lead (approved by the PM)</h3>
                <ul className="divide-y divide-border">{groups.direct.map((m) => row(m))}</ul>
              </section>
            )}
            {!p.members.length && (
              <EmptyState icon={<Users />} title="Nobody assigned yet" description={pmo ? 'Add a project manager, team leads and members.' : undefined} action={pmo && <Button onClick={() => setMember('new')}><UserPlus /> Assign</Button>} className="py-8" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Past assignments" />
          {groups.past.length ? <ul className="divide-y divide-border px-5 pb-3">{groups.past.map((m) => row(m))}</ul> : <p className="px-5 pb-5 text-sm text-muted-foreground">None.</p>}
        </Card>
      </div>

      {editingProject && <ProjectDialog value={p} onClose={() => setEditingProject(false)} />}
      <MemberDialog project={p} value={member} onClose={() => setMember(null)} />
      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        isDanger
        isLoading={remove.isPending}
        title={`Remove ${removing?.employee.firstName ?? ''} from ${p.name}?`}
        description={
          removing?.role === 'TEAM_LEAD'
            ? 'Their members will be approved by the project manager until you assign a new team lead. To keep history, edit the assignment and set an end date instead.'
            : 'To keep history, edit the assignment and set an end date instead.'
        }
        confirmText="Remove"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove.mutateAsync(removing.id);
            toast.success('Removed from the project');
            setRemoving(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not remove'));
          }
        }}
      />
    </div>
  );
}
