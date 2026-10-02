'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail, Network, Pencil, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Drawer } from '@/components/ui/modal';
import { useAccess, SCOPE_LABELS } from '@/lib/access/use-access';
import {
  useCreateEmployee,
  useDepartments,
  useDesignations,
  useEmployees,
  useLocations,
  useOrgChart,
  useUpdateEmployee,
  type Employee,
} from '@/lib/company/org';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, initials } from '@/lib/format';
import { cn } from '@/lib/cn';

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  PROBATION: 'info',
  NOTICE_PERIOD: 'warning',
  ON_LEAVE: 'info',
  TERMINATED: 'neutral',
};
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export default function EmployeesPage() {
  const { can, scopeOf, isLoading: accessLoading } = useAccess();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<{ mode: 'add' } | { mode: 'edit'; employee: Employee } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, departmentId]);

  const list = useEmployees({ search: debounced || undefined, departmentId: departmentId || undefined, page, limit: 20 });
  const departments = useDepartments();

  if (!accessLoading && !can('employee.view')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="You don't have permission to view employees." />;
  }
  const scope = scopeOf('employee.view');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Employees"
        description={
          scope && scope !== 'company'
            ? `You’re seeing: ${SCOPE_LABELS[scope].hint.toLowerCase()}.`
            : 'Everyone in the company. Reporting managers here build the org chart.'
        }
        action={
          <div className="flex gap-2">
            {can('org.view') && (
              <Button variant="secondary" asChild>
                <Link href="/app/org"><Network /> Org chart</Link>
              </Button>
            )}
            {can('employee.create') && (
              <Button onClick={() => setDrawer({ mode: 'add' })}>
                <UserPlus /> Add employee
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or ID" className="pl-8" aria-label="Search employees" />
          </div>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={cn(inputClass, 'sm:w-52')} aria-label="Filter by department">
            <option value="">All departments</option>
            {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {list.isError ? (
          <ErrorState message={getApiErrorMessage(list.error, 'Could not load employees')} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !list.data?.data.length ? (
          <EmptyState
            icon={<Users />}
            title={debounced || departmentId ? 'No employees match' : 'No employees yet'}
            description={debounced || departmentId ? 'Try another search or filter.' : 'Add your first employee — they get a sign-in automatically.'}
            action={!debounced && !departmentId && can('employee.create') ? <Button onClick={() => setDrawer({ mode: 'add' })}><UserPlus /> Add employee</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Title & department</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Manager</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.data.data.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
                          {initials(`${e.firstName} ${e.lastName}`)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.firstName} {e.lastName}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.employeeId} · {e.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p>{e.designation?.name ?? <span className="text-muted-foreground">—</span>}</p>
                      <p className="text-xs text-muted-foreground">{e.department?.name ?? 'No department'}</p>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <Badge tone={STATUS_TONE[e.employmentStatus] ?? 'neutral'} dot>{label(e.employmentStatus)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {can('employee.edit') && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${e.firstName} ${e.lastName}`} onClick={() => setDrawer({ mode: 'edit', employee: e })}>
                          <Pencil />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && list.data.meta.totalPages > 1 && (
          <div className="border-t border-border px-4 py-3">
            <Pagination page={list.data.meta.page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <EmployeeDrawer state={drawer} onClose={() => setDrawer(null)} ownOnly={scopeOf('employee.edit') === 'own'} />
    </div>
  );
}

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

function EmployeeDrawer({
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
          <Field label="Status" htmlFor="e-status">
            <select id="e-status" className={inputClass} value={form.employmentStatus} onChange={(e) => set('employmentStatus', e.target.value)} disabled={lock}>
              {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{label(s)}</option>)}
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
