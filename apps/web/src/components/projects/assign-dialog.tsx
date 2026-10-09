'use client';

import React, { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { SearchField, useDebounced } from '@/components/ui/list-tools';
import { MemberDialog } from '@/components/projects/member-dialog';
import { projectColor, shortDate } from '@/components/projects/project-ui';
import { usePortfolio, useProjectPlan, type PortfolioProject, type ProjectPerson } from '@/lib/company/projects';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface AssignRequest {
  employee: Pick<ProjectPerson, 'id' | 'firstName' | 'lastName'> & Partial<ProjectPerson>;
  allocation: number;
  startDate: string;
  projectId?: string;
}

/** PMO: pick a project, then the usual assignment dialog opens pre-filled (planner, PMO pool). */
export function AssignDialog({ request, person, allocation, onClose }: { request?: AssignRequest; person?: AssignRequest['employee']; allocation?: number; onClose: () => void }) {
  const req: AssignRequest = request ?? { employee: person!, allocation: allocation ?? 100, startDate: today() };
  const [projectId, setProjectId] = useState(req.projectId ?? '');
  const [search, setSearch] = useState('');
  const typed = useDebounced(search.trim());
  const projects = usePortfolio({ search: typed || undefined, sort: 'name', limit: 50 });
  const plan = useProjectPlan(projectId || undefined);
  const preset = useMemo(() => ({ employeeId: req.employee.id, allocation: req.allocation, startDate: req.startDate }), [req.employee.id, req.allocation, req.startDate]);
  const choices = (projects.data?.data ?? []).filter((p): p is PortfolioProject => !p.limited && p.status !== 'COMPLETED' && (!p.endDate || p.endDate >= req.startDate));
  if (projectId && plan.data && !plan.data.limited) return <MemberDialog project={plan.data} value="new" preset={preset} onClose={onClose} />;
  return (
    <Modal open onClose={onClose} icon={<UserPlus />} title={`Book ${req.employee.firstName} ${req.employee.lastName}`} description={`${req.allocation}% from ${shortDate(req.startDate)} — pick the project.`} footer={<Button variant="secondary" onClick={onClose}>Cancel</Button>}>
      {projectId && plan.isLoading ? (
        <Skeleton className="h-24" />
      ) : (
        <>
        <SearchField value={search} onChange={setSearch} placeholder="Project name, code or client" label="Search projects" className="mb-2" />
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {!choices.length && <li className="py-4 text-sm text-muted-foreground">No open projects run then.</li>}
          {choices.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setProjectId(p.id)} className="flex w-full items-center gap-3 px-1 py-2.5 text-left text-sm hover:bg-subtle">
                <i className="h-2.5 w-2.5 rounded-sm" style={{ background: projectColor(p) }} />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.type === 'CLIENT' ? 'Client' : 'Internal'} · {p.endDate ? `ends ${shortDate(p.endDate)}` : 'ongoing'}</span>
              </button>
            </li>
          ))}
        </ul>
        {(projects.data?.meta.total ?? 0) > (projects.data?.data.length ?? 0) && <p className="pt-2 text-xs text-muted-foreground">Showing the first {projects.data!.data.length} of {projects.data!.meta.total} — type to find another.</p>}
        </>
      )}
    </Modal>
  );
}
