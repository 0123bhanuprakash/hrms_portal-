'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Mail, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, inputClass, FormError } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { tintFor } from '@/components/people/photo-card';
import { ProductArt } from '@/components/assets/product-art';
import { useKitPreview } from '@/lib/company/assets';
import { useCreateEmployee, useDepartments, useDesignations, useLocations, usePeoplePicker } from '@/lib/company/org';
import { useNextEmployeeId } from '@/lib/company/lifecycle';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { addDaysKey, addMonthsKey } from './lifecycle-ui';
import { DateInput, PersonSelect, Select } from '@/components/ui/pickers';

const STEPS = ['Basics', 'Job', 'Manager', 'Review'] as const;
const DRAFT_KEY = 'hrms:add-employee-draft';
const TYPES = [['FULL_TIME', 'Full-time'], ['PART_TIME', 'Part-time'], ['CONTRACT', 'Contract'], ['INTERN', 'Intern']] as const;

interface Draft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designationId: string;
  departmentId: string;
  locationId: string;
  employmentType: string;
  joiningDate: string;
  probation: 'none' | '3' | '6' | 'custom';
  probationEnd: string;
  reportingManagerId: string;
}

const blank = (locationId = ''): Draft => ({
  firstName: '', lastName: '', email: '', phone: '', designationId: '', departmentId: '', locationId,
  employmentType: 'FULL_TIME', joiningDate: addDaysKey(0), probation: '6', probationEnd: '', reportingManagerId: '',
});

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft | null) {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* private window — no draft */
  }
}

