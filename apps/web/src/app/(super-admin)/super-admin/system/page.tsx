'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  CheckCircle2,
  CircleSlash,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  Mail,
  RefreshCw,
  Search,
  ServerCog,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { useOpenQueueDashboard, useSendTestEmail, useSystemStatus } from '@/lib/admin/queries';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/field';
import type { ServiceName, ServiceState, SystemStatus } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDuration, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const SERVICES: Record<ServiceName, { label: string; icon: React.ReactNode; purpose: string; enableHint: string }> = {
  database: {
    label: 'PostgreSQL',
    icon: <Database />,
    purpose: 'Primary data store (Supabase)',
    enableHint: 'Required — check DATABASE_URL in apps/api/.env.',
  },
  redis: {
    label: 'Redis',
    icon: <Zap />,
    purpose: 'Email queue with retries + Bull Board',
    enableHint: 'Optional — set REDIS_URL (e.g. Upstash) to enable. Without it emails are sent inline.',
  },
  elasticsearch: {
    label: 'Elasticsearch',
    icon: <Search />,
    purpose: 'Full-text search (Phase 2+)',
    enableHint: 'Optional — set ELASTICSEARCH_URL when search is introduced.',
  },
};

const STATE_STYLE: Record<ServiceState, { label: string; icon: React.ReactNode; tone: string; ring: string }> = {
  ok: { label: 'Operational', icon: <CheckCircle2 />, tone: 'text-success', ring: 'border-success/40' },
  error: { label: 'Unavailable', icon: <XCircle />, tone: 'text-destructive', ring: 'border-destructive/40' },
  disabled: { label: 'Not configured', icon: <CircleSlash />, tone: 'text-muted-foreground', ring: 'border-border' },
};

