'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Activity,
  ArrowLeft,
  Building2,
  Check,
  Copy,
  FileText,
  Hash,
  KeyRound,
  LayoutDashboard,
  Mail,
  MoreHorizontal,
  Palette,
  Pencil,
  Power,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { ColorInput, Field, Input } from '@/components/ui/field';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status-badge';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { StatusChangeDialog } from '@/components/super-admin/status-change-dialog';
import { BrandPreview } from '@/components/super-admin/brand-preview';
import { ActivityTimeline } from '@/components/super-admin/activity-timeline';
import { AuditEntryDrawer } from '@/components/super-admin/audit-entry-drawer';
import {
  useAddCompanyAdmin,
  useAuditLogs,
  useCompany,
  useResendAdminInvite,
  useSendAdminPasswordReset,
  useUpdateAdminStatus,
  useUpdateCompany,
} from '@/lib/admin/queries';
import type { AuditLogEntry, CompanyAdmin, CompanyDetail } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatRelative, initials } from '@/lib/format';
import { cn } from '@/lib/cn';

type TabId = 'overview' | 'branding' | 'admins' | 'activity';
const WEB_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function CompanyDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CompanyDetailView />
    </Suspense>
  );
}

function CompanyDetailView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError, error, refetch } = useCompany(id);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const tab = (params.get('tab') as TabId | null) ?? 'overview';
  const setTab = (t: TabId) => router.replace(t === 'overview' ? pathname : `${pathname}?tab=${t}`, { scroll: false });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <ErrorState message={getApiErrorMessage(error, 'Could not load this company')} onRetry={() => refetch()} />
        <div className="pb-8 text-center">
          <Link href="/super-admin/companies" className="text-sm text-primary hover:underline">← Back to companies</Link>
        </div>
      </Card>
    );
  }

  const { company, admins } = data;
  const brand = company.branding?.primaryColor ?? '#4F46E5';

  return (
    <div className="space-y-6">
      {/* Brand-colored header */}
      <Card className="overflow-hidden">
        <div className="h-24 sm:h-28" style={{ background: `linear-gradient(120deg, ${brand}, ${brand}99 60%, ${company.branding?.secondaryColor ?? '#EEF2FF'})` }} />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <CompanyAvatar name={company.name} logoUrl={company.branding?.logoUrl} color={brand} size="lg" className="-mt-8 shrink-0 ring-4 ring-surface" />
            <div className="min-w-0 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{company.name}</h1>
                <StatusBadge status={company.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {company.slug} · {company.email} · since {formatDate(company.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/super-admin/companies"><Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>Back</Button></Link>
            <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button
              size="sm"
              variant={company.status === 'ACTIVE' ? 'danger' : 'success'}
              icon={<Power className="h-3.5 w-3.5" />}
              onClick={() => setStatusOpen(true)}
            >
              {company.status === 'ACTIVE' ? 'Suspend…' : 'Change status…'}
            </Button>
          </div>
        </div>
      </Card>

      {company.status !== 'ACTIVE' && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-foreground animate-fade-in">
          <Power className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This company is <b>{company.status.toLowerCase()}</b>. Its users cannot sign in and any open sessions were signed out.
          </span>
        </div>
      )}

      <Tabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
          { id: 'branding', label: 'Branding', icon: <Palette /> },
          { id: 'admins', label: 'Admins', icon: <ShieldCheck />, count: admins.length },
          { id: 'activity', label: 'Activity', icon: <Activity /> },
        ]}
      />

      <div key={tab} className="animate-fade-up">
        {tab === 'overview' && <OverviewTab data={data} />}
        {tab === 'branding' && <BrandingTab data={data} />}
        {tab === 'admins' && <AdminsTab companyId={company.id} admins={admins} />}
        {tab === 'activity' && <ActivityTab companyId={company.id} />}
      </div>

      {statusOpen && <StatusChangeDialog company={company} onClose={() => setStatusOpen(false)} />}
      <EditCompanyModal open={editOpen} onClose={() => setEditOpen(false)} data={data} />
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────

function OverviewTab({ data }: { data: CompanyDetail }) {
  const { company, stats, admins } = data;
  const prefix = company.settings?.employeeIdPrefix ?? 'EMP';
  const nextId = `${prefix}${String((company.settings?.employeeIdSequence ?? 0) + 1).padStart(3, '0')}`;
  const loginUrl = `${WEB_URL}/login?company=${company.slug}`;
  const activeAdmins = admins.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="grid grid-cols-3 gap-4 lg:col-span-3">
        <MiniStat icon={<Users />} label="Users" value={stats.totalUsers} />
        <MiniStat icon={<UserCheck />} label="Employees" value={stats.totalEmployees} />
        <MiniStat icon={<Building2 />} label="Departments" value={stats.totalDepartments} />
      </div>

      <Card className="p-5 lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold">Company details</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label="Legal name" value={company.name} />
          <Detail label="Display name" value={company.branding?.displayName ?? company.name} />
          <Detail label="Contact email" value={<a href={`mailto:${company.email}`} className="text-primary hover:underline">{company.email}</a>} />
          <Detail label="Slug" value={<code className="text-xs">{company.slug}</code>} />
          <Detail label="Created" value={formatDateTime(company.createdAt)} />
          <Detail label="Last updated" value={`${formatDateTime(company.updatedAt)} (${formatRelative(company.updatedAt)})`} />
          <Detail label="Timezone" value={company.settings?.timezone ?? '—'} />
          <Detail label="Active admins" value={`${activeAdmins} of ${admins.length}`} />
        </dl>
      </Card>

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Hash className="h-4 w-4 text-muted-foreground" />Employee IDs</h2>
          <p className="mt-3 text-xs text-muted-foreground">Next employee will be</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider" style={{ color: company.branding?.primaryColor ?? undefined }}>{nextId}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Prefix <code>{prefix}</code> · {company.settings?.employeeIdSequence ?? 0} issued
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Login link</h2>
          <p className="mt-1 text-xs text-muted-foreground">Branded sign-in page for this company.</p>
          <CopyField value={loginUrl} />
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <span>
        <span className="block text-xl font-bold tabular-nums">{value}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
      </span>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background p-1 pl-3">
      <span className="min-w-0 flex-1 truncate font-mono text-xs">{value}</span>
      <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy link" icon={copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// ─── Branding ─────────────────────────────────────────────

function BrandingTab({ data }: { data: CompanyDetail }) {
  const { company } = data;
  const update = useUpdateCompany(company.id);
  const initial = {
    primary: company.branding?.primaryColor ?? '#4F46E5',
    secondary: company.branding?.secondaryColor ?? '#EEF2FF',
  };
  const [primary, setPrimary] = useState(initial.primary);
  const [secondary, setSecondary] = useState(initial.secondary);

  useEffect(() => {
    setPrimary(initial.primary);
    setSecondary(initial.secondary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.branding?.primaryColor, company.branding?.secondaryColor]);

  const valid = /^#[0-9A-F]{6}$/i.test(primary) && /^#[0-9A-F]{6}$/i.test(secondary);
  const dirty = primary !== initial.primary || secondary !== initial.secondary;

  const save = async () => {
    try {
      await update.mutateAsync({ primaryColor: primary, secondaryColor: secondary });
      toast.success('Brand colors updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update branding'));
    }
  };

  const PRESETS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#7C3AED', '#0F172A'];

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="space-y-5 p-5 lg:col-span-2">
        <div>
          <h2 className="text-sm font-semibold">Brand colors</h2>
          <p className="text-xs text-muted-foreground">The company portal and emails use these colors. Changes preview live.</p>
        </div>
        <Field label="Primary color" htmlFor="primary">
          <ColorInput id="primary" value={primary} onChange={setPrimary} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => setPrimary(c)}
              aria-label={`Use ${c}`}
              className={cn('h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110', primary === c && 'ring-2 ring-foreground')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <Field label="Secondary color" htmlFor="secondary">
          <ColorInput id="secondary" value={secondary} onChange={setSecondary} />
        </Field>
        <p className="text-xs text-muted-foreground">
          Logo and favicon are uploaded by the Company Admin from their own branding settings.
        </p>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} disabled={!dirty || update.isPending} onClick={() => { setPrimary(initial.primary); setSecondary(initial.secondary); }}>
            Reset
          </Button>
          <Button size="sm" onClick={save} loading={update.isPending} disabled={!dirty || !valid}>
            Save colors
          </Button>
        </div>
      </Card>
      <div className="space-y-3 lg:col-span-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
        <BrandPreview name={company.branding?.displayName ?? company.name} logoUrl={company.branding?.logoUrl} primaryColor={primary} secondaryColor={secondary} />
      </div>
    </div>
  );
}

