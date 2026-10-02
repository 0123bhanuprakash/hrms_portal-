'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus, Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ProjectDialog } from '@/components/projects/project-dialog';
import { useAccess } from '@/lib/access/use-access';
import { PROJECT_STATUS, useProjects, type ProjectStatus } from '@/lib/company/projects';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function ProjectsPage() {
  const router = useRouter();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('work.projects') && can('project.view');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [creating, setCreating] = useState(false);
  const list = useProjects({ search: debounced || undefined, status: status || undefined }, allowed);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Projects aren’t available" description="Projects aren’t enabled for you." />;
  const pmo = can('project.manage');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work"
        title="Projects"
        description="Who works on what. Team leads and project managers approve their people’s leave and attendance corrections."
        action={pmo && <Button onClick={() => setCreating(true)}><Plus /> New project</Button>}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, code or client" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search projects" />
        </div>
        <select className={cn(inputClass, 'sm:w-44')} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | '')} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {list.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load projects')} onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState
          icon={<FolderKanban />}
          title="No projects yet"
          description={pmo ? 'Create a project, then assign people with their role, team lead and allocation.' : 'Your PMO hasn’t set up any projects.'}
          action={pmo && <Button onClick={() => setCreating(true)}><Plus /> New project</Button>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.data.data.map((p) => (
            <li key={p.id}>
              <Link href={`/app/projects/${p.id}`} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="flex h-full flex-col p-4 transition-colors hover:border-foreground/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-mono">{p.code}</span>{p.clientName && ` · ${p.clientName}`}</p>
                    </div>
                    <Badge tone={PROJECT_STATUS[p.status].tone} dot>{PROJECT_STATUS[p.status].label}</Badge>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 text-xs text-muted-foreground">
                    <div className="min-w-0">
                      <p className="mb-1">Project manager</p>
                      {p.managers.length ? (
                        <div className="flex items-center gap-1.5">
                          {p.managers.slice(0, 3).map((m) => <PersonAvatar key={m.id} person={m} size="xs" />)}
                          <span className="truncate text-foreground">{p.managers.map((m) => `${m.firstName} ${m.lastName}`).join(', ')}</span>
                        </div>
                      ) : (
                        <span className="text-warning">Not assigned</span>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold text-foreground tabular-nums">{p.memberCount}</p>
                      <p>people now</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{formatDate(p.startDate)} – {p.endDate ? formatDate(p.endDate) : 'ongoing'}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <ProjectDialog value="new" onClose={() => setCreating(false)} onSaved={(p) => router.push(`/app/projects/${p.id}`)} />}
    </div>
  );
}