export default function SystemPage() {
  const { data, isError, error, refetch, isFetching } = useSystemStatus({ refetchInterval: 15_000 });
  const openQueue = useOpenQueueDashboard();

  const openBullBoard = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';
    const tab = window.open('about:blank', '_blank');
    try {
      await openQueue.mutateAsync();
      if (tab) tab.location.href = `${apiUrl}/admin/queues/`;
    } catch (err) {
      tab?.close();
      toast.error(getApiErrorMessage(err, 'Queue dashboard is unavailable'));
    }
  };

  const healthy = data?.health.status === 'ok';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System</h1>
          <p className="text-sm text-muted-foreground">Live health of platform services and how this deployment is configured.</p>
        </div>
        <Button variant="secondary" icon={<RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />} onClick={() => refetch()} disabled={isFetching}>
          Refresh
        </Button>
      </div>

      {isError ? (
        <Card>
          <ErrorState message={getApiErrorMessage(error, 'Could not reach the API')} onRetry={() => refetch()} />
        </Card>
      ) : (
        <>
          {/* Overall banner */}
          <div
            className={cn(
              'flex items-center gap-4 rounded-2xl border p-5 transition-colors',
              !data ? 'border-border' : healthy ? 'border-success/30 bg-success-soft' : 'border-destructive/30 bg-destructive-soft',
            )}
          >
            <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', healthy ? 'bg-success text-white' : data ? 'bg-destructive text-white' : 'bg-muted')}>
              {healthy ? <CheckCircle2 className="h-6 w-6" /> : data ? <XCircle className="h-6 w-6" /> : <Activity className="h-6 w-6 animate-pulse" />}
            </span>
            <div className="flex-1">
              <p className="text-base font-semibold">
                {!data ? 'Checking services…' : healthy ? 'All systems operational' : 'Some services are unavailable'}
              </p>
              <p className="text-xs text-muted-foreground">
                {data ? `Last checked ${formatRelative(data.health.checkedAt)} · auto-refreshes every 15 seconds` : 'Running health checks'}
              </p>
            </div>
          </div>

          {/* Service cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(SERVICES) as ServiceName[]).map((name, i) => {
              const meta = SERVICES[name];
              const state = data?.health.services[name];
              const style = state ? STATE_STYLE[state] : null;
              const latency = data?.health.latencyMs[name];
              return (
                <Card key={name} className={cn('p-5 border-2 transition-colors animate-fade-up', style?.ring)}>
                  <div style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="flex items-start justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">{meta.icon}</span>
                      {style ? (
                        <span className={cn('flex items-center gap-1.5 text-xs font-semibold [&>svg]:h-4 [&>svg]:w-4', style.tone)}>
                          {style.icon}
                          {style.label}
                        </span>
                      ) : (
                        <Skeleton className="h-4 w-20" />
                      )}
                    </div>
                    <h3 className="mt-4 font-semibold">{meta.label}</h3>
                    <p className="text-xs text-muted-foreground">{meta.purpose}</p>
                    <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                      {latency !== undefined ? (
                        <span className="text-xs text-muted-foreground">
                          Response <b className={cn('tabular-nums', latency > 500 ? 'text-warning' : 'text-foreground')}>{latency} ms</b>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{state === 'disabled' ? meta.enableHint : '—'}</span>
                      )}
                    </div>
                    {state === 'error' && <p className="mt-2 text-xs text-destructive">{meta.enableHint}</p>}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Configuration */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><ServerCog className="h-4 w-4 text-muted-foreground" />Configuration</h2>
              {!data ? (
                <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : (
                <ul className="space-y-3">
                  <ConfigRow
                    icon={<Mail />}
                    label="Email delivery"
                    value={data.email.provider}
                    note={data.email.provider === 'console' ? 'Emails are printed in the API terminal and saved to apps/api/.mail/' : data.email.provider === 'resend' ? 'Sent via Resend' : data.email.provider === 'gmail' ? 'Sent via Gmail SMTP' : 'Sent via SMTP'}
                  />
                  <ConfigRow
                    icon={<HardDrive />}
                    label="File storage"
                    value={data.storage.driver}
                    note={data.storage.driver === 'local' ? 'Uploads saved on the API server disk (apps/api/uploads)' : 'Uploads stored in S3-compatible object storage'}
                  />
                  <ConfigRow icon={<Zap />} label="Background queue" value={data.queue.enabled ? 'BullMQ' : 'inline'} note={data.queue.enabled ? 'Emails retried up to 5 times' : 'No Redis — emails sent during the request'} />
                  <ConfigRow icon={<Search />} label="Search" value={data.search.enabled ? 'Elasticsearch' : 'off'} note="Used from Phase 2" />
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Cpu className="h-4 w-4 text-muted-foreground" />API server</h2>
              {!data ? (
                <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-4">
                    <Stat label="Environment" value={data.api.environment} />
                    <Stat label="Uptime" value={formatDuration(data.api.uptimeSeconds)} />
                    <Stat label="API version" value={`v${data.api.version}`} />
                    <Stat label="Node.js" value={data.api.nodeVersion} />
                  </dl>
                  <div className="mt-5 rounded-xl border border-dashed border-input p-4">
                    <p className="text-sm font-medium">Queue dashboard</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.queue.enabled ? 'Inspect, retry or clean background jobs in Bull Board.' : 'Available once REDIS_URL is configured.'}
                    </p>
                    <Button className="mt-3" size="sm" variant="secondary" disabled={!data.queue.enabled} loading={openQueue.isPending} icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={openBullBoard}>
                      Open Bull Board
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>

          {data && <EmailDeliveryCard email={data.email} />}
        </>
      )}
    </div>
  );
}

const EMAIL_STATE: Record<SystemStatus['email']['state'], { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  ok: { label: 'Connected', tone: 'success' },
  error: { label: 'Not working', tone: 'danger' },
  unverified: { label: 'Not checked yet', tone: 'warning' },
  disabled: { label: 'Not sending', tone: 'neutral' },
};

/** Live email delivery status + a "send test email" form. */
function EmailDeliveryCard({ email }: { email: SystemStatus['email'] }) {
  const sendTest = useSendTestEmail();
  const [to, setTo] = useState('');
  const state = EMAIL_STATE[email.state];
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      const result = await sendTest.mutateAsync(to.trim());
      toast.success(result.message);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Test email failed'));
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4 text-muted-foreground" /> Email delivery
            <Badge tone={state.tone} dot>{state.label}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">{email.detail}</p>
          <p className="text-xs text-muted-foreground">
            Provider <code>{email.provider}</code>
            {email.from && <> · From <code>{email.from}</code></>}
            {email.checkedAt && <> · checked {formatRelative(email.checkedAt)}</>}
          </p>
        </div>
        {email.provider !== 'console' && (
          <form onSubmit={submit} className="flex w-full max-w-md gap-2">
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
              aria-label="Send test email to"
            />
            <Button type="submit" variant="secondary" loading={sendTest.isPending} disabled={!valid}>
              Send test email
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}

function ConfigRow({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center justify-between gap-2 text-sm font-medium">
          {label}
          <code className="rounded-md bg-primary-soft px-2 py-0.5 text-xs text-primary-soft-foreground">{value}</code>
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
