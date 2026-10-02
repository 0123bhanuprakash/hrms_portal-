'use client';

import React from 'react';
import { Field, Input, inputClass } from '@/components/ui/field';
import { useDepartments, useDesignations, useLocations, useOrgChart } from '@/lib/company/org';

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
  const chart = useOrgChart();
  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => onChange({ ...value, [k]: v });
  const id = (k: string) => `${idPrefix}-${k}`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Joining date" htmlFor={id('join')} required>
        <Input id={id('join')} type="date" value={value.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} required />
      </Field>
      <Field label="Department" htmlFor={id('dept')}>
        <select id={id('dept')} className={inputClass} value={value.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
          <option value="">— None</option>
          {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="Job title" htmlFor={id('title')}>
        <select id={id('title')} className={inputClass} value={value.designationId} onChange={(e) => set('designationId', e.target.value)}>
          <option value="">— None</option>
          {designations.data?.map((d) => <option key={d.id} value={d.id}>{d.name}{d.orgLevel ? ` (${d.orgLevel.name})` : ''}</option>)}
        </select>
      </Field>
      <Field label="Reporting manager" htmlFor={id('mgr')}>
        <select id={id('mgr')} className={inputClass} value={value.reportingManagerId} onChange={(e) => set('reportingManagerId', e.target.value)}>
          <option value="">— Nobody (top of the organisation)</option>
          {chart.data?.employees.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}{m.designation ? ` — ${m.designation.name}` : ''}</option>)}
        </select>
      </Field>
      <Field label="Location" htmlFor={id('loc')} className="sm:col-span-2">
        <select id={id('loc')} className={inputClass} value={value.locationId} onChange={(e) => set('locationId', e.target.value)}>
          <option value="">{locations.data?.some((l) => l.isDefault) ? '— Default location' : '— None'}</option>
          {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
    </div>
  );
}