/** Add employee in four short steps, with a live preview of their card. */
export function AddEmployeeWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateEmployee();
  const departments = useDepartments();
  const designations = useDesignations();
  const locations = useLocations();
  const chart = usePeoplePicker();
  const nextId = useNextEmployeeId(open);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(blank());
  const kit = useKitPreview({ designationId: d.designationId || undefined, departmentId: d.departmentId || undefined, roleKeys: 'employee' }, step === 3);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    const saved = readDraft();
    setRestored(Boolean(saved && (saved.firstName || saved.email)));
    setD(saved ?? blank(locations.data?.find((l) => l.isDefault)?.id ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (open && (d.firstName || d.email)) writeDraft(d);
  }, [d, open]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const probationEnd = d.probation === 'none' ? null : d.probation === 'custom' ? d.probationEnd || null : addMonthsKey(Number(d.probation), d.joiningDate || addDaysKey(0));
  const title = designations.data?.find((x) => x.id === d.designationId)?.name;
  const dept = departments.data?.find((x) => x.id === d.departmentId);
  const loc = locations.data?.find((x) => x.id === d.locationId);
  const manager = chart.data?.employees.find((e) => e.id === d.reportingManagerId);
  const managers = useMemo(() => [...(chart.data?.employees ?? [])].sort((a, b) => b.directReports - a.directReports || a.firstName.localeCompare(b.firstName)), [chart.data]);
  const suggested = managers.filter((m) => d.departmentId && m.department?.id === d.departmentId && m.directReports > 0).slice(0, 3);
  const name = `${d.firstName} ${d.lastName}`.trim();

  const stepError = (s: number): string | null => {
    if (s === 0) {
      if (!d.firstName.trim() || !d.lastName.trim()) return 'Enter their first and last name';
      if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) return 'Enter a valid work email';
    }
    if (s === 1) {
      if (!d.joiningDate) return 'Pick a joining date';
      if (d.probation === 'custom' && (!d.probationEnd || d.probationEnd <= d.joiningDate)) return 'Probation must end after the joining date';
    }
    return null;
  };
  const next = () => {
    const e = stepError(step);
    if (e) return setError(e);
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    for (let s = 0; s < 3; s++) {
      const e = stepError(s);
      if (e) {
        setStep(s);
        return setError(e);
      }
    }
    setError(null);
    try {
      const e = await create.mutateAsync({
        firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim(), phone: d.phone.trim() || undefined,
        joiningDate: d.joiningDate, employmentType: d.employmentType,
        employmentStatus: probationEnd ? 'PROBATION' : 'ACTIVE', confirmationDate: probationEnd ?? undefined,
        departmentId: d.departmentId || undefined, designationId: d.designationId || undefined,
        locationId: d.locationId || undefined, reportingManagerId: d.reportingManagerId || undefined,
      });
      writeDraft(null);
      toast.success(`${e.firstName} added — welcome email sent to ${e.email}`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add the employee'));
    }
  };

  if (!open) return null;
  const last = step === STEPS.length - 1;

  return (
    <Modal
      open
      onClose={onClose}
      busy={create.isPending}
      icon={<UserPlus />}
      title="Add employee"
      description={`Step ${step + 1} of ${STEPS.length} · about 2 minutes`}
      className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => (step ? setStep(step - 1) : onClose())} disabled={create.isPending}>
            {step ? <><ChevronLeft /> Back</> : 'Cancel'}
          </Button>
          <div className="flex items-center gap-3">
            {(d.firstName || d.email) && <span className="hidden text-xs text-muted-foreground sm:inline">Draft kept until you close the tab</span>}
            {last ? (
              <Button onClick={submit} loading={create.isPending}><UserPlus /> Add {d.firstName || 'employee'}</Button>
            ) : (
              <Button onClick={next}>Next: {STEPS[step + 1]} <ChevronRight /></Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <ol className="flex gap-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <button type="button" onClick={() => (i < step || !stepError(step) ? setStep(i) : undefined)} className="w-full text-left" aria-current={i === step ? 'step' : undefined}>
                <span className={cn('block h-1 rounded-full transition-colors', i < step ? 'bg-success' : i === step ? 'bg-primary' : 'bg-muted')} />
                <span className={cn('mt-1.5 block text-xs font-semibold', i === step ? 'text-foreground' : 'text-muted-foreground')}>{s}</span>
              </button>
            </li>
          ))}
        </ol>

        {restored && step === 0 && (
          <p className="flex items-center justify-between gap-2 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
            Picked up where you left off.
            <button type="button" className="font-semibold underline" onClick={() => { writeDraft(null); setRestored(false); setD(blank(locations.data?.find((l) => l.isDefault)?.id ?? '')); }}>Start over</button>
          </p>
        )}
        <FormError>{error}</FormError>

        <div className="grid gap-6 md:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            {step === 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" htmlFor="w-first" required><Input id="w-first" value={d.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus /></Field>
                  <Field label="Last name" htmlFor="w-last" required><Input id="w-last" value={d.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
                </div>
                <Field label="Work email" htmlFor="w-email" required hint="Their sign-in. A welcome email goes here."><Input id="w-email" type="email" value={d.email} onChange={(e) => set('email', e.target.value)} /></Field>
                <Field label="Phone" htmlFor="w-phone"><Input id="w-phone" value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              </>
            )}
            {step === 1 && (
              <>
                <Field label="Job title" htmlFor="w-title">
                  <Select id="w-title" className={inputClass} value={d.designationId} onChange={(e) => set('designationId', e.target.value)}>
                    <option value="">— Not set</option>
                    {designations.data?.map((x) => <option key={x.id} value={x.id}>{x.name}{x.orgLevel ? ` (${x.orgLevel.name})` : ''}</option>)}
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Department" htmlFor="w-dept">
                    <Select id="w-dept" className={inputClass} value={d.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                      <option value="">— None</option>
                      {departments.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Location" htmlFor="w-loc">
                    <Select id="w-loc" className={inputClass} value={d.locationId} onChange={(e) => set('locationId', e.target.value)}>
                      <option value="">— None</option>
                      {locations.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Type" htmlFor="w-type">
                    <Select id="w-type" className={inputClass} value={d.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                      {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                  </Field>
                  <Field label="Joining date" htmlFor="w-join" required><DateInput id="w-join" value={d.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} /></Field>
                </div>
                <Field label="Probation" htmlFor="w-prob">
                  <div id="w-prob" className="flex flex-wrap items-center gap-2" role="radiogroup">
                    {([['none', 'None'], ['3', '3 months'], ['6', '6 months'], ['custom', 'Pick a date']] as const).map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={d.probation === v} onClick={() => set('probation', v)} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', d.probation === v ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
                        {l}
                      </button>
                    ))}
                    {d.probation === 'custom' && <DateInput className="h-8 w-40" value={d.probationEnd} min={d.joiningDate} onChange={(e) => set('probationEnd', e.target.value)} aria-label="Probation end date" />}
                    {probationEnd && <span className="text-xs text-muted-foreground">ends {formatDate(probationEnd)}</span>}
                  </div>
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Reporting manager" htmlFor="w-mgr" hint="Approves their leave and timesheets, and sees them under “my team”.">
                  <PersonSelect id="w-mgr" value={d.reportingManagerId} onChange={(v) => set('reportingManagerId', v)} emptyLabel="— Nobody (top of the organisation)" people={managers.map((m) => ({ ...m, sub: m.designation?.name ?? null }))} />
                </Field>
                {suggested.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Managers in {dept?.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {suggested.map((m) => (
                        <button key={m.id} type="button" onClick={() => set('reportingManagerId', m.id)} className={cn('flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors', d.reportingManagerId === m.id ? 'border-primary bg-primary-soft' : 'border-border hover:bg-subtle')}>
                          <PersonAvatar person={m} size="sm" className="h-6 w-6 text-[10px]" />
                          {m.firstName} {m.lastName} · {m.directReports} report{m.directReports === 1 ? '' : 's'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">They start with the <b className="text-foreground">Employee</b> role (self-service). Give them more access later from Users &amp; roles.</p>
              </>
            )}
            {step === 3 && (
              <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                {[
                  ['Name', name || '—'],
                  ['Work email', d.email || '—'],
                  ['Job', [title, dept?.name, loc?.name].filter(Boolean).join(' · ') || '—'],
                  ['Type', TYPES.find((t) => t[0] === d.employmentType)?.[1]],
                  ['Joins', formatDate(d.joiningDate)],
                  ['Probation', probationEnd ? `Until ${formatDate(probationEnd)}` : 'None — starts as Active'],
                  ['Manager', manager ? `${manager.firstName} ${manager.lastName}` : 'Nobody'],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3 px-3 py-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 flex-1 truncate font-medium">{v}</dd>
                  </div>
                ))}
                {(kit.data?.items.length ?? 0) > 0 && (
                  <div className="flex gap-3 px-3 py-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Starter kit</dt>
                    <dd className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        {kit.data!.items.map((i) => (
                          <span key={i.typeId} className="flex items-center gap-1 rounded-md bg-subtle py-0.5 pl-0.5 pr-2 text-xs font-medium"><ProductArt icon={i.icon} size="xs" className="!h-6 !w-8" />{i.qty > 1 && `${i.qty} × `}{i.name}</span>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">IT gets these to hand over — no approvals needed.</p>
                    </dd>
                  </div>
                )}
                <div className="flex items-start gap-2 px-3 py-2 text-xs text-info">
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" /> They’ll get a welcome email with a temporary password and choose their own when they first sign in.
                </div>
              </dl>
            )}
          </div>

          <aside className="hidden md:block" aria-label="Preview">
            <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-muted-foreground">Preview</p>
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
              <div className={cn('flex h-28 items-center justify-center bg-gradient-to-br text-3xl font-extrabold text-white', tintFor(d.departmentId || null))}>{name ? initials(name) : '?'}</div>
              <div className="space-y-1 p-3">
                <p className="truncate font-semibold">{name || 'New employee'}</p>
                <p className="truncate text-xs text-muted-foreground">{title ?? 'No title yet'}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {dept && <Badge tone="neutral">{dept.name}</Badge>}
                  <Badge tone={d.joiningDate > addDaysKey(0) ? 'primary' : probationEnd ? 'warning' : 'success'}>
                    {d.joiningDate > addDaysKey(0) ? `Joins ${formatDate(d.joiningDate)}` : probationEnd ? 'Probation' : 'Active'}
                  </Badge>
                </div>
              </div>
            </div>
            {nextId.data && <p className="mt-2 text-xs text-muted-foreground">ID <b className="font-mono text-foreground">{nextId.data.employeeId}</b> is next in line</p>}
          </aside>
        </div>
      </div>
    </Modal>
  );
}
