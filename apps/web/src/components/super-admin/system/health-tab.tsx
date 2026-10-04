'use client';

import React from 'react';
import { toast } from 'sonner';
import { Activity, AlertTriangle, CheckCircle2, Clock, Copy, Database, Mail, Search, XCircle, Zap } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/motion/motion';
import { Spark } from '@/components/super-admin/company-insights';
import { useHealthHistory, useTraffic, type HealthHistory, type ServiceKey, type Traffic } from '@/lib/admin/system';
import type { SystemStatus } from '@/lib/admin/types';
import { formatDateTime, formatDuration, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export function copyText(text: string, done = 'Copied') {
  void navigator.clipboard?.writeText(text).then(
    () => toast.success(done),
    () => toast.error('Could not copy'),
  );
}

const SERVICES: Record<ServiceKey, { label: string; purpose: string; icon: React.ReactNode; setting?: string; how?: string }> = {
  database: { label: 'Database', purpose: 'PostgreSQL · all data', icon: <Database /> },
  email: { label: 'Email', purpose: 'Invites, resets and alerts', icon: <Mail />, setting: 'EMAIL_PROVIDER=smtp', how: 'Set EMAIL_PROVIDER (smtp, gmail or resend) and its settings so people receive emails.' },
  redis: { label: 'Redis', purpose: 'Email queue & retries', icon: <Zap />, setting: 'REDIS_URL=redis://…', how: 'Add REDIS_URL to retry failed emails in the background and share caches between servers.' },
  elasticsearch: { label: 'Search', purpose: 'Elasticsearch', icon: <Search />, setting: 'ELASTICSEARCH_URL=http://…', how: 'Optional. Add ELASTICSEARCH_URL for fast people search in big companies.' },
};

type State = 'ok' | 'error' | 'disabled' | 'unverified';
const STATE: Record<State, { label: string; tone: 'success' | 'danger' | 'neutral' | 'warning' }> = {
  ok: { label: 'Operational', tone: 'success' },
  error: { label: 'Not working', tone: 'danger' },
  disabled: { label: 'Not set up', tone: 'neutral' },
  unverified: { label: 'Not checked yet', tone: 'warning' },
};

function stateOf(system: SystemStatus | undefined, key: ServiceKey): State | undefined {
  if (!system) return undefined;
  if (key === 'email') return system.email.state;
  return system.health.services[key];
}

/** One bar per day: green = no failed checks, amber = a few, red = more, grey = no data yet. */
function UptimeBars({ days }: { days: HealthHistory['days'] }) {
  return (
    <div className="flex h-8 items-end gap-[2px]" role="img" aria-label="Uptime for the last 90 days">
      {days.map((d) => (
        <i
          key={d.day}
          title={d.uptime === null ? `${d.day}: no checks` : `${d.day}: ${d.uptime}% of ${d.checks} checks passed`}
          className={cn(
            'block h-full flex-1 rounded-[2px] transition-transform hover:scale-y-110',
            d.uptime === null ? 'bg-muted' : d.uptime === 100 ? 'bg-success' : d.uptime >= 95 ? 'bg-warning' : 'bg-destructive',
          )}
        />
      ))}
    </div>
  );
}

function Hero({ system, history }: { system?: SystemStatus; history?: HealthHistory }) {
  const healthy = system ? system.health.status === 'ok' && system.email.state !== 'error' : null;
  const quietDays = history?.lastProblem ? Math.floor((Date.now() - new Date(history.lastProblem).getTime()) / 86_400_000) : null;
  return (
    <div
      className={cn(
        'relative flex flex-col gap-5 overflow-hidden rounded-2xl border p-5 sm:flex-row sm:items-center',
        healthy === null ? 'border-border bg-surface' : healthy ? 'border-success/30 bg-gradient-to-br from-success-soft to-surface' : 'border-destructive/30 bg-gradient-to-br from-destructive-soft to-surface',
      )}
    >
      <span className={cn('relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white', healthy === null ? 'bg-muted' : healthy ? 'bg-success' : 'bg-destructive')}>
        {healthy && <span className="absolute -inset-1.5 animate-ping rounded-[20px] border-2 border-success/50 [animation-duration:2.4s]" aria-hidden />}
        {healthy === null ? <Activity className="h-7 w-7 animate-pulse text-muted-foreground" /> : healthy ? <CheckCircle2 className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">{healthy === null ? 'Checking services…' : healthy ? 'All systems operational' : 'Something needs attention'}</p>
        <p className="text-xs text-muted-foreground">
          {quietDays !== null ? `Last problem ${quietDays ? `${quietDays} day${quietDays === 1 ? '' : 's'} ago` : 'today'}` : history?.checks ? 'No problems recorded' : 'Collecting history'}
          {system && ` · API up ${formatDuration(system.api.uptimeSeconds)} · v${system.api.version} · ${system.api.environment}`}
        </p>
        {history ? (
          <div className="mt-3">
            <UptimeBars days={history.days} />
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>90 days ago</span>
              <span>
                {history.uptime !== null ? <><b className="text-success">{history.uptime}%</b> uptime · {history.checks.toLocaleString()} checks</> : 'No checks yet'}
                {history.firstCheck && ` · since ${formatDateTime(history.firstCheck)}`}
              </span>
              <span>Today</span>
            </div>
          </div>
        ) : (
          <Skeleton className="mt-3 h-8" />
        )}
      </div>
    </div>
  );
}

function Kpis({ traffic }: { traffic?: Traffic }) {
  if (!traffic) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  const t = traffic.lastHour;
  const tile = 'm-lift relative flex flex-col gap-1 overflow-hidden p-4';
  const recent = traffic.minutes.slice(-20);
  return (
    <div className="m-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Requests · last hour</span>
        <span className="text-[26px] font-bold leading-none tracking-tight"><CountUp value={t.requests} /></span>
        <span className="text-xs text-muted-foreground">{t.perMinute} a minute on average</span>
        <Spark values={recent.map((m) => m.requests)} className="absolute bottom-3 right-3 text-primary" width={80} height={26} />
      </Card>
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Typical response (p95)</span>
        <span className={cn('text-[26px] font-bold leading-none tracking-tight', t.p95 > 500 && 'text-warning')}><CountUp value={t.p95} /> ms</span>
        <span className="text-xs text-muted-foreground">half answer within {t.p50} ms</span>
        <Spark values={recent.map((m) => m.p95)} className="absolute bottom-3 right-3 text-info" width={80} height={26} />
      </Card>
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">Server errors · last hour</span>
        <span className={cn('text-[26px] font-bold leading-none tracking-tight', t.serverErrors ? 'text-destructive' : 'text-success')}>{t.errorRate}%</span>
        <span className="text-xs text-muted-foreground">{t.serverErrors} server error{t.serverErrors === 1 ? '' : 's'} · {t.clientErrors} refused (4xx)</span>
      </Card>
      <Card className={tile}>
        <span className="text-xs text-muted-foreground">People active now</span>
        <span className="text-[26px] font-bold leading-none tracking-tight"><CountUp value={traffic.activeUsers} /></span>
        <span className="text-xs text-muted-foreground">last 15 minutes · {traffic.activeCompanies} compan{traffic.activeCompanies === 1 ? 'y' : 'ies'}</span>
      </Card>
    </div>
  );
}

function Services({ system, history }: { system?: SystemStatus; history?: HealthHistory }) {
  return (
    <div className="m-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {(Object.keys(SERVICES) as ServiceKey[]).map((key) => {
        const meta = SERVICES[key];
        const state = stateOf(system, key);
        const latency = key === 'email' ? undefined : system?.health.latencyMs[key as 'database' | 'redis' | 'elasticsearch'];
        const series = history?.latency[key] ?? [];
        const off = state === 'disabled' || (key === 'email' && system?.email.provider === 'console');
        return (
          <Card key={key} className={cn('flex flex-col gap-3 p-4', state === 'error' && 'border-destructive/40')}>
            <div className="flex items-center gap-3">
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5', off ? 'bg-muted text-muted-foreground' : state === 'error' ? 'bg-destructive-soft text-destructive' : 'bg-success-soft text-success')}>{meta.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{meta.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{key === 'email' && system ? `${system.email.provider} · ${meta.purpose}` : meta.purpose}</span>
              </span>
              {state ? <Badge tone={STATE[state].tone} dot>{key === 'email' && system?.email.provider === 'console' ? 'Console only' : STATE[state].label}</Badge> : <Skeleton className="h-5 w-16" />}
            </div>
            {off && meta.how ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs">
                <p className="text-muted-foreground">{meta.how}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => copyText(meta.setting!, 'Setting copied — add it to the API’s .env, then restart')}>
                  <Copy /> Copy setting
                </Button>
              </div>
            ) : (
              <div className="mt-auto flex items-end justify-between border-t border-border pt-3">
                <span>
                  <span className={cn('block text-xl font-bold tabular-nums', (latency ?? 0) > 500 && 'text-warning')}>{latency !== undefined ? `${latency} ms` : key === 'email' ? (system?.email.checkedAt ? formatRelative(system.email.checkedAt) : '—') : '—'}</span>
                  <span className="text-[11px] text-muted-foreground">{key === 'email' ? 'last checked' : 'response · last check'}</span>
                </span>
                {series.length > 1 && <Spark values={series} className={state === 'error' ? 'text-destructive' : 'text-success'} width={96} height={30} />}
              </div>
            )}
            {state === 'error' && key === 'email' && system && <p className="text-xs text-destructive">{system.email.detail}</p>}
          </Card>
        );
      })}
    </div>
  );
}

