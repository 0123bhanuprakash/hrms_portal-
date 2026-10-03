'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Crown, MoreHorizontal, Pencil, Plus, Power, ScanSearch, ShieldCheck, Trash2, Users as UsersIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { useAccess } from '@/lib/access/use-access';
import { useDeleteRole, useDuplicateRole, useRoles, useSetRoleStatus, type RoleSummary } from '@/lib/company/user-management';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function RolesPage() {
  const router = useRouter();
  const { can, isLoading: accessLoading } = useAccess();
  const roles = useRoles();
  const duplicate = useDuplicateRole();
  const remove = useDeleteRole();
  const setStatus = useSetRoleStatus();
  const [deleting, setDeleting] = useState<RoleSummary | null>(null);
  const [deactivating, setDeactivating] = useState<RoleSummary | null>(null);
  const manage = can('role.manage');

  if (!accessLoading && !can('role.view')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="You don't have permission to view roles." />;
  }

  const menu = (role: RoleSummary): Array<MenuItem | 'separator'> => {
    const items: Array<MenuItem | 'separator'> = [
      { label: role.isOwner || !manage ? 'View permissions' : 'Edit', icon: <Pencil />, onSelect: () => router.push(`/app/roles/${role.id}`) },
    ];
    if (!manage) return items;
    items.push({
      label: 'Duplicate',
      icon: <Copy />,
      disabled: role.isOwner,
      hint: role.isOwner ? 'Create a new role instead' : undefined,
      onSelect: () =>
        duplicate.mutate(
          { id: role.id },
          {
            onSuccess: (r) => {
              toast.success(`Created “${r.name}”`);
              router.push(`/app/roles/${r.id}`);
            },
            onError: (e) => toast.error(getApiErrorMessage(e, 'Could not duplicate the role')),
          },
        ),
    });
    if (!role.isOwner) {
      items.push('separator');
      items.push(
        role.status === 'ACTIVE'
          ? { label: 'Deactivate', icon: <Power />, onSelect: () => setDeactivating(role) }
          : {
              label: 'Activate',
              icon: <Power />,
              onSelect: () =>
                setStatus.mutate(
                  { id: role.id, status: 'ACTIVE' },
                  { onSuccess: () => toast.success(`“${role.name}” is active again`), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not activate')) },
                ),
            },
      );
      items.push({
        label: 'Delete',
        icon: <Trash2 />,
        danger: true,
        disabled: role.userCount > 0,
        hint: role.userCount > 0 ? 'Move its users to another role first' : undefined,
        onSelect: () => setDeleting(role),
      });
    }
    return items;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Roles & permissions"
        description="Roles decide what people can do and over whom. A person can hold several roles — their access is everything those roles allow."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href="/app/access-explorer">
                <ScanSearch /> Access explorer
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/app/users">
                <UsersIcon /> Users
              </Link>
            </Button>
            {manage && (
              <Button asChild>
                <Link href="/app/roles/new">
                  <Plus /> New role
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {roles.isError ? (
        <ErrorState message={getApiErrorMessage(roles.error, 'Could not load roles')} onRetry={() => roles.refetch()} />
      ) : roles.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.data!.map((role) => (
            <Card key={role.id} className={cn('group flex flex-col p-5 transition-shadow hover:shadow-menu', role.status !== 'ACTIVE' && 'opacity-70')}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/app/roles/${role.id}`} className="min-w-0 flex-1 focus-visible:outline-none">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-foreground group-hover:text-primary">
                    {role.isOwner && <Crown className="h-4 w-4 shrink-0 text-warning" />}
                    {role.name}
                  </p>
                  <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{role.description || 'No description'}</p>
                </Link>
                <DropdownMenu
                  label={`Actions for ${role.name}`}
                  items={menu(role)}
                  trigger={() => (
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${role.name}`}>
                      <MoreHorizontal />
                    </Button>
                  )}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {role.isOwner ? <Badge tone="warning">All permissions</Badge> : <Badge tone="primary">{role.permissionCount} permissions</Badge>}
                <Badge tone="neutral">
                  <UsersIcon className="h-3 w-3" /> {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                </Badge>
                {role.status !== 'ACTIVE' && <Badge tone="neutral" dot>Inactive</Badge>}
                {!role.key && <Badge tone="outline">Custom</Badge>}
                <span className="ml-auto text-muted-foreground">Updated {formatRelative(role.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        isDanger
        isLoading={remove.isPending}
        title={`Delete “${deleting?.name}”?`}
        description="The role and its permission settings are removed permanently. This can't be undone."
        confirmText="Delete role"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success(`“${deleting.name}” deleted`);
            setDeleting(null);
          } catch (e) {
            toast.error(getApiErrorMessage(e, 'Could not delete the role'));
          }
        }}
      />
      <DeactivateRoleDialog role={deactivating} roles={roles.data ?? []} onClose={() => setDeactivating(null)} />
    </div>
  );
}

function DeactivateRoleDialog({ role, roles, onClose }: { role: RoleSummary | null; roles: RoleSummary[]; onClose: () => void }) {
  const setStatus = useSetRoleStatus();
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const others = roles.filter((r) => r.id !== role?.id && r.status === 'ACTIVE');

  const confirm = async () => {
    if (!role) return;
    setError(null);
    try {
      await setStatus.mutateAsync({ id: role.id, status: 'INACTIVE', reassignToRoleId: target || undefined });
      toast.success(`“${role.name}” deactivated${target ? ` · users moved to ${others.find((r) => r.id === target)?.name}` : ''}`);
      setTarget('');
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not deactivate the role'));
    }
  };

  return (
    <Modal
      open={Boolean(role)}
      onClose={() => {
        setTarget('');
        setError(null);
        onClose();
      }}
      busy={setStatus.isPending}
      icon={<Power />}
      title={`Deactivate “${role?.name}”?`}
      description="Its permissions stop applying immediately. You can activate it again later."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={setStatus.isPending}>Cancel</Button>
          <Button variant="danger" onClick={confirm} loading={setStatus.isPending}>Deactivate</Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {role && role.userCount > 0 ? (
          <Field
            label={`Move its ${role.userCount} user(s) to`}
            htmlFor="reassign"
            hint="Optional if they also hold other roles. Users left with no active role must be moved."
          >
            <select id="reassign" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
              <option value="">Don't move — keep their other roles</option>
              {others.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="text-sm text-muted-foreground">No users currently hold this role.</p>
        )}
      </div>
    </Modal>
  );
}
