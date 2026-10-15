'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Eye, EyeOff, KeyRound, LogOut, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Ring } from '@/components/dashboard/widgets';
import { Toggle } from '@/components/super-admin/plans-ui';
import { useChangePassword, useRevokeOtherSessions, useRevokeSession, useSessions } from '@/lib/admin/queries';
import { accountKeys, useAccountOverview, useMySignIns, type AccountOverview } from '@/lib/account';
import { useUpdatePreferences } from '@/lib/company/queries';
import type { Session } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { describeUserAgent, formatDateTime, formatRelative } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

const DAY = 86_400_000;
export const daysSince = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);

/** The five things that make a Super Admin account strong (two-step sign-in comes later). */
export function securityChecks(o: AccountOverview) {
  const age = daysSince(o.user.passwordChangedAt);
  return [
    { key: 'password', ok: age !== null && age <= 180, label: 'Password changed in the last 6 months', hint: age === null ? 'Change it once to start counting' : `Changed ${age} day${age === 1 ? '' : 's'} ago` },
    { key: 'email', ok: Boolean(o.user.emailVerifiedAt), label: 'Email verified', hint: 'So reset links reach you' },
    { key: 'devices', ok: o.activeDevices <= 3, label: 'Only a few devices signed in', hint: `${o.activeDevices} signed in now` },
    { key: 'alerts', ok: o.protection.notifyNewDevice, label: 'Email me about new devices', hint: 'Below, under Protection' },
    { key: 'extra', ok: Boolean(o.protection.idleTimeoutMinutes) || o.protection.reauthForRisky, label: 'Extra protection on', hint: 'Idle sign-out or password before risky changes' },
  ];
}

