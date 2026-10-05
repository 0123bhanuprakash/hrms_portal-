'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Pencil, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Drawer } from '@/components/ui/modal';
import { useCreateEmployee, useDepartments, useDesignations, useLocations, useOrgChart, useUpdateEmployee, type Employee } from '@/lib/company/org';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';

const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

// ─── Add / edit ─────────────────────────────────────────────

interface Form {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  joiningDate: string;
  employmentType: string;
  employmentStatus: string;
  departmentId: string;
  designationId: string;
  locationId: string;
  reportingManagerId: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function EmployeeDrawer({
  state,
  onClose,
  ownOnly,
}: {
  state: { mode: 'add' } | { mode: 'edit'; employee: Employee } | null;
  onClose: () => void;
  ownOnly: boolean;
}) {
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const departments = useDepartments();
  const designations = useDesignations();
  const locations = useLocations();
  const chart = useOrgChart();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!state) return setForm(null);
    if (state.mode === 'add') {
      setForm({
        firstName: '', lastName: '', email: '', phone: '', joiningDate: today(), employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE',
        departmentId: '', designationId: '', locationId: locations.data?.find((l) => l.isDefault)?.id ?? '', reportingManagerId: '',
      });
    } else {
      const e = state.employee;
      setForm({
        firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone ?? '', joiningDate: e.joiningDate?.slice(0, 10) ?? today(),
        employmentType: e.employmentType, employmentStatus: e.employmentStatus, departmentId: e.departmentId ?? '', designationId: e.designationId ?? '',
        locationId: e.locationId ?? '', reportingManagerId: e.reportingManagerId ?? '',
      });
    }
  }, [state, locations.data]);

  if (!state || !form) return null;
  const isAdd = state.mode === 'add';
  const busy = create.isPending || update.isPending;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const managers = (chart.data?.employees ?? []).filter((x) => isAdd || x.id !== (state as { employee: Employee }).employee.id);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    try {
      if (isAdd) {
        const e = await create.mutateAsync({
          firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined,
          joiningDate: form.joiningDate, employmentType: form.employmentType,
          departmentId: form.departmentId || undefined, designationId: form.designationId || undefined,
          locationId: form.locationId || undefined, reportingManagerId: form.reportingManagerId || undefined,
        });
        toast.success(`${e.firstName} added — welcome email sent to ${e.email}`);
      } else {
        const id = (state as { employee: Employee }).employee.id;
        await update.mutateAsync(
          ownOnly
            ? { id, phone: form.phone.trim() || undefined }
            : {
                id, firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() || undefined,
                employmentType: form.employmentType, employmentStatus: form.employmentStatus,
                departmentId: form.departmentId || null, designationId: form.designationId || null,
                locationId: form.locationId || null, reportingManagerId: form.reportingManagerId || null,
              },
        );
        toast.success('Employee updated');
      }
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not save the employee'));
    }
  };

  const lock = !isAdd && ownOnly;
  return (
    <Drawer
      open
      onClose={onClose}
      busy={busy}
      icon={isAdd ? <UserPlus /> : <Pencil />}
      title={isAdd ? 'Add employee' : `${form.firstName} ${form.lastName}`}
      description={isAdd ? 'Creates their employee record and sign-in (Employee role).' : lock ? 'You can update your personal details.' : 'Changes to the manager also move them on the org chart.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="employee-form" loading={busy}>{isAdd ? 'Add employee' : 'Save'}</Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="e-first" required><Input id="e-first" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required disabled={lock} autoFocus={isAdd} /></Field>
          <Field label="Last name" htmlFor="e-last" required><Input id="e-last" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required disabled={lock} /></Field>
        </div>
        <Field label="Work email" htmlFor="e-email" required hint={isAdd ? undefined : 'Change the sign-in email from Users.'}>
          <Input id="e-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required disabled={!isAdd} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="e-phone"><Input id="e-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Joining date" htmlFor="e-join" required><Input id="e-join" type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} required disabled={!isAdd} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department" htmlFor="e-dept">
            <select id="e-dept" className={inputClass} value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} disabled={lock}>
              <option value="">— None</option>
              {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Job title" htmlFor="e-title">
            <select id="e-title" className={inputClass} value={form.designationId} onChange={(e) => set('designationId', e.target.value)} disabled={lock}>
              <option value="">— None</option>
              {designations.data?.map((d) => <option key={d.id} value={d.id}>{d.name}{d.orgLevel ? ` (${d.orgLevel.name})` : ''}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Reporting manager" htmlFor="e-mgr" hint="Decides who sees them under “direct / all reports” access.">
          <select id="e-mgr" className={inputClass} value={form.reportingManagerId} onChange={(e) => set('reportingManagerId', e.target.value)} disabled={lock}>
            <option value="">— Nobody (top of the organisation)</option>
            {managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}{m.designation ? ` — ${m.designation.name}` : ''}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="e-loc">
            <select id="e-loc" className={inputClass} value={form.locationId} onChange={(e) => set('locationId', e.target.value)} disabled={lock}>
              <option value="">— None</option>
              {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Employment type" htmlFor="e-type">
            <select id="e-type" className={inputClass} value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)} disabled={lock}>
              {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </Field>
        </div>
        {!isAdd && (
          <Field label="Status" htmlFor="e-status" hint="Notice period and leaving are in the row’s ⋯ menu.">
            <select id="e-status" className={inputClass} value={form.employmentStatus} onChange={(e) => set('employmentStatus', e.target.value)} disabled={lock}>
              {['ACTIVE', 'PROBATION', 'ON_LEAVE', ...(['ACTIVE', 'PROBATION', 'ON_LEAVE'].includes(form.employmentStatus) ? [] : [form.employmentStatus])].map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </Field>
        )}
        {isAdd && (
          <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-xs text-info">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" /> They’ll get a welcome email with a temporary password and choose their own when they first sign in.
          </p>
        )}
        {!isAdd && <p className="text-xs text-muted-foreground">Joined {formatDate(form.joiningDate)}</p>}
      </form>
    </Drawer>
  );
}