function TrafficChart({ traffic }: { traffic: Traffic }) {
  const W = 700;
  const H = 150;
  const m = traffic.minutes;
  const maxReq = Math.max(5, ...m.map((x) => x.requests)) * 1.15;
  const maxP95 = Math.max(50, ...m.map((x) => x.p95)) * 1.15;
  const x = (i: number) => (i * W) / (m.length - 1);
  const line = (vals: number[], max: number) => vals.map((v, i) => `${x(i).toFixed(1)},${(H - (v / max) * (H - 8)).toFixed(1)}`).join(' ');
  const req = line(m.map((v) => v.requests), maxReq);
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4 text-muted-foreground" /> Traffic &amp; speed
        <span className="ml-auto flex items-center gap-3 text-xs font-normal text-muted-foreground">
          <span className="flex items-center gap-1"><i className="block h-2 w-3 rounded-sm bg-primary" /> requests / min</span>
          <span className="flex items-center gap-1"><i className="block h-0.5 w-3 bg-info" /> p95 ms</span>
          <span className="flex items-center gap-1"><i className="block h-2 w-3 rounded-sm bg-destructive/30" /> errors</span>
        </span>
      </h2>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-48 w-full" preserveAspectRatio="none" role="img" aria-label="Requests per minute and response time for the last hour">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} className="stroke-border" strokeWidth={1} />)}
        {m.map((v, i) => (v.errors ? <rect key={v.at} x={x(i) - 4} y={0} width={8} height={H} className="fill-destructive/20" /> : null))}
        <path d={`M0,${H} L${req.replace(/ /g, ' L')} L${W},${H} Z`} className="fill-primary/10" />
        <polyline points={req} fill="none" className="stroke-primary m-line" strokeWidth={2.2} strokeLinejoin="round" style={{ ['--m-len' as string]: 2000 }} />
        <polyline points={line(m.map((v) => v.p95), maxP95)} fill="none" className="stroke-info" strokeWidth={1.8} strokeLinejoin="round" />
        {['−60m', '−45m', '−30m', '−15m', 'now'].map((t, i) => (
          <text key={t} x={(i * W) / 4} y={H + 15} fontSize={11} className="fill-muted-foreground" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{t}</text>
        ))}
      </svg>
      <p className="text-xs text-muted-foreground">Counted on this API server since it started {formatRelative(traffic.since)}. Resets when the API restarts.</p>
    </Card>
  );
}

