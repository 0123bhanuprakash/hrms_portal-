'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRightLeft, Check, Crown, History, KeyRound, Mail, ScanSearch, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { Drawer } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormError } from '@/components/ui/field';
import { Skeleton, Tabs } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CountUp } from '@/components/motion/motion';
import { RoleChip, roleBorder, roleSoft, roleSolid, roleStyle, roleText } from '@/components/admin/role-look';
import { SCOPE_LABELS, useAccess } from '@/lib/access/use-access';
import { useExplainUser } from '@/lib/company/advanced';
import {
  useCompanyUser,
  useResendInvite,
  useRoles,
  useRolesPreview,
  useSendPasswordReset,
  useSetUserRoles,
  useUserHistory,
  type CompanyUser,
} from '@/lib/company/user-management';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type Tab = 'access' | 'history';

/**
 * One person: their roles as tick cards (with "what changes if…" before you
 * save), how far their access reaches, cover they hold, and account history.
 */
export function UserDrawer({ user, onClose, onStatus }: { user: CompanyUser | null; onClose: () => void; onStatus: (u: CompanyUser) => void }) {
  const { can } = useAccess();
  const [tab, setTab] = useState<Tab>('access');
  const detail = useCompanyUser(user?.id ?? null);
  const u = detail.data ?? user;
  const roles = useRoles();
  const setRoles = useSetUserRoles();
  const resend = useResendInvite();
  const reset = useSendPasswordReset();
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setPicked(user.roles.map((r) => r.id));
      setTab('access');
      setError(null);
    }
  }, [user]);

  const current = useMemo(() => (u?.roles ?? []).map((r) => r.id).sort().join(), [u]);
  const changed = [...picked].sort().join() !== current;
  const canAssign = can('user.assign_roles') && !u?.isSelf;
  const preview = useRolesPreview(u?.id ?? null, picked, changed && picked.length > 0);
  const explain = useExplainUser(can('role.view') && u ? u.id : null);
  const history = useUserHistory(u?.id ?? null, tab === 'history');

  if (!u) return null;
  // View only: just their roles; otherwise every role they could tick
  const active = (roles.data ?? []).filter((r) => (canAssign ? r.status === 'ACTIVE' || picked.includes(r.id) : picked.includes(r.id)));

  const save = async () => {
    setError(null);
    if (!picked.length) return setError('A person needs at least one role');
    try {
      const r = await setRoles.mutateAsync({ id: u.id, roleIds: picked });
      const parts = [r.changes.added.length && `added ${r.changes.added.join(', ')}`, r.changes.removed.length && `removed ${r.changes.removed.join(', ')}`].filter(Boolean);
      toast.success(parts.length ? `${u.firstName}: ${parts.join(' · ')}` : 'No changes');
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not update roles'));
    }
  };

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const status = u.status !== 'ACTIVE' ? 'Inactive' : u.invited ? 'Invited' : 'Active';

  return (
    <Drawer
      open={Boolean(user)}
      onClose={onClose}
      busy={setRoles.isPending}
      guard={false}
      icon={<ShieldCheck />}
      title={`${u.firstName} ${u.lastName}`}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{u.email}</span>
          {u.employee && <span className="font-mono text-xs">{u.employee.employeeId}</span>}
          {u.employee?.designation && <span>· {u.employee.designation.name}</span>}
        </span>
      }
      footer={
        <>
          {can('user.deactivate') && !u.isSelf && (
            <Button variant="ghost" className={cn('mr-auto', u.status === 'ACTIVE' && 'text-destructive hover:text-destructive')} onClick={() => onStatus(u)}>
              {u.status === 'ACTIVE' ? <><UserX /> Deactivate</> : <><UserCheck /> Activate</>}
            </Button>
          )}
          {u.invited && can('user.invite') ? (
            <Button
              variant="secondary"
              loading={resend.isPending}
              onClick={() =>
                resend.mutate(u.id, {
                  onSuccess: (r) => toast.success(r.emailSent ? `New invite sent to ${u.email}` : 'Invite created, but the email could not be sent'),
                  onError: (e) => toast.error(getApiErrorMessage(e, 'Could not resend the invite')),
                })
              }
            >
              <Mail /> Resend invite
            </Button>
          ) : (
            u.status === 'ACTIVE' &&
            can('user.edit') && (
              <Button
                variant="secondary"
                loading={reset.isPending}
                onClick={() =>
                  reset.mutate(u.id, {
                    onSuccess: () => toast.success(`Password reset link sent to ${u.email}`),
                    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not send the reset link')),
                  })
                }
              >
                <KeyRound /> Password reset
              </Button>
            )
          )}
          {canAssign && (
            <Button onClick={() => void save()} loading={setRoles.isPending} disabled={!changed}>
              Save roles
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <PersonAvatar person={u} size="lg" />
          <div className="min-w-0 flex-1 text-sm">
            <Badge tone={status === 'Active' ? 'success' : status === 'Invited' ? 'info' : 'neutral'} dot>{status}</Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {u.lastLoginAt ? `Last signed in ${formatRelative(u.lastLoginAt)} · ${formatDateTime(u.lastLoginAt)}` : `Invited ${formatDate(u.createdAt)} · hasn’t signed in yet`}
            </p>
          </div>
          {can('role.view') && (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/app/access-explorer?user=${u.id}`}><ScanSearch /> Explain</Link>
            </Button>
          )}
        </div>

        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'access', label: 'Access', icon: <ShieldCheck /> },
            { id: 'history', label: 'History', icon: <History /> },
          ]}
        />

        {tab === 'access' ? (
          <div className="space-y-5">
            <FormError>{error}</FormError>
            <section className="space-y-2">
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Roles {u.isSelf ? '· you can’t change your own' : !canAssign ? '· view only' : '· tick to add or remove'}
              </p>
              {roles.isLoading ? (
                <Skeleton className="h-40" />
              ) : (
                <div className="space-y-1.5">
                  {active.map((r) => {
                    const on = picked.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={!canAssign}
                        aria-pressed={on}
                        onClick={() => toggle(r.id)}
                        style={roleStyle(r)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all disabled:cursor-default',
                          on ? cn(roleBorder, roleSoft) : 'border-border hover:border-foreground/20 hover:bg-muted/40',
                        )}
                      >
                        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors', on ? cn(roleSolid, 'border-transparent text-white') : 'border-input bg-surface')}>
                          {on && <Check className="h-3 w-3 adm-land" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('flex items-center gap-1 text-sm font-semibold', on && roleText)}>
                            {r.isOwner && <Crown className="h-3.5 w-3.5" />}
                            {r.name}
                          </span>
                          {r.description && <span className="line-clamp-1 text-xs text-muted-foreground">{r.description}</span>}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{r.isOwner ? 'Everything' : `${r.permissionCount} perms`}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {changed && picked.length > 0 && <ChangePreview data={preview.data} loading={preview.isFetching && !preview.data} name={u.firstName} />}

            {explain.data?.reach && (
              <section className="space-y-2">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Reaches today</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Direct reports', explain.data.reach.direct],
                    ['Whole team', explain.data.reach.team],
                    ['Permissions', explain.data.permissionCount],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-muted/60 p-2.5">
                      <p className="text-[11px] text-muted-foreground">{l}</p>
                      <CountUp value={Number(v)} className="text-xl font-semibold tabular-nums" />
                    </div>
                  ))}
                </div>
                {explain.data.reach.widest && (
                  <p className="text-xs text-muted-foreground">
                    Widest reach: <b className="text-foreground">{SCOPE_LABELS[explain.data.reach.widest].label.toLowerCase()}</b>
                    {explain.data.sensitiveCount > 0 && <> · <span className="text-warning">{explain.data.sensitiveCount} sensitive permissions</span></>}
                  </p>
                )}
              </section>
            )}

            {explain.data && explain.data.delegations.length > 0 && (
              <section className="space-y-1.5">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Covering for someone</p>
                {explain.data.delegations.map((d) => (
                  <p key={d.id} className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm">
                    <ArrowRightLeft className="h-4 w-4 text-success" /> Covering {d.fromName}’s approvals until <b>{formatDate(d.until)}</b>
                  </p>
                ))}
              </section>
            )}
          </div>
        ) : (
          <HistoryList items={history.data} loading={history.isLoading} roles={roles.data ?? []} />
        )}
      </div>
    </Drawer>
  );
}

function ChangePreview({ data, loading, name }: { data: ReturnType<typeof useRolesPreview>['data']; loading: boolean; name: string }) {
  if (loading || !data) return <Skeleton className="h-24" />;
  if (data.becomesOwner) {
    return (
      <div className="m-rise rounded-xl border border-warning/40 bg-warning-soft/60 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-semibold"><Crown className="h-4 w-4 text-warning" /> {name} becomes a Company Admin</p>
        <p className="mt-1 text-xs text-muted-foreground">Every permission of every feature — including roles, salaries and settings.</p>
      </div>
    );
  }
  const total = data.added.length + data.widened.length;
  const sensitive = [...data.added, ...data.widened].filter((p) => p.sensitive);
  return (
    <div className="m-rise rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        What changes for {name}
        {total > 0 && <span className="text-xs text-success">+{total}</span>}
        {data.removed.length > 0 && <span className="text-xs text-destructive">−{data.removed.length}</span>}
        {data.sensitiveAdded > 0 && (
          <span className="adm-warn inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] text-warning">
            <AlertTriangle className="h-3 w-3" /> {data.sensitiveAdded} sensitive
          </span>
        )}
      </p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs adm-step">
        {sensitive.slice(0, 3).map((p) => (
          <li key={`s-${p.key}`} className="flex gap-2"><b className="w-4 text-warning">⚠</b><span>Could <b>{p.label.toLowerCase()}</b>{p.scope ? ` — ${SCOPE_LABELS[p.scope].label.toLowerCase()}` : ''}</span></li>
        ))}
        {data.widened.filter((p) => !p.sensitive).slice(0, 4).map((p) => (
          <li key={`w-${p.key}`} className="flex gap-2"><b className="w-4 text-info">↑</b><span>{p.label}: {SCOPE_LABELS[p.from!].label.toLowerCase()} → <b>{SCOPE_LABELS[p.scope!].label.toLowerCase()}</b></span></li>
        ))}
        {data.added.filter((p) => !p.sensitive).slice(0, 5).map((p) => (
          <li key={`a-${p.key}`} className="flex gap-2"><b className="w-4 text-success">+</b><span>{p.label}{p.scope ? ` — ${SCOPE_LABELS[p.scope].label.toLowerCase()}` : ''}</span></li>
        ))}
        {data.removed.slice(0, 5).map((p) => (
          <li key={`r-${p.key}`} className="flex gap-2"><b className="w-4 text-destructive">−</b><span className="text-muted-foreground line-through">{p.label}</span></li>
        ))}
        {data.narrowed.slice(0, 3).map((p) => (
          <li key={`n-${p.key}`} className="flex gap-2"><b className="w-4 text-muted-foreground">↓</b><span>{p.label}: {SCOPE_LABELS[p.from!].label.toLowerCase()} → {SCOPE_LABELS[p.scope!].label.toLowerCase()}</span></li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {data.permissionCount.before} → <b className="text-foreground">{data.permissionCount.after}</b> permissions · applies on their next click
      </p>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  'user:invite': 'Invited',
  'user:roles:update': 'Roles changed',
  'user:status:update': 'Status changed',
  'user:invite:resend': 'Invite sent again',
  'user:password:reset': 'Password reset sent',
  'user:update': 'Name changed',
};

function HistoryList({ items, loading, roles }: { items: ReturnType<typeof useUserHistory>['data']; loading: boolean; roles: Array<{ key: string | null; name: string; isOwner: boolean }> }) {
  const role = (name: string) => roles.find((r) => r.name === name) ?? { name };
  if (loading) return <Skeleton className="h-40" />;
  if (!items?.length) return <p className="py-8 text-center text-sm text-muted-foreground">Nothing changed on this account yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-border pl-5 m-stagger">
      {items.map((h) => (
        <li key={h.id} className="relative text-sm">
          <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary" />
          <p className="font-medium">{ACTION_LABEL[h.action] ?? h.action.replace(/^user:/, '').replace(/[:_]/g, ' ')}</p>
          {(h.added.length > 0 || h.removed.length > 0) && (
            <p className="mt-0.5 flex flex-wrap gap-1">
              {h.added.map((n) => <RoleChip key={`a${n}`} role={role(n)}>+</RoleChip>)}
              {h.removed.map((n) => <RoleChip key={`r${n}`} role={role(n)} className="line-through opacity-60" />)}
            </p>
          )}
          {h.status && <p className="text-xs text-muted-foreground">Now {h.status.toLowerCase()}</p>}
          <p className="text-xs text-muted-foreground">{formatDateTime(h.at)}{h.by ? ` · by ${h.by}` : ''}</p>
        </li>
      ))}
    </ol>
  );
}