function ScoreCard({ overview }: { overview: AccountOverview }) {
  const checks = securityChecks(overview);
  const done = checks.filter((c) => c.ok).length;
  const todo = checks.length - done;
  return (
    <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
      <Ring value={done} max={checks.length} size={104} stroke={10} tone={todo === 0 ? 'success' : todo <= 2 ? 'warning' : 'danger'} label={`${done} of ${checks.length} done`}>
        <span className="text-center leading-tight">
          <b className="block text-xl">{done}/{checks.length}</b>
          <span className="text-[10px] text-muted-foreground">secure</span>
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold">{todo === 0 ? 'Your account is well protected' : `Your account is fairly safe — ${todo} step${todo === 1 ? '' : 's'} to make it strong`}</p>
        <ul className="m-stagger mt-2 grid gap-x-6 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start gap-2.5 border-b border-border py-2 text-sm last:border-0">
              <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', c.ok ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>{c.ok ? <Check className="h-3 w-3" /> : '!'}</span>
              <span>
                <span className="block font-medium">{c.label}</span>
                <span className="block text-xs text-muted-foreground">{c.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, inputRef }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; inputRef?: React.Ref<HTMLInputElement> }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={inputRef} id={id} type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} invalid={invalid} onChange={(e) => onChange(e.target.value)} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const RULES: Array<{ label: string; test: (pw: string) => boolean }> = [
  { label: '12+ characters', test: (pw) => pw.length >= 12 },
  { label: 'Upper & lower case', test: (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
  { label: 'A number', test: (pw) => /\d/.test(pw) },
  { label: 'A symbol', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

/** `secure`: opened from "Wasn't you?" — focus the form and sign out every other device. */
export function PasswordCard({ changedAt, secure }: { changedAt: string | null; secure?: boolean }) {
  const change = useChangePassword();
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (secure) {
      setSignOutOthers(true);
      first.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first.current?.focus();
    }
  }, [secure]);
  const passed = useMemo(() => RULES.map((r) => r.test(next)), [next]);
  const score = passed.filter(Boolean).length;
  const mismatch = confirm.length > 0 && confirm !== next;
  const sameAsCurrent = next.length > 0 && next === current;
  // The API's own rules: 8+, upper, lower, number, symbol
  const valid = current.length > 0 && next.length >= 8 && passed[1] && passed[2] && passed[3] && confirm === next && !sameAsCurrent;
  const age = daysSince(changedAt);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      const result = await change.mutateAsync({ current_password: current, new_password: next, sign_out_others: signOutOthers });
      toast.success('Password changed' + (result.revokedSessions ? ` · signed out ${result.revokedSessions} other device${result.revokedSessions === 1 ? '' : 's'}` : ''));
      setCurrent('');
      setNext('');
      setConfirm('');
      void qc.invalidateQueries({ queryKey: accountKeys.all });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to change password'));
    }
  };

  return (
    <Card className={cn('p-5', secure && 'ring-2 ring-destructive/40')}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4 text-muted-foreground" />Password
        <span className={cn('ml-auto text-xs font-normal', age !== null && age > 180 ? 'text-warning' : 'text-muted-foreground')}>{age === null ? '' : age === 0 ? 'changed today' : `changed ${age} day${age === 1 ? '' : 's'} ago`}</span>
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <Field label="Current password" htmlFor="current" required>
          <PasswordInput inputRef={first} id="current" value={current} onChange={setCurrent} autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="new" required error={sameAsCurrent ? 'Must differ from your current password' : undefined}>
          <PasswordInput id="new" value={next} onChange={setNext} autoComplete="new-password" invalid={sameAsCurrent} />
          <div className="space-y-2 pt-1.5">
            <div className="flex gap-1">
              {RULES.map((_, i) => (
                <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i < score ? (score <= 2 ? 'bg-warning' : 'bg-success') : 'bg-muted')} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {RULES.map((r, i) => (
                <span key={r.label} className={cn('transition-colors', passed[i] ? 'text-success' : 'text-muted-foreground')}>{passed[i] ? '✓' : '○'} {r.label}</span>
              ))}
            </div>
          </div>
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" required error={mismatch ? 'Passwords do not match' : undefined}>
          <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={mismatch} />
        </Field>
        <label className="flex items-center gap-2.5 text-sm">
          <Toggle on={signOutOthers} onChange={setSignOutOthers} label="Sign out my other devices" className="scale-90" />
          Sign out my other devices after changing
        </label>
        <div className="flex justify-end">
          <Button type="submit" loading={change.isPending} disabled={!valid}>Change password</Button>
        </div>
      </form>
    </Card>
  );
}

function DevicesCard() {
  const { data, isLoading, isLoadingError, error, refetch } = useSessions();
  const signIns = useMySignIns('success');
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const logout = useAuthStore((s) => s.logout);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const others = data?.filter((s) => !s.current).length ?? 0;
  // Devices whose sign-in was flagged as a new network / device
  const newIps = new Set((signIns.data?.data ?? []).filter((s) => s.newNetwork).map((s) => s.ipAddress));

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

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Monitor className="h-4 w-4 text-muted-foreground" />Signed-in devices{data && <span className="font-normal text-muted-foreground">· {data.length}</span>}</h2>
        <Button variant="secondary" size="sm" icon={<LogOut className="h-3.5 w-3.5" />} disabled={others === 0} onClick={() => setConfirmOthers(true)} className="text-destructive">
          Sign out all others
        </Button>
      </div>
      <div className="mt-4">
        {isLoadingError ? (
          <ErrorState message={getApiErrorMessage(error, 'Could not load sessions')} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !data?.length ? (
          <EmptyState icon={<Monitor />} title="No active sessions" />
        ) : (
          <ul className="m-stagger space-y-2">
            {data.map((session) => {
              const device = describeUserAgent(session.userAgent);
              const Icon = device.mobile ? Smartphone : Monitor;
              const fresh = !session.current && newIps.has(session.ipAddress);
              return (
                <li key={session.id} className={cn('flex items-center gap-3 rounded-xl border p-3 transition-colors', session.current ? 'border-primary/30 bg-primary-soft/40' : fresh ? 'border-warning/40 bg-warning-soft/30' : 'border-border')}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {device.browser} on {device.os}
                      {session.current && <Badge tone="primary">This device</Badge>}
                      {fresh && <Badge tone="warning">New device or network</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={`Signed in ${formatDateTime(session.signedInAt)}`}>
                      {session.ipAddress ?? 'Unknown IP'} · {session.current ? 'active now' : `active ${formatRelative(session.lastActiveAt)}`} · signed in {formatRelative(session.signedInAt)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" loading={revoke.isPending && revoke.variables === session.id} onClick={() => void signOut(session)} className="text-destructive hover:bg-destructive-soft">
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
            <Button
              variant="danger"
              loading={revokeOthers.isPending}
              onClick={async () => {
                try {
                  const r = await revokeOthers.mutateAsync();
                  toast.success(`Signed out ${r.revokedSessions} device${r.revokedSessions === 1 ? '' : 's'}`);
                  setConfirmOthers(false);
                } catch (err) {
                  toast.error(getApiErrorMessage(err, 'Failed to sign out other devices'));
                }
              }}
            >
              Sign out others
            </Button>
          </>
        }
      />
    </Card>
  );
}

function ProtectionCard({ overview }: { overview: AccountOverview }) {
  const update = useUpdatePreferences();
  const qc = useQueryClient();
  const p = overview.protection;
  const save = (body: Parameters<typeof update.mutate>[0], done: string) =>
    update.mutate(body, {
      onSuccess: () => {
        toast.success(done);
        void qc.invalidateQueries({ queryKey: accountKeys.overview });
      },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')),
    });
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-muted-foreground" />Protection</h2>
      <ul className="mt-2 divide-y divide-border">
        <li className="flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Email me when a new device signs in</span>
            <span className="block text-xs text-muted-foreground">With the device and IP, so you can act if it wasn’t you</span>
          </span>
          <Toggle on={p.notifyNewDevice} disabled={update.isPending} label="New-device emails" onChange={(on) => save({ notifyNewDevice: on }, on ? 'You’ll get an email for new devices' : 'New-device emails off')} />
        </li>
        <li className="flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Sign me out after inactivity</span>
            <span className="block text-xs text-muted-foreground">On this console, after no mouse or keyboard use in any tab</span>
          </span>
          <Select
            aria-label="Idle sign-out"
            className={cn(inputClass, 'h-9 w-auto text-xs')}
            value={p.idleTimeoutMinutes ?? ''}
            disabled={update.isPending}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              save({ idleTimeoutMinutes: v }, v ? `You’ll be signed out after ${v} idle minutes` : 'Idle sign-out off');
            }}
          >
            <option value="">Never</option>
            {[15, 30, 60, 120].map((m) => <option key={m} value={m}>After {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}`}</option>)}
          </Select>
        </li>
        <li className="flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Ask for my password again</span>
            <span className="block text-xs text-muted-foreground">Before suspending a company, changing plans or features, maintenance mode and Super Admin access</span>
          </span>
          <Toggle on={p.reauthForRisky} disabled={update.isPending} label="Ask for password before risky changes" onChange={(on) => save({ reauthForRisky: on }, on ? 'Risky changes will ask for your password' : 'Password check off')} />
        </li>
      </ul>
    </Card>
  );
}

export function SecuritySection({ secure }: { secure: boolean }) {
  const o = useAccountOverview();
  if (o.isLoadingError) return <ErrorState message={getApiErrorMessage(o.error, 'Could not load your account')} onRetry={() => o.refetch()} />;
  if (!o.data) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-5">
      <ScoreCard overview={o.data} />
      <div className="grid gap-5 lg:grid-cols-2">
        <PasswordCard changedAt={o.data.user.passwordChangedAt} secure={secure} />
        <div className="space-y-5">
          <ProtectionCard overview={o.data} />
          <DevicesCard />
        </div>
      </div>
    </div>
  );
}