// ─── Admins ───────────────────────────────────────────────

function AdminsTab({ companyId, admins }: { companyId: string; admins: CompanyAdmin[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ admin: CompanyAdmin; action: 'deactivate' | 'activate' | 'resend' | 'reset' } | null>(null);
  const statusMutation = useUpdateAdminStatus(companyId);
  const resend = useResendAdminInvite(companyId);
  const reset = useSendAdminPasswordReset(companyId);
  const activeCount = admins.filter((a) => a.status === 'ACTIVE').length;

  const busy = statusMutation.isPending || resend.isPending || reset.isPending;

  const run = async () => {
    if (!confirm) return;
    const { admin, action } = confirm;
    try {
      if (action === 'deactivate' || action === 'activate') {
        await statusMutation.mutateAsync({ userId: admin.id, status: action === 'activate' ? 'ACTIVE' : 'INACTIVE' });
        toast.success(`${admin.firstName} ${action === 'activate' ? 'reactivated' : 'deactivated'}`);
      } else if (action === 'resend') {
        await resend.mutateAsync(admin.id);
        toast.success(`New invite sent to ${admin.email}`);
      } else {
        await reset.mutateAsync(admin.id);
        toast.success(`Password reset link sent to ${admin.email}`);
      }
      setConfirm(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Action failed'));
    }
  };

  const copy: Record<NonNullable<typeof confirm>['action'], { title: string; body: string; cta: string; danger?: boolean }> = {
    deactivate: { title: 'Deactivate admin?', body: 'They will be signed out everywhere and cannot sign in until reactivated.', cta: 'Deactivate', danger: true },
    activate: { title: 'Reactivate admin?', body: 'They will be able to sign in again with their existing password.', cta: 'Reactivate' },
    resend: { title: 'Re-send invite?', body: 'A new temporary password is generated and emailed. The previous one stops working.', cta: 'Send new invite' },
    reset: { title: 'Send password reset?', body: 'A password reset link (valid 15 minutes) is emailed to the admin.', cta: 'Send reset link' },
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Company administrators</h2>
          <p className="text-xs text-muted-foreground">{activeCount} active · full access to this company&apos;s portal</p>
        </div>
        <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>Add admin</Button>
      </div>

      {admins.length === 0 ? (
        <EmptyState icon={<ShieldCheck />} title="No admins" description="Add an admin so the company can manage its portal." />
      ) : (
        <ul className="divide-y divide-border">
          {admins.map((admin) => {
            const neverLoggedIn = !admin.lastLoginAt;
            const isLastActive = admin.status === 'ACTIVE' && activeCount <= 1;
            return (
              <li key={admin.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/60">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold', admin.status === 'ACTIVE' ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground')}>
                  {initials(`${admin.firstName} ${admin.lastName}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {admin.firstName} {admin.lastName}
                    {admin.status !== 'ACTIVE' && <StatusBadge status={admin.status} />}
                    {neverLoggedIn && (
                      <span className="rounded-full bg-info-soft px-2 py-0.5 text-2xs font-medium text-info">Invite pending</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {admin.email} · {neverLoggedIn ? `invited ${formatRelative(admin.createdAt)}` : `last login ${formatRelative(admin.lastLoginAt)}`}
                  </p>
                </div>
                <DropdownMenu
                  trigger={({ toggle, open }) => (
                    <button onClick={toggle} aria-label={`Actions for ${admin.email}`} className={cn('rounded-lg p-1.5 text-muted-foreground hover:bg-subtle hover:text-foreground', open && 'bg-muted')}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                  items={[
                    {
                      label: 'Re-send invite',
                      icon: <Mail />,
                      disabled: !neverLoggedIn || admin.status !== 'ACTIVE',
                      hint: neverLoggedIn ? undefined : 'Only for admins who have never signed in',
                      onSelect: () => setConfirm({ admin, action: 'resend' }),
                    },
                    {
                      label: 'Send password reset',
                      icon: <KeyRound />,
                      disabled: admin.status !== 'ACTIVE',
                      onSelect: () => setConfirm({ admin, action: 'reset' }),
                    },
                    'separator',
                    admin.status === 'ACTIVE'
                      ? {
                          label: 'Deactivate',
                          icon: <UserX />,
                          danger: true,
                          disabled: isLastActive,
                          hint: isLastActive ? 'Cannot deactivate the last active admin' : undefined,
                          onSelect: () => setConfirm({ admin, action: 'deactivate' }),
                        }
                      : { label: 'Reactivate', icon: <UserCheck />, onSelect: () => setConfirm({ admin, action: 'activate' }) },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}

      <AddAdminModal companyId={companyId} open={addOpen} onClose={() => setAddOpen(false)} />

      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          busy={busy}
          title={copy[confirm.action].title}
          description={`${confirm.admin.firstName} ${confirm.admin.lastName} · ${confirm.admin.email}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>Cancel</Button>
              <Button variant={copy[confirm.action].danger ? 'danger' : 'primary'} onClick={run} loading={busy}>
                {copy[confirm.action].cta}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">{copy[confirm.action].body}</p>
        </Modal>
      )}
    </Card>
  );
}

function AddAdminModal({ companyId, open, onClose }: { companyId: string; open: boolean; onClose: () => void }) {
  const add = useAddCompanyAdmin(companyId);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });

  useEffect(() => {
    if (open) setForm({ firstName: '', lastName: '', email: '' });
  }, [open]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const valid = form.firstName.trim() && form.lastName.trim() && emailValid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      const admin = await add.mutateAsync({ ...form, email: form.email.trim().toLowerCase() });
      toast.success(`${admin.firstName} added — welcome email sent to ${admin.email}`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add admin'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={add.isPending}
      title="Add company admin"
      description="They receive a welcome email with a temporary password."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={add.isPending}>Cancel</Button>
          <Button type="submit" form="add-admin-form" loading={add.isPending} disabled={!valid}>Add admin</Button>
        </>
      }
    >
      <form id="add-admin-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="fn" required>
          <Input id="fn" autoFocus value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </Field>
        <Field label="Last name" htmlFor="ln" required>
          <Input id="ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </Field>
        <Field label="Work email" htmlFor="em" required className="sm:col-span-2" error={form.email && !emailValid ? 'Enter a valid email address' : undefined}>
          <Input id="em" type="email" value={form.email} invalid={Boolean(form.email) && !emailValid} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

// ─── Activity ─────────────────────────────────────────────

function ActivityTab({ companyId }: { companyId: string }) {
  const [limit, setLimit] = useState(15);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const { data, isLoading, isError, error, refetch, isFetching } = useAuditLogs({ companyId, limit });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Activity</h2>
          <p className="text-xs text-muted-foreground">Everything done to or within this company</p>
        </div>
        <Link href={`/super-admin/audit-logs?companyId=${companyId}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <FileText className="h-3.5 w-3.5" /> Open in audit logs
        </Link>
      </div>
      {isError ? (
        <ErrorState message={getApiErrorMessage(error, 'Could not load activity')} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !data?.data.length ? (
        <EmptyState icon={<Activity />} title="No activity yet" />
      ) : (
        <>
          <ActivityTimeline entries={data.data} showCompany={false} onSelect={setSelected} />
          {data.meta.total > data.data.length && (
            <div className="mt-4 text-center">
              <Button variant="secondary" size="sm" loading={isFetching} onClick={() => setLimit((l) => Math.min(l + 15, 100))}>
                Load more ({data.meta.total - data.data.length} older)
              </Button>
            </div>
          )}
        </>
      )}
      <AuditEntryDrawer entry={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

// ─── Edit company ─────────────────────────────────────────

function EditCompanyModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: CompanyDetail }) {
  const { company } = data;
  const update = useUpdateCompany(company.id);
  const [form, setForm] = useState({ name: '', email: '', employeeIdPrefix: '' });

  useEffect(() => {
    if (open) {
      setForm({ name: company.name, email: company.email, employeeIdPrefix: company.settings?.employeeIdPrefix ?? '' });
    }
  }, [open, company]);

  const prefixValid = /^[A-Z0-9]{2,10}$/.test(form.employeeIdPrefix);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const valid = form.name.trim().length > 0 && emailValid && prefixValid;

  const changes = {
    ...(form.name.trim() !== company.name && { name: form.name.trim() }),
    ...(form.email.trim().toLowerCase() !== company.email && { email: form.email.trim().toLowerCase() }),
    ...(form.employeeIdPrefix !== (company.settings?.employeeIdPrefix ?? '') && { employeeIdPrefix: form.employeeIdPrefix }),
  };
  const dirty = Object.keys(changes).length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !dirty) return;
    try {
      await update.mutateAsync(changes);
      toast.success('Company updated');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update company'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={update.isPending}
      title="Edit company"
      description="The slug cannot be changed because it is part of the login URL."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button type="submit" form="edit-company-form" loading={update.isPending} disabled={!valid || !dirty}>Save changes</Button>
        </>
      }
    >
      <form id="edit-company-form" onSubmit={submit} className="space-y-4">
        <Field label="Company name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Contact email" htmlFor="email" required error={!emailValid ? 'Enter a valid email address' : undefined}>
          <Input id="email" type="email" invalid={!emailValid} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field
          label="Employee ID prefix"
          htmlFor="prefix"
          required
          error={!prefixValid ? '2–10 uppercase letters or digits' : undefined}
          hint={`New employees get IDs like ${form.employeeIdPrefix || 'EMP'}001. Existing IDs are not changed.`}
        >
          <Input
            id="prefix"
            className="font-mono uppercase"
            maxLength={10}
            invalid={!prefixValid}
            value={form.employeeIdPrefix}
            onChange={(e) => setForm({ ...form, employeeIdPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
          />
        </Field>
      </form>
    </Modal>
  );
}
