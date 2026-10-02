'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  KeyRound,
  ScanSearch,
  Mail,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  UserX,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { RolePicker } from '@/components/company/role-picker';
import { useAccess } from '@/lib/access/use-access';
import {
  useCompanyUsers,
  useInviteUser,
  useResendInvite,
  useRoles,
  useSendPasswordReset,
  useSetUserRoles,
  useSetUserStatus,
  type CompanyUser,
  type UsersQuery,
} from '@/lib/company/user-management';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative, initials } from '@/lib/format';
import { cn } from '@/lib/cn';

type StatusTab = 'all' | 'ACTIVE' | 'INVITED' | 'INACTIVE';

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function UsersPage() {
  const router = useRouter();
  const { can, isLoading: accessLoading } = useAccess();
  const [tab, setTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);

  const query: UsersQuery = { search: debounced || undefined, roleId: roleId || undefined, status: tab === 'all' ? undefined : tab, page, limit: 20 };
  const users = useCompanyUsers(query);
  const roles = useRoles();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editRoles, setEditRoles] = useState<CompanyUser | null>(null);
  const [confirm, setConfirm] = useState<{ user: CompanyUser; action: 'deactivate' | 'activate' } | null>(null);

  const resend = useResendInvite();
  const reset = useSendPasswordReset();
  const setStatus = useSetUserStatus();

  useEffect(() => setPage(1), [debounced, roleId, tab]);

  if (!accessLoading && !can('user.view')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="You don't have permission to view users." />;
  }

  const counts = users.data?.meta.counts;
  const tabs: Array<{ id: StatusTab; label: string; count?: number }> = [
    { id: 'all', label: 'All', count: counts?.all },
    { id: 'ACTIVE', label: 'Active', count: counts?.active },
    { id: 'INVITED', label: 'Invited', count: counts?.invited },
    { id: 'INACTIVE', label: 'Inactive', count: counts?.inactive },
  ];

  const actionsFor = (u: CompanyUser): Array<MenuItem | 'separator'> => {
    const items: Array<MenuItem | 'separator'> = [];
    if (can('role.view')) {
      items.push({ label: 'See what they can do', icon: <ScanSearch />, onSelect: () => router.push(`/app/access-explorer?user=${u.id}`) });
    }
    if (can('user.assign_roles')) {
      items.push({ label: 'Edit roles', icon: <ShieldCheck />, onSelect: () => setEditRoles(u), disabled: u.isSelf, hint: u.isSelf ? "You can't change your own roles" : undefined });
    }
    if (u.invited && can('user.invite')) {
      items.push({
        label: 'Resend invite',
        icon: <Mail />,
        onSelect: () =>
          resend.mutate(u.id, {
            onSuccess: (r) => toast.success(r.emailSent ? `New invite sent to ${u.email}` : 'Invite created, but the email could not be sent'),
            onError: (e) => toast.error(getApiErrorMessage(e, 'Could not resend the invite')),
          }),
      });
    }
    if (!u.invited && u.status === 'ACTIVE' && can('user.edit')) {
      items.push({
        label: 'Send password reset',
        icon: <KeyRound />,
        onSelect: () =>
          reset.mutate(u.id, {
            onSuccess: () => toast.success(`Password reset link sent to ${u.email}`),
            onError: (e) => toast.error(getApiErrorMessage(e, 'Could not send the reset link')),
          }),
      });
    }
    if (can('user.deactivate') && !u.isSelf) {
      if (items.length) items.push('separator');
      items.push(
        u.status === 'ACTIVE'
          ? { label: 'Deactivate', icon: <UserX />, danger: true, onSelect: () => setConfirm({ user: u, action: 'deactivate' }) }
          : { label: 'Activate', icon: <UserCheck />, onSelect: () => setConfirm({ user: u, action: 'activate' }) },
      );
    }
    return items;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Everyone who can sign in to your workspace, and the roles that decide what they can do."
        action={
          <div className="flex gap-2">
            {can('role.view') && (
              <Button variant="secondary" asChild>
                <Link href="/app/roles">
                  <ShieldCheck /> Roles & permissions
                </Link>
              </Button>
            )}
            {can('user.invite') && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus /> Invite user
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-4 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="flex gap-2 pb-3">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="pl-8" aria-label="Search users" />
            </div>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={cn(inputClass, 'w-44')} aria-label="Filter by role">
              <option value="">All roles</option>
              {roles.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {users.isError ? (
          <ErrorState message={getApiErrorMessage(users.error, 'Could not load users')} onRetry={() => users.refetch()} />
        ) : users.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !users.data?.data.length ? (
          <EmptyState
            icon={<UsersIcon />}
            title={search || roleId || tab !== 'all' ? 'No users match' : 'No users yet'}
            description={search || roleId || tab !== 'all' ? 'Try a different search or filter.' : 'Invite your first teammate to get started.'}
            action={can('user.invite') && !search && !roleId && tab === 'all' ? <Button onClick={() => setInviteOpen(true)}><UserPlus /> Invite user</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Roles</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Status</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Last sign-in</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.data.data.map((u) => {
                  const items = actionsFor(u);
                  return (
                    <tr key={u.id} className={cn('transition-colors hover:bg-muted/50', u.status !== 'ACTIVE' && 'opacity-70')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
                            {initials(`${u.firstName} ${u.lastName}`)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                              {u.firstName} {u.lastName}
                              {u.isSelf && <Badge tone="outline">You</Badge>}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            {/* Phones: roles under the name instead of their own column */}
                            <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                              {u.roles.map((r) => (
                                <Badge key={r.id} tone={r.isOwner ? 'warning' : 'primary'}>{r.name}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r.id} tone={r.isOwner ? 'warning' : r.status === 'ACTIVE' ? 'primary' : 'neutral'}>
                              {r.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {u.status !== 'ACTIVE' ? (
                          <Badge tone="neutral" dot>Inactive</Badge>
                        ) : u.invited ? (
                          <Badge tone="info" dot>Invited</Badge>
                        ) : (
                          <Badge tone="success" dot>Active</Badge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Never'}</td>
                      <td className="px-4 py-3 text-right">
                        {items.length > 0 && (
                          <DropdownMenu
                            label={`Actions for ${u.firstName}`}
                            items={items}
                            trigger={() => (
                              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.firstName} ${u.lastName}`}>
                                <MoreHorizontal />
                              </Button>
                            )}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {users.data && users.data.meta.totalPages > 1 && (
          <div className="border-t border-border px-4 py-3">
            <Pagination page={users.data.meta.page} totalPages={users.data.meta.totalPages} total={users.data.meta.total} limit={users.data.meta.limit} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} canChooseRoles={can('user.assign_roles')} />
      <EditRolesDialog user={editRoles} onClose={() => setEditRoles(null)} />

      <ConfirmDialog
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        isDanger={confirm?.action === 'deactivate'}
        isLoading={setStatus.isPending}
        title={confirm?.action === 'deactivate' ? `Deactivate ${confirm.user.firstName}?` : `Activate ${confirm?.user.firstName}?`}
        description={
          confirm?.action === 'deactivate'
            ? 'They will be signed out everywhere immediately and won’t be able to sign in until reactivated. Their data is kept.'
            : 'They will be able to sign in again with their existing password.'
        }
        confirmText={confirm?.action === 'deactivate' ? 'Deactivate' : 'Activate'}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            const r = await setStatus.mutateAsync({ id: confirm.user.id, status: confirm.action === 'deactivate' ? 'INACTIVE' : 'ACTIVE' });
            toast.success(
              confirm.action === 'deactivate'
                ? `${confirm.user.firstName} deactivated${r.revokedSessions ? ` · signed out of ${r.revokedSessions} session(s)` : ''}`
                : `${confirm.user.firstName} can sign in again`,
            );
            setConfirm(null);
          } catch (e) {
            toast.error(getApiErrorMessage(e, 'Could not update the user'));
          }
        }}
      />
    </div>
  );
}

// ─── Invite ─────────────────────────────────────────────────

function InviteDialog({ open, onClose, canChooseRoles }: { open: boolean; onClose: () => void; canChooseRoles: boolean }) {
  const roles = useRoles();
  const invite = useInviteUser();
  const defaultRole = useMemo(() => roles.data?.find((r) => r.key === 'employee' && r.status === 'ACTIVE'), [roles.data]);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ firstName: '', lastName: '', email: '' });
      setRoleIds(defaultRole ? [defaultRole.id] : []);
      setError(null);
    }
  }, [open, defaultRole]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (canChooseRoles && !roleIds.length) return setError('Choose at least one role');
    try {
      const r = await invite.mutateAsync({ ...form, ...(canChooseRoles && { roleIds }) });
      toast.success(r.emailSent ? `Invite sent to ${r.email}` : `${r.firstName} was added, but the invite email could not be sent`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not invite the user'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={invite.isPending}
      icon={<UserPlus />}
      title="Invite a user"
      description="They’ll get an email with a temporary password and choose their own when they first sign in."
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={invite.isPending}>Cancel</Button>
          <Button type="submit" form="invite-form" loading={invite.isPending}>Send invite</Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="inv-first" required>
            <Input id="inv-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required autoFocus />
          </Field>
          <Field label="Last name" htmlFor="inv-last" required>
            <Input id="inv-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </Field>
        </div>
        <Field label="Work email" htmlFor="inv-email" required>
          <Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="name@company.com" />
        </Field>
        <Field
          label="Roles"
          hint={canChooseRoles ? 'A person can hold several roles — their access is everything the roles allow combined.' : 'New users start with the Employee role. An admin can add more roles later.'}
        >
          {canChooseRoles ? (
            <RolePicker roles={roles.data} value={roleIds} onChange={setRoleIds} loading={roles.isLoading} />
          ) : (
            <div><Badge tone="primary">{defaultRole?.name ?? 'Employee'}</Badge></div>
          )}
        </Field>
      </form>
    </Modal>
  );
}

// ─── Edit roles ─────────────────────────────────────────────

function EditRolesDialog({ user, onClose }: { user: CompanyUser | null; onClose: () => void }) {
  const roles = useRoles();
  const setRoles = useSetUserRoles();
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRoleIds(user.roles.map((r) => r.id));
      setError(null);
    }
  }, [user]);

  const save = async () => {
    if (!user) return;
    if (!roleIds.length) return setError('A user needs at least one role');
    try {
      const r = await setRoles.mutateAsync({ id: user.id, roleIds });
      const parts = [r.changes.added.length && `added ${r.changes.added.join(', ')}`, r.changes.removed.length && `removed ${r.changes.removed.join(', ')}`].filter(Boolean);
      toast.success(parts.length ? `${user.firstName}: ${parts.join(' · ')}` : 'No changes');
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not update roles'));
    }
  };

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      busy={setRoles.isPending}
      icon={<ShieldCheck />}
      title={user ? `Roles for ${user.firstName} ${user.lastName}` : 'Roles'}
      description="Changes apply on their next click — no need for them to sign in again."
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={setRoles.isPending}>Cancel</Button>
          <Button onClick={save} loading={setRoles.isPending}>Save roles</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <RolePicker roles={roles.data} value={roleIds} onChange={setRoleIds} loading={roles.isLoading} />
      </div>
    </Modal>
  );
}
