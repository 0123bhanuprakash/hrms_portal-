'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, Columns3, Copy, Crown, GitCompareArrows, LayoutGrid, Lock, MoreHorizontal, Pencil, Plus, Power, ScanSearch, ShieldCheck, Trash2, Users as UsersIcon, Wand2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, FormError } from '@/components/ui/field';
import { SearchSelect } from '@/components/ui/pickers';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ADMIN_MODULES, HeatStrip, roleSolid, roleStyle, roleText } from '@/components/admin/role-look';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { useAccess, useAccessCatalog } from '@/lib/access/use-access';
import { useDeleteRole, useDuplicateRole, useRoleTemplates, useRoles, useSetRoleStatus, type RoleSummary } from '@/lib/company/user-management';
import { useUiState } from '@/lib/preferences/ui-state';
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
  const [picked, setPicked] = useState<string[]>([]);
  const [view, setView] = useUiState<'cards' | 'grid'>('roles.view', 'cards', (v): v is 'cards' | 'grid' => v === 'cards' || v === 'grid');
  const catalog = useAccessCatalog();
  const templates = useRoleTemplates();
  const manage = can('role.manage');
  // Permissions per module the company has (for the heat strips)
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const m of catalog.data ?? []) {
      t[m.key] = m.features.filter((f) => f.enabled !== false && f.stage !== 'coming_soon').reduce((n, f) => n + f.permissions.length, 0);
    }
    return t;
  }, [catalog.data]);
  const pick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));

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
          <div className="flex flex-wrap gap-2">
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
              <DropdownMenu
                label="Start from a template"
                items={(templates.data ?? []).map((t) => ({ label: t.name, hint: t.description, icon: <Wand2 />, onSelect: () => router.push(`/app/roles/new?template=${t.key}`) }))}
                trigger={() => (
                  <Button variant="secondary">
                    <Wand2 /> Templates <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                )}
              />
            )}
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

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
        {picked.length ? (
          <>
            <b className="text-primary">{picked.length} selected</b>
            <Button size="sm" disabled={picked.length < 2} asChild={picked.length >= 2}>
              {picked.length >= 2 ? (
                <Link href={`/app/roles/compare?ids=${picked.join(',')}`}><GitCompareArrows /> Compare</Link>
              ) : (
                <span><GitCompareArrows /> Compare</span>
              )}
            </Button>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPicked([])}>Clear</button>
          </>
        ) : (
          <span className="text-muted-foreground">Tick 2–3 roles to compare them side by side.</span>
        )}
        <div className="ml-auto inline-flex rounded-lg border border-border bg-muted/50 p-0.5" role="group" aria-label="View">
          {([['cards', 'Cards', <LayoutGrid key="c" />], ['grid', 'Grid', <Columns3 key="g" />]] as const).map(([v, l, ic]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium [&_svg]:size-3.5', view === v ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground')}>
              {ic}
              {l}
            </button>
          ))}
        </div>
      </div>

      {roles.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(roles.error, 'Could not load roles')} onRetry={() => roles.refetch()} />
      ) : roles.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : view === 'grid' ? (
        <RoleGrid roles={roles.data!} totals={totals} onPick={(id, m) => router.push(`/app/roles/${id}#${m}`)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 m-stagger">
          {roles.data!.map((role) => {
            const on = picked.includes(role.id);
            return (
              <Card
                key={role.id}
                style={roleStyle(role)}
                className={cn('group relative flex flex-col gap-3 overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-menu', role.status !== 'ACTIVE' && 'opacity-70', on && 'ring-2 ring-primary')}
              >
                <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', roleSolid)} />
                <div className="flex items-start gap-2">
                  <input type="checkbox" aria-label={`Compare ${role.name}`} className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" checked={on} onChange={() => pick(role.id)} disabled={!on && picked.length >= 3} />
                  <Link href={`/app/roles/${role.id}`} className="min-w-0 flex-1 focus-visible:outline-none">
                    <p className={cn('flex items-center gap-1.5 truncate font-semibold', roleText)}>
                      {role.isOwner && <Crown className="h-4 w-4 shrink-0" />}
                      {role.name}
                    </p>
                    <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{role.description || 'No description'}</p>
                  </Link>
                  {role.isOwner ? (
                    <span className="adm-shimmer inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  ) : (
                    <DropdownMenu
                      label={`Actions for ${role.name}`}
                      items={menu(role)}
                      trigger={() => (
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${role.name}`}>
                          <MoreHorizontal />
                        </Button>
                      )}
                    />
                  )}
                </div>
                <HeatStrip role={role} modules={role.modules} totals={totals} onPick={(m) => router.push(`/app/roles/${role.id}#${m}`)} />
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                  <span className="flex">
                    {(role.holders ?? []).map((h) => (
                      <PersonAvatar key={h.id} person={h} size="xs" className="-ml-1.5 border-2 border-surface first:ml-0" />
                    ))}
                  </span>
                  <span className="text-muted-foreground">{role.userCount} {role.userCount === 1 ? 'person' : 'people'}</span>
                  {role.status !== 'ACTIVE' && <Badge tone="neutral" dot>Inactive</Badge>}
                  {!role.key && <Badge tone="outline">Custom</Badge>}
                  <span className="ml-auto font-semibold">{role.isOwner ? 'All' : role.permissionCount} perms</span>
                  {Boolean(role.sensitiveCount) && (
                    <span title="Sensitive permissions" className="inline-flex items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning">
                      <AlertTriangle className="h-3 w-3" /> {role.sensitiveCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">Updated {formatRelative(role.updatedAt)}</span>
              </Card>
            );
          })}
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
      tone="danger"
      size="sm"
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
        <FormError>{error}</FormError>
        {role && role.userCount > 0 ? (
          <Field
            label={`Move its ${role.userCount} user(s) to`}
            htmlFor="reassign"
            hint="Optional if they also hold other roles. Users left with no active role must be moved."
          >
            <SearchSelect id="reassign" value={target} onChange={setTarget} emptyLabel="Don’t move — keep their other roles" options={others.map((r) => ({ value: r.id, label: r.name, sub: `${r.userCount} people` }))} />
          </Field>
        ) : (
          <p className="text-sm text-muted-foreground">No users currently hold this role.</p>
        )}
      </div>
    </Modal>
  );
}

/** Every role × every module in one table — spot a role that reaches too far. */
function RoleGrid({ roles, totals, onPick }: { roles: RoleSummary[]; totals: Record<string, number>; onPick: (id: string, module: string) => void }) {
  return (
    <Card className="overflow-x-auto p-4">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th />
            {ADMIN_MODULES.map((m) => (
              <th key={m.key} className="text-center text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{m.short}</th>
            ))}
            <th className="text-right text-2xs font-semibold uppercase tracking-wider text-muted-foreground">People</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} style={roleStyle(r)}>
              <td className={cn('whitespace-nowrap pr-3 font-semibold', roleText)}>
                <Link href={`/app/roles/${r.id}`} className="hover:underline">{r.isOwner && <Crown className="mr-1 inline h-3.5 w-3.5" />}{r.name}</Link>
              </td>
              {ADMIN_MODULES.map((m) => {
                const n = r.isOwner ? totals[m.key] ?? 0 : (r.modules?.[m.key] ?? 0);
                const share = n / Math.max(1, totals[m.key] ?? 1);
                return (
                  <td key={m.key} className="p-0">
                    <button
                      type="button"
                      onClick={() => onPick(r.id, m.key)}
                      title={`${r.name} · ${m.short}: ${n} of ${totals[m.key] ?? 0}`}
                      className={cn('flex h-8 w-full items-center justify-center rounded-md text-[11px] font-semibold tabular-nums transition-transform hover:scale-105', share > 0.55 ? 'text-white' : 'text-foreground/70', roleSolid)}
                      style={{ backgroundColor: share ? undefined : 'transparent', opacity: share ? 0.25 + share * 0.75 : 1 }}
                    >
                      {n || <span className="text-muted-foreground">·</span>}
                    </button>
                  </td>
                );
              })}
              <td className="pl-3 text-right tabular-nums text-muted-foreground">{r.userCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">Darker = more of that module. Click a square to open the role on that module.</p>
    </Card>
  );
}
