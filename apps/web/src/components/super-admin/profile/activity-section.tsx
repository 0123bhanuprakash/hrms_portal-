'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Download, History, Plus, ShieldCheck, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useInviteAdmin, useMySignIns, usePlatformAdmins, useRemoveAdmin, type PlatformAdmin, type SignInRow } from '@/lib/account';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative, initials } from '@/lib/format';
import { cn } from '@/lib/cn';

function exportCsv(rows: SignInRow[]) {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [['When', 'Result', 'Device', 'IP', 'New device or network'].join(','), ...rows.map((r) => [r.at, r.success ? 'Signed in' : 'Wrong password', r.device, r.ipAddress, r.newNetwork ? 'yes' : ''].map(cell).join(','))];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-sign-ins-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SignInsCard() {
  const [status, setStatus] = useState<'success' | 'failed' | undefined>(undefined);
  const q = useMySignIns(status);
  const d = q.data;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" /> Sign-in activity
        <span className="ml-auto text-xs font-normal text-muted-foreground">last 30 days · only your account</span>
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {([[undefined, 'All'], ['success', 'Successful'], ['failed', 'Wrong password']] as const).map(([v, label]) => (
            <button key={label} type="button" onClick={() => setStatus(v)} className={cn('rounded-lg px-3 py-1.5 text-xs font-medium', status === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-subtle')}>
              {label}
            </button>
          ))}
        </div>
        {d && d.failedFromNewPlaces > 0 && <Badge tone="danger" className="ml-auto">{d.failedFromNewPlaces} failed tr{d.failedFromNewPlaces === 1 ? 'y' : 'ies'} from a new device or network</Badge>}
        <Button size="sm" variant="secondary" className={cn(!(d && d.failedFromNewPlaces > 0) && 'ml-auto')} disabled={!d?.data.length} onClick={() => d && exportCsv(d.data)}>
          <Download /> Export
        </Button>
      </div>
      <div className={cn('overflow-x-auto transition-opacity', q.isFetching && 'opacity-70')}>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-3 font-semibold">Event</th>
              <th className="py-2 pr-3 font-semibold">Device</th>
              <th className="py-2 pr-3 font-semibold">IP</th>
              <th className="py-2 text-right font-semibold">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!d ? (
              <tr><td colSpan={4} className="py-3"><Skeleton className="h-32" /></td></tr>
            ) : !d.data.length ? (
              <tr><td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">Nothing in the last 30 days.</td></tr>
            ) : (
              d.data.map((r) => (
                <tr key={r.id} className={cn(r.newNetwork && !r.success && 'bg-destructive-soft/30')}>
                  <td className="py-2.5 pr-3">
                    <Badge tone={r.success ? 'success' : 'danger'}>{r.success ? 'Signed in' : 'Wrong password'}</Badge>
                    {r.newNetwork && <span className={cn('ml-2 text-xs font-semibold', r.success ? 'text-warning' : 'text-destructive')}>new device or network</span>}
                  </td>
                  <td className="py-2.5 pr-3">{r.device}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{r.ipAddress ?? '—'}</td>
                  <td className="whitespace-nowrap py-2.5 text-right text-xs text-muted-foreground" title={formatDateTime(r.at)}>{formatRelative(r.at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-destructive-soft/50 px-4 py-3 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <span className="min-w-0 flex-1"><b>Wasn’t you?</b> Change your password and sign out every other device in one step.</span>
        <Link href="/super-admin/profile?section=security&secure=1" className="inline-flex h-8 items-center rounded-md border border-destructive/30 bg-surface px-3 text-xs font-semibold text-destructive hover:bg-destructive-soft">
          Secure my account
        </Link>
      </div>
    </Card>
  );
}

function AdminsCard() {
  const me = useAuthStore((s) => s.user);
  const admins = usePlatformAdmins();
  const invite = useInviteAdmin();
  const remove = useRemoveAdmin();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<PlatformAdmin | null>(null);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.firstName.trim() && form.lastName.trim();
  const active = (admins.data ?? []).filter((a) => a.status === 'ACTIVE');

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Platform admins
        <span className="ml-auto text-xs font-normal text-muted-foreground">people who can change every company</span>
      </h2>
      {!admins.data ? (
        <Skeleton className="h-24" />
      ) : (
        <ul className="m-stagger divide-y divide-border">
          {admins.data.map((a) => {
            const isMe = a.id === me?.id;
            return (
              <li key={a.id} className={cn('flex items-center gap-3 py-2.5', a.status !== 'ACTIVE' && 'opacity-60')}>
                {a.avatarUrl ? (
                  <img src={a.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold', isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>{initials(`${a.firstName} ${a.lastName}`)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{a.firstName} {a.lastName}{isMe && <span className="font-normal text-muted-foreground"> · you</span>}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.email} · {a.status !== 'ACTIVE' ? 'access removed' : a.invited ? 'invited, hasn’t signed in yet' : a.lastLoginAt ? `last signed in ${formatRelative(a.lastLoginAt)}` : 'never signed in'}</span>
                </span>
                {a.invited && a.status === 'ACTIVE' && <Badge tone="info">Invited</Badge>}
                {!isMe && a.status === 'ACTIVE' && active.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-soft" onClick={() => setRemoving(a)} aria-label={`Remove ${a.email}`}>
                    <UserMinus />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onClick={() => setInviting(true)}><Plus /> Invite a Super Admin</Button>
        <span className="text-xs text-muted-foreground">They get an email with a temporary password and choose their own when they first sign in.</span>
      </div>

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        busy={invite.isPending}
        icon={<ShieldCheck />}
        title="Invite a Super Admin"
        description="They’ll be able to change every company, plan and platform setting. Only invite people you trust."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviting(false)} disabled={invite.isPending}>Cancel</Button>
            <Button
              disabled={!valid}
              loading={invite.isPending}
              onClick={() =>
                invite.mutate(
                  { email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim() },
                  {
                    onSuccess: (r) => {
                      toast.success(`Invite sent to ${r.email}`);
                      setInviting(false);
                      setForm({ email: '', firstName: '', lastName: '' });
                    },
                    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not invite')),
                  },
                )
              }
            >
              Send invite
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="inv-first"><Input id="inv-first" value={form.firstName} maxLength={60} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoFocus /></Field>
            <Field label="Last name" htmlFor="inv-last"><Input id="inv-last" value={form.lastName} maxLength={60} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          </div>
          <Field label="Email" htmlFor="inv-email"><Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@yourcompany.com" /></Field>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        isDanger
        isLoading={remove.isPending}
        title={`Remove ${removing?.firstName ?? ''}’s Super Admin access?`}
        description="They’re signed out everywhere and can’t sign in to the console any more."
        confirmText="Remove access"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove.mutateAsync(removing.id);
            toast.success(`${removing.email} no longer has access`);
            setRemoving(null);
          } catch (e) {
            toast.error(getApiErrorMessage(e, 'Could not remove access'));
          }
        }}
      />
    </Card>
  );
}

export function ActivitySection() {
  return (
    <div className="space-y-5">
      <SignInsCard />
      <AdminsCard />
    </div>
  );
}
