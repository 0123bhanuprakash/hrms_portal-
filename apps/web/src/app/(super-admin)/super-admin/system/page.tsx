'use client';

import React from 'react';
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
import { useOpenQueueDashboard, useSystemStatus } from '@/lib/admin/queries';
import type { ServiceName, ServiceState } from '@/lib/admin/types';
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
  ok: { label: 'Operational', icon: <CheckCircle2 />, tone: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-300 dark:border-emerald-800' },
  error: { label: 'Unavailable', icon: <XCircle />, tone: 'text-red-600 dark:text-red-400', ring: 'border-red-300 dark:border-red-800' },
  disabled: { label: 'Not configured', icon: <CircleSlash />, tone: 'text-slate-500 dark:text-slate-400', ring: 'border-slate-200 dark:border-slate-800' },
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
          <h1 className="text-2xl font-bold tracking-tight">System</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Live health of platform services and how this deployment is configured.</p>
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
              !data ? 'border-slate-200 dark:border-slate-800' : healthy ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-500/10' : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-500/10',
            )}
          >
            <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', healthy ? 'bg-emerald-500 text-white' : data ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-800')}>
              {healthy ? <CheckCircle2 className="h-6 w-6" /> : data ? <XCircle className="h-6 w-6" /> : <Activity className="h-6 w-6 animate-pulse" />}
            </span>
            <div className="flex-1">
              <p className="text-base font-semibold">
                {!data ? 'Checking services…' : healthy ? 'All systems operational' : 'Some services are unavailable'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
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
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 [&>svg]:h-5 [&>svg]:w-5">{meta.icon}</span>
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
                    <p className="text-xs text-slate-500 dark:text-slate-400">{meta.purpose}</p>
                    <div className="mt-4 flex items-end justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                      {latency !== undefined ? (
                        <span className="text-xs text-slate-500">
                          Response <b className={cn('tabular-nums', latency > 500 ? 'text-amber-600' : 'text-slate-800 dark:text-slate-200')}>{latency} ms</b>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">{state === 'disabled' ? meta.enableHint : '—'}</span>
                      )}
                    </div>
                    {state === 'error' && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{meta.enableHint}</p>}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Configuration */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><ServerCog className="h-4 w-4 text-slate-400" />Configuration</h2>
              {!data ? (
                <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : (
                <ul className="space-y-3">
                  <ConfigRow
                    icon={<Mail />}
                    label="Email delivery"
                    value={data.email.provider}
                    note={data.email.provider === 'console' ? 'Emails are printed in the API terminal and saved to apps/api/.mail/' : data.email.provider === 'resend' ? 'Sent via Resend' : 'Sent via SMTP'}
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
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Cpu className="h-4 w-4 text-slate-400" />API server</h2>
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
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                    <p className="text-sm font-medium">Queue dashboard</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
        </>
      )}
    </div>
  );
}

function ConfigRow({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center justify-between gap-2 text-sm font-medium">
          {label}
          <code className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">{value}</code>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
