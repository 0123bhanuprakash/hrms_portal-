'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Mail, UserPlus, Users as UsersIcon, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, Textarea } from '@/components/ui/field';
import { Tabs } from '@/components/ui/feedback';
import { EmployeeProfileFields, emptyProfile, profileBody, type ProfileInput } from '@/components/company/employee-profile-fields';
import { RoleChip } from '@/components/admin/role-look';
import { useDepartments, useDesignations, usePeopleByIds } from '@/lib/company/org';
import { useInviteMany, useInviteUser, useRoles } from '@/lib/company/user-management';
import { getApiErrorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

type Mode = 'one' | 'many';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One sentence per thing the default Employee role lets people do. */
const EMPLOYEE_CAN = ['check in and apply for leave', 'fill timesheets and claim expenses', 'see the people directory', 'raise helpdesk tickets'];

/**
 * Invite people. One person: who → roles → job, with a live preview of their
 * card. Many: paste emails — each gets the Employee role and a basic profile.
 * Everyone invited is an employee too.
 */
export function InviteDialog({ open, onClose, canChooseRoles, canAddEmployee }: { open: boolean; onClose: () => void; canChooseRoles: boolean; canAddEmployee: boolean }) {
  const [mode, setMode] = useState<Mode>('one');
  useEffect(() => {
    if (open) setMode('one');
  }, [open]);
  const one = useOne(open, canChooseRoles, canAddEmployee, onClose);
  const many = useMany(open, canChooseRoles, onClose);
  const busy = one.busy || many.busy;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      icon={<UserPlus />}
      size="lg"
      title="Invite people"
      description="They get an email with a sign-in link. Everyone you invite becomes an employee too."
      footer={
        mode === 'one' ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="secondary" onClick={() => void one.submit(true)} loading={one.busy && one.again} disabled={busy}>Send &amp; add another</Button>
            <Button onClick={() => void one.submit(false)} loading={one.busy && !one.again} disabled={busy}><Mail /> Send invite</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>{many.results ? 'Close' : 'Cancel'}</Button>
            {!many.results && (
              <Button onClick={() => void many.submit()} loading={many.busy} disabled={!many.ready.length}>
                <Mail /> Send {many.ready.length || ''} invite{many.ready.length === 1 ? '' : 's'}
              </Button>
            )}
          </>
        )
      }
    >
      <Tabs<Mode>
        className="mb-4"
        value={mode}
        onChange={setMode}
        tabs={[
          { id: 'one', label: 'One person', icon: <UserPlus /> },
          { id: 'many', label: 'Many at once', icon: <UsersIcon /> },
        ]}
      />
      {mode === 'one' ? <OneForm {...one} canChooseRoles={canChooseRoles} canAddEmployee={canAddEmployee} /> : <ManyForm {...many} canChooseRoles={canChooseRoles} />}
    </Modal>
  );
}

// ─── One person ─────────────────────────────────────────────

function useOne(open: boolean, canChooseRoles: boolean, canAddEmployee: boolean, onClose: () => void) {
  const roles = useRoles();
  const invite = useInviteUser();
  const base = useMemo(() => roles.data?.find((r) => r.key === 'employee' && r.status === 'ACTIVE'), [roles.data]);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [extra, setExtra] = useState<string[]>([]);
  const [profile, setProfile] = useState<ProfileInput>(emptyProfile());
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [again, setAgain] = useState(false);

  const reset = () => {
    setForm({ firstName: '', lastName: '', email: '' });
    setExtra([]);
    setProfile(emptyProfile());
    setError(null);
    setTried(false);
  };
  useEffect(() => {
    if (open) reset();
  }, [open]);

  const errors: Partial<Record<'firstName' | 'lastName' | 'email', string>> = {
    firstName: !form.firstName.trim() ? 'Add their first name' : undefined,
    lastName: !form.lastName.trim() ? 'Add their last name' : undefined,
    email: !form.email.trim() ? 'Add their work email' : !EMAIL.test(form.email.trim()) ? 'This doesn’t look like an email — e.g. meera@company.com' : undefined,
  };

  const submit = async (addAnother: boolean) => {
    setTried(true);
    setError(null);
    setAgain(addAnother);
    const first = (Object.keys(errors) as Array<keyof typeof errors>).find((k) => errors[k]);
    if (first) {
      document.getElementById(`inv-${first}`)?.focus();
      return;
    }
    try {
      const roleIds = canChooseRoles && base ? [base.id, ...extra.filter((id) => id !== base.id)] : undefined;
      const r = await invite.mutateAsync({ ...form, ...(roleIds && { roleIds }), ...(canAddEmployee && { employee: profileBody(profile) }) });
      const who = r.employee ? `${r.firstName} (${r.employee.employeeId})` : r.firstName;
      toast.success(r.emailSent ? `Invite sent to ${r.email} — ${who} added to Employees` : `${who} was added, but the invite email could not be sent`);
      if (r.employeeError) toast.error(`The account was created, but not the employee profile: ${r.employeeError}`);
      if (addAnother) {
        reset();
        document.getElementById('inv-firstName')?.focus();
      } else onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not invite this person'));
    }
  };
  return { roles, base, form, setForm, extra, setExtra, profile, setProfile, error, errors: tried ? errors : ({} as typeof errors), submit, busy: invite.isPending, again };
}

