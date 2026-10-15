'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronDown,
  Crown,
  IdCard,
  KeyRound,
  Mail,
  MoreHorizontal,
  ScanSearch,
  Search,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  Sparkles,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  UserX,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { FormError, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { CountUp } from '@/components/motion/motion';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { RoleChip } from '@/components/admin/role-look';
import { InviteDialog } from '@/components/admin/invite-dialog';
import { UserDrawer } from '@/components/admin/user-drawer';
import { EmployeeProfileFields, emptyProfile, profileBody, type ProfileInput } from '@/components/company/employee-profile-fields';
import { useAccess } from '@/lib/access/use-access';
import {
  useBulkUsers,
  useCompanyUsers,
  useCreateEmployeeProfile,
  useResendInvite,
  useRoles,
  useSendPasswordReset,
  useSetUserStatus,
  useUsersInsights,
  type BulkAction,
  type CompanyUser,
  type UsersQuery,
} from '@/lib/company/user-management';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
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
  const insights = useUsersInsights(can('user.view'));

  const [inviteOpen, setInviteOpen] = useState(false);
  const [open, setOpen] = useState<CompanyUser | null>(null);
  const [confirm, setConfirm] = useState<{ user: CompanyUser; action: 'deactivate' | 'activate' } | null>(null);
  const [profileFor, setProfileFor] = useState<CompanyUser | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<{ action: BulkAction; roleId?: string; label: string } | null>(null);

  const resend = useResendInvite();
  const reset = useSendPasswordReset();
  const setStatus = useSetUserStatus();
  const bulk = useBulkUsers();

  useEffect(() => setPage(1), [debounced, roleId, tab]);
  useEffect(() => setSelected(new Set()), [debounced, roleId, tab, page]);

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
  const rows = users.data?.data ?? [];
  const selectable = rows.filter((u) => !u.isSelf);
  const allOn = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const runBulk = async (action: BulkAction, ids: string[], roleIdFor?: string, label = 'Done') => {
    try {
      const r = await bulk.mutateAsync({ ids, action, roleId: roleIdFor });
      if (r.done) toast.success(`${label} · ${r.done} ${r.done === 1 ? 'person' : 'people'}`);
      for (const f of r.failed.slice(0, 3)) toast.error(`${f.name || 'Someone'}: ${f.error}`);
      if (r.failed.length > 3) toast.error(`…and ${r.failed.length - 3} more could not be changed`);
      setSelected(new Set());
      setBulkConfirm(null);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not change these people'));
    }
  };

  const actionsFor = (u: CompanyUser): Array<MenuItem | 'separator'> => {
    const items: Array<MenuItem | 'separator'> = [{ label: 'Open', icon: <ShieldCheck />, onSelect: () => setOpen(u) }];
    if (can('role.view')) items.push({ label: 'See what they can do', icon: <ScanSearch />, onSelect: () => router.push(`/app/access-explorer?user=${u.id}`) });
    if (!u.employee && can('employee.create')) items.push({ label: 'Add employee profile', icon: <IdCard />, onSelect: () => setProfileFor(u) });
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
      items.push('separator');
      items.push(
        u.status === 'ACTIVE'
          ? { label: 'Deactivate', icon: <UserX />, danger: true, onSelect: () => setConfirm({ user: u, action: 'deactivate' }) }
          : { label: 'Activate', icon: <UserCheck />, onSelect: () => setConfirm({ user: u, action: 'activate' }) },
      );
    }
    return items;
  };

  const activeRoles = (roles.data ?? []).filter((r) => r.status === 'ACTIVE');
  const ids = [...selected];
  const ins = insights.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Everyone who can sign in to your workspace, and the roles that decide what they can do."
        action={
          <div className="flex flex-wrap gap-2">
            {can('role.view') && (
              <Button variant="secondary" asChild>
                <Link href="/app/roles"><ShieldCheck /> Roles & permissions</Link>
              </Button>
            )}
            {can('user.invite') && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus /> Invite people
              </Button>
            )}
          </div>
        }
      />

      {/* Count tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 m-stagger">
        {[
          { label: 'Active', value: ins?.counts.active, hint: ins ? `${ins.counts.activeThisMonth} signed in this month` : '', tone: 'border-t-success', on: () => setTab('ACTIVE') },
          { label: 'Invited, not joined', value: ins?.counts.invited, hint: ins?.counts.oldInvites ? `${ins.counts.oldInvites} waiting over 7 days` : 'all recent', tone: 'border-t-info', on: () => setTab('INVITED') },
          { label: 'Inactive', value: ins?.counts.inactive, hint: 'can’t sign in · data kept', tone: 'border-t-border', on: () => setTab('INACTIVE') },
          { label: 'Company Admins', value: ins?.counts.admins, hint: 'full access', tone: 'border-t-warning', on: () => setRoleId(activeRoles.find((r) => r.isOwner)?.id ?? '') },
        ].map((t) => (
          <button key={t.label} type="button" onClick={t.on} className={cn('rounded-xl border border-border border-t-[3px] bg-surface p-4 text-left shadow-card transition-transform hover:-translate-y-0.5', t.tone)}>
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
            {t.value === undefined ? <Skeleton className="mt-1 h-8 w-12" /> : <CountUp value={t.value} className="block text-2xl font-semibold tabular-nums" />}
            <p className="truncate text-xs text-muted-foreground">{t.hint}</p>
          </button>
        ))}
      </div>

      {/* Needs a look */}
      {ins && (ins.oldInvites.length > 0 || ins.dormant.length > 0 || ins.privateData.people > 0) && (
        <Card className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Needs a look</p>
          {ins.oldInvites.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-info-soft px-3 py-2 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-info" />
              <span className="min-w-0 flex-1">
                <b>{ins.oldInvites.length} invite{ins.oldInvites.length === 1 ? '' : 's'}</b> older than a week — {names(ins.oldInvites.map((x) => x.name))} {ins.oldInvites.length === 1 ? 'hasn’t' : 'haven’t'} signed in.
              </span>
              {can('user.invite') && (
                <Button size="sm" variant="secondary" loading={bulk.isPending && bulk.variables?.action === 'resend_invite'} onClick={() => void runBulk('resend_invite', ins.oldInvites.map((x) => x.id), undefined, 'Invites sent again')}>
                  Resend {ins.oldInvites.length === 1 ? 'it' : 'all'}
                </Button>
              )}
            </div>
          )}
          {ins.dormant.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                <b>{ins.dormant[0]!.name}</b> has {ins.dormant[0]!.roles.join(', ')} but hasn’t signed in for {ins.dormant[0]!.days} days
                {ins.dormantCount > 1 && ` (+${ins.dormantCount - 1} more)`}.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const u = rows.find((x) => x.id === ins.dormant[0]!.id);
                  if (u) setOpen(u);
                  else {
                    setSearch(ins.dormant[0]!.name);
                    setTab('all');
                  }
                }}
              >
                Review access
              </Button>
            </div>
          )}
          {ins.privateData.people > 0 && can('role.view') && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <b>{ins.privateData.people} {ins.privateData.people === 1 ? 'person' : 'people'}</b> can see others’ salary or bank details ({ins.privateData.roles.join(', ')}).
              </span>
              <Button size="sm" variant="secondary" asChild>
                <Link href="/app/access-explorer?tab=sensitive">See who</Link>
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-visible">
        <div className="flex flex-col gap-3 border-b border-border px-4 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="relative w-full pb-3 sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-[calc(50%-6px)] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="pl-8" aria-label="Search users" />
          </div>
        </div>

        {/* Role chips = filter */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
          <span className="mr-1 text-xs text-muted-foreground">Role</span>
          {activeRoles.map((r) => (
            <RoleChip key={r.id} role={r} active={roleId === r.id} onClick={() => setRoleId(roleId === r.id ? '' : r.id)}>
              <span className="opacity-60">{r.userCount}</span>
            </RoleChip>
          ))}
          {roleId && (
            <button type="button" onClick={() => setRoleId('')} className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-soft/60 px-4 py-2 text-sm m-rise">
            <b className="text-primary">{selected.size} selected</b>
            {can('user.assign_roles') && (
              <>
                <RoleMenu label="Add a role" icon={<ShieldPlus />} roles={activeRoles.filter((r) => !r.isOwner)} onPick={(r) => setBulkConfirm({ action: 'add_role', roleId: r.id, label: `Add ${r.name}` })} />
                <RoleMenu label="Remove a role" icon={<ShieldMinus />} roles={activeRoles.filter((r) => !r.isOwner)} onPick={(r) => setBulkConfirm({ action: 'remove_role', roleId: r.id, label: `Remove ${r.name}` })} />
              </>
            )}
            {can('user.invite') && (
              <Button size="sm" variant="secondary" onClick={() => void runBulk('resend_invite', ids, undefined, 'Invites sent again')} loading={bulk.isPending && bulk.variables?.action === 'resend_invite'}>
                <Mail /> Resend invites
              </Button>
            )}
            {can('user.deactivate') && (
              <>
                <Button size="sm" variant="secondary" className="text-destructive" onClick={() => setBulkConfirm({ action: 'deactivate', label: 'Deactivate' })}><UserX /> Deactivate</Button>
                <Button size="sm" variant="ghost" onClick={() => void runBulk('activate', ids, undefined, 'Activated')}><UserCheck /> Activate</Button>
              </>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        {users.isLoadingError ? (
          <ErrorState message={getApiErrorMessage(users.error, 'Could not load users')} onRetry={() => users.refetch()} />
        ) : users.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !rows.length ? (
          <EmptyState
            icon={<UsersIcon />}
            title={search || roleId || tab !== 'all' ? 'No users match' : 'No users yet'}
            description={search || roleId || tab !== 'all' ? 'Try a different search or filter.' : 'Invite your first teammate to get started.'}
            action={can('user.invite') && !search && !roleId && tab === 'all' ? <Button onClick={() => setInviteOpen(true)}><UserPlus /> Invite people</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" aria-label="Select all on this page" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(selectable.map((u) => u.id)))} />
                  </th>
                  <th className="px-2 py-3 font-semibold">User</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Roles</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Status</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Last sign-in</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((u) => {
                  const days = u.lastLoginAt ? Math.floor((Date.now() - new Date(u.lastLoginAt).getTime()) / 86_400_000) : null;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setOpen(u)}
                      className={cn('cursor-pointer transition-colors hover:bg-muted/50', selected.has(u.id) && 'bg-primary-soft/40', u.status !== 'ACTIVE' && 'opacity-70')}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${u.firstName}`}
                          className="h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-30"
                          disabled={u.isSelf}
                          checked={selected.has(u.id)}
                          onChange={() => toggle(u.id)}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <PersonAvatar person={u} size="sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                              {u.firstName} {u.lastName}
                              {u.isSelf && <Badge tone="outline">You</Badge>}
                              {u.isAdmin && <Crown className="h-3.5 w-3.5 text-warning" aria-label="Company Admin" />}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {u.email}
                              {u.employee && <span className="ml-1.5 font-mono">· {u.employee.employeeId}</span>}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1 sm:hidden">{u.roles.map((r) => <RoleChip key={r.id} role={r} />)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="flex flex-wrap gap-1">{u.roles.map((r) => <RoleChip key={r.id} role={r} />)}</div>
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
                      <td className={cn('hidden px-4 py-3 lg:table-cell', days !== null && days >= 30 ? 'font-medium text-warning' : 'text-muted-foreground')}>
                        {u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu
                          label={`Actions for ${u.firstName}`}
                          items={actionsFor(u)}
                          trigger={() => (
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.firstName} ${u.lastName}`}>
                              <MoreHorizontal />
                            </Button>
                          )}
                        />
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

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} canChooseRoles={can('user.assign_roles')} canAddEmployee={can('employee.create')} />
      <UserDrawer user={open} onClose={() => setOpen(null)} onStatus={(u) => setConfirm({ user: u, action: u.status === 'ACTIVE' ? 'deactivate' : 'activate' })} />
      <ProfileDialog user={profileFor} onClose={() => setProfileFor(null)} />

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
            setOpen(null);
          } catch (e) {
            toast.error(getApiErrorMessage(e, 'Could not update the user'));
          }
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(bulkConfirm)}
        onClose={() => setBulkConfirm(null)}
        isDanger={bulkConfirm?.action === 'deactivate' || bulkConfirm?.action === 'remove_role'}
        isLoading={bulk.isPending}
        title={`${bulkConfirm?.label ?? ''} for ${selected.size} ${selected.size === 1 ? 'person' : 'people'}?`}
        description={
          bulkConfirm?.action === 'deactivate'
            ? 'They are signed out everywhere and can’t sign in until activated again. Their data is kept.'
            : 'Each person is checked on their own — anyone who can’t be changed is listed after.'
        }
        confirmText={bulkConfirm?.label ?? 'Confirm'}
        onConfirm={async () => {
          if (bulkConfirm) await runBulk(bulkConfirm.action, ids, bulkConfirm.roleId, bulkConfirm.label);
        }}
      />
    </div>
  );
}

const names = (list: string[]) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`);

function RoleMenu({ label, icon, roles, onPick }: { label: string; icon: React.ReactNode; roles: Array<{ id: string; name: string }>; onPick: (r: { id: string; name: string }) => void }) {
  return (
    <DropdownMenu
      align="left"
      label={label}
      items={roles.map((r) => ({ label: r.name, onSelect: () => onPick(r) }))}
      trigger={() => (
        <Button size="sm" variant="secondary">
          {icon} {label} <ChevronDown className="h-3 w-3" />
        </Button>
      )}
    />
  );
}

// ─── Employee profile for an older account ──────────────────

function ProfileDialog({ user, onClose }: { user: CompanyUser | null; onClose: () => void }) {
  const create = useCreateEmployeeProfile();
  const [profile, setProfile] = useState<ProfileInput>(emptyProfile());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (user) {
      setProfile(emptyProfile());
      setError(null);
    }
  }, [user]);
  if (!user) return null;

  const save = async () => {
    setError(null);
    try {
      const e = await create.mutateAsync({ userId: user.id, ...profileBody(profile) });
      toast.success(`${user.firstName} added to Employees as ${e.employeeId}`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the employee profile'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={create.isPending}
      icon={<IdCard />}
      title={`Add ${user.firstName} ${user.lastName} as an employee`}
      description="Links an employee record to their existing sign-in. No new account and no email."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={save} loading={create.isPending}>Add employee profile</Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError>{error}</FormError>
        <EmployeeProfileFields value={profile} onChange={setProfile} idPrefix="prof" />
      </div>
    </Modal>
  );
}
