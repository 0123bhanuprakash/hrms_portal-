'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, inputClass, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { usePeoplePicker } from '@/lib/company/org';
import { ROLE_LABEL, useCapacity, useSaveMember, type Assignment, type ProjectDetail, type ProjectRole } from '@/lib/company/projects';
import { getApiErrorMessage } from '@/lib/errors';
import { DateInput, PersonSelect, Select } from '@/components/ui/pickers';

interface Form {
  employeeId: string;
  role: ProjectRole;
  leadEmployeeId: string;
  allocation: number;
  nightShift: boolean;
  billed: boolean;
  startDate: string;
  endDate: string;
}

/** Assign someone (or edit an assignment): role, team lead, allocation % with live free capacity. */
export function MemberDialog({ project, value, onClose, preset }: { project: ProjectDetail; value: Assignment | 'new' | null; onClose: () => void; preset?: { employeeId: string; allocation?: number; startDate?: string } }) {
  const save = useSaveMember(project.id);
  const chart = usePeoplePicker();
  const [f, setF] = useState<Form>({ employeeId: '', role: 'MEMBER', leadEmployeeId: '', allocation: 100, nightShift: false, billed: true, startDate: project.startDate, endDate: project.endDate ?? '' });
  const client = (project as ProjectDetail & { type?: string }).type === 'CLIENT';
  const [error, setError] = useState<string | null>(null);
  const editing = value && value !== 'new' ? value : null;

  useEffect(() => {
    if (!value) return;
    setError(null);
    const start = project.today > project.startDate ? project.today : project.startDate;
    setF(
      editing
        ? { employeeId: editing.employee.id, role: editing.role, leadEmployeeId: editing.lead?.id ?? '', allocation: editing.allocation, nightShift: Boolean(editing.nightShift), billed: editing.billed ?? true, startDate: editing.startDate, endDate: editing.endDate ?? '' }
        : {
            employeeId: preset?.employeeId ?? '', role: 'MEMBER', leadEmployeeId: '', allocation: preset?.allocation ?? 100, nightShift: false, billed: true,
            startDate: preset?.startDate && preset.startDate > start ? preset.startDate : start, endDate: project.endDate ?? '',
          },
    );
  }, [value, editing, project, preset]);

  // Free capacity for the chosen dates (this assignment excluded when editing)
  const capacity = useCapacity(f.employeeId || undefined, { from: f.startDate, to: f.endDate || null, excludeMemberId: editing?.id }, Boolean(value && f.employeeId && f.startDate));
  const leads = useMemo(
    () => project.members.filter((m) => m.role === 'TEAM_LEAD' && m.employee.id !== f.employeeId && (m.active || m.upcoming)),
    [project.members, f.employeeId],
  );
  const people = useMemo(
    () => [...(chart.data?.employees ?? [])].sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [chart.data],
  );

  if (!value) return null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const free = capacity.data?.free;
  const over = free !== undefined && f.allocation > free;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await save.mutateAsync({
        ...(editing && { id: editing.id }),
        employeeId: f.employeeId,
        role: f.role,
        leadEmployeeId: f.role === 'MEMBER' ? f.leadEmployeeId || null : null,
        allocation: Number(f.allocation),
        nightShift: f.nightShift,
        ...(client && { billed: f.billed }),
        startDate: f.startDate,
        endDate: f.endDate || null,
      });
      toast.success(editing ? 'Assignment updated' : `${r.employee.firstName} added as ${ROLE_LABEL[r.role].toLowerCase()}`);
      if (r.unassignedMembers) toast.info(`${r.unassignedMembers} member${r.unassignedMembers === 1 ? '' : 's'} no longer have a team lead — they now go to the project manager`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the assignment'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<UserPlus />}
      title={editing ? `Edit ${editing.employee.firstName}’s assignment` : `Assign someone to ${project.name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="member-form" loading={save.isPending} disabled={!f.employeeId || over}>Save</Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <FormError className="sm:col-span-2">{error}</FormError>
        <Field label="Person" htmlFor="pm-person" required className="sm:col-span-2">
          <PersonSelect id="pm-person" value={f.employeeId} onChange={(v) => set('employeeId', v)} disabled={Boolean(editing)} placeholder="Choose someone" people={people.map((p) => ({ ...p, sub: p.designation?.name ?? null }))} />
        </Field>
        <Field label="Role on the project" htmlFor="pm-role">
          <Select id="pm-role" className={inputClass} value={f.role} onChange={(e) => set('role', e.target.value as ProjectRole)}>
            <option value="MEMBER">Member</option>
            <option value="TEAM_LEAD">Team lead</option>
            <option value="MANAGER">Project manager</option>
          </Select>
        </Field>
        <Field label="Team lead" htmlFor="pm-lead" hint={f.role === 'MEMBER' ? 'Approves their leave first' : 'Only members have a team lead'}>
          <PersonSelect id="pm-lead" value={f.role === 'MEMBER' ? f.leadEmployeeId : ''} onChange={(v) => set('leadEmployeeId', v)} disabled={f.role !== 'MEMBER'} emptyLabel="None — goes to the PM" people={leads.map((l) => l.employee)} />
        </Field>
        <Field label="From" htmlFor="pm-start" required><DateInput id="pm-start" value={f.startDate} min={project.startDate} max={project.endDate ?? undefined} onChange={(e) => set('startDate', e.target.value)} required /></Field>
        <Field label="Until" htmlFor="pm-end" hint={project.endDate ? undefined : 'Blank = ongoing'}>
          <DateInput id="pm-end" value={f.endDate} min={f.startDate} max={project.endDate ?? undefined} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
        <Field label="Allocation" htmlFor="pm-alloc" required className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <input id="pm-alloc" type="range" min={5} max={100} step={5} value={f.allocation} onChange={(e) => set('allocation', Number(e.target.value))} className="flex-1 accent-[hsl(var(--primary))]" />
            <Input type="number" min={1} max={100} value={f.allocation} onChange={(e) => set('allocation', Number(e.target.value))} className="w-20 text-right tabular-nums" aria-label="Allocation percent" />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </Field>
        {client && (
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f.billed} onChange={(e) => set('billed', e.target.checked)} />
            <span><span className="font-medium">Billed to the client</span><span className="block text-xs text-muted-foreground">Untick for shadows, trainees or backups the client doesn’t pay for — their time counts as investment.</span></span>
          </label>
        )}
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f.nightShift} onChange={(e) => set('nightShift', e.target.checked)} />
          <span>
            <span className="font-medium">Works night shifts on this project</span>
            <span className="block text-xs text-muted-foreground">They can stay checked in past midnight; the shift counts towards the day it started.</span>
          </span>
        </label>
        <div className="rounded-lg border border-border bg-subtle/50 px-3 py-2.5 text-sm sm:col-span-2" aria-live="polite">
          {!f.employeeId ? (
            <p className="text-muted-foreground">Choose someone to see how much of their time is free.</p>
          ) : capacity.isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking allocation…</p>
          ) : capacity.data ? (
            <div className="space-y-1.5">
              <p className={over ? 'flex items-center gap-2 font-medium text-destructive' : 'flex items-center gap-2 font-medium'}>
                {over ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
                {over ? `Only ${free}% is free for these dates — nobody can go over 100%` : `${capacity.data.peak + f.allocation}% allocated at the busiest point (${free}% was free)`}
              </p>
              {capacity.data.assignments.filter((a) => a.id !== editing?.id && (a.active || a.upcoming)).map((a) => (
                <p key={a.id} className="text-xs text-muted-foreground">
                  {a.allocation}% on {a.project.name} as {a.roleLabel.toLowerCase()} ({a.startDate} → {a.endDate ?? 'ongoing'})
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
