'use client';

import React from 'react';
import { Field } from '@/components/ui/field';
import { useDepartments, useDesignations, useLocations, usePeoplePicker } from '@/lib/company/org';
import { DateInput, PersonSelect, SearchSelect } from '@/components/ui/pickers';

export interface ProfileInput {
  joiningDate: string;
  departmentId: string;
  designationId: string;
  locationId: string;
  reportingManagerId: string;
}

export const emptyProfile = (): ProfileInput => ({
  joiningDate: new Date().toISOString().slice(0, 10),
  departmentId: '',
  designationId: '',
  locationId: '',
  reportingManagerId: '',
});

/** ProfileInput → API body (empty selects omitted). */
export const profileBody = (p: ProfileInput) => ({
  joiningDate: p.joiningDate,
  ...(p.departmentId && { departmentId: p.departmentId }),
  ...(p.designationId && { designationId: p.designationId }),
  ...(p.locationId && { locationId: p.locationId }),
  ...(p.reportingManagerId && { reportingManagerId: p.reportingManagerId }),
});

/** Joining date, department, title, manager and location for an employee profile. */
export function EmployeeProfileFields({ value, onChange, idPrefix }: { value: ProfileInput; onChange: (v: ProfileInput) => void; idPrefix: string }) {
  const departments = useDepartments();
  const designations = useDesignations();
  const locations = useLocations();
  const chart = usePeoplePicker();
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => onChange({ ...value, [k]: v });
  const id = (k: string) => `${idPrefix}-${k}`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Joining date" htmlFor={id('join')} required>
        <DateInput id={id('join')} value={value.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} required />
      </Field>
      <Field label="Department" htmlFor={id('dept')}>
        <SearchSelect id={id('dept')} value={value.departmentId} onChange={(v) => set('departmentId', v)} emptyLabel="— None" searchPlaceholder="Search departments…" options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
      </Field>
      <Field label="Job title" htmlFor={id('title')}>
        <SearchSelect id={id('title')} value={value.designationId} onChange={(v) => set('designationId', v)} emptyLabel="— None" searchPlaceholder="Search job titles…" options={(designations.data ?? []).map((d) => ({ value: d.id, label: d.name, sub: d.orgLevel?.name ?? null }))} />
      </Field>
      <Field label="Reporting manager" htmlFor={id('mgr')}>
        <PersonSelect id={id('mgr')} value={value.reportingManagerId} onChange={(v) => set('reportingManagerId', v)} emptyLabel="— Nobody (top of the organisation)" people={(chart.data?.employees ?? []).map((m) => ({ ...m, sub: m.designation?.name ?? null }))} />
      </Field>
      <Field label="Location" htmlFor={id('loc')} className="sm:col-span-2">
        <SearchSelect id={id('loc')} value={value.locationId} onChange={(v) => set('locationId', v)} emptyLabel={locations.data?.some((l) => l.isDefault) ? '— Default location' : '— None'} options={(locations.data ?? []).map((l) => ({ value: l.id, label: l.name }))} />
      </Field>
    </div>
  );
}
