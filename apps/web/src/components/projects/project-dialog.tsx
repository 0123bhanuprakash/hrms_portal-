'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PROJECT_STATUS, useSaveProject, type ProjectDetail, type ProjectInput, type ProjectStatus } from '@/lib/company/projects';
import { getApiErrorMessage } from '@/lib/errors';

const today = () => new Date().toISOString().slice(0, 10);

/** Create / edit a project (PMO). */
export function ProjectDialog({ value, onClose, onSaved }: { value: ProjectDetail | 'new' | null; onClose: () => void; onSaved?: (p: ProjectDetail) => void }) {
  const save = useSaveProject();
  const [f, setF] = useState<ProjectInput>({ name: '', code: '', clientName: '', description: '', status: 'ACTIVE', startDate: today(), endDate: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setError(null);
    setF(
      value === 'new'
        ? { name: '', code: '', clientName: '', description: '', status: 'ACTIVE', startDate: today(), endDate: '' }
        : { name: value.name, code: value.code, clientName: value.clientName ?? '', description: value.description ?? '', status: value.status, startDate: value.startDate, endDate: value.endDate ?? '' },
    );
  }, [value]);
  if (!value) return null;
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const p = await save.mutateAsync({ ...f, ...(value !== 'new' && { id: value.id }), endDate: f.endDate || null });
      toast.success(value === 'new' ? `${p.name} created` : 'Project saved');
      onSaved?.(p);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the project'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<FolderKanban />}
      title={value === 'new' ? 'New project' : `Edit ${value.name}`}
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="project-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_140px]">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{error}</p>}
        <Field label="Name" htmlFor="pj-name" required><Input id="pj-name" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={100} /></Field>
        <Field label="Code" htmlFor="pj-code" required hint="e.g. APOLLO"><Input id="pj-code" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required maxLength={12} className="font-mono uppercase" /></Field>
        <Field label="Client" htmlFor="pj-client"><Input id="pj-client" value={f.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} maxLength={100} placeholder="Internal" /></Field>
        <Field label="Status" htmlFor="pj-status">
          <select id="pj-status" className={inputClass} value={f.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Starts" htmlFor="pj-start" required><Input id="pj-start" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} required /></Field>
        <Field label="Ends" htmlFor="pj-end" hint="Blank = ongoing"><Input id="pj-end" type="date" value={f.endDate ?? ''} min={f.startDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
        <Field label="Description" htmlFor="pj-desc" className="sm:col-span-2"><Textarea id="pj-desc" value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={500} rows={2} /></Field>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Only active (and on-hold) projects route leave and attendance approvals. Completed projects don’t count towards anyone’s allocation.
        </p>
      </form>
    </Modal>
  );
}