function OneForm({
  roles,
  base,
  form,
  setForm,
  extra,
  setExtra,
  profile,
  setProfile,
  error,
  errors,
  canChooseRoles,
  canAddEmployee,
}: ReturnType<typeof useOne> & { canChooseRoles: boolean; canAddEmployee: boolean }) {
  const departments = useDepartments();
  const designations = useDesignations();
  const chosenManager = usePeopleByIds(profile.reportingManagerId ? [profile.reportingManagerId] : []);
  const dept = departments.data?.find((d) => d.id === profile.departmentId)?.name;
  const title = designations.data?.find((d) => d.id === profile.designationId)?.name;
  const manager = chosenManager.data?.[0];
  const picked = (roles.data ?? []).filter((r) => extra.includes(r.id));
  const others = (roles.data ?? []).filter((r) => r.status === 'ACTIVE' && r.id !== base?.id);
  const name = `${form.firstName} ${form.lastName}`.trim();

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0 space-y-4">
        <FormError>{error}</FormError>
        <Section n={1} title="Who">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="inv-firstName" required error={errors.firstName}>
              <Input id="inv-firstName" value={form.firstName} invalid={Boolean(errors.firstName)} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoFocus />
            </Field>
            <Field label="Last name" htmlFor="inv-lastName" required error={errors.lastName}>
              <Input id="inv-lastName" value={form.lastName} invalid={Boolean(errors.lastName)} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label="Work email" htmlFor="inv-email" required error={errors.email}>
            <Input id="inv-email" type="email" value={form.email} invalid={Boolean(errors.email)} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" />
          </Field>
        </Section>
        <Section n={2} title="Roles" hint={canChooseRoles ? 'Employee is always on. Click to add more.' : 'New people start with the Employee role.'}>
          <div className="flex flex-wrap gap-1.5">
            {base && <RoleChip role={base}><Check className="h-3 w-3" /></RoleChip>}
            {canChooseRoles &&
              others.map((r) =>
                extra.includes(r.id) ? (
                  <RoleChip key={r.id} role={r} active className="adm-land" onClick={() => setExtra(extra.filter((x) => x !== r.id))}>
                    <X className="h-3 w-3" />
                  </RoleChip>
                ) : (
                  <RoleChip key={r.id} role={r} dashed onClick={() => setExtra([...extra, r.id])}>
                    <span aria-hidden>+</span>
                  </RoleChip>
                ),
              )}
          </div>
        </Section>
        {canAddEmployee && (
          <Section n={3} title="Job" hint="Optional — they or HR can fill it in later.">
            <EmployeeProfileFields value={profile} onChange={setProfile} idPrefix="inv" />
          </Section>
        )}
      </div>

      {/* Live preview */}
      <aside className="hidden flex-col gap-3 rounded-xl bg-muted/50 p-4 md:flex">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
        <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-lg font-bold text-primary-foreground">
            {name ? initials(name) : '?'}
          </span>
          <b className="text-sm">{name || 'New person'}</b>
          <span className="text-xs text-muted-foreground">{[title, dept].filter(Boolean).join(' · ') || 'Job title · Department'}</span>
          {manager && <span className="text-xs text-muted-foreground">Reports to {manager.firstName} {manager.lastName}</span>}
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {base && <RoleChip role={base} />}
            {picked.map((r) => <RoleChip key={r.id} role={r} className="adm-land" />)}
          </div>
        </div>
        <div className="text-xs leading-relaxed">
          <b>{form.firstName || 'They'} will be able to</b>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {EMPLOYEE_CAN.map((t) => <li key={t}>• {t}</li>)}
            {picked.map((r) => <li key={r.id}>• everything in <b className="text-foreground">{r.name}</b></li>)}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-surface p-2.5 text-xs">
          <span className="flex items-center gap-1 font-semibold"><Mail className="h-3.5 w-3.5" /> Email</span>
          <span className="text-muted-foreground">“Hi {form.firstName || 'there'}, you’ve been invited…” with a temporary password.</span>
        </div>
      </aside>
    </div>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[11px] text-primary">{n}</span>
        {title}
        {hint && <span className="text-xs font-normal text-muted-foreground">· {hint}</span>}
      </h3>
      {children}
    </section>
  );
}

