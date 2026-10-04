'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Database, ExternalLink, HardDrive, Mail, RefreshCw, Zap } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Ring } from '@/components/dashboard/widgets';
import { useOpenQueueDashboard, useSendTestEmail } from '@/lib/admin/queries';
import { fmtBytes, useDatabaseInfo, useEmailLog, useQueueInfo, useRetryEmail, useStorageInfo } from '@/lib/admin/system';
import type { SystemStatus } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { copyText } from './health-tab';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border py-2 text-xs last:border-0">
      <span className="flex-1 text-muted-foreground">{label}</span>
      <b className="text-right">{value}</b>
    </div>
  );
}

function Bar({ label, right, value, max, tone = 'bg-info', dot }: { label: React.ReactNode; right: React.ReactNode; value: number; max: number; tone?: string; dot?: React.ReactNode }) {
  return (
    <div className="text-xs">
      <div className="flex items-center gap-2">
        {dot}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <b className="tabular-nums">{right}</b>
      </div>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
        <i className={cn('m-fill-w block h-full rounded-full', tone)} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </span>
    </div>
  );
}

function DatabaseCard() {
  const db = useDatabaseInfo();
  const d = db.data;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Database className="h-4 w-4 text-muted-foreground" /> Database
        {d?.version && <Badge tone="success" className="ml-auto">PostgreSQL {d.version.split(' ')[0]}</Badge>}
      </h2>
      {!d ? (
        <Skeleton className="h-56" />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Ring value={d.connections.used} max={d.connections.max} size={96} stroke={9} tone={d.connections.used / d.connections.max > 0.8 ? 'warning' : 'info'} label={`${d.connections.used} of ${d.connections.max} connections`}>
              <span className="text-center leading-tight">
                <b className="block text-lg">{fmtBytes(d.sizeBytes)}</b>
                <span className="text-[10px] text-muted-foreground">in use</span>
              </span>
            </Ring>
            <div className="min-w-0 flex-1">
              <Row label="Connections" value={`${d.connections.used} of ${d.connections.max}`} />
              <Row label="Latest change" value={d.latestMigration ? d.latestMigration.name.replace(/_/g, ' ') : '—'} />
              <Row label="Applied" value={d.latestMigration ? formatRelative(d.latestMigration.appliedAt) : '—'} />
            </div>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Biggest tables</p>
          <div className="m-stagger space-y-2.5">
            {d.tables.map((t) => (
              <Bar key={t.name} label={<code>{t.name}</code>} right={<>{fmtBytes(t.bytes)} <span className="font-normal text-muted-foreground">· {t.rows.toLocaleString()} rows</span></>} value={t.bytes} max={d.tables[0]?.bytes ?? 1} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function StorageCard() {
  const st = useStorageInfo();
  const s = st.data;
  const used = s?.disk ? s.disk.totalBytes - s.disk.freeBytes : 0;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <HardDrive className="h-4 w-4 text-muted-foreground" /> File storage
        {s && <Badge tone="neutral" className="ml-auto">{s.driver === 'local' ? 'Server disk' : s.driver.toUpperCase()}</Badge>}
      </h2>
      {!s ? (
        <Skeleton className="h-56" />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Ring value={used} max={s.disk?.totalBytes ?? 1} size={96} stroke={9} tone={s.disk && used / s.disk.totalBytes > 0.85 ? 'danger' : 'primary'} label="Disk used">
              <span className="text-center leading-tight">
                <b className="block text-lg">{fmtBytes(s.bytes)}</b>
                <span className="text-[10px] text-muted-foreground">our files</span>
              </span>
            </Ring>
            <div className="min-w-0 flex-1">
              <Row label="Files" value={s.files?.toLocaleString() ?? '—'} />
              <Row label="Disk free" value={s.disk ? `${fmtBytes(s.disk.freeBytes)} of ${fmtBytes(s.disk.totalBytes)}` : '—'} />
              <Row label="Added this week" value={`+${fmtBytes(s.addedThisWeekBytes)}`} />
            </div>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">By company</p>
          <div className="m-stagger space-y-2.5">
            {s.byCompany.length ? (
              s.byCompany.map((c) => <Bar key={c.id} label={c.name} right={<>{fmtBytes(c.bytes)} <span className="font-normal text-muted-foreground">· {c.files} files</span></>} value={c.bytes} max={s.byCompany[0]?.bytes ?? 1} tone="bg-primary" />)
            ) : (
              <p className="text-xs text-muted-foreground">No documents, receipts or attachments yet.</p>
            )}
          </div>
          {s.driver === 'local' && <p className="text-xs text-muted-foreground">Documents, receipts and attachments. Moving to S3 keeps them safe if this server is replaced.</p>}
        </>
      )}
    </Card>
  );
}

function JobsCard() {
  const queue = useQueueInfo();
  const openQueue = useOpenQueueDashboard();
  const q = queue.data;
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
  const tiles: Array<[string, number | undefined, string]> = [
    ['Waiting', q?.counts?.waiting, 'text-foreground'],
    ['Running', q?.counts?.active, 'text-info'],
    ['Failed', q?.counts?.failed, 'text-destructive'],
    ['Done (kept 24 h)', q?.counts?.completed, 'text-success'],
  ];
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Zap className="h-4 w-4 text-muted-foreground" /> Background jobs
        {q && <Badge tone={q.enabled ? 'success' : 'neutral'} className="ml-auto">{q.enabled ? 'Queue on' : 'Inline'}</Badge>}
      </h2>
      {!q ? (
        <Skeleton className="h-56" />
      ) : (
        <>
          {!q.enabled && (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              Without Redis, emails go out <b className="text-foreground">during the request</b>. If the email server is slow, the person clicking waits — and a failed email isn’t tried again.
            </p>
          )}
          {!q.enabled && <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">With Redis you’d see</p>}
          <div className={cn('grid grid-cols-2 gap-2', !q.enabled && 'opacity-50')}>
            {tiles.map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border border-border bg-muted/30 p-2.5">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className={cn('text-lg font-bold tabular-nums', tone)}>{value ?? '—'}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            {!q.enabled && (
              <Button size="sm" variant="secondary" onClick={() => copyText('REDIS_URL=redis://…', 'Setting copied — add it to the API’s .env, then restart')}>
                <Copy /> Copy REDIS_URL setting
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={!q.enabled} loading={openQueue.isPending} onClick={() => void openBullBoard()}>
              <ExternalLink /> Open Bull Board
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function EmailCard({ system }: { system?: SystemStatus }) {
  const [status, setStatus] = useState<'SENT' | 'FAILED' | undefined>(undefined);
  const [page, setPage] = useState(1);
  const log = useEmailLog({ status, page });
  const retry = useRetryEmail();
  const sendTest = useSendTestEmail();
  const [to, setTo] = useState('');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
  const email = system?.email;
  const l = log.data;
  const stateTone = email?.state === 'ok' ? 'success' : email?.state === 'error' ? 'danger' : email?.state === 'unverified' ? 'warning' : 'neutral';

  return (
    <div id="email-delivery" className="scroll-mt-20">
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Mail className="h-4 w-4 text-muted-foreground" /> Email delivery
        {email && <Badge tone={stateTone} dot>{email.state === 'ok' ? 'Connected' : email.state === 'error' ? 'Not working' : email.state === 'unverified' ? 'Not checked yet' : 'Not sending'} · {email.provider}</Badge>}
        {email && <span className="ml-auto text-xs font-normal text-muted-foreground">From <code>{email.from}</code>{email.checkedAt && ` · checked ${formatRelative(email.checkedAt)}`}</span>}
      </h2>
      {email?.state === 'error' && <p className="rounded-lg bg-destructive-soft/50 px-3 py-2 text-xs text-destructive">{email.detail}</p>}

      <div className="m-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['Sent today', l?.stats.sentToday, ''],
          ['Failed today', l?.stats.failedToday, l?.stats.failedToday ? 'text-destructive' : ''],
          ['Average send time', l ? `${(l.stats.avgMs / 1000).toFixed(1)} s` : undefined, ''],
          ['Failed · 7 days', l?.stats.failedWeek, l?.stats.failedWeek ? 'text-warning' : ''],
        ] as const).map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', tone)}>{value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        {([[undefined, 'All'], ['SENT', 'Sent'], ['FAILED', 'Failed']] as const).map(([v, label]) => (
          <button key={label} type="button" onClick={() => { setStatus(v); setPage(1); }} className={cn('rounded-lg px-3 py-1.5 text-xs font-medium', status === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-subtle')}>
            {label}
          </button>
        ))}
      </div>

      <div className={cn('overflow-x-auto transition-opacity', log.isFetching && 'opacity-70')}>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-3 font-semibold">Email</th>
              <th className="py-2 pr-3 font-semibold">To</th>
              <th className="py-2 pr-3 font-semibold">Company</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 text-right font-semibold">When</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!l ? (
              <tr><td colSpan={6} className="py-3"><Skeleton className="h-24" /></td></tr>
            ) : !l.data.length ? (
              <tr><td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">No emails {status === 'FAILED' ? 'failed' : 'recorded'} yet.</td></tr>
            ) : (
              l.data.map((e) => (
                <tr key={e.id}>
                  <td className="max-w-[260px] py-2.5 pr-3">
                    <span className="block truncate font-medium" title={e.subject}>{e.subject}</span>
                    {e.status === 'FAILED' && e.error && <span className="block truncate text-xs text-destructive" title={e.error}>{e.error}</span>}
                    {e.retriedAt && e.status === 'SENT' && <span className="block text-xs text-success">Sent on retry</span>}
                  </td>
                  <td className="max-w-[200px] truncate py-2.5 pr-3 text-muted-foreground" title={e.to}>{e.to}</td>
                  <td className="py-2.5 pr-3 text-xs">{e.company?.name ?? <span className="text-muted-foreground">Platform</span>}</td>
                  <td className="py-2.5 pr-3"><Badge tone={e.status === 'SENT' ? 'success' : 'danger'}>{e.status === 'SENT' ? 'Sent' : 'Failed'}</Badge></td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right text-xs text-muted-foreground">{formatRelative(e.createdAt)}</td>
                  <td className="py-2.5 text-right">
                    {e.canRetry && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={retry.isPending && retry.variables === e.id}
                        onClick={() => retry.mutate(e.id, { onSuccess: () => toast.success(`Sent again to ${e.to}`), onError: (err) => toast.error(getApiErrorMessage(err, 'Still failing')) })}
                      >
                        <RefreshCw /> Retry
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {l && l.meta.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          Page {l.meta.page} of {l.meta.totalPages}
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
          <Button size="sm" variant="secondary" disabled={page >= l.meta.totalPages} onClick={() => setPage((p) => p + 1)}>›</Button>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center">
        <p className="flex-1 text-xs text-muted-foreground">Only the subject, recipient and result are kept. A failed email’s content is kept encrypted for 7 days so it can be retried. Everything is cleared after 30 days.</p>
        {email && email.provider !== 'console' && (
          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (!valid) return;
              try {
                const r = await sendTest.mutateAsync(to.trim());
                toast.success(r.message);
              } catch (err) {
                toast.error(getApiErrorMessage(err, 'Test email failed'));
              }
            }}
          >
            <Input type="email" value={to} onChange={(ev) => setTo(ev.target.value)} placeholder="you@example.com" aria-label="Send test email to" />
            <Button type="submit" loading={sendTest.isPending} disabled={!valid}>Send test email</Button>
          </form>
        )}
      </div>
    </Card>
    </div>
  );
}

export function DataTab({ system }: { system?: SystemStatus }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <DatabaseCard />
        <StorageCard />
        <JobsCard />
      </div>
      <EmailCard system={system} />
    </div>
  );
}
