'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Briefcase, Building2, FolderKanban, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PROJECT_STATUS, useSaveProject, type ProjectDetail, type ProjectInput, type ProjectStatus, type ProjectType } from '@/lib/company/projects';
import { cn } from '@/lib/cn';

const COLORS = ['#4F46E5', '#0D9488', '#DB2777', '#F59E0B', '#0EA5E9', '#7C3AED', '#16A34A', '#EF4444'];
import { getApiErrorMessage } from '@/lib/errors';
import { DateInput, Select } from '@/components/ui/pickers';
import { usePeopleByIds, type PickPerson } from '@/lib/company/org';
import { PersonSearch } from '@/components/people/person-search';

const today = () => new Date().toISOString().slice(0, 10);

/** Create / edit a project (PMO). */
export function ProjectDialog({ value, onClose, onSaved }: { value: ProjectDetail | 'new' | null; onClose: () => void; onSaved?: (p: ProjectDetail) => void }) {
  const save = useSaveProject();
  const [f, setF] = useState<ProjectInput>({ name: '', code: '', clientName: '', description: '', type: 'CLIENT', color: null, status: 'ACTIVE', startDate: today(), endDate: '', managerEmployeeId: null, managerAllocation: 30, deliveryDirectorId: null });
  const [ddTouched, setDdTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setError(null);
    setF(
      value === 'new'
        ? { name: '', code: '', clientName: '', description: '', type: 'CLIENT', color: null, status: 'ACTIVE', startDate: today(), endDate: '' }
        : {
            name: value.name, code: value.code, clientName: value.clientName ?? '', description: value.description ?? '', status: value.status, startDate: value.startDate, endDate: value.endDate ?? '',
            type: (value as ProjectDetail & { type?: ProjectType }).type ?? 'INTERNAL', color: (value as ProjectDetail & { color?: string | null }).color ?? null,
            ...(() => {
              const pm = value.members.find((m) => m.role === 'MANAGER' && (m.active || m.upcoming));
              return { managerEmployeeId: pm?.employee.id ?? null, managerAllocation: pm?.allocation ?? 30, deliveryDirectorId: value.deliveryDirector?.id ?? null };
            })(),
          },
    );
    setDdTouched(value !== 'new' && Boolean(value.deliveryDirector));
  }, [value]);
  // Picking a PM suggests their reporting manager as Delivery Director (until the PMO picks one)
  const pickPm = (id: string, person: PickPerson | null) => {
    setF((p) => ({ ...p, managerEmployeeId: id || null, ...(!ddTouched && { deliveryDirectorId: person?.reportingManagerId ?? null }) }));
  };
  const pm = usePeopleByIds(f.managerEmployeeId ? [f.managerEmployeeId] : []);
  const suggestedDd = pm.data?.[0]?.reportingManagerId ?? null;
  if (!value) return null;
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.type === 'CLIENT' && !f.clientName?.trim()) return setError('Add the client’s name — client projects are billable work for them');
    try {
      const p = await save.mutateAsync({ ...f, ...(value !== 'new' && { id: value.id }), clientName: f.type === 'INTERNAL' ? null : f.clientName, endDate: f.endDate || null });
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
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="project-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <FormError className="sm:col-span-2">{error}</FormError>
        <Field label="Name" htmlFor="pj-name" required><Input id="pj-name" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={100} /></Field>
        <Field label="Code" htmlFor="pj-code" required hint="e.g. APOLLO"><Input id="pj-code" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required maxLength={12} className="font-mono uppercase" /></Field>
        <Field label="Type" className="sm:col-span-2" hint={f.type === 'CLIENT' ? 'Everyone on it counts as billable — you can mark shadows or trainees as not billed.' : 'Company work — everyone’s time here counts as an investment.'}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Project type">
            {([['CLIENT', 'Client project', 'Billable', <Briefcase key="c" />], ['INTERNAL', 'Company project', 'Investment', <Building2 key="i" />]] as const).map(([id, label, sub, icon]) => (
              <button key={id} type="button" role="radio" aria-checked={f.type === id} onClick={() => set('type', id)} className={cn('flex items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left transition-colors [&_svg]:size-4', f.type === id ? 'border-primary bg-primary-soft/50' : 'border-border hover:bg-subtle')}>
                {icon}<span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
              </button>
            ))}
          </div>
        </Field>
        {f.type === 'CLIENT' ? (
          <Field label="Client" htmlFor="pj-client" required><Input id="pj-client" value={f.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} maxLength={100} placeholder="e.g. Northwind Retail" /></Field>
        ) : (
          <Field label="Client"><p className="flex h-9 items-center text-sm text-muted-foreground">Internal — no client</p></Field>
        )}
        <Field label="Status" htmlFor="pj-status">
          <Select id="pj-status" className={inputClass} value={f.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Field>
        <Field label="Starts" htmlFor="pj-start" required><DateInput id="pj-start" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} required /></Field>
        <Field label="Ends" htmlFor="pj-end" hint="Blank = ongoing"><DateInput id="pj-end" value={f.endDate ?? ''} min={f.startDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
        <Field label="Colour" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => set('color', null)} aria-pressed={!f.color} className={cn('h-7 rounded-full border px-2.5 text-xs font-medium', !f.color ? 'border-primary bg-primary-soft' : 'border-border')}>Auto</button>
            {COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={f.color === c} onClick={() => set('color', c)} className={cn('h-7 w-7 rounded-full transition-shadow', f.color === c && 'ring-2 ring-offset-2 ring-offset-surface')} style={{ background: c, ['--tw-ring-color' as string]: c } as React.CSSProperties} />)}
          </div>
        </Field>
        <fieldset className="space-y-2 rounded-xl border border-border p-3 sm:col-span-2">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground"><UserCog className="h-3.5 w-3.5" /> People in charge</legend>
          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <Field label="Project manager" htmlFor="pj-pm" hint="One per project. Their time here is booked too.">
              <PersonSearch id="pj-pm" value={f.managerEmployeeId ?? ''} onChange={pickPm} emptyLabel="No project manager yet" />
            </Field>
            <Field label="Their time" htmlFor="pj-pm-alloc">
              <div className="relative">
                <Input id="pj-pm-alloc" type="number" min={1} max={100} value={f.managerAllocation ?? 30} disabled={!f.managerEmployeeId} onChange={(e) => set('managerAllocation', Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="pr-7" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </Field>
          </div>
          <Field label="Delivery Director" htmlFor="pj-dd" hint={f.deliveryDirectorId && f.deliveryDirectorId === suggestedDd ? 'Suggested: the PM’s reporting manager. Requests go Lead → PM → Delivery Director → PMO.' : 'Requests go Lead → PM → Delivery Director → PMO. No time is booked.'}>
            <PersonSearch id="pj-dd" value={f.deliveryDirectorId ?? ''} onChange={(v) => { setDdTouched(true); set('deliveryDirectorId', v || null); }} emptyLabel="No Delivery Director (PM → PMO)" />
          </Field>
        </fieldset>
        <Field label="Description" htmlFor="pj-desc" className="sm:col-span-2"><Textarea id="pj-desc" value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={500} rows={2} /></Field>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Only active (and on-hold) projects route leave and attendance approvals. Completed projects don’t count towards anyone’s allocation.
        </p>
      </form>
    </Modal>
  );
}