// ─── Many at once ───────────────────────────────────────────

function useMany(open: boolean, canChooseRoles: boolean, onClose: () => void) {
  const roles = useRoles();
  const inviteMany = useInviteMany();
  const [text, setText] = useState('');
  const [extra, setExtra] = useState<string[]>([]);
  const [results, setResults] = useState<Array<{ email: string; ok: boolean; error?: string; emailSent?: boolean }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setText('');
      setExtra([]);
      setResults(null);
      setError(null);
    }
  }, [open]);
  const items = [...new Set(text.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const ready = items.filter((x) => EMAIL.test(x));
  const bad = items.filter((x) => !EMAIL.test(x));
  const base = roles.data?.find((r) => r.key === 'employee' && r.status === 'ACTIVE');

  const submit = async () => {
    setError(null);
    try {
      const roleIds = canChooseRoles && base && extra.length ? [base.id, ...extra] : undefined;
      const r = await inviteMany.mutateAsync({ emails: ready, ...(roleIds && { roleIds }) });
      setResults(r.results);
      if (r.invited) toast.success(`${r.invited} invite${r.invited === 1 ? '' : 's'} sent`);
      if (r.invited === ready.length && !bad.length) onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the invites'));
    }
  };
  return { roles, text, setText, extra, setExtra, ready, bad, results, error, submit, busy: inviteMany.isPending, base };
}

function ManyForm({ roles, text, setText, extra, setExtra, ready, bad, results, error, base, canChooseRoles }: ReturnType<typeof useMany> & { canChooseRoles: boolean }) {
  if (results) {
    return (
      <ul className="space-y-1.5 m-stagger">
        {results.map((r) => (
          <li key={r.email} className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', r.ok ? 'bg-success-soft' : 'bg-destructive/10')}>
            {r.ok ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
            <span className="min-w-0 flex-1 truncate font-medium">{r.email}</span>
            <span className="text-xs text-muted-foreground">{r.ok ? (r.emailSent ? 'Invited' : 'Added — email not sent') : r.error}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-4">
      <FormError>{error}</FormError>
      <Field label="Emails" htmlFor="inv-many" hint="Paste emails from a sheet or a mail — separated by commas, spaces or new lines. Names are taken from the email (ravi.kumar@… → Ravi Kumar).">
        <Textarea id="inv-many" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'ravi.kumar@company.com, sana.khan@company.com\nmeera@company.com'} autoFocus className="font-mono text-xs" />
      </Field>
      {(ready.length > 0 || bad.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {ready.map((e) => (
            <span key={e} className="adm-land inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success"><Check className="h-3 w-3" />{e}</span>
          ))}
          {bad.map((e) => (
            <span key={e} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"><X className="h-3 w-3" />{e} — not an email</span>
          ))}
        </div>
      )}
      {canChooseRoles && (
        <Field label="Roles for all of them" hint="Employee is always on. Job details can be set later on Employees.">
          <div className="flex flex-wrap gap-1.5">
            {base && <RoleChip role={base}><Check className="h-3 w-3" /></RoleChip>}
            {(roles.data ?? [])
              .filter((r) => r.status === 'ACTIVE' && r.id !== base?.id)
              .map((r) =>
                extra.includes(r.id) ? (
                  <RoleChip key={r.id} role={r} active onClick={() => setExtra(extra.filter((x) => x !== r.id))}><X className="h-3 w-3" /></RoleChip>
                ) : (
                  <RoleChip key={r.id} role={r} dashed onClick={() => setExtra([...extra, r.id])}><span aria-hidden>+</span></RoleChip>
                ),
              )}
          </div>
        </Field>
      )}
      <p className="text-xs text-muted-foreground"><b className="text-foreground">{ready.length} ready</b>{bad.length ? ` · ${bad.length} to fix` : ''}</p>
    </div>
  );
}
