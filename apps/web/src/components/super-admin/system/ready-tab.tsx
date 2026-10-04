'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Brush, Check, Download, History, Lock, Mail, RefreshCw, ShieldCheck, Unlock, Wrench } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Ring } from '@/components/dashboard/widgets';
import { Toggle } from '@/components/super-admin/plans-ui';
import {
  downloadDiagnostics,
  useCheckNow,
  useClearCaches,
  useMaintenance,
  useReadiness,
  useSaveMaintenance,
  useSignIns,
  useTimeline,
  useUnlockUser,
  type Maintenance,
} from '@/lib/admin/system';
import type { SystemStatus } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatDuration, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

function ReadinessCard() {
  const r = useReadiness();
  const d = r.data;
  const todo = d ? d.total - d.done : 0;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Ready for real users?
        <span className="ml-auto text-xs font-normal text-muted-foreground">from this server’s settings — values are never shown</span>
      </h2>
      {!d ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <div className="flex items-center gap-5">
            <Ring value={d.done} max={d.total} size={104} stroke={10} tone={todo === 0 ? 'success' : d.checks.some((c) => !c.ok && c.level === 'bad') ? 'danger' : 'warning'} label={`${d.done} of ${d.total} done`}>
              <span className="text-center leading-tight">
                <b className="block text-xl">{d.done}/{d.total}</b>
                <span className="text-[10px] text-muted-foreground">done</span>
              </span>
            </Ring>
            <div>
              <p className="text-base font-bold">{todo === 0 ? 'Ready to go live' : `Almost there — ${todo} thing${todo === 1 ? '' : 's'} before going live`}</p>
              <p className="mt-1 text-xs text-muted-foreground">{todo === 0 ? 'Everything we can check from here looks right.' : 'Fine for testing. Fix these before inviting real companies.'}</p>
            </div>
          </div>
          <ul className="m-stagger divide-y divide-border">
            {[...d.checks].sort((a, b) => Number(a.ok) - Number(b.ok)).map((c) => (
              <li key={c.key} className="flex items-start gap-3 py-2.5 text-sm">
                <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', c.ok ? 'bg-success-soft text-success' : c.level === 'bad' ? 'bg-destructive-soft text-destructive' : 'bg-warning-soft text-warning')}>
                  {c.ok ? <Check className="h-3 w-3" /> : '!'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.title}</span>
                  <span className={cn('block text-xs', c.ok ? 'text-muted-foreground' : 'text-foreground/80')}>{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function MaintenanceCard() {
  const m = useMaintenance();
  const save = useSaveMaintenance();
  const [draft, setDraft] = useState<Maintenance | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (m.data) setDraft(m.data);
  }, [m.data]);
  if (!draft || !m.data) return <Skeleton className="h-72" />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(m.data);

  const persist = async (body: Partial<Maintenance>, done: string) => {
    try {
      const r = await save.mutateAsync(body);
      setDraft(r);
      toast.success(done);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Card className={cn('flex flex-col gap-4 p-5', m.data.enabled && 'border-warning/50')}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Wrench className="h-4 w-4 text-muted-foreground" /> Maintenance mode
        <Badge tone={m.data.enabled ? 'warning' : 'neutral'} dot className="ml-auto">{m.data.enabled ? 'On — company users paused' : 'Off'}</Badge>
      </h2>
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Pause the portal for every company</span>
          <span className="block text-xs text-muted-foreground">Company users see the notice below instead of the app, and it comes back on its own when you switch this off. Super Admins can still sign in.</span>
        </span>
        <Toggle
          on={m.data.enabled}
          label="Maintenance mode"
          disabled={save.isPending}
          onChange={(on) => (on ? setConfirming(true) : void persist({ enabled: false }, 'Maintenance mode off — everyone is back'))}
        />
      </div>

      <div className="rounded-lg border border-warning/30 bg-warning-soft/50 px-3 py-2 text-xs" aria-label="Preview">
        <b className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-warning" /> {draft.title || 'Scheduled maintenance'}</b>
        <span className="mt-0.5 block text-muted-foreground">{draft.message}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="mt-title">
          <Input id="mt-title" value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="Planned window" htmlFor="mt-start" hint="Optional — shown in the notice">
          <div className="flex gap-2">
            <Input id="mt-start" type="datetime-local" value={toLocal(draft.startsAt)} onChange={(e) => setDraft({ ...draft, startsAt: fromLocal(e.target.value) })} aria-label="Starts" />
            <Input type="datetime-local" value={toLocal(draft.endsAt)} onChange={(e) => setDraft({ ...draft, endsAt: fromLocal(e.target.value) })} aria-label="Ends" />
          </div>
        </Field>
      </div>
      <Field label="Message" htmlFor="mt-msg">
        <Textarea id="mt-msg" rows={2} value={draft.message} maxLength={400} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={draft.announce} onChange={(e) => setDraft({ ...draft, announce: e.target.checked })} disabled={!draft.startsAt} />
        <span>
          Show the notice to company users ahead of time
          <span className="block text-xs text-muted-foreground">{draft.startsAt ? 'A small banner at the top of their portal until the window ends.' : 'Set a start time first.'}</span>
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setDraft(m.data!)}>Discard</Button>
        <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => void persist({ title: draft.title, message: draft.message, startsAt: draft.startsAt, endsAt: draft.endsAt, announce: draft.announce && Boolean(draft.startsAt) }, 'Notice saved')}>
          Save notice
        </Button>
      </div>

      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        isDanger
        isLoading={save.isPending}
        title="Pause the portal for every company?"
        description="Everyone except Super Admins sees the maintenance notice until you switch it off. Unsaved notice changes are saved too."
        confirmText="Turn on maintenance"
        onConfirm={async () => {
          await persist({ ...draft, enabled: true }, 'Maintenance mode on');
          setConfirming(false);
        }}
      />
    </Card>
  );
}

function SignInsCard() {
  const s = useSignIns();
  const unlock = useUnlockUser();
  const d = s.data;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="h-4 w-4 text-muted-foreground" /> Sign-in safety
        <span className="ml-auto text-xs font-normal text-muted-foreground">last 24 hours</span>
      </h2>
      {!d ? (
        <Skeleton className="h-32" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['Signed in', d.successful, ''],
              ['Wrong passwords', d.failed, d.failed ? 'text-warning' : ''],
              ['Locked now', d.locked.length, d.locked.length ? 'text-destructive' : ''],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border border-border bg-muted/30 p-2.5">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className={cn('text-lg font-bold tabular-nums', tone)}>{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
          {d.locked.length ? (
            <ul className="divide-y divide-border">
              {d.locked.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u.email}</span>
                    <span className="block text-xs text-muted-foreground">{u.company?.name ?? 'Platform'} · {u.loginAttempts} wrong passwords · unlocks {formatRelative(u.lockedUntil)}</span>
                  </span>
                  <Button size="sm" variant="secondary" loading={unlock.isPending && unlock.variables === u.id} onClick={() => unlock.mutate(u.id, { onSuccess: () => toast.success(`${u.email} can sign in again`), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not unlock')) })}>
                    <Unlock /> Unlock
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No locked accounts. An account locks for 15 minutes after 5 wrong passwords.</p>
          )}
        </>
      )}
    </Card>
  );
}

function ToolsCard({ onRefresh }: { onRefresh: () => void }) {
  const check = useCheckNow();
  const clear = useClearCaches();
  const [downloading, setDownloading] = useState(false);
  const tools = [
    {
      icon: <RefreshCw />,
      title: 'Run all health checks now',
      text: 'Database, email, Redis and search — saved to the history',
      action: 'Run',
      busy: check.isPending,
      run: () => check.mutate(undefined, { onSuccess: (r) => { toast.success(r.ok ? 'All checks passed' : 'Some checks failed — see Health & speed'); onRefresh(); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Checks failed')) }),
    },
    {
      icon: <Brush />,
      title: 'Clear access caches',
      text: 'If a plan, role or feature change doesn’t show up straight away',
      action: 'Clear',
      busy: clear.isPending,
      run: () => clear.mutate(undefined, { onSuccess: () => toast.success('Caches cleared — changes apply on the next click'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not clear')) }),
    },
    {
      icon: <Mail />,
      title: 'Send a test email',
      text: 'Check delivery to any address',
      action: 'Open',
      busy: false,
      run: () => window.dispatchEvent(new CustomEvent('system:open-tab', { detail: 'data' })),
    },
    {
      icon: <Download />,
      title: 'Download diagnostics',
      text: 'Versions, settings (no secrets) and recent errors — for support',
      action: 'Download',
      busy: downloading,
      run: async () => {
        setDownloading(true);
        try {
          await downloadDiagnostics();
        } catch (e) {
          toast.error(getApiErrorMessage(e, 'Could not build diagnostics'));
        } finally {
          setDownloading(false);
        }
      },
    },
  ];
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4 text-muted-foreground" /> Tools</h2>
      <ul className="m-stagger space-y-2">
        {tools.map((t) => (
          <li key={t.title} className="m-lift flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground [&>svg]:h-4 [&>svg]:w-4">{t.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t.title}</span>
              <span className="block text-xs text-muted-foreground">{t.text}</span>
            </span>
            <Button size="sm" variant="secondary" loading={t.busy} onClick={() => void t.run()}>{t.action}</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const DOT: Record<string, string> = {
  incident: 'bg-destructive',
  incident_open: 'bg-destructive animate-pulse',
  started: 'bg-info',
  updated: 'bg-primary',
  maintenance_on: 'bg-warning',
  maintenance_off: 'bg-success',
  caches_cleared: 'bg-muted-foreground',
};

function TimelineCard({ system }: { system?: SystemStatus }) {
  const t = useTimeline();
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" /> Incidents &amp; changes
        <span className="ml-auto text-xs font-normal text-muted-foreground">last 30 days</span>
      </h2>
      {!t.data ? (
        <Skeleton className="h-48" />
      ) : t.data.length ? (
        <ol className="m-stagger max-h-[340px] space-y-3 overflow-y-auto pr-1">
          {t.data.map((e) => (
            <li key={`${e.at}-${e.kind}-${e.title}`} className="flex gap-3 text-sm">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface', DOT[e.kind] ?? 'bg-muted-foreground')} />
              <span className="min-w-0">
                <span className="block font-semibold">{e.title}</span>
                <span className="block text-xs text-muted-foreground">{e.detail ? `${e.detail} · ` : ''}{formatDateTime(e.at)}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">Nothing yet — outages, updates and maintenance show up here.</p>
      )}
      {system && (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          API v{system.api.version} · Node {system.api.nodeVersion} · {system.api.environment} · up {formatDuration(system.api.uptimeSeconds)}
        </p>
      )}
    </Card>
  );
}

export function ReadyTab({ system, onRefresh }: { system?: SystemStatus; onRefresh: () => void }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <ReadinessCard />
        <div className="space-y-5">
          <MaintenanceCard />
          <SignInsCard />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ToolsCard onRefresh={onRefresh} />
        <TimelineCard system={system} />
      </div>
    </div>
  );
}
