'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound, LogOut, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useChangePassword, useRevokeOtherSessions, useRevokeSession, useSessions } from '@/lib/admin/queries';
import type { Session } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { describeUserAgent, formatDateTime, formatRelative, initials } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/cn';
import { DisplaySettingsCard } from '@/components/preferences/display-preferences';
import { MenuStyleCard, MomentsCard } from '@/components/preferences/personal-look';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile &amp; security</h1>
        <p className="text-sm text-muted-foreground">Your Super Admin account, password, signed-in devices and display settings.</p>
      </div>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-xl font-semibold text-primary-foreground shadow-card">
          {initials(`${user.firstName} ${user.lastName}`)}
        </span>
        <div className="flex-1">
          <p className="text-lg font-semibold">{user.firstName} {user.lastName}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-soft-foreground sm:self-center">
          <ShieldCheck className="h-3.5 w-3.5" /> Super Admin
        </span>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChangePasswordCard />
        <SessionsCard />
      </div>

      <MenuStyleCard platform />
      <MomentsCard platform />
      <DisplaySettingsCard />
    </div>
  );
}

// ─── Password ─────────────────────────────────────────────

function strength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Too weak', color: 'bg-destructive' },
    { label: 'Weak', color: 'bg-destructive' },
    { label: 'Fair', color: 'bg-warning' },
    { label: 'Good', color: 'bg-success/70' },
    { label: 'Strong', color: 'bg-success' },
    { label: 'Excellent', color: 'bg-success' },
  ];
  return { score, ...levels[score]! };
}

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} invalid={invalid} onChange={(e) => onChange(e.target.value)} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ChangePasswordCard() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const s = useMemo(() => strength(next), [next]);

  const mismatch = confirm.length > 0 && confirm !== next;
  const sameAsCurrent = next.length > 0 && next === current;
  const valid = current.length > 0 && next.length >= 8 && confirm === next && !sameAsCurrent;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      const result = await change.mutateAsync({ current_password: current, new_password: next });
      toast.success(
        'Password changed' + (result.revokedSessions ? ` · signed out ${result.revokedSessions} other device(s)` : ''),
      );
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to change password'));
    }
  };

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-muted-foreground" />Change password</h2>
      <p className="mt-1 text-xs text-muted-foreground">Other devices are signed out automatically; this one stays signed in.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Current password" htmlFor="current" required>
          <PasswordInput id="current" value={current} onChange={setCurrent} autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="new" required error={sameAsCurrent ? 'Must differ from your current password' : undefined}>
          <PasswordInput id="new" value={next} onChange={setNext} autoComplete="new-password" invalid={sameAsCurrent} />
          {next && (
            <div className="space-y-1 pt-1">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i < s.score ? s.color : 'bg-muted')} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {s.label}
                {next.length < 8 && ' · at least 8 characters'}
              </p>
            </div>
          )}
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" required error={mismatch ? 'Passwords do not match' : undefined}>
          <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={mismatch} />
        </Field>
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={change.isPending} disabled={!valid}>Update password</Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Sessions ─────────────────────────────────────────────

function SessionsCard() {
  const { data, isLoading, isError, error, refetch } = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const logout = useAuthStore((s) => s.logout);
  const [confirmOthers, setConfirmOthers] = useState(false);

  const others = data?.filter((s) => !s.current).length ?? 0;

  const signOut = async (session: Session) => {
    if (session.current) {
      logout();
      window.location.href = '/platform/login';
      return;
    }
    try {
      await revoke.mutateAsync(session.id);
      toast.success('Device signed out');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to sign out device'));
    }
  };

  const signOutOthers = async () => {
    try {
      const result = await revokeOthers.mutateAsync();
      toast.success(`Signed out ${result.revokedSessions} device(s)`);
      setConfirmOthers(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to sign out other devices'));
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Monitor className="h-4 w-4 text-muted-foreground" />Active sessions</h2>
          <p className="mt-1 text-xs text-muted-foreground">Devices signed in to your account.</p>
        </div>
        <Button variant="secondary" size="sm" icon={<LogOut className="h-3.5 w-3.5" />} disabled={others === 0} onClick={() => setConfirmOthers(true)}>
          Sign out others
        </Button>
      </div>

      <div className="mt-4">
        {isError ? (
          <ErrorState message={getApiErrorMessage(error, 'Could not load sessions')} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !data?.length ? (
          <EmptyState icon={<Monitor />} title="No active sessions" />
        ) : (
          <ul className="space-y-2">
            {data.map((session) => {
              const device = describeUserAgent(session.userAgent);
              const Icon = device.mobile ? Smartphone : Monitor;
              return (
                <li
                  key={session.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                    session.current ? 'border-primary/30 bg-primary-soft/50' : 'border-border',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {device.browser} on {device.os}
                      {session.current && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-white">This device</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={`Signed in ${formatDateTime(session.signedInAt)}`}>
                      {session.ipAddress ?? 'Unknown IP'} · active {formatRelative(session.lastActiveAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={revoke.isPending && revoke.variables === session.id}
                    onClick={() => signOut(session)}
                    className="text-destructive hover:bg-destructive-soft"
                  >
                    Sign out
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        busy={revokeOthers.isPending}
        title="Sign out other devices?"
        description={`${others} other device${others === 1 ? '' : 's'} will need to sign in again.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOthers(false)} disabled={revokeOthers.isPending}>Cancel</Button>
            <Button variant="danger" onClick={signOutOthers} loading={revokeOthers.isPending}>Sign out others</Button>
          </>
        }
      />
    </Card>
  );
}
