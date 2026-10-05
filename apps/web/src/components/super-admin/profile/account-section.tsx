'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Building2, Camera, FileText, History, Layers, Mail, Palette, Pencil, ShieldCheck, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Ring } from '@/components/dashboard/widgets';
import {
  useAccountOverview,
  useCancelEmailChange,
  useRecentActions,
  useRemoveAvatar,
  useRequestEmailChange,
  useUpdateName,
  useUploadAvatar,
  type AccountOverview,
} from '@/lib/account';
import { usePreferences, useUpdatePreferences } from '@/lib/company/queries';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatRelative, humanizeAction, initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { daysSince, securityChecks } from './security-section';

const COVERS = {
  gold: 'radial-gradient(120% 140% at 0% 0%, #F7D79A 0%, #E9B45A 35%, #B7791F 70%, #7A4B0B 100%)',
  dusk: 'linear-gradient(120deg, #3B2667 0%, #BC78EC 55%, #F5B9A6 100%)',
  ocean: 'linear-gradient(120deg, #0F4C81 0%, #1D8FBF 50%, #7DD3D8 100%)',
  forest: 'linear-gradient(120deg, #14532D 0%, #2F8F5B 55%, #A7D8A0 100%)',
  slate: 'linear-gradient(120deg, #1F2937 0%, #4B5563 60%, #9CA3AF 100%)',
} as const;
type Cover = keyof typeof COVERS;
const isCover = (v: unknown): v is Cover => typeof v === 'string' && v in COVERS;

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', example: '31/12/2026' },
  { value: 'MM/DD/YYYY', example: '12/31/2026' },
  { value: 'YYYY-MM-DD', example: '2026-12-31' },
];

function Hero({ o }: { o: AccountOverview }) {
  const [cover, setCover] = useUiState<Cover>('profile:cover', 'gold', isCover);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const file = useRef<HTMLInputElement>(null);
  const checks = securityChecks(o);
  const done = checks.filter((c) => c.ok).length;
  const name = `${o.user.firstName} ${o.user.lastName}`;
  const age = daysSince(o.user.passwordChangedAt);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      await upload.mutateAsync(f);
      toast.success('Photo updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not upload the photo'));
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="m-shine relative h-28" style={{ background: COVERS[cover] }}>
        <span className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(255,255,255,.08)_0_2px,transparent_2px_14px)]" aria-hidden />
        <div className="absolute right-3 top-3">
          <DropdownMenu
            label="Cover"
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} className="flex items-center gap-1.5 rounded-lg bg-white/85 px-2.5 py-1.5 text-xs font-semibold text-stone-900 shadow-sm hover:bg-white">
                <Palette className="h-3.5 w-3.5" /> Cover
              </button>
            )}
            items={(Object.keys(COVERS) as Cover[]).map((c) => ({ label: c[0]!.toUpperCase() + c.slice(1), onSelect: () => setCover(c) }))}
          />
        </div>
      </div>
      <div className="relative -mt-11 flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end">
        <div className="relative shrink-0">
          {o.user.avatarUrl ? (
            <img src={o.user.avatarUrl} alt={name} className="h-24 w-24 rounded-3xl border-4 border-surface object-cover shadow-lg" />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-surface bg-gradient-to-br from-stone-900 to-stone-600 text-3xl font-extrabold text-amber-200 shadow-lg">{initials(name)}</span>
          )}
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          <DropdownMenu
            label="Photo"
            align="left"
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} aria-label="Change photo" className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface shadow-sm hover:bg-subtle">
                {upload.isPending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Camera className="h-4 w-4" />}
              </button>
            )}
            items={[
              { label: 'Upload a photo', icon: <Camera />, hint: 'JPG, PNG or WebP · up to 2 MB', onSelect: () => file.current?.click() },
              ...(o.user.avatarUrl ? [{ label: 'Remove photo', icon: <Trash2 />, danger: true, onSelect: () => remove.mutate(undefined, { onSuccess: () => toast.success('Photo removed') }) }] : []),
            ]}
          />
        </div>
        <div className="min-w-0 flex-1 sm:pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{name}</h2>
            <Badge tone="primary"><ShieldCheck className="h-3 w-3" /> Super Admin</Badge>
            <Badge tone="success" dot>Active now</Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{o.user.email}</p>
        </div>
        <Link href="/super-admin/profile?section=security" className="m-lift flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 sm:mb-1">
          <Ring value={done} max={checks.length} size={56} stroke={6} tone={done === checks.length ? 'success' : 'warning'} label={`Security ${done} of ${checks.length}`}>
            <b className="text-xs">{done}/{checks.length}</b>
          </Ring>
          <span>
            <b className="block text-sm">Security score</b>
            <span className="block text-xs text-muted-foreground">{done === checks.length ? 'All done' : `${checks.length - done} thing${checks.length - done === 1 ? '' : 's'} to do`}</span>
            <span className="text-xs font-semibold text-primary">Improve →</span>
          </span>
        </Link>
      </div>
      <dl className="grid grid-cols-2 border-t border-border lg:grid-cols-4">
        {[
          ['Member since', formatDate(o.user.createdAt), null],
          ['Last sign-in', o.lastSignIn ? formatRelative(o.lastSignIn.at) : '—', o.lastSignIn ? `${o.lastSignIn.device}${o.lastSignIn.ipAddress ? ` · ${o.lastSignIn.ipAddress}` : ''}` : null],
          ['Password changed', age === null ? '—' : age === 0 ? 'Today' : `${age} day${age === 1 ? '' : 's'} ago`, null],
          ['Your actions · 30 days', o.actions30d.toLocaleString(), o.companiesTouched30d ? `across ${o.companiesTouched30d} compan${o.companiesTouched30d === 1 ? 'y' : 'ies'}` : null],
        ].map(([label, value, sub], i) => (
          <div key={String(label)} className={cn('px-5 py-3.5', i % 2 === 0 && 'border-r border-border', i < 2 && 'border-b border-border lg:border-b-0', i === 1 && 'lg:border-r')}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-bold">{value}</dd>
            {sub && <dd className="truncate text-xs text-muted-foreground">{sub}</dd>}
          </div>
        ))}
      </dl>
    </Card>
  );
}