function Slowest({ traffic }: { traffic: Traffic }) {
  const top = Math.max(1, ...traffic.slowest.map((s) => s.p95));
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-muted-foreground" /> Slowest endpoints<span className="ml-auto text-xs font-normal text-muted-foreground">p95 · since start</span></h2>
      {traffic.slowest.length ? (
        <ul className="m-stagger space-y-2.5">
          {traffic.slowest.map((s) => (
            <li key={`${s.method} ${s.route}`} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold">{s.method}</span>
                <code className="min-w-0 flex-1 truncate" title={s.route}>{s.route.replace(/^\/api\/v1/, '')}</code>
                <span className="text-muted-foreground">{s.calls}×</span>
                <b className={cn('w-16 text-right tabular-nums', s.p95 > 500 && 'text-warning')}>{s.p95} ms</b>
              </div>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                <i className={cn('m-fill-w block h-full rounded-full', s.p95 > 500 ? 'bg-warning' : 'bg-info')} style={{ width: `${(s.p95 / top) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">Not enough requests yet.</p>
      )}
      {traffic.recentErrors.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Recent server errors</p>
          <ul className="space-y-1 text-xs">
            {traffic.recentErrors.slice(0, 5).map((e) => (
              <li key={`${e.at}-${e.route}`} className="flex gap-2">
                <span className="text-muted-foreground">{formatRelative(e.at)}</span>
                <code className="min-w-0 flex-1 truncate">{e.method} {e.route.replace(/^\/api\/v1/, '')}</code>
                <b className="text-destructive">{e.status}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function HealthTab({ system }: { system?: SystemStatus }) {
  const history = useHealthHistory();
  const traffic = useTraffic();
  return (
    <div className="space-y-5">
      <Hero system={system} history={history.data} />
      <Kpis traffic={traffic.data} />
      <Services system={system} history={history.data} />
      {traffic.data ? (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <TrafficChart traffic={traffic.data} />
          <Slowest traffic={traffic.data} />
        </div>
      ) : (
        <Skeleton className="h-64" />
      )}
    </div>
  );
}