function DetailsCard({ o }: { o: AccountOverview }) {
  const updateName = useUpdateName();
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  const cancel = useCancelEmailChange();
  const [first, setFirst] = useState(o.user.firstName);
  const [last, setLast] = useState(o.user.lastName);
  const [changing, setChanging] = useState(false);
  useEffect(() => {
    setFirst(o.user.firstName);
    setLast(o.user.lastName);
  }, [o.user.firstName, o.user.lastName]);
  const dirty = first.trim() !== o.user.firstName || last.trim() !== o.user.lastName;

  return (
    <Card className="space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Pencil className="h-4 w-4 text-muted-foreground" /> Your details
        <span className="ml-auto text-xs font-normal text-muted-foreground">used in emails and the audit log</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" htmlFor="first"><Input id="first" value={first} maxLength={60} onChange={(e) => setFirst(e.target.value)} /></Field>
        <Field label="Last name" htmlFor="last"><Input id="last" value={last} maxLength={60} onChange={(e) => setLast(e.target.value)} /></Field>
      </div>
      <Field label="Email" htmlFor="email-ro" hint="To change it we send a link to the new address first.">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span id="email-ro" className="min-w-0 flex-1 truncate">{o.user.email}</span>
          {o.user.emailVerifiedAt && <Badge tone="success">Verified</Badge>}
          <Button size="sm" variant="secondary" onClick={() => setChanging(true)}>Change</Button>
        </div>
      </Field>
      {o.pendingEmail && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-info/30 bg-info-soft/40 px-3 py-2 text-xs">
          <Mail className="h-3.5 w-3.5 text-info" />
          <span className="flex-1">Waiting for you to open the link sent to <b>{o.pendingEmail.email}</b> (until {formatDateTime(o.pendingEmail.expiresAt)}).</span>
          <button type="button" className="font-semibold text-muted-foreground hover:text-foreground" onClick={() => cancel.mutate(undefined, { onSuccess: () => toast.success('Email change cancelled') })}>Cancel</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Time zone" htmlFor="tz">
          <select id="tz" className={inputClass} value={prefs.data?.timezone ?? 'Asia/Kolkata'} onChange={(e) => updatePrefs.mutate({ timezone: e.target.value }, { onSuccess: () => toast.success('Time zone saved') })}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Date format" htmlFor="df">
          <select id="df" className={inputClass} value={prefs.data?.dateFormat ?? 'DD/MM/YYYY'} onChange={(e) => updatePrefs.mutate({ dateFormat: e.target.value }, { onSuccess: () => toast.success('Date format saved') })}>
            {DATE_FORMATS.map((d) => <option key={d.value} value={d.value}>{d.example}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={!dirty} onClick={() => { setFirst(o.user.firstName); setLast(o.user.lastName); }}>Discard</Button>
        <Button
          disabled={!dirty || !first.trim() || !last.trim()}
          loading={updateName.isPending}
          onClick={() => updateName.mutate({ firstName: first.trim(), lastName: last.trim() }, { onSuccess: () => toast.success('Name saved'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')) })}
        >
          Save
        </Button>
      </div>
      {changing && <EmailChangeModal current={o.user.email} onClose={() => setChanging(false)} />}
    </Card>
  );
}

function EmailChangeModal({ current, onClose }: { current: string; onClose: () => void }) {
  const request = useRequestEmailChange();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.toLowerCase() !== current && password.length > 0;
  return (
    <Modal
      open
      onClose={onClose}
      busy={request.isPending}
      icon={<Mail />}
      title="Change your email"
      description="We send a link to the new address. Your email changes when you open it, and every device is signed out."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={request.isPending}>Cancel</Button>
          <Button
            disabled={!valid}
            loading={request.isPending}
            onClick={() =>
              request.mutate(
                { email: email.trim(), password },
                {
                  onSuccess: (r) => {
                    toast.success(`Link sent to ${r.pendingEmail} — open it to finish`);
                    onClose();
                  },
                  onError: (e) => toast.error(getApiErrorMessage(e, 'Could not start the change')),
                },
              )
            }
          >
            Send link
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="New email" htmlFor="new-email"><Input id="new-email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Your password" htmlFor="email-pw" hint="To be sure it’s you"><Input id="email-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

const AREA: Array<[RegExp, React.ReactNode, string]> = [
  [/^company|^companies|^admin:company/, <Building2 key="b" />, 'bg-info-soft text-info'],
  [/^plan/, <Layers key="l" />, 'bg-primary-soft text-primary-soft-foreground'],
  [/^system/, <Wrench key="w" />, 'bg-warning-soft text-warning'],
  [/^theme/, <Palette key="p" />, 'bg-success-soft text-success'],
  [/^platform|^user|^auth/, <ShieldCheck key="s" />, 'bg-muted text-muted-foreground'],
];

function RecentActionsCard() {
  const actions = useRecentActions();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" /> Your recent actions
        <Link href="/super-admin/audit-logs" className="ml-auto text-xs font-semibold text-primary hover:underline">Audit log →</Link>
      </h2>
      {!actions.data ? (
        <Skeleton className="h-48" />
      ) : actions.data.length ? (
        <ul className="m-stagger divide-y divide-border">
          {actions.data.map((a) => {
            const [, icon, tone] = AREA.find(([re]) => re.test(a.action)) ?? [null, <FileText key="f" />, 'bg-muted text-muted-foreground'];
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4', tone)}>{icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{humanizeAction(a.action)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.company?.name ?? 'Platform'} · {formatRelative(a.createdAt)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">Nothing yet — changes you make show up here.</p>
      )}
    </Card>
  );
}

export function AccountSection() {
  const o = useAccountOverview();
  if (o.isError) return <ErrorState message={getApiErrorMessage(o.error, 'Could not load your account')} onRetry={() => o.refetch()} />;
  if (!o.data) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-5">
      <Hero o={o.data} />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <DetailsCard o={o.data} />
        <RecentActionsCard />
      </div>
    </div>
  );
}
